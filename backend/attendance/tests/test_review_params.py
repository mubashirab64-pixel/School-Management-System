"""
Phase 1 — date range validation on the review endpoint.

This is a review of what already happened, so a range may never reach into the
future, and it may not be unbounded.
"""
from datetime import date, timedelta

from django.test import Client, TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from campus.models import Campus
from classes.models import ClassRoom, Grade, Level
from teachers.models import Teacher
from users.models import Organization, RolePermission, User


class DateRangeValidationTests(TestCase):

    @classmethod
    def setUpTestData(cls):
        cls.url = reverse('attendance:attendance_review')
        cls.org = Organization.objects.create(name='IAK', subdomain='iak-params')
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
            username='param-teacher', email='param-teacher@iak.test',
            password='pw-test-12345', role='teacher', organization=cls.org,
        )
        teacher = Teacher.objects.create(
            organization=cls.org,
            employee_code=cls.user.username,
            email=cls.user.email,
            full_name='Param Teacher',
            dob=date(1990, 1, 1),
            gender='male',
            contact_number='03000000000',
            cnic='33333-3333333-3',
        )
        cls.classroom.class_teacher = teacher
        cls.classroom.save()

    def setUp(self):
        self.client = Client()
        token = RefreshToken.for_user(self.user).access_token
        self.client.defaults['HTTP_AUTHORIZATION'] = f'Bearer {token}'

    def _get(self, **params):
        return self.client.get(self.url, params)

    # ── Future dates ─────────────────────────────────────────────────────────

    def test_future_to_date_is_rejected(self):
        tomorrow = date.today() + timedelta(days=1)
        response = self._get(**{'from': '2026-07-01', 'to': tomorrow.isoformat()})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.json()['error']['code'], 'INVALID_DATE_RANGE')

    def test_default_range_does_not_reach_into_the_future(self):
        """The old default ran to the last day of the current month.

        That made the plain no-params request ask for dates that have not
        happened yet, which is the same thing the check above rejects.
        """
        response = self._get()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['date_range']['to'], date.today().isoformat())

    # ── Ordering and width ───────────────────────────────────────────────────

    def test_from_after_to_is_rejected(self):
        response = self._get(**{'from': '2026-07-20', 'to': '2026-07-01'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.json()['error']['code'], 'INVALID_DATE_RANGE')

    def test_range_wider_than_366_days_is_rejected(self):
        today = date.today()
        response = self._get(**{
            'from': (today - timedelta(days=400)).isoformat(),
            'to': today.isoformat(),
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.json()['error']['code'], 'RANGE_TOO_WIDE')

    def test_exactly_366_days_is_allowed(self):
        """Boundary: 366 inclusive days is the documented maximum, not 365."""
        today = date.today()
        response = self._get(**{
            'from': (today - timedelta(days=365)).isoformat(),
            'to': today.isoformat(),
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_367_days_is_rejected(self):
        today = date.today()
        response = self._get(**{
            'from': (today - timedelta(days=366)).isoformat(),
            'to': today.isoformat(),
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.json()['error']['code'], 'RANGE_TOO_WIDE')

    def test_single_day_range_is_allowed(self):
        today = date.today().isoformat()
        response = self._get(**{'from': today, 'to': today})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    # ── Malformed input ──────────────────────────────────────────────────────

    def test_garbage_date_returns_400_not_500(self):
        response = self._get(**{'from': 'yesterday', 'to': '2026-07-01'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.json()['error']['code'], 'INVALID_DATE_RANGE')

    def test_wrong_date_format_returns_400(self):
        response = self._get(**{'from': '01-07-2026', 'to': '2026-07-01'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.json()['error']['code'], 'INVALID_DATE_RANGE')

    # ── working_days ─────────────────────────────────────────────────────────

    def test_working_days_excludes_sundays(self):
        """2026-07-06 Mon → 2026-07-12 Sun is 7 days, 6 of them teaching days."""
        response = self._get(**{'from': '2026-07-06', 'to': '2026-07-12'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['date_range']['working_days'], 6)
