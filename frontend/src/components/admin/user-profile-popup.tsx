"use client"

import React, { useState, useEffect, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  User,
  Mail,
  Phone,
  Building2,
  Shield,
  GraduationCap,
  LogOut,
  ChevronDown,
  ExternalLink,
} from "lucide-react"
import { getCurrentUser } from "@/lib/permissions"
import { apiGet } from "@/lib/api"
import { useRouter } from "next/navigation"
import { SmartAvatar } from "@/components/ui/smart-avatar"

interface UserProfile {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  full_name?: string
  role: string
  role_display: string
  campus?: { id: number; campus_name: string; campus_code: string }
  phone_number?: string
  contact_number?: string
  is_verified: boolean
  is_active: boolean
  created_at: string
  photo?: string | null
  profile_image?: string | null
}

const ROLE_META: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  superadmin:          { label: "Super Admin",      color: "text-rose-700",    bg: "bg-rose-50",    border: "border-rose-200",   icon: <Shield className="w-3 h-3" /> },
  org_admin:           { label: "Org Admin",         color: "text-orange-700",  bg: "bg-orange-50",  border: "border-orange-200", icon: <Shield className="w-3 h-3" /> },
  principal:           { label: "Principal",         color: "text-purple-700",  bg: "bg-purple-50",  border: "border-purple-200", icon: <GraduationCap className="w-3 h-3" /> },
  coordinator:         { label: "Coordinator",       color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200",   icon: <User className="w-3 h-3" /> },
  teacher:             { label: "Teacher",           color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200",icon: <GraduationCap className="w-3 h-3" /> },
  accounts_officer:    { label: "Accounts Officer",  color: "text-cyan-700",    bg: "bg-cyan-50",    border: "border-cyan-200",   icon: <User className="w-3 h-3" /> },
  admissions_counselor:{ label: "Receptionist",      color: "text-teal-700",    bg: "bg-teal-50",    border: "border-teal-200",   icon: <User className="w-3 h-3" /> },
  compliance_officer:  { label: "Auditor",           color: "text-violet-700",  bg: "bg-violet-50",  border: "border-violet-200", icon: <Shield className="w-3 h-3" /> },
  student:             { label: "Student",           color: "text-sky-700",     bg: "bg-sky-50",     border: "border-sky-200",    icon: <User className="w-3 h-3" /> },
  donor:               { label: "Donor",             color: "text-pink-700",    bg: "bg-pink-50",    border: "border-pink-200",   icon: <User className="w-3 h-3" /> },
}

export function UserProfilePopup() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [navPhoto, setNavPhoto] = useState<string | null>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setIsClient(true) }, [])

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [isOpen])

  // Sync photo from localStorage + API
  const syncFromStorage = () => {
    const user = getCurrentUser()
    setCurrentUser(user)
    const stored = typeof window !== "undefined"
      ? (() => { try { return JSON.parse(window.localStorage.getItem("sis_user") || "{}") } catch { return {} } })()
      : {}
    const photo = stored?.photo || stored?.profile_image || null
    if (photo) setNavPhoto(photo)
    return photo
  }

  useEffect(() => {
    syncFromStorage()
    const fetchNavPhoto = async () => {
      try {
        const fresh = await apiGet("/api/current-user/") as any
        if (!fresh) return
        const photo = fresh?.photo || fresh?.profile_image || null
        setNavPhoto(photo)
        if (typeof window !== "undefined") {
          try {
            const stored = JSON.parse(window.localStorage.getItem("sis_user") || "{}")
            if (photo !== (stored?.photo || stored?.profile_image)) {
              window.localStorage.setItem("sis_user", JSON.stringify({ ...stored, ...fresh }))
            }
          } catch {}
        }
      } catch {}
    }
    fetchNavPhoto()
    const onPhotoUpdate = () => syncFromStorage()
    window.addEventListener("storage", onPhotoUpdate)
    window.addEventListener("profile-photo-updated", onPhotoUpdate)
    return () => {
      window.removeEventListener("storage", onPhotoUpdate)
      window.removeEventListener("profile-photo-updated", onPhotoUpdate)
    }
  }, [])

  // Load profile when popup opens
  useEffect(() => {
    if (isClient && isOpen && !userProfile) {
      fetchProfile()
    }
  }, [isClient, isOpen, userProfile])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      const data = await apiGet("/api/current-user/") as UserProfile
      setUserProfile(data)
      const photo = data?.photo || data?.profile_image || null
      if (photo) setNavPhoto(photo)
    } catch {
      const u = getCurrentUser()
      if (u) {
        setUserProfile({
          id: 0, username: u.username || "", email: u.email || "",
          first_name: u.first_name || "", last_name: u.last_name || "",
          role: u.role || "", role_display: u.role || "",
          is_verified: false, is_active: true, created_at: new Date().toISOString(),
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    // Offline drafts (IndexedDB) clear — shared PC security.
    const { clearAllDrafts } = await import("@/lib/offline/db")
    await clearAllDrafts().catch(() => {})
    window.localStorage.removeItem("sis_user")
    window.localStorage.removeItem("sis_access_token")
    window.localStorage.removeItem("sis_refresh_token")
    router.push("/login")
  }

  const handleViewFullProfile = () => {
    const role = userProfile?.role || currentUser?.role
    router.push(`/${role}/profile`)
    setIsOpen(false)
  }

  if (!isClient || !currentUser) return null

  const role = userProfile?.role || currentUser?.role || ""
  const meta = ROLE_META[role] || { label: role, color: "text-gray-700", bg: "bg-gray-50", border: "border-gray-200", icon: <User className="w-3 h-3" /> }
  const displayName =
    userProfile?.full_name ||
    ((userProfile?.first_name || currentUser?.first_name) && (userProfile?.last_name || currentUser?.last_name)
      ? `${userProfile?.first_name || currentUser.first_name} ${userProfile?.last_name || currentUser.last_name}`
      : null) ||
    userProfile?.username || currentUser?.username || "User"
  const photo = navPhoto || userProfile?.photo || userProfile?.profile_image || null
  const email = userProfile?.email || currentUser?.email
  const phone = userProfile?.phone_number || userProfile?.contact_number || null
  const campus = userProfile?.campus?.campus_name || null

  return (
    <div className="relative" ref={popupRef}>
      {/* ── Trigger Button ── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 sm:gap-2.5 px-2 py-1.5 rounded-xl hover:bg-gray-100/80 transition-all duration-150"
      >
        <SmartAvatar
          src={photo}
          name={displayName}
          size="sm"
          ringClass="ring-2 ring-[#274c77]/20"
        />
        <div className="hidden sm:block text-left max-w-[120px]">
          <p className="text-xs font-semibold text-gray-900 leading-none truncate">{displayName}</p>
          <p className="text-[10px] text-gray-400 mt-0.5 capitalize">{meta.label}</p>
        </div>
      </button>

      {/* ── Dropdown Card ── */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[280px] bg-white rounded-2xl shadow-xl border border-gray-200/80 z-50 overflow-hidden">

          {/* Avatar + Name Header */}
          <div className="relative px-5 pt-5 pb-4 flex flex-col items-center text-center border-b border-gray-100">
            {/* Accent bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#274c77] to-[#6096ba] rounded-t-2xl" />

            <SmartAvatar
              src={photo}
              name={displayName}
              size="lg"
              ringClass="ring-3 ring-white shadow-md"
              className="w-16 h-16 mt-2"
            />

            <div className="mt-3 space-y-1">
              {loading ? (
                <div className="h-4 w-32 bg-gray-100 animate-pulse rounded mx-auto" />
              ) : (
                <p className="text-sm font-bold text-gray-900 leading-tight">{displayName}</p>
              )}
              <Badge className={`${meta.bg} ${meta.color} ${meta.border} border text-[10px] font-bold px-2.5 py-0.5 uppercase tracking-wide`}>
                <span className="mr-1">{meta.icon}</span>
                {meta.label}
              </Badge>
            </div>
          </div>

          {/* Info Rows */}
          <div className="px-4 py-3 space-y-0.5">
            {loading ? (
              <div className="space-y-3 py-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-gray-100 rounded-lg animate-pulse" />
                    <div className="flex-1 h-3 bg-gray-100 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {email && (
                  <InfoRow icon={Mail} value={email} />
                )}
                {phone && (
                  <InfoRow icon={Phone} value={phone} />
                )}
                {campus && role !== "superadmin" && (
                  <InfoRow icon={Building2} value={campus} />
                )}
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="px-3 pb-3 pt-1 flex flex-col gap-1.5 border-t border-gray-100 mt-1">
            <button
              onClick={handleViewFullProfile}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#274c77] hover:bg-[#1e3a5f] text-white text-xs font-bold transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View Full Profile
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold transition-colors border border-red-100"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-component ──────────────────────────────────────────────────────────────
function InfoRow({ icon: Icon, value }: { icon: React.ElementType; value: string }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5 group">
      <div className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-50 group-hover:border-blue-100 transition-colors">
        <Icon className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#274c77] transition-colors" />
      </div>
      <span className="text-xs text-gray-600 truncate font-medium">{value}</span>
    </div>
  )
}
