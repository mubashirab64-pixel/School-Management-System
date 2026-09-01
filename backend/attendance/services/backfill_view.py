"""
Backfill access — the coordinator's view.

`views.get_backfill_permissions` answers a different question: it filters
`granted_to=request.user`, so it tells a *teacher* what access they hold. A
coordinator calling it gets an empty list, because access is never granted to a
coordinator. This endpoint answers "what access exists across my classes?".

Note there is no request workflow. AttendanceBackfillPermission is a grant —
granted_to / granted_by / deadline / is_used — with no requesting teacher and no
pending state. A teacher cannot ask for access; a coordinator grants it. So this
lists grants, not requests, and there is nothing here to approve or deny.
"""
from django.utils import timezone

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from attendance.models import AttendanceBackfillPermission
from attendance.permissions import HasAttendanceViewPermission
from attendance.services.review_view import _scoped_classroom_qs, _error
from attendance.services.scope_resolver import resolve_scope


def _state(permission, now):
    """Where this grant is in its short life.

    Used wins over expired: a teacher who marked the register before the
    deadline did what the grant was for, and calling that "Expired" afterwards
    reads like they missed it.
    """
    if permission.is_used:
        return 'used'
    if now > permission.deadline:
        return 'expired'
    return 'active'


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasAttendanceViewPermission])
def backfill_permissions_in_scope(request):
    """
    Backfill grants for every classroom in the caller's scope.

    GET /api/attendance/backfill/in-scope/
    """
    scope = resolve_scope(request.user)
    if scope.is_empty:
        return _error(
            'SCOPE_EMPTY',
            'No classes are within your access scope.',
            status.HTTP_403_FORBIDDEN,
        )

    permissions = (
        AttendanceBackfillPermission.objects
        .filter(classroom__in=_scoped_classroom_qs(scope))
        .select_related('classroom', 'granted_to', 'granted_by')
        .order_by('-created_at')
    )

    now = timezone.now()
    rows = [{
        'id': p.id,
        'classroom_id': p.classroom_id,
        'classroom_name': str(p.classroom),
        'date': str(p.date),
        'reason': p.reason,
        'deadline': p.deadline,
        # The teacher the access belongs to — the panel's first column, and
        # absent from the teacher-scoped endpoint entirely.
        'granted_to': p.granted_to.get_full_name() or p.granted_to.username,
        'granted_to_id': p.granted_to_id,
        'granted_by': (p.granted_by.get_full_name() or p.granted_by.username) if p.granted_by else None,
        'granted_at': p.created_at,
        'is_used': p.is_used,
        'used_at': p.used_at,
        'state': _state(p, now),
    } for p in permissions]

    counts = {'active': 0, 'used': 0, 'expired': 0}
    for row in rows:
        counts[row['state']] += 1

    return Response({
        'permissions': rows,
        'counts': counts,
        'meta': scope.to_meta(),
    })
