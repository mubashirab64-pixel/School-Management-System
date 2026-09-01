"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { Bell } from "lucide-react"
import { useWebSocketNotifications } from "@/hooks/useWebSocketNotifications"
import { getDeleteLogs } from "@/lib/api"
import { getCurrentUserRole } from "@/lib/permissions"

export function NotificationBell() {
  const { unreadCount, isConnected } = useWebSocketNotifications()
  const [deleteLogs, setDeleteLogs] = useState<any[]>([])
  const [deleteLogsLastSeen, setDeleteLogsLastSeen] = useState<string | null>(null)

  const role = getCurrentUserRole()
  const canViewDeleteLogs = role === "superadmin" || role === "org_admin" || role === "admin" || role === "principal"

  // Load delete logs last seen timestamp from localStorage
  useEffect(() => {
    const loadLastSeen = () => {
      if (typeof window !== 'undefined') {
        const lastSeen = localStorage.getItem('delete_logs_last_seen')
        if (lastSeen) {
          setDeleteLogsLastSeen(lastSeen)
        }
      }
    }

    loadLastSeen()
    window.addEventListener('delete-logs-read', loadLastSeen)
    return () => window.removeEventListener('delete-logs-read', loadLastSeen)
  }, [])

  // Fetch delete logs — only for allowed roles
  useEffect(() => {
    if (!canViewDeleteLogs) return

    async function fetchDeleteLogs() {
      try {
        const response = await getDeleteLogs(undefined, 50)
        setDeleteLogs(response.results || [])
      } catch (error) {
        setDeleteLogs([])
      }
    }
    fetchDeleteLogs()

    const handleNewLog = () => { fetchDeleteLogs() }
    window.addEventListener('sis-audit-log-new', handleNewLog)
    const interval = setInterval(fetchDeleteLogs, 30 * 60 * 1000)

    return () => {
      window.removeEventListener('sis-audit-log-new', handleNewLog)
      clearInterval(interval)
    }
  }, [canViewDeleteLogs])

  // Delete logs unread count — 0 for non-allowed roles
  const deleteLogsUnreadCount = useMemo(() => {
    if (!canViewDeleteLogs) return 0
    if (!Array.isArray(deleteLogs) || deleteLogs.length === 0) return 0

    if (!deleteLogsLastSeen) {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      return deleteLogs.filter(log => new Date(log.timestamp) > oneDayAgo).length
    }

    const lastSeenDate = new Date(deleteLogsLastSeen)
    return deleteLogs.filter(log => new Date(log.timestamp) > lastSeenDate).length
  }, [deleteLogs, deleteLogsLastSeen, canViewDeleteLogs])

  // Total unread count (notifications + delete logs)
  const totalUnreadCount = unreadCount + deleteLogsUnreadCount

  return (
    <Link
      href="/admin/notifications"
      className="flex items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95 p-2 sm:p-1.5 touch-manipulation"
      aria-label="Open notifications"
      title={isConnected ? "Notifications center" : "Notifications (offline mode)"}
      style={{ minWidth: 44, minHeight: 44 }}
    >
      <span className="relative inline-flex">
        <Bell
          className={`w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-gray-700 ${totalUnreadCount > 0 ? "animate-shake-interval" : ""
            } ${!isConnected ? "opacity-50" : ""}`}
        />
        {totalUnreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center">
            <span className="absolute inline-flex w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-red-500/70 animate-ping"></span>
            <span className="relative inline-flex w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-red-500 border border-white sm:border-2 text-[9px] sm:text-[10px] font-semibold items-center justify-center text-white">
              {totalUnreadCount > 9 ? "9+" : totalUnreadCount}
            </span>
          </span>
        )}
      </span>
    </Link>
  )
}

