# Donor Role — Analysis & Implementation Notes

**Date:** 2026-06-23
**Scope:** Make the `create_user` command attach users to a *real* organization, and
turn the **Donor** role into a working, org-scoped, **view-only** supporter account
(dashboard + people lists).

This document is written so any engineer/agent can read it and understand *what was
broken, why, and exactly what changed.*

---

## 1. The two problems reported

1. **`create_user` never showed the organization list.** Running
   `docker exec -it sms_backend python manage.py create_user` printed
   `No organizations found. Creating a default organization first...` and silently
   attached the new donor to a throwaway **"Default Organization"** — even though real
   organizations exist.

2. **Donor login → "Access Restricted".** After logging in, the donor hit
   `/admin` and saw the *Access Restricted* card. The donor had no dashboard and no
   navigation, so the account was effectively useless.

The goal (SaaS model): each organization has its own donor; a donor sees **only that
organization's data**, with **view access only** — an org-admin-style dashboard plus
the **Principal / Student / Teacher / Coordinator** lists.

---

## 2. Root cause

### 2a. Why `create_user` saw "no organizations"

The `Organization` model has **two managers** (`backend/users/models.py`):

```python
class Organization(models.Model):
    objects = OrganizationManager()   # tenant-aware: filters by the logged-in user
    all_objects = models.Manager()    # unfiltered: for commands / signals
```

`OrganizationManager.get_queryset()` (`backend/users/managers.py`) returns
**`queryset.none()` when there is no current user** in context:

```python
user = get_current_user()
if not user:
    return queryset.none()
```

A management command runs **outside any HTTP request**, so `get_current_user()` is
`None`. The old code called `Organization.objects.all()` → got an **empty** queryset →
concluded "no organizations" → created a "Default Organization".

> The organizations were always there. The command was just looking through the
> tenant-filtered manager, which hides everything when there's no logged-in user.

### 2b. Why the donor saw "Access Restricted"

Two layers gated the donor out:

