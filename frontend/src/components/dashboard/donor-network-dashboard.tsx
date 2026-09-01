"use client"

import { useEffect, useState } from "react"
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, Legend, CartesianGrid, LabelList,
  LineChart, Line, PieChart, Pie,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, CheckCircle2, Building2, GraduationCap, Percent, Trophy } from "lucide-react"
import { getDonorPerformanceDashboard, getDailyAttendanceStats, getCampusAttendanceStats, getCampusComparisonStats } from "@/lib/api"
import RetentionKPICard from "@/components/dashboard/retention-kpi-card"
import ProgressionKPICard from "@/components/dashboard/progression-kpi-card"
import { WeeklyAttendanceChart } from "@/components/dashboard/weekly-attendance-chart"

const EXAM_TYPES = [
  { value: "monthly", label: "Monthly" },
  { value: "midterm", label: "Mid Term" },
  { value: "final", label: "Final Term" },
]
const MONTHS = ["April", "May", "June", "August", "September", "October", "November", "December", "January", "February", "March"]

// Distinct line colours for the per-campus progression chart.
const CAMPUS_COLORS = ["#185FA5", "#16a34a", "#f59e0b", "#8b5cf6", "#dc2626", "#0891b2", "#db2777", "#65a30d"]
// Grade → colour for the distribution donut.
const GRADE_COLORS: Record<string, string> = {
  "A+": "#16a34a", "A": "#22c55e", "B": "#84cc16", "C": "#f59e0b",
  "D": "#f97316", "E": "#fb7185", "F": "#dc2626",
}

function band(v: number) {
  if (v >= 85) return "#16a34a"
  if (v >= 60) return "#f59e0b"
  return "#dc2626"
}

