"""
Phase 3 — the Daily Attendance Summary endpoint.

GET /api/attendance/review/daily/?date=YYYY-MM-DD

Built for the Principal's dashboard: every classroom in scope for a single day
with its teacher, no. on roll, present/absent and the requirement's attendance
percentage — (present ÷ total) × 100, NOT the tree's leave-adjusted metric.

The two things this endpoint must never lie about:
  - a classroom with no register reads 0 / 0, not a made-up number
  - the campus `summary` is the sum of the rows, so the footer cannot drift
"""
from datetime import date, timedelta

from django.test import TestCase
from django.urls import reverse
from rest_framework import status

from attendance.models import Attendance
from attendance.tests.helpers import TenantContext, authenticated_client
from campus.models import Campus
from classes.models import ClassRoom, Grade, Level
from principals.models import Principal
from students.models import Student
from users.models import Organization, RolePermission, User

DAY = date(2026, 7, 7)  # a settled Tuesday in the past


class ReviewDailyTests(TestCase):

    @classmethod
    def setUpTestData(cls):
        cls.url = reverse('attendance:attendance_review_daily')

        cls.org = Organization.objects.create(name='IAK', subdomain='iak-daily')
        cls.campus = Campus.objects.create(
            organization=cls.org, campus_name='Main', campus_code='C01',
        )
        cls.level = Level.objects.create(
            organization=cls.org, campus=cls.campus, name='Primary', shift='morning',
        )
        cls.grade = Grade.objects.create(
            organization=cls.org, level=cls.level, campus=cls.campus, name='Class 5',
        )
        cls.classroom_a = ClassRoom.objects.create(
            organization=cls.org, grade=cls.grade, section='A', shift='morning',
        )
        cls.classroom_b = ClassRoom.objects.create(
            organization=cls.org, grade=cls.grade, section='B', shift='morning',
        )

        RolePermission.objects.update_or_create(
            organization=cls.org, role='principal',
            permission_codename='view_attendance',
            defaults={'is_allowed': True},
        )
        cls.user = User.objects.create_user(
            username='principal1', email='principal1@iak.test',
            password='pw-test-12345', role='principal', organization=cls.org,
        )
        Principal.objects.create(
            organization=cls.org,
            campus=cls.campus,
            email=cls.user.email,
            full_name='Test Principal',
            dob=date(1980, 1, 1),
            gender='male',
            contact_number='03000000000',
            cnic='44444-4444444-4',
            permanent_address='Main Street',
            education_level='Bachelor',
            institution_name='Institute',
            year_of_passing=2005,
            total_experience_years=10,
            shift='morning',
            joining_date=date(2015, 1, 1),
            designation='principal',
            status='active',
            is_currently_active=True,
        )

    def setUp(self):
        self.client = authenticated_client(self.user)

    # ── data builders ────────────────────────────────────────────────────────

    def _student(self, classroom, name='Student', gender='male'):
        return Student.objects.create(
            organization=self.org, classroom=classroom,
            name=name, gender=gender, is_draft=False,
        )

    def _register(self, classroom, present, absent, status_value='submitted'):
        return Attendance.objects.create(
            organization=self.org, classroom=classroom, date=DAY,
            status=status_value,
            total_students=present + absent,
            present_count=present,
            absent_count=absent,
        )

    def _fetch(self, **params):
        return self.client.get(self.url, params).json()

    # ── payload shape ────────────────────────────────────────────────────────

    def test_returns_daily_summary_shape(self):
        payload = self._fetch(date=DAY.isoformat())
        self.assertEqual(payload['type'], 'daily_summary')
        self.assertEqual(payload['date'], DAY.isoformat())
        self.assertEqual(payload['campus'], 'Main')
        self.assertEqual(payload['meta']['role'], 'principal')
        self.assertIn('rows', payload)
        self.assertIn('summary', payload)

    def test_row_carries_class_teacher_and_counts(self):
        self._student(self.classroom_a)
        payload = self._fetch(date=DAY.isoformat())
        row = payload['rows'][0]
        self.assertEqual(row['class_name'], 'Class 5 - A')
        self.assertEqual(row['teacher'], None)
        self.assertEqual(row['no_on_roll'], 1)
        self.assertEqual(row['present'], 0)
        self.assertEqual(row['absent'], 0)

    def test_every_campus_classroom_appears_even_without_a_register(self):
        payload = self._fetch(date=DAY.isoformat())
        self.assertEqual(len(payload['rows']), 2)
        self.assertNotIn('Class 5 - C', [r['class_name'] for r in payload['rows']])

    def test_assigned_teacher_is_reported_and_unassigned_is_none(self):
        from teachers.models import Teacher

        teacher = Teacher.objects.create(
            organization=self.org,
            employee_code='tc-1',
            email='tc-1@iak.test',
            full_name='Ayesha Khan',
            dob=date(1990, 1, 1),
            gender='female',
            contact_number='03000000000',
            cnic='44444-4444444-4',
        )
        with TenantContext(self.user):
            ClassRoom.objects.filter(pk=self.classroom_a.pk).update(class_teacher=teacher)
        payload = self._fetch(date=DAY.isoformat())
        rows = {r['class_name']: r for r in payload['rows']}
        self.assertEqual(rows['Class 5 - A']['teacher']['name'], 'Ayesha Khan')
        self.assertEqual(rows['Class 5 - B']['teacher'], None)

    # ── percentages use the requirement formula ──────────────────────────────

    def test_attendance_pct_is_present_over_total(self):
        self._student(self.classroom_a)
        self._student(self.classroom_a)
        self._register(self.classroom_a, present=1, absent=1)
        row = self._fetch(date=DAY.isoformat())['rows'][0]
        self.assertEqual(row['no_on_roll'], 2)
        self.assertEqual(row['present'], 1)
        self.assertEqual(row['absent'], 1)
        self.assertEqual(row['attendance_pct'], 50.0)

    def test_attendance_pct_rounded_to_two_decimals(self):
        self._student(self.classroom_a)
        self._student(self.classroom_a)
        self._student(self.classroom_a)
        self._register(self.classroom_a, present=2, absent=1)
        row = self._fetch(date=DAY.isoformat())['rows'][0]
        self.assertEqual(row['attendance_pct'], 66.67)

    def test_zero_total_never_divides_by_zero(self):
        # No students → the endpoint must not crash on a 0 denominator.
        payload = self._fetch(date=DAY.isoformat())
        self.assertEqual(payload['summary']['attendance_pct'], 0)

    # ── summary is the sum of the rows ───────────────────────────────────────

    def test_summary_matches_sum_of_rows(self):
        self._student(self.classroom_a)
        self._student(self.classroom_a)
        self._register(self.classroom_a, present=1, absent=1)
        self._student(self.classroom_b)
        self._student(self.classroom_b)
        self._student(self.classroom_b)
        self._register(self.classroom_b, present=3, absent=0)

        summary = self._fetch(date=DAY.isoformat())['summary']
        self.assertEqual(summary['total_students'], 5)
        self.assertEqual(summary['present'], 4)
        self.assertEqual(summary['absent'], 1)
        self.assertEqual(summary['class_count'], 2)
        self.assertEqual(summary['attendance_pct'], 80.0)

    # ── registers ────────────────────────────────────────────────────────────

    def test_deleted_attendance_does_not_count(self):
        self._student(self.classroom_a)
        attendance = self._register(self.classroom_a, present=1, absent=0)
        with TenantContext(self.user):
            Attendance.objects.filter(pk=attendance.pk).update(is_deleted=True)
        row = self._fetch(date=DAY.isoformat())['rows'][0]
        self.assertEqual(row['present'], 0)

    def test_draft_register_is_included(self):
        """A half-marked register is still the truest picture of that day."""
        self._student(self.classroom_a)
        self._register(self.classroom_a, present=1, absent=0, status_value='draft')
        row = self._fetch(date=DAY.isoformat())['rows'][0]
        self.assertEqual(row['present'], 1)

    def test_attendance_on_another_day_does_not_leak_in(self):
        self._student(self.classroom_a)
        self._register(self.classroom_a, present=1, absent=0)
        self._register(self.classroom_b, present=1, absent=0)
        row_a = self._fetch(date=DAY.isoformat())['rows'][0]
        self.assertEqual(row_a['present'], 1)

    # ── date validation ──────────────────────────────────────────────────────

    def test_future_date_is_rejected(self):
        future = (date.today() + timedelta(days=1)).isoformat()
        response = self.client.get(self.url, {'date': future})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.json()['error']['code'], 'INVALID_DATE_RANGE')

    def test_malformed_date_is_rejected(self):
        response = self.client.get(self.url, {'date': 'not-a-date'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.json()['error']['code'], 'INVALID_DATE_RANGE')

    def test_missing_date_defaults_to_today(self):
        payload = self._fetch()
        self.assertEqual(payload['date'], date.today().isoformat())
