"use client"

import { useEffect, useState } from "react"
import { Megaphone } from "lucide-react"
import { getAnnouncements } from "@/lib/api"

const timeAgo = (ts?: string) => {
  if (!ts) return ""
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
  if (Number.isNaN(m)) return ""
  if (m < 1) return "Just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

/** Read-only announcements feed for coordinator / teacher / other roles. */
export function AnnouncementsCard({ className = "", limit = 5 }: { className?: string; limit?: number }) {
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    getAnnouncements()
      .then((a) => {
        if (mounted) setAnnouncements(Array.isArray(a) ? a : [])
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 ${className}`}>
      <h3 className="flex items-center gap-2 font-bold text-[#274c77] mb-4">
        <Megaphone className="h-5 w-5 text-[#8B5CF6]" /> Announcements
      </h3>
      {loading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : announcements.length === 0 ? (
        <div className="py-8 text-center">
          <Megaphone className="h-8 w-8 mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">No announcements yet.</p>
          <p className="text-xs text-gray-400 mt-1">New announcements will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {announcements.slice(0, limit).map((a, i) => {
            const pr = String(a.priority || "normal")
            const prStyle = pr === "urgent"
              ? { bg: "bg-rose-50", text: "text-rose-700" }
              : pr === "important"
                ? { bg: "bg-amber-50", text: "text-amber-700" }
                : { bg: "bg-[#6096ba]/10", text: "text-[#274c77]" }
            return (
              <div key={a.id ?? i} className="rounded-xl border border-gray-100 px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-800 truncate">{a.title}</p>
                  <span className={`flex-shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${prStyle.bg} ${prStyle.text}`}>{pr}</span>
                </div>
                {a.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.body}</p>}
                <p className="text-[11px] text-gray-400 mt-1">
                  {a.campus_name ? `${a.campus_name} · ` : "Organization-wide · "}
                  {a.created_by_name ? `${a.created_by_name} · ` : ""}
                  {timeAgo(a.created_at)}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