function KpiCard({ icon, label, value, sub, tone = "default" }: any) {
  const cls = tone === "danger" ? "text-rose-600" : tone === "good" ? "text-emerald-600" : "text-[#274c77]"
  return (
    <Card className="border border-gray-100">
      <CardContent className="p-4 flex items-start gap-3">
        <div className={`p-2 rounded-lg bg-gray-50 ${cls}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500 font-medium">{label}</p>
          <p className={`text-2xl font-black ${cls}`}>{value}</p>
          {sub && <p className="text-[11px] text-gray-400 mt-0.5 truncate">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

export default function DonorNetworkDashboard() {
  const [mode, setMode] = useState<"inter" | "intra">("inter")
  const [examType, setExamType] = useState("final")
  const [year, setYear] = useState("")
  const [month, setMonth] = useState("")
  const [campus, setCampus] = useState("")
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [weeklyData, setWeeklyData] = useState<any[]>([])
  const [attLoading, setAttLoading] = useState(true)
  const [attPeriod, setAttPeriod] = useState<"weekly" | "monthly" | "3month" | "6month">("weekly")

  // Daily present/absent for the Weekly Attendance chart. INTER = whole network;
  // INTRA = the selected campus (or the network when "All Campus").
  useEffect(() => {
    let alive = true
    setAttLoading(true)
    const days = { weekly: 7, monthly: 30, "3month": 90, "6month": 180 }[attPeriod]
    const camp = mode === "intra" && campus && campus !== "all" ? campus : undefined
    getDailyAttendanceStats(days, camp)
      .then((d: any) => { if (alive) setWeeklyData(Array.isArray(d) ? d : []) })
      .catch(() => {})
      .finally(() => { if (alive) setAttLoading(false) })
    return () => { alive = false }
  }, [attPeriod, mode, campus])

  // Per-campus attendance % (last 30 days) for the INTER comparison card.
  const [campusAtt, setCampusAtt] = useState<any[]>([])
  useEffect(() => {
    let alive = true
    getCampusAttendanceStats(30)
      .then((d: any) => {
        if (alive) setCampusAtt(Array.isArray(d) ? [...d].sort((a, b) => (b.percentage || 0) - (a.percentage || 0)) : [])
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  useEffect(() => {
    let alive = true
    setLoading(true)
    getDonorPerformanceDashboard({
      exam_type: examType,
      academic_year: year || undefined,
      month: examType === "monthly" && month ? month : undefined,
      campus: mode === "intra" && campus ? campus : undefined,
    })
      .then((d: any) => {
        if (!alive) return
        setData(d)
        if (!year && d?.filters?.academic_year) setYear(d.filters.academic_year)
        // Default to "All Campus" (aggregate) the first time we enter INTRA.
        if (mode === "intra" && !campus) {
          setCampus("all")
        }
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [examType, year, month, campus, mode])

  const years: string[] = data?.filters?.available_years || []
  const campuses: any[] = data?.filters?.campuses || []
  const inter = data?.inter
  const intra = data?.intra
  const progressionCampuses: string[] = inter?.progression_campuses || []

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 mb-1">Academic Year</label>
          <select value={year} onChange={e => setYear(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white">
            {years.length === 0 && <option value="">—</option>}
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        {mode === "intra" && (
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Select School</label>
            <select value={campus} onChange={e => setCampus(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white">
              <option value="all">All Campus</option>
              {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        {examType === "monthly" && (
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Month</label>
            <select value={month} onChange={e => setMonth(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white">
              <option value="">All Months</option>
              {(data?.filters?.months?.length ? data.filters.months : MONTHS).map((m: string) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        )}
        <div className="ml-auto flex items-end gap-3">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {EXAM_TYPES.map(t => (
              <button key={t.value} onClick={() => setExamType(t.value)}
                className={`px-3 py-1.5 text-xs font-semibold ${examType === t.value ? "bg-[#274c77] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>{t.label}</button>
            ))}
          </div>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {([["inter", "Inter"], ["intra", "Intra"]] as const).map(([m, lbl]) => (
              <button key={m} onClick={() => setMode(m)}
                className={`px-4 py-1.5 text-xs font-black uppercase ${mode === m ? "bg-[#185FA5] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>{lbl}</button>
            ))}
          </div>
        </div>
      </div>

      {loading && <div className="text-sm text-gray-400 py-10 text-center">Loading metrics…</div>}

      {/* ── INTER — Sponsored Network ── */}
      {!loading && inter && mode === "inter" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard icon={<Users className="h-5 w-5" />} label="Sponsored Lives" value={(inter.kpis.sponsored_lives ?? 0).toLocaleString()} sub="Active students across network" />
            <KpiCard icon={<CheckCircle2 className="h-5 w-5" />} tone="good" label="Avg Success Rate" value={`${inter.kpis.avg_success_rate ?? 0}%`} sub="Network pass rate (approved)" />
            <KpiCard icon={<Building2 className="h-5 w-5" />} label="Sponsored Campuses" value={(inter.kpis.sponsored_campuses ?? 0).toLocaleString()} sub="Total campuses" />
          </div>

          {/* Attendance by Campus + Campus Comparison — side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {/* Attendance by Campus — inter-campus comparison */}
          <Card className="border border-gray-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-[#274c77]">Attendance by Campus</CardTitle>
              <p className="text-[11px] text-gray-400">Present %, last 30 days</p>
            </CardHeader>
            <CardContent>
              {campusAtt.length ? (
                <div className="max-h-[360px] overflow-y-auto pr-1">
                  <ResponsiveContainer width="100%" height={Math.max(200, campusAtt.length * 38)}>
                    <BarChart layout="vertical" data={campusAtt} margin={{ left: 10, right: 40 }}>
                      <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="campus" tick={{ fontSize: 11 }} width={110} />
                      <Tooltip formatter={(v: any) => `${v}%`} />
                      <Bar dataKey="percentage" name="Attendance" radius={[0, 4, 4, 0]}>
                        {campusAtt.map((c: any, i: number) => <Cell key={i} fill={band(c.percentage)} />)}
                        <LabelList dataKey="percentage" position="right" formatter={(v: any) => `${v}%`} style={{ fontSize: 10, fontWeight: 700, fill: "#4b5563" }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="text-sm text-gray-400 py-6 text-center">No attendance data yet.</p>}
            </CardContent>
          </Card>

          {/* Campus Comparison — self-contained so its dropdowns don't re-render
              (and re-animate) the Attendance card beside it. */}
          <CampusComparisonCard campuses={campuses} leaderboard={inter?.leaderboard || []} />
          </div>

          {/* Retention + progression for the whole network (no campusId = org-wide).
              Self-fetch aggregate counts only — no student rows — so they fit
              the donor's anonymised view. */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RetentionKPICard />
            <ProgressionKPICard />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Inter-Campus Leaderboard */}
            <Card className="border border-gray-100">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-[#274c77]">Inter-Campus Leaderboard</CardTitle></CardHeader>
              <CardContent>
                {inter.leaderboard?.length ? (
                  <ResponsiveContainer width="100%" height={Math.max(220, inter.leaderboard.length * 42)}>
                    <BarChart layout="vertical" data={inter.leaderboard} margin={{ left: 10, right: 30 }}>
                      <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="campus" tick={{ fontSize: 11 }} width={110} />
                      <Tooltip formatter={(v: any) => `${v}%`} />
                      <Bar dataKey="pass_rate" name="Pass rate" radius={[0, 4, 4, 0]}>
                        {inter.leaderboard.map((c: any, i: number) => <Cell key={i} fill={band(c.pass_rate)} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-gray-400 py-6 text-center">No campus results for this filter.</p>}
              </CardContent>
            </Card>

            {/* Network-Wide Grade Progression */}
            <Card className="border border-gray-100">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-[#274c77]">Network-Wide Grade Progression</CardTitle></CardHeader>
              <CardContent>
                {inter.grade_progression?.length ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={inter.grade_progression} margin={{ left: 0, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="level" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: any) => v == null ? "—" : `${v}%`} /><Legend />
                      {progressionCampuses.map((c, i) => (
                        <Line key={c} type="monotone" dataKey={c} stroke={CAMPUS_COLORS[i % CAMPUS_COLORS.length]}
                          strokeWidth={2} connectNulls dot={{ r: 3 }} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-gray-400 py-6 text-center">No grade-level data for this filter.</p>}
                <p className="text-[11px] text-gray-400 mt-1">Pass % across grade-level bands (Pre-Primary → Secondary), per campus.</p>
              </CardContent>
            </Card>
          </div>

          {/* This Year vs Last Year — per-campus pass rate */}
          <Card className="border border-gray-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-[#274c77]">
                This Year vs Last Year — Campus Pass Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              {inter.year_comparison?.rows?.length ? (
                <>
                  <ResponsiveContainer width="100%" height={Math.max(240, inter.year_comparison.rows.length * 46)}>
                    <BarChart data={inter.year_comparison.rows}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="campus" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: any) => v == null ? "—" : `${v}%`} /><Legend />
                      <Bar dataKey="this_year" name={`This Year (${inter.year_comparison.this_year})`} fill="#185FA5" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="last_year" name={`Last Year (${inter.year_comparison.last_year ?? "—"})`} fill="#94a3b8" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  {!inter.year_comparison.has_last_year && (
                    <p className="text-[11px] text-amber-600 mt-1">
                      No approved results for last year ({inter.year_comparison.last_year ?? "—"}) yet — comparison will fill in once that data exists.
                    </p>
                  )}
                </>
              ) : <p className="text-sm text-gray-400 py-6 text-center">No campus results for this filter.</p>}
            </CardContent>
          </Card>

          {/* Age Distribution. Fed by server-side counts (no student rows reach
              the client), so it stays within the donor's anonymised view.
              Enrolment Trend was removed — the dashboard already has one. */}
          <Card className="border border-gray-100">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-[#274c77]">Age Distribution</CardTitle></CardHeader>
            <CardContent>
              {inter.age_distribution?.length ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={inter.age_distribution}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="ageGroup" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Students" fill="#185FA5" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-gray-400 py-6 text-center">No enrolment data.</p>}
              <p className="text-[11px] text-gray-400 mt-1">Active sponsored students by age band.</p>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── INTRA — Single Campus ── */}
      {!loading && mode === "intra" && (
        !intra ? (
          <p className="text-sm text-gray-400 py-10 text-center">Select a school to view its impact metrics.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KpiCard icon={<GraduationCap className="h-5 w-5" />} label={`Branch Enrollment${intra.campus ? ` (${intra.campus})` : ""}`} value={(intra.kpis.branch_enrollment ?? 0).toLocaleString()} sub="Active students" />
              <KpiCard icon={<CheckCircle2 className="h-5 w-5" />} tone="good" label="Localized Pass Rate" value={`${intra.kpis.pass_rate ?? 0}%`} sub="Approved results" />
              <KpiCard icon={<Percent className="h-5 w-5" />} label="Campus Avg %" value={`${intra.kpis.avg_percentage ?? 0}%`} sub="Average marks" />
            </div>

            {/* Attendance — selected campus (or whole network for All Campus) */}
            <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
              <WeeklyAttendanceChart data={weeklyData} isLoading={attLoading} campusId={campus !== "all" ? campus : undefined} period={attPeriod} onPeriodChange={setAttPeriod} />
            </div>

            {/* Retention + progression for the selected school. "All Campus"
                (campus === 'all') → no campusId → the endpoint returns org-wide
                aggregate, matching the all-campus totals above. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <RetentionKPICard campusId={campus && campus !== "all" ? campus : undefined} academicYear={year || undefined} />
              <ProgressionKPICard campusId={campus && campus !== "all" ? campus : undefined} academicYear={year || undefined} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Core Competencies (Subject) */}
              <Card className="border border-gray-100">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-[#274c77]">Core Competencies (Subject)</CardTitle></CardHeader>
                <CardContent>
                  {intra.subject_performance?.length ? (
                    <ResponsiveContainer width="100%" height={Math.max(220, intra.subject_performance.length * 34)}>
                      <BarChart layout="vertical" data={intra.subject_performance} margin={{ left: 20, right: 30 }}>
                        <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="subject" tick={{ fontSize: 11 }} width={110} />
                        <Tooltip formatter={(v: any) => `${v}%`} />
                        <Bar dataKey="pass_rate" name="Pass rate" radius={[0, 4, 4, 0]}>
                          {intra.subject_performance.map((s: any, i: number) => <Cell key={i} fill={band(s.pass_rate)} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-sm text-gray-400 py-6 text-center">No subject data for this campus/filter.</p>}
                </CardContent>
              </Card>

              {/* Grade Distribution donut */}
              <Card className="border border-gray-100">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-[#274c77]">Grade Distribution</CardTitle></CardHeader>
                <CardContent>
                  {intra.grade_distribution?.some((g: any) => g.count > 0) ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={intra.grade_distribution.filter((g: any) => g.count > 0)}
                          dataKey="count" nameKey="grade" cx="50%" cy="50%" innerRadius={70} outerRadius={110}
                          paddingAngle={2} label={(e: any) => `${e.grade}: ${e.count}`}>
                          {intra.grade_distribution.filter((g: any) => g.count > 0).map((g: any, i: number) => (
                            <Cell key={i} fill={GRADE_COLORS[g.grade] || "#94a3b8"} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                      <Trophy className="h-8 w-8 mb-2 opacity-40" />
                      <p className="text-sm">No grade data for this campus/filter.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )
      )}
    </div>
  )
}

// Self-contained head-to-head campus comparison. Keeping its selection state
// local means changing a dropdown re-renders ONLY this card — the neighbouring
// "Attendance by Campus" chart no longer reloads/re-animates.
function CampusComparisonCard({ campuses, leaderboard }: { campuses: any[]; leaderboard: any[] }) {
  const [campA, setCampA] = useState<string>("")
  const [campB, setCampB] = useState<string>("")
  const [statsA, setStatsA] = useState<any>(null)
  const [statsB, setStatsB] = useState<any>(null)

  // Default to the first two campuses once they load.
  useEffect(() => {
    if (campuses.length && !campA) setCampA(String(campuses[0].id))
    if (campuses.length > 1 && !campB) setCampB(String(campuses[1].id))
  }, [campuses]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let alive = true
    if (campA) getCampusComparisonStats(campA).then(d => { if (alive) setStatsA(d) })
    else setStatsA(null)
    return () => { alive = false }
  }, [campA])
  useEffect(() => {
    let alive = true
    if (campB) getCampusComparisonStats(campB).then(d => { if (alive) setStatsB(d) })
    else setStatsB(null)
    return () => { alive = false }
  }, [campB])

  // Pass rate for a campus name from the already-filtered leaderboard.
  const passRateFor = (name?: string): number | null => {
    if (!name) return null
    const row = leaderboard.find((r: any) => r.campus === name)
    return row ? row.pass_rate : null
  }

  return (
    <Card className="border border-gray-100">
      <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-[#274c77]">Campus Comparison</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <select value={campA} onChange={e => setCampA(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white">
            {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={campB} onChange={e => setCampB(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white">
            {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {statsA && statsB ? (
          <div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="text-sm font-bold text-[#274c77] truncate">{statsA.campus_name}</div>
              <div className="text-sm font-bold text-[#274c77] truncate text-right">{statsB.campus_name}</div>
            </div>
            {([
              { label: "Attendance", a: statsA.attendance_pct, b: statsB.attendance_pct, unit: "%" },
              { label: "Pass rate", a: passRateFor(statsA.campus_name), b: passRateFor(statsB.campus_name), unit: "%" },
              { label: "Students", a: statsA.students, b: statsB.students },
              { label: "Teachers", a: statsA.teachers, b: statsB.teachers },
              { label: "Subjects", a: statsA.subjects, b: statsB.subjects },
            ] as const).map((row) => {
              const av = row.a == null ? null : Number(row.a)
              const bv = row.b == null ? null : Number(row.b)
              const aWins = av != null && bv != null && av > bv
              const bWins = av != null && bv != null && bv > av
              const fmt = (v: number | null) => v == null ? "—" : `${v}${(row as any).unit || ""}`
              return (
                <div key={row.label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-1.5 border-t border-gray-50">
                  <div className={`text-sm font-semibold ${aWins ? "text-green-600" : "text-gray-700"}`}>{fmt(av)}{aWins && <span className="ml-1 text-green-500">▲</span>}</div>
                  <div className="text-[11px] uppercase tracking-wide text-gray-400 px-2 text-center">{row.label}</div>
                  <div className={`text-sm font-semibold text-right ${bWins ? "text-green-600" : "text-gray-700"}`}>{bWins && <span className="mr-1 text-green-500">▲</span>}{fmt(bv)}</div>
                </div>
              )
            })}
          </div>
        ) : <p className="text-sm text-gray-400 py-6 text-center">Select two campuses to compare.</p>}
      </CardContent>
    </Card>
  )
}
