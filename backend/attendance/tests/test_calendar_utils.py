"""
Phase 1 — working days, weekends, and holiday scoping.

Missing-submission detection (Phase 2) is built straight on top of this, so a
wrong answer here turns into a false "you forgot to submit" alert aimed at a
teacher who was on holiday. These tests pin the calendar down first.
"""
from datetime import date

from django.test import SimpleTestCase, TestCase

from attendance.models import Holiday
from attendance.services import calendar_utils
from attendance.tests.helpers import TenantContext
from campus.models import Campus
from classes.models import Grade, Level
from users.models import Organization, User


# 2026-07-06 is a Monday, 2026-07-12 a Sunday — one full week.
MONDAY = date(2026, 7, 6)
SUNDAY = date(2026, 7, 12)


class WeekendTests(SimpleTestCase):

    def test_sunday_is_a_weekend(self):
        self.assertTrue(calendar_utils.is_weekend(SUNDAY))

    def test_saturday_is_a_working_day(self):
        """Documents the current limitation, not an endorsement of it.

        Campuses running Saturday–Thursday are unsupported until a real weekend
        configuration exists. When that lands, this test should change — which
        is exactly the signal we want it to give.
        """
        self.assertFalse(calendar_utils.is_weekend(date(2026, 7, 11)))

    def test_finds_every_sunday_in_a_range(self):
        weekends = calendar_utils.weekends_in_range(MONDAY, date(2026, 7, 26))
        self.assertEqual(
            sorted(weekends),
            [date(2026, 7, 12), date(2026, 7, 19), date(2026, 7, 26)],
        )

    def test_date_range_is_inclusive_at_both_ends(self):
        days = list(calendar_utils.date_range(MONDAY, SUNDAY))
        self.assertEqual(len(days), 7)
        self.assertEqual(days[0], MONDAY)
        self.assertEqual(days[-1], SUNDAY)


class WorkingDaysTests(SimpleTestCase):

    def test_week_without_holidays_has_six_working_days(self):
        days = calendar_utils.working_days_in_range(MONDAY, SUNDAY)
        self.assertEqual(len(days), 6)
        self.assertNotIn(SUNDAY, days)

    def test_holiday_is_removed_from_working_days(self):
        days = calendar_utils.working_days_in_range(
            MONDAY, SUNDAY, holidays={date(2026, 7, 8)},
        )
        self.assertEqual(len(days), 5)
        self.assertNotIn(date(2026, 7, 8), days)

    def test_holiday_falling_on_a_sunday_is_not_double_counted(self):
        days = calendar_utils.working_days_in_range(
            MONDAY, SUNDAY, holidays={SUNDAY},
        )
        self.assertEqual(len(days), 6)

    def test_classify_day_prefers_weekend_over_holiday(self):
        self.assertEqual(calendar_utils.classify_day(SUNDAY, {SUNDAY}), 'weekend')
        self.assertEqual(calendar_utils.classify_day(MONDAY, {MONDAY}), 'holiday')
        self.assertEqual(calendar_utils.classify_day(MONDAY, set()), 'working')


class HolidayScopingTests(TestCase):
    """A holiday declared for one level must not silently apply to another."""

    @classmethod
    def setUpTestData(cls):
        cls.org = Organization.objects.create(name='IAK', subdomain='iak-cal')
        cls.other_org = Organization.objects.create(name='Other', subdomain='other-cal')
        cls.campus = Campus.objects.create(
            organization=cls.org, campus_name='Main', campus_code='C01',
        )
        cls.primary = Level.objects.create(
            organization=cls.org, campus=cls.campus, name='Primary', shift='morning',
        )
        cls.secondary = Level.objects.create(
            organization=cls.org, campus=cls.campus, name='Secondary', shift='morning',
        )
        cls.grade_5 = Grade.objects.create(
            organization=cls.org, level=cls.primary, campus=cls.campus, name='Class 5',
        )
        cls.grade_6 = Grade.objects.create(
            organization=cls.org, level=cls.primary, campus=cls.campus, name='Class 6',
        )
        cls.user = User.objects.create_user(
            username='cal-user', email='cal-user@iak.test',
            password='pw-test-12345', role='coordinator', organization=cls.org,
        )

    def _holiday(self, day, reason, levels=(), grades=(), org=None):
        holiday = Holiday.objects.create(
            organization=org or self.org, date=day, reason=reason,
        )
        if levels:
            holiday.levels.set(levels)
        if grades:
            holiday.grades.set(grades)
        return holiday

    def _lookup(self, level_ids=None, grade_ids=None, org=None):
        with TenantContext(self.user):
            return calendar_utils.holidays_in_range(
                organization_id=(org or self.org).id,
                from_date=MONDAY,
                to_date=SUNDAY,
                level_ids=level_ids,
                grade_ids=grade_ids,
            )

    def test_untargeted_holiday_applies_org_wide(self):
        self._holiday(date(2026, 7, 8), 'Independence Day')
        self.assertIn(date(2026, 7, 8), self._lookup(level_ids=[self.primary.id]))

    def test_level_holiday_does_not_leak_to_another_level(self):
        """The bug this fixes: every holiday used to apply to every student."""
        self._holiday(date(2026, 7, 8), 'Primary exam break', levels=[self.primary])
        self.assertIn(date(2026, 7, 8), self._lookup(level_ids=[self.primary.id]))
        self.assertNotIn(date(2026, 7, 8), self._lookup(level_ids=[self.secondary.id]))

    def test_grade_holiday_does_not_leak_to_another_grade(self):
        self._holiday(date(2026, 7, 8), 'Class 5 trip', grades=[self.grade_5])
        found = self._lookup(level_ids=[self.primary.id], grade_ids=[self.grade_5.id])
        self.assertIn(date(2026, 7, 8), found)

        not_found = self._lookup(level_ids=[self.primary.id], grade_ids=[self.grade_6.id])
        self.assertNotIn(date(2026, 7, 8), not_found)

    def test_grade_targeting_wins_over_level_targeting(self):
        """A holiday naming a grade applies to that grade, not its whole level."""
        self._holiday(
            date(2026, 7, 8), 'Class 5 only',
            levels=[self.primary], grades=[self.grade_5],
        )
        self.assertNotIn(
            date(2026, 7, 8),
            self._lookup(level_ids=[self.primary.id], grade_ids=[self.grade_6.id]),
        )

    def test_legacy_level_fk_is_honoured(self):
        """Older rows set the single `level` FK instead of the `levels` M2M."""
        Holiday.objects.create(
            organization=self.org, date=date(2026, 7, 8),
            reason='Legacy row', level=self.primary,
        )
        self.assertIn(date(2026, 7, 8), self._lookup(level_ids=[self.primary.id]))
        self.assertNotIn(date(2026, 7, 8), self._lookup(level_ids=[self.secondary.id]))

    def test_holidays_do_not_cross_organizations(self):
        self._holiday(date(2026, 7, 8), 'Other org holiday', org=self.other_org)
        self.assertNotIn(date(2026, 7, 8), self._lookup(level_ids=[self.primary.id]))

    def test_untargeted_caller_gets_only_org_wide_holidays(self):
        self._holiday(date(2026, 7, 7), 'Org wide')
        self._holiday(date(2026, 7, 8), 'Primary only', levels=[self.primary])
        found = self._lookup()
        self.assertIn(date(2026, 7, 7), found)
        self.assertNotIn(date(2026, 7, 8), found)

    def test_holiday_outside_the_range_is_ignored(self):
        self._holiday(date(2026, 8, 20), 'Later')
        self.assertEqual(self._lookup(level_ids=[self.primary.id]), set())
