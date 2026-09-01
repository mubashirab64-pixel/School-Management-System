"use client"
import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, Home } from "lucide-react"

const routeLabels: Record<string, string> = {
    admin: "Dashboard",
    coordinator: "Coordinator Dashboard",
    students: "Students",
    "student-list": "Student List",
    add: "Add New",
    promotion: "Promotions",
    teachers: "Teachers",
    list: "List",
    result: "Results",
    "result-approval": "Result Approval",
    request: "Request / Complain",
    attendance: "Mark Attendance",
    stats: "Class Stats",
    campus: "Campus",
    principals: "Principals",
    principal: "Principal",
    "campus-management": "Campus Management",
    "shift-timings": "Shift Timings",
    permissions: "Permissions",
    "attendance-review": "Attendance Review",
    "time-table": "Time Table",
    "subject-assign": "Subjects",
    requests: "Requests",
    transfers: "Transfers",
    notifications: "Notifications",
    profile: "My Profile",
}

function toLabel(segment: string): string {
    return routeLabels[segment] ?? segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export function AdminBreadcrumb() {
    const pathname = usePathname()
    const segments = pathname.split("/").filter(Boolean)

    let crumbs = segments.map((seg, i) => ({
        label: toLabel(seg),
        href: "/" + segments.slice(0, i + 1).join("/"),
    }))

    // The Home icon already links to the dashboard root, so drop the leading
    // "admin"/"coordinator" crumb to avoid a redundant "🏠 › Dashboard" pair.
    if (crumbs.length && (segments[0] === "admin" || segments[0] === "coordinator")) {
        crumbs = crumbs.slice(1)
    }

    // Only collapse into an ellipsis for genuinely deep paths (3+ middle items).
    const shouldCollapse = crumbs.length > 4

    return (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm min-w-0 flex-nowrap overflow-hidden">
            <Link
                href="/admin"
                title="Dashboard"
                className="flex items-center justify-center w-7 h-7 rounded-md text-[#6096ba] hover:text-[#274c77] hover:bg-[#6096ba]/10 transition-colors duration-150 flex-shrink-0"
            >
                <Home className="w-4 h-4" />
            </Link>

            {crumbs.map((crumb, idx) => {
                const isLast = idx === crumbs.length - 1
                const isMiddle = idx > 0 && idx < crumbs.length - 1
                const showEllipsis = shouldCollapse && idx === 1

                // Hide collapsed middle items (the ellipsis stands in for them)
                if (shouldCollapse && isMiddle && !showEllipsis) return null

                return (
                    <React.Fragment key={crumb.href}>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                        {showEllipsis ? (
                            <span className="text-gray-400 font-semibold px-0.5 select-none flex-shrink-0">…</span>
                        ) : isLast ? (
                            <span className="font-semibold text-[#274c77] truncate max-w-[160px] sm:max-w-[280px]">
                                {crumb.label}
                            </span>
                        ) : (
                            <Link
                                href={crumb.href}
                                className="text-[#6096ba] hover:text-[#274c77] transition-colors duration-150 truncate max-w-[110px] sm:max-w-[160px] flex-shrink-0"
                            >
                                {crumb.label}
                            </Link>
                        )}
                    </React.Fragment>
                )
            })}
        </nav>
    )
}
