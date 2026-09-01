"use client"

import { useCallback, useMemo, useState, useEffect } from "react"
import {
  Bell, Check, CheckCheck, RefreshCw,
  Inbox, WifiOff, Search, Trash2, XCircle, FileX, Wifi,
  KeyRound, Download, GraduationCap, FileText, CalendarDays, ArrowRightLeft, UserCog,
  Plus, X, Megaphone,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { useWebSocketNotifications } from "@/hooks/useWebSocketNotifications"
import { NotificationSoundToggle } from "@/components/admin/notification-sound-toggle"
import type { Notification, DeleteLog } from "@/types/notification"
import { getDeleteLogs, apiGet, apiPost, createAnnouncement } from "@/lib/api"
import { toast } from "sonner"
import { getCurrentUserRole } from "@/lib/permissions"
import { AnnouncementsCard } from "@/components/dashboard/announcements-card"

function formatRelative(timestamp: string) {
  try { return formatDistanceToNow(new Date(timestamp), { addSuffix: true }) }
  catch { return "Just now" }
}

// Friendly, human-readable titles for known notification verbs. Anything not
// listed falls back to a humanized version of the raw verb (snake_case → Title Case).
const VERB_LABELS: Record<string, string> = {
  // Enrollment status workflow
  enrollment_status_requested: "Status Change Requested",
  enrollment_status_approved: "Status Change Approved",
  enrollment_status_rejected: "Status Change Rejected",
  // Results
  result_submitted: "Result Submitted",
  retest_result_submitted: "Retest Result Submitted",
  result_approved: "Result Approved",
  result_rejected: "Result Rejected",
  result_edit_requested: "Result Edit Requested",
  result_edit_approved: "Result Edit Approved",
  result_edit_rejected: "Result Edit Rejected",
  // Announcements
  announcement: "Announcement",
}

function formatVerb(verb = "") {
  if (VERB_LABELS[verb]) return VERB_LABELS[verb]
  // Fallback: snake_case / kebab-case → "Title Case"
  return verb
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase()) || "Notification"
}

// Type-based icon + color for a notification, derived from its verb/text
function getNotifStyle(verb = "") {
  const v = verb.toLowerCase()
  if (v.includes("password"))
    return { Icon: KeyRound, bg: "bg-purple-100", text: "text-purple-600", activeBg: "bg-purple-600" }
  if (v.includes("update") || v.includes("build") || v.includes("version") || v.includes("system"))
    return { Icon: Download, bg: "bg-sky-100", text: "text-sky-600", activeBg: "bg-sky-600" }
  if (v.includes("student") || v.includes("admission") || v.includes("enroll"))
    return { Icon: GraduationCap, bg: "bg-indigo-100", text: "text-indigo-600", activeBg: "bg-indigo-600" }
  if (v.includes("result") || v.includes("marksheet") || v.includes("exam"))
    return { Icon: FileText, bg: "bg-emerald-100", text: "text-emerald-600", activeBg: "bg-emerald-600" }
  if (v.includes("attendance"))
    return { Icon: CalendarDays, bg: "bg-orange-100", text: "text-orange-600", activeBg: "bg-orange-500" }
  if (v.includes("transfer"))
    return { Icon: ArrowRightLeft, bg: "bg-cyan-100", text: "text-cyan-600", activeBg: "bg-cyan-600" }
  if (v.includes("teacher") || v.includes("staff") || v.includes("account"))
    return { Icon: UserCog, bg: "bg-amber-100", text: "text-amber-600", activeBg: "bg-amber-500" }
  return { Icon: Bell, bg: "bg-[#2a4e78]/10", text: "text-[#2a4e78]", activeBg: "bg-[#2a4e78]" }
}

// Group notifications into Today / Yesterday / This Week / Earlier (order preserved within buckets)
function groupByDate(items: Notification[]) {
  const buckets: Record<string, Notification[]> = { Today: [], Yesterday: [], "This Week": [], Earlier: [] }
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday); startOfYesterday.setDate(startOfYesterday.getDate() - 1)
  const startOfWeek = new Date(startOfToday); startOfWeek.setDate(startOfWeek.getDate() - 7)
  for (const n of items) {
    const t = new Date(n.timestamp)
    if (t >= startOfToday) buckets.Today.push(n)
    else if (t >= startOfYesterday) buckets.Yesterday.push(n)
    else if (t >= startOfWeek) buckets["This Week"].push(n)
    else buckets.Earlier.push(n)
  }
  return (["Today", "Yesterday", "This Week", "Earlier"] as const)
    .filter(label => buckets[label].length > 0)
    .map(label => ({ label, items: buckets[label] }))
}

