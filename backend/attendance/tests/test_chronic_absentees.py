"""
Phase 6 — chronic absentees.

Names individual students below an attendance threshold across the caller's
scope. Because it names students, it is behind both the view_attendance toggle
and roll access, and it is scoped the same way the review endpoint is.
"""
from datetime import date, timedelta

from django.test import TestCase
from django.urls import reverse
from rest_framework import status

from attendance.models import Attendance, StudentAttendance
from attendance.tests.helpers import authenticated_client
from campus.models import Campus
from classes.models import ClassRoom, Grade, Level
from coordinator.models import Coordinator
from students.models import Student
from users.models import Organization, RolePermission, User

MONDAY = date(2026, 7, 6)
SATURDAY = date(2026, 7, 11)


class ChronicAbsenteesTests(TestCase):

    @classmethod
    def setUpTestData(cls):
        cls.url = reverse('attendance:chronic_absentees')
        cls.org = Organization.objects.create(name='IAK', subdomain='iak-chronic')
        cls.campus = Campus.objects.create(
            organization=cls.org, campus_name='Main', campus_code='C01',
        )
        cls.own_level = Level.objects.create(
            organization=cls.org, campus=cls.campus, name='Primary', shift='morning',
        )
        cls.other_level = Level.objects.create(
            organization=cls.org, campus=cls.campus, name='Secondary', shift='morning',
        )
        cls._classroom_a = cls.classroom = cls._classroom(cls.own_level, 'Class 5')
        cls._classroom_b = cls.foreign_classroom = cls._classroom(cls.other_level, 'Class 9')

        # Six school days, Mon–Sat. Rates below are out of these six.
        cls.days = [MONDAY + timedelta(days=i) for i in range(6)]

        # One Attendance row per (classroom, day), created up front. get_or_create
        # inside the per-student loop would not work: with no request user,
        # OrganizationManager filters the get() to nothing, so it would try to
        # create a duplicate and hit the unique constraint.
        cls.attendance = {}
        for classroom in (cls._classroom_a, cls._classroom_b):
            for day in cls.days:
                cls.attendance[(classroom.id, day)] = Attendance.objects.create(
                    organization=cls.org, classroom=classroom, date=day, status='approved',
                )

        # 2/6 present → 33%  (severe, < 60)
        cls.severe = cls._student(cls.classroom, 'Severe Sam')
        cls._mark(cls.severe, present=2, absent=4)
        # 5/6 present → 83%  (below 90, above 75)
        cls.mild = cls._student(cls.classroom, 'Mild Mia')
        cls._mark(cls.mild, present=5, absent=1)
        # 6/6 present → 100% (never chronic)
        cls.perfect = cls._student(cls.classroom, 'Perfect Pat')
        cls._mark(cls.perfect, present=6, absent=0)
        # In scope only through another level — must not appear.
        cls.foreign = cls._student(cls.foreign_classroom, 'Foreign Fay')
        cls._mark(cls.foreign, present=0, absent=6, classroom=cls.foreign_classroom)

        RolePermission.objects.update_or_create(
            organization=cls.org, role='coordinator',
            permission_codename='view_attendance',
            defaults={'is_allowed': True},
        )
        cls.user = User.objects.create_user(
            username='chronic-coord', email='chronic-coord@iak.test',
            password='pw-test-12345', role='coordinator', organization=cls.org,
        )
        coordinator = Coordinator.objects.create(
            organization=cls.org, email=cls.user.email, full_name='Chronic Coord',
            employee_code=cls.user.username, dob=date(1985, 1, 1), gender='male',
            contact_number='03001234567', cnic='77777-7777777-7',
            permanent_address='Karachi', education_level='Masters',
            institution_name='University', year_of_passing=2008,
            total_experience_years=8, joining_date=date(2020, 1, 1),
        )
        coordinator.assigned_levels.set([cls.own_level])

    @classmethod
    def _classroom(cls, level, grade_name):
        grade = Grade.objects.create(
            organization=cls.org, level=level, campus=level.campus, name=grade_name,
        )
        return ClassRoom.objects.create(
            organization=cls.org, grade=grade, section='A', shift='morning',
        )

    @classmethod
    def _student(cls, classroom, name):
        return Student.objects.create(
            organization=cls.org, classroom=classroom, name=name, is_draft=False,
        )

    @classmethod
    def _mark(cls, student, present, absent, classroom=None):
        classroom = classroom or cls.classroom
        for i, day in enumerate(cls.days):
            StudentAttendance.objects.create(
                organization=cls.org,
                attendance=cls.attendance[(classroom.id, day)],
                student=student,
                status='present' if i < present else 'absent',
            )

    def setUp(self):
        self.client = authenticated_client(self.user)

    def _get(self, **params):
        return self.client.get(
            self.url,
            {'from': MONDAY.isoformat(), 'to': SATURDAY.isoformat(), **params},
        )

    def _names(self, response):
        return {a['student_name'] for a in response.json()['absentees']}

    # ── Threshold ────────────────────────────────────────────────────────────

    def test_default_threshold_lists_students_below_75(self):
        names = self._names(self._get())
        self.assertIn('Severe Sam', names)   # 33%
        self.assertNotIn('Mild Mia', names)  # 83%
        self.assertNotIn('Perfect Pat', names)

    def test_higher_threshold_catches_more_students(self):
        names = self._names(self._get(threshold=90))
        self.assertIn('Severe Sam', names)
        self.assertIn('Mild Mia', names)     # 83% now below 90
        self.assertNotIn('Perfect Pat', names)

    def test_band_marks_the_worst_cases(self):
        by_name = {a['student_name']: a for a in self._get(threshold=90).json()['absentees']}
        self.assertEqual(by_name['Severe Sam']['band'], 'severe')  # 33%
        self.assertEqual(by_name['Mild Mia']['band'], 'low')       # 83%

    def test_results_are_sorted_worst_first(self):
        rates = [a['attendance_pct'] for a in self._get(threshold=100).json()['absentees']]
        self.assertEqual(rates, sorted(rates))

    def test_invalid_threshold_is_rejected(self):
        response = self._get(threshold='150')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Scope ────────────────────────────────────────────────────────────────

    def test_students_outside_scope_are_not_listed(self):
        """Foreign Fay is at 0% but sits in a level this coordinator does not own."""
        self.assertNotIn('Foreign Fay', self._names(self._get(threshold=100)))

    # ── Permission ───────────────────────────────────────────────────────────

    def test_denied_without_view_attendance(self):
        RolePermission.objects.update_or_create(
            organization=self.org, role='coordinator',
            permission_codename='view_attendance',
            defaults={'is_allowed': False},
        )
        self.assertEqual(self._get().status_code, status.HTTP_403_FORBIDDEN)

    def test_row_names_the_class_to_act_on(self):
        row = next(a for a in self._get().json()['absentees'] if a['student_name'] == 'Severe Sam')
        self.assertEqual(row['classroom_id'], self.classroom.id)
        self.assertEqual(row['absent'], 4)
