"use client"

import React, { useEffect, useState, useMemo, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  GraduationCap,
  User,
  Building2,
  Users,
  Shield,
  XCircle,
  Layers,
  Activity,
  TrendingUp,
  FileText,
  Eye,
  BarChart3,
  Briefcase,
  Clock,
  Camera,
  Loader2,
  Calendar,
} from "lucide-react"
import { getApiBaseUrl, getCoordinatorGeneralStats, getCoordinatorClassrooms, getLevelAttendanceSummary, apiPatchFormData, API_ENDPOINTS } from "@/lib/api"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { StaffAttendanceSection } from "@/components/attendance/staff-attendance-section"
import { getCurrentUserRole } from "@/lib/permissions"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SmartAvatar } from "@/components/ui/smart-avatar"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

interface CoordinatorProfile {
  id: number
  full_name: string
  email: string
  photo?: string | null
  contact_number?: string
  dob?: string
  gender?: string
  permanent_address?: string
  cnic?: string
  marital_status?: string
  religion?: string
  campus?: { id: number; campus_name: string; campus_code?: string }
  campus_name?: string
  level?: { id: number; name: string; code?: string }
  level_name?: string
  assigned_levels?: Array<{ id: number; name: string; shift: string; shift_display?: string; code?: string }>
  assigned_levels_details?: Array<{ id: number; name: string; shift: string; shift_display?: string; code?: string }>
  shift?: string
  joining_date?: string
  is_currently_active: boolean
  can_assign_class_teachers?: boolean
  education_level?: string
  institution_name?: string
  year_of_passing?: number
  total_experience_years?: number
  employee_code?: string
  user_id?: number | null
  created_at?: string
  updated_at?: string
}

interface ClassroomData {
  id: number
  name: string
  code: string
  grade: string
  section: string
  shift: string
  level?: { id: number; name: string } | null
  class_teacher?: { id: number; full_name: string; employee_code?: string } | null
  student_count: number
  capacity: number
}

interface DashboardStats {
  total_teachers: number
  total_students: number
  total_classes: number
  pending_requests: number
}

interface AttendanceSummary {
  level_id?: number
  date_range?: { start_date: string; end_date: string }
  summary: {
    total_classrooms: number
    total_students: number
    total_present: number
    total_absent: number
    overall_percentage: number
  }
  classrooms: Array<{
    classroom: { id: number; name: string; grade?: string; section?: string; shift: string }
    student_count: number
    average_percentage: number
    total_present?: number
    total_absent?: number
    last_attendance?: string | null
  }>
}

// ── Helper UI ──────────────────────────────────────────────────────────────

