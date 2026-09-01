"use client"

import { useState } from "react"
import { AlertTriangle } from "lucide-react"

const STATUS_BADGE: Record<string, string> = {
  Approved: "bg-green-100 text-green-700",
  Submitted: "bg-blue-100 text-blue-700",
  "Under Review": "bg-amber-100 text-amber-700",
  Draft: "bg-gray-100 text-gray-600",
  Reopened: "bg-purple-100 text-purple-700",
}

const mockRecords = [
  { id: 1, date: "2026-04-10", grade: "Grade 5-A", teacher: "Ms. Fatima", status: "Approved", submittedAt: "08:15 AM", approvedBy: "Coordinator Ali" },
  { id: 2, date: "2026-04-10", grade: "Grade 3-B", teacher: "Mr. Asad", status: "Under Review", submittedAt: "09:30 AM", approvedBy: "—" },
  { id: 3, date: "2026-04-10", grade: "Grade 6-A", teacher: "Mr. Bilal", status: "Submitted", submittedAt: "10:05 AM", approvedBy: "—" },
  { id: 4, date: "2026-04-09", grade: "Grade 2-B", teacher: "Ms. Zara", status: "Approved", submittedAt: "08:45 AM", approvedBy: "Coordinator Ali" },
  { id: 5, date: "2026-04-09", grade: "Grade 4-A", teacher: "Mr. Kamran", status: "Draft", submittedAt: "—", approvedBy: "—" },
  { id: 6, date: "2026-04-08", grade: "Grade 1-A", teacher: "Ms. Hina", status: "Approved", submittedAt: "08:10 AM", approvedBy: "Coordinator Ali" },
  { id: 7, date: "2026-04-08", grade: "Grade 5-B", teacher: "Mr. Tariq", status: "Reopened", submittedAt: "09:00 AM", approvedBy: "—" },
]

const anomalies = [
  { type: "Missing Submission", desc: "Grade 4-A has no attendance submitted for 3 consecutive school days", severity: "High" },
  { type: "Stuck Review", desc: "Grade 3-B attendance stuck in Under Review for 48+ hours", severity: "Medium" },
  { type: "Low Attendance", desc: "Grade 5-B: attendance below 60% on 2026-04-08", severity: "High" },
]

export default function AuditorAttendancePage() {
  const [statusFilter, setStatusFilter] = useState("All")
  const statuses = ["All", "Draft", "Submitted", "Under Review", "Approved", "Reopened"]

  const filtered = statusFilter === "All" ? mockRecords : mockRecords.filter(r => r.status === statusFilter)

  const total = mockRecords.length
  const approved = mockRecords.filter(r => r.status === "Approved").length
  const pending = mockRecords.filter(r => ["Draft", "Submitted", "Under Review"].includes(r.status)).length
  const stuck = mockRecords.filter(r => r.status === "Under Review").length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Attendance Audit</h1>
        <p className="text-sm text-gray-500 mt-0.5">Monitor attendance records and identify irregularities</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Records", value: total, color: "text-gray-800" },
          { label: "Approved", value: `${Math.round((approved / total) * 100)}%`, color: "text-green-600" },
          { label: "Pending", value: `${Math.round((pending / total) * 100)}%`, color: "text-amber-600" },
          { label: "Stuck (48h+)", value: stuck, color: "text-red-600" },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs text-gray-500 uppercase font-medium">{c.label}</p>
            <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-wrap gap-3 items-center">
        <span className="text-sm text-gray-600 font-medium">Status:</span>
        {statuses.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === s ? "bg-[#2a4e78] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">Attendance Records</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                {["Date", "Grade / Class", "Teacher", "Status", "Submitted At", "Approved By"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-600">{r.date}</td>
                  <td className="px-4 py-3 font-medium text-gray-700">{r.grade}</td>
                  <td className="px-4 py-3 text-gray-600">{r.teacher}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[r.status]}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{r.submittedAt}</td>
                  <td className="px-4 py-3 text-gray-500">{r.approvedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Anomaly Flags */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-gray-700">Detected Anomalies</p>
        {anomalies.map((a, i) => (
          <div key={i} className={`flex items-start gap-3 p-4 rounded-xl border ${a.severity === "High" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
            <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${a.severity === "High" ? "text-red-500" : "text-amber-500"}`} />
            <div className="flex-1">
              <p className={`text-sm font-semibold ${a.severity === "High" ? "text-red-700" : "text-amber-700"}`}>{a.type}</p>
              <p className="text-sm text-gray-600 mt-0.5">{a.desc}</p>
            </div>
            <a href="/auditor/issues" className="text-xs text-blue-600 hover:underline whitespace-nowrap">Flag as Issue</a>
          </div>
        ))}
      </div>
    </div>
  )
}
