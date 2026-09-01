"""
Chronic absentees — students whose attendance sits below a threshold.

Scoped through resolve_scope() like the rest of the review module, so a
coordinator sees their levels and a principal their campus. The whole list is
built in one grouped query rather than per student, because "every student in
scope" is exactly the shape that turns into thousands of queries if you let it.

The design mock also shows a Risk Level and a "Parent Alert Sent" column. Those
are omitted, not faked: there is no risk field and no parent-alert record in the
data model. A rate band (below 60 vs below 75) is included instead, because that
is computable from the number in front of us.
"""
from django.db.models import Case, Count, IntegerField, Q, Value, When
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from attendance.models import StudentAttendance
from attendance.permissions import HasAttendanceViewPermission
from attendance.services.metrics import attendance_percentage
from attendance.services.review_view import (
    _error, _parse_date_range, _scoped_classroom_qs, ReviewParamError,
)
from attendance.services.scope_resolver import resolve_scope

DEFAULT_THRESHOLD = 75
SEVERE_THRESHOLD = 60


def _parse_threshold(request):
    raw = request.query_params.get('threshold')
    if raw in (None, ''):
        return DEFAULT_THRESHOLD
    try:
        value = int(raw)
    except (TypeError, ValueError):
        raise ReviewParamError('INVALID_PARAM', "'threshold' must be an integer.")
    if not 1 <= value <= 100:
        raise ReviewParamError('INVALID_PARAM', "'threshold' must be between 1 and 100.")
    return value


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasAttendanceViewPermission])
def chronic_absentees(request):
    """
    Students below the attendance threshold, across the caller's scope.

    GET /api/attendance/review/chronic-absentees/?from=&to=&threshold=75

    Roll access is required: this names individual students, so a role with
    show_roll=False (were one ever pointed here) is refused.
    """
    scope = resolve_scope(request.user)
    if scope.is_empty:
        return _error(
            'SCOPE_EMPTY',
            'No students are within your access scope.',
            status.HTTP_403_FORBIDDEN,
        )
    if not scope.show_roll:
        return _error(
            'ROLL_ACCESS_DENIED',
            'Your role cannot view individual student attendance.',
            status.HTTP_403_FORBIDDEN,
        )

    try:
        from_date, to_date = _parse_date_range(request)
        threshold = _parse_threshold(request)
    except ReviewParamError as exc:
        return _error(exc.code, exc.message, status.HTTP_400_BAD_REQUEST)

    classrooms = _scoped_classroom_qs(scope)

    # One grouped query for every student in scope: their status tallies over the
    # range. Doing this per student is the N+1 this endpoint exists to avoid.
    rows = (
        StudentAttendance.objects
        .filter(
            attendance__classroom__in=classrooms,
            attendance__date__gte=from_date,
            attendance__date__lte=to_date,
            attendance__is_deleted=False,
            is_deleted=False,
        )
        .values(
            'student_id',
            'student__name',
            'attendance__classroom_id',
        )
        .annotate(
            marked=Count('id'),
            present=Count('id', filter=Q(status='present')),
            leave=Count('id', filter=Q(status='leave')),
            excused=Count('id', filter=Q(status='excused')),
            absent=Count('id', filter=Q(status='absent')),
        )
    )

    # Classroom labels resolved once, not per row.
    from classes.models import ClassRoom
    labels = {
        c.id: str(c)
        for c in ClassRoom.objects.filter(
            id__in={r['attendance__classroom_id'] for r in rows}
        ).select_related('grade__level')
    }

    absentees = []
    for row in rows:
        rate = attendance_percentage(
            present=row['present'],
            total=row['marked'],
            leave=row['leave'],
            excused=row['excused'],
        )
        # A student with nothing but leave has no rate to judge; skip rather than
        # report them at 0% as though they never showed up.
        if row['marked'] - row['leave'] - row['excused'] <= 0:
            continue
        if rate >= threshold:
            continue
        absentees.append({
            'student_id': row['student_id'],
            'student_name': (
                row['student__name'] if not scope.anonymised
                else f"Student #{row['student_id']}"
            ),
            'classroom_id': row['attendance__classroom_id'],
            'classroom_name': labels.get(row['attendance__classroom_id'], ''),
            'attendance_pct': rate,
            'absent': row['absent'],
            'marked': row['marked'],
            # Band, not a risk model: what the number itself supports.
            'band': 'severe' if rate < SEVERE_THRESHOLD else 'low',
        })

    absentees.sort(key=lambda a: a['attendance_pct'])

    return Response({
        'absentees': absentees,
        'threshold': threshold,
        'severe_threshold': SEVERE_THRESHOLD,
        'count': len(absentees),
        'date_range': {'from': str(from_date), 'to': str(to_date)},
        'meta': scope.to_meta(),
    })
