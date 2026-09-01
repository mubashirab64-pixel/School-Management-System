export type FeatureKey =
    | "staff_management"
    | "academic_structure"
    | "fees_management"
    | "result_management"
    | "student_attendance"
    | "staff_attendance"
    | "timetable"
    | "transfers"
    | "support_desk"
    | "subject_assignment"

export interface FeatureDefinition {
    key: FeatureKey
    label: string
    description: string
    /** Navigation item keys (from navigation.ts) controlled by this feature */
    navItems: string[]
    /** Route prefixes blocked when this feature is disabled */
    routes: string[]
}

export const FEATURES: FeatureDefinition[] = [
    {
        key: "staff_management",
        label: "Staff Management",
        description: "Students, Teachers, Coordinators, Principals — lists, add/edit, promotions, bulk upload, certificates",
        navItems: [
            "student_list",
            "teacher_list",
            "coord_list",
            "add_coord",
            "principals_list",
            "staff_management",
            "promotions",
        ],
        routes: [
            "/admin/students",
            "/admin/teachers/list",
            "/admin/teachers/add",
            "/admin/teachers/profile",
            "/admin/coordinator/list",
            "/admin/coordinator/add",
            "/admin/coordinator/profile",
            "/admin/principals/list",
            "/admin/principals/add",
            "/admin/principals/profile",
            "/admin/staff",
        ],
    },
    {
        key: "academic_structure",
        label: "Academic Structure",
        description: "Campus management — classrooms, levels, grades setup",
        navItems: [
            "campus_list",
            "add_campus",
            "campus_management",
        ],
        routes: [
            "/adminka/campus",
            "/admin/principals/campus-management",
        ],
    },
    {
        key: "fees_management",
        label: "Fees Management",
        description: "Fee structures, types, payments, challans, bank accounts, reports",
        navItems: [
            "fees_management",
            "student_fees",
        ],
        routes: [
            "/admin/fees",
            "/student/pay-fees",
            "/accounts_officer",
        ],
    },
    {
        key: "result_management",
        label: "Result Management",
        description: "Create results (teacher), result approval (coordinator & principal)",
        navItems: [
            "teacher_result",
            "approve_results",
            "enrollment_requests",
            "view_results",
            "class_stats",
            "student_results",
        ],
        routes: [
            "/admin/teachers/result",
            "/admin/teachers/stats",
            "/admin/coordinator/result-approval",
            "/admin/coordinator/enrollment-requests",
            "/admin/principal/result-approval",
            "/student/results",
            "/auditor/results",
        ],
    },
    {
        key: "student_attendance",
        label: "Student Attendance",
        description: "Mark attendance (teacher), attendance review & approval (coordinator)",
        navItems: [
            "mark_attendance",
            "attendance_review",
            "attendance_review_center",
        ],
        routes: [
            "/admin/teachers/attendance",
            "/admin/attendance/review",
            "/admin/coordinator/attendance-review",
            "/auditor/attendance",
        ],
    },
    {
        key: "staff_attendance",
        label: "Staff Attendance",
        description: "Mark and view staff attendance — org admin, principal, coordinator",
        navItems: [
            "staff_attendance",
        ],
        routes: [
            "/admin/teachers/staff-attendance",
        ],
    },
    {
        key: "timetable",
        label: "Timetable",
        description: "Teacher and coordinator timetables, timetable settings, shift timings",
        navItems: [
            "timetable",
            "shift_timings",
        ],
        routes: [
            "/admin/teachers/timetable",
            "/admin/coordinator/time-table",
            "/admin/principal/timetable-settings",
            "/admin/principal/shift-timings",
        ],
    },
    {
        key: "transfers",
        label: "Transfers",
        description: "Create and approve student/staff transfers",
        navItems: [
            "transfers",
        ],
        routes: [
            "/admin/principals/transfers",
        ],
    },
    {
        key: "support_desk",
        label: "Support Desk",
        description: "Requests & complaints — teacher submits, coordinator & principal manage",
        navItems: [
            "requests",
            "teacher_request",
        ],
        routes: [
            "/admin/principal/requests",
            "/admin/coordinator/requests",
            "/admin/coordinator/request-complain",
            "/admin/teachers/request",
        ],
    },
    {
        key: "subject_assignment",
        label: "Subject Assignment",
        description: "Assign subjects to teachers and classes (coordinator)",
        navItems: [
            "subjects",
        ],
        routes: [
            "/admin/coordinator/subject-assign",
        ],
    },
]

export const FEATURE_MAP: Record<FeatureKey, FeatureDefinition> = Object.fromEntries(
    FEATURES.map(f => [f.key, f])
) as Record<FeatureKey, FeatureDefinition>

/**
 * Nav item keys that are ALWAYS visible regardless of feature flags.
 * These are core items (dashboard, settings, profile) not tied to any feature.
 */
export const ALWAYS_ON_NAV_ITEMS = new Set([
    "dashboard",
    "permissions",
    "audit_log",
    "staff_management",   // the Staff Management page (org_admin role switch tool)
    // auditor portal — has its own feature scope
    "auditor_dashboard",
    "auditor_attendance",
    "auditor_results",
    "auditor_fees",
    "auditor_students",
    "auditor_staff",
    "auditor_transfers",
    "auditor_issues",
    "auditor_reports",
    "auditor_logs",
    "auditor_notifications",
    "auditor_profile",
    // accounts officer
    "accounts_officer_profile",
    // student portal
    "student_dashboard",
    "student_profile",
    "student_attendance",
])

/** Default features for a newly created organization */
const DEFAULT_ON: Set<FeatureKey> = new Set([
    "staff_management",
    "academic_structure",
    "result_management",
    "student_attendance",
    "timetable",
    "transfers",
    "subject_assignment",
])

export function getDefaultFeatures(): Record<string, boolean> {
    return Object.fromEntries(
        FEATURES.map(f => [f.key, DEFAULT_ON.has(f.key)])
    )
}

/**
 * Nav item keys allowed given the org's enabled_features object.
 * Missing key = enabled (only explicit `false` disables a feature).
 */
export function getAllowedNavItems(features: Record<string, boolean>): Set<string> {
    const allowed = new Set<string>(ALWAYS_ON_NAV_ITEMS)
    for (const feature of FEATURES) {
        if (features[feature.key] !== false) {
            feature.navItems.forEach(item => allowed.add(item))
        }
    }
    return allowed
}

/**
 * Returns true if a pathname is accessible with the current enabled features.
 * Missing key = enabled (only explicit `false` blocks access).
 */
export function isRouteAllowed(pathname: string, features: Record<string, boolean>): boolean {
    for (const feature of FEATURES) {
        const blocked = feature.routes.some(route => pathname.startsWith(route))
        if (blocked && features[feature.key] === false) return false
    }
    return true
}
