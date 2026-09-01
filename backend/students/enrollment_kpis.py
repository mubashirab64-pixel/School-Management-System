"""Enrollment KPI calculations built on the append-only EnrollmentEvent history.

Retention Rate (buildable now — needs only status history, not grade history):
    % of students enrolled at the start of Year Y who are still enrolled
    (anywhere, any grade) at the start of Year Y+1. Graduated students are
    excluded from the denominator (a success, not attrition).

`get_status_as_of(student, date)` walks the history and returns the applicable
status as of a date — the reusable primitive for all enrollment KPIs.
"""
import re
from datetime import date, timedelta

ACTIVE_STATUSES = {'enrolled', 're_enrolled'}

_GRADE_ROMAN = {'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5, 'vi': 6, 'vii': 7,
                'viii': 8, 'ix': 9, 'x': 10, 'xi': 11, 'xii': 12}
# Pre-primary / non-numbered grades, ranked BELOW "Grade N" (numbered grades
# start at 11) so Nursery < KG < Grade I.
_PRE_PRIMARY_RANK = {
    'pre-nursery': 0, 'prenursery': 0, 'pre nursery': 0,
    'nursery': 1,
    'prep': 2, 'preparatory': 2,
    'kg': 3, 'kg-i': 3, 'kg i': 3, 'kg1': 3, 'kgi': 3,
    'kg-ii': 4, 'kg ii': 4, 'kg2': 4, 'kgii': 4,
    'special class': 5,
}


def grade_name_rank(name):
    """A rank derived purely from the grade NAME, so the SAME name ranks the same
    everywhere. Grade progression needs this: the snapshot stores the grade name,
    and the same name (e.g. "Grade III") sits at different structural levels
    across campuses — so Grade.order is inconsistent per name and mis-ranks
    year-over-year comparisons. Returns None for an unrecognised name (skipped).
    """
    if not name:
        return None
    key = ' '.join(str(name).strip().lower().split())
    if key in _PRE_PRIMARY_RANK:
        return _PRE_PRIMARY_RANK[key]
    body = key.replace('grade', '').replace('class', '').strip()
    if body.isdigit():
        return 10 + int(body)          # "Grade 5" / "Class 5"
    if body in _GRADE_ROMAN:
        return 10 + _GRADE_ROMAN[body]  # "Grade V"
    return None

_MONTH_NUMBERS = {
    'january': 1, 'february': 2, 'march': 3, 'april': 4, 'may': 5, 'june': 6,
    'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12,
}


def start_month_num(start_month, default=4):
    """A month name ('May') → its number (5). Falls back to April (4) — the
    historical default — when unset or unrecognised. This is how the campus's
    configured academic-year start feeds the date math below."""
    if start_month is None:
        return default
    return _MONTH_NUMBERS.get(str(start_month).strip().lower(), default)


def academic_start_date(academic_year, start_month=4):
    """'2025-26' with start_month=5 → date(2025, 5, 1). The academic year begins
    in the campus's configured start month (April by default)."""
    try:
        start_year = int(str(academic_year).split('-')[0])
        return date(start_year, start_month, 1)
    except (ValueError, IndexError, TypeError):
        return None


def prev_academic_year(academic_year):
    """'2026-27' → '2025-26'."""
    try:
        start = int(str(academic_year).split('-')[0])
        return f"{start - 1}-{str(start)[-2:]}"
    except (ValueError, IndexError, TypeError):
        return None


def get_status_as_of(student, as_of):
    """Status of a student as of `as_of` (a date), walking enrollment_events.

    Uses student.enrollment_events.all() (Python filtering) so a prefetched
    queryset serves it without a per-student query. Falls back to 'enrolled'
    if the student had joined by then but has no prior event (e.g. backfilled
    history), or None if they hadn't joined yet.
    """
    prior = [e for e in student.enrollment_events.all() if e.event_date <= as_of]
    if prior:
        latest = max(prior, key=lambda e: (e.event_date, e.created_at or as_of))
        return latest.event_type
    joined = student.enrollment_year
    if joined and joined <= as_of.year:
        return 'enrolled'
    return None


