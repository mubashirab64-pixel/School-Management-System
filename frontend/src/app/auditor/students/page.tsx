"use client"

import { useState } from "react"
import Link from "next/link"
import { Search } from "lucide-react"

const FEE_BADGE: Record<string, string> = {
  Paid: "bg-green-100 text-green-700",
  Unpaid: "bg-red-100 text-red-700",
  Partial: "bg-amber-100 text-amber-700",
}

const students = [
  { id: 1, name: "Ahmed Ali", roll: "2024-001", grade: "Grade 6", classroom: "6-A", gender: "Male", feeStatus: "Paid", enrolled: "2024-03-15", active: true },
  { id: 2, name: "Fatima Noor", roll: "2024-002", grade: "Grade 5", classroom: "5-B", gender: "Female", feeStatus: "Unpaid", enrolled: "2024-03-15", active: true },
  { id: 3, name: "Usman Tariq", roll: "2024-003", grade: "Grade 4", classroom: "4-A", gender: "Male", feeStatus: "Partial", enrolled: "2024-04-01", active: true },
  { id: 4, name: "Sara Khan", roll: "2023-045", grade: "Grade 6", classroom: "6-B", gender: "Female", feeStatus: "Paid", enrolled: "2023-03-10", active: true },
  { id: 5, name: "Hamza Raza", roll: "2024-012", grade: "Grade 3", classroom: "3-A", gender: "Male", feeStatus: "Paid", enrolled: "2024-03-20", active: true },
  { id: 6, name: "Ayesha Malik", roll: "2022-089", grade: "Grade 5", classroom: "5-A", gender: "Female", feeStatus: "Unpaid", enrolled: "2022-03-12", active: false },
  { id: 7, name: "Bilal Ahmad", roll: "2024-019", grade: "Grade 2", classroom: "2-B", gender: "Male", feeStatus: "Paid", enrolled: "2024-03-15", active: true },
]

export default function AuditorStudentsPage() {
  const [search, setSearch] = useState("")
  const [gradeFilter, setGradeFilter] = useState("All")

  const grades = ["All", ...Array.from(new Set(students.map(s => s.grade)))]
  const filtered = students.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.roll.includes(search)
    const matchGrade = gradeFilter === "All" || s.grade === gradeFilter
    return matchSearch && matchGrade
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Student Records</h1>
        <p className="text-sm text-gray-500 mt-0.5">Read-only view of all students on this campus</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or roll no."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#2a4e78]"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {grades.map(g => (
            <button
              key={g}
              onClick={() => setGradeFilter(g)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${gradeFilter === g ? "bg-[#2a4e78] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">Students ({filtered.length})</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                {["Name", "Roll No.", "Grade", "Class", "Gender", "Fee Status", "Enrolled", ""].map(h => (
                  <th key={h} className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#2a4e78] text-white text-xs flex items-center justify-center font-semibold flex-shrink-0">
                        {s.name.charAt(0)}
                      </div>
                      <span className="font-medium text-gray-700">{s.name}</span>
                      {!s.active && <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">Inactive</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{s.roll}</td>
                  <td className="px-4 py-3 text-gray-600">{s.grade}</td>
                  <td className="px-4 py-3 text-gray-600">{s.classroom}</td>
                  <td className="px-4 py-3 text-gray-600">{s.gender}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${FEE_BADGE[s.feeStatus]}`}>{s.feeStatus}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{s.enrolled}</td>
                  <td className="px-4 py-3">
                    <Link href={`/auditor/students/${s.id}`} className="text-xs text-blue-600 hover:underline">View</Link>
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
