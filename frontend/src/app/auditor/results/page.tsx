"use client"

import { useState } from "react"
import { AlertTriangle } from "lucide-react"

const STATUS_BADGE: Record<string, string> = {
  approved: "bg-green-100 text-green-700",
  submitted: "bg-blue-100 text-blue-700",
  pending_coordinator: "bg-amber-100 text-amber-700",
  pending_principal: "bg-orange-100 text-orange-700",
  draft: "bg-gray-100 text-gray-600",
  rejected: "bg-red-100 text-red-700",
}
const STATUS_LABEL: Record<string, string> = {
  approved: "Approved", submitted: "Submitted",
  pending_coordinator: "Pending Coord.", pending_principal: "Pending Principal",
  draft: "Draft", rejected: "Rejected",
}

const pipeline = [
  { stage: "Draft", count: 12 }, { stage: "Submitted", count: 28 },
  { stage: "Pending Coord.", count: 15 }, { stage: "Pending Principal", count: 8 },
  { stage: "Approved", count: 74 },
]

const mockResults = [
  { id: 1, student: "Ahmed Ali", grade: "Grade 6", subject: "Math", exam: "Mid-Term", marks: 78, max: 100, status: "approved", teacher: "Mr. Bilal", updated: "2026-04-10" },
  { id: 2, student: "Fatima Noor", grade: "Grade 5", subject: "English", exam: "Monthly", marks: 85, max: 100, status: "pending_coordinator", teacher: "Ms. Fatima", updated: "2026-04-05" },
  { id: 3, student: "Usman Tariq", grade: "Grade 4", subject: "Urdu", exam: "Monthly", marks: 62, max: 100, status: "submitted", teacher: "Mr. Asad", updated: "2026-04-09" },
  { id: 4, student: "Sara Khan", grade: "Grade 6", subject: "Science", exam: "Final", marks: 91, max: 100, status: "approved", teacher: "Mr. Bilal", updated: "2026-04-08" },
  { id: 5, student: "Hamza Raza", grade: "Grade 3", subject: "Math", exam: "Monthly", marks: 0, max: 100, status: "draft", teacher: "Ms. Hina", updated: "2026-04-07" },
  { id: 6, student: "Ayesha Malik", grade: "Grade 5", subject: "Islamiat", exam: "Mid-Term", marks: 74, max: 100, status: "pending_principal", teacher: "Mr. Kamran", updated: "2026-04-03" },
]

const anomalies = [
  { type: "Stuck at Coordinator", desc: "Grade 5 — English Mid-Term: pending coordinator for 5+ days", severity: "Medium" },
  { type: "Stuck at Principal", desc: "Grade 5 — Islamiat Mid-Term: pending principal for 7+ days", severity: "High" },
  { type: "Zero Marks Entry", desc: "Grade 3 — Math Monthly: marks entered as 0 (possible data error)", severity: "High" },
]

export default function AuditorResultsPage() {
  const [stageFilter, setStageFilter] = useState("All")

  const filtered = stageFilter === "All" ? mockResults : mockResults.filter(r => STATUS_LABEL[r.status] === stageFilter || r.status === stageFilter)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Results Audit</h1>
        <p className="text-sm text-gray-500 mt-0.5">Monitor exam result workflow and identify stuck approvals</p>
      </div>

      {/* Pipeline Funnel */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <p className="text-sm font-semibold text-gray-700 mb-4">Workflow Pipeline</p>
        <div className="flex flex-wrap gap-2">
          {pipeline.map((p, i) => (
            <button
              key={p.stage}
              onClick={() => setStageFilter(stageFilter === p.stage ? "All" : p.stage)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${stageFilter === p.stage ? "bg-[#2a4e78] text-white border-[#2a4e78]" : "bg-gray-50 text-gray-700 border-gray-200 hover:border-[#2a4e78]"}`}
            >
              <span>{p.stage}</span>
              <span className={`px-1.5 py-0.5 rounded text-xs ${stageFilter === p.stage ? "bg-white/20 text-white" : "bg-gray-200 text-gray-600"}`}>{p.count}</span>
              {i < pipeline.length - 1 && <span className="text-gray-400 ml-1">→</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">Results — {stageFilter === "All" ? "All Stages" : stageFilter}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                {["Student", "Grade", "Subject", "Exam", "Marks", "Status", "Teacher", "Updated"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-700">{r.student}</td>
                  <td className="px-4 py-3 text-gray-600">{r.grade}</td>
                  <td className="px-4 py-3 text-gray-600">{r.subject}</td>
                  <td className="px-4 py-3 text-gray-600">{r.exam}</td>
                  <td className="px-4 py-3">
                    <span className={r.marks === 0 ? "text-red-600 font-bold" : "text-gray-700"}>{r.marks} / {r.max}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.teacher}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{r.updated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Anomalies */}
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
