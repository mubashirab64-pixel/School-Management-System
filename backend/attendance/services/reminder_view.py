"""
Remind a teacher to submit attendance for a classroom in the caller's scope.

The dev guide named a `POST /notifications/remind` endpoint that does not exist.
It does not need to: notifications already have a create_notification() helper
that writes the record and pushes it over the WebSocket. This wires the missing
button to that.

Only a class the caller may see can be reminded — the classroom is checked
against resolve_scope() exactly like a drill-down request, so a coordinator
cannot poke a teacher in another level.
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from datetime import date

from attendance.permissions import HasAttendanceViewPermission
from attendance.services import calendar_utils
from attendance.services.review_view import (
    _classroom_in_scope, _error, _missing_days, _parse_date_range, ReviewParamError,
)
from attendance.services.scope_resolver import resolve_scope


def _resolve_teacher_user(classroom):
    """The User to notify for a classroom, or None if there is nobody to reach.

    A Teacher row may have a real user account (the OneToOne link), or only an
    employee_code/email that happens to match one. resolve_scope() leans on the
    same matching, so this mirrors it rather than inventing a third rule.
    """
    teacher = classroom.class_teacher
    if teacher is None:
        return None
    if getattr(teacher, 'user_id', None):
        return teacher.user

    from django.contrib.auth import get_user_model
    User = get_user_model()
    if teacher.employee_code:
        user = User.objects.filter(username=teacher.employee_code).first()
        if user:
            return user
    if teacher.email:
        return User.objects.filter(email=teacher.email).first()
    return None


@api_view(['POST'])
@permission_classes([IsAuthenticated, HasAttendanceViewPermission])
def remind_teacher(request):
    """
    Notify a classroom's teacher that attendance is outstanding.

    POST /api/attendance/review/remind/
        { "classroom_id": <int>, "dates": ["YYYY-MM-DD", ...] (optional) }
    """
    scope = resolve_scope(request.user)
    if scope.is_empty:
        return _error(
            'SCOPE_EMPTY',
            'No classes are within your access scope.',
            status.HTTP_403_FORBIDDEN,
        )

    raw_id = request.data.get('classroom_id')
    try:
        classroom_id = int(raw_id)
    except (TypeError, ValueError):
        return _error('INVALID_PARAM', "'classroom_id' is required.", status.HTTP_400_BAD_REQUEST)

    access = _classroom_in_scope(scope, classroom_id)
    if access is None:
        return _error('CLASSROOM_NOT_FOUND', 'Classroom not found.', status.HTTP_404_NOT_FOUND)
    if not access:
        return _error(
            'SCOPE_VIOLATION',
            'This classroom is outside your access scope.',
            status.HTTP_403_FORBIDDEN,
        )

    from classes.models import ClassRoom
    classroom = ClassRoom.objects.select_related('class_teacher').get(id=classroom_id)
    teacher_user = _resolve_teacher_user(classroom)
    if teacher_user is None:
        # Nothing to send to — a class with no linked teacher account. Report it
        # rather than silently succeeding, so the UI can say why nothing happened.
        return _error(
            'NO_TEACHER_ACCOUNT',
            'This class has no teacher account to notify.',
            status.HTTP_409_CONFLICT,
        )

    dates = request.data.get('dates') or []
    if dates:
        span = f"{dates[0]}" if len(dates) == 1 else f"{len(dates)} days"
        detail = f"Attendance is outstanding for {classroom} ({span})."
    else:
        detail = f"Attendance is outstanding for {classroom}."

    from notifications.services import create_notification
    create_notification(
        recipient=teacher_user,
        actor=request.user,
        verb='attendance_reminder',
        target_text=detail,
        data={
            'classroom_id': classroom_id,
            'dates': list(dates),
            'kind': 'attendance_reminder',
        },
    )

    return Response({
        'sent': True,
        'classroom_id': classroom_id,
        'teacher': teacher_user.get_full_name() or teacher_user.username,
    })


def _send_reminder(actor, classroom, teacher_user, dates):
    """Create one attendance-reminder notification. Shared by both endpoints."""
    if dates:
        span = dates[0] if len(dates) == 1 else f"{len(dates)} days"
        detail = f"Attendance is outstanding for {classroom} ({span})."
    else:
        detail = f"Attendance is outstanding for {classroom}."

    from notifications.services import create_notification
    create_notification(
        recipient=teacher_user,
        actor=actor,
        verb='attendance_reminder',
        target_text=detail,
        data={
            'classroom_id': classroom.id,
            'dates': list(dates),
            'kind': 'attendance_reminder',
        },
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated, HasAttendanceViewPermission])
def remind_all_teachers(request):
    """
    Remind every teacher in scope whose class has an outstanding submission.

    POST /api/attendance/review/remind-all/
        { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" }   (both optional)

    One notification per delinquent class, so a coordinator sends the whole
    batch with one click instead of walking the missing-days list by hand.
    Classes with no linked teacher account are counted separately, not silently
    dropped, so the UI can say "5 sent, 2 have no teacher".
    """
    scope = resolve_scope(request.user)
    if scope.is_empty:
        return _error(
            'SCOPE_EMPTY',
            'No classes are within your access scope.',
            status.HTTP_403_FORBIDDEN,
        )

    try:
        from_date, to_date = _parse_date_range(request)
    except ReviewParamError as exc:
        return _error(exc.code, exc.message, status.HTTP_400_BAD_REQUEST)

    holiday_index = calendar_utils.holiday_index_in_range(
        scope.organization_id, from_date, to_date,
    )
    missing = _missing_days(scope, from_date, to_date, holiday_index)

    from classes.models import ClassRoom
    # Resolve the classrooms once; _missing_days already scoped them.
    classrooms = {
        c.id: c
        for c in ClassRoom.objects.filter(
            id__in=[m['classroom_id'] for m in missing],
        ).select_related('class_teacher')
    }

    sent = []
    no_teacher = []
    for row in missing:
        classroom = classrooms.get(row['classroom_id'])
        if classroom is None:
            continue
        teacher_user = _resolve_teacher_user(classroom)
        if teacher_user is None:
            no_teacher.append(row['classroom_label'])
            continue
        _send_reminder(request.user, classroom, teacher_user, row['dates'])
        sent.append({
            'classroom_id': classroom.id,
            'classroom_label': row['classroom_label'],
            'teacher': teacher_user.get_full_name() or teacher_user.username,
        })

    return Response({
        'sent_count': len(sent),
        'no_teacher_count': len(no_teacher),
        'sent': sent,
        'no_teacher': no_teacher,
    })
