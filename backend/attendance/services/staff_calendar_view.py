"""
One staff member's attendance for a month, day by day — for the calendar on
their profile page. Mirrors student_calendar_view.py's shape so the frontend
calendar component can be reused with a different endpoint.

Staff has no level/grade, so holidays are org-wide only (no per-level/grade
targeting like the student calendar does).
"""
from calendar import monthrange
from datetime import date

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from attendance.models import StaffAttendance
from attendance.services import calendar_utils

User = get_user_model()


def _may_view(viewer, target):
    """Who may see a staff member's day-by-day attendance:
    the staff member themselves, or staff whose role manages theirs
    (principal over their campus staff, coordinator over their campus
    teachers, org admin over anyone in the organization)."""
    if viewer.id == target.id:
        return True
    if getattr(viewer, 'organization_id', None) != getattr(target, 'organization_id', None):
        return False
    if viewer.is_org_admin_role():
        return True
    if viewer.is_principal():
        return target.campus_id == viewer.campus_id and target.role != 'org_admin'
    if viewer.is_coordinator():
        return target.campus_id == viewer.campus_id and target.role == 'teacher'
    return False


def _parse_month(raw):
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
def staff_attendance_calendar(request, user_id):
    """
    GET /api/attendance/staff/<user_id>/calendar/?month=YYYY-MM

    A per-day status list for one staff member, plus the month's totals.
    """
    target = User.objects.filter(id=user_id).first()
    if target is None:
        return Response({'error': 'Staff member not found.'}, status=status.HTTP_404_NOT_FOUND)

    if not _may_view(request.user, target):
        return Response(
            {'error': "You do not have access to this staff member's attendance."},
            status=status.HTTP_403_FORBIDDEN,
        )

    try:
        year, month = _parse_month(request.query_params.get('month'))
    except ValueError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    first = date(year, month, 1)
    last = date(year, month, monthrange(year, month)[1])
    today = date.today()

    marks = dict(
        StaffAttendance.objects.filter(
            user_id=user_id, date__gte=first, date__lte=last,
        ).values_list('date', 'status')
    )

    holidays = calendar_utils.holidays_in_range(
        organization_id=getattr(target, 'organization_id', None),
        from_date=first,
        to_date=last,
    )

    tally = {'present': 0, 'absent': 0, 'late': 0, 'leave': 0, 'half_day': 0}
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
    eligible = marked - tally['leave']
    attendance_pct = round(((tally['present'] + tally['late']) / eligible * 100), 2) if eligible > 0 else 0.0

    return Response({
        'user_id': user_id,
        'month': f'{year}-{month:02d}',
        'days': days,
        'summary': {
            **tally,
            'marked_days': marked,
            'attendance_pct': attendance_pct,
        },
    })
