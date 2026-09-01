"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, Legend, CartesianGrid,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, CheckCircle2, XCircle, Trophy, AlertTriangle, Percent, Building2 } from "lucide-react"
import { getCoordinatorPerformanceDashboard } from "@/lib/api"
import RetentionKPICard from "@/components/dashboard/retention-kpi-card"
import ProgressionKPICard from "@/components/dashboard/progression-kpi-card"

const EXAM_TYPES = [
  { value: "monthly", label: "Monthly" },
  { value: "midterm", label: "Mid Term" },
  { value: "final", label: "Final Term" },
]
const MONTHS = ["April", "May", "June", "August", "September", "October", "November", "December", "January", "February", "March"]

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

function StudentList({ icon, title, rows, tone, onStudentClick }: { icon: ReactNode; title: string; rows: any[]; tone: "top" | "fail"; onStudentClick?: (id: number) => void }) {
  return (
    <Card className="border border-gray-100">
      <CardHeader className="pb-2">
        <CardTitle className={`text-sm font-bold flex items-center gap-1.5 ${tone === "top" ? "text-emerald-700" : "text-rose-700"}`}>
          {icon}{title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No students.</p>
        ) : (
          <div className="max-h-[280px] overflow-y-auto pr-1">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-[11px] text-gray-400 font-semibold border-b">
                  <th className="py-1.5">#</th><th>Student</th><th>Class</th><th className="text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/70 transition-colors">
                    <td className="py-1.5 text-gray-400">{i + 1}</td>
                    <td className="font-medium text-[#274c77] cursor-pointer hover:underline"
                      onClick={() => onStudentClick?.(s.id)}>{s.name}</td>
                    <td className="text-gray-500">{s.grade}{s.section ? `-${s.section}` : ""}</td>
                    <td className={`text-right font-bold ${tone === "top" ? "text-emerald-600" : "text-rose-600"}`}>
                      {s.percentage}%{tone === "fail" ? " [F]" : ""}
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

export default function CoordinatorNetworkDashboard() {
  const router = useRouter()
  const [mode, setMode] = useState<"intra" | "compare">("intra")
  const [examType, setExamType] = useState("final")
  const [year, setYear] = useState("")
  const [level, setLevel] = useState("")
  const [month, setMonth] = useState("")
  const [classroom, setClassroom] = useState("")
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    getCoordinatorPerformanceDashboard({
      exam_type: examType,
      academic_year: year || undefined,
      level: level || undefined,
      month: examType === "monthly" && month ? month : undefined,
      classroom: classroom || undefined,
    })
      .then((d: any) => { if (alive) { setData(d); if (!year && d?.filters?.academic_year) setYear(d.filters.academic_year) } })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [examType, year, level, month, classroom])

  const years: string[] = data?.filters?.available_years || []
  const levels: any[] = data?.filters?.levels || []
  const classrooms: any[] = data?.filters?.classrooms || []
  const wingName: string = data?.filters?.wing || ""
  const intra = data?.intra
  const compare = data?.compare
  const delta = (compare?.kpis?.wing_pass_rate ?? 0) - (compare?.kpis?.campus_pass_rate ?? 0)

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
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 mb-1">Wing</label>
          <select value={level} onChange={e => setLevel(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white">
            {levels.length === 0 && <option value="">{wingName || "—"}</option>}
            {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
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
            {([["intra", "Wing"], ["compare", "vs Campus"]] as const).map(([m, lbl]) => (
              <button key={m} onClick={() => setMode(m)}
                className={`px-4 py-1.5 text-xs font-black uppercase ${mode === m ? "bg-[#185FA5] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>{lbl}</button>
            ))}
          </div>
        </div>
      </div>

      {loading && <div className="text-sm text-gray-400 py-10 text-center">Loading metrics…</div>}

      {/* ── INTRA (wing internals) ── */}
      {!loading && intra && mode === "intra" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard icon={<Users className="h-5 w-5" />} label={`Wing Enrollment (${wingName})`} value={(intra.kpis.wing_enrollment ?? 0).toLocaleString()} sub="Active students" />
            <KpiCard icon={<CheckCircle2 className="h-5 w-5" />} tone="good" label="Pass Rate" value={`${intra.kpis.pass_rate ?? 0}%`} />
            <KpiCard icon={<XCircle className="h-5 w-5" />} tone="danger" label="Fail Rate" value={`${intra.kpis.fail_rate ?? 0}%`} />
          </div>

          {/* Retention + grade progression — the endpoint scopes these to the
              coordinator's assigned levels server-side, so they show the wing only. */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RetentionKPICard />
            <ProgressionKPICard />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border border-gray-100">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-[#274c77]">Section Standings (within wing)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={intra.section_standings}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="section" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => `${v}%`} />
                    <Bar dataKey="pass_rate" radius={[3, 3, 0, 0]}>
                      {intra.section_standings?.map((s: any, i: number) => <Cell key={i} fill={band(s.pass_rate)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border border-gray-100">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-[#274c77]">Wing Subject Performance (Avg %)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(200, (intra.subject_performance?.length || 1) * 34)}>
                  <BarChart layout="vertical" data={intra.subject_performance} margin={{ left: 20, right: 30 }}>
                    <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="subject" tick={{ fontSize: 11 }} width={110} />
                    <Tooltip formatter={(v: any) => `${v}%`} />
                    <Bar dataKey="avg_pct" radius={[0, 4, 4, 0]}>
                      {intra.subject_performance?.map((s: any, i: number) => <Cell key={i} fill={band(s.avg_pct)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500">Class filter (Top / Needing Action):</span>
            <select value={classroom} onChange={e => setClassroom(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white">
              <option value="">All Classes</option>
              {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <StudentList icon={<Trophy className="h-4 w-4" />} title="Top Performing Students" rows={intra.top_students || []} tone="top" onStudentClick={(id) => router.push(`/admin/students/profile?id=${id}`)} />
            <StudentList icon={<AlertTriangle className="h-4 w-4" />} title="Students Needing Action" rows={intra.failing_students || []} tone="fail" onStudentClick={(id) => router.push(`/admin/students/profile?id=${id}`)} />
          </div>
        </>
      )}

      {/* ── COMPARE (wing vs campus) ── */}
      {!loading && compare && mode === "compare" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard icon={<CheckCircle2 className="h-5 w-5" />} tone="good" label="Wing Pass Rate"
              value={`${compare.kpis.wing_pass_rate ?? 0}%`}
              sub={`Campus: ${compare.kpis.campus_pass_rate ?? 0}% (${delta >= 0 ? "+" : ""}${delta.toFixed(1)})`} />
            <KpiCard icon={<Building2 className="h-5 w-5" />} label="Campus Baseline (Pass)" value={`${compare.kpis.campus_pass_rate ?? 0}%`} sub="Whole campus average" />
            <KpiCard icon={<Percent className="h-5 w-5" />} label="Wing Avg %" value={`${compare.kpis.wing_avg ?? 0}%`} sub={`Campus avg: ${compare.kpis.campus_avg ?? 0}%`} />
          </div>

          <Card className="border border-gray-100">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-[#274c77]">Wing vs Campus — Subject Comparison</CardTitle></CardHeader>
            <CardContent>
              {compare.subject_comparison?.length ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={compare.subject_comparison}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="subject" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => `${v}%`} /><Legend />
                    <Bar dataKey="wing_pct" name={`${wingName || "Wing"}`} fill="#185FA5" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="campus_pct" name="Campus Baseline" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-gray-400 py-6 text-center">No subject data.</p>}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
