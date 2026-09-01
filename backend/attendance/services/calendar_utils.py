"""
School calendar — which days count as working days, and which do not.

Weekends and holidays are answered here so that "working day" means the same
thing to the review aggregates as it does everywhere else. Missing-submission
detection is built directly on top of this: a wrong answer here becomes a false
alarm sent to a teacher who was on holiday.

Weekend policy
--------------
A weekend is Sunday, everywhere, for every level. This is a deliberate,
temporary limitation, not an oversight:

The Weekend model looks like a per-level weekend configuration, but nothing
writes non-Sundays into it — views.py and the seeder both populate it from
`weekday() == 6`. It is a *log* of Sundays, derived from the rule below, not a
source of truth for it. Reading it here instead of computing would also mean
that any date range the seeder never covered reports no weekends at all.

So campuses that run Saturday–Thursday are NOT supported today, and the
Attendance Review dev guide's `campus.shift_config` does not exist in this
codebase. Supporting it needs a real weekend configuration (e.g. a
`weekend_days` field on Level) plus a backfill — a decision, not a refactor.

Centralising the rule here is what makes that change a single edit later.
"""
from datetime import timedelta

SUNDAY = 6


def is_weekend(day):
    """Is *day* a non-teaching weekend day? See the module note on the policy."""
    return day.weekday() == SUNDAY


def date_range(from_date, to_date):
    """Yield every date from *from_date* to *to_date*, both inclusive."""
    day = from_date
    while day <= to_date:
        yield day
        day += timedelta(days=1)


def weekends_in_range(from_date, to_date):
    """Every weekend date in the range."""
    return {day for day in date_range(from_date, to_date) if is_weekend(day)}


class HolidayIndex:
    """Holidays for a date range, bucketed by what they target.

    Built once per request and then asked about each classroom. Missing-day
    detection has to resolve holidays for every classroom in scope, and querying
    per classroom would be one query per row.
    """

    def __init__(self, org_wide=None, by_level=None, by_grade=None):
        self.org_wide = org_wide or set()
        self.by_level = by_level or {}
        self.by_grade = by_grade or {}

    def for_scope(self, level_ids=(), grade_ids=()):
        """Every holiday date applying to the given levels/grades.

        Org-wide holidays always apply. Passing nothing therefore returns only
        those, which is the safe reading: an untargeted caller should not
        inherit some other level's exam break.
        """
        dates = set(self.org_wide)
        for level_id in level_ids or ():
            dates |= self.by_level.get(level_id, set())
        for grade_id in grade_ids or ():
            dates |= self.by_grade.get(grade_id, set())
        return dates

    def for_classroom(self, level_id, grade_id):
        """Holidays applying to one classroom, via its level and grade."""
        return self.for_scope(level_ids=(level_id,), grade_ids=(grade_id,))


def holiday_index_in_range(organization_id, from_date, to_date):
    """Load the range's holidays and bucket them by target.

    A Holiday can be targeted three ways, narrowest first:
      - `grades` set   → only those grades
      - `levels` set   → only those levels (`level` is the legacy single FK)
      - neither set    → the whole organization

    Bucketing happens in Python on purpose. A date range holds a handful of
    holidays, and the equivalent M2M-isnull query is far harder to read than it
    is worth here.
    """
    from attendance.models import Holiday

    holidays = Holiday.objects.filter(date__gte=from_date, date__lte=to_date)
    if organization_id:
        holidays = holidays.filter(organization_id=organization_id)
    holidays = holidays.prefetch_related('levels', 'grades')

    org_wide = set()
    by_level = {}
    by_grade = {}

    for holiday in holidays:
        holiday_grades = {grade.id for grade in holiday.grades.all()}
        if holiday_grades:
            # Naming a grade narrows the holiday to that grade, even when its
            # level is also listed — the level is just how the UI got there.
            for grade_id in holiday_grades:
                by_grade.setdefault(grade_id, set()).add(holiday.date)
            continue

        holiday_levels = {level.id for level in holiday.levels.all()}
        if holiday.level_id:
            holiday_levels.add(holiday.level_id)
        if holiday_levels:
            for level_id in holiday_levels:
                by_level.setdefault(level_id, set()).add(holiday.date)
            continue

        org_wide.add(holiday.date)

    return HolidayIndex(org_wide=org_wide, by_level=by_level, by_grade=by_grade)


def holidays_in_range(organization_id, from_date, to_date, level_ids=None, grade_ids=None):
    """Holiday dates applying to the given levels/grades.

    Thin wrapper over holiday_index_in_range() so the targeting rules live in
    exactly one place. Use the index directly when asking about many classrooms.
    """
    index = holiday_index_in_range(organization_id, from_date, to_date)
    return index.for_scope(level_ids=level_ids or (), grade_ids=grade_ids or ())


def working_days_in_range(from_date, to_date, holidays=()):
    """Every teaching day in the range — not a weekend, not a holiday."""
    holidays = set(holidays)
    return [
        day for day in date_range(from_date, to_date)
        if not is_weekend(day) and day not in holidays
    ]


def classify_day(day, holidays=()):
    """Label a date for the review grid: 'weekend' | 'holiday' | 'working'."""
    if is_weekend(day):
        return 'weekend'
    if day in holidays:
        return 'holiday'
    return 'working'
