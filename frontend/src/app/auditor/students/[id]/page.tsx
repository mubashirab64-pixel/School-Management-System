"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

const TABS = ["Personal Info", "Family Info", "Academic", "Fee History", "Transfer History"]

export default function AuditorStudentDetailPage() {
  const [tab, setTab] = useState("Personal Info")

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/auditor/students" className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Ahmed Ali</h1>
          <p className="text-sm text-gray-500">Roll No. 2024-001 · Grade 6-A</p>
        </div>
        <span className="ml-auto px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">Active</span>
      </div>

      {/* Tabs */}
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
          {tab === "Personal Info" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              {[
                { label: "Full Name", value: "Ahmed Ali" },
                { label: "Date of Birth", value: "15 March 2014" },
                { label: "Gender", value: "Male" },
                { label: "Religion", value: "Islam" },
                { label: "Roll Number", value: "2024-001" },
                { label: "CNIC / B-Form", value: "42201-1234567-1" },
                { label: "Address", value: "House 12, Street 4, Karachi" },
                { label: "Enrollment Date", value: "15 March 2024" },
              ].map(f => (
                <div key={f.label}>
                  <p className="text-xs text-gray-400 uppercase font-medium">{f.label}</p>
                  <p className="text-sm text-gray-700 mt-0.5 font-medium">{f.value}</p>
                </div>
              ))}
            </div>
          )}

          {tab === "Family Info" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              {[
                { label: "Father's Name", value: "Muhammad Ali" },
                { label: "Father's CNIC", value: "42201-9876543-1" },
                { label: "Father's Phone", value: "+92 321 1234567" },
                { label: "Father's Occupation", value: "Business" },
                { label: "Mother's Name", value: "Nazia Ali" },
                { label: "Guardian (if different)", value: "—" },
              ].map(f => (
                <div key={f.label}>
                  <p className="text-xs text-gray-400 uppercase font-medium">{f.label}</p>
                  <p className="text-sm text-gray-700 mt-0.5 font-medium">{f.value}</p>
                </div>
              ))}
            </div>
          )}

          {tab === "Academic" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-gray-500">Current Grade</p>
                  <p className="text-lg font-bold text-gray-800 mt-1">Grade 6</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-gray-500">Attendance %</p>
                  <p className="text-lg font-bold text-green-600 mt-1">91.2%</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-gray-500">Last Exam Avg</p>
                  <p className="text-lg font-bold text-blue-600 mt-1">78%</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 italic">Read-only view. Contact coordinator for detailed results.</p>
            </div>
          )}

          {tab === "Fee History" && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    {["Month", "Amount", "Status", "Paid Date"].map(h => (
                      <th key={h} className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    { month: "April 2026", amount: "Rs. 2,500", status: "Paid", paid: "2026-04-05" },
                    { month: "March 2026", amount: "Rs. 2,500", status: "Paid", paid: "2026-03-07" },
                    { month: "Feb 2026", amount: "Rs. 2,500", status: "Paid", paid: "2026-02-10" },
                  ].map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">{r.month}</td>
                      <td className="px-4 py-3 text-gray-700">{r.amount}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">{r.status}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{r.paid}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "Transfer History" && (
            <p className="text-sm text-gray-500 italic">No transfer records found for this student.</p>
          )}
        </div>
      </div>
    </div>
  )
}
