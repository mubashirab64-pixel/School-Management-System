"""
Phase 0 — access control tests for the Unified Attendance Review endpoint.

These cover the three enforcement layers in attendance.services.review_view:
  1. HasAttendanceViewPermission — the `view_attendance` role toggle
  2. scope.is_empty            — roles that resolve to no scope
  3. per-request ID checks     — classroom_id / parent_id against the scope

Every test asserts a *denial*. The point is not that the endpoint works, it is
that it refuses when it should — so each test must be able to fail if someone
removes a check.
"""
from datetime import date

from django.test import Client, TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from campus.models import Campus
from classes.models import ClassRoom, Grade, Level
from teachers.models import Teacher
from users.models import Organization, RolePermission, User


def _authenticated_client(user):
    """A Django test client carrying a real JWT for *user*.

    DRF's own APIClient cannot be imported here: the project ships a Django app
    called `requests` (backend/requests/) which shadows the pip `requests`
    library, and rest_framework.test imports that library at module load. Going
    through a real Bearer token exercises the actual auth path anyway.
    """
    token = RefreshToken.for_user(user).access_token
    client = Client()
    client.defaults['HTTP_AUTHORIZATION'] = f'Bearer {token}'
    return client


class ReviewAccessTestCase(TestCase):
    """Two organizations, so cross-tenant leaks show up as well as in-org ones."""

    @classmethod
    def setUpTestData(cls):
        cls.url = reverse('attendance:attendance_review')

        cls.org = Organization.objects.create(name='IAK', subdomain='iak')
        cls.other_org = Organization.objects.create(name='Other', subdomain='other')

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

        # A second classroom the teacher below does NOT teach.
        cls.other_classroom = ClassRoom.objects.create(
            organization=cls.org, grade=cls.grade, section='B', shift='morning',
        )

        # Campus in a different org — nothing here should ever be reachable.
        cls.foreign_campus = Campus.objects.create(
            organization=cls.other_org, campus_name='Foreign', campus_code='F01',
        )
        cls.foreign_level = Level.objects.create(
            organization=cls.other_org, campus=cls.foreign_campus,
            name='Primary', shift='morning',
        )

    def _grant(self, role, allowed=True, org=None):
        RolePermission.objects.update_or_create(
            organization=org or self.org,
            role=role,
            permission_codename='view_attendance',
            defaults={'is_allowed': allowed},
        )

    def _user(self, role, username, org=None):
        return User.objects.create_user(
            username=username,
            email=f'{username}@iak.test',
            password='pw-test-12345',
            role=role,
            organization=org or self.org,
        )

    def _client_for(self, user):
        return _authenticated_client(user)

    def _teacher_with_classroom(self):
        """A teacher user wired to `self.classroom` the way resolve_scope expects."""
        user = self._user('teacher', 'teacher1')
        teacher = Teacher.objects.create(
            organization=self.org,
            employee_code=user.username,
            email=user.email,
            full_name='Test Teacher',
            dob=date(1990, 1, 1),
            gender='male',
            contact_number='03000000000',
            cnic='11111-1111111-1',
        )
        self.classroom.class_teacher = teacher
        self.classroom.save()
        self._grant('teacher')
        return user

    # ── Layer 1: the view_attendance toggle ──────────────────────────────────

    def test_donor_is_denied__toggle_off(self):
        """Donor ships with view_attendance=False, so the endpoint stays shut."""
        self._grant('donor', allowed=False)
        response = self._client_for(self._user('donor', 'donor1')).get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_accounts_officer_is_denied__no_permission_row(self):
        """No RolePermission row at all must deny, not fall through to allow."""
        response = self._client_for(self._user('accounts_officer', 'acc1')).get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_teacher_denied_when_toggle_revoked(self):
        user = self._teacher_with_classroom()
        self._grant('teacher', allowed=False)
        response = self._client_for(user).get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_toggle_is_scoped_per_organization(self):
        """A grant in one org must not unlock the endpoint for another org."""
        self._grant('teacher', allowed=True, org=self.org)
        outsider = self._user('teacher', 'teacher-other', org=self.other_org)
        response = self._client_for(outsider).get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_anonymous_is_denied(self):
        self.assertEqual(Client().get(self.url).status_code, status.HTTP_401_UNAUTHORIZED)

    # ── Layer 2: empty scope ─────────────────────────────────────────────────

    def test_teacher_without_teacher_record_is_denied(self):
        """Permission granted but nothing assigned → SCOPE_EMPTY, not a blank 200."""
        self._grant('teacher')
        user = self._user('teacher', 'ghost')
        response = self._client_for(user).get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.json()['error']['code'], 'SCOPE_EMPTY')

    def test_unknown_role_is_denied(self):
        """A role with no branch in resolve_scope must fail closed."""
        self._grant('admissions_counselor')
        user = self._user('admissions_counselor', 'reception')
        response = self._client_for(user).get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.json()['error']['code'], 'SCOPE_EMPTY')

    # ── Layer 3: per-request ID checks ───────────────────────────────────────

    def test_teacher_cannot_read_roll_of_another_classroom(self):
        user = self._teacher_with_classroom()
        response = self._client_for(user).get(
            self.url, {'classroom_id': self.other_classroom.id},
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.json()['error']['code'], 'SCOPE_VIOLATION')

    def test_teacher_can_read_own_roll(self):
        """The allow path — proves the denials above are not blanket refusals."""
        user = self._teacher_with_classroom()
        response = self._client_for(user).get(
            self.url, {'classroom_id': self.classroom.id},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['type'], 'student_matrix')

    def test_teacher_cannot_expand_a_campus(self):
        """Teacher scope has no campus_ids, so drill-down params must be refused."""
        user = self._teacher_with_classroom()
        response = self._client_for(user).get(
            self.url, {'expand': 'level', 'parent_id': self.campus.id},
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.json()['error']['code'], 'SCOPE_VIOLATION')

    def test_teacher_cannot_expand_a_foreign_org_campus(self):
        user = self._teacher_with_classroom()
        response = self._client_for(user).get(
            self.url, {'expand': 'level', 'parent_id': self.foreign_campus.id},
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_principal_cannot_expand_a_foreign_org_level(self):
        """Cross-tenant drill-down: the level exists, but not in this principal's campus."""
        from principals.models import Principal

        self._grant('principal')
        user = self._user('principal', 'principal1')
        Principal.objects.create(
            organization=self.org,
            campus=self.campus,
            email=user.email,
            full_name='Test Principal',
            dob=date(1980, 1, 1),
            gender='male',
            contact_number='03111111111',
            cnic='22222-2222222-2',
            permanent_address='Karachi',
            education_level='Masters',
            institution_name='University',
            year_of_passing=2005,
            total_experience_years=10,
            joining_date=date(2020, 1, 1),
        )
        response = self._client_for(user).get(
            self.url, {'expand': 'grade', 'parent_id': self.foreign_level.id},
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.json()['error']['code'], 'SCOPE_VIOLATION')

    def test_missing_classroom_returns_404(self):
        user = self._teacher_with_classroom()
        response = self._client_for(user).get(self.url, {'classroom_id': 999999})
        self.assertIn(
            response.status_code,
            (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND),
        )

    def test_bad_classroom_id_returns_400_not_500(self):
        user = self._teacher_with_classroom()
        response = self._client_for(user).get(self.url, {'classroom_id': 'abc'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.json()['error']['code'], 'INVALID_PARAM')


class RollAccessDefenceInDepthTestCase(TestCase):
    """`show_roll=False` must hold on its own.

    Donor and Accounts Officer are already stopped by the permission toggle, so
    these tests grant the toggle deliberately to isolate the second layer. If
    someone later grants view_attendance to a donor — say, to show an aggregate
    on a dashboard — student names must still not be reachable.
    """

    @classmethod
    def setUpTestData(cls):
        cls.url = reverse('attendance:attendance_review')
        cls.org = Organization.objects.create(name='IAK', subdomain='iak-roll')
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

    def _user_with_toggle(self, role, username):
        RolePermission.objects.update_or_create(
            organization=self.org, role=role,
            permission_codename='view_attendance',
            defaults={'is_allowed': True},
        )
        user = User.objects.create_user(
            username=username, email=f'{username}@iak.test',
            password='pw-test-12345', role=role, organization=self.org,
        )
        return _authenticated_client(user)

    def test_donor_with_permission_still_cannot_read_a_roll(self):
        client = self._user_with_toggle('donor', 'donor-granted')
        response = client.get(self.url, {'classroom_id': self.classroom.id})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.json()['error']['code'], 'ROLL_ACCESS_DENIED')

    def test_accounts_officer_with_permission_still_cannot_read_a_roll(self):
        client = self._user_with_toggle('accounts_officer', 'acc-granted')
        response = client.get(self.url, {'classroom_id': self.classroom.id})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.json()['error']['code'], 'ROLL_ACCESS_DENIED')
