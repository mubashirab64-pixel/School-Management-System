import {
    Users, Building2, GraduationCap, TrendingUp, Award,
    Calendar, ArrowRightLeft, LayoutDashboard, FileText, Settings,
    UserPlus, Plus, Clock, BookOpen, ClipboardList, CheckSquare, ClipboardCheck,
    BarChart3, CalendarDays, LucideIcon, Banknote,
    Activity,
    Globe,
    ShieldCheck,
    User,
    Receipt,
    AlertTriangle,
    Bell,
    ScrollText,
    Briefcase,
    UserCog,
    Fingerprint,
    Upload,
} from "lucide-react"
import { Permissions, UserRole } from "@/lib/permissions"

export interface NavItem {
    key: string
    title: string
    icon: LucideIcon
    href: string | ((role: UserRole) => string)
    show: (permissions: Permissions, role: UserRole) => boolean
    priority: number
}

export interface SortedNavItem extends Omit<NavItem, 'href'> {
    href: string
}

export const NAVIGATION_ITEMS: NavItem[] = [
    {
        key: "dashboard",
        title: "Dashboard",
        icon: LayoutDashboard,
        href: (role) => role === "coordinator" ? "/admin/coordinator" : "/admin",
        show: (p, role) => {
            if (role === 'superadmin' || role === 'admin' || role === 'org_admin') return true;
            if (role === 'teacher') return p.canViewTeacherDashboard;
            if (role === 'principal') return p.canViewPrincipalDashboard;
            if (role === 'coordinator') return p.canViewCoordinatorDashboard;
            if (role === 'accounts_officer') return p.canViewAccountsDashboard;
            if (role === 'donor') return p.canViewDashboard;
            return role !== "student" && p.canViewDashboard;
        },
        priority: 1
    },
    {
        key: "organizations",
        title: "Organizations",
        icon: Globe,
        href: "/admin/organizations",
        show: (_, role) => role === "superadmin" || role === "admin",
        priority: 2
    },
    {
        key: "subscription_plans",
        title: "Subscription Plans",
        icon: Award,
        href: "/admin/plans",
        show: (_, role) => role === "superadmin" || role === "admin",
        priority: 3
    },
    {
        key: "system_admins",
        title: "System Users",
        icon: ShieldCheck,
        href: "/admin/users",
        show: (_, role) => role === "superadmin" || role === "admin",
        priority: 4
    },
    {
        key: "system_monitoring",
        title: "System Monitoring",
        icon: Activity,
        href: "/admin/monitoring",
        show: (_, role) => role === "superadmin" || role === "admin",
        priority: 5
    },
    {
        key: "permissions",
        title: "Role Permissions",
        icon: Settings,
        href: "/admin/permissions",
        show: (p, role) => role === "org_admin" || (role !== "superadmin" && p.canManagePermissions),
        priority: 10
    },
    {
        key: "staff_management",
        title: "Staff Management",
        icon: UserCog,
        href: "/admin/staff",
        show: (_, role) => role === "org_admin",
        priority: 11
    },
    {
        key: "student_list",
        title: "Students List",
        icon: Users,
        href: (role) => role === "coordinator" ? "/admin/coordinator/student-list" : "/admin/students/student-list",
        show: (p, role) => role !== "superadmin" && p.canViewStudents,
        priority: 20
    },
    {
        key: "promotions",

        title: "Promotions",
        icon: TrendingUp,
        href: "/admin/students/promotion",
        show: (p) => p.canViewPromotions,
        priority: 75
    },
    {
        key: "teacher_result",
        title: "Class Result",
        icon: FileText,
        href: "/admin/teachers/result",
        show: (_, role) => role === "teacher",
        priority: 35
    },
    {
        key: "teacher_list",
        title: "Teachers List",
        icon: GraduationCap,
        href: (role) => role === "coordinator" ? "/admin/coordinator/teacher-list" : "/admin/teachers/list",
        show: (p, role) => role !== "superadmin" && p.canViewTeachers,
        priority: 40
    },
    {
        key: "principals_list",
        title: "Principals",
        icon: Award,
        href: "/admin/principals/list",
        show: (p, role) => role === "superadmin" || p.canViewPrincipals,
        priority: 45
    },
    {
        key: "approve_results",
        title: "Result Approval",
        icon: FileText,
        href: (role) => role === "principal" ? "/admin/principal/result-approval" : "/admin/coordinator/result-approval",
        show: (p, role) => role !== "superadmin" && (p.canApproveResults || role === 'principal' || role === 'coordinator'),
        priority: 50
    },
    {
        key: "enrollment_requests",
        title: "Enrollment Requests",
        icon: CheckSquare,
        href: () => "/admin/coordinator/enrollment-requests",
        show: (p, role) => role === 'coordinator' || role === 'principal',
        priority: 55
    },
    {
        key: "requests",
        title: "Support Desk",
        icon: ClipboardList,
        href: (role) => role === "principal" ? "/admin/principal/requests" : "/admin/coordinator/requests",
        show: (p, role) => role !== "superadmin" && (p.canViewRequests || role === 'org_admin' || role === 'principal' || role === 'coordinator'),
        priority: 60
    },
    {
        key: "teacher_request",
        title: "Request/Complain",
        icon: ClipboardList,
        href: "/admin/teachers/request",
        show: (_, role) => role === "teacher",
        priority: 65
    },
    {
        key: "timetable",
        title: "Time Table",
        icon: CalendarDays,
        href: (role) => role === "teacher" ? "/admin/teachers/timetable" : "/admin/coordinator/time-table",
        show: (p, role) => role !== "superadmin" && p.canViewTimetable,
        priority: 70
    },
    {
        key: "subjects",
        title: "Subject Assignment",
        icon: BookOpen,
        href: (role) => role === "teacher" ? "/admin/coordinator/subject-assign" : "/admin/coordinator/subject-assign", // Kept same for now as no teacher-specific subjects page found, but role based logic added for future
        show: (p, role) => role !== "superadmin" && p.canViewSubjects,
        priority: 80
    },
    {
        key: "view_results",
        title: "Results",
        icon: FileText,
        href: "/admin/teachers/result",
        show: (p, role) => p.canViewResults || role === 'teacher',
        priority: 85
    },
    {
        key: "mark_attendance",
        title: "Mark Attendance",
        icon: CheckSquare,
        href: "/admin/teachers/attendance",
        show: (p, role) => role !== "superadmin" && p.canMarkAttendance,
        priority: 90
    },
    {
        key: "class_stats",
        title: "Class Stats",
        icon: BarChart3,
        href: "/admin/teachers/stats",
        show: (p, role) => p.canMarkAttendance && role === "teacher",
        priority: 105
    },
    {
        key: "staff_attendance",
        title: "Staff Attendance",
        icon: Fingerprint,
        href: "/admin/teachers/staff-attendance",
        show: (p, role) => ["org_admin", "principal", "coordinator"].includes(role),
        priority: 95
    },
    {
        // Read-only history for every staff role. Scope comes from the backend,
        // so there is no per-role route — see app/admin/attendance/review.
        key: "attendance_review_center",
        title: "Attendance Review",
        icon: Calendar,
        href: "/admin/attendance/review",
        // View OR approve: the page is read-only, and anyone who may approve can
        // obviously view. The frontend `canViewAttendance` is not reliably set
        // for coordinators (their view_attendance lives on the backend, which
        // is why the page itself loads), so gating on view alone hid the link.
        // This mirrors the original combined item's condition.
        show: (p, role) => role !== "superadmin" && (p.canViewAttendance || p.canApproveAttendance),
        priority: 99
    },
    {
        // The approve / edit / holidays workspace for a single day. Distinct
        // from the review page above, which never writes.
        key: "attendance_review",
        title: "Attendance Approvals",
        icon: ClipboardCheck,
        href: "/admin/coordinator/attendance-review",
        show: (p, role) => role !== "superadmin" && p.canApproveAttendance,
        priority: 100
    },
    {
        key: "transfers",
        title: "Transfers",
        icon: ArrowRightLeft,
        href: "/admin/principals/transfers",
        show: (p, role) => role !== "superadmin" && (p.canViewTransfers || role === 'teacher' || role === 'coordinator' || role === 'principal'),
        priority: 110
    },
    {
        key: "campus_list",
        title: "Campus List",
        icon: Building2,
        href: "/admin/campus/list",
        show: (p, role) => role !== "superadmin" && p.canViewCampus,
        priority: 120
    },
    {
        key: "add_campus",
        title: "Add Campus",
        icon: Plus,
        href: "/admin/campus/add",
        show: () => false, // Hidden from sidebar, accessed via List page
        priority: 125
    },
    {
        key: "campus_management",
        title: "Campus Management",
        icon: Building2,
        href: "/admin/principals/campus-management",
        show: (_, role) => role === "principal",
        priority: 136
    },
    {
        key: "shift_timings",
        title: "Shift Timings",
        icon: Clock,
        href: "/admin/principal/shift-timings",
        show: (_, role) => role === "principal",
        priority: 137
    },
    {
        key: "coord_list",
        title: "Coordinators",
        icon: Users,
        href: "/admin/coordinator/list",
        show: (p, role) => role !== "superadmin" && p.canViewCoordinators,
        priority: 50
    },
    {
        key: "add_coord",
        title: "Add Coordinator",
        icon: UserPlus,
        href: "/admin/coordinator/add",
        show: () => false, // Hidden from sidebar, accessed via List page
        priority: 55
    },
    {
        key: "fees_management",
        title: "Fees Management",
        icon: Banknote,
        href: "/admin/fees",
        show: (p) => p.canManageFees,
        priority: 160
    },
    // ── Audit Log (org-admin / superadmin / principal) ──────────
    {
        key: "audit_log",
        title: "Audit Log",
        icon: ScrollText,
        href: "/admin/notifications",
        show: (_, role) => role === "superadmin" || role === "admin" || role === "org_admin" || role === "principal",
        priority: 170,
    },
    // ── Auditor Portal Items (compliance_officer) ────────────────
    {
        key: "auditor_dashboard",
        title: "Dashboard",
        icon: LayoutDashboard,
        href: "/auditor/dashboard",
        show: (_, role) => role === "compliance_officer",
        priority: 1
    },
    {
        key: "auditor_attendance",
        title: "Attendance Audit",
        icon: Calendar,
        href: "/auditor/attendance",
        show: (_, role) => role === "compliance_officer",
        priority: 2
    },
    {
        key: "auditor_results",
        title: "Results Audit",
        icon: FileText,
        href: "/auditor/results",
        show: (_, role) => role === "compliance_officer",
        priority: 3
    },
    {
        key: "auditor_fees",
        title: "Fee & Finance",
        icon: Banknote,
        href: "/auditor/fees",
        show: (_, role) => role === "compliance_officer",
        priority: 4
    },
    {
        key: "auditor_students",
        title: "Student Records",
        icon: Users,
        href: "/auditor/students",
        show: (_, role) => role === "compliance_officer",
        priority: 5
    },
    {
        key: "auditor_staff",
        title: "Staff Records",
        icon: Briefcase,
        href: "/auditor/staff",
        show: (_, role) => role === "compliance_officer",
        priority: 6
    },
    {
        key: "auditor_transfers",
        title: "Transfer History",
        icon: ArrowRightLeft,
        href: "/auditor/transfers",
        show: (_, role) => role === "compliance_officer",
        priority: 7
    },
    {
        key: "auditor_issues",
        title: "Issues",
        icon: AlertTriangle,
        href: "/auditor/issues",
        show: (_, role) => role === "compliance_officer",
        priority: 8
    },
    {
        key: "auditor_reports",
        title: "Audit Reports",
        icon: ScrollText,
        href: "/auditor/reports",
        show: (_, role) => role === "compliance_officer",
        priority: 9
    },
    {
        key: "auditor_logs",
        title: "Activity Logs",
        icon: Activity,
        href: "/auditor/logs",
        show: (_, role) => role === "compliance_officer",
        priority: 10
    },
    {
        key: "auditor_notifications",
        title: "Notifications",
        icon: Bell,
        href: "/auditor/notifications",
        show: (_, role) => role === "compliance_officer",
        priority: 11
    },
    {
        key: "auditor_profile",
        title: "My Profile",
        icon: User,
        href: "/auditor/profile",
        show: (_, role) => role === "compliance_officer",
        priority: 12
    },
    // ── Accounts Officer Items ───────────────────────────────────
    {
        key: "accounts_officer_profile",
        title: "My Profile",
        icon: User,
        href: "/accounts_officer/profile",
        show: (_, role) => role === "accounts_officer",
        priority: 10
    },
    // ── Student Portal Items ─────────────────────────────────────
    {
        key: "student_dashboard",
        title: "Dashboard",
        icon: LayoutDashboard,
        href: "/student/dashboard",
        show: (p, role) => role === "student" && p.canViewStudentDashboard,
        priority: 1
    },
    {
        key: "student_results",
        title: "Results",
        icon: FileText,
        href: "/student/results",
        show: (_, role) => role === "student",
        priority: 4
    },
    {
        key: "student_fees",
        title: "Pay Fees",
        icon: Receipt,
        href: "/student/pay-fees",
        show: (_, role) => role === "student",
        priority: 5
    },
]

