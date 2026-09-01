"use client"

import { useState } from "react"
import { AlertTriangle } from "lucide-react"

const CHALLAN_BADGE: Record<string, string> = {
  paid: "bg-green-100 text-green-700",
  unpaid: "bg-red-100 text-red-700",
  partial: "bg-amber-100 text-amber-700",
  issued: "bg-blue-100 text-blue-700",
}

const challans = [
  { id: 1, student: "Ahmed Ali", grade: "Grade 6", month: "April 2026", amount: 2500, status: "paid", generated: "2026-04-01", paid: "2026-04-05" },
  { id: 2, student: "Fatima Noor", grade: "Grade 5", month: "April 2026", amount: 2500, status: "unpaid", generated: "2026-04-01", paid: "—" },
  { id: 3, student: "Usman Tariq", grade: "Grade 4", month: "April 2026", amount: 2200, status: "partial", generated: "2026-04-01", paid: "2026-04-08" },
  { id: 4, student: "Sara Khan", grade: "Grade 6", month: "March 2026", amount: 2500, status: "paid", generated: "2026-03-01", paid: "2026-03-07" },
  { id: 5, student: "Hamza Raza", grade: "Grade 3", month: "April 2026", amount: 2000, status: "issued", generated: "2026-04-01", paid: "—" },
  { id: 6, student: "Ayesha Malik", grade: "Grade 5", month: "Feb 2026", amount: 2500, status: "unpaid", generated: "2026-02-01", paid: "—" },
]

const bankPayments = [
  { id: 1, student: "Usman Tariq", amount: 1200, bank: "HBL", submittedDate: "2026-04-02", status: "Pending", days: 8 },
  { id: 2, student: "Ali Hassan", amount: 2500, bank: "MCB", submittedDate: "2026-04-08", status: "Pending", days: 2 },
]

const outstanding = [
  { student: "Fatima Noor", grade: "Grade 5", months: 2, totalDue: 5000 },
  { student: "Ayesha Malik", grade: "Grade 5", months: 3, totalDue: 7500 },
  { student: "Bilal Ahmad", grade: "Grade 2", months: 1, totalDue: 1800 },
]

const anomalies = [
  { type: "Missing Challans", desc: "Grade 2-B has an active fee structure but no challans generated for April", severity: "Medium" },
  { type: "Pending Bank Verification", desc: "Usman Tariq bank payment pending for 8+ days", severity: "High" },
  { type: "Consecutive Dues", desc: "Ayesha Malik has unpaid challans for 3 consecutive months", severity: "High" },
]

export default function AuditorFeesPage() {
  const [activeTab, setActiveTab] = useState<"challans" | "bank" | "outstanding" | "structure">("challans")

  const totalBilled = challans.reduce((s, c) => s + c.amount, 0)
  const totalCollected = challans.filter(c => c.status === "paid").reduce((s, c) => s + c.amount, 0)
  const collectionRate = Math.round((totalCollected / totalBilled) * 100)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Fee & Finance Audit</h1>
        <p className="text-sm text-gray-500 mt-0.5">Read-only view of all financial activity for this campus</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase font-medium">Total Billed</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">Rs. {totalBilled.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-0.5">April 2026</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase font-medium">Collected</p>
          <p className="text-2xl font-bold text-green-600 mt-1">Rs. {totalCollected.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase font-medium">Collection Rate</p>
          <p className={`text-2xl font-bold mt-1 ${collectionRate >= 85 ? "text-green-600" : collectionRate >= 60 ? "text-amber-600" : "text-red-600"}`}>
            {collectionRate}%
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase font-medium">Pending Verifications</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{bankPayments.filter(b => b.status === "Pending").length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-200">
          {(["challans", "bank", "outstanding", "structure"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${activeTab === tab ? "border-[#2a4e78] text-[#2a4e78]" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              {tab === "bank" ? "Bank Payments" : tab === "outstanding" ? "Outstanding Dues" : tab === "structure" ? "Fee Structure" : "Challans"}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          {activeTab === "challans" && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  {["Student", "Grade", "Month", "Amount", "Status", "Generated", "Paid Date"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {challans.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-700">{c.student}</td>
                    <td className="px-4 py-3 text-gray-600">{c.grade}</td>
                    <td className="px-4 py-3 text-gray-600">{c.month}</td>
                    <td className="px-4 py-3 text-gray-700">Rs. {c.amount.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CHALLAN_BADGE[c.status]}`}>{c.status}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{c.generated}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{c.paid}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === "bank" && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  {["Student", "Amount", "Bank", "Submitted", "Status", "Days Pending"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bankPayments.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-700">{b.student}</td>
                    <td className="px-4 py-3 text-gray-700">Rs. {b.amount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-600">{b.bank}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{b.submittedDate}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">{b.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={b.days > 7 ? "text-red-600 font-semibold" : "text-gray-600"}>{b.days} days</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === "outstanding" && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  {["Student", "Grade", "Months Overdue", "Total Due"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {outstanding.map((o, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-700">{o.student}</td>
                    <td className="px-4 py-3 text-gray-600">{o.grade}</td>
                    <td className="px-4 py-3">
                      <span className={o.months >= 3 ? "text-red-600 font-semibold" : "text-amber-600"}>{o.months} month{o.months > 1 ? "s" : ""}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-700">Rs. {o.totalDue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === "structure" && (
            <div className="p-6 text-sm text-gray-500 italic">Fee structure view coming soon. Read-only display of defined fee types.</div>
          )}
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
