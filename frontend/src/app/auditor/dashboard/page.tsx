"use client"

import { Users, TrendingUp, DollarSign, AlertTriangle, TrendingDown } from "lucide-react"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts"

// ── Mock data ────────────────────────────────────────────────────────────────
const attendanceTrend = [
  { week: "W1", rate: 88 }, { week: "W2", rate: 91 }, { week: "W3", rate: 85 },
  { week: "W4", rate: 93 }, { week: "W5", rate: 87 }, { week: "W6", rate: 90 },
  { week: "W7", rate: 94 }, { week: "W8", rate: 89 },
]

const feeStatus = [
  { name: "Paid", value: 65 },
  { name: "Unpaid", value: 22 },
  { name: "Partial", value: 13 },
]
const FEE_COLORS = ["#16a34a", "#dc2626", "#d97706"]

const recentIssues = [
  { id: 1, module: "Attendance", description: "Grade 5-A: no attendance for 3 days", severity: "High", status: "Open", date: "2026-04-10" },
  { id: 2, module: "Fees", description: "Bank payments pending for 8+ days", severity: "Medium", status: "Under Review", date: "2026-04-09" },
  { id: 3, module: "Results", description: "Results stuck at coordinator approval", severity: "Medium", status: "Open", date: "2026-04-08" },
  { id: 4, module: "Staff", description: "Teacher absent without record", severity: "Low", status: "Resolved", date: "2026-04-07" },
  { id: 5, module: "Fees", description: "3 students with 3+ months overdue", severity: "High", status: "Open", date: "2026-04-06" },
]

const recentActivity = [
  { time: "10:32 AM", actor: "Mr. Asad", action: "Submitted attendance for Grade 3-B" },
  { time: "10:15 AM", actor: "Ms. Fatima", action: "Approved Grade 5-A results" },
  { time: "09:58 AM", actor: "System", action: "Generated April challans for 212 students" },
  { time: "09:30 AM", actor: "Coordinator Ali", action: "Approved attendance review — Grade 4" },
  { time: "09:10 AM", actor: "Mr. Bilal", action: "Submitted exam results for Grade 6" },
  { time: "08:55 AM", actor: "Accounts", action: "Recorded bank payment — Rs. 12,500" },
  { time: "08:40 AM", actor: "Principal", action: "Approved transfer request — Student #204" },
  { time: "08:20 AM", actor: "Ms. Zara", action: "Marked attendance for Grade 2-A" },
  { time: "08:05 AM", actor: "System", action: "Daily backup completed" },
  { time: "07:50 AM", actor: "Mr. Kamran", action: "Logged in from campus terminal" },
]

// ── Sub-components ───────────────────────────────────────────────────────────
function StatCard({
  title, value, sub, icon: Icon, color, trend,
}: {
  title: string
  value: string | number
  sub?: string
  icon: React.ElementType
  color: string
  trend?: { value: number; positive: boolean }
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex gap-4 items-start shadow-sm">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-bold text-gray-800 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        {trend && (
          <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${trend.positive ? "text-green-600" : "text-red-500"}`}>
            {trend.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trend.value}% vs last month
          </div>
        )}
      </div>
    </div>
  )
}

const SEVERITY_BADGE: Record<string, string> = {
  High: "bg-red-100 text-red-700",
  Medium: "bg-amber-100 text-amber-700",
  Low: "bg-gray-100 text-gray-600",
  Critical: "bg-red-200 text-red-800",
}
const STATUS_BADGE: Record<string, string> = {
  Open: "bg-blue-100 text-blue-700",
  "Under Review": "bg-amber-100 text-amber-700",
  Resolved: "bg-green-100 text-green-700",
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function AuditorDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Auditor Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Campus health overview — April 2026</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Students" value="1,248" sub="Enrolled this session" icon={Users} color="bg-[#2a4e78]" trend={{ value: 3, positive: true }} />
        <StatCard title="Attendance Rate" value="89.4%" sub="This month" icon={TrendingUp} color="bg-green-600" trend={{ value: 1.2, positive: true }} />
        <StatCard title="Fee Collection" value="74.6%" sub="Collected vs billed" icon={DollarSign} color="bg-amber-500" trend={{ value: 2.1, positive: false }} />
        <StatCard title="Open Issues" value="3" sub="Flagged, not resolved" icon={AlertTriangle} color="bg-red-500" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Attendance Trend */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <p className="text-sm font-semibold text-gray-700 mb-4">Weekly Attendance Trend (last 8 weeks)</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={attendanceTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} />
              <YAxis domain={[70, 100]} tick={{ fontSize: 12 }} unit="%" />
              <Tooltip formatter={(v) => [`${v}%`, "Attendance"]} />
              <Line type="monotone" dataKey="rate" stroke="#2a7fd4" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Fee Status Donut */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <p className="text-sm font-semibold text-gray-700 mb-4">Fee Status — April 2026</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={feeStatus} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={3}>
                {feeStatus.map((_, i) => <Cell key={i} fill={FEE_COLORS[i]} />)}
              </Pie>
              <Legend iconType="circle" iconSize={10} />
              <Tooltip formatter={(v) => [`${v}%`]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Issues + Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Issues Table */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-700">Recent Issues</p>
            <a href="/auditor/issues" className="text-xs text-blue-600 hover:underline">View all</a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Module</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Description</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Severity</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentIssues.map((issue) => (
                  <tr key={issue.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-700">{issue.module}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[220px] truncate">{issue.description}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_BADGE[issue.severity]}`}>
                        {issue.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[issue.status]}`}>
                        {issue.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{issue.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-700">Recent Activity</p>
            <a href="/auditor/logs" className="text-xs text-blue-600 hover:underline">View logs</a>
          </div>
          <ul className="divide-y divide-gray-100 max-h-[340px] overflow-y-auto">
            {recentActivity.map((item, i) => (
              <li key={i} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                <p className="text-xs text-gray-500">{item.time}</p>
                <p className="text-sm text-gray-700 mt-0.5">
                  <span className="font-medium">{item.actor}</span> — {item.action}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
