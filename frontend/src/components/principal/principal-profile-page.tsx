"use client"

import React, { useState, useRef, useCallback } from "react"
import {
  Mail, Phone, MapPin, Shield, Calendar, GraduationCap,
  Building2, Clock, Award, Briefcase, Edit3, Key,
  Users, ClipboardList, CheckCircle, FileText, Megaphone,
  BarChart3, AlertTriangle, ArrowRight, ChevronRight,
  TrendingUp, User, Activity, Star, BookOpen, ArrowLeft,
  LayoutDashboard, Camera, Loader2, X, PenTool
} from "lucide-react"
import { SmartAvatar } from "@/components/ui/smart-avatar"
import { useRouter } from "next/navigation"
import { apiPatchFormData, refreshUserProfile, API_ENDPOINTS } from "@/lib/api"
import TeacherSignature from "@/components/signature/TeacherSignature"

// ─── Types ────────────────────────────────────────────────────────────────────
export interface PrincipalProfileData {
  id?: number           // User ID
  principal_id?: number // Principal model ID — used for PATCH /api/principals/{id}/
  full_name?: string
  email?: string
  contact_number?: string
  cnic?: string
  dob?: string
  gender?: string
  permanent_address?: string
  photo?: string
  profile_image?: string
  employee_code?: string
  joining_date?: string
  designation?: string
  shift?: string
  contract_type?: string
  education_level?: string
  degree_title?: string
  institution_name?: string
  year_of_passing?: number
  total_experience_years?: number
  specialization?: string
  is_currently_active?: boolean
  status?: string
  campus_name?: string
  campus?: { campus_name?: string; campus_code?: string }
  role?: string
  created_at?: string
  updated_at?: string
  last_login?: string
  signature?: string | null
}

export interface PendingActionItem {
  id?: number
  title: string
  count: number
  type?: "urgent" | "normal"
  href: string
}

export interface ProfileStats {
  totalStudents?: number
  totalTeachers?: number
  totalClasses?: number
  attendanceRate?: string
  feeCollection?: string
  pendingApprovals?: number
  pendingActions?: PendingActionItem[]
  timetableConflict?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—"

const fmtShort = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"

// ─── Skeleton shimmer ─────────────────────────────────────────────────────────
function Shimmer({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-gray-100 ${className}`} />
  )
}

// ─── Section card wrapper ──────────────────────────────────────────────────────
function SectionCard({
  title,
  icon: Icon,
  children,
  className = "",
  action,
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  className?: string
  action?: React.ReactNode
}) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4 text-[#185FA5]" />
          </div>
          <span className="text-sm font-bold text-gray-800">{title}</span>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

// ─── Info field ───────────────────────────────────────────────────────────────
function InfoField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-gray-800">{value || "—"}</p>
    </div>
  )
}

// ─── Sidebar contact row ──────────────────────────────────────────────────────
function ContactRow({ icon: Icon, value }: { icon: React.ElementType; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 mt-0.5 border border-gray-100">
        <Icon className="w-3.5 h-3.5 text-gray-400" />
      </div>
      <span className="text-sm text-gray-700 break-all leading-snug">{value}</span>
    </div>
  )
}

// ─── KPI card ─────────────────────────────────────────────────────────────────
function KPICard({
  label, value, icon: Icon, colorClass, bgClass, trend,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  colorClass: string
  bgClass: string
  trend?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${bgClass}`}>
        <Icon className={`w-5 h-5 ${colorClass}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-gray-900">{value}</span>
          {trend && (
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
              <TrendingUp className="w-2.5 h-2.5" />{trend}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Pending action row ───────────────────────────────────────────────────────
function PendingActionRow({
  title, count, type = "normal", href,
}: {
  title: string; count: number; type?: "urgent" | "normal"; href: string
}) {
  return (
    <div className="flex items-center justify-between py-3 px-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50/60 transition-all duration-150">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
          type === "urgent" ? "bg-amber-50" : "bg-blue-50"
        }`}>
          <FileText className={`w-4 h-4 ${type === "urgent" ? "text-amber-600" : "text-[#185FA5]"}`} />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800">{title}</p>
          <p className="text-xs text-gray-400 font-medium">{count} pending</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {type === "urgent" && (
          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 uppercase tracking-tight">
            Urgent
          </span>
        )}
        <a
          href={href}
          className="px-3 py-1.5 bg-white text-[#185FA5] text-xs font-bold rounded-lg border border-gray-200 hover:border-[#185FA5]/40 hover:bg-blue-50 transition-all"
        >
          Review
        </a>
      </div>
    </div>
  )
}

