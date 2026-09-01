"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { GraduationCap } from "lucide-react"
import { apiGet } from "@/lib/api"

type Row = { grade: string; total: number; boys: number; girls: number; attendance_pct: number }

// Name-based grade rank so grades sort naturally (Nursery → KG → Grade I, II…)
// regardless of the backend's per-campus Grade.order, which is inconsistent.
const ROMAN: Record<string, number> = {
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12,
}
function gradeRank(name: string): number {
  const n = (name || "").trim().toLowerCase()
  if (!n) return 9999
  // Pre-primary bands (before Grade I).
  if (n.includes("nursery")) return 1
  if (n.includes("prep")) return 5
  if (n.includes("kg") || n.includes("kindergarten")) {
    if (/(ii|2|two)/.test(n)) return 4
    return 3 // KG / KG-I
  }
  // "Grade III" / "Class 3" / "Grade 3".
  const m = n.match(/(?:grade|class)\s*[-.]?\s*([ivx]+|\d+)/)
  if (m) {
    const t = m[1]
    const num = /^\d+$/.test(t) ? parseInt(t, 10) : (ROMAN[t] ?? NaN)
    if (!isNaN(num)) return 10 + num // Grade I = 11 … Grade XII = 22
  }
  return 9999 // unknown (e.g. "Special Class") sorts last
}

// One row per grade in a campus: total students, boys/girls split, and the
// grade's attendance % (with a progress bar). Reads /api/campus/<id>/grade-breakdown/.
export default function CampusGradeBreakdown({ campusId }: { campusId: string | number }) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!campusId) return
    let alive = true
    setLoading(true)
    apiGet(`/api/campus/${campusId}/grade-breakdown/`)
      .then((d: any) => {
        if (alive) {
          const g: Row[] = d?.grades || []
          setRows([...g].sort((a, b) => gradeRank(a.grade) - gradeRank(b.grade)))
        }
      })
      .catch(() => { if (alive) setRows([]) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [campusId])

  const attTone = (p: number) =>
    p >= 90 ? "bg-emerald-500" : p >= 75 ? "bg-[#2F6B8A]" : p >= 60 ? "bg-amber-500" : "bg-rose-500"

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold text-[#274c77] flex items-center gap-2">
          <GraduationCap className="h-5 w-5" /> Grade-wise Breakdown
        </CardTitle>
        <p className="text-xs text-gray-500">Students, gender split &amp; attendance per grade</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-gray-400 py-4">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">No grade data for this campus.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  <th className="text-left py-2 pr-2">Grade</th>
                  <th className="text-right py-2 px-2">Total</th>
                  <th className="text-right py-2 px-2">Boys</th>
                  <th className="text-right py-2 px-2">Girls</th>
                  <th className="text-left py-2 pl-2 w-[38%]">Attendance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.grade} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 pr-2 font-semibold text-gray-800">{r.grade}</td>
                    <td className="py-2 px-2 text-right font-bold text-[#274c77]">{r.total}</td>
                    <td className="py-2 px-2 text-right text-blue-600">{r.boys}</td>
                    <td className="py-2 px-2 text-right text-pink-600">{r.girls}</td>
                    <td className="py-2 pl-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${attTone(r.attendance_pct)}`}
                            style={{ width: `${Math.min(100, r.attendance_pct)}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-gray-700 w-11 text-right">
                          {r.attendance_pct ? `${r.attendance_pct}%` : "—"}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
