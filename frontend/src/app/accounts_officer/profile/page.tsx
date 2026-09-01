"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Mail, Phone, MapPin, Building2, Clock, User,
  Briefcase, Shield, ArrowLeft, Camera, Loader2,
  CreditCard, CalendarDays, XCircle, CheckCircle
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { SmartAvatar } from "@/components/ui/smart-avatar"
import { getCurrentUserProfile, apiPatchFormData, refreshUserProfile, API_ENDPOINTS } from "@/lib/api"

// ── Helper UI ──────────────────────────────────────────────────────────────

const SectionCard = ({ title, icon: Icon, children }: any) => (
  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
    <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-100 bg-gray-50/30">
      <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-[#274c77]" />
      </div>
      <span className="text-sm font-bold text-gray-800 tracking-tight">{title}</span>
    </div>
    <div className="p-5">{children}</div>
  </div>
)

const InfoField = ({ label, value }: { label: string; value?: string | number | null }) => (
  <div className="py-2">
    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">{label}</p>
    <p className="text-sm font-semibold text-gray-800">{value || "—"}</p>
  </div>
)

const ContactRow = ({ icon: Icon, value }: { icon: React.ElementType; value?: string | null }) => {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0 group">
      <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 mt-0.5 border border-gray-100 group-hover:bg-blue-50 group-hover:border-blue-100 transition-colors">
        <Icon className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#274c77] transition-colors" />
      </div>
      <span className="text-sm text-gray-700 break-all leading-snug group-hover:text-[#274c77] transition-colors">{value}</span>
    </div>
  )
}