// ─── Quick action button ──────────────────────────────────────────────────────
function QuickActionBtn({
  label, icon: Icon, href, colorClass, bgClass,
}: {
  label: string; icon: React.ElementType; href: string; colorClass: string; bgClass: string
}) {
  return (
    <a
      href={href}
      className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-gray-200 hover:border-[#185FA5]/30 hover:bg-blue-50/40 group transition-all duration-200 text-center"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2.5 ${bgClass} ${colorClass} group-hover:-translate-y-0.5 transition-transform duration-200`}>
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-xs font-bold text-gray-700 group-hover:text-[#185FA5] leading-tight">{label}</span>
    </a>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────
interface Props {
  principal: PrincipalProfileData
  stats?: ProfileStats
  loading?: boolean
}

export function PrincipalProfilePage({ principal, stats = {}, loading = false }: Props) {
  const router       = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Local photo state so upload reflects instantly without page reload
  const [localPhoto,     setLocalPhoto]     = useState<string | null>(null)
  const [uploading,      setUploading]      = useState(false)
  const [uploadError,    setUploadError]    = useState<string | null>(null)
  const [uploadSuccess,  setUploadSuccess]  = useState(false)
  // Signature state — updated when principal saves/changes their signature
  const [signature,      setSignature]      = useState<string | null>(principal.signature ?? null)

  const photo = localPhoto || principal.photo || principal.profile_image || null
  const name  = principal.full_name ?? "Principal"

  // ── Photo upload handler ───────────────────────────────────────
  const handlePhotoChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!fileInputRef.current) return
    fileInputRef.current.value = ""          // reset so same file can be re-selected
    if (!file) return

    // Validate type & size (max 5 MB)
    if (!file.type.startsWith("image/")) {
      setUploadError("Please select an image file.")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image must be under 5 MB.")
      return
    }

    // Show preview instantly
    const objectUrl = URL.createObjectURL(file)
    setLocalPhoto(objectUrl)
    setUploadError(null)
    setUploadSuccess(false)
    setUploading(true)

    try {
      // Use principal_id (Principal model PK), NOT id (User PK)
      const principalId = principal.principal_id
      if (!principalId) throw new Error("Principal ID not found")

      const fd = new FormData()
      fd.append("photo", file)

      // PATCH returns the updated principal with absolute photo URL
      const updated = await apiPatchFormData<any>(
        `${API_ENDPOINTS.PRINCIPALS}${principalId}/`, fd
      )

      // Sync localStorage so navbar popup picks up the new photo
      await refreshUserProfile()

      // Use absolute URL from server response + cache-buster
      const rawPhoto = updated?.photo || null
      const serverPhoto = rawPhoto
        ? `${rawPhoto}${rawPhoto.includes("?") ? "&" : "?"}t=${Date.now()}`
        : null

      // Revoke blob URL only after we have the server URL ready
      URL.revokeObjectURL(objectUrl)

      // Only update if server returned a valid URL; otherwise keep blob preview
      if (serverPhoto) {
        setLocalPhoto(serverPhoto)
      }
      // else: localPhoto still holds blob — user sees preview but upload may have failed

      // Patch localStorage with cache-busted URL so navbar shows new photo
      if (serverPhoto && typeof window !== "undefined") {
        try {
          const stored = JSON.parse(window.localStorage.getItem("sis_user") || "{}")
          window.localStorage.setItem("sis_user", JSON.stringify({ ...stored, photo: serverPhoto }))
        } catch {}
      }

      setUploadSuccess(true)
      setTimeout(() => setUploadSuccess(false), 3000)

      // Notify navbar in same tab (storage event only fires in OTHER tabs)
      window.dispatchEvent(new Event("storage"))
      window.dispatchEvent(new Event("profile-photo-updated"))
    } catch (err: any) {
      setUploadError(err?.message || "Upload failed. Please try again.")
      setLocalPhoto(null)             // revert preview on error
    } finally {
      setUploading(false)
    }
  }, [principal.principal_id])


  const campus     = principal.campus_name || principal.campus?.campus_name || "—"
  const designation = principal.designation ?? "Principal"

  // Dynamic pending actions built from real stats
  const fallbackActions: PendingActionItem[] = [
    { title: "Result Approvals",     count: stats.pendingApprovals ?? 0, type: "urgent" as const, href: "/admin/principal/result-approval" },
    { title: "Leave Requests",       count: 0, type: "normal" as const,  href: "/admin/principal/requests" },
    { title: "Transfer Requests",    count: 0, type: "normal" as const,  href: "/admin/transfers"          },
    { title: "Coordinator Requests", count: 0, type: "normal" as const,  href: "/admin/principal/requests" },
  ]
  const pendingActions: PendingActionItem[] = (stats.pendingActions ?? fallbackActions)
    .filter(a => a.count > 0 || a.type === "urgent")

  const kpis = [
    {
      label: "Total Students",
      value: loading ? "—" : (stats.totalStudents ?? 0),
      icon: Users,
      colorClass: "text-[#185FA5]",
      bgClass: "bg-blue-50",
      trend: "+4.5%",
    },
    {
      label: "Teaching Staff",
      value: loading ? "—" : (stats.totalTeachers ?? 0),
      icon: GraduationCap,
      colorClass: "text-amber-600",
      bgClass: "bg-amber-50",
    },
    {
      label: "Classrooms",
      value: loading ? "—" : (stats.totalClasses ?? 0),
      icon: BookOpen,
      colorClass: "text-indigo-600",
      bgClass: "bg-indigo-50",
    },
    {
      label: "Attendance Rate",
      value: loading ? "—" : (stats.attendanceRate ?? "—"),
      icon: Activity,
      colorClass: "text-emerald-600",
      bgClass: "bg-emerald-50",
      trend: "+2%",
    },
    {
      label: "Fee Collection",
      value: loading ? "—" : (stats.feeCollection ?? "—"),
      icon: BarChart3,
      colorClass: "text-rose-600",
      bgClass: "bg-rose-50",
    },
  ]

  return (
    <div className="bg-[#f6f8fb]">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-6">

        {/* ── Back to Dashboard button ── */}
        <div className="mb-5">
          <button
            onClick={() => router.push("/admin")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-gray-600 hover:text-[#185FA5] hover:border-[#185FA5]/40 hover:bg-blue-50/50 transition-all duration-200 shadow-sm group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform duration-200" />
            Back to Dashboard
            <LayoutDashboard className="w-3.5 h-3.5 text-gray-300 group-hover:text-[#185FA5]" />
          </button>
        </div>

        {/* ── Campus KPI Row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
                  <Shimmer className="w-11 h-11 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-2 pt-1">
                    <Shimmer className="h-2.5 w-16" />
                    <Shimmer className="h-6 w-10" />
                  </div>
                </div>
              ))
            : kpis.map(k => <KPICard key={k.label} {...k} />)
          }
        </div>

        {/* ── Two-Column Layout ── */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">

          {/* ════ LEFT SIDEBAR (280px) ════ */}
          <div className="w-full lg:w-[280px] flex-shrink-0 space-y-4">

            {/* Profile card */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Blue accent strip */}
              <div className="h-16 bg-[#185FA5]" />

              <div className="px-5 pb-5 -mt-8">
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />

                {/* Avatar + camera button */}
                <div className="relative inline-block mb-3">
                  {loading ? (
                    <Shimmer className="w-16 h-16 rounded-full border-4 border-white" />
                  ) : (
                    <SmartAvatar
                      src={photo}
                      name={name}
                      size="lg"
                      ringClass="ring-4 ring-white shadow-lg"
                    />
                  )}
                  {/* Uploading spinner overlay */}
                  {uploading && (
                    <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    </div>
                  )}
                  {/* Camera / change photo button */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[#185FA5] border-2 border-white flex items-center justify-center shadow-md hover:bg-[#1451a0] disabled:opacity-60 transition-colors"
                    title="Change profile photo"
                  >
                    <Camera className="w-3 h-3 text-white" />
                  </button>
                </div>

                {/* Upload feedback */}
                {uploadError && (
                  <div className="flex items-center gap-1.5 mb-2 px-2 py-1.5 bg-red-50 border border-red-100 rounded-lg">
                    <X className="w-3 h-3 text-red-500 flex-shrink-0" />
                    <span className="text-[10px] text-red-600 font-medium">{uploadError}</span>
                  </div>
                )}
                {uploadSuccess && (
                  <div className="flex items-center gap-1.5 mb-2 px-2 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg">
                    <CheckCircle className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                    <span className="text-[10px] text-emerald-600 font-medium">Photo updated!</span>
                  </div>
                )}

                {/* Name + badges */}
                {loading ? (
                  <div className="space-y-2">
                    <Shimmer className="h-5 w-40" />
                    <Shimmer className="h-4 w-24" />
                  </div>
                ) : (
                  <>
                    <h2 className="text-base font-black text-gray-900 leading-tight mb-1.5">{name}</h2>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#185FA5] border border-blue-100 uppercase tracking-wide">
                        {designation}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide flex items-center gap-1 ${
                        principal.is_currently_active
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                          : "bg-gray-100 text-gray-500 border border-gray-200"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${principal.is_currently_active ? "bg-emerald-500 animate-pulse" : "bg-gray-400"}`} />
                        {principal.is_currently_active ? "Active" : "Inactive"}
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div className="space-y-2">
                      <button className="w-full py-2 text-xs font-bold rounded-lg border border-gray-200 text-gray-700 hover:border-[#185FA5]/40 hover:text-[#185FA5] hover:bg-blue-50/40 transition-all flex items-center justify-center gap-2">
                        <Edit3 className="w-3.5 h-3.5" />
                        Edit Profile
                      </button>
                      <button className="w-full py-2 text-xs font-bold rounded-lg bg-blue-50 text-[#185FA5] border border-blue-100 hover:bg-blue-100 transition-all flex items-center justify-center gap-2">
                        <Key className="w-3.5 h-3.5" />
                        Change Password
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Contact info */}
            <SectionCard title="Contact Information" icon={Phone}>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Shimmer className="w-7 h-7 rounded-lg flex-shrink-0" />
                      <Shimmer className="h-4 flex-1" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <ContactRow icon={Mail}   value={principal.email} />
                  <ContactRow icon={Phone}  value={principal.contact_number} />
                  <ContactRow icon={MapPin} value={principal.permanent_address} />
                  <ContactRow icon={Shield} value={principal.cnic} />
                </>
              )}
            </SectionCard>
          </div>

          {/* ════ RIGHT MAIN CONTENT ════ */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* Pending Actions */}
            <SectionCard
              title="Pending Actions"
              icon={ClipboardList}
              action={
                <a href="/admin/principal/requests" className="text-xs font-semibold text-[#185FA5] hover:underline flex items-center gap-1">
                  View All <ChevronRight className="w-3.5 h-3.5" />
                </a>
              }
            >
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => <Shimmer key={i} className="h-14 rounded-xl" />)}
                </div>
              ) : pendingActions.length === 0 ? (
                <div className="flex items-center justify-center py-6 text-gray-400 gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  All caught up — no pending actions
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingActions.map((a, i) => (
                    <PendingActionRow key={i} title={a.title} count={a.count} type={a.type} href={a.href} />
                  ))}
                  {stats.timetableConflict && (
                    <div className="flex items-center gap-3 p-3.5 bg-orange-50 rounded-xl border border-orange-100">
                      <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0" />
                      <span className="text-sm font-semibold text-orange-800 flex-1">
                        Timetable conflict detected in campus schedule
                      </span>
                      <a
                        href="/admin/principal/timetable-settings"
                        className="text-orange-700 bg-white px-3 py-1.5 rounded-lg border border-orange-200 text-xs font-bold shadow-sm flex items-center gap-1 flex-shrink-0 hover:bg-orange-50 transition-colors"
                      >
                        Resolve <ArrowRight className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              )}
            </SectionCard>

            {/* Quick Actions */}
            <SectionCard title="Quick Actions" icon={Star}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Result Approvals", icon: CheckCircle, href: "/admin/principal/result-approval",   colorClass: "text-emerald-600", bgClass: "bg-emerald-50" },
                  { label: "Leave Requests",   icon: FileText,    href: "/admin/principal/requests",          colorClass: "text-[#185FA5]",   bgClass: "bg-blue-50"    },
                  { label: "Campus Report",    icon: BarChart3,   href: "/admin/principal/timetable-settings",colorClass: "text-violet-600",  bgClass: "bg-violet-50"  },
                  { label: "Announcements",    icon: Megaphone,   href: "/admin/principal/shift-timings",     colorClass: "text-amber-600",   bgClass: "bg-amber-50"   },
                ].map(q => <QuickActionBtn key={q.label} {...q} />)}
              </div>
            </SectionCard>

            {/* Two-col info row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

              {/* Personal Information */}
              <SectionCard title="Personal Information" icon={User}>
                {loading ? (
                  <div className="grid grid-cols-2 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="space-y-1.5">
                        <Shimmer className="h-2.5 w-20" />
                        <Shimmer className="h-4 w-28" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <InfoField label="Date of Birth"  value={fmt(principal.dob)} />
                    <InfoField label="Gender"         value={principal.gender} />
                    <InfoField label="Employee Code"  value={principal.employee_code} />
                    <InfoField label="Joining Date"   value={fmt(principal.joining_date)} />
                  </div>
                )}
              </SectionCard>

              {/* Principal Information */}
              <SectionCard title="Principal Information" icon={Shield}>
                {loading ? (
                  <div className="grid grid-cols-2 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="space-y-1.5">
                        <Shimmer className="h-2.5 w-20" />
                        <Shimmer className="h-4 w-28" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <InfoField label="Campus"         value={campus} />
                    <InfoField label="Shift"          value={principal.shift} />
                    <InfoField label="Designation"    value={principal.designation} />
                    <InfoField label="Contract Type"  value={principal.contract_type} />
                  </div>
                )}
              </SectionCard>
            </div>

            {/* Professional Information */}
            <SectionCard title="Professional Information" icon={Briefcase}>
              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="space-y-1.5">
                      <Shimmer className="h-2.5 w-20" />
                      <Shimmer className="h-4 w-28" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 mb-4">
                    <InfoField label="Education Level"  value={principal.education_level} />
                    <InfoField label="Degree"           value={principal.degree_title} />
                    <InfoField label="Institution"      value={principal.institution_name} />
                    <InfoField label="Year of Passing"  value={principal.year_of_passing?.toString()} />
                    <InfoField label="Experience"       value={principal.total_experience_years ? `${principal.total_experience_years} years` : "—"} />
                  </div>
                  {principal.specialization && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Specializations</p>
                      <div className="flex flex-wrap gap-2">
                        {principal.specialization.split(",").map(s => s.trim()).filter(Boolean).map(tag => (
                          <span key={tag} className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-50 text-[#185FA5] border border-blue-100">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </SectionCard>

            {/* ── Digital Signature ── */}
            <TeacherSignature
              currentSignature={signature}
              onUpdate={(newSig: string) => setSignature(newSig)}
              role="principal"
            />

            {/* System Information */}
            <SectionCard title="System Information" icon={Activity}>
              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-1.5">
                      <Shimmer className="h-2.5 w-20" />
                      <Shimmer className="h-4 w-28" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
                  <InfoField label="Created"      value={fmtShort(principal.created_at)} />
                  <InfoField label="Last Updated" value={fmtShort(principal.updated_at)} />
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Role</p>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-blue-50 text-[#185FA5] border border-blue-100 capitalize">
                      {principal.role ?? "principal"}
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Status</p>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                      principal.is_currently_active
                        ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                        : "bg-gray-100 text-gray-500 border-gray-200"
                    }`}>
                      {principal.is_currently_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              )}
            </SectionCard>

          </div>
        </div>
      </div>
    </div>
  )
}
