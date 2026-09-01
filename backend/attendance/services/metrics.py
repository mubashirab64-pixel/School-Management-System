"""
Attendance metrics — the one place the attendance percentage is defined.

Before this module the formula lived in five places (the Attendance model
property, two inline copies in views.py, and the review aggregates), and they
did not agree. A percentage that means different things on different pages is
worse than one that is merely wrong, because nobody can tell which page to
trust.

These are pure functions over plain numbers: no model imports, no queries. That
keeps them importable from models.py without a circular import, and testable
without a database.
"""

# Statuses that mean "this student was excused from attending". They are removed
# from the denominator rather than counted as an absence — an approved leave
# should not lower a student's rate.
EXCUSED_STATUSES = ('leave', 'excused')

# Statuses that count as having attended.
PRESENT_STATUSES = ('present',)


def eligible_count(total, leave=0, excused=0):
    """How many students were actually expected to attend.

    Never negative: counter drift (a leave_count larger than total_students)
    would otherwise flip the percentage sign rather than surface as zero.
    """
    return max(total - leave - excused, 0)


def attendance_percentage(present, total, leave=0, excused=0):
    """Percentage of the expected students who attended, to 2 decimal places.

        present / (total − leave − excused)

    Returns 0.0 when nobody was expected — an empty classroom, or a day where
    every student was on approved leave. That is not the same as 0% attendance,
    but the API has no third state to report, so callers that care about the
    difference should check `eligible_count` themselves.
    """
    eligible = eligible_count(total, leave, excused)
    if eligible <= 0:
        return 0.0
    return round((present / eligible) * 100, 2)


def percentage_from_statuses(status_counts):
    """attendance_percentage() over a {status: count} mapping.

    Convenience for the per-student roll, which counts statuses rather than
    carrying the Attendance row's denormalised counters.
    """
    total = sum(status_counts.values())
    return attendance_percentage(
        present=sum(status_counts.get(s, 0) for s in PRESENT_STATUSES),
        total=total,
        leave=status_counts.get('leave', 0),
        excused=status_counts.get('excused', 0),
    )