const SectionCard = ({ title, icon: Icon, children, className = "", action }: any) => (
  <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm ${className}`}>
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50/30">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-[#274c77]" />
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
        <Icon className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#274c77] transition-colors" />
      </div>
      <span className="text-sm text-gray-700 break-all leading-snug group-hover:text-[#274c77] transition-colors">{value}</span>
    </div>
  )
}

const formatDate = (dateString?: string) => {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const getShiftDisplay = (shift?: string) => {
  if (!shift) return '—'
  const map: Record<string, string> = {
    morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening',
    both: 'Morning + Afternoon', all: 'All Shifts'
  }
  return map[shift] || shift
}

const COLORS = ['#6096ba', '#274c77', '#a3cef1', '#f7b801', '#ff6b6b', '#4ecdc4']

// ── Main Page ──────────────────────────────────────────────────────────────

export default function CoordinatorProfilePage() {
  const params = useParams()
  const router = useRouter()
  const [coordinator, setCoordinator] = useState<CoordinatorProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPrincipal, setIsPrincipal] = useState(false)

  // Photo upload
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [localPhoto, setLocalPhoto] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)

  // Principal view data
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null)
  const [classrooms, setClassrooms] = useState<ClassroomData[]>([])
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [loadingClassrooms, setLoadingClassrooms] = useState(false)
  const [loadingAttendance, setLoadingAttendance] = useState(false)

  // Active section for principal
  const [activeSection, setActiveSection] = useState<'overview' | 'classrooms' | 'attendance' | 'staff_attendance' | null>(null)

  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0])

  useEffect(() => {
    document.title = "Coordinator Profile | Newton AMS"
    const userRole = getCurrentUserRole()
    setIsPrincipal(userRole === 'principal')
  }, [])

  useEffect(() => {
    async function loadCoordinator() {
      try {
        setLoading(true)
        const baseUrl = getApiBaseUrl()
        const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
        const response = await fetch(`${cleanBase}/api/coordinators/${params.id}/`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('sis_access_token')}`,
            'Content-Type': 'application/json'
          }
        })
        if (!response.ok) { setError("Coordinator not found"); return }
        const data = await response.json()
        setCoordinator(data)
        const userRole = getCurrentUserRole()
        if (userRole === 'principal' && data.id) {
          setTimeout(() => loadPrincipalData(data.id), 100)
        }
      } catch {
        setError("Failed to load coordinator profile")
      } finally {
        setLoading(false)
      }
    }
    if (params.id) loadCoordinator()
  }, [params.id])

  async function loadPrincipalData(coordinatorId: number) {
    setLoadingStats(true)
    try {
      const stats = await getCoordinatorGeneralStats(coordinatorId) as any
      if (stats?.stats) setDashboardStats(stats.stats)
    } catch { /* ignore */ } finally { setLoadingStats(false) }

    setLoadingClassrooms(true)
    try {
      const data = await getCoordinatorClassrooms(coordinatorId)
      setClassrooms(Array.isArray(data) ? data : [])
    } catch { setClassrooms([]) } finally { setLoadingClassrooms(false) }
  }

  async function loadAttendanceSummary(customStart?: string, customEnd?: string) {
    if (!coordinator) return
    const start = (customStart || startDate).split('T')[0]
    const end = (customEnd || endDate).split('T')[0]
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(start) || !dateRegex.test(end)) return

    setLoadingAttendance(true)
    try {
      const assignedLevels = coordinator.assigned_levels_details || coordinator.assigned_levels || []
      const primaryLevel = coordinator.level || (assignedLevels.length > 0 ? assignedLevels[0] : null)
      if (primaryLevel?.id) {
        const response = await getLevelAttendanceSummary(primaryLevel.id, start, end) as any
        if (response?.summary && response?.classrooms) setAttendanceSummary(response)
        else setAttendanceSummary(null)
      }
    } catch { setAttendanceSummary(null) } finally { setLoadingAttendance(false) }
  }

  useEffect(() => {
    if (coordinator?.id && isPrincipal) loadAttendanceSummary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordinator?.id, isPrincipal])

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
      const updated = await apiPatchFormData<any>(`${API_ENDPOINTS.COORDINATORS}${coordinator?.id}/`, fd)
      URL.revokeObjectURL(objectUrl)
      const raw = updated?.photo || null
      setLocalPhoto(raw ? `${raw}?t=${Date.now()}` : null)
      setUploadSuccess(true)
      setTimeout(() => setUploadSuccess(false), 3000)
    } catch (err: any) {
      setUploadError(err?.message || "Upload failed.")
      setLocalPhoto(null)
    } finally {
      setUploading(false)
    }
  }, [coordinator])

  const handleDateFilter = () => {
    if (!coordinator || !startDate || !endDate) return
    if (new Date(startDate) > new Date(endDate)) { toast.error('Start date must be before end date'); return }
    loadAttendanceSummary(startDate.split('T')[0], endDate.split('T')[0])
  }

  const statsChartData = useMemo(() => {
    if (!dashboardStats) return []
    return [
      { name: 'Students', value: dashboardStats.total_students, color: '#6096ba' },
      { name: 'Teachers', value: dashboardStats.total_teachers, color: '#274c77' },
      { name: 'Classes', value: dashboardStats.total_classes, color: '#a3cef1' },
      { name: 'Requests', value: dashboardStats.pending_requests, color: '#f7b801' }
    ]
  }, [dashboardStats])

  const attendanceChartData = useMemo(() => {
    if (!attendanceSummary?.classrooms?.length) return []
    return attendanceSummary.classrooms.slice(0, 10).map(item => ({
      name: item.classroom?.name || `${item.classroom?.grade || ''}-${item.classroom?.section || ''}`,
      attendance: item.average_percentage || 0,
      present: item.total_present || 0,
      absent: item.total_absent || 0
    }))
  }, [attendanceSummary])

  const attendancePieData = useMemo(() => {
    if (!attendanceSummary?.summary) return []
    return [
      { name: 'Present', value: attendanceSummary.summary.total_present || 0, color: '#10b981' },
      { name: 'Absent', value: attendanceSummary.summary.total_absent || 0, color: '#ef4444' }
    ]
  }, [attendanceSummary])

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

  if (error || !coordinator) {
    return (
      <div className="min-h-screen bg-[#f6f8fb] flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center shadow-xl border-0 rounded-2xl">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-gray-900 mb-2">Profile Not Found</h2>
          <p className="text-sm text-gray-500 mb-6">{error || "Could not retrieve coordinator profile."}</p>
          <Button onClick={() => router.back()} className="w-full py-6 bg-[#274c77] rounded-xl font-bold">
            <ArrowLeft className="w-4 h-4 mr-2" /> Go Back
          </Button>
        </Card>
      </div>
    )
  }

  const assignedLevels = coordinator.assigned_levels_details || coordinator.assigned_levels || []
  const hasMultipleLevels = assignedLevels.length > 1
  const primaryLevel = coordinator.level || (assignedLevels.length > 0 ? assignedLevels[0] : null)
  const campusName = coordinator.campus_name || coordinator.campus?.campus_name || '—'

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
            <h1 className="text-xl font-black text-gray-900 tracking-tight">Coordinator Profile</h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              {coordinator.employee_code || `ID: ${coordinator.id}`}
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
                    src={localPhoto || coordinator.photo || null}
                    name={coordinator.full_name}
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
                  <p className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-1 rounded-lg mb-2 border border-red-100">{uploadError}</p>
                )}
                {uploadSuccess && (
                  <p className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg mb-2 border border-emerald-100">Photo Updated!</p>
                )}

                <h2 className="text-lg font-black text-gray-900 tracking-tight leading-none mb-1">
                  {coordinator.full_name}
                </h2>

                <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
                  <Badge className="bg-blue-50 text-[#274c77] border-blue-100 text-[10px] uppercase font-black px-2.5 py-1">
                    <Shield className="w-3 h-3 mr-1" />
                    Coordinator
                  </Badge>
                  {coordinator.is_currently_active ? (
                    <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[10px] uppercase font-black px-2.5 py-1">
                      Active
                    </Badge>
                  ) : (
                    <Badge className="bg-red-50 text-red-500 border-red-100 text-[10px] uppercase font-black px-2.5 py-1">
                      Inactive
                    </Badge>
                  )}
                </div>

                <div className="space-y-1 text-left mt-4">
                  <ContactRow icon={Mail} value={coordinator.email} />
                  <ContactRow icon={Phone} value={coordinator.contact_number} />
                  <ContactRow icon={MapPin} value={coordinator.permanent_address} />
                </div>
              </div>
            </div>

            {/* Organization */}
            <SectionCard title="Organization" icon={Building2}>
              <div className="space-y-1">
                <InfoField label="Campus" value={campusName} />
                <InfoField label="Employee Code" value={coordinator.employee_code} />
                <InfoField label="Joined" value={formatDate(coordinator.joining_date)} />
              </div>
            </SectionCard>

            {/* Level Assignment */}
            <SectionCard title="Level Assignment" icon={Layers}>
              <div className="space-y-1">
                <InfoField label="Shift" value={getShiftDisplay(coordinator.shift)} />
                {hasMultipleLevels ? (
                  <div className="py-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Assigned Levels</p>
                    <div className="flex flex-wrap gap-1.5">
                      {assignedLevels.map((lvl: any) => (
                        <Badge key={lvl.id} className="bg-[#274c77] text-white text-[10px] font-bold px-2 py-0.5">
                          {lvl.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <InfoField label="Level" value={primaryLevel ? (primaryLevel.name || coordinator.level_name) : '—'} />
                )}
                <div className="py-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Can Assign Teachers</p>
                  <Badge className={coordinator.can_assign_class_teachers
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100 text-[10px] font-black px-2.5 py-1'
                    : 'bg-red-50 text-red-500 border-red-100 text-[10px] font-black px-2.5 py-1'
                  }>
                    {coordinator.can_assign_class_teachers ? 'Allowed' : 'Restricted'}
                  </Badge>
                </div>
              </div>
            </SectionCard>
          </div>

          {/* ════ MAIN WORKSPACE ════ */}
          <div className="flex-1 space-y-5">

            {/* Identity & Biographics */}
            <SectionCard title="Identity & Biographics" icon={User}>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6">
                <InfoField label="Full Name" value={coordinator.full_name} />
                <InfoField label="Gender" value={coordinator.gender ? coordinator.gender.charAt(0).toUpperCase() + coordinator.gender.slice(1) : undefined} />
                <InfoField label="Date of Birth" value={formatDate(coordinator.dob)} />
                <InfoField label="CNIC" value={coordinator.cnic} />
                <InfoField label="Marital Status" value={coordinator.marital_status ? coordinator.marital_status.charAt(0).toUpperCase() + coordinator.marital_status.slice(1) : undefined} />
                <InfoField label="Religion" value={coordinator.religion} />
              </div>
            </SectionCard>

            {/* Professional Portfolio */}
            <SectionCard title="Professional Portfolio" icon={Briefcase}>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6">
                <InfoField label="Education Level" value={coordinator.education_level} />
                <InfoField label="Institution" value={coordinator.institution_name} />
                <InfoField label="Year of Passing" value={coordinator.year_of_passing} />
                <InfoField label="Experience" value={coordinator.total_experience_years != null ? `${coordinator.total_experience_years} years` : undefined} />
                <InfoField label="Employee Code" value={coordinator.employee_code} />
                <InfoField label="Joining Date" value={formatDate(coordinator.joining_date)} />
              </div>
            </SectionCard>

            {/* Account Maintenance */}
            <SectionCard title="Account Maintenance" icon={Clock}>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6">
                <InfoField label="Last Updated" value={formatDate(coordinator.updated_at)} />
                <InfoField label="Account Created" value={formatDate(coordinator.created_at)} />
                <InfoField label="Status" value={coordinator.is_currently_active ? 'Active' : 'Inactive'} />
              </div>
            </SectionCard>

            {/* ── Principal Only: Analytics Sections ── */}
            {isPrincipal && (
              <>
                {/* Toggle Buttons */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'overview', label: 'Overview Stats', icon: Activity },
                    { key: 'classrooms', label: 'Classrooms', icon: Layers },
                    { key: 'attendance', label: 'Attendance', icon: TrendingUp },
                    { key: 'staff_attendance', label: 'My Attendance', icon: Calendar },
                  ].map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => setActiveSection(prev => prev === key as any ? null : key as any)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                        activeSection === key
                          ? 'bg-[#274c77] text-white border-[#274c77] shadow-md'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-[#274c77]/40 hover:text-[#274c77]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Overview Stats */}
                {activeSection === 'overview' && (
                  <SectionCard title="Overview Statistics" icon={BarChart3}>
                    {loadingStats ? (
                      <div className="flex items-center justify-center py-10">
                        <LoadingSpinner message="Loading statistics..." />
                      </div>
                    ) : dashboardStats ? (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                          {[
                            { label: 'Students', value: dashboardStats.total_students, color: 'blue', icon: Users },
                            { label: 'Teachers', value: dashboardStats.total_teachers, color: 'green', icon: GraduationCap },
                            { label: 'Classes', value: dashboardStats.total_classes, color: 'purple', icon: Layers },
                            { label: 'Requests', value: dashboardStats.pending_requests, color: 'orange', icon: FileText },
                          ].map(({ label, value, color, icon: Icon }) => (
                            <div key={label} className={`bg-${color}-50 border border-${color}-200 rounded-xl p-4`}>
                              <div className="flex items-center gap-2 mb-2">
                                <Icon className={`w-4 h-4 text-${color}-600`} />
                                <span className="text-xs text-gray-500 font-medium">{label}</span>
                              </div>
                              <p className={`text-2xl font-black text-${color}-900`}>{value}</p>
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Statistics Overview</p>
                            <ResponsiveContainer width="100%" height={200}>
                              <BarChart data={statsChartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Bar dataKey="value" fill="#6096ba" radius={[6, 6, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Distribution</p>
                            <ResponsiveContainer width="100%" height={200}>
                              <PieChart>
                                <Pie data={statsChartData} cx="50%" cy="50%" outerRadius={80}
                                  label={(e: any) => `${e.name}: ${(e.percent * 100).toFixed(0)}%`}
                                  labelLine={false} dataKey="value">
                                  {statsChartData.map((entry, i) => (
                                    <Cell key={i} fill={entry.color} />
                                  ))}
                                </Pie>
                                <Tooltip />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="text-center text-gray-400 py-8 text-sm">No statistics available</p>
                    )}
                  </SectionCard>
                )}

                {/* Classrooms */}
                {activeSection === 'classrooms' && (
                  <SectionCard title={`Classrooms (${classrooms.length})`} icon={Layers}>
                    {loadingClassrooms ? (
                      <div className="flex items-center justify-center py-10">
                        <LoadingSpinner message="Loading classrooms..." />
                      </div>
                    ) : classrooms.length > 0 ? (
                      <div className="space-y-3">
                        {classrooms.map((room) => (
                          <div key={room.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:border-[#6096ba] transition-colors">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                  <h4 className="text-sm font-bold text-gray-900">{room.name}</h4>
                                  <Badge variant="outline" className="text-[10px]">{room.code}</Badge>
                                  <Badge className="bg-[#6096ba] text-white text-[10px]">
                                    {room.shift.charAt(0).toUpperCase() + room.shift.slice(1)}
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-gray-600">
                                  <div className="flex items-center gap-1">
                                    <Users className="w-3.5 h-3.5" />
                                    <span>{room.student_count} Students</span>
                                  </div>
                                  {room.class_teacher && (
                                    <div className="flex items-center gap-1">
                                      <User className="w-3.5 h-3.5" />
                                      <span className="truncate">{room.class_teacher.full_name}</span>
                                    </div>
                                  )}
                                  {room.level && (
                                    <div className="flex items-center gap-1">
                                      <GraduationCap className="w-3.5 h-3.5" />
                                      <span>{room.level.name}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <Button variant="outline" size="sm"
                                onClick={() => router.push(`/admin/classes/${room.id}`)}
                                className="flex-shrink-0 text-xs h-8 px-3">
                                <Eye className="w-3.5 h-3.5 mr-1.5" />
                                View
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                          <Layers className="w-8 h-8 text-gray-300" />
                        </div>
                        <p className="text-sm font-semibold text-gray-500">No Classrooms Assigned</p>
                        <p className="text-xs text-gray-400 mt-1 text-center">Classrooms will appear once assigned to this coordinator.</p>
                      </div>
                    )}
                  </SectionCard>
                )}

                {/* Attendance */}
                {activeSection === 'attendance' && (
                  <SectionCard title="Attendance Summary" icon={TrendingUp}>
                    {/* Date Filter */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                      <div>
                        <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Start Date</Label>
                        <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                          className="mt-1 h-9 text-sm" />
                      </div>
                      <div>
                        <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">End Date</Label>
                        <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                          className="mt-1 h-9 text-sm" />
                      </div>
                      <div className="flex items-end">
                        <Button onClick={handleDateFilter}
                          className="w-full bg-[#274c77] hover:bg-[#1a3459] h-9 text-sm font-bold">
                          Apply Filter
                        </Button>
                      </div>
                    </div>

                    {attendanceSummary?.date_range && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 mb-4">
                        <p className="text-xs text-blue-700 font-semibold">
                          Showing: {formatDate(attendanceSummary.date_range.start_date)} — {formatDate(attendanceSummary.date_range.end_date)}
                        </p>
                      </div>
                    )}

                    {loadingAttendance ? (
                      <div className="flex items-center justify-center py-10">
                        <LoadingSpinner message="Loading attendance..." />
                      </div>
                    ) : attendanceSummary ? (
                      <>
                        {/* KPI Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                          {[
                            { label: 'Classrooms', value: attendanceSummary.summary.total_classrooms, color: 'blue' },
                            { label: 'Students', value: attendanceSummary.summary.total_students, color: 'green' },
                            { label: 'Present', value: attendanceSummary.summary.total_present, color: 'indigo' },
                            { label: 'Overall %', value: `${(attendanceSummary.summary.overall_percentage || 0).toFixed(1)}%`, color: 'purple' },
                          ].map(({ label, value, color }) => (
                            <div key={label} className={`bg-${color}-50 border border-${color}-200 rounded-xl p-3`}>
                              <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">{label}</p>
                              <p className={`text-xl font-black text-${color}-900`}>{value}</p>
                            </div>
                          ))}
                        </div>

                        {/* Charts */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
                          {attendanceChartData.length > 0 && (
                            <div>
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Classroom Attendance %</p>
                              <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={attendanceChartData} margin={{ top: 5, right: 5, left: 0, bottom: 50 }}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={70} tick={{ fontSize: 10 }} />
                                  <YAxis tick={{ fontSize: 10 }} />
                                  <Tooltip />
                                  <Bar dataKey="attendance" fill="#6096ba" name="Attendance %" radius={[4, 4, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                          {attendancePieData.length > 0 && (
                            <div>
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Present vs Absent</p>
                              <ResponsiveContainer width="100%" height={200}>
                                <PieChart>
                                  <Pie data={attendancePieData} cx="50%" cy="50%" outerRadius={80}
                                    label={(e: any) => `${e.name}: ${(e.percent * 100).toFixed(1)}%`}
                                    labelLine={false} dataKey="value">
                                    {attendancePieData.map((entry, i) => (
                                      <Cell key={i} fill={entry.color} />
                                    ))}
                                  </Pie>
                                  <Tooltip />
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                        </div>

                        {/* Per-Classroom Table */}
                        {attendanceSummary.classrooms.length > 0 && (
                          <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Per Classroom Details</p>
                            <div className="space-y-2">
                              {attendanceSummary.classrooms.map((item, i) => (
                                <div key={i} className="bg-gray-50 rounded-xl p-3.5 border border-gray-200">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-bold text-gray-800 mb-1.5">
                                        {item.classroom.name || `${item.classroom.grade}-${item.classroom.section}`}
                                      </p>
                                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-600">
                                        <span><span className="font-semibold">Students:</span> {item.student_count}</span>
                                        <span className="text-green-700"><span className="font-semibold">Present:</span> {item.total_present || 0}</span>
                                        <span className="text-red-600"><span className="font-semibold">Absent:</span> {item.total_absent || 0}</span>
                                        <span className="text-blue-700 font-bold">{item.average_percentage.toFixed(1)}%</span>
                                      </div>
                                    </div>
                                    <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden flex-shrink-0">
                                      <div className="h-full bg-[#6096ba]" style={{ width: `${Math.min(item.average_percentage, 100)}%` }} />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-center text-gray-400 py-8 text-sm">No attendance data available for selected range.</p>
                    )}
                  </SectionCard>
                )}

                {/* My Attendance (coordinator's own staff attendance) */}
                {activeSection === 'staff_attendance' && (
                  <SectionCard title="My Attendance" icon={Calendar}>
                    {coordinator?.user_id ? (
                      <StaffAttendanceSection userId={coordinator.user_id} />
                    ) : (
                      <p className="text-center text-gray-400 py-8 text-sm">
                        No linked login account found for this coordinator — attendance can't be looked up.
                      </p>
                    )}
                  </SectionCard>
                )}
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
