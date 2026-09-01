"""
Phase 5 — access control on the CSV / Excel exports.

An export is the easiest thing in this system to carry out of the building, so
it is the surface most worth pinning down. These exist because the exports grew
their own rules before the review module did:

    if user.role == 'principal':
        campus_id = principal.campus_id      # pinned to their campus
    elif user.role not in [..., 'coordinator']:
        return 403                           # coordinator: allowed, unpinned
    ...
    classrooms = ClassRoom.objects.all()

A Coordinator could pass ?campus=<any id> and export that campus, or pass
nothing and export every classroom in the organization. Both exports now go
through resolve_scope(), the same one the review endpoint uses.

Every test here asserts a refusal or an omission, so each must be able to fail
if someone removes a check.
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

TODAY = date.today()


class ExportScopeTests(TestCase):
    """Two campuses in one org: the coordinator owns one level on campus A."""

    @classmethod
    def setUpTestData(cls):
        cls.csv_url = reverse('attendance:export_attendance_csv')
        cls.org = Organization.objects.create(name='IAK', subdomain='iak-export')

        cls.campus_a = Campus.objects.create(
            organization=cls.org, campus_name='Campus A', campus_code='CA',
        )
        cls.campus_b = Campus.objects.create(
            organization=cls.org, campus_name='Campus B', campus_code='CB',
        )

        cls.own_level = Level.objects.create(
            organization=cls.org, campus=cls.campus_a, name='Primary', shift='morning',
        )
        cls.other_level = Level.objects.create(
            organization=cls.org, campus=cls.campus_b, name='Secondary', shift='morning',
        )

        cls.own_classroom = cls._classroom(cls.own_level, 'Class 5', 'A')
        cls.foreign_classroom = cls._classroom(cls.other_level, 'Class 9', 'A')

        cls.own_student = cls._student(cls.own_classroom, 'Ali Own')
        cls.foreign_student = cls._student(cls.foreign_classroom, 'Zara Foreign')

        cls._attendance(cls.own_classroom, cls.own_student)
        cls._attendance(cls.foreign_classroom, cls.foreign_student)

        RolePermission.objects.update_or_create(
            organization=cls.org, role='coordinator',
            permission_codename='view_attendance',
            defaults={'is_allowed': True},
        )
        cls.user = User.objects.create_user(
            username='export-coord', email='export-coord@iak.test',
            password='pw-test-12345', role='coordinator', organization=cls.org,
        )
        coordinator = Coordinator.objects.create(
            organization=cls.org,
            email=cls.user.email,
            full_name='Export Coord',
            employee_code=cls.user.username,
            dob=date(1985, 1, 1),
            gender='male',
            contact_number='03001234567',
            cnic='66666-6666666-6',
            permanent_address='Karachi',
            education_level='Masters',
            institution_name='University',
            year_of_passing=2008,
            total_experience_years=8,
            joining_date=date(2020, 1, 1),
        )
        coordinator.assigned_levels.set([cls.own_level])

    @classmethod
    def _classroom(cls, level, grade_name, section):
        grade = Grade.objects.create(
            organization=cls.org, level=level, campus=level.campus, name=grade_name,
        )
        return ClassRoom.objects.create(
            organization=cls.org, grade=grade, section=section, shift='morning',
        )

    @classmethod
    def _student(cls, classroom, name):
        return Student.objects.create(
            organization=cls.org, classroom=classroom, name=name, is_draft=False,
        )

    @classmethod
    def _attendance(cls, classroom, student):
        attendance = Attendance.objects.create(
            organization=cls.org, classroom=classroom, date=TODAY, status='approved',
        )
        StudentAttendance.objects.create(
            organization=cls.org, attendance=attendance, student=student, status='present',
        )
        return attendance

    def setUp(self):
        self.client = authenticated_client(self.user)

    def _export(self, path_name, **params):
        response = self.client.get(
            reverse(f'attendance:{path_name}'),
            {'start_date': TODAY.isoformat(), 'end_date': TODAY.isoformat(), **params},
        )
        body = b''.join(response.streaming_content) if response.streaming else response.content
        return response, body

    def _csv(self, **params):
        response = self.client.get(
            self.csv_url,
            {'start_date': TODAY.isoformat(), 'end_date': TODAY.isoformat(), **params},
        )
        body = b''.join(response.streaming_content) if response.streaming else response.content
        return response, body.decode()

    # ── Scope ────────────────────────────────────────────────────────────────

    def test_export_contains_the_coordinators_own_students(self):
        """The allow path — proves the omissions below are not a blanket empty."""
        response, body = self._csv()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('Ali Own', body)

    def test_export_omits_students_outside_the_coordinators_levels(self):
        """The leak this closes: no campus param used to mean every classroom."""
        _, body = self._csv()
        self.assertNotIn('Zara Foreign', body)

    def test_asking_for_another_campus_exports_nothing(self):
        """A campus filter narrows within scope; it can never widen it."""
        response, body = self._csv(campus=self.campus_b.id)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn('Zara Foreign', body)
        self.assertNotIn('Ali Own', body)

    def test_own_campus_filter_still_works(self):
        _, body = self._csv(campus=self.campus_a.id)
        self.assertIn('Ali Own', body)

    def test_non_numeric_campus_is_rejected(self):
        response, _ = self._csv(campus='abc')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Permission ───────────────────────────────────────────────────────────

    def test_export_denied_when_the_view_attendance_toggle_is_off(self):
        """An export is at least as sensitive as viewing, so it takes the same gate."""
        RolePermission.objects.update_or_create(
            organization=self.org, role='coordinator',
            permission_codename='view_attendance',
            defaults={'is_allowed': False},
        )
        response, _ = self._csv()
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_a_role_with_no_scope_cannot_export(self):
        RolePermission.objects.update_or_create(
            organization=self.org, role='admissions_counselor',
            permission_codename='view_attendance',
            defaults={'is_allowed': True},
        )
        user = User.objects.create_user(
            username='export-reception', email='export-reception@iak.test',
            password='pw-test-12345', role='admissions_counselor', organization=self.org,
        )
        response = authenticated_client(user).get(self.csv_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # ── Date range ───────────────────────────────────────────────────────────

    def test_future_dates_are_rejected(self):
        response, _ = self._csv(end_date=(TODAY + timedelta(days=1)).isoformat())
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_range_wider_than_366_days_is_rejected(self):
        """Previously unbounded: a decade-long range built the whole date list
        in memory before writing a line."""
        response, _ = self._csv(start_date=(TODAY - timedelta(days=400)).isoformat())
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_garbage_date_is_rejected_rather_than_silently_meaning_today(self):
        response, _ = self._csv(start_date='yesterday')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_inverted_range_is_rejected(self):
        response, _ = self._csv(
            start_date=TODAY.isoformat(),
            end_date=(TODAY - timedelta(days=5)).isoformat(),
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class ExportFormatTests(ExportScopeTests):
    """All three formats must actually render, and obey the same scope.

    None of this was reachable before: openpyxl was imported by the Excel view
    but never declared in requirements, so that endpoint had been 500ing for as
    long as it had existed — which is also why its own bugs went unnoticed.
    """

    def test_csv_renders(self):
        response, body = self._export('export_attendance_csv')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('text/csv', response['Content-Type'])

    def test_excel_renders(self):
        response, body = self._export('export_attendance_excel')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # xlsx is a zip; PK is its magic number.
        self.assertTrue(body.startswith(b'PK'), 'not a valid xlsx')

    def test_pdf_renders(self):
        response, body = self._export('export_attendance_pdf')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertTrue(body.startswith(b'%PDF-'), 'not a valid PDF')
        self.assertTrue(body.rstrip().endswith(b'%%EOF'), 'PDF truncated')

    def test_pdf_is_scoped_like_the_others(self):
        response, _ = self._export('export_attendance_pdf', campus='abc')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_pdf_rejects_future_dates(self):
        response, _ = self._export(
            'export_attendance_pdf', end_date=(TODAY + timedelta(days=1)).isoformat(),
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_pdf_denied_without_the_view_attendance_toggle(self):
        RolePermission.objects.update_or_create(
            organization=self.org, role='coordinator',
            permission_codename='view_attendance',
            defaults={'is_allowed': False},
        )
        response, _ = self._export('export_attendance_pdf')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
