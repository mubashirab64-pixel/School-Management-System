# Feature Management System — Implementation Plan

## Current State (kya pehle se hai)

| Item | Status |
|---|---|
| `Organization.enabled_features` — backend JSONField | ✅ Already exists |
| Login response mein `enabled_features` aata hai | ✅ `lib/api.ts` → `sis_organization` localStorage mein save hota hai |
| Organizations page mein feature checkboxes | ⚠️ Hai lekin generic keys hain (students, attendance, academic...) |
| `features.ts` config file | ✅ Created (needs update) |
| Navigation mein feature filtering | ❌ Nahi hai |
| `useOrgFeatures` hook | ❌ Nahi hai |
| Route-level page guards | ❌ Nahi hain |

---

## Target Architecture

```
Organization create/edit
  └─ Checkboxes (FEATURES array se)
        └─ enabled_features: { staff_management: true, fees_management: false, ... }
              └─ Stored in DB (JSONField)
                    └─ Login response mein aata hai
                          └─ localStorage: sis_organization.enabled_features
                                └─ useOrgFeatures() hook
                                      ├─ admin-sidebar → nav items filter
                                      └─ ProtectedRoute / page → route guard
```

---

## Feature Groups — Final List

| # | Key | Label | Pages / Nav Items Included |
|---|---|---|---|
| 1 | `staff_management` | Staff Management | Students list, Teachers list, Coordinators, Principals, Staff mgmt, Promotions, Bulk upload, Certificates |
| 2 | `academic_structure` | Academic Structure | Campus list, Add campus, Campus management, Classroom/Level/Grade management |
| 3 | `fees_management` | Fees Management | Fee structures, types, payments, challans, bank accounts, reports |
| 4 | `result_management` | Result Management | Create result (teacher), Result approval (coordinator + principal), Class stats |
| 5 | `student_attendance` | Student Attendance | Mark attendance (teacher), Attendance review (coordinator) |
| 6 | `staff_attendance` | Staff Attendance | Staff attendance (org_admin, principal, coordinator) |
| 7 | `timetable` | Timetable | Teacher timetable, Coordinator timetable, Timetable settings, Shift timings |
| 8 | `transfers` | Transfers | Create transfer, Transfer approval |
| 9 | `support_desk` | Support Desk | Teacher request/complain, Coordinator requests, Principal requests |
| 10 | `subject_assignment` | Subject Assignment | Subject assign (coordinator) |

---

## Implementation Steps

### STEP 1 — `features.ts` update
**File:** `frontend/src/config/features.ts`
- Change utility functions to use `Record<string, boolean>` format (matches backend JSONField)
- `getAllowedNavItems(features: Record<string, boolean>)` 
- `isRouteAllowed(pathname, features)` 
- `getDefaultFeatures()` → returns `Record<string, boolean>`

**Status:** 🔄 Needs update (format mismatch)

---

### STEP 2 — `useOrgFeatures` hook
**File:** `frontend/src/hooks/useOrgFeatures.ts`
- `localStorage.getItem('sis_organization')` se features padhega
- `isFeatureEnabled(key)` helper
- Returns `{ features, isFeatureEnabled, isLoaded }`

**Status:** ❌ Todo

---

### STEP 3 — Organizations page — feature checkboxes update
**File:** `frontend/src/app/admin/organizations/page.tsx`
- Hardcoded feature list ko `FEATURES` array se replace karo
- Har feature ka label + description + icon show karo
- Default features set karo

**Status:** ❌ Todo

---

### STEP 4 — Navigation filtering
**File:** `frontend/src/config/navigation.ts` + `admin-sidebar.tsx`
- `getSortedNavigation()` mein `enabledFeatures` parameter add karo
- Nav items ko feature ke basis par filter karo
- Sidebar mein `useOrgFeatures()` hook use karo

**Status:** ❌ Todo

---

### STEP 5 — Backend: PATCH endpoint verify + features-only update
**File:** `backend/users/views.py`
- Existing PATCH `/api/organizations/<id>/` mein `enabled_features` already serialized hai
- Verify karo ki PATCH se features update ho rahi hain
- Agar `org_admin` ko apni org ki features update karne ki zaroorat ho toh permission check karo

**Status:** ⚠️ Verify needed (likely already works)

---

### STEP 6 — Route guards (optional, Phase 2)
**File:** `frontend/src/components/ProtectedRoute.tsx` ya middleware
- `isRouteAllowed()` se check karo
- Disabled feature ka page access karo toh 404 / redirect

**Status:** ❌ Phase 2

---

## Data Format

### Backend (JSONField)
```json
{
  "staff_management": true,
  "academic_structure": true,
  "fees_management": false,
  "result_management": true,
  "student_attendance": true,
  "staff_attendance": false,
  "timetable": true,
  "transfers": false,
  "support_desk": true,
  "subject_assignment": true
}
```

### Default (naya org banate waqt)
```json
{
  "staff_management": true,
  "academic_structure": true,
  "fees_management": false,
  "result_management": false,
  "student_attendance": false,
  "staff_attendance": false,
  "timetable": false,
  "transfers": false,
  "support_desk": false,
  "subject_assignment": false
}
```

---

## Important Notes

- `superadmin` / `admin` role ke liye features ka koi asar nahi — wo sab kuch dekhte hain
- `compliance_officer` (auditor) ka apna portal hai — unpe bhi feature guard lagana chahiye (Phase 2)
- `student` portal pe fees_management aur result_management se page visibility control hogi
- Navigation filtering ka asar sirf sidebar pe padega — page guard alag step hai

---

## Implementation Order

```
STEP 1 → STEP 2 → STEP 3 → STEP 4 → STEP 5 (verify)
```
Steps 1-4 pure frontend hain, Step 5 backend verify hai.
