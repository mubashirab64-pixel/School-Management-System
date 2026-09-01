"""
One student's attendance for a month, day by day — for the calendar on their
profile.

The existing student endpoint returns only totals (days_present /
total_working_days). A calendar needs a status for every square, so this returns
one entry per calendar day, labelled the same way the review roll labels them:
present / absent / late / leave / excused, or weekend / holiday / unmarked /
future for days with no mark.

Weekends and holidays come from calendar_utils, so a Sunday square is never
painted as an absence, and the percentage matches the rest of the system.
"""
from calendar import monthrange
from datetime import date

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from attendance.models import StudentAttendance
from attendance.services import calendar_utils
from attendance.services.metrics import attendance_percentage
from attendance.services.review_view import _classroom_in_scope
from attendance.services.scope_resolver import resolve_scope


def _may_view(user, student):
    """Who may see a student's day-by-day attendance.

    Two, and only two, cases:
      - the student themselves (their linked user), and
      - staff whose scope contains the student's classroom.

    Without this the endpoint took only IsAuthenticated, so any logged-in
    user — including any other student — could read a named student's
    attendance by walking the id. The rest of the review module is scoped; this
    should not be the hole in it.
    """
    if getattr(student, 'user_id', None) and student.user_id == user.id:
        return True
    if student.classroom_id is None:
        return False
    scope = resolve_scope(user)
    if scope.is_empty:
        return False
    return _classroom_in_scope(scope, student.classroom_id) is True


def _parse_month(raw):
    """'YYYY-MM' → (year, month). Defaults to the current month."""
    today = date.today()
    if not raw:
        return today.year, today.month
    try:
        year, month = raw.split('-')
        year, month = int(year), int(month)
        if not 1 <= month <= 12:
            raise ValueError
        return year, month
    except (ValueError, AttributeError):
        raise ValueError("'month' must be in YYYY-MM format.")


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_attendance_calendar(request, student_id):
    """
    GET /api/attendance/student/<id>/calendar/?month=YYYY-MM

    A per-day status list for one student, plus the month's totals.
    """
    from students.models import Student

    student = Student.objects.filter(id=student_id).select_related(
        'classroom__grade__level',
    ).first()
    if student is None:
        return Response({'error': 'Student not found.'}, status=status.HTTP_404_NOT_FOUND)

    if not _may_view(request.user, student):
        return Response(
            {'error': "You do not have access to this student's attendance."},
            status=status.HTTP_403_FORBIDDEN,
        )

    try:
        year, month = _parse_month(request.query_params.get('month'))
    except ValueError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    first = date(year, month, 1)
    last = date(year, month, monthrange(year, month)[1])
    today = date.today()

    # This student's marks for the month, in one query.
    marks = dict(
        StudentAttendance.objects.filter(
            student_id=student_id,
            attendance__date__gte=first,
            attendance__date__lte=last,
            attendance__is_deleted=False,
            is_deleted=False,
        ).values_list('attendance__date', 'status')
    )

    # Holidays scoped to the student's own level/grade — not org-wide, so another
    # level's break does not grey out this student's calendar.
    level_id = student.classroom.grade.level_id if student.classroom else None
    grade_id = student.classroom.grade_id if student.classroom else None
    org_id = getattr(student, 'organization_id', None)
    holidays = calendar_utils.holidays_in_range(
        organization_id=org_id,
        from_date=first,
        to_date=last,
        level_ids=[level_id] if level_id else None,
        grade_ids=[grade_id] if grade_id else None,
    )

    tally = {'present': 0, 'absent': 0, 'late': 0, 'leave': 0, 'excused': 0}
    days = []
    for day in calendar_utils.date_range(first, last):
        kind = calendar_utils.classify_day(day, holidays)  # working|weekend|holiday
        if kind != 'working':
            cell = kind
        elif day in marks:
            cell = marks[day]
            if cell in tally:
                tally[cell] += 1
        elif day > today:
            cell = 'future'
        else:
            cell = 'unmarked'

        days.append({
            'date': str(day),
            'day': day.day,
            'weekday': day.strftime('%a'),
            'status': cell,
        })

    marked = sum(tally.values())
    return Response({
        'student_id': student_id,
        'month': f'{year}-{month:02d}',
        'days': days,
        'summary': {
            **tally,
            'marked_days': marked,
            'attendance_pct': attendance_percentage(
                present=tally['present'],
                total=marked,
                leave=tally['leave'],
                excused=tally['excused'],
            ),
        },
    })