def passed_final_last_year(student_ids, prev_year):
    """Ids (from `student_ids`) who PASSED the previous year's Final exam.

    "Passed out last year" = an approved Final-term Result for `prev_year` with
    pass_status='pass'. Result.objects is org-scoped by the request context, and
    we further restrict to the already-scoped student_ids, so this stays within
    the caller's campus/level scope.
    """
    from result.models import Result
    if not student_ids:
        return set()
    return set(
        Result.objects.filter(
            student_id__in=student_ids, academic_year=prev_year,
            exam_type='final', status='approved', pass_status='pass',
        ).values_list('student_id', flat=True)
    )


EXIT_EVENT_TYPES = ('left', 'transferred', 'graduated')


def calculate_retention_rate(students_qs, academic_year, start_month=4):
    """Retention WITHIN `academic_year` — purely enrollment-status based, no exam
    results.

    Cohort   = students enrolled at the start of the year.
    Retained = of that cohort, those who did NOT leave / transfer / graduate
               during the year (still enrolled).
    Also returns the exit breakdown (left / transferred / graduated) so the card
    shows where the rest went. `start_month` is the campus's configured
    academic-year start (April by default), so the window follows the campus.
    `students_qs` should be scoped and prefetch enrollment_events.
    """
    start = academic_start_date(academic_year, start_month)
    end = academic_end_date(academic_year, start_month)
    empty = {
        'academic_year': academic_year, 'cohort_size': 0, 'retained': 0,
        'left': 0, 'transferred': 0, 'graduated': 0,
        'retention_rate': 0, 'has_data': False,
    }
    if not start or not end:
        return empty

    cohort = retained = 0
    exits = {'left': 0, 'transferred': 0, 'graduated': 0}
    cohort_g = {'male': 0, 'female': 0}
    exits_g = {'male': 0, 'female': 0}
    for s in students_qs:
        if get_status_as_of(s, start) not in ACTIVE_STATUSES:
            continue  # wasn't enrolled at the start of the year
        cohort += 1
        g = (getattr(s, 'gender', '') or '').lower()
        if g in cohort_g:
            cohort_g[g] += 1
        exit_type = None
        for e in s.enrollment_events.all():
            if start <= e.event_date <= end and e.event_type in EXIT_EVENT_TYPES:
                exit_type = e.event_type  # last exit event in the window wins
        if exit_type:
            exits[exit_type] += 1
            if g in exits_g:
                exits_g[g] += 1
        else:
            retained += 1

    return {
        'academic_year': academic_year,
        'cohort_size': cohort,
        'retained': retained,
        'left': exits['left'],
        'transferred': exits['transferred'],
        'graduated': exits['graduated'],
        'total_exits': exits['left'] + exits['transferred'] + exits['graduated'],
        # Exits split by gender, with each gender measured against its own cohort.
        'exits_by_gender': {
            'male': {'cohort': cohort_g['male'], 'exits': exits_g['male'],
                     'rate': round(exits_g['male'] / cohort_g['male'] * 100, 1) if cohort_g['male'] else 0},
            'female': {'cohort': cohort_g['female'], 'exits': exits_g['female'],
                       'rate': round(exits_g['female'] / cohort_g['female'] * 100, 1) if cohort_g['female'] else 0},
        },
        'retention_rate': round(retained / cohort * 100, 1) if cohort else 0,
        'has_data': cohort > 0,
    }


def academic_end_date(academic_year, start_month=4):
    """The last day of the academic year — the day before the NEXT year starts in
    the same month. start_month=4 → '2025-26' ends 2026-03-31; start_month=5 →
    ends 2026-04-30. Derived from the start month so start/end always line up."""
    try:
        start_year = int(str(academic_year).split('-')[0])
        return date(start_year + 1, start_month, 1) - timedelta(days=1)
    except (ValueError, IndexError, TypeError):
        return None


