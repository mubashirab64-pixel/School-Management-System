"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { UserProfilePopup } from "@/components/admin/user-profile-popup"
import { NotificationBell } from "@/components/admin/notification-bell"
import { AdminBreadcrumb } from "@/components/admin/breadcrumb"
import SmoothScroll from "@/components/smoothscroll"
import dynamic from "next/dynamic"
const ProtectedRoute = dynamic(() => import("@/components/ProtectedRoute"), { ssr: false })
import AIChatWidget from "@/components/AIChatWidget"
import { refreshUserProfile } from "@/lib/api"
import { registerWebPush } from "@/lib/web-push"
import { useSessionManager } from "@/hooks/useSessionManager"
import { usePathname } from "next/navigation"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [isTablet, setIsTablet] = useState(false)
  const [isSyncing, setIsSyncing] = useState(true)
  const pathname = usePathname()

  useSessionManager()

  // Register Web Push (OS notifications even when the app/tab is closed).
  // Try immediately (works if permission already granted), and also on the
  // first user gesture (some browsers require a gesture for the permission prompt).
  useEffect(() => {
    registerWebPush()
    const onGesture = () => registerWebPush()
    window.addEventListener("pointerdown", onGesture, { once: true })
    return () => window.removeEventListener("pointerdown", onGesture)
  }, [])

  useEffect(() => {
    // Refresh user's permissions on mount/load
    const syncProfile = async () => {
      try {
        await refreshUserProfile();
      } catch (err) {
        console.error('Failed to sync profile', err);
      } finally {
        setIsSyncing(false);
      }
    };
    syncProfile();

    const handleResize = () => {
      const mobile = window.innerWidth <= 640
      const tablet = window.innerWidth <= 1024
      setIsMobile(mobile)
      setIsTablet(tablet)
      if (mobile || tablet) {
        setSidebarOpen(false)
      } else {
        setSidebarOpen(true)
      }
    }
    handleResize()
    window.addEventListener("resize", handleResize)

    const handleToggleSidebar = () => {
      setSidebarOpen(prev => !prev)
    }
    window.addEventListener("toggle-admin-sidebar", handleToggleSidebar)

    return () => {
      window.removeEventListener("resize", handleResize)
      window.removeEventListener("toggle-admin-sidebar", handleToggleSidebar)
    }
  }, [])


  return (
    <div className="flex h-screen overflow-hidden bg-[#F5F7FA] print:block print:h-auto print:bg-white">
      <div className="print:hidden h-full flex-shrink-0">
        <AdminSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      </div>

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden print:block print:overflow-visible">

        {pathname !== "/admin" && pathname !== "/admin/" && (
          <header
            className="print:hidden flex items-center justify-between px-4 sm:px-6 h-16 bg-white border-b border-gray-200 flex-shrink-0 z-40"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 transition-colors flex-shrink-0"
                aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <AdminBreadcrumb />
            </div>

            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <NotificationBell />
              <UserProfilePopup />
            </div>
          </header>
        )}

        <main className="flex-1 min-h-0 print:overflow-visible">
          <SmoothScroll className="h-full overflow-y-auto hide-scrollbar print:overflow-visible print:h-auto">
            <ProtectedRoute>
              <div className="p-4 sm:p-6 lg:p-8 print:p-0">
                {children}
              </div>
            </ProtectedRoute>
          </SmoothScroll>
        </main>
      </div>

      <AIChatWidget />
    </div>
  )
}
