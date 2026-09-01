
"use client"

import { useState, useEffect } from "react"
import {
  getCurrentUserProfile,
  getStudentCampusStats,
  getTeacherCampusStats,
  getClassroomCampusStats,
  getPrincipalRequests,
  getUserCampusId,
} from "@/lib/api"
import { feeService } from "@/services/feeService"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { PrincipalProfilePage } from "@/components/principal/principal-profile-page"
import type { PrincipalProfileData, ProfileStats, PendingActionItem } from "@/components/principal/principal-profile-page"

export default function PrincipalMyProfilePage() {
  const [principal, setPrincipal]       = useState<PrincipalProfileData | null>(null)
  const [stats, setStats]               = useState<ProfileStats>({})
  const [loading, setLoading]           = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    // ── Fetch profile first (fast) ──────────────────────────────────
    async function fetchProfile() {
      try {
        const profile = await getCurrentUserProfile().catch(() => null)
        if (profile) setPrincipal(profile as PrincipalProfileData)
      } finally {
        setLoading(false)
      }
    }

    // ── Fetch stats in parallel (slower) ───────────────────────────
    async function fetchStats() {
      try {
        const campusId = getUserCampusId()
        const now      = new Date()

        const [studentStats, teacherStats, classroomStats, pendingReqs, feeReport] = await Promise.all([
          getStudentCampusStats().catch(() => []),
          getTeacherCampusStats().catch(() => []),
          getClassroomCampusStats().catch(() => []),
          getPrincipalRequests({ status: "pending" }).catch(() => []),
          feeService.getCollectionReport({
            month:     now.getMonth() + 1,
            year:      now.getFullYear(),
            campus_id: campusId ?? undefined,
          }).catch(() => null),
        ])

        // Re-read profile from storage (may already be set)
        const storedProfile = (await getCurrentUserProfile().catch(() => null)) as any
        const campusName    = storedProfile?.campus?.campus_name || storedProfile?.campus_name

        const findCount = (arr: any[]) => {
          if (!campusName) return (arr as any[]).reduce((s: number, r: any) => s + (Number(r?.count) || 0), 0)
          return (arr as any[]).find((r: any) => r.campus === campusName || r.campus_name === campusName)?.count || 0
        }

        const totalStudents = findCount(studentStats  as any[])
        const totalTeachers = findCount(teacherStats  as any[])
        const totalClasses  = findCount(classroomStats as any[])

        // Fee collection %
        let feeCollection = "—"
        if (feeReport?.total_collected && feeReport?.total_expected) {
          const pct = Math.round(
            (parseFloat(feeReport.total_collected) / parseFloat(feeReport.total_expected)) * 100
          )
          if (!isNaN(pct)) feeCollection = `${pct}%`
        }

        // Build pending actions list from real request data
        const reqs: any[] = Array.isArray(pendingReqs)
          ? pendingReqs
          : ((pendingReqs as any)?.results ?? [])

        const resultApprovals     = reqs.filter(r => r.category === "result"      || r.request_type === "result").length
        const leaveRequests       = reqs.filter(r => r.category === "leave"       || r.request_type === "leave").length
        const transferRequests    = reqs.filter(r => r.category === "transfer"    || r.request_type === "transfer").length
        const coordinatorRequests = reqs.filter(r => r.category === "coordinator" || r.forwarded_by_role === "coordinator").length
        const otherCount          = reqs.length - resultApprovals - leaveRequests - transferRequests - coordinatorRequests

        const pendingActions: PendingActionItem[] = [
          { title: "Result Approvals",     count: resultApprovals,     type: "urgent" as const, href: "/admin/principal/result-approval" },
          { title: "Leave Requests",       count: leaveRequests,       type: "normal" as const, href: "/admin/principal/requests"        },
          { title: "Transfer Requests",    count: transferRequests,    type: "normal" as const, href: "/admin/transfers"                 },
          { title: "Coordinator Requests", count: coordinatorRequests, type: "normal" as const, href: "/admin/principal/requests"        },
          ...(otherCount > 0
            ? [{ title: "Other Requests", count: otherCount, type: "normal" as const, href: "/admin/principal/requests" }]
            : []),
        ].filter(a => a.count > 0)

        setStats({
          totalStudents,
          totalTeachers,
          totalClasses,
          attendanceRate:    "94%",       // placeholder until campus-level attendance endpoint is available
          feeCollection,
          pendingApprovals:  reqs.length,
          pendingActions,
          timetableConflict: false,
        })
      } catch (err) {
        console.error("Stats fetch error:", err)
      } finally {
        setStatsLoading(false)
      }
    }

    fetchProfile()
    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f6f8fb]">
        <LoadingSpinner />
      </div>
    )
  }

  if (!principal) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f6f8fb]">
        <div className="bg-white rounded-xl border border-gray-200 p-10 max-w-sm text-center">
          <p className="text-lg font-black text-gray-800 mb-2">Profile not found</p>
          <p className="text-sm text-gray-400 mb-6">Could not load your profile. Please try again.</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-[#185FA5] text-white rounded-lg font-bold text-sm hover:bg-[#1451a0] transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <PrincipalProfilePage
      principal={principal}
      stats={stats}
      loading={statsLoading}
    />
  )
}
