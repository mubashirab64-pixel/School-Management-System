"use client"

import { useEffect, useRef, useState } from "react"
import {
  Building2,
  Users,
  GraduationCap,
  LayoutGrid,
  AlertTriangle,
  Activity,
  Megaphone,
  CheckCircle2,
  TrendingUp,
  Plus,
  X,
} from "lucide-react"
import {
  getAllCampuses,
  getStudentCampusStats,
  getTeacherCampusStats,
  getClassroomCampusStats,
  getCampusAttendanceStats,
  getAnnouncements,
  createAnnouncement,
} from "@/lib/api"
import { toast } from "sonner"
import RetentionKPICard from "@/components/dashboard/retention-kpi-card"
import ProgressionKPICard from "@/components/dashboard/progression-kpi-card"
import RegionalVarianceCard from "@/components/dashboard/regional-variance-card"

type Row = { name: string; students: number; teachers: number; classrooms: number }
type Alert = { level: "danger" | "warning" | "success"; text: string }

const formatNum = (n: number) => new Intl.NumberFormat("en-PK").format(n || 0)
const attTone = (p: number) => (p >= 75 ? "#10B981" : p >= 50 ? "#F59E0B" : "#EF4444")

const timeAgo = (ts?: string) => {
  if (!ts) return ""
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
  if (Number.isNaN(m)) return ""
  if (m < 1) return "Just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function OrgAdminInsights() {
  const [rows, setRows] = useState<Row[]>([])
  const [totalCampuses, setTotalCampuses] = useState(0)
  const [activities, setActivities] = useState<any[]>([])
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [campusOptions, setCampusOptions] = useState<{ id: number; name: string }[]>([])
  const [attendanceMap, setAttendanceMap] = useState<Record<string, number>>({})
  const [attendanceDays, setAttendanceDays] = useState(30) // 7 = weekly, 30 = monthly
  const [loading, setLoading] = useState(true)

  // New announcement form
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ title: "", body: "", priority: "normal", audience: "all", campus: "" })

  const refreshAnnouncements = async () => {
    try {
      const ann = await getAnnouncements()
      setAnnouncements(Array.isArray(ann) ? ann : [])
    } catch {
      /* silent */
    }
  }

  const handleCreate = async () => {
    if (!form.title.trim()) {
      toast.error("Title is required")
      return
    }
    setSubmitting(true)
    try {
      await createAnnouncement({
        title: form.title.trim(),
        body: form.body.trim() || undefined,
        priority: form.priority,
        audience: form.audience,
        campus: form.campus ? Number(form.campus) : null,
      })
      toast.success("Announcement published")
      setShowForm(false)
      setForm({ title: "", body: "", priority: "normal", audience: "all", campus: "" })
      await refreshAnnouncements()
    } catch (e: any) {
      toast.error(e?.message || "Failed to publish announcement")
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const [campuses, s, t, c, att] = await Promise.all([
          getAllCampuses().catch(() => []),
          getStudentCampusStats().catch(() => []),
          getTeacherCampusStats().catch(() => []),
          getClassroomCampusStats().catch(() => []),
          getCampusAttendanceStats().catch(() => []),
        ])
        const campusList: any[] = Array.isArray(campuses) ? campuses : ((campuses as any)?.results || [])
        const names = new Set<string>()
        campusList.forEach((x: any) => x && names.add(x.campus_name || x.name))
        ;[s, t, c].forEach((arr: any) => (Array.isArray(arr) ? arr : []).forEach((it: any) => it?.campus && names.add(it.campus)))

        const countOf = (arr: any, name: string) =>
          (Array.isArray(arr) ? arr : []).find((it: any) => it.campus === name)?.count ?? 0

        const attMap: Record<string, number> = {}
        ;(Array.isArray(att) ? att : []).forEach((it: any) => {
          if (it?.campus && typeof it.percentage === "number") attMap[it.campus] = it.percentage
        })

        const merged: Row[] = Array.from(names)
          .filter(Boolean)
          .map((name) => ({
            name,
            students: countOf(s, name),
            teachers: countOf(t, name),
            classrooms: countOf(c, name),
          }))
          .sort((a, b) => b.students - a.students)

        if (mounted) {
          setRows(merged)
          setAttendanceMap(attMap)
          setTotalCampuses(campusList.length || merged.length)
          setCampusOptions(
            campusList
              .filter((x: any) => x?.id)
              .map((x: any) => ({ id: x.id, name: x.campus_name || x.name || `Campus ${x.id}` }))
          )
        }
      } catch {
        /* silent */
      }

      try {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL!
        const token =
          localStorage.getItem("sis_access_token") ||
          localStorage.getItem("token") ||
          localStorage.getItem("access") ||
          ""
        const res = await fetch(`${apiBase}/api/attendance/audit-logs/?page_size=6`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (res.ok) {
          const d = await res.json()
          if (mounted) setActivities(d.results || [])
        }
      } catch {
        /* silent */
      }

      try {
        const ann = await getAnnouncements()
        if (mounted) setAnnouncements(Array.isArray(ann) ? ann : [])
      } catch {
        /* silent */
      }

      if (mounted) setLoading(false)
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  // Refetch attendance when the window toggle changes (initial load already fetched 30d)
  const attDidMount = useRef(false)
  useEffect(() => {
    if (!attDidMount.current) {
      attDidMount.current = true
      return
    }
    let mounted = true
    getCampusAttendanceStats(attendanceDays)
      .then((att) => {
        const m: Record<string, number> = {}
        ;(Array.isArray(att) ? att : []).forEach((it: any) => {
          if (it?.campus && typeof it.percentage === "number") m[it.campus] = it.percentage
        })
        if (mounted) setAttendanceMap(m)
      })
      .catch(() => {})
    return () => { mounted = false }
  }, [attendanceDays])

  const totalStudents = rows.reduce((a, r) => a + r.students, 0)
  const totalTeachers = rows.reduce((a, r) => a + r.teachers, 0)
  const totalClassrooms = rows.reduce((a, r) => a + r.classrooms, 0)
  const maxStudents = Math.max(1, ...rows.map((r) => r.students))

  // Org-wide attendance = student-weighted average of available campus rates
  const attRows = rows.filter((r) => attendanceMap[r.name] !== undefined)
  const orgAttendance: number | null = attRows.length
    ? Math.round(
        (attRows.reduce((a, r) => a + attendanceMap[r.name] * r.students, 0) /
          Math.max(1, attRows.reduce((a, r) => a + r.students, 0))) * 10,
      ) / 10
    : null

  const alerts: Alert[] = []
  rows.forEach((r) => {
    if (r.students > 0 && r.teachers === 0)
      alerts.push({ level: "danger", text: `${r.name}: No teachers assigned (${formatNum(r.students)} students)` })
    else if (r.teachers > 0 && r.students / r.teachers > 40)
      alerts.push({ level: "warning", text: `${r.name}: High student–teacher ratio (1:${Math.round(r.students / r.teachers)})` })
    if (r.students > 0 && r.classrooms === 0)
      alerts.push({ level: "warning", text: `${r.name}: Students enrolled but no classrooms set up` })
  })
  if (!loading && alerts.length === 0)
    alerts.push({ level: "success", text: "All campuses operating normally" })

  const alertStyle = (l: Alert["level"]) =>
    l === "danger"
      ? { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-100", dot: "#EF4444", Icon: AlertTriangle }
      : l === "warning"
        ? { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-100", dot: "#F59E0B", Icon: AlertTriangle }
        : { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-100", dot: "#10B981", Icon: CheckCircle2 }

  return (
    <section className="mt-6 space-y-5">
      <div>
        <h2 className="text-lg font-bold text-[#274c77]">Organization Insights</h2>
        <p className="text-xs text-gray-500">Campus-level performance, activity, and alerts across your organization</p>
      </div>

      {/* Enrollment KPIs (whole org) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RetentionKPICard />
        <ProgressionKPICard />
      </div>

      {/* Regional Score Variance — org-wide subjects vs external regional benchmark */}
      <RegionalVarianceCard />

      {/* Campus Comparison */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4 gap-2">
            <h3 className="flex items-center gap-2 font-bold text-[#274c77]">
              <TrendingUp className="h-5 w-5 text-[#6096ba]" /> Campus Comparison
            </h3>
            <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50 flex-shrink-0">
              {[{ d: 7, label: "Weekly" }, { d: 30, label: "Monthly" }].map(({ d, label }) => (
                <button
                  key={d}
                  onClick={() => setAttendanceDays(d)}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-colors ${attendanceDays === d ? "bg-white text-[#274c77] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {loading ? (
            <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}</div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">No campus data available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    <th className="text-left py-2 pr-2">Campus</th>
                    <th className="text-left py-2 px-2 min-w-[130px]">Students</th>
                    <th className="text-right py-2 px-2">Teachers</th>
                    <th className="text-right py-2 pl-2">Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {/* All Campuses summary */}
                  <tr className="border-b border-gray-100">
                    <td className="py-2.5 pr-2 font-bold text-[#274c77] whitespace-nowrap">All Campuses</td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full"><div className="h-full rounded-full bg-[#274c77]" style={{ width: "100%" }} /></div>
                        <span className="text-xs font-bold text-[#274c77] w-10 text-right">{formatNum(totalStudents)}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-right font-bold text-[#274c77]">{formatNum(totalTeachers)}</td>
                    <td className="py-2.5 pl-2 text-right font-bold" style={{ color: orgAttendance !== null ? attTone(orgAttendance) : "#9ca3af" }}>
                      {orgAttendance !== null ? `${orgAttendance}%` : "—"}
                    </td>
                  </tr>
                  {/* Per campus */}
                  {rows.map((r) => (
                    <tr key={r.name} className="border-b border-gray-50 last:border-0">
                      <td className="py-2.5 pr-2 font-medium text-gray-800 truncate max-w-[130px]">{r.name}</td>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full"><div className="h-full rounded-full bg-[#6096ba]" style={{ width: `${maxStudents ? (r.students / maxStudents) * 100 : 0}%` }} /></div>
                          <span className="text-xs font-semibold text-gray-700 w-10 text-right">{formatNum(r.students)}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-right text-gray-600">{formatNum(r.teachers)}</td>
                      <td className="py-2.5 pl-2 text-right font-semibold" style={{ color: attendanceMap[r.name] !== undefined ? attTone(attendanceMap[r.name]) : "#9ca3af" }}>
                        {attendanceMap[r.name] !== undefined ? `${attendanceMap[r.name]}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {/* Recent Activities + Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        {/* Recent Activities */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="flex items-center gap-2 font-bold text-[#274c77] mb-4">
            <Activity className="h-5 w-5 text-[#6096ba]" /> Recent Activities
          </h3>
          {loading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
          ) : activities.length === 0 ? (
            <div className="py-8 text-center">
              <Activity className="h-8 w-8 mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">No recent activity logged.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {activities.map((log, i) => {
                const action = String(log.action || log.action_display || "Activity")
                const who = log.changes?.changed_by || log.performed_by || log.user || ""
                const desc = log.description || log.reason || `${action.charAt(0).toUpperCase() + action.slice(1)} record`
                return (
                  <div key={log.id ?? i} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-gray-50 transition-colors">
                    <div className="w-9 h-9 rounded-full bg-[#6096ba]/10 flex items-center justify-center flex-shrink-0">
                      <Activity className="h-4 w-4 text-[#6096ba]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{String(desc)}</p>
                      <p className="text-xs text-gray-400">{who ? `${who} · ` : ""}{timeAgo(log.created_at || log.timestamp)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Announcements */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="flex items-center gap-2 font-bold text-[#274c77]">
              <Megaphone className="h-5 w-5 text-[#8B5CF6]" /> Announcements
            </h3>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold text-white bg-[#274c77] hover:bg-[#1e3a5f] rounded-lg transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> New
            </button>
          </div>
          {/* Announcement LIST moved to the Notifications page (Announcements tab);
              only the "New" button stays here so admins can still publish. */}
          <p className="text-sm text-gray-500">
            Publish an announcement with <span className="font-semibold">New</span>. It appears for
            everyone under <span className="font-semibold">Notifications → Announcements</span>.
          </p>
        </div>
      </div>

      {/* New Announcement modal */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !submitting && setShowForm(false)} />
          <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="flex items-center gap-2 font-bold text-[#274c77]"><Megaphone className="h-5 w-5 text-[#8B5CF6]" /> New Announcement</h3>
              <button onClick={() => !submitting && setShowForm(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Title <span className="text-rose-500">*</span></label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Parent-Teacher Meeting"
                  className="w-full h-10 px-3 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2F6B8A]/20 focus:border-[#2F6B8A]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Message</label>
                <textarea
                  value={form.body}
                  onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                  rows={3}
                  placeholder="Write the announcement details…"
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2F6B8A]/20 focus:border-[#2F6B8A] resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Priority</label>
                  <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} className="w-full h-10 px-3 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2F6B8A]/20">
                    <option value="normal">Normal</option>
                    <option value="important">Important</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Audience</label>
                  <select value={form.audience} onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))} className="w-full h-10 px-3 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2F6B8A]/20">
                    <option value="all">Everyone</option>
                    <option value="principals">Principals</option>
                    <option value="coordinators">Coordinators</option>
                    <option value="teachers">Teachers</option>
                    <option value="students">Students</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Scope</label>
                <select value={form.campus} onChange={(e) => setForm((f) => ({ ...f, campus: e.target.value }))} className="w-full h-10 px-3 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2F6B8A]/20">
                  <option value="">Organization-wide (all campuses)</option>
                  {campusOptions.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50/50">
              <button onClick={() => setShowForm(false)} disabled={submitting} className="h-9 px-4 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50">Cancel</button>
              <button onClick={handleCreate} disabled={submitting} className="h-9 px-5 text-sm font-semibold text-white bg-[#274c77] hover:bg-[#1e3a5f] rounded-lg transition-colors disabled:opacity-60">
                {submitting ? "Publishing…" : "Publish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
