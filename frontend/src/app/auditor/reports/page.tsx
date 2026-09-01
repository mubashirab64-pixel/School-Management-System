"use client"

import { useState } from "react"
import { Download, Send, Save } from "lucide-react"

const SECTIONS = [
  "Attendance Summary",
  "Results Summary",
  "Fee Collection",
  "Open Issues",
  "Transfer Activity",
  "Staff Overview",
]

const pastReports = [
  { id: 1, title: "Monthly Audit Report — March 2026", period: "Mar 2026", status: "Submitted", date: "2026-04-01" },
  { id: 2, title: "Monthly Audit Report — Feb 2026", period: "Feb 2026", status: "Submitted", date: "2026-03-02" },
  { id: 3, title: "Q1 Audit Summary 2026", period: "Jan–Mar 2026", status: "Draft", date: "2026-04-05" },
]

export default function AuditorReportsPage() {
  const [title, setTitle] = useState("")
  const [overallStatus, setOverallStatus] = useState("All Good")
  const [notes, setNotes] = useState("")
  const [recommendations, setRecommendations] = useState("")
  const [selectedSections, setSelectedSections] = useState<string[]>(SECTIONS.slice(0, 4))

  const toggleSection = (s: string) =>
    setSelectedSections(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Audit Report Generator</h1>
        <p className="text-sm text-gray-500 mt-0.5">Generate and submit formal audit reports to Super Admin / Org Admin</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Report Builder Form */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
          <p className="text-sm font-semibold text-gray-700">Report Builder</p>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Report Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Monthly Audit Report — April 2026"
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2a4e78]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Period From</label>
              <input type="date" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2a4e78]" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Period To</label>
              <input type="date" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2a4e78]" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Campus</label>
            <input value="Campus A (Assigned)" readOnly className="mt-1 w-full border border-gray-100 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500 cursor-not-allowed" />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">Sections to Include</label>
            <div className="flex flex-wrap gap-2">
              {SECTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => toggleSection(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${selectedSections.includes(s) ? "bg-[#2a4e78] text-white border-[#2a4e78]" : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Overall Status</label>
            <div className="flex gap-2 mt-1">
              {["All Good", "Minor Issues", "Critical Issues"].map(s => (
                <button
                  key={s}
                  onClick={() => setOverallStatus(s)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${overallStatus === s
                    ? s === "All Good" ? "bg-green-600 text-white border-green-600"
                      : s === "Minor Issues" ? "bg-amber-500 text-white border-amber-500"
                        : "bg-red-600 text-white border-red-600"
                    : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Auditor Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Summary narrative of this audit period..."
              rows={3}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2a4e78] resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Recommendations</label>
            <textarea
              value={recommendations}
              onChange={e => setRecommendations(e.target.value)}
              placeholder="Suggested actions for admins..."
              rows={2}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2a4e78] resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              <Save className="w-4 h-4" /> Save Draft
            </button>
            <button className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              <Download className="w-4 h-4" /> Generate PDF
            </button>
            <button className="flex items-center gap-1.5 px-4 py-2 bg-[#2a4e78] text-white rounded-lg text-sm font-medium hover:bg-[#1a3c5e] transition-colors ml-auto">
              <Send className="w-4 h-4" /> Submit to Admin
            </button>
          </div>
        </div>

        {/* Report Preview */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <p className="text-sm font-semibold text-gray-700 mb-4">Preview</p>
          <div className="border border-gray-200 rounded-lg p-5 space-y-4 text-sm">
            <div className="border-b border-gray-200 pb-3">
              <p className="text-lg font-bold text-[#2a4e78]">{title || "Report Title"}</p>
              <p className="text-xs text-gray-400 mt-0.5">Campus A · Auditor Portal · Newton AMS</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Overall Status:</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${overallStatus === "All Good" ? "bg-green-100 text-green-700" : overallStatus === "Minor Issues" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                {overallStatus}
              </span>
            </div>
            {selectedSections.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Sections</p>
                <ul className="mt-1 space-y-1">
                  {selectedSections.map(s => <li key={s} className="text-xs text-gray-600">• {s}</li>)}
                </ul>
              </div>
            )}
            {notes && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Auditor Notes</p>
                <p className="text-xs text-gray-600 mt-1">{notes}</p>
              </div>
            )}
            {recommendations && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Recommendations</p>
                <p className="text-xs text-gray-600 mt-1">{recommendations}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Past Reports */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">Past Reports</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                {["Title", "Period", "Status", "Date", ""].map(h => (
                  <th key={h} className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pastReports.map(r => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-700 font-medium">{r.title}</td>
                  <td className="px-4 py-3 text-gray-600">{r.period}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.status === "Submitted" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{r.date}</td>
                  <td className="px-4 py-3">
                    <button className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                      <Download className="w-3 h-3" /> Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