const formatDate = (d?: string | null) => {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function AccountsOfficerProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Photo upload
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [localPhoto, setLocalPhoto] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)

  useEffect(() => {
    document.title = "My Profile | Newton AMS"
    async function load() {
      try {
        const data = await getCurrentUserProfile()
        if (data) setProfile(data)
        else setError("Failed to load profile")
      } catch (e: any) {
        setError(e.message || "Failed to load profile")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handlePhotoChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!fileInputRef.current) return
    fileInputRef.current.value = ""
    if (!file) return

    if (!file.type.startsWith("image/")) { setUploadError("Please select an image file."); return }
    if (file.size > 5 * 1024 * 1024) { setUploadError("Image must be under 5 MB."); return }

    const objectUrl = URL.createObjectURL(file)
    setLocalPhoto(objectUrl)
    setUploadError(null)
    setUploadSuccess(false)
    setUploading(true)

    try {
      const fd = new FormData()
      fd.append("photo", file)
      const updated = await apiPatchFormData<any>(API_ENDPOINTS.CURRENT_USER_UPLOAD_PHOTO, fd)
      await refreshUserProfile()
      URL.revokeObjectURL(objectUrl)
      const raw = updated?.photo || null
      setLocalPhoto(raw ? `${raw}?t=${Date.now()}` : null)
      setUploadSuccess(true)
      setTimeout(() => setUploadSuccess(false), 3000)
      window.dispatchEvent(new Event("profile-photo-updated"))
    } catch (err: any) {
      setUploadError(err?.message || "Upload failed.")
      setLocalPhoto(null)
    } finally {
      setUploading(false)
    }
  }, [profile])

  if (loading) {
    return (
      <div className="bg-[#f6f8fb] min-h-screen">
        <div className="max-w-[1200px] mx-auto px-4 py-12">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="w-full lg:w-[300px] h-80 bg-white animate-pulse rounded-2xl border border-gray-100" />
            <div className="flex-1 space-y-5">
              <div className="h-40 bg-white animate-pulse rounded-2xl border border-gray-100" />
              <div className="h-40 bg-white animate-pulse rounded-2xl border border-gray-100" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-[#f6f8fb] flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center shadow-xl border-0 rounded-2xl">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-black text-gray-900 mb-2">Profile Error</h2>
          <p className="text-sm text-gray-500 mb-6">{error || "Could not load profile."}</p>
          <Button onClick={() => router.back()} className="w-full py-6 bg-[#274c77] rounded-xl font-bold">
            <ArrowLeft className="w-4 h-4 mr-2" /> Go Back
          </Button>
        </Card>
      </div>
    )
  }

  const displayName = profile.full_name || `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.username
  const photo = localPhoto || profile.photo || profile.profile_image || null
  const campus = profile.campus?.campus_name || "—"

  return (
    <div className="bg-[#f6f8fb] min-h-screen">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-6">

        {/* ── Top Nav ── */}
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-[#274c77] hover:border-[#274c77]/40 transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">My Profile</h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              {profile.username || "Account Office"}
            </p>
          </div>
        </div>

        {/* ── Main Layout ── */}
        <div className="flex flex-col lg:flex-row gap-6">

          {/* ════ SIDEBAR ════ */}
          <div className="w-full lg:w-[300px] flex-shrink-0 space-y-5">

            {/* Profile Card */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="h-24 bg-gradient-to-r from-[#274c77] to-[#6096ba]" />
              <div className="px-6 pb-6 -mt-10 text-center relative z-10">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                <div className="relative inline-block mb-4 group">
                  <SmartAvatar
                    src={photo}
                    name={displayName}
                    size="xl"
                    ringClass="ring-4 ring-white shadow-lg"
                    className="w-24 h-24"
                  />
                  {uploading && (
                    <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    </div>
                  )}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-[#274c77] border-2 border-white flex items-center justify-center shadow-md hover:scale-110 transition-transform"
                    title="Upload Photo"
                  >
                    <Camera className="w-4 h-4 text-white" />
                  </button>
                </div>

                {uploadError && (
                  <p className="text-[10px] font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-lg mb-2 border border-red-100">{uploadError}</p>
                )}
                {uploadSuccess && (
                  <p className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg mb-2 border border-emerald-100 flex items-center justify-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Photo Updated!
                  </p>
                )}

                <h2 className="text-lg font-black text-gray-900 tracking-tight leading-none mb-1">{displayName}</h2>

                <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
                  <Badge className="bg-blue-50 text-[#274c77] border-blue-100 text-[10px] uppercase font-black px-2.5 py-1">
                    <Shield className="w-3 h-3 mr-1" />
                    Accounts Officer
                  </Badge>
                  <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[10px] uppercase font-black px-2.5 py-1">
                    Active
                  </Badge>
                </div>

                <div className="space-y-1 text-left mt-4">
                  <ContactRow icon={Mail} value={profile.email} />
                  <ContactRow icon={Phone} value={profile.contact_number || profile.phone_number} />
                  <ContactRow icon={Building2} value={campus !== "—" ? campus : null} />
                </div>
              </div>
            </div>

            {/* Organization */}
            <SectionCard title="Organization" icon={Building2}>
              <div className="space-y-1">
                <InfoField label="Campus" value={campus} />
                <InfoField label="Username / ID" value={profile.username} />
                <InfoField label="Joined" value={formatDate(profile.joining_date || profile.date_joined)} />
              </div>
            </SectionCard>
          </div>

          {/* ════ MAIN WORKSPACE ════ */}
          <div className="flex-1 space-y-5">

            {/* Identity */}
            <SectionCard title="Identity & Information" icon={User}>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6">
                <InfoField label="Full Name" value={displayName} />
                <InfoField label="Username" value={profile.username} />
                <InfoField label="Email" value={profile.email} />
                <InfoField label="Contact" value={profile.contact_number || profile.phone_number} />
                <InfoField label="Role" value="Accounts Officer" />
                <InfoField label="Campus" value={campus} />
              </div>
            </SectionCard>

            {/* Professional */}
            <SectionCard title="Professional Details" icon={Briefcase}>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6">
                <InfoField label="Department" value="Accounts & Finance" />
                <InfoField label="Campus" value={campus} />
                <InfoField label="Joining Date" value={formatDate(profile.joining_date || profile.date_joined)} />
                <InfoField label="Status" value="Active" />
              </div>
            </SectionCard>

            {/* Account Maintenance */}
            <SectionCard title="Account Maintenance" icon={Clock}>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6">
                <InfoField label="Account Created" value={formatDate(profile.date_joined || profile.created_at)} />
                <InfoField label="Last Updated" value={formatDate(profile.updated_at)} />
                <InfoField label="Account Status" value={profile.is_active !== false ? "Active" : "Inactive"} />
              </div>
            </SectionCard>

          </div>
        </div>
      </div>
    </div>
  )
}
