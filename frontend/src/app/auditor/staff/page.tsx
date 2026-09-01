"use client"

import Link from "next/link"
import { Search } from "lucide-react"
import { useState } from "react"

const staff = [
  { id: 1, name: "Ms. Fatima", role: "Teacher", assigned: "Grade 5-A, 5-B", joined: "2022-08-01", active: true },
  { id: 2, name: "Mr. Asad", role: "Teacher", assigned: "Grade 3-B", joined: "2021-03-15", active: true },
  { id: 3, name: "Mr. Bilal", role: "Teacher", assigned: "Grade 6-A, 6-B", joined: "2020-09-01", active: true },
  { id: 4, name: "Coordinator Ali", role: "Coordinator", assigned: "Grades 4-6", joined: "2019-01-10", active: true },
  { id: 5, name: "Principal Dr. Shah", role: "Principal", assigned: "All Campus", joined: "2018-03-01", active: true },
  { id: 6, name: "Ms. Hina", role: "Teacher", assigned: "Grade 1-A", joined: "2023-04-01", active: true },
  { id: 7, name: "Mr. Tariq", role: "Teacher", assigned: "Grade 5-B", joined: "2022-01-05", active: false },
]

const ROLE_BADGE: Record<string, string> = {
  Teacher: "bg-blue-100 text-blue-700",
  Coordinator: "bg-purple-100 text-purple-700",
  Principal: "bg-[#2a4e78]/10 text-[#2a4e78]",
}

export default function AuditorStaffPage() {
  const [search, setSearch] = useState("")
  const filtered = staff.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.role.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Staff Records</h1>
        <p className="text-sm text-gray-500 mt-0.5">Read-only view of all staff on this campus</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or role"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#2a4e78]"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                {["Name", "Role", "Assigned Classes", "Joining Date", "Status", ""].map(h => (
                  <th key={h} className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#2a4e78] text-white text-xs flex items-center justify-center font-semibold">
                        {s.name.replace("Ms. ", "").replace("Mr. ", "").replace("Dr. ", "").charAt(0)}
                      </div>
                      <span className="font-medium text-gray-700">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[s.role] || "bg-gray-100 text-gray-600"}`}>{s.role}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{s.assigned}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{s.joined}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {s.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/auditor/staff/${s.id}`} className="text-xs text-blue-600 hover:underline">View</Link>
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