function ActionBadge({ action }: { action: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    delete:          { cls: "bg-red-100 text-red-600",       label: "Delete" },
    restore:         { cls: "bg-green-100 text-green-600",   label: "Restore" },
    create:          { cls: "bg-blue-100 text-blue-600",     label: "Create" },
    update:          { cls: "bg-yellow-100 text-yellow-700", label: "Update" },
    mark:            { cls: "bg-sky-100 text-sky-700",       label: "Mark Attendance" },
    approve:         { cls: "bg-green-100 text-green-700",   label: "Approve" },
    submit:          { cls: "bg-amber-100 text-amber-700",   label: "Submit" },
    reopen:          { cls: "bg-orange-100 text-orange-700", label: "Reopen" },
    finalize:        { cls: "bg-emerald-100 text-emerald-700", label: "Finalize" },
    password_change: { cls: "bg-purple-100 text-purple-700", label: "Password Changed" },
    status_change:   { cls: "bg-orange-100 text-orange-700", label: "Status Changed" },
  }
  const { cls, label } = map[action] || { cls: "bg-gray-100 text-gray-500", label: action }
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase ${cls}`}>
      {label}
    </span>
  )
}

const FEATURE_OPTIONS = [
  { value: "", label: "All Features" },
  { value: "student", label: "Student" },
  { value: "teacher", label: "Teacher" },
  { value: "result", label: "Result" },
  { value: "attendance", label: "Attendance" },
  { value: "coordinator", label: "Coordinator" },
  { value: "principal", label: "Principal" },
  { value: "classroom", label: "Classroom" },
  { value: "campus", label: "Campus" },
  { value: "grade", label: "Grade" },
  { value: "level", label: "Level" },
  { value: "user", label: "User" },
  { value: "transfer", label: "Transfer" },
]

export default function NotificationsPage() {
  const { notifications, unreadCount, isConnected, markAsRead, markAllAsRead, refetch, removeNotificationsLocal } =
    useWebSocketNotifications()

  const role = getCurrentUserRole()
  const canViewDeleteLogs = role === "superadmin" || role === "org_admin" || role === "admin" || role === "principal"
  const canRestore = role === "superadmin" || role === "org_admin" || role === "admin"
  // Only org admin (and superadmin) may publish announcements.
  const canCreateAnnouncement = role === "org_admin" || role === "superadmin"

  // ── Create-announcement state ──
  const [showAnnForm, setShowAnnForm]   = useState(false)
  const [annSubmitting, setAnnSubmitting] = useState(false)
  const [annKey, setAnnKey]             = useState(0)  // bump to re-fetch AnnouncementsCard
  const [annForm, setAnnForm]           = useState({ title: "", body: "", priority: "normal", audience: "all" })

  const submitAnnouncement = async () => {
    if (!annForm.title.trim()) { toast.error("Title is required"); return }
    setAnnSubmitting(true)
    try {
      await createAnnouncement({
        title: annForm.title.trim(),
        body: annForm.body.trim() || undefined,
        priority: annForm.priority,
        audience: annForm.audience,
      })
      toast.success("Announcement published")
      setAnnForm({ title: "", body: "", priority: "normal", audience: "all" })
      setShowAnnForm(false)
      setAnnKey(k => k + 1)
    } catch {
      toast.error("Failed to publish announcement")
    } finally {
      setAnnSubmitting(false)
    }
  }

  // ── Notifications tab state ──
  const [query, setQuery]             = useState("")
  const [view, setView]               = useState<"unread" | "all">("unread")
  const [tab, setTab]                 = useState<"notifications" | "announcements" | "deletelogs">("notifications")
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [deletingIds, setDeletingIds] = useState<number[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)

  // ── Delete Logs tab state ──
  const [deleteLogs, setDeleteLogs]                 = useState<DeleteLog[]>([])
  const [deleteLogsLoading, setDeleteLogsLoading]   = useState(false)
  const [deleteLogsLastSeen, setDeleteLogsLastSeen] = useState<string | null>(null)

  // filters
  const [deleteLogsAction, setDeleteLogsAction]         = useState("")
  const [deleteLogsFeature, setDeleteLogsFeature]       = useState("")
  const [deleteLogsSearch, setDeleteLogsSearch]         = useState("")
  const [deleteLogsStartDate, setDeleteLogsStartDate]   = useState("")
  const [deleteLogsEndDate, setDeleteLogsEndDate]       = useState("")

  // pagination
  const [deleteLogsPage, setDeleteLogsPage]         = useState(1)
  const [deleteLogsNumPages, setDeleteLogsNumPages] = useState(1)
  const [deleteLogsTotal, setDeleteLogsTotal]       = useState(0)

  // restore
  const [confirmRestoreId, setConfirmRestoreId]   = useState<number | null>(null)
  const [restoringId, setRestoringId]             = useState<number | null>(null)
  const [restoreMsg, setRestoreMsg]               = useState<{ ok: boolean; text: string } | null>(null)

  // ── Notifications logic ──
  const filtered = useMemo(() => {
    if (!Array.isArray(notifications)) return []
    const q = query.toLowerCase().trim()
    return notifications.filter(n =>
      (!q || n.verb?.toLowerCase().includes(q) || n.target_text?.toLowerCase().includes(q) || n.actor_name?.toLowerCase().includes(q)) &&
      (view === "all" ? true : n.unread)
    )
  }, [notifications, query, view])

  const toggleSelect = (id: number) =>
    setSelectedIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  const handleDeleteSelected = () => {
    if (!selectedIds.length) return
    setDeletingIds(selectedIds)
    setTimeout(() => { removeNotificationsLocal(selectedIds); setSelectedIds([]); setDeletingIds([]) }, 220)
  }

  const handleDeleteAllVisible = () => {
    const ids = filtered.map(n => n.id)
    if (!ids.length) return
    setDeletingIds(ids)
    setTimeout(() => { removeNotificationsLocal(ids); setSelectedIds([]); setDeletingIds([]) }, 220)
  }

  // ── Delete Logs: unread count ──
  const deleteLogsUnreadCount = useMemo(() => {
    if (tab === "deletelogs") return 0
    if (!deleteLogs.length) return 0
    if (!deleteLogsLastSeen) {
      const ago = new Date(Date.now() - 86400000)
      return deleteLogs.filter(l => new Date(l.timestamp) > ago).length
    }
    const seen = new Date(deleteLogsLastSeen)
    return deleteLogs.filter(l => new Date(l.timestamp) > seen).length
  }, [deleteLogs, deleteLogsLastSeen, tab])

  const handleMarkAllAsRead = () => {
    if (unreadCount > 0) markAllAsRead()
    if (deleteLogsUnreadCount > 0) {
      const now = new Date().toISOString()
      setDeleteLogsLastSeen(now)
      if (typeof window !== "undefined") {
        localStorage.setItem("delete_logs_last_seen", now)
        window.dispatchEvent(new Event("delete-logs-read"))
      }
    }
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      const s = localStorage.getItem("delete_logs_last_seen")
      if (s) setDeleteLogsLastSeen(s)
    }
  }, [])

  useEffect(() => {
    if (tab === "deletelogs" && deleteLogs.length > 0) {
      const now = new Date().toISOString()
      setDeleteLogsLastSeen(now)
      if (typeof window !== "undefined") localStorage.setItem("delete_logs_last_seen", now)
    }
  }, [tab, deleteLogs])

  // ── Delete Logs: fetch from audit-logs endpoint ──
  const fetchDeleteLogs = useCallback(async (pg = 1) => {
    setDeleteLogsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(pg), page_size: "25" })
      if (deleteLogsAction)    params.append("action",     deleteLogsAction)
      if (deleteLogsFeature)   params.append("feature",    deleteLogsFeature)
      if (deleteLogsSearch)    params.append("search",     deleteLogsSearch)
      if (deleteLogsStartDate) params.append("start_date", deleteLogsStartDate)
      if (deleteLogsEndDate)   params.append("end_date",   deleteLogsEndDate)

      const data = await apiGet<{
        results: DeleteLog[]
        total: number
        page: number
        num_pages: number
      }>(`/api/attendance/audit-logs/?${params}`)

      setDeleteLogs(data.results || [])
      setDeleteLogsTotal(data.total || 0)
      setDeleteLogsNumPages(data.num_pages || 1)
      setDeleteLogsPage(data.page || pg)
    } catch {
      setDeleteLogs([])
    } finally {
      setDeleteLogsLoading(false)
    }
  }, [deleteLogsAction, deleteLogsFeature, deleteLogsSearch, deleteLogsStartDate, deleteLogsEndDate])

  useEffect(() => {
    fetchDeleteLogs(1)
  }, [fetchDeleteLogs])

  // ── Delete Logs: bell still uses old light endpoint ──
  useEffect(() => {
    async function fetchBell() {
      try { const r = await getDeleteLogs(undefined, 50); setDeleteLogs(r.results as any || []) }
      catch { /* silent */ }
    }
    // only run on mount to seed unread count before user opens tab
    fetchBell()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Restore ──
  const handleRestore = async (id: number) => {
    setRestoringId(id)
    setRestoreMsg(null)
    try {
      const data = await apiPost<{ message?: string; error?: string }>(
        `/api/attendance/audit-logs/${id}/recover/`, {}
      )
      setRestoreMsg({ ok: true, text: data.message || "Restored successfully!" })
      fetchDeleteLogs(deleteLogsPage)
    } catch (e: any) {
      setRestoreMsg({ ok: false, text: e.message || "Restore failed" })
    } finally {
      setRestoringId(null)
      setConfirmRestoreId(null)
    }
  }

  const resetDeleteLogsFilters = () => {
    setDeleteLogsAction("delete")
    setDeleteLogsFeature("")
    setDeleteLogsSearch("")
    setDeleteLogsStartDate("")
    setDeleteLogsEndDate("")
    setDeleteLogsPage(1)
  }

  return (
    <div className="max-w-8xl mx-auto px-3 sm:px-8 py-4 sm:py-8 space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* ── Header ── */}
        <div className="bg-gradient-to-br from-[#1a3a5c] to-[#2a5298] px-4 sm:px-6 py-4 sm:py-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white">Notification Center</h1>
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium
                ${isConnected ? "text-emerald-300" : "text-red-300"}`}>
                {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {isConnected ? "Live" : "Offline"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationSoundToggle />
            <div className="text-center px-3.5 py-2 bg-white/10 rounded-xl border border-white/20">
              <p className="text-lg font-black text-white leading-none">{unreadCount}</p>
              <p className="text-[10px] text-white/60 uppercase tracking-wide mt-0.5">Unread</p>
            </div>
            <div className="text-center px-3.5 py-2 bg-white/10 rounded-xl border border-white/20">
              <p className="text-lg font-black text-white leading-none">{filtered.length}</p>
              <p className="text-[10px] text-white/60 uppercase tracking-wide mt-0.5">Showing</p>
            </div>
            <button
              onClick={async () => {
                if (isRefreshing) return
                setIsRefreshing(true)
                await refetch()
                setIsRefreshing(false)
              }}
              disabled={isRefreshing}
              className="w-9 h-9 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl flex items-center justify-center text-white transition-colors cursor-pointer disabled:opacity-60">
              <RefreshCw className={`w-4 h-4 transition-transform ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b border-gray-100">
          {[
            { key: "notifications" as const, label: "Notifications", badge: unreadCount, show: true },
            { key: "announcements" as const, label: "Announcements", badge: 0, show: true },
            { key: "deletelogs"    as const, label: "Logs",   badge: deleteLogsUnreadCount, show: canViewDeleteLogs },
          ].filter(t => t.show).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors
                ${tab === t.key
                  ? "border-[#2a4e78] text-[#2a4e78]"
                  : "border-transparent text-gray-400 hover:text-gray-600"}`}>
              {t.label}
              {t.badge > 0 && (
                <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white
                  ${t.key === "deletelogs" ? "bg-red-500" : "bg-[#2a4e78]"}`}>
                  {t.badge > 9 ? "9+" : t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Announcements Tab ── */}
        {tab === "announcements" && (
          <div className="p-4">
            {canCreateAnnouncement && (
              <div className="flex justify-end mb-3">
                <button
                  onClick={() => setShowAnnForm(true)}
                  className="inline-flex items-center gap-1.5 h-9 px-4 text-sm font-semibold text-white bg-[#274c77] hover:bg-[#1e3a5f] rounded-lg transition-colors">
                  <Plus className="h-4 w-4" /> New Announcement
                </button>
              </div>
            )}
            <AnnouncementsCard key={annKey} />
          </div>
        )}

        {/* ── Notifications Tab ── */}
        {tab === "notifications" && (
          <>
            <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input type="text" value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="Search notifications…"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a4e78]/20 focus:bg-white transition-colors" />
              </div>

              <div className="inline-flex bg-gray-100 rounded-lg p-0.5 flex-shrink-0">
                {(["unread", "all"] as const).map(opt => (
                  <button key={opt} onClick={() => setView(opt)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all
                      ${view === opt ? "bg-white text-[#2a4e78] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                    {opt === "unread" ? "Unread" : "All"}
                  </button>
                ))}
              </div>

              {(unreadCount > 0 || deleteLogsUnreadCount > 0) && (
                <button onClick={handleMarkAllAsRead}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2a4e78] hover:bg-[#2a4e78]/8 px-3 py-2 rounded-lg border border-[#2a4e78]/20 transition-colors flex-shrink-0">
                  <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                </button>
              )}

              {filtered.length > 0 && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={handleDeleteSelected} disabled={!selectedIds.length}
                    className="p-2 rounded-lg border border-red-100 text-red-400 hover:bg-red-50 disabled:opacity-30 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={handleDeleteAllVisible}
                    className="p-2 rounded-lg border border-gray-100 text-gray-400 hover:bg-gray-50 transition-colors">
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center">
                  <Inbox className="w-7 h-7 text-gray-200" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-500">All caught up!</p>
                  <p className="text-xs text-gray-400 mt-0.5">No notifications to show.</p>
                </div>
              </div>
            ) : (
              <div>
                {groupByDate(filtered).map(group => (
                  <div key={group.label}>
                    <div className="px-5 py-2 bg-gray-50/80 border-b border-gray-100">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{group.label}</span>
                    </div>
                    <ul className="divide-y divide-gray-50">
                      {group.items.map(n => (
                        <NotificationRow key={n.id} notification={n}
                          selected={selectedIds.includes(n.id)}
                          onToggleSelect={toggleSelect}
                          onMarkAsRead={id => markAsRead(id)}
                          isDeleting={deletingIds.includes(n.id)} />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Delete Logs Tab ── */}
        {tab === "deletelogs" && canViewDeleteLogs && (
          <>
            {/* Restore feedback */}
            {restoreMsg && (
              <div className={`mx-4 mt-3 p-3 rounded-lg text-sm font-medium border
                ${restoreMsg.ok
                  ? "bg-green-50 border-green-200 text-green-700"
                  : "bg-red-50 border-red-200 text-red-700"}`}>
                {restoreMsg.ok ? "✓ " : "✗ "}{restoreMsg.text}
              </div>
            )}

            {/* Filters */}
            <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2">
              <select value={deleteLogsAction}
                onChange={e => { setDeleteLogsAction(e.target.value); setDeleteLogsPage(1) }}
                className="px-3 py-2 text-sm bg-gray-50 border border-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a4e78]/20">
                <option value="">All Actions</option>
                <option value="delete">Delete</option>
                <option value="restore">Restore</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="mark">Mark Attendance</option>
                <option value="approve">Approve</option>
                <option value="submit">Submit</option>
                <option value="reopen">Reopen</option>
                <option value="password_change">Password Changed</option>
                <option value="status_change">Status Changed (Active/Inactive)</option>
              </select>

              <select value={deleteLogsFeature}
                onChange={e => { setDeleteLogsFeature(e.target.value); setDeleteLogsPage(1) }}
                className="px-3 py-2 text-sm bg-gray-50 border border-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a4e78]/20">
                {FEATURE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>

              <input type="date" value={deleteLogsStartDate}
                onChange={e => { setDeleteLogsStartDate(e.target.value); setDeleteLogsPage(1) }}
                className="px-3 py-2 text-sm bg-gray-50 border border-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a4e78]/20" />

              <input type="date" value={deleteLogsEndDate}
                onChange={e => { setDeleteLogsEndDate(e.target.value); setDeleteLogsPage(1) }}
                className="px-3 py-2 text-sm bg-gray-50 border border-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a4e78]/20" />

              <div className="relative flex-1 min-w-[140px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input type="text" value={deleteLogsSearch}
                  onChange={e => { setDeleteLogsSearch(e.target.value); setDeleteLogsPage(1) }}
                  placeholder="Search…"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a4e78]/20 focus:bg-white transition-colors" />
              </div>

              <button onClick={() => fetchDeleteLogs(1)}
                className="px-4 py-2 bg-[#2a4e78] text-white rounded-lg text-xs font-semibold hover:bg-[#1a3a5c] transition-colors">
                Search
              </button>
            <button onClick={resetDeleteLogsFilters}
                className="p-2 border border-gray-100 rounded-lg text-gray-400 hover:bg-gray-50 transition-colors " title="Reset filters">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>

              {deleteLogsTotal > 0 && (
                <span className="text-xs text-gray-400 ml-auto">{deleteLogsTotal} records</span>
              )}
            </div>

            {/* List */}
            {deleteLogsLoading ? (
              <div className="flex items-center justify-center py-20 gap-2 text-gray-400">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading…</span>
              </div>
            ) : deleteLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center">
                  <FileX className="w-7 h-7 text-red-200" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-500">No records found</p>
                  <p className="text-xs text-gray-400 mt-0.5">Try adjusting your filters.</p>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {deleteLogs.map(log => (
                  <DeleteLogRow
                    key={log.id}
                    log={log}
                    canRestore={canRestore}
                    confirmId={confirmRestoreId}
                    restoringId={restoringId}
                    onConfirm={id => { setRestoreMsg(null); setConfirmRestoreId(id) }}
                    onCancelConfirm={() => setConfirmRestoreId(null)}
                    onRestore={handleRestore}
                  />
                ))}
              </ul>
            )}

            {/* Pagination */}
            {deleteLogsNumPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 text-xs text-gray-500">
                <span>Page {deleteLogsPage} of {deleteLogsNumPages}</span>
                <div className="flex gap-2">
                  <button
                    disabled={deleteLogsPage <= 1}
                    onClick={() => { const p = deleteLogsPage - 1; setDeleteLogsPage(p); fetchDeleteLogs(p) }}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors">
                    ← Prev
                  </button>
                  <button
                    disabled={deleteLogsPage >= deleteLogsNumPages}
                    onClick={() => { const p = deleteLogsPage + 1; setDeleteLogsPage(p); fetchDeleteLogs(p) }}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors">
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}

      </div>

      {/* ── Create Announcement modal (org admin only) ── */}
      {showAnnForm && canCreateAnnouncement && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !annSubmitting && setShowAnnForm(false)} />
          <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 bg-[#274c77] text-white flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-bold"><Megaphone className="h-5 w-5" /> New Announcement</h3>
              <button onClick={() => !annSubmitting && setShowAnnForm(false)} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Title <span className="text-rose-500">*</span></label>
                <input
                  type="text" value={annForm.title}
                  onChange={e => setAnnForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Announcement title"
                  className="w-full h-10 px-3 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a4e78]/20" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Message</label>
                <textarea
                  value={annForm.body} rows={4}
                  onChange={e => setAnnForm(f => ({ ...f, body: e.target.value }))}
                  placeholder="Write the announcement…"
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a4e78]/20 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Priority</label>
                  <select
                    value={annForm.priority}
                    onChange={e => setAnnForm(f => ({ ...f, priority: e.target.value }))}
                    className="w-full h-10 px-3 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a4e78]/20">
                    <option value="normal">Normal</option>
                    <option value="important">Important</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Audience</label>
                  <select
                    value={annForm.audience}
                    onChange={e => setAnnForm(f => ({ ...f, audience: e.target.value }))}
                    className="w-full h-10 px-3 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a4e78]/20">
                    <option value="all">Everyone</option>
                    <option value="staff">Staff only</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setShowAnnForm(false)} disabled={annSubmitting}
                className="h-9 px-4 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={submitAnnouncement} disabled={annSubmitting}
                className="h-9 px-4 text-sm font-semibold text-white bg-[#274c77] rounded-lg hover:bg-[#1e3a5f] transition-colors disabled:opacity-50">
                {annSubmitting ? "Publishing…" : "Publish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Notification Row ── */
function NotificationRow({ notification, selected, onToggleSelect, onMarkAsRead, isDeleting = false }: {
  notification: Notification; selected: boolean
  onToggleSelect: (id: number) => void; onMarkAsRead: (id: number) => void; isDeleting?: boolean
}) {
  const u = notification.unread
  const style = getNotifStyle(notification.verb)
  const Icon = style.Icon
  return (
    <li className={`relative flex items-start gap-3 px-4 sm:px-5 py-4 transition-all duration-200
      ${u ? "bg-[#f4f7ff] border-l-[3px] border-l-[#2a4e78]" : "bg-white border-l-[3px] border-l-transparent hover:bg-gray-50/60"}
      ${isDeleting ? "opacity-0 translate-x-3 scale-[0.98] pointer-events-none" : ""}`}>

      <button type="button" onClick={() => onToggleSelect(notification.id)}
        className={`mt-1 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors
          ${selected ? "bg-[#2a4e78] border-[#2a4e78]" : "border-gray-300 bg-white hover:border-[#2a4e78]/50"}`}>
        {selected && <Check className="w-2.5 h-2.5 text-white" />}
      </button>

      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0
        ${u ? `${style.activeBg} text-white` : `${style.bg} ${style.text}`}`}>
        <Icon className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold leading-snug ${u ? "text-gray-900" : "text-gray-500"}`}>
          {formatVerb(notification.verb)}
        </p>
        {notification.target_text && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{notification.target_text}</p>
        )}
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          {notification.actor_name && <span className="text-[11px] font-medium text-gray-400">{notification.actor_name}</span>}
          <span className="text-[11px] text-gray-300">·</span>
          <span className="text-[11px] text-gray-400">{formatRelative(notification.timestamp)}</span>
          {u && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#2a4e78]/10 text-[#2a4e78]">New</span>}
        </div>
      </div>

      {u && (
        <button onClick={() => onMarkAsRead(notification.id)}
          className="mt-1 p-1.5 rounded-lg text-gray-300 hover:text-[#2a4e78] hover:bg-[#2a4e78]/8 transition-colors flex-shrink-0">
          <Check className="w-3.5 h-3.5" />
        </button>
      )}
    </li>
  )
}

/* ── Delete Log Row ── */
function DeleteLogRow({ log, canRestore, confirmId, restoringId, onConfirm, onCancelConfirm, onRestore }: {
  log: DeleteLog
  canRestore: boolean
  confirmId: number | null
  restoringId: number | null
  onConfirm: (id: number) => void
  onCancelConfirm: () => void
  onRestore: (id: number) => void
}) {
  const isDeleted    = log.action === "delete" && !log.is_recovered
  const isRestored   = log.is_recovered
  const isPasswordChange = log.action === "password_change"
  const isStatusChange = log.action === "status_change"
  const isActivated  = isStatusChange && log.changes?.status_changed_to === "activated"
  const isConfirming = confirmId === log.id
  const isRestoring  = restoringId === log.id

  return (
    <li className={`flex items-start gap-3 px-5 py-4 transition-colors
      ${isDeleted        ? "hover:bg-red-50/30 border-l-[3px] border-l-red-300 bg-red-50/20" : ""}
      ${isRestored       ? "hover:bg-green-50/30 border-l-[3px] border-l-green-300 bg-green-50/10" : ""}
      ${isPasswordChange ? "hover:bg-purple-50/30 border-l-[3px] border-l-purple-300 bg-purple-50/10" : ""}
      ${isStatusChange && isActivated  ? "hover:bg-green-50/30 border-l-[3px] border-l-emerald-300 bg-emerald-50/10" : ""}
      ${isStatusChange && !isActivated ? "hover:bg-orange-50/30 border-l-[3px] border-l-orange-300 bg-orange-50/10" : ""}
      ${!isDeleted && !isRestored && !isPasswordChange && !isStatusChange ? "hover:bg-gray-50 border-l-[3px] border-l-gray-200" : ""}`}>

      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0
        ${isDeleted ? "bg-red-100" : isRestored ? "bg-green-100" : isPasswordChange ? "bg-purple-100" : isStatusChange && isActivated ? "bg-emerald-100" : isStatusChange ? "bg-orange-100" : "bg-gray-100"}`}>
        <FileX className={`w-4 h-4 ${isDeleted ? "text-red-400" : isRestored ? "text-green-400" : isPasswordChange ? "text-purple-500" : isStatusChange && isActivated ? "text-emerald-500" : isStatusChange ? "text-orange-400" : "text-gray-400"}`} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 line-clamp-1">
          {isPasswordChange
            ? `Password Changed — ${log.changes?.name || log.entity_type + ' #' + log.entity_id}`
            : isStatusChange
              ? `${isActivated ? 'Activated' : 'Deactivated'} — ${log.changes?.name || log.entity_type + ' #' + log.entity_id}`
              : log.feature_display + ' — ' + (
                  log.changes?.bulk_upload
                    ? `Bulk Upload (${log.changes?.created ?? 0} added)`
                    : (log.entity_name || `${log.entity_type} #${log.entity_id}`)
                )
          }
        </p>
        {isPasswordChange && log.changes?.changed_by && (
          <p className="text-xs text-purple-500 mt-0.5">Changed by: {String(log.changes.changed_by)} ({String(log.changes.changed_by_role)})</p>
        )}
        {isStatusChange && log.changes?.changed_by && (
          <p className={`text-xs mt-0.5 ${isActivated ? 'text-emerald-600' : 'text-orange-500'}`}>
            {isActivated ? 'Activated' : 'Deactivated'} by: {String(log.changes.changed_by)} ({String(log.changes.changed_by_role)})
          
          </p>
        )}
        
        {(() => {
          const students = log.changes?.bulk_upload && Array.isArray(log.changes?.students)
            ? (log.changes.students as string[])
            : []
          return students.length > 0
            ? <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{students.join(", ")}</p>
            : null
        })()}
        {!log.changes?.bulk_upload && log.reason && (
          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{log.reason}</p>
        )}
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          <span className="text-[11px] text-gray-400">{log.user_name}</span>
          {log.ip_address && (
            <>
              <span className="text-[11px] text-gray-300">·</span>
              <span className="text-[11px] text-gray-400 font-mono">{log.ip_address}</span>
            </>
          )}
          <span className="text-[11px] text-gray-300">·</span>
          <span className="text-[11px] text-gray-400">{formatRelative(log.timestamp)}</span>
          <ActionBadge action={log.action} />
          {isRestored && <span className="text-[10px] font-medium text-green-600">✓ Restored</span>}
        </div>
      </div>

      {/* Restore button — only for unrestored deletions */}
      {canRestore && isDeleted && (
        <div className="flex-shrink-0 flex items-center gap-1 mt-0.5">
          {isConfirming ? (
            <>
              <button onClick={() => onRestore(log.id)} disabled={isRestoring}
                className="px-2.5 py-1 bg-green-600 text-white rounded text-xs font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">
                {isRestoring ? "…" : "Yes"}
              </button>
              <button onClick={onCancelConfirm}
                className="px-2.5 py-1 border border-gray-300 rounded text-xs text-gray-600 hover:bg-gray-50 transition-colors">
                No
              </button>
            </>
          ) : (
            <button onClick={() => onConfirm(log.id)}
              className="px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded text-xs font-semibold hover:bg-blue-100 transition-colors">
              Restore
            </button>
          )}
        </div>
      )}

      {isRestored && !canRestore && (
        <span className="text-green-500 text-xs flex-shrink-0 mt-1">✓</span>
      )}
    </li>
  )
}
