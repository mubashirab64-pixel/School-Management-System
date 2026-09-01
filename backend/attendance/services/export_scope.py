"""
Scope enforcement for attendance exports.

The CSV and Excel exports predate the review module and grew their own access
rules, which were narrower than they looked:

    if user.role == 'principal':
        campus_id = principal.campus_id          # scoped to their campus
    elif user.role not in [..., 'coordinator']:
        return 403                               # everyone else: allowed
    ...
    classrooms = ClassRoom.objects.all()
    if campus_id:
        classrooms = classrooms.filter(...)

A Principal was pinned to their campus, but a Coordinator was not pinned to
anything: passing `?campus=<any id>` exported that campus, and passing nothing
exported every classroom in the organization — including levels they do not
coordinate. An export is the easiest thing in the system to walk out of the
building with, so it should be the *most* scoped surface, not the least.

This routes both exports through the same resolve_scope() the review endpoint
uses, so there is one answer to "what may this user see" rather than two.
"""
from datetime import datetime, timedelta

from django.utils import timezone

from attendance.services.review_view import MAX_RANGE_DAYS, _scoped_classroom_qs
from attendance.services.scope_resolver import resolve_scope


class ExportScopeError(Exception):
    """A refusal the caller can act on — carries the HTTP status and message."""

    def __init__(self, message, status_code=403):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def resolve_export_scope(request):
    """
    Return (classrooms, from_date, to_date, scope) for an export request.

    Raises ExportScopeError when the caller may not export, resolves to no
    scope, or asks for an impossible range.

    `?campus=<id>` narrows *within* the user's scope; it can never widen it.
    """
    scope = resolve_scope(request.user)
    if scope.is_empty:
        raise ExportScopeError('No attendance records are within your access scope.', 403)

    classrooms = _scoped_classroom_qs(scope)

    # A campus filter is a convenience for the caller, not a grant. Applying it
    # on top of the scoped queryset means an out-of-scope id yields nothing
    # rather than someone else's campus.
    campus_id = request.GET.get('campus')
    if campus_id:
        try:
            classrooms = classrooms.filter(grade__level__campus_id=int(campus_id))
        except (TypeError, ValueError):
            raise ExportScopeError("'campus' must be an integer.", 400)

    from_date, to_date = _export_date_range(request)
    return classrooms, from_date, to_date, scope


def _export_date_range(request):
    """Validate the range the same way the review endpoint does.

    Previously an unparseable date silently became "today" and the span was
    unbounded, so `?start_date=2000-01-01` would build a 9,000-row date list in
    memory before writing a single line.
    """
    today = timezone.now().date()
    start_raw = request.GET.get('start_date')
    end_raw = request.GET.get('end_date')

    def parse(raw, field):
        if not raw:
            return today
        try:
            return datetime.strptime(raw, '%Y-%m-%d').date()
        except (TypeError, ValueError):
            raise ExportScopeError(f"'{field}' must be a date in YYYY-MM-DD format.", 400)

    from_date = parse(start_raw, 'start_date')
    to_date = parse(end_raw, 'end_date')

    if from_date > to_date:
        raise ExportScopeError("'start_date' cannot be later than 'end_date'.", 400)
    if to_date > today:
        raise ExportScopeError('Attendance cannot be exported for future dates.', 400)
    if (to_date - from_date).days + 1 > MAX_RANGE_DAYS:
        raise ExportScopeError(f'Date range cannot exceed {MAX_RANGE_DAYS} days.', 400)

    return from_date, to_date


def date_list(from_date, to_date):
    """Every date in the range, inclusive. Bounded by the caller's validation."""
    days = []
    current = from_date
    while current <= to_date:
        days.append(current)
        current += timedelta(days=1)
    return days