export function getSortedNavigation(permissions: Permissions, role: UserRole): SortedNavItem[] {
    let items = NAVIGATION_ITEMS
        .filter(item => item.show(permissions, role))
        .map(item => ({
            ...item,
            href: typeof item.href === 'function' ? item.href(role) : item.href
        })) as SortedNavItem[]

    // Strict filter and sort for superadmin role (Software Owner)
    if (role === 'superadmin') {
        const superadminOrder = [
            "dashboard",
            "organizations",
            "system_monitoring",
            "system_admins",
            "subscription_plans",
            "permissions"
        ];
        return items
            .filter(item => superadminOrder.includes(item.key))
            .sort((a, b) => superadminOrder.indexOf(a.key) - superadminOrder.indexOf(b.key));
    }

    if (role === 'admin') {
        const adminOrder = [
            "dashboard",
            "organizations",
            "subscription_plans",
            "system_admins",
            "system_monitoring"
        ];
        return items
            .filter(item => adminOrder.includes(item.key))
            .sort((a, b) => adminOrder.indexOf(a.key) - adminOrder.indexOf(b.key));
    }

    if (role === 'org_admin') {
        const orgAdminOrder = [
            "student_list",
            "teacher_list",
            "coord_list",
            "principals_list",
            "staff_attendance",
            "permissions",
            "fees_management",
            "staff_management",
            "campus_list",
            "requests"
        ];
        return items
            .filter(item => orgAdminOrder.includes(item.key))
            .sort((a, b) => orgAdminOrder.indexOf(a.key) - orgAdminOrder.indexOf(b.key));
    }

    if (role === 'donor') {
        // Read-only supporter: org-scoped dashboard + people lists only.
        const donorOrder = [
            "dashboard",
            "student_list",
            "teacher_list",
            "coord_list",
            "principals_list",
            "campus_list",
        ];
        return items
            .filter(item => donorOrder.includes(item.key))
            .sort((a, b) => donorOrder.indexOf(a.key) - donorOrder.indexOf(b.key));
    }

    if (role === 'coordinator') {
        const coordinatorOrder = [
            "subjects",
            "approve_results",
            "enrollment_requests",
            "student_list",
            "teacher_list",
            "dashboard",
            "attendance_review_center",
            "attendance_review",
            "transfers",
            "timetable",
            "staff_attendance",
            "requests"
        ];
        return items
            .filter(item => coordinatorOrder.includes(item.key))
            .map(item => {
                if (item.key === 'dashboard') return { ...item, title: 'Coordinator Dashboard' };
                if (item.key === 'transfers') return { ...item, title: 'Create Transfer' };
                return item;
            })
            .sort((a, b) => coordinatorOrder.indexOf(a.key) - coordinatorOrder.indexOf(b.key));
    }

    if (role === 'teacher') {
        const teacherOrder = [
            "class_stats",
            "student_list",
            "timetable",
            "mark_attendance",
            "attendance_review_center",
            "view_results",
            "transfers"
        ];
        return items
            .filter(item => teacherOrder.includes(item.key))
            .map(item => {
                if (item.key === 'view_results') return { ...item, title: 'Result View/Create' };
                if (item.key === 'transfers') return { ...item, title: 'Create Transfer' };
                return item;
            })
            .sort((a, b) => teacherOrder.indexOf(a.key) - teacherOrder.indexOf(b.key));
    }

    if (role === 'principal') {
        const principalOrder = [
            "student_list",
            "teacher_list",
            "coord_list",
            "subjects",
            "attendance_review_center",
            "transfers",
            "approve_results",
            "promotions",
            "staff_attendance",
            "campus_list",
            "campus_management",
            "shift_timings",
            "fees_management",
            "requests"
        ];
        return items
            .filter(item => principalOrder.includes(item.key))
            .map(item => {
                if (item.key === 'transfers') return { ...item, title: 'Transfer Approval' };
                if (item.key === 'campus_list') return { ...item, title: 'Campus List / Profile' };
                return item;
            })
            .sort((a, b) => principalOrder.indexOf(a.key) - principalOrder.indexOf(b.key));
    }

    if (role === 'accounts_officer') {
        const accountsOrder = [
            "dashboard",
            "fees_management",
            "student_list",
        ];
        return items
            .filter(item => accountsOrder.includes(item.key))
            .sort((a, b) => accountsOrder.indexOf(a.key) - accountsOrder.indexOf(b.key));
    }

    if (role === 'student') {
        const studentOrder = [
            "student_dashboard",
            "student_profile",
            "student_attendance",
            "student_results",
            "student_fees",
        ];
        return items
            .filter(item => studentOrder.includes(item.key))
            .sort((a, b) => studentOrder.indexOf(a.key) - studentOrder.indexOf(b.key));
    }

    if (role === 'compliance_officer') {
        const auditorOrder = [
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
        ];
        return items
            .filter(item => auditorOrder.includes(item.key))
            .sort((a, b) => auditorOrder.indexOf(a.key) - auditorOrder.indexOf(b.key));
    }

    return items.sort((a, b) => a.priority - b.priority);
}