def calculate_leavers(students_qs, academic_year, start_month=4):
    """How many students left DURING `academic_year` (its start month → the day
    before the next year), broken down by exit type. Derived from
    EnrollmentEvent — no snapshot needed.
    """
    start = academic_start_date(academic_year, start_month)
    end = academic_end_date(academic_year, start_month)
    if not start or not end:
        return {'left': 0, 'transferred': 0, 'graduated': 0, 'total_exits': 0}

    counts = {'left': 0, 'transferred': 0, 'graduated': 0}
    for s in students_qs:
        for e in s.enrollment_events.all():
            if start <= e.event_date <= end and e.event_type in counts:
                counts[e.event_type] += 1
    counts['total_exits'] = counts['left'] + counts['transferred'] + counts['graduated']
    return counts


def calculate_dropout_rate(students_qs, academic_year, start_month=4):
    """Dropout % split by gender for `academic_year`.

    Dropout %(gender X) = (students, gender X, who LEFT with reason_code='dropout'
    within the year) / (students, gender X, enrolled at the start of the year) × 100.
    Computed against each gender's OWN enrolled population (not the total dropout
    count) — the common mistake that skews the ratio. "Dropout" is only the coded
    subset of Left (transfers/other excluded). `start_month` follows the campus's
    configured academic-year start.
    """
    start = academic_start_date(academic_year, start_month)
    end = academic_end_date(academic_year, start_month)
    buckets = {
        'male':   {'enrolled': 0, 'dropouts': 0},
        'female': {'enrolled': 0, 'dropouts': 0},
    }
    if start and end:
        for s in students_qs:
            g = (getattr(s, 'gender', '') or '').lower()
            if g not in buckets:
                continue
            if get_status_as_of(s, start) in ACTIVE_STATUSES:
                buckets[g]['enrolled'] += 1
            if any(
                e.event_type == 'left' and e.reason_code == 'dropout' and start <= e.event_date <= end
                for e in s.enrollment_events.all()
            ):
                buckets[g]['dropouts'] += 1

    for g, b in buckets.items():
        b['dropout_rate'] = round(b['dropouts'] / b['enrolled'] * 100, 1) if b['enrolled'] else 0
    buckets['total_dropouts'] = buckets['male']['dropouts'] + buckets['female']['dropouts']
    return buckets


def calculate_progression_rate(students_qs, academic_year):
    """Grade progression for `academic_year` vs the previous year.

    Progressed = of students with a frozen grade in BOTH years (from
    EnrollmentSnapshot), those whose grade moved UP. Grade rank comes from the
    grade NAME (grade_name_rank), not Grade.order: the same name sits at
    different structural levels across campuses, so a name→Grade.order lookup
    mis-ranks (e.g. "Grade III" from an L7 campus outranking "Grade IV").

    `has_data` is False until start/end-of-year snapshots exist — this KPI reads
    the snapshot history, so it is empty until `capture_enrollment_snapshot` has
    run for the two years being compared.
    """
    from students.models import EnrollmentSnapshot

    prev = prev_academic_year(academic_year)
    empty = {
        'academic_year': academic_year, 'previous_year': prev,
        'eligible': 0, 'progressed': 0, 'repeated': 0,
        'progression_rate': 0, 'has_data': False,
    }
    if not prev:
        return empty

    student_ids = [s.id for s in students_qs]
    if not student_ids:
        return empty

    # Latest snapshot per (student, year): order by date so the last one wins,
    # i.e. their grade at the end of that year's activity.
    by_student = {}
    for sid, ay, grade in (
        EnrollmentSnapshot.all_objects
        .filter(student_id__in=student_ids, academic_year__in=[prev, academic_year])
        .order_by('snapshot_date')
        .values_list('student_id', 'academic_year', 'grade')
    ):
        by_student.setdefault(sid, {})[ay] = grade

    eligible = progressed = repeated = 0
    for years in by_student.values():
        g_prev, g_curr = years.get(prev), years.get(academic_year)
        o_prev, o_curr = grade_name_rank(g_prev), grade_name_rank(g_curr)
        if o_prev is None or o_curr is None:
            continue
        eligible += 1
        if o_curr > o_prev:
            progressed += 1
        elif o_curr == o_prev:
            repeated += 1

    return {
        'academic_year': academic_year,
        'previous_year': prev,
        'eligible': eligible,
        'progressed': progressed,
        'repeated': repeated,
        'progression_rate': round(progressed / eligible * 100, 1) if eligible else 0,
        'has_data': eligible > 0,
    }
