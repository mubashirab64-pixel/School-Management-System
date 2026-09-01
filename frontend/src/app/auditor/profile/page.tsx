"use client"

import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"

export default function AuditorProfilePage() {
  const [showPass, setShowPass] = useState(false)

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-gray-800">My Profile</h1>
        <p className="text-sm text-gray-500 mt-0.5">View your profile information and manage password</p>
      </div>

      {/* Profile Info */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
          <div className="w-14 h-14 rounded-full bg-[#2a4e78] text-white text-xl font-bold flex items-center justify-center">
            A
          </div>
          <div>
            <p className="text-base font-semibold text-gray-800">Auditor Name</p>
            <p className="text-sm text-gray-500">Compliance Officer</p>
          </div>
          <span className="ml-auto px-3 py-1 bg-[#2a4e78]/10 text-[#2a4e78] text-xs font-semibold rounded-full">
            compliance_officer
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          {[
            { label: "Email", value: "auditor@iaksms.edu.pk" },
            { label: "Phone", value: "+92 300 0000000" },
            { label: "Assigned Campus", value: "Campus A (Read-only)" },
            { label: "Last Login", value: "2026-04-14 08:30 AM" },
          ].map(f => (
            <div key={f.label}>
              <p className="text-xs text-gray-400 uppercase font-medium">{f.label}</p>
              <p className={`text-sm text-gray-700 font-medium mt-0.5 ${f.label === "Assigned Campus" ? "italic text-gray-500" : ""}`}>{f.value}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 italic">Campus assignment can only be changed by Super Admin.</p>
      </div>

      {/* Audit Activity Summary */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <p className="text-sm font-semibold text-gray-700 mb-4">Audit Activity Summary</p>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Reports Submitted", value: 3 },
            { label: "Issues Flagged", value: 5 },
            { label: "Issues Resolved", value: 1 },
          ].map(s => (
            <div key={s.label} className="text-center p-4 bg-gray-50 rounded-xl">
              <p className="text-2xl font-bold text-[#2a4e78]">{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        <p className="text-sm font-semibold text-gray-700">Change Password</p>
        <div className="space-y-3">
          {["Current Password", "New Password", "Confirm New Password"].map(label => (
            <div key={label}>
              <label className="text-xs font-semibold text-gray-500 uppercase">{label}</label>
              <div className="relative mt-1">
                <input
                  type={showPass ? "text" : "password"}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2a4e78] pr-10"
                />
                <button
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
        <button className="px-4 py-2 bg-[#2a4e78] text-white rounded-lg text-sm font-medium hover:bg-[#1a3c5e] transition-colors">
          Update Password
        </button>
      </div>
    </div>
  )
}
