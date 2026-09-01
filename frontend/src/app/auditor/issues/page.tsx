"use client"

import { useState } from "react"
import Link from "next/link"
import { Plus, X } from "lucide-react"

const SEVERITY_BADGE: Record<string, string> = {
  Low: "bg-gray-100 text-gray-600",
  Medium: "bg-amber-100 text-amber-700",
  High: "bg-red-100 text-red-700",
  Critical: "bg-red-200 text-red-800 font-bold",
}
const STATUS_BADGE: Record<string, string> = {
  Open: "bg-blue-100 text-blue-700",
  "Under Review": "bg-amber-100 text-amber-700",
  Resolved: "bg-green-100 text-green-700",
}

const issues = [
  { id: 1, module: "Attendance", title: "Grade 5-A: no attendance for 3 days", severity: "High", status: "Open", date: "2026-04-10", resolution: "—" },
  { id: 2, module: "Fees", title: "Bank payment pending for 8+ days", severity: "Medium", status: "Under Review", date: "2026-04-09", resolution: "—" },
  { id: 3, module: "Results", title: "Results stuck at coordinator approval", severity: "Medium", status: "Open", date: "2026-04-08", resolution: "—" },
  { id: 4, module: "Staff", title: "Teacher absent without record", severity: "Low", status: "Resolved", date: "2026-04-07", resolution: "2026-04-08" },
  { id: 5, module: "Fees", title: "3 students with 3+ months overdue", severity: "High", status: "Open", date: "2026-04-06", resolution: "—" },
]

const MODULES = ["Attendance", "Results", "Fees", "Students", "Staff", "Transfers", "System"]
const SEVERITIES = ["Low", "Medium", "High", "Critical"]

export default function AuditorIssuesPage() {
  const [statusFilter, setStatusFilter] = useState("All")
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ module: "", severity: "Medium", title: "", description: "" })

  const filtered = statusFilter === "All" ? issues : issues.filter(i => i.status === statusFilter)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Issues</h1>
          <p className="text-sm text-gray-500 mt-0.5">Flag and track compliance issues for admin review</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#2a4e78] text-white rounded-lg text-sm font-medium hover:bg-[#1a3c5e] transition-colors"
        >
          <Plus className="w-4 h-4" /> New Issue
        </button>
      </div>

      {/* Status Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-wrap gap-3">
        {["All", "Open", "Under Review", "Resolved"].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === s ? "bg-[#2a4e78] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Issues List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                {["#", "Module", "Title", "Severity", "Status", "Date Flagged", "Resolved", ""].map(h => (
                  <th key={h} className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(issue => (
                <tr key={issue.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-400 text-xs">#{issue.id}</td>
                  <td className="px-4 py-3 text-gray-600 font-medium">{issue.module}</td>
                  <td className="px-4 py-3 text-gray-700">{issue.title}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_BADGE[issue.severity]}`}>{issue.severity}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[issue.status]}`}>{issue.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{issue.date}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{issue.resolution}</td>
                  <td className="px-4 py-3">
                    <Link href={`/auditor/issues/${issue.id}`} className="text-xs text-blue-600 hover:underline">Details</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Issue Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <p className="text-base font-semibold text-gray-800">Flag New Issue</p>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Module</label>
                <select
                  value={form.module}
                  onChange={e => setForm(f => ({ ...f, module: e.target.value }))}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2a4e78]"
                >
                  <option value="">Select module...</option>
                  {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Severity</label>
                <div className="flex gap-2 mt-1">
                  {SEVERITIES.map(s => (
                    <button
                      key={s}
                      onClick={() => setForm(f => ({ ...f, severity: s }))}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${form.severity === s ? "bg-[#2a4e78] text-white border-[#2a4e78]" : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300"}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Title</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Short issue title (max 100 chars)"
                  maxLength={100}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2a4e78]"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Detailed description of the issue..."
                  rows={3}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2a4e78] resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2 text-sm bg-[#2a4e78] text-white rounded-lg hover:bg-[#1a3c5e] transition-colors font-medium"
              >
                Submit Issue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
