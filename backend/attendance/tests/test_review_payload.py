"""
Phase 2 — the response schema: summary, missing_days, scope_label.

missing_days is the block with teeth: it drives an alert telling a named teacher
they failed to submit. A false positive here is a false accusation, so the tests
lean on the cases that would produce one — holidays, weekends, and days before
the class existed.
"""
from datetime import date, timedelta

from django.test import TestCase
from django.urls import reverse
from rest_framework import status

from attendance.models import Attendance, Holiday
from attendance.tests.helpers import TenantContext, authenticated_client
from campus.models import Campus
from classes.models import ClassRoom, Grade, Level
from teachers.models import Teacher
from users.models import Organization, RolePermission, User

# A settled week in the past: Mon 2026-07-06 → Sun 2026-07-12.
MONDAY = date(2026, 7, 6)
TUESDAY = date(2026, 7, 7)
SUNDAY = date(2026, 7, 12)


class ReviewPayloadTests(TestCase):

    @classmethod
    def setUpTestData(cls):
        cls.url = reverse('attendance:attendance_review')
        cls.missing_url = reverse('attendance:attendance_review_missing')

        cls.org = Organization.objects.create(name='IAK', subdomain='iak-payload')
        cls.campus = Campus.objects.create(
            organization=cls.org, campus_name='Main', campus_code='C01',
        )
        cls.level = Level.objects.create(
            organization=cls.org, campus=cls.campus, name='Primary', shift='morning',
        )
        cls.grade = Grade.objects.create(
            organization=cls.org, level=cls.level, campus=cls.campus, name='Class 5',
        )
        cls.classroom = ClassRoom.objects.create(
            organization=cls.org, grade=cls.grade, section='A', shift='morning',
        )

        RolePermission.objects.update_or_create(
            organization=cls.org, role='teacher',
            permission_codename='view_attendance',
            defaults={'is_allowed': True},
        )
        cls.user = User.objects.create_user(
            username='payload-teacher', email='payload-teacher@iak.test',
            password='pw-test-12345', role='teacher', organization=cls.org,
        )
        cls.teacher = Teacher.objects.create(
            organization=cls.org,
            employee_code=cls.user.username,
            email=cls.user.email,
            full_name='Payload Teacher',
            dob=date(1990, 1, 1),
            gender='male',
            contact_number='03000000000',
            cnic='44444-4444444-4',
        )
        cls.classroom.class_teacher = cls.teacher
        cls.classroom.save()

        # Backdate created_at last, and via update(): missing-day detection skips
        # days before a classroom existed, and auto_now_add stamps today. Any
        # save() on the instance after this would write the stale in-memory
        # created_at straight back over it.
        cls.backdate_classroom(date(2026, 1, 1))

    @classmethod
    def backdate_classroom(cls, day):
        # TenantContext is required: without a current user, OrganizationManager
        # filters this queryset to nothing and update() silently matches 0 rows.
        with TenantContext(cls.user):
            ClassRoom.objects.filter(pk=cls.classroom.pk).update(created_at=day)

    def setUp(self):
        self.client = authenticated_client(self.user)

    def _week(self, url=None):
        return self.client.get(
            url or self.url,
            {'from': MONDAY.isoformat(), 'to': SUNDAY.isoformat()},
        ).json()

    def _attendance(self, day, status_value):
        return Attendance.objects.create(
            organization=self.org, classroom=self.classroom,
            date=day, status=status_value,
        )

    def _missing_dates(self, payload=None):
        payload = payload or self._week()
        rows = payload['missing_days']
        return rows[0]['dates'] if rows else []

    # ── missing_days ─────────────────────────────────────────────────────────

    def test_every_working_day_is_missing_when_nothing_submitted(self):
        """Mon–Sat is six teaching days; Sunday is not one."""
        self.assertEqual(len(self._missing_dates()), 6)

    def test_sunday_is_never_reported_missing(self):
        self.assertNotIn(SUNDAY.isoformat(), self._missing_dates())

    def test_submitted_day_is_not_missing(self):
        self._attendance(TUESDAY, 'submitted')
        self.assertNotIn(TUESDAY.isoformat(), self._missing_dates())

    def test_approved_day_is_not_missing(self):
        self._attendance(TUESDAY, 'approved')
        self.assertNotIn(TUESDAY.isoformat(), self._missing_dates())

    def test_draft_day_is_still_missing(self):
        """A half-marked register nobody submitted is what the alert is for."""
        self._attendance(TUESDAY, 'draft')
        self.assertIn(TUESDAY.isoformat(), self._missing_dates())

    def test_deleted_attendance_does_not_count_as_submitted(self):
        attendance = self._attendance(TUESDAY, 'submitted')
        with TenantContext(self.user):
            Attendance.objects.filter(pk=attendance.pk).update(is_deleted=True)
        self.assertIn(TUESDAY.isoformat(), self._missing_dates())

    def test_holiday_is_not_reported_missing(self):
        """The false-alarm case: nobody was at school, so nobody forgot."""
        Holiday.objects.create(
            organization=self.org, date=TUESDAY, reason='Exam break',
        )
        self.assertNotIn(TUESDAY.isoformat(), self._missing_dates())

    def test_own_levels_holiday_excuses_this_class(self):
        """A holiday targeted at this class's own level, not the whole org.

        Added after a mutation survived: replacing the per-classroom holiday
        lookup with an org-wide one broke nothing, because every holiday case
        covered here was either org-wide or aimed at a level this class is not
        in. This is the case that pins the lookup down.
        """
        holiday = Holiday.objects.create(
            organization=self.org, date=TUESDAY, reason='Primary exam break',
        )
        holiday.levels.set([self.level])
        self.assertNotIn(TUESDAY.isoformat(), self._missing_dates())

    def test_own_grades_holiday_excuses_this_class(self):
        holiday = Holiday.objects.create(
            organization=self.org, date=TUESDAY, reason='Class 5 trip',
        )
        holiday.grades.set([self.grade])
        self.assertNotIn(TUESDAY.isoformat(), self._missing_dates())

    def test_another_levels_holiday_does_not_excuse_this_class(self):
        """Scoping cuts both ways — it must not hide a real missing day."""
        other_level = Level.objects.create(
            organization=self.org, campus=self.campus,
            name='Secondary', shift='morning',
        )
        holiday = Holiday.objects.create(
            organization=self.org, date=TUESDAY, reason='Secondary only',
        )
        holiday.levels.set([other_level])
        self.assertIn(TUESDAY.isoformat(), self._missing_dates())

    def test_days_before_the_classroom_existed_are_not_missing(self):
        self.backdate_classroom(TUESDAY)
        dates = self._missing_dates()
        self.assertNotIn(MONDAY.isoformat(), dates)
        self.assertIn(TUESDAY.isoformat(), dates)

    def test_missing_row_names_the_teacher_to_remind(self):
        row = self._week()['missing_days'][0]
        self.assertEqual(row['classroom_id'], self.classroom.id)
        self.assertEqual(row['class_teacher']['name'], 'Payload Teacher')

    def test_fully_submitted_week_reports_nothing(self):
        for offset in range(6):  # Mon–Sat
            self._attendance(MONDAY + timedelta(days=offset), 'submitted')
        self.assertEqual(self._week()['missing_days'], [])

    # ── summary ──────────────────────────────────────────────────────────────

    def test_summary_counts_one_entry_per_classroom_day(self):
        """Six missing days in one class reads as 6, not 1."""
        self.assertEqual(self._week()['summary']['missing_submissions'], 6)

    def test_summary_has_the_documented_keys(self):
        summary = self._week()['summary']
        self.assertEqual(
            set(summary), {'total_students', 'avg_rate', 'missing_submissions'},
        )

    def test_summary_missing_count_matches_the_listed_dates(self):
        self._attendance(TUESDAY, 'submitted')
        payload = self._week()
        self.assertEqual(
            payload['summary']['missing_submissions'],
            sum(len(m['dates']) for m in payload['missing_days']),
        )

    # ── date_range / meta ────────────────────────────────────────────────────

    def test_working_days_drops_holidays_as_well_as_sundays(self):
        Holiday.objects.create(
            organization=self.org, date=TUESDAY, reason='Exam break',
        )
        self.assertEqual(self._week()['date_range']['working_days'], 5)

    def test_scope_label_names_the_teachers_class(self):
        self.assertEqual(self._week()['meta']['scope_label'], str(self.classroom))

    # ── drill-down responses stay lean ───────────────────────────────────────

    def test_expand_response_omits_the_page_level_blocks(self):
        """A drill-down returns one branch's rows; whole-scope totals would be
        recomputed work the caller already has."""
        payload = self.client.get(self.url, {'expand': 'classroom'}).json()
        self.assertNotIn('summary', payload)
        self.assertNotIn('missing_days', payload)

    # ── dedicated endpoint ───────────────────────────────────────────────────

    def test_missing_endpoint_agrees_with_the_embedded_block(self):
        self._attendance(TUESDAY, 'submitted')
        standalone = self._week(url=self.missing_url)
        self.assertEqual(standalone['missing_days'], self._week()['missing_days'])
        self.assertEqual(standalone['total_missing'], 5)

    def test_missing_endpoint_enforces_the_permission(self):
        RolePermission.objects.update_or_create(
            organization=self.org, role='teacher',
            permission_codename='view_attendance',
            defaults={'is_allowed': False},
        )
        response = self.client.get(self.missing_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_missing_endpoint_validates_dates(self):
        tomorrow = (date.today() + timedelta(days=1)).isoformat()
        response = self.client.get(
            self.missing_url, {'from': '2026-07-01', 'to': tomorrow},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.json()['error']['code'], 'INVALID_DATE_RANGE')
