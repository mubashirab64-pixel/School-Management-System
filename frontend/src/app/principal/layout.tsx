"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { UserProfilePopup } from "@/components/admin/user-profile-popup"
import { NotificationBell } from "@/components/admin/notification-bell"
import { AdminBreadcrumb } from "@/components/admin/breadcrumb"
import dynamic from "next/dynamic"
const ProtectedRoute = dynamic(() => import("@/components/ProtectedRoute"), { ssr: false })
import { refreshUserProfile } from "@/lib/api"
import { useSessionManager } from "@/hooks/useSessionManager"

export default function PrincipalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [isTablet, setIsTablet] = useState(false)

  useSessionManager()

  useEffect(() => {
    const syncProfile = async () => {
      try {
        await refreshUserProfile()
      } catch {}
    }
    syncProfile()

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
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-[#f0f4f8]">
      <div className="h-full flex-shrink-0">
        <AdminSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      </div>

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header
          className="flex items-center justify-between px-4 sm:px-6 h-16 bg-white border-b border-gray-200 flex-shrink-0 z-10"
          style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 transition-colors flex-shrink-0"
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

        <main className="flex-1 overflow-y-auto hide-scrollbar">
          <ProtectedRoute>
            {children}
          </ProtectedRoute>
        </main>
      </div>
    </div>
  )
}
