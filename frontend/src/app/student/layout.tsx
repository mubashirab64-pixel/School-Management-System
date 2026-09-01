"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { UserProfilePopup } from "@/components/admin/user-profile-popup"
import { NotificationBell } from "@/components/admin/notification-bell"
import { AdminBreadcrumb } from "@/components/admin/breadcrumb"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { useSessionManager } from "@/hooks/useSessionManager"

const ProtectedRoute = dynamic(() => import("@/components/ProtectedRoute"), { ssr: false })

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const router = useRouter()

  useSessionManager()

  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("sis_access_token")
      if (!token) { router.replace("/login"); return }
      try {
        const user = JSON.parse(localStorage.getItem("sis_user") || "{}")
        if (user.role !== "student") { router.replace("/login"); return }
      } catch {
        router.replace("/login")
      }
    }

    const handleResize = () => {
      const small = window.innerWidth <= 1024
      if (small) setSidebarOpen(false)
      else setSidebarOpen(true)
    }
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [router])

  return (
    <div className="flex h-screen overflow-hidden bg-[#f0f4f8] print:block print:h-auto print:bg-white">
      <div className="print:hidden h-full flex-shrink-0">
        <AdminSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      </div>

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden print:block print:overflow-visible">
        <header
          className="print:hidden flex items-center justify-between px-4 sm:px-6 h-16 bg-white border-b border-gray-200 flex-shrink-0 z-10"
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

        <main className="flex-1 overflow-y-auto hide-scrollbar print:p-0 print:m-0 print:overflow-visible">
          <ProtectedRoute>
            <div className="p-4 sm:p-6 lg:p-8 print:p-0">
              {children}
            </div>
          </ProtectedRoute>
        </main>
      </div>
    </div>
  )
}
