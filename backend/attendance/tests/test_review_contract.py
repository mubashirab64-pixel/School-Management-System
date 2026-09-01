"""
Phase 2 — the API response must match the frozen TypeScript contract.

frontend/src/types/attendance-review.ts is what the whole of Phase 4 will be
built against. If the server quietly renames or drops a key, TypeScript cannot
catch it — the types are hand-written, not generated, so nothing connects them
to reality except these tests.

Each test names the interface it guards. If one fails, either the server changed
and the .ts file needs updating, or the change was accidental. Both are worth
stopping for.
"""
from datetime import date

from django.test import TestCase
from django.urls import reverse

from attendance.models import Attendance
from attendance.tests.helpers import TenantContext, authenticated_client
from campus.models import Campus
from classes.models import ClassRoom, Grade, Level
from students.models import Student
from teachers.models import Teacher
from users.models import Organization, RolePermission, User

MONDAY = date(2026, 7, 6)
SUNDAY = date(2026, 7, 12)


class ContractTests(TestCase):

    @classmethod
    def setUpTestData(cls):
        cls.url = reverse('attendance:attendance_review')
        cls.missing_url = reverse('attendance:attendance_review_missing')

        cls.org = Organization.objects.create(name='IAK', subdomain='iak-contract')
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
            username='contract-teacher', email='contract-teacher@iak.test',
            password='pw-test-12345', role='teacher', organization=cls.org,
        )
        teacher = Teacher.objects.create(
            organization=cls.org, employee_code=cls.user.username,
            email=cls.user.email, full_name='Contract Teacher',
            dob=date(1990, 1, 1), gender='male',
            contact_number='03000000000', cnic='55555-5555555-5',
        )
        cls.classroom.class_teacher = teacher
        cls.classroom.save()

        # is_draft defaults to True, and the roll only shows enrolled students.
        Student.objects.create(
            organization=cls.org, classroom=cls.classroom, name='Ali',
            is_draft=False,
        )
        Attendance.objects.create(
            organization=cls.org, classroom=cls.classroom,
            date=MONDAY, status='submitted',
        )
        # Backdate last: auto_now_add stamps today, and missing-day detection
        # skips days before the class existed, so the test week would be empty.
        with TenantContext(cls.user):
            ClassRoom.objects.filter(pk=cls.classroom.pk).update(
                created_at=date(2026, 1, 1),
            )

    def setUp(self):
        self.client = authenticated_client(self.user)

    def _tree(self):
        return self.client.get(
            self.url, {'from': MONDAY.isoformat(), 'to': SUNDAY.isoformat()},
        ).json()

    # ── ReviewTreeResponse ───────────────────────────────────────────────────

    def test_tree_response_keys(self):
        self.assertEqual(
            set(self._tree()),
            {'type', 'rows', 'meta', 'date_range', 'summary', 'missing_days'},
        )

    # ── ReviewMeta ───────────────────────────────────────────────────────────

    def test_meta_keys(self):
        self.assertEqual(
            set(self._tree()['meta']),
            {
                'role', 'scope_label', 'start_level', 'can_drill_to',
                'show_roll', 'anonymised', 'can_approve', 'can_export',
            },
        )

    def test_can_drill_to_is_a_known_member_of_the_union(self):
        """DrillDepth is a union in TS — an unlisted value breaks exhaustiveness."""
        self.assertIn(
            self._tree()['meta']['can_drill_to'],
            {'org', 'campus', 'level', 'grade', 'classroom', 'student'},
        )

    def test_role_is_a_known_member_of_the_union(self):
        self.assertIn(
            self._tree()['meta']['role'],
            {'teacher', 'coordinator', 'principal', 'org_admin',
             'accounts_officer', 'donor'},
        )

    # ── DateRangeMeta ────────────────────────────────────────────────────────

    def test_date_range_keys(self):
        self.assertEqual(
            set(self._tree()['date_range']), {'from', 'to', 'working_days'},
        )

    # ── ReviewSummary ────────────────────────────────────────────────────────

    def test_summary_keys(self):
        self.assertEqual(
            set(self._tree()['summary']),
            {'total_students', 'avg_rate', 'missing_submissions'},
        )

    # ── ClassroomRow + AttendanceCounts ──────────────────────────────────────

    def test_classroom_row_keys(self):
        row = self._tree()['rows'][0]
        self.assertEqual(
            set(row),
            {
                'id', 'type', 'name', 'code', 'section', 'shift', 'grade_name',
                'class_teacher', 'student_count', 'attendance_pct', 'counts',
                'latest_status', 'latest_date', 'has_children', 'child_type',
            },
        )
        self.assertEqual(row['type'], 'classroom')
        self.assertEqual(row['child_type'], 'student_matrix')

    def test_counts_keys_include_excused(self):
        """excused is new in Phase 1 — the roll can mark it, so rows report it."""
        self.assertEqual(
            set(self._tree()['rows'][0]['counts']),
            {'total_students', 'present', 'absent', 'late', 'leave', 'excused'},
        )

    def test_class_teacher_ref_keys(self):
        teacher = self._tree()['rows'][0]['class_teacher']
        self.assertEqual(set(teacher), {'id', 'name', 'employee_code'})

    def test_latest_status_is_a_known_workflow_state(self):
        self.assertIn(
            self._tree()['rows'][0]['latest_status'],
            {'draft', 'submitted', 'under_review', 'approved', None},
        )

    # ── MissingDay ───────────────────────────────────────────────────────────

    def test_missing_day_keys(self):
        row = self._tree()['missing_days'][0]
        self.assertEqual(
            set(row), {'classroom_id', 'classroom_label', 'class_teacher', 'dates'},
        )
        self.assertEqual(set(row['class_teacher']), {'id', 'name'})

    # ── ReviewMatrixResponse / StudentMatrix ─────────────────────────────────

    def test_matrix_response_keys(self):
        payload = self.client.get(
            self.url,
            {'from': MONDAY.isoformat(), 'to': SUNDAY.isoformat(),
             'classroom_id': self.classroom.id},
        ).json()
        self.assertEqual(set(payload), {'type', 'data', 'meta', 'date_range'})
        self.assertEqual(
            set(payload['data']),
            {'dates', 'students', 'workflow', 'total_students', 'working_days'},
        )

    def test_roll_date_keys_and_day_type(self):
        payload = self.client.get(
            self.url,
            {'from': MONDAY.isoformat(), 'to': SUNDAY.isoformat(),
             'classroom_id': self.classroom.id},
        ).json()
        first = payload['data']['dates'][0]
        self.assertEqual(set(first), {'date', 'day', 'type'})
        for entry in payload['data']['dates']:
            self.assertIn(entry['type'], {'working', 'weekend', 'holiday'})

    def test_student_roll_row_keys(self):
        payload = self.client.get(
            self.url,
            {'from': MONDAY.isoformat(), 'to': SUNDAY.isoformat(),
             'classroom_id': self.classroom.id},
        ).json()
        student = payload['data']['students'][0]
        self.assertEqual(
            set(student),
            {'student_id', 'student_name', 'father_name', 'gr_no',
             'dates', 'stats', 'attendance_pct'},
        )
        self.assertEqual(
            set(student['stats']),
            {'present', 'absent', 'late', 'leave', 'excused'},
        )

    def test_roll_cells_are_known_values(self):
        payload = self.client.get(
            self.url,
            {'from': MONDAY.isoformat(), 'to': SUNDAY.isoformat(),
             'classroom_id': self.classroom.id},
        ).json()
        allowed = {
            'present', 'absent', 'late', 'leave', 'excused',
            'weekend', 'holiday', 'unmarked',
        }
        for cell in payload['data']['students'][0]['dates'].values():
            self.assertIn(cell, allowed)

    # ── ReviewMissingResponse ────────────────────────────────────────────────

    def test_missing_response_keys(self):
        payload = self.client.get(
            self.missing_url,
            {'from': MONDAY.isoformat(), 'to': SUNDAY.isoformat()},
        ).json()
        self.assertEqual(
            set(payload),
            {'type', 'missing_days', 'total_missing', 'meta', 'date_range'},
        )

    # ── ReviewError ──────────────────────────────────────────────────────────

    def test_error_response_uses_the_project_envelope(self):
        """Same shape utils.exceptions.custom_exception_handler produces, so
        lib/api.ts parses `code` instead of folding it into the message."""
        payload = self.client.get(self.url, {'classroom_id': 'abc'}).json()
        self.assertEqual(set(payload), {'success', 'error'})
        self.assertIs(payload['success'], False)
        self.assertEqual(
            set(payload['error']), {'code', 'message', 'details', 'status'},
        )
        self.assertEqual(payload['error']['code'], 'INVALID_PARAM')

    def test_permission_denied_error_shape(self):
        """Pins what the permission layer actually emits — it is raised by DRF,
        not built by _error(), so it goes through the global handler."""
        RolePermission.objects.update_or_create(
            organization=self.org, role='teacher',
            permission_codename='view_attendance',
            defaults={'is_allowed': False},
        )
        payload = self.client.get(self.url).json()
        self.assertEqual(set(payload), {'success', 'error'})
        self.assertEqual(payload['error']['status'], 403)
