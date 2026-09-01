"use client"

import { useState } from "react"

const STATUS_BADGE: Record<string, string> = {
  approved: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  declined: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
}
const TYPE_BADGE: Record<string, string> = {
  Campus: "bg-purple-100 text-purple-700",
  Class: "bg-blue-100 text-blue-700",
  Shift: "bg-teal-100 text-teal-700",
  "Grade-Skip": "bg-orange-100 text-orange-700",
}

const transfers = [
  { id: 1, student: "Ahmed Ali", type: "Class", from: "Grade 5-A", to: "Grade 5-B", requestedBy: "Principal", status: "approved", updated: "2026-04-07" },
  { id: 2, student: "Sara Khan", type: "Campus", from: "Campus A", to: "Campus B", requestedBy: "Org Admin", status: "pending", updated: "2026-04-09" },
  { id: 3, student: "Usman Tariq", type: "Grade-Skip", from: "Grade 4", to: "Grade 6", requestedBy: "Coordinator Ali", status: "pending", updated: "2026-04-08" },
  { id: 4, student: "Hamza Raza", type: "Shift", from: "Morning", to: "Evening", requestedBy: "Principal", status: "declined", updated: "2026-04-05" },
  { id: 5, student: "Bilal Ahmad", type: "Class", from: "Grade 2-A", to: "Grade 2-B", requestedBy: "Coordinator Ali", status: "approved", updated: "2026-04-02" },
]

const approvalChain = [
  { step: "Requested", actor: "Coordinator Ali", time: "2026-04-09 09:15", comment: "Student moving to sister campus", done: true },
  { step: "From Coordinator Approved", actor: "Coordinator Ali", time: "2026-04-09 10:00", comment: "", done: true },
  { step: "From Principal Approved", actor: "Principal Dr. Shah", time: "—", comment: "", done: false },
  { step: "To Coordinator Approved", actor: "—", time: "—", comment: "", done: false },
  { step: "Final Approval", actor: "—", time: "—", comment: "", done: false },
]

export default function AuditorTransfersPage() {
  const [selected, setSelected] = useState<number | null>(null)
  const [typeFilter, setTypeFilter] = useState("All")
  const types = ["All", "Campus", "Class", "Shift", "Grade-Skip"]

  const filtered = typeFilter === "All" ? transfers : transfers.filter(t => t.type === typeFilter)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Transfer History</h1>
        <p className="text-sm text-gray-500 mt-0.5">View all campus, class, shift, and grade-skip transfer records</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-wrap gap-3 items-center">
        {types.map(t => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${typeFilter === t ? "bg-[#2a4e78] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Transfers Table */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  {["Student", "Type", "From", "To", "Requested By", "Status", "Updated"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(t => (
                  <tr
                    key={t.id}
                    onClick={() => setSelected(selected === t.id ? null : t.id)}
                    className={`cursor-pointer transition-colors ${selected === t.id ? "bg-blue-50" : "hover:bg-gray-50"}`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-700">{t.student}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE[t.type]}`}>{t.type}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{t.from}</td>
                    <td className="px-4 py-3 text-gray-600">{t.to}</td>
                    <td className="px-4 py-3 text-gray-600">{t.requestedBy}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[t.status]}`}>{t.status}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{t.updated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Approval Chain Panel */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">
            {selected ? "Approval Chain" : "Select a transfer to view approval chain"}
          </p>
          {selected && (
            <ol className="relative border-l border-gray-200 ml-2 space-y-4">
              {approvalChain.map((step, i) => (
                <li key={i} className="ml-4">
                  <div className={`absolute -left-1.5 w-3 h-3 rounded-full border-2 ${step.done ? "bg-green-500 border-green-500" : "bg-white border-gray-300"}`} />
                  <p className={`text-xs font-semibold ${step.done ? "text-green-700" : "text-gray-400"}`}>{step.step}</p>
                  {step.actor !== "—" && <p className="text-xs text-gray-600 mt-0.5">{step.actor}</p>}
                  {step.time !== "—" && <p className="text-xs text-gray-400">{step.time}</p>}
                  {step.comment && <p className="text-xs text-gray-500 italic mt-0.5">"{step.comment}"</p>}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}
