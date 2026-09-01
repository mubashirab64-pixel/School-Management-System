"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, Repeat } from "lucide-react"
import { getEnrollmentKPIs } from "@/lib/api"

// Grade Progression = % of students (present in BOTH years' snapshots) whose
// grade moved UP year-over-year. The endpoint scopes itself by role:
//   Org Admin / Donor → whole org (no campusId)
//   Principal         → their campus (campusId injected server-side)
//   Coordinator       → their assigned levels only (server-side)
// so the same card is correct on every dashboard.
export default function ProgressionKPICard({
  campusId,
  academicYear,
}: {
  campusId?: number | string
  academicYear?: string
}) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    getEnrollmentKPIs({ academic_year: academicYear, campus_id: campusId })
      .then((d: any) => { if (alive) setData(d) })
      .catch(() => { if (alive) setData(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [campusId, academicYear])

  const p = data?.progression
  const rate = p?.progression_rate ?? 0
  const tone = rate >= 85 ? "text-emerald-600" : rate >= 60 ? "text-amber-600" : "text-rose-600"

  return (
    <Card className="border border-gray-100">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold text-[#274c77] flex items-center gap-2">
          <TrendingUp className="h-4 w-4" /> Grade Progression
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-gray-400 py-2">Loading…</p>
        ) : (
          <>
            <p className={`text-3xl font-black ${tone}`}>{rate}%</p>
            <p className="text-xs text-gray-500 mt-1">
              <span className="font-semibold text-gray-700">{p?.progressed ?? 0}</span> of{" "}
              <span className="font-semibold text-gray-700">{p?.eligible ?? 0}</span> students moved up a grade from{" "}
              {p?.previous_year ?? "—"} to {p?.academic_year ?? "—"}
            </p>
            {p && !p.has_data && (
              <p className="text-[11px] text-amber-600 mt-1.5">
                Needs two years of enrolment snapshots — fills in once {p.previous_year} snapshots exist.
              </p>
            )}
            {p?.has_data && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
                <Repeat className="h-4 w-4 text-amber-500" />
                <span className="text-xs text-gray-600">
                  <span className="font-bold text-amber-600">{p.repeated ?? 0}</span> repeated the same grade
                </span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
