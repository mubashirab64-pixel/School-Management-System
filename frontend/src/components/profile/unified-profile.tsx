"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  Mail, Phone, MapPin, Shield, Calendar, GraduationCap,
  Building2, Clock, Award, Briefcase, Edit3, Key,
  Users, ClipboardList, CheckCircle, FileText, Megaphone,
  BarChart3, AlertTriangle, ArrowRight, ChevronRight,
  TrendingUp, User, Activity, Star, BookOpen, ArrowLeft,
  LayoutDashboard, Camera, Loader2, X, Info, XCircle, CalendarDays } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  getCurrentUserProfile,
  apiPatchFormData,
  apiPatch,
  refreshUserProfile,
  API_ENDPOINTS
} from "@/lib/api"
import { SmartAvatar } from "@/components/ui/smart-avatar"
import TeacherSignature from "@/components/signature/TeacherSignature"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import StudentAttendanceCalendar from '@/components/attendance/student-attendance-calendar'
import { StaffAttendanceSection } from '@/components/attendance/staff-attendance-section'

interface ProfileData {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  role: string
  campus?: {
    id: number
    campus_name: string
    campus_code: string
  }
  // Teacher specific
  teacher_id?: number
  full_name?: string
  dob?: string
  gender?: string
  contact_number?: string
  cnic?: string
  permanent_address?: string
  education_level?: string
  institution_name?: string
  year_of_passing?: number
  total_experience_years?: number
  profile_image?: string
  employee_code?: string
  joining_date?: string
  is_class_teacher?: boolean
  is_currently_active?: boolean
  assigned_classroom?: {
    id: number
    name: string
    grade: string
    section: string
    shift: string
  }
  assigned_classrooms?: Array<{
    id: number
    name: string
    grade: string
    section: string
    shift: string
  }>
  current_campus?: {
    id: number
    campus_name: string
    campus_code: string
  }
  created_at?: string
  updated_at?: string
  // Coordinator specific
  coordinator_id?: number
  can_assign_class_teachers?: boolean
  level?: {
    id: number
    name: string
    code: string
  }
  // Principal specific
  principal_id?: number
  shift?: string
  // Signature
  signature?: string | null
  // Student specific
  student_id?: string
  student_db_id?: number
  name?: string
  father_name?: string
  father_cnic?: string
  father_contact?: string
  father_occupation?: string
  mother_name?: string
  mother_cnic?: string
  mother_contact?: string
  mother_occupation?: string
  guardian_name?: string
  guardian_contact?: string
  guardian_relation?: string
  photo?: string
  student_id_number?: string
  admission_date?: string
  current_state?: string
  classroom?: {
    id: number
    name: string
    grade: string
    section: string
    shift: string
  }
  // Admin specific
  role_display?: string
  is_verified?: boolean
  is_active?: boolean
  enrollment_status?: string
  last_login?: string
}


