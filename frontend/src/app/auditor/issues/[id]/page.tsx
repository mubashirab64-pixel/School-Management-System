"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"

const timeline = [
  { status: "Open", actor: "Auditor (You)", time: "2026-04-09 10:30", note: "Bank payment stuck for 8+ days with no action." },
  { status: "Under Review", actor: "Super Admin Khalid", time: "2026-04-10 09:00", note: "Investigating with accounts team." },
]


export default function AuditorIssueDetailPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/auditor/issues" className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Issue #2</h1>
          <p className="text-sm text-gray-500">Bank payment pending for 8+ days</p>
        </div>
        <span className="ml-auto px-3 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">Under Review</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Issue Details */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Module", value: "Fees" },
              { label: "Severity", value: "Medium" },
              { label: "Date Flagged", value: "2026-04-09" },
              { label: "Linked Record", value: "Payment #PY-2024" },
            ].map(f => (
              <div key={f.label}>
                <p className="text-xs text-gray-400 uppercase font-medium">{f.label}</p>
                <p className="text-sm text-gray-700 font-medium mt-0.5">{f.value}</p>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase font-medium">Description</p>
            <p className="text-sm text-gray-600 mt-1">
              Bank payment submitted by Usman Tariq (Rs. 1,200) on 2026-04-02 via HBL has been pending verification
              for 8+ days. No action taken by accounts team. This exceeds the standard 5-day SLA for bank payment verification.
            </p>
          </div>
        </div>

        {/* Audit Timeline */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">Audit Timeline</p>
          <ol className="relative border-l border-gray-200 ml-2 space-y-5">
            {timeline.map((t, i) => (
              <li key={i} className="ml-4">
                <div className="absolute -left-1.5 w-3 h-3 rounded-full bg-[#2a4e78] border-2 border-white" />
                <span className="text-xs font-semibold text-[#2a4e78]">{t.status}</span>
                <p className="text-xs text-gray-500 mt-0.5">{t.actor} · {t.time}</p>
                {t.note && <p className="text-xs text-gray-600 italic mt-1">"{t.note}"</p>}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}