- **Frontend dashboard gate** (`frontend/src/app/admin/page.tsx` and
  `frontend/src/config/navigation.ts`): for `donor` the dashboard required
  `canViewSuperadminDashboard` — a permission donors will never (and should never)
  have (that's the SaaS-owner dashboard).
- **Permissions seed** (`backend/users/management/commands/seed_permissions.py`): the
  `donor` block had **every permission set to `False`**, so even the people lists and
  the normal dashboard were hidden, and the sidebar was empty.

---

## 3. How multi-tenant scoping already works (no change needed)

Data isolation is automatic and was **not** modified — donors inherit it for free:

- `OrganizationMiddleware` (`backend/users/middleware.py`) reads the logged-in user
  (incl. JWT) and stores `user` + `user.organization` in `contextvars`.
- `OrganizationManager` / per-model subclasses (`StudentManager`, `TeacherManager`,
  `PrincipalManager`, `CoordinatorManager`, campus, etc.) automatically
  `filter(organization=<current org>)` for every query.

So once a donor is attached to **Organization X**, every list/stat endpoint returns
only Organization X's rows — no per-view filtering code required.

`Student/Teacher/Principal/Coordinator` models all use these org-scoped managers
(confirmed in their `models.py`).

---

## 4. How role permissions reach the frontend

1. `seed_permissions.py` writes `RolePermission` rows (per org, per role, per codename).
2. On login/profile, `backend/users/views.py` (`get_profile_data`, ~line 437) builds a
   `permissions` dict for the user's role and attaches it to the profile.
3. Frontend `frontend/src/lib/permissions.ts` maps those codenames to `canView*` flags
   used by `navigation.ts`, the dashboard, and the list pages.

> Note: `get_profile_data` filters `RolePermission` by **role only**, not by org, so
> donor toggles must be seeded **consistently** (they are, via `seed_permissions`).

---

## 5. Changes made

### Backend

| File | Change |
|------|--------|
| `users/management/commands/create_user.py` | List orgs via **`Organization.all_objects`** (unfiltered). Removed silent "Default Organization" creation; if truly none exist, abort with guidance to create one first. Org list now also shows the subdomain. |
| `users/management/commands/seed_permissions.py` | Rewrote the `donor` block to **view-only**: `view_dashboard`, `view_students`, `view_teachers`, `view_coordinators`, `view_principals`, `view_campus`, all charts (except zakat) and all KPIs = `True`; every add/edit/approve/manage and `view_superadmin_dashboard` = `False`. |
| `users/permissions.py` | New `IsNotDonorForWrites` permission: allows safe methods, **denies all writes** (POST/PUT/PATCH/DELETE) for `role == 'donor'`. |
| `students/views.py` | `StudentViewSet.permission_classes` += `IsNotDonorForWrites`. |
| `teachers/views.py` | `TeacherViewSet.permission_classes` += `IsNotDonorForWrites`. |
| `principals/views.py` | `PrincipalViewSet.permission_classes` += `IsNotDonorForWrites`. |
| `coordinator/views.py` | `CoordinatorViewSet.permission_classes` += `IsNotDonorForWrites`. |
| `campus/views.py` | `CampusViewSet.permission_classes` += `IsNotDonorForWrites`. |

### Frontend

| File | Change |
|------|--------|
| `src/config/navigation.ts` | Dashboard `show` for donor now uses `canViewDashboard` (was `canViewSuperadminDashboard`). Added a **donor ordering block** in `getSortedNavigation`: `dashboard, student_list, teacher_list, coord_list, principals_list, campus_list`. |
| `src/app/admin/page.tsx` | `isDashboardAllowed` for donor now uses `canViewDashboard`. The donor renders the normal **org-scoped** dashboard (charts/KPIs), NOT `SuperAdminDashboard` (that only renders for `superadmin`/`admin`). |

The list pages (`students/student-list`, `teachers/list`, `coordinator/list`,
`principals/list`) already gate the page by `canView*` and gate add/edit/delete by
`canAdd*/canEdit*/canDelete*`. Donor has only the `canView*` flags, so the lists are
automatically **read-only** with no add/edit/delete buttons — no page changes needed.

---

## 6. Deployment / how to apply

```bash
# 1. Pull the new code into the containers (rebuild as per your normal flow).

# 2. Re-seed permissions so the donor toggles take effect.
#    --reset is required because existing donor rows are all False and
#    get_or_create won't overwrite them otherwise.
#    NOTE: --reset resets ALL roles to defaults — only run if you have not made
#    custom per-role permission edits in the UI you need to keep. (At this early
#    stage that is fine.)
docker exec -it sms_backend python manage.py seed_permissions --reset

# 3. Create a donor and attach it to a REAL organization.
docker exec -it sms_backend python manage.py create_user
#    → choose role 7 (Donor) → now the real org list appears → pick the org.
```

If you must preserve existing UI permission edits and only fix the donor, instead of
`--reset` you can manually flip the donor rows for that org in the Role Permissions UI,
or delete just the donor rows and run `seed_permissions` (without `--reset`) so they get
recreated from the new defaults.

---

## 7. How to verify

1. **Command:** `create_user` → role 7 → the real organizations are listed (not a
   forced default). Pick one; the donor is created with that `organization`.
2. **Login:** donor logs in → lands on `/admin` → sees the **dashboard** (KPIs/charts)
   scoped to its org, plus sidebar items: Dashboard, Students List, Teachers List,
   Coordinators, Principals.
3. **Scoping:** the lists/stats show **only the donor's organization** data (enforced by
   `OrganizationManager`).
4. **Read-only:** no add/edit/delete buttons appear; a direct write API call
   (POST/PUT/PATCH/DELETE) to students/teachers/principals/coordinators returns **403**
   ("Donor accounts have view-only access.").

---

## 8. Known limitations / follow-ups

- **`get_profile_data` resolves `RolePermission` by role only, not by org.** If two orgs
  ever have *different* donor toggles, the dict could collapse to the last-written
  values. Out of scope here, but worth tightening to filter by
  `organization=user.organization`.
- **Org `enabled_features` feature-gate** (`ProtectedRoute` / `config/features.ts`) still
  applies to donors. If a donor's org has features disabled, some routes may be blocked.
  Ensure the donor's org has the relevant features enabled. Only `superadmin`/`admin`
  bypass this gate.
- Donor write-protection currently covers the four people viewsets. If donors are later
  given visibility into other write-capable endpoints, add `IsNotDonorForWrites` there
  too (or centralize it as a global default permission).