// ── Helper UI Components ──────────
const SectionCard = ({ title, icon: Icon, children, className = "", action }: any) => (
  <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm ${className}`}>
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50/30">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-[#185FA5]" />
        </div>
        <span className="text-sm font-bold text-gray-800 tracking-tight">{title}</span>
      </div>
      {action}
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
        <Icon className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#185FA5] transition-colors" />
      </div>
      <span className="text-sm text-gray-700 break-all leading-snug group-hover:text-[#185FA5] transition-colors">{value}</span>
    </div>
  )
}

const getRoleIcon = (role: string) => {
  switch (role) {
    case 'teacher': return GraduationCap
    case 'coordinator': return Users
    case 'principal': return Shield
    case 'student': return BookOpen
    case 'admin': return Shield
    default: return User
  }
}

const formatDate = (dateString: string) => {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}




export default function UnifiedProfile() {
  const router = useRouter()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Photo Upload ──
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [localPhoto, setLocalPhoto] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editFormData, setEditFormData] = useState<any>({})
  const { toast } = useToast()

  useEffect(() => {
    async function fetchProfile() {
      try {
        const data = await getCurrentUserProfile()
        if (data) {
          setProfile(data as ProfileData)
        } else {
          setError('Failed to load profile data')
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load profile')
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [])

  const role = profile?.role
  const displayName = profile ? (profile.full_name || profile.name || `${profile.first_name} ${profile.last_name}`.trim() || profile.username) : ""
  const photo = localPhoto || profile?.profile_image || profile?.photo || null
  const campus = profile?.current_campus?.campus_name || profile?.campus?.campus_name || "—"
  const RoleIcon = role ? getRoleIcon(role) : User

  const handlePhotoChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!fileInputRef.current || !profile) return
    fileInputRef.current.value = ""
    if (!file) return

    if (!file.type.startsWith("image/")) {
      setUploadError("Please select an image.")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Size must be under 5MB.")
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setLocalPhoto(objectUrl)
    setUploadError(null)
    setUploading(true)

    try {
      const fd = new FormData()
      fd.append("photo", file)

      // Use the universal endpoint for all roles
      const endpoint = API_ENDPOINTS.CURRENT_USER_UPLOAD_PHOTO

      const updated = await apiPatchFormData<any>(endpoint, fd)
      await refreshUserProfile()

      URL.revokeObjectURL(objectUrl)
      const raw = updated?.photo || updated?.profile_image || null
      setLocalPhoto(raw ? `${raw}?t=${Date.now()}` : null)
      setUploadSuccess(true)
      setTimeout(() => setUploadSuccess(false), 3000)
      window.dispatchEvent(new Event("profile-photo-updated"))
    } catch (err: any) {
      setUploadError(err?.message || "Upload failed")
      setLocalPhoto(null)
    } finally {
      setUploading(false)
    }
  }, [profile])

  const openEditModal = () => {
    if (!profile) return
    setEditFormData({
      name: profile.name || profile.full_name || "",
      first_name: profile.first_name || "",
      last_name: profile.last_name || "",
      email: profile.email || "",
      contact_number: profile.contact_number || "",
      permanent_address: profile.permanent_address || "",
      father_name: profile.father_name || "",
      father_contact: profile.father_contact || "",
      mother_name: profile.mother_name || "",
      guardian_name: profile.guardian_name || "",
      guardian_contact: profile.guardian_contact || "",
    })
    setIsEditModalOpen(true)
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    // ── Email Validation Rules ──
    const newEmail = editFormData.email?.trim()
    const currentEmail = profile.email?.trim()

    // 1. Email field must not be empty
    if (!newEmail) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Email address cannot be empty.",
      })
      return
    }

    // 2. Email must be in valid format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmail)) {
      toast({
        variant: "destructive",
        title: "Invalid Format",
        description: "Please enter a valid email address (example@domain.com).",
      })
      return
    }

    // 5. If email is same as current email
    if (newEmail === currentEmail) {
      toast({
        variant: "destructive",
        title: "No Change Detected",
        description: "New email cannot be same as current email.",
      })
      return
    }

    setIsSubmitting(true)
    try {
      // 3. Check if the new email already exists in the database (only if changed)
      if (newEmail !== currentEmail) {
        const { checkEmailExists } = await import("@/lib/api")
        const exists = await checkEmailExists(newEmail)

        // 4. If email already exists 
        if (exists) {
          toast({
            variant: "destructive",
            title: "Email In Use",
            description: "This email address is already in use. Please use a different email.",
          })
          setIsSubmitting(false)
          return
        }
      }

      // 1. Prepare User Payload (Email, Names etc)
      const userPayload = {
        email: newEmail,
        ...(role !== 'student' && {
          first_name: editFormData.first_name,
          last_name: editFormData.last_name,
        })
      };

      // 2. Prepare Role Payload (Contact, etc)
      const rolePayload: any = {
        contact_number: editFormData.contact_number,
      };

      let userUpdateSuccessful = false;

      // 3. Attempt direct User Update (may fail with 403 for students)
      try {
        await apiPatch(`${API_ENDPOINTS.USERS}${profile.id}/`, userPayload);
        userUpdateSuccessful = true;
      } catch (userErr: any) {
        console.warn("Direct user update failed (common for students):", userErr);
        // If it's a 403, we'll try to nest it in the student update if applicable
      }

      // 4. Attempt Role-Specific Update
      if (role === 'student' && profile.student_db_id) {
        // For students, try to include the user data nested if direct user update failed
        const nestedPayload = {
          ...rolePayload,
          ...(!userUpdateSuccessful && {
            user: { email: editFormData.email }
          })
        };
        await apiPatch(`${API_ENDPOINTS.STUDENTS}${profile.student_db_id}/`, nestedPayload);
      } else if (role === 'teacher' && profile.teacher_id) {
        // For teachers, try the same nested approach
        const nestedPayload = {
          ...rolePayload,
          ...(!userUpdateSuccessful && {
            user: { email: editFormData.email }
          })
        };
        await apiPatch(`${API_ENDPOINTS.TEACHERS}${profile.teacher_id}/`, nestedPayload);
      } else if (role !== 'student' && role !== 'teacher' && !userUpdateSuccessful) {
        // If we are another role (admin etc) and the user patch failed, throw the error
        throw new Error("Failed to update user profile records.");
      }

      // Refresh global profile state
      await refreshUserProfile()
      const updatedData = await getCurrentUserProfile()
      if (updatedData) setProfile(updatedData as ProfileData)

      setIsEditModalOpen(false)
      toast({
        title: "Profile Updated",
        description: "Your details have been successfully updated.",
      })
      window.dispatchEvent(new Event("profile-updated"))
    } catch (err: any) {
      console.error("Profile update error:", err);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: err.message || "Could not update profile.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-[#f6f8fb] min-h-screen">
        <div className="max-w-[1500px] mx-auto px-4 py-12">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="w-full lg:w-[320px] h-96 bg-white animate-pulse rounded-2xl border border-gray-100" />
            <div className="flex-1 h-[600px] bg-white animate-pulse rounded-2xl border border-gray-100" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-[#f6f8fb] flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center shadow-xl border-0 rounded-2xl">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-gray-900 mb-2">Profile Error</h2>
          <p className="text-sm text-gray-500 mb-6">{error || "Could not retrieve your profile."}</p>
          <Button onClick={() => router.back()} className="w-full py-6 bg-[#185FA5] rounded-xl font-bold transition-all shadow-lg shadow-blue-200/50">
            <ArrowLeft className="w-4 h-4 mr-2" /> Go Back
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="bg-[#f6f8fb] min-h-screen">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-6">

        {/* ── Top Navigation ── */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-[#185FA5] hover:border-[#185FA5]/40 transition-all shadow-sm"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight">Bank To Dashboard </h1>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{profile.employee_code || profile.student_id_number || "User ID"}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Update button removed as per request */}
          </div>
        </div>

        {/* ── Main Layout ── */}
        <div className="flex flex-col lg:flex-row gap-6">

          {/* ════ SIDEBAR PORTFOLIO ════ */}
          <div className="w-full lg:w-[320px] flex-shrink-0 space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="h-24 bg-gradient-to-r from-[#185FA5] to-[#1e3a5f]" />
              <div className="px-6 pb-6 -mt-10 text-center relative z-10">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                <div className="relative inline-block mb-4 group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <SmartAvatar src={photo} name={displayName} size="xl" ringClass="ring-4 ring-white shadow-lg" className="w-24 h-24" />
                  {uploading && (
                    <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center backdrop-blur-[1px]">
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    </div>
                  )}
                  <div className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#185FA5] border-2 border-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Camera className="w-4 h-4 text-white" />
                  </div>
                </div>

                <h2 className="text-lg font-black text-gray-900 tracking-tight leading-none mb-1">{displayName}</h2>
                <div className="flex items-center justify-center gap-2 mb-4">
                  <Badge className="bg-blue-50 text-[#185FA5] hover:bg-blue-100 border-blue-100 text-[10px] uppercase font-black px-2.5 py-1">
                    {role}
                  </Badge>
                  {/* Students reflect is_active (drops when Left/inactive); staff use is_currently_active */}
                  {(role === 'student' ? profile.is_active !== false : profile.is_currently_active !== false) ? (
                    <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[10px] uppercase font-black px-2.5 py-1">Active</Badge>
                  ) : (
                    <Badge className="bg-rose-50 text-rose-600 border-rose-100 text-[10px] uppercase font-black px-2.5 py-1">Inactive</Badge>
                  )}
                </div>

                {uploadError && <p className="text-[10px] font-bold text-red-500 bg-red-50 p-2 rounded-lg mb-4 border border-red-100">{uploadError}</p>}
                {/* {uploadSuccess && <p className="text-[10px] font-bold text-emerald-600 bg-emerald-50 p-2 rounded-lg mb-4 border border-emerald-100">Profile Updated!</p>} */}

                <div className="space-y-1 text-left mt-6">
                  <ContactRow icon={Mail} value={profile.email} />
                  <ContactRow icon={Phone} value={profile.contact_number || profile.father_contact} />
                  <ContactRow icon={MapPin} value={profile.permanent_address} />
                </div>
              </div>
            </div>

            <SectionCard title="Organization Context" icon={Building2}>
              <div className="space-y-4">
                <InfoField label="Primary Campus" value={campus} />
                {role === 'teacher' && <InfoField label="Employee Code" value={profile.employee_code} />}
                {role === 'student' && <InfoField label="Student Number" value={profile.student_id_number} />}
                <InfoField label="Joined System" value={formatDate(profile.joining_date || profile.admission_date || "")} />
              </div>
            </SectionCard>
          </div>

          {/* ════ MAIN WORKSPACE ════ */}
          <div className="flex-1 space-y-6">

            {/* ── Section 1: Overview ── */}
            <SectionCard title="Identity & Biographics" icon={User}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <InfoField label="Full Name" value={displayName} />
                <InfoField label="Gender" value={profile.gender} />
                <InfoField label="Birthday" value={formatDate(profile.dob || "")} />
                <InfoField label="CNIC / Identifier" value={profile.cnic} />
                <InfoField label="Username" value={profile.username} />
                <InfoField label="Account Level" value={profile.role_display || role} />
              </div>
            </SectionCard>

            {/* ── Section 2: Professional / Academic ── */}
            <SectionCard title={role === 'student' ? "Academic Standing" : "Professional Portfolio"} icon={role === 'student' ? BookOpen : Briefcase}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {role === 'teacher' && (
                  <>
                    <InfoField label="Education Level" value={profile.education_level} />
                    <InfoField label="Institution" value={profile.institution_name} />
                    <InfoField label="Passing Year" value={profile.year_of_passing} />
                    <InfoField label="Experience (Years)" value={profile.total_experience_years} />
                    <InfoField label="Class Teacher" value={profile.is_class_teacher ? "Yes" : "No"} />
                  </>
                )}
                {role === 'student' && (
                  <>
                    <InfoField label="Current Grade" value={profile.classroom?.grade} />
                    <InfoField label="Section" value={profile.classroom?.section} />
                    <InfoField label="Shift" value={profile.classroom?.shift} />
                    <InfoField label="Enrollment Status" value={
                      ({ enrolled: 'Enrolled', left: 'Left', re_enrolled: 'Re-enrolled', graduated: 'Graduated', transferred: 'Transferred' } as Record<string, string>)[profile.enrollment_status || ''] || profile.enrollment_status
                    } />
                  </>
                )}
                {role === 'coordinator' && (
                  <>
                    <InfoField label="Assigned Level" value={profile.level?.name} />
                    <InfoField label="Level Code" value={profile.level?.code} />
                    <InfoField label="Permission: Assign Teachers" value={profile.can_assign_class_teachers ? "Allowed" : "Restricted"} />
                  </>
                )}
                {role === 'principal' && (
                  <>
                    <InfoField label="Campus Head" value={profile.campus?.campus_name} />
                    <InfoField label="Assigned Shift" value={profile.shift} />
                  </>
                )}
              </div>
            </SectionCard>

            {/* ── Attendance calendar (Students Only) ── */}
            {role === 'student' && profile.student_db_id && (
              <SectionCard title="Attendance" icon={CalendarDays}>
                <StudentAttendanceCalendar studentId={profile.student_db_id} />
              </SectionCard>
            )}

            {/* ── Staff attendance calendar (own attendance — Teacher/Coordinator/Principal) ── */}
            {(role === 'teacher' || role === 'coordinator' || role === 'principal') && profile.id && (
              <SectionCard title="My Attendance" icon={CalendarDays}>
                <StaffAttendanceSection userId={profile.id} />
              </SectionCard>
            )}

            {/* ── Section 3: Family (Students Only) ── */}
            {role === 'student' && (
              <SectionCard title="Guardian Details" icon={Users}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-[#185FA5] uppercase border-b pb-1">Father's Information</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <InfoField label="Name" value={profile.father_name} />
                      <InfoField label="Occupation" value={profile.father_occupation} />
                      <InfoField label="Contact" value={profile.father_contact} />
                      <InfoField label="CNIC" value={profile.father_cnic} />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-[#185FA5] uppercase border-b pb-1">Mother's Information</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <InfoField label="Name" value={profile.mother_name} />
                      <InfoField label="Occupation" value={profile.mother_occupation} />
                    </div>
                  </div>
                  {(profile.guardian_name) && (
                    <div className="space-y-3 md:col-span-2">
                      <h4 className="text-[10px] font-black text-[#185FA5] uppercase border-b pb-1">Guardian / Emergency</h4>
                      <div className="grid grid-cols-3 gap-4">
                        <InfoField label="Name" value={profile.guardian_name} />
                        <InfoField label="Relation" value={profile.guardian_relation} />
                        <InfoField label="Contact" value={profile.guardian_contact} />
                      </div>
                    </div>
                  )}
                </div>
              </SectionCard>
            )}

            {/* ── Digital Signature Section ── */}
            {(role === 'teacher' || role === 'coordinator' || role === 'principal') && (
              <TeacherSignature
                currentSignature={profile.signature}
                onUpdate={(newSig: string) => setProfile(prev => prev ? {...prev, signature: newSig} : prev)}
                role={role}
              />
            )}

            {/* ── Section 4: Maintenance ── */}
            <SectionCard title="Account Maintenance" icon={Clock}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <InfoField label="Last Profile Sync" value={formatDate(profile.updated_at || "")} />
                <InfoField label="Account Created" value={formatDate(profile.created_at || "")} />
                <InfoField label="Email Status" value={profile.email ? "Verified Primary" : "Not Set"} />
              </div>
            </SectionCard>

          </div>
        </div>
      </div>
      {/* ── Edit Profile Modal ── */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border-0 shadow-2xl p-0">
          <form onSubmit={handleUpdateProfile}>
            {/* <DialogHeader className="p-6 border-b bg-gray-50/50">
              <DialogTitle className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Edit3 className="w-4 h-4 text-[#185FA5]" />
                </div>
                Update Your Details
              </DialogTitle>
            </DialogHeader> */}

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Identity */}
                <div className="space-y-4 md:col-span-2">
                  <h3 className="text-[10px] font-black text-[#185FA5] uppercase tracking-widest flex items-center gap-2">
                    <User className="w-3 h-3" /> Basic Identity
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {role === 'student' ? (
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="name" className="text-xs font-bold text-gray-500 flex items-center justify-between">
                          <span>Full Name</span>
                          <span className="text-[9px] font-black uppercase text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <Shield className="w-2 h-2" /> Admin Only
                          </span>
                        </Label>
                        <Input
                          id="name"
                          value={editFormData.name}
                          disabled
                          className="rounded-xl border-gray-200 bg-gray-50/50 text-gray-400 cursor-not-allowed"
                        />
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="first_name" className="text-xs font-bold text-gray-600">First Name</Label>
                          <Input
                            id="first_name"
                            value={editFormData.first_name}
                            onChange={e => setEditFormData({ ...editFormData, first_name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="last_name" className="text-xs font-bold text-gray-600">Last Name</Label>
                          <Input
                            id="last_name"
                            value={editFormData.last_name}
                            onChange={e => setEditFormData({ ...editFormData, last_name: e.target.value })}
                          />
                        </div>
                      </>
                    )}
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="email" className="text-xs font-bold text-gray-600">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="yourname@example.com"
                        value={editFormData.email}
                        onChange={e => setEditFormData({ ...editFormData, email: e.target.value })}
                        className="rounded-xl border-gray-200 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Contact & Location */}
                <div className="space-y-4 md:col-span-2">
                  <h3 className="text-[10px] font-black text-[#185FA5] uppercase tracking-widest flex items-center gap-2">
                    <Phone className="w-3 h-3" /> Contact & Communication
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="contact_number" className="text-xs font-bold text-gray-600">Primary Contact</Label>
                      <Input
                        id="contact_number"
                        value={editFormData.contact_number}
                        onChange={e => setEditFormData({ ...editFormData, contact_number: e.target.value })}
                        className="rounded-xl border-gray-200 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="permanent_address" className="text-xs font-bold text-gray-500 flex items-center justify-between">
                        <span>Permanent Address</span>
                        {role === 'student' && (
                          <span className="text-[9px] font-black uppercase text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <Shield className="w-2 h-2" /> Admin Only
                          </span>
                        )}
                      </Label>
                      <Input
                        id="permanent_address"
                        value={editFormData.permanent_address}
                        onChange={e => setEditFormData({ ...editFormData, permanent_address: e.target.value })}
                        disabled={role === 'student'}
                        className={`rounded-xl border-gray-200 ${role === 'student' ? 'bg-gray-50/50 text-gray-400 cursor-not-allowed' : 'focus:ring-blue-500'}`}
                      />
                    </div>
                  </div>
                </div>

                {/* Family (Student Only) */}
                {role === 'student' && (
                  <div className="space-y-4 md:col-span-2 bg-amber-50/30 p-4 rounded-xl border border-amber-100/50">
                    <h3 className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-2">
                      <Shield className="w-3 h-3" /> Locked Records (Academic & Family)
                    </h3>
                    <p className="text-[10px] text-amber-500/70 font-medium leading-tight mb-2">The following details are managed by the school administration and cannot be edited directly.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-[9px] font-bold text-gray-400 uppercase">Father's Name</p>
                        <p className="text-xs font-semibold text-gray-600">{editFormData.father_name || "—"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-bold text-gray-400 uppercase">Father's Contact</p>
                        <p className="text-xs font-semibold text-gray-600">{editFormData.father_contact || "—"}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="p-6 border-t bg-gray-50/30 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
                className="rounded-xl border-gray-200"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#185FA5] hover:bg-[#1451a0] text-white font-bold rounded-xl px-8 shadow-lg shadow-blue-100"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
