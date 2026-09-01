"use client"

import { useState } from "react"
import { CheckCheck, Bell, AlertTriangle, FileText, Info } from "lucide-react"

const TYPE_ICON: Record<string, React.ElementType> = {
  issue_resolved: AlertTriangle,
  issue_review: AlertTriangle,
  report_ack: FileText,
  system: Info,
}
const TYPE_COLOR: Record<string, string> = {
  issue_resolved: "text-green-600 bg-green-50",
  issue_review: "text-amber-600 bg-amber-50",
  report_ack: "text-blue-600 bg-blue-50",
  system: "text-gray-600 bg-gray-50",
}

const notifications = [
  { id: 1, type: "issue_resolved", message: "Issue #4 (Teacher absent without record) has been resolved by Principal.", time: "2026-04-10 11:00", read: false },
  { id: 2, type: "issue_review", message: "Issue #2 (Bank payment pending) is now Under Review by Super Admin.", time: "2026-04-10 09:00", read: false },
  { id: 3, type: "report_ack", message: "Your March 2026 Audit Report has been acknowledged by Org Admin.", time: "2026-04-02 14:30", read: true },
  { id: 4, type: "system", message: "System maintenance scheduled for 2026-04-15 02:00 AM.", time: "2026-04-08 08:00", read: true },
  { id: 5, type: "report_ack", message: "Your February 2026 Audit Report has been acknowledged.", time: "2026-03-05 10:15", read: true },
]

export default function AuditorNotificationsPage() {
  const [items, setItems] = useState(notifications)
  const [filter, setFilter] = useState("all")

  const markAllRead = () => setItems(prev => prev.map(n => ({ ...n, read: true })))
  const markRead = (id: number) => setItems(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))

  const filtered = filter === "unread" ? items.filter(n => !n.read) : filter === "read" ? items.filter(n => n.read) : items

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Notifications</h1>
          <p className="text-sm text-gray-500 mt-0.5">{items.filter(n => !n.read).length} unread notifications</p>
        </div>
        <button
          onClick={markAllRead}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <CheckCheck className="w-4 h-4" /> Mark all as read
        </button>
      </div>

      <div className="flex gap-2">
        {["all", "unread", "read"].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${filter === f ? "bg-[#2a4e78] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
            No notifications found.
          </div>
        )}
        {filtered.map(n => {
          const Icon = TYPE_ICON[n.type] || Bell
          return (
            <div
              key={n.id}
              onClick={() => markRead(n.id)}
              className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${n.read ? "bg-white border-gray-200" : "bg-blue-50/40 border-blue-200"}`}
            >
              <div className={`p-2 rounded-lg flex-shrink-0 ${TYPE_COLOR[n.type]}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <p className={`text-sm ${n.read ? "text-gray-600" : "text-gray-800 font-medium"}`}>{n.message}</p>
                <p className="text-xs text-gray-400 mt-1">{n.time}</p>
              </div>
              {!n.read && <div className="w-2 h-2 rounded-full bg-blue-500 mt-1 flex-shrink-0" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
