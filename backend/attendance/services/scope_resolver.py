"""
Unified Attendance Review — Scope Resolver

Resolves the authenticated user's role into a ScopeContext that drives
both the queryset filtering and the frontend meta hints (drill depth,
visibility flags, etc.).
"""
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any


@dataclass
class ScopeContext:
    """Describes *what* data the user is allowed to see and *how* the UI should behave."""

    role: str                               # normalized role key
    organization_id: Optional[int] = None
    campus_ids: List[int] = field(default_factory=list)
    level_ids: List[int] = field(default_factory=list)
    grade_ids: List[int] = field(default_factory=list)
    classroom_ids: List[int] = field(default_factory=list)

    # UI hints — sent to frontend inside `meta`
    can_drill_to: str = "classroom"         # deepest entity the user may expand
    show_roll: bool = True                  # True → show student names; False → aggregate only
    anonymised: bool = False                # True → mask student PII (donor view)
    can_approve: bool = False               # True → show Approve/Reopen buttons
    can_export: bool = True
    start_level: str = "campus"             # first level shown in the tree

    # Name of the attribute this role's access hangs on. Empty string means the
    # role was never granted a scope, so it can see nothing. Each role must
    # declare this — the check cannot be inferred, because a Teacher with no
    # classrooms and an Org Admin with no campuses are both "empty lists" but
    # only one of them is a misconfiguration we can detect generically.
    scope_field: str = ""

    @property
    def is_empty(self) -> bool:
        """True when the user has no resolvable scope → they may see nothing.

        Fails closed: an unrecognised role has no scope_field, so it lands here
        and is denied, rather than falling through to an unfiltered queryset.
        """
        if not self.scope_field:
            return True
        return not getattr(self, self.scope_field, None)

    def to_meta(self, scope_label: str = "") -> Dict[str, Any]:
        return {
            "role": self.role,
            "scope_label": scope_label,
            "start_level": self.start_level,
            "can_drill_to": self.can_drill_to,
            "show_roll": self.show_roll,
            "anonymised": self.anonymised,
            "can_approve": self.can_approve,
            "can_export": self.can_export,
        }


def resolve_scope(user) -> ScopeContext:
    """
    Analyse *user* and return the appropriate ScopeContext.

    Supported roles (from users.models.User.ROLE_CHOICES):
        teacher, coordinator, principal, org_admin,
        accounts_officer, donor, superadmin, admin
    """

    role = getattr(user, 'role', '')
    org_id = getattr(user, 'organization_id', None)

    # ── Teacher ──────────────────────────────────────────────────────────────
    if role == 'teacher':
        from teachers.models import Teacher
        teacher = Teacher.objects.filter(employee_code=user.username).first()
        if not teacher:
            # fallback: email
            teacher = Teacher.objects.filter(email=user.email).first()

        classroom_ids = []
        if teacher:
            classroom_ids = list(
                teacher.classroom_set.values_list('id', flat=True)
            )

        return ScopeContext(
            role='teacher',
            organization_id=org_id,
            classroom_ids=classroom_ids,
            can_drill_to='student',
            show_roll=True,
            can_approve=False,
            can_export=True,
            start_level='classroom',
            scope_field='classroom_ids',
        )

    # ── Coordinator ──────────────────────────────────────────────────────────
    if role == 'coordinator':
        from coordinator.models import Coordinator
        coord = Coordinator.get_for_user(user)

        level_ids = []
        if coord:
            if coord.assigned_levels.exists():
                level_ids = list(coord.assigned_levels.values_list('id', flat=True))
            elif coord.level_id:
                level_ids = [coord.level_id]

        return ScopeContext(
            role='coordinator',
            organization_id=org_id,
            level_ids=level_ids,
            can_drill_to='student',
            show_roll=True,
            can_approve=True,
            can_export=True,
            start_level='grade',
            scope_field='level_ids',
        )

    # ── Principal ────────────────────────────────────────────────────────────
    if role == 'principal':
        from principals.models import Principal
        principal = Principal.get_for_user(user)

        campus_ids = []
        if principal and principal.campus_id:
            campus_ids = [principal.campus_id]

        return ScopeContext(
            role='principal',
            organization_id=org_id,
            campus_ids=campus_ids,
            can_drill_to='student',
            show_roll=True,
            can_approve=False,
            can_export=True,
            start_level='level',
            scope_field='campus_ids',
        )

    # ── Org Admin / Admin / Superadmin ───────────────────────────────────────
    if role in ('org_admin', 'admin', 'superadmin') or getattr(user, 'is_org_admin', False):
        from campus.models import Campus
        if role == 'superadmin' or getattr(user, 'is_superuser', False):
            campus_ids = list(Campus.objects.values_list('id', flat=True))
        else:
            campus_ids = list(
                Campus.objects.filter(organization_id=org_id).values_list('id', flat=True)
            )

        return ScopeContext(
            role='org_admin',
            organization_id=org_id,
            campus_ids=campus_ids,
            can_drill_to='student',
            show_roll=True,
            can_approve=False,
            can_export=True,
            start_level='campus',
            scope_field='campus_ids',
        )

    # ── Accounts Officer ─────────────────────────────────────────────────────
    if role == 'accounts_officer':
        from campus.models import Campus
        campus_ids = list(
            Campus.objects.filter(organization_id=org_id).values_list('id', flat=True)
        )
        return ScopeContext(
            role='accounts_officer',
            organization_id=org_id,
            campus_ids=campus_ids,
            can_drill_to='campus',
            show_roll=False,
            can_approve=False,
            can_export=True,
            start_level='campus',
            scope_field='campus_ids',
        )

    # ── Donor ────────────────────────────────────────────────────────────────
    if role == 'donor':
        return ScopeContext(
            role='donor',
            organization_id=org_id,
            can_drill_to='org',
            show_roll=False,
            anonymised=True,
            can_approve=False,
            can_export=False,
            start_level='org',
            scope_field='organization_id',
        )

    # ── Fallback (unknown role) ──────────────────────────────────────────────
    # No scope_field → is_empty is True → the view denies. A role added to
    # ROLE_CHOICES later lands here and sees nothing until it is given a branch
    # above, which is the safe direction to fail in.
    return ScopeContext(
        role=role,
        organization_id=org_id,
        show_roll=False,
        can_export=False,
        scope_field='',
    )
