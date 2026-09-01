"""
Phase 1 — the attendance percentage formula.

    present / (total − leave − excused)

Pure functions over numbers, so these need no database. They exist to pin the
formula down: it used to be written five different ways across the codebase, and
the whole point of attendance.services.metrics is that changing it now means
editing one place and watching these fail.
"""
from django.test import SimpleTestCase

from attendance.services.metrics import (
    attendance_percentage,
    eligible_count,
    percentage_from_statuses,
)


class AttendancePercentageTests(SimpleTestCase):

    def test_approved_leave_does_not_count_against_the_class(self):
        """The decision this module exists to encode.

        30 students, 2 on leave and 1 excused → only 27 were expected. All 24
        who could attend did not, but the 3 excused ones must not be read as
        absences.
        """
        self.assertEqual(
            attendance_percentage(present=24, total=30, leave=2, excused=1),
            88.89,  # 24 / 27
        )

    def test_old_formula_would_have_reported_lower(self):
        """Guards the change itself: present/total gives 80.0 for the same day.

        If someone reverts to the old denominator, this is the test that says so.
        """
        old_formula = round(24 / 30 * 100, 2)
        self.assertEqual(old_formula, 80.0)
        self.assertNotEqual(
            attendance_percentage(present=24, total=30, leave=2, excused=1),
            old_formula,
        )

    def test_full_attendance_of_those_expected_is_100(self):
        self.assertEqual(
            attendance_percentage(present=27, total=30, leave=2, excused=1),
            100.0,
        )

    def test_everyone_on_leave_reports_zero_not_a_crash(self):
        """Nobody was expected, so there is no rate. 0.0 is the documented answer."""
        self.assertEqual(
            attendance_percentage(present=0, total=5, leave=5, excused=0), 0.0,
        )

    def test_empty_classroom_reports_zero(self):
        self.assertEqual(attendance_percentage(present=0, total=0), 0.0)

    def test_counter_drift_cannot_produce_a_negative_rate(self):
        """Denormalised counters can disagree; a negative denominator must not
        flip the percentage rather than clamp."""
        self.assertEqual(eligible_count(total=5, leave=10), 0)
        self.assertEqual(
            attendance_percentage(present=2, total=5, leave=10), 0.0,
        )

    def test_late_is_not_counted_as_present(self):
        """Late students attended but are not 'present' under the chosen rule.

        This is the boundary the team picked — if it ever changes, it changes
        here and nowhere else.
        """
        self.assertEqual(
            attendance_percentage(present=8, total=10, leave=0, excused=0), 80.0,
        )


class PercentageFromStatusesTests(SimpleTestCase):

    def test_matches_the_numeric_form(self):
        counts = {'present': 24, 'absent': 3, 'late': 0, 'leave': 2, 'excused': 1}
        self.assertEqual(
            percentage_from_statuses(counts),
            attendance_percentage(present=24, total=30, leave=2, excused=1),
        )

    def test_no_records_reports_zero(self):
        self.assertEqual(percentage_from_statuses({}), 0.0)

    def test_missing_keys_are_treated_as_zero(self):
        self.assertEqual(
            percentage_from_statuses({'present': 5, 'absent': 5}), 50.0,
        )
