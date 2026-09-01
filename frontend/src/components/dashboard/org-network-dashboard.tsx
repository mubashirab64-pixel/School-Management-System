"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  LineChart, Line, Legend, CartesianGrid,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, CheckCircle2, AlertTriangle, Percent } from "lucide-react"
import { getOrgPerformanceDashboard } from "@/lib/api"
import RetentionKPICard from "@/components/dashboard/retention-kpi-card"
import ProgressionKPICard from "@/components/dashboard/progression-kpi-card"

const EXAM_TYPES = [
  { value: "monthly", label: "Monthly" },
  { value: "midterm", label: "Mid Term" },
  { value: "final", label: "Final Term" },
]
const MONTHS = ["April", "May", "June", "August", "September", "October", "November", "December", "January", "February", "March"]

// pass-rate → colour band (heatmap + bars)
function band(v: number) {
  if (v >= 85) return "#16a34a"      // green
  if (v >= 60) return "#f59e0b"      // amber
  return "#dc2626"                    // red
}

function KpiCard({ icon, label, value, sub, tone = "default" }: any) {
  const toneCls = tone === "danger" ? "text-rose-600" : tone === "good" ? "text-emerald-600" : "text-[#274c77]"
  return (
    <Card className="border border-gray-100">
      <CardContent className="p-4 flex items-start gap-3">
        <div className={`p-2 rounded-lg bg-gray-50 ${toneCls}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500 font-medium">{label}</p>
          <p className={`text-2xl font-black ${toneCls}`}>{value}</p>
          {sub && <p className="text-[11px] text-gray-400 mt-0.5 truncate">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

export default function OrgNetworkDashboard() {
  const [mode, setMode] = useState<"inter" | "intra">("inter")
  const [examType, setExamType] = useState("final")
  const [year, setYear] = useState<string>("")
  const [month, setMonth] = useState<string>("")
  const [campus, setCampus] = useState<string>("")
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    getOrgPerformanceDashboard({
      exam_type: examType,
      academic_year: year || undefined,
      month: examType === "monthly" && month ? month : undefined,
      campus: mode === "intra" && campus ? campus : undefined,
    })
      .then((d: any) => { if (alive) { setData(d); if (!year && d?.filters?.academic_year) setYear(d.filters.academic_year) } })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [examType, year, month, mode, campus])

  const years: string[] = data?.filters?.available_years || []
  const campuses: any[] = data?.filters?.campuses || []
  const subjects: string[] = data?.filters?.subjects || []
  const kpis = data?.kpis
  const intra = data?.intra

  // Default to "All Campus" (aggregate) when entering intra mode.
  useEffect(() => {
    if (mode === "intra" && !campus) setCampus("all")
  }, [mode, campus])

  return (
    <div className="space-y-5">
      {/* ── Filters bar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 mb-1">Academic Year</label>
          <select value={year} onChange={e => setYear(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white">
            {years.length === 0 && <option value="">—</option>}
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {examType === "monthly" && (
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Month</label>
            <select value={month} onChange={e => setMonth(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white">
              <option value="">All Months</option>
              {(data?.filters?.months?.length ? data.filters.months : MONTHS).map((m: string) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        )}

        {mode === "intra" && (
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Branch</label>
            <select value={campus} onChange={e => setCampus(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white">
              <option value="all">All Campus</option>
              {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}

        <div className="ml-auto flex items-end gap-3">
          {/* Exam type toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {EXAM_TYPES.map(t => (
              <button key={t.value} onClick={() => setExamType(t.value)}
                className={`px-3 py-1.5 text-xs font-semibold ${examType === t.value ? "bg-[#274c77] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                {t.label}
              </button>
            ))}
          </div>
          {/* INTER / INTRA toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {(["inter", "intra"] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`px-4 py-1.5 text-xs font-black uppercase ${mode === m ? "bg-[#185FA5] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && <div className="text-sm text-gray-400 py-10 text-center">Loading metrics…</div>}

      {!loading && data && mode === "inter" && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard icon={<Users className="h-5 w-5" />} label="Total Network Enrollment" value={(kpis?.total_enrollment ?? 0).toLocaleString()} sub="Active students" />
            <KpiCard icon={<CheckCircle2 className="h-5 w-5" />} tone="good" label="System-Wide Pass Rate" value={`${kpis?.system_pass_rate ?? 0}%`} />
            <KpiCard icon={<AlertTriangle className="h-5 w-5" />} tone="danger" label="Critical Campuses"
              value={`${kpis?.critical_count ?? 0} / ${kpis?.total_branches ?? 0}`}
              sub={kpis?.critical_campuses?.map((c: any) => c.campus).join(", ") || "None at risk"} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Inter-Campus Leaderboard */}
            <Card className="border border-gray-100">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-[#274c77]">Inter-Campus Leaderboard</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(180, (data.leaderboard?.length || 1) * 44)}>
                  <BarChart layout="vertical" data={data.leaderboard} margin={{ left: 20, right: 30 }}>
                    <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="campus" tick={{ fontSize: 12 }} width={90} />
                    <Tooltip formatter={(v: any) => `${v}%`} />
                    <Bar dataKey="pass_rate" radius={[0, 4, 4, 0]}>
                      {data.leaderboard?.map((e: any, i: number) => (
                        <Cell key={i} fill={e.critical ? "#dc2626" : "#185FA5"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Grade distribution */}
            <Card className="border border-gray-100">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-[#274c77]">Network-Wide Grade Distribution</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.grade_distribution}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="grade" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {data.grade_distribution?.map((g: any, i: number) => (
                        <Cell key={i} fill={["A+", "A"].includes(g.grade) ? "#16a34a" : ["B", "C"].includes(g.grade) ? "#3b82f6" : g.grade === "D" ? "#f59e0b" : g.grade === "E" ? "#f97316" : "#dc2626"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Subject audit heatmap */}
          <Card className="border border-gray-100">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-[#274c77]">Systemic Network Subject Audit Heatmap</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              {subjects.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">No subject data for this filter.</p>
              ) : (
                <table className="w-full text-center text-sm border-separate border-spacing-1">
                  <thead>
                    <tr>
                      <th className="text-left text-xs text-gray-500 font-semibold px-2">Campus</th>
                      {subjects.map(s => <th key={s} className="text-xs text-gray-500 font-semibold px-2">{s}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {data.subject_heatmap?.map((row: any) => (
                      <tr key={row.campus}>
                        <td className="text-left font-semibold text-gray-700 px-2 whitespace-nowrap">{row.campus}</td>
                        {subjects.map(s => {
                          const v = row.subjects[s]
                          return (
                            <td key={s} className="rounded-md text-white font-bold py-3 min-w-[64px]"
                              style={{ background: v == null ? "#e5e7eb" : band(v) }}>
                              {v == null ? "—" : `${Math.round(v)}%`}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {/* This Year vs Last Year — per-campus pass rate */}
          <Card className="border border-gray-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-[#274c77]">
                This Year vs Last Year — Campus Pass Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.year_comparison?.rows?.length ? (
                <>
                  <ResponsiveContainer width="100%" height={Math.max(240, data.year_comparison.rows.length * 46)}>
                    <BarChart data={data.year_comparison.rows}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="campus" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: any) => v == null ? "—" : `${v}%`} /><Legend />
                      <Bar dataKey="this_year" name={`This Year (${data.year_comparison.this_year})`} fill="#185FA5" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="last_year" name={`Last Year (${data.year_comparison.last_year ?? "—"})`} fill="#94a3b8" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  {!data.year_comparison.has_last_year && (
                    <p className="text-[11px] text-amber-600 mt-1">
                      No approved results for last year ({data.year_comparison.last_year ?? "—"}) yet — comparison will fill in once that data exists.
                    </p>
                  )}
                </>
              ) : <p className="text-sm text-gray-400 py-6 text-center">No campus results for this filter.</p>}
            </CardContent>
          </Card>
        </>
      )}

      {!loading && data && mode === "intra" && (
        <>
          {/* Intra KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard icon={<Users className="h-5 w-5" />} label="Branch Enrollment" value={(intra?.kpis?.branch_enrollment ?? 0).toLocaleString()} sub="Active students" />
            <KpiCard icon={<CheckCircle2 className="h-5 w-5" />} tone="good" label="Localized Pass Rate" value={`${intra?.kpis?.pass_rate ?? 0}%`} />
            <KpiCard icon={<Percent className="h-5 w-5" />} label="Local Avg Percentage" value={`${intra?.kpis?.avg_percentage ?? 0}%`} />
          </div>

          {/* Retention + progression for the selected campus, or org-wide when
              "All Campus" (campus === 'all') is picked. */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RetentionKPICard campusId={campus && campus !== "all" ? campus : undefined} academicYear={year || undefined} />
            <ProgressionKPICard campusId={campus && campus !== "all" ? campus : undefined} academicYear={year || undefined} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Class-wise pass rates */}
            <Card className="border border-gray-100">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-[#274c77]">Branch Class-Wise Pass Rates</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={intra?.class_pass_rates}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="grade" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => `${v}%`} />
                    <Bar dataKey="pass_rate" radius={[4, 4, 0, 0]}>
                      {intra?.class_pass_rates?.map((c: any, i: number) => <Cell key={i} fill={band(c.pass_rate)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Local subject performance */}
            <Card className="border border-gray-100">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-[#274c77]">Local Subject Performance</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(200, (intra?.subject_performance?.length || 1) * 34)}>
                  <BarChart layout="vertical" data={intra?.subject_performance} margin={{ left: 20, right: 30 }}>
                    <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="subject" tick={{ fontSize: 11 }} width={110} />
                    <Tooltip formatter={(v: any) => `${v}%`} />
                    <Bar dataKey="pass_rate" radius={[0, 4, 4, 0]}>
                      {intra?.subject_performance?.map((s: any, i: number) => <Cell key={i} fill={band(s.pass_rate)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Trend over time */}
          <Card className="border border-gray-100">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-[#274c77]">Branch Result Trend Over Time</CardTitle></CardHeader>
            <CardContent>
              {intra?.trend?.length ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={intra.trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => `${v}%`} />
                    <Legend />
                    <Line type="monotone" dataKey="pass" name="Pass %" stroke="#16a34a" strokeWidth={2} />
                    <Line type="monotone" dataKey="fail" name="Fail %" stroke="#dc2626" strokeWidth={2} />
                    <Line type="monotone" dataKey="average" name="Average" stroke="#185FA5" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-gray-400 py-6 text-center">No monthly trend data for this branch/year.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
