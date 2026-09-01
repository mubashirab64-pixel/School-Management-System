"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

const TABS = ["Profile", "Classes Assigned", "Attendance Record", "Requests Submitted"]

export default function AuditorStaffDetailPage() {
  const [tab, setTab] = useState("Profile")

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/auditor/staff" className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Ms. Fatima</h1>
          <p className="text-sm text-gray-500">Teacher · Grade 5-A, 5-B</p>
        </div>
        <span className="ml-auto px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">Active</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${tab === t ? "border-[#2a4e78] text-[#2a4e78]" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === "Profile" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              {[
                { label: "Full Name", value: "Fatima Hussain" },
                { label: "Role", value: "Teacher" },
                { label: "Email", value: "fatima@iaksms.edu.pk" },
                { label: "Phone", value: "+92 333 9876543" },
                { label: "Qualification", value: "M.Ed, B.Ed" },
                { label: "Joining Date", value: "01 August 2022" },
                { label: "CNIC", value: "42201-1122334-4" },
              ].map(f => (
                <div key={f.label}>
                  <p className="text-xs text-gray-400 uppercase font-medium">{f.label}</p>
                  <p className="text-sm text-gray-700 mt-0.5 font-medium">{f.value}</p>
                </div>
              ))}
            </div>
          )}
          {tab === "Classes Assigned" && (
            <ul className="space-y-2 text-sm text-gray-700">
              {["Grade 5-A — Class Teacher", "Grade 5-B — Subject Teacher (English)"].map((c, i) => (
                <li key={i} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <span className="w-2 h-2 rounded-full bg-[#2a4e78] flex-shrink-0" />
                  {c}
                </li>
              ))}
            </ul>
          )}
          {tab === "Attendance Record" && (
            <p className="text-sm text-gray-500 italic">Staff attendance records — mock data not loaded.</p>
          )}
          {tab === "Requests Submitted" && (
            <p className="text-sm text-gray-500 italic">No requests/complaints found.</p>
          )}
        </div>
      </div>
    </div>
  )
}
