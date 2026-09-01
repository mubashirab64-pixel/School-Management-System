"use client"

import React, { useCallback, useEffect, useRef, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { apiGet, apiPatch, apiPatchFormData, getFilteredTeachers, getAllCoordinators } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { MapPin, Phone, Mail, Users, Building, BookOpen, Wifi, GraduationCap, UserCheck, BarChart3, Activity, Target, Pencil } from "lucide-react"
import { StudentRadialChart } from "@/components/charts/radial-chart"
import CampusGradeBreakdown from "@/components/dashboard/campus-grade-breakdown"
import { useToast } from "@/hooks/use-toast"
import { validateFields } from "@/lib/validation/common"
import { campusEditSchema } from "@/lib/validation/schemas/campus.schema"

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]

const CAMPUS_OPTIONS = [
  { name: "Campus 1", code: "C01" },
  { name: "Campus 2", code: "C02" },
  { name: "Campus 3", code: "C03" },
  { name: "Campus 4", code: "C04" },
  { name: "Campus 5", code: "C05" },
  { name: "Campus 6", code: "C06" },
  { name: "Campus 7", code: "C07" },
  { name: "Campus 8", code: "C08" },
  { name: "Campus 9", code: "C09" },
  { name: "Campus 10", code: "C10" },
]

function CampusProfileContent() {
  const params = useSearchParams()
  const id = params?.get("id") || params?.get("pk") || ""
  const { toast } = useToast()

  const [campus, setCampus] = useState<any | null>(null)
  const [realStudentData, setRealStudentData] = useState<any | null>(null)
  const [realTeachersCount, setRealTeachersCount] = useState<number | null>(null)
  const [campusAttendancePct, setCampusAttendancePct] = useState<number | null>(null)
  const [realCoordinatorsCount, setRealCoordinatorsCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editData, setEditData] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  // Function to calculate real student statistics using real DB data
  useEffect(() => {
    if (!id) return
    let mounted = true
    setLoading(true)

    // Fetch campus data
    apiGet<any>(`/api/campus/${id}/`)
      .then((data) => {
        if (mounted) {
          setCampus(data)
        }
      })
      .catch((err) => {
        console.error(err)
        if (mounted) {
          setError(err.message || "Failed to load campus")
        }
      })

    // Fetch real data from database.
    // NOTE: student counts (total/gender/shift) come from the campus-scoped
    // grade-breakdown endpoint in a separate effect below — NOT by downloading
    // every student and filtering client-side, which timed out (~2 min).
    Promise.all([
      // Fetch real teachers data filtered by campus
      getFilteredTeachers({ current_campus: parseInt(id), is_currently_active: true })
        .then((response) => {
          console.log('Fetched teachers data:', response)
          if (mounted) {
            const teachers = Array.isArray(response) ? response : (response?.results || [])
            const count = Array.isArray(response) ? response.length : (response?.count || 0)
            console.log('Setting real teachers count:', count)
            setRealTeachersCount(count)
          }
          return response
        })
        .catch((err) => {
          console.warn('Failed to fetch real teachers data:', err)
          if (mounted) setRealTeachersCount(null)
          return null
        }),

      // Fetch real coordinators data and filter by campus
      getAllCoordinators()
        .then((coordinators: any) => {
          console.log('Fetched coordinators data:', coordinators)
          if (mounted) {
            // Filter coordinators by campus
            const coordinatorsList = Array.isArray(coordinators) ? coordinators : ((coordinators as any)?.results || [])
            const campusCoordinators = coordinatorsList.filter((coord: any) => {
              let coordCampusId = null
              if (typeof coord.campus === 'object' && coord.campus) {
                coordCampusId = coord.campus.id || coord.campus.pk || coord.campus.campus_id
              } else if (coord.campus) {
                coordCampusId = coord.campus
              }
              return coordCampusId == id || coordCampusId === id
            })
            console.log('Setting real coordinators count:', campusCoordinators.length)
            setRealCoordinatorsCount(campusCoordinators.length)
          }
          return coordinators
        })
        .catch((err) => {
          console.warn('Failed to fetch real coordinators data:', err)
          if (mounted) setRealCoordinatorsCount(null)
          return []
        })
    ])
      .finally(() => {
        if (mounted) {
          setLoading(false)
        }
      })

    return () => {
      mounted = false
    }
  }, [id])

  // Campus-wide attendance % + student summary (total/gender/shift) for the
  // header cards. One fast, campus-scoped aggregate call — replaces the old
  // "download every student and filter in the browser" path that timed out.
  useEffect(() => {
    if (!id) return
    let alive = true
    apiGet(`/api/campus/${id}/grade-breakdown/`)
      .then((d: any) => {
        if (!alive) return
        setCampusAttendancePct(d?.overall_attendance_pct ?? null)
        const o = d?.overall
        if (o) {
          setRealStudentData({
            total: o.total ?? 0, male: o.male ?? 0, female: o.female ?? 0,
            morning: o.morning ?? 0, afternoon: o.afternoon ?? 0,
          })
        }
      })
      .catch(() => {
        if (alive) { setCampusAttendancePct(null); setRealStudentData({ total: 0, male: 0, female: 0, morning: 0, afternoon: 0 }) }
      })
    return () => { alive = false }
  }, [id])

  useEffect(() => {
    if (campus?.campus_name || campus?.name) {
      document.title = `${campus.campus_name || campus.name} | Campus Profile`
    }
  }, [campus])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const uStr = window.localStorage.getItem('sis_user')
        if (uStr) {
          const u = JSON.parse(uStr)
          const role = String(u?.role || '').toLowerCase()
          setCanEdit(role === 'org_admin')
        }
      } catch { }
    }
  }, [])

  const openEdit = () => {
    if (!campus) return
    setEditData({ ...campus })
    setPhotoFile(null)
    setPhotoPreview(null)
    setEditOpen(true)
  }

  const handleEditField = (field: string, value: any) => {
    setEditData((prev: any) => ({ ...prev, [field]: value }))
  }

  const handlePhotoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = () => setPhotoPreview(String(reader.result))
    reader.readAsDataURL(file)
  }, [])

  const handleSave = async () => {
    // Editing here only ever touches a subset of fields — validate just the
    // ones actually present in editData against the shared campus schema.
    const touchedFields = Object.keys(editData).filter((key) => key in campusEditSchema.entries)
    const { invalid, messages } = validateFields(campusEditSchema, editData, touchedFields)
    if (invalid.length > 0) {
      toast({
        title: "Please fix the highlighted fields",
        description: invalid.map((f) => messages[f]).join(" "),
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      // campus_id is auto-managed by backend when campus_code changes
      const skip = new Set(['id', 'organization', 'created_at', 'updated_at', 'campus_photo', 'total_rooms', 'campus_id'])

      let updated: any

      if (photoFile) {
        // Use FormData only when uploading a new photo
        const fd = new FormData()
        for (const [key, val] of Object.entries(editData)) {
          if (skip.has(key)) continue
          if (val === null || val === undefined) continue
          if (key === 'grades_data') {
            fd.append(key, JSON.stringify(val))
          } else if (typeof val === 'boolean') {
            fd.append(key, val ? 'true' : 'false')
          } else {
            fd.append(key, String(val))
          }
        }
        fd.append('campus_photo', photoFile)
        updated = await apiPatchFormData<any>(`/api/campus/${id}/`, fd)
      } else {
        // Use JSON PATCH for correct type handling (booleans, numbers, arrays)
        const body: Record<string, any> = {}
        for (const [key, val] of Object.entries(editData)) {
          if (skip.has(key)) continue
          if (val === null || val === undefined) continue
          body[key] = val
        }
        // If photo was explicitly removed, send null
        if (editData.campus_photo === null) {
          body['campus_photo'] = null
        }
        updated = await apiPatch<any>(`/api/campus/${id}/`, body)
      }

      setCampus(updated)
      setEditOpen(false)
      toast({ title: "Campus updated successfully" })
    } catch (err: any) {
      const details = (err as any)?.details
      const detailStr = details && Object.keys(details).length
        ? Object.entries(details).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('; ')
        : ''
      console.error('Campus PATCH error:', err?.message, details)
      toast({
        title: "Failed to update campus",
        description: detailStr || err?.message || "Unknown error",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  if (!id) {
    return <div className="p-6">No campus selected</div>
  }

  if (error) return (
    <div className="p-6 text-center">
      <div className="text-red-600 mb-4">Error: {error}</div>
      <Button onClick={() => window.location.reload()}>Try Again</Button>
    </div>
  )

  const renderValue = (v: any) => {
    if (v === null || v === undefined || String(v).trim() === "") return '—'
    if (typeof v === 'boolean') return v ? 'Yes' : 'No'
    if (Array.isArray(v)) return v.join(', ')
    if (typeof v === 'object') return JSON.stringify(v)
    return String(v)
  }

  // const formatDate = (dateStr: string) => {
  //   if (!dateStr) return '—'
  //   try {
  //     return new Date(dateStr).toLocaleDateString('en-US', {
  //       year: 'numeric',
  //       month: 'long',
  //       day: 'numeric'
  //     })
  //   } catch {
  //     return dateStr
  //   }
  // }

  // Helper function to get full image URL
  const getImageUrl = (imagePath: string | null | undefined) => {
    if (!imagePath) return null
    // If already a full URL, return as is
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath
    }
    // Otherwise, construct full URL from API base
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL!
    return `${apiBase}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`
  }

  const campusImageUrl = getImageUrl(campus?.campus_photo)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <div className="bg-gradient-to-br from-slate-50 to-blue-50 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <Card className="overflow-hidden shadow-2xl border-0 bg-white">
            <div className="relative">
              {/* Campus Image Background/Header */}
              {campusImageUrl && (
                <div className="relative h-40 sm:h-52 lg:h-60 w-full overflow-hidden bg-slate-100">
                  {/* Blurred fill so wide/logo images fill the banner without cropping */}
                  <img
                    src={campusImageUrl}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-40"
                  />
                  {/* Crisp, fully-visible logo (never cropped or stretched) */}
                  <img
                    src={campusImageUrl}
                    alt={campus?.campus_name || 'Campus'}
                    className="relative z-10 w-full h-full object-contain p-4 sm:p-6"
                  />
                </div>
              )}

              {/* Decorative Elements (only show if no image) */}
              {!campusImageUrl && (
                <>
                  <div className="absolute top-0 right-0 w-16 h-16 sm:w-32 sm:h-32 bg-white/10 rounded-full -translate-y-8 translate-x-8 sm:-translate-y-16 sm:translate-x-16"></div>
                  <div className="absolute bottom-0 left-0 w-12 h-12 sm:w-24 sm:h-24 bg-white/5 rounded-full translate-y-6 -translate-x-6 sm:translate-y-12 sm:-translate-x-12"></div>
                </>
              )}

              {/* Content */}
              <div className={`relative ${campusImageUrl ? 'p-4 sm:p-6 lg:p-8' : 'p-4 sm:p-6 lg:p-8'}`}>
                <div className={`flex flex-col ${campusImageUrl ? 'lg:flex-row' : 'lg:flex-row'} lg:items-start lg:justify-between gap-6`}>
                  {/* Left Side - Main Info */}
                  <div className="flex-1">
                    <div className="flex items-start gap-3 sm:gap-4 mb-4">
                      {/* Campus Image Thumbnail */}
                      {campusImageUrl ? (
                        <div className="relative flex-shrink-0">
                          <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-xl overflow-hidden border-4 border-white shadow-lg bg-white flex items-center justify-center">
                            <img
                              src={campusImageUrl}
                              alt={campus?.campus_name || 'Campus'}
                              className="w-full h-full object-contain p-1"
                            />
                          </div>
                          <div className="absolute -bottom-1 -right-1 w-6 h-6 sm:w-7 sm:h-7 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                            <div className="w-3 h-3 sm:w-4 sm:h-4 bg-white rounded-full animate-pulse"></div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-2 sm:p-3 bg-primary rounded-xl backdrop-blur-sm flex-shrink-0">
                          <Building className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold mb-1 text-slate-800">
                          {campus?.campus_name || campus?.name || 'Unknown Campus'}
                        </h1>
                        <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-sm sm:text-base lg:text-lg text-slate-600">
                          <MapPin className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                          <span>{campus?.campus_type ? campus.campus_type.charAt(0).toUpperCase() + campus.campus_type.slice(1) : 'Campus'}</span>
                          <span>•</span>
                          <span>{campus?.city || 'Unknown City'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Edit Button — org_admin only */}
                    {canEdit && (
                      <div className="mb-3">
                        <Button size="sm" variant="outline" onClick={openEdit} className="gap-2 bg-white/80 hover:bg-white border-slate-300">
                          <Pencil className="w-3.5 h-3.5" />
                          Edit Campus
                        </Button>
                      </div>
                    )}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 mt-6 sm:mt-8">
                      <div className="bg-primary/15 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-white/20">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="p-2 rounded-lg">
                            <Users className="w-5 h-5 sm:w-6 sm:h-6" />
                          </div>
                          <div>
                            <div className="text-2xl sm:text-3xl font-bold">
                              {realStudentData?.total !== undefined ? realStudentData.total : (campus?.total_students || 0)}
                            </div>
                            <div className="text-xs sm:text-sm opacity-80 font-medium">Students</div>
                            {realStudentData?.total !== undefined && (
                              <div className="text-xs opacity-60">Real Count</div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="bg-primary/15 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-white/20">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="p-2 bg-green-500/30 rounded-lg">
                            <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6" />
                          </div>
                          <div>
                            <div className="text-2xl sm:text-3xl font-bold">
                              {realTeachersCount !== null ? realTeachersCount : (campus?.total_teachers || 0)}
                            </div>
                            <div className="text-xs sm:text-sm opacity-80 font-medium">Teachers</div>
                            {realTeachersCount !== null && (
                              <div className="text-xs opacity-60">Real Count</div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="bg-primary/15 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-white/20">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="p-2 bg-purple-500/30 rounded-lg">
                            <Building className="w-5 h-5 sm:w-6 sm:h-6" />
                          </div>
                          <div>
                            <div className="text-2xl sm:text-3xl font-bold">{campus?.total_classrooms || 0}</div>
                            <div className="text-xs sm:text-sm opacity-80 font-medium">Classrooms</div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-primary/15 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-white/20">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="p-2 bg-emerald-500/30 rounded-lg">
                            <UserCheck className="w-5 h-5 sm:w-6 sm:h-6" />
                          </div>
                          <div>
                            <div className="text-2xl sm:text-3xl font-bold">
                              {campusAttendancePct !== null ? `${campusAttendancePct}%` : "—"}
                            </div>
                            <div className="text-xs sm:text-sm opacity-80 font-medium">Attendance</div>
                            {campusAttendancePct !== null && (
                              <div className="text-xs opacity-60">Campus avg</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <Tabs defaultValue="analytics" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4 sm:mb-6 h-auto">
              <TabsTrigger value="analytics" className="flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm py-2 sm:py-2.5">
                <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Analytics</span>
                <span className="sm:hidden">Stats</span>
              </TabsTrigger>
              <TabsTrigger value="details" className="flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm py-2 sm:py-2.5">
                <Building className="w-3 h-3 sm:w-4 sm:h-4" />
                Details
              </TabsTrigger>
            </TabsList>


            {/* Details Tab */}
            <TabsContent value="details" className="space-y-4 sm:space-y-8">

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
                {/* Basic Information */}
                <Card className="shadow-sm border border-slate-200 bg-white/90 rounded-2xl overflow-hidden">
                  <CardHeader className="pb-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-sky-50">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-[#274c77]/10 flex items-center justify-center text-[#274c77]">
                        <Building className="w-4 h-4" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-semibold text-slate-900">
                          Basic Information
                        </CardTitle>
                        <p className="text-xs text-slate-500">
                          Identity & governance details of this campus
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide mb-1 text-slate-500">
                          Campus ID
                        </p>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">
                          {renderValue(campus?.campus_id)}
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide mb-1 text-slate-500">
                          Campus Code
                        </p>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">
                          {renderValue(campus?.campus_code)}
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide mb-1 text-slate-500">
                          Campus Name
                        </p>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm sm:text-base font-semibold text-slate-900">
                          {renderValue(campus?.campus_name)}
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide mb-1 text-slate-500">
                          Campus Type
                        </p>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <Badge className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200 text-xs font-semibold">
                            {renderValue(campus?.campus_type)}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide mb-1 text-slate-500">
                          Established Year
                        </p>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800">
                          {renderValue(campus?.established_year)}
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide mb-1 text-slate-500">
                          Governing Body
                        </p>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
                          {renderValue(campus?.governing_body)}
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide mb-1 text-slate-500">
                          Accreditation
                        </p>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
                          {renderValue(campus?.accreditation)}
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide mb-1 text-slate-500">
                          Instruction Language
                        </p>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
                          {renderValue(campus?.instruction_language)}
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide mb-1 text-slate-500">
                          Registration Number
                        </p>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
                          {renderValue(campus?.registration_number)}
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide mb-1 text-slate-500">
                          Status
                        </p>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <Badge
                            className={`px-3 py-0.5 rounded-full text-xs font-semibold border ${campus?.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}
                          >
                            {renderValue(campus?.status)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Staff Information */}
                <Card className="shadow-sm border border-slate-200 bg-white/90 rounded-2xl overflow-hidden">
                  <CardHeader className="pb-3 border-b border-slate-100 bg-gradient-to-r from-sky-50 to-emerald-50">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                        <GraduationCap className="w-4 h-4" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-semibold text-slate-900">
                          Staff Information
                        </CardTitle>
                        <p className="text-xs text-slate-500">
                          Teaching & non‑teaching staff overview
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      <div className="text-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Total Teachers
                        </p>
                        <p className="mt-1 text-xl font-bold text-slate-900">
                          {realTeachersCount !== null ? realTeachersCount : renderValue(campus?.total_teachers)}
                        </p>
                        {realTeachersCount !== null && (
                          <p className="mt-1 text-[11px] text-emerald-600 font-medium">Real</p>
                        )}
                      </div>
                      <div className="text-center rounded-xl border border-slate-200 bg-white px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Non‑Teaching Staff
                        </p>
                        <p className="mt-1 text-xl font-bold text-slate-900">
                          {renderValue(campus?.total_non_teaching_staff)}
                        </p>
                      </div>
                      <div className="text-center rounded-xl border border-slate-200 bg-white px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Total Maids
                        </p>
                        <p className="mt-1 text-xl font-bold text-slate-900">
                          {renderValue(campus?.total_maids)}
                        </p>
                      </div>
                      <div className="text-center rounded-xl border border-slate-200 bg-white px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Coordinators
                        </p>
                        <p className="mt-1 text-xl font-bold text-slate-900">
                          {realCoordinatorsCount !== null ? realCoordinatorsCount : renderValue(campus?.total_coordinators)}
                        </p>
                        {realCoordinatorsCount !== null && (
                          <p className="mt-1 text-[11px] text-emerald-600 font-medium">Real</p>
                        )}
                      </div>
                      <div className="text-center rounded-xl border border-slate-200 bg-white px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Guards
                        </p>
                        <p className="mt-1 text-xl font-bold text-slate-900">
                          {renderValue(campus?.total_guards)}
                        </p>
                      </div>
                      <div className="text-center rounded-xl border border-slate-200 bg-white px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Other Staff
                        </p>
                        <p className="mt-1 text-xl font-bold text-slate-900">
                          {renderValue(campus?.other_staff)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div className="text-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Male Teachers
                        </p>
                        <p className="mt-1 text-sm sm:text-base font-bold text-slate-900">
                          {renderValue(campus?.male_teachers)}
                        </p>
                      </div>
                      <div className="text-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Female Teachers
                        </p>
                        <p className="mt-1 text-sm sm:text-base font-bold text-slate-900">
                          {renderValue(campus?.female_teachers)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>


                {/* Location & Contact Information */}
                <Card className="shadow-sm border border-slate-200 bg-white/90 rounded-2xl overflow-hidden lg:col-span-2">
                  <CardHeader className="pb-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-sky-50">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-[#274c77]/10 flex items-center justify-center text-[#274c77]">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-semibold text-slate-900">
                          Location & Contact
                        </CardTitle>
                        <p className="text-xs text-slate-500">
                          Address and key contact channels
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 space-y-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide mb-1 text-slate-500">
                        Full Address
                      </p>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-relaxed text-slate-800">
                        {renderValue(campus?.address_full)}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide mb-1 text-slate-500">
                          City
                        </p>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-sky-600" />
                          <span className="text-sm font-medium text-slate-900">
                            {renderValue(campus?.city)}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide mb-1 text-slate-500">
                          District
                        </p>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 flex items-center gap-2">
                          <Building className="w-4 h-4 text-slate-500" />
                          <span className="text-sm font-medium text-slate-900">
                            {renderValue(campus?.district)}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide mb-1 text-slate-500">
                          Postal Code
                        </p>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 flex items-center gap-2">
                          <Mail className="w-4 h-4 text-sky-600" />
                          <span className="text-sm font-medium text-slate-900">
                            {renderValue(campus?.postal_code)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide mb-1 text-slate-500">
                          Primary Phone
                        </p>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 flex items-center gap-2">
                          <Phone className="w-4 h-4 text-sky-600" />
                          <span className="text-sm font-medium text-slate-900">
                            {renderValue(campus?.primary_phone)}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide mb-1 text-slate-500">
                          Secondary Phone
                        </p>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 flex items-center gap-2">
                          <Phone className="w-4 h-4 text-slate-500" />
                          <span className="text-sm font-medium text-slate-900">
                            {renderValue(campus?.secondary_phone)}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide mb-1 text-slate-500">
                          Official Email
                        </p>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 flex items-center gap-2">
                          <Mail className="w-4 h-4 text-[#274c77]" />
                          <span className="text-sm font-medium text-slate-900">
                            {renderValue(campus?.official_email)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Administration */}
                <Card className="shadow-sm border border-slate-200 bg-white/90 rounded-2xl overflow-hidden">
                  <CardHeader className="pb-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-sky-50">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-[#274c77]/10 flex items-center justify-center text-[#274c77]">
                        <UserCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-semibold text-slate-900">
                          Administration
                        </CardTitle>
                        <p className="text-xs text-slate-500">
                          Campus leadership and key contacts
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide mb-1 text-slate-500">
                          Campus Head Name
                        </p>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900">
                          {renderValue(campus?.campus_head_name)}
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide mb-1 text-slate-500">
                          Campus Head Phone
                        </p>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900">
                          {renderValue(campus?.campus_head_phone)}
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide mb-1 text-slate-500">
                          Campus Head Email
                        </p>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900">
                          {renderValue(campus?.campus_head_email)}
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide mb-1 text-slate-500">
                          Total Staff Members
                        </p>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 text-center">
                          {renderValue(campus?.total_staff_members)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Academic Information */}
                <Card className="shadow-sm border border-slate-200 bg-white/90 rounded-2xl overflow-hidden">
                  <CardHeader className="pb-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-sky-50">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-[#274c77]/10 flex items-center justify-center text-[#274c77]">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-semibold text-slate-900">
                          Academic Information
                        </CardTitle>
                        <p className="text-xs text-slate-500">
                          Academic calendar, shifts & grades
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide mb-1 text-slate-500">
                          Academic Year Start
                        </p>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900">
                          {renderValue(campus?.academic_year_start_month)}
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide mb-1 text-slate-500">
                          Academic Year End
                        </p>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900">
                          {renderValue(campus?.academic_year_end_month)}
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide mb-1 text-slate-500">
                          Shift Available
                        </p>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <Badge className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200 text-xs font-semibold">
                            {renderValue(campus?.shift_available)}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide mb-1 text-slate-500">
                          Grades Available
                        </p>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900">
                          {renderValue(campus?.grades_available)}
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide mb-1 text-slate-500">
                          Grades Offered
                        </p>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900">
                          {renderValue(campus?.grades_offered)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Student Demographics - Large Card */}
                <Card className="shadow-sm border border-slate-200 bg-white/90 rounded-2xl overflow-hidden lg:col-span-2">
                  <CardHeader className="pb-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-sky-50">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-[#274c77]/10 flex items-center justify-center text-[#274c77]">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-semibold text-slate-900">
                          Student Demographics
                        </CardTitle>
                        <p className="text-xs text-slate-500">
                          Real enrollment, gender & shift overview
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Total Students
                        </p>
                        <p className="mt-1 text-2xl font-bold text-slate-900">
                          {realStudentData?.total !== undefined ? realStudentData.total : renderValue(campus?.total_students)}
                        </p>
                        {realStudentData?.total !== undefined && (
                          <p className="mt-1 text-[11px] text-sky-600 font-medium">Real Database Count</p>
                        )}
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-center">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Total Teachers
                        </p>
                        <p className="mt-1 text-2xl font-bold text-slate-900">
                          {realTeachersCount !== null ? realTeachersCount : renderValue(campus?.total_teachers)}
                        </p>
                        {realTeachersCount !== null && (
                          <p className="mt-1 text-[11px] text-sky-600 font-medium">Real Count</p>
                        )}
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-center">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Coordinators
                        </p>
                        <p className="mt-1 text-2xl font-bold text-slate-900">
                          {realCoordinatorsCount !== null ? realCoordinatorsCount : renderValue(campus?.total_coordinators)}
                        </p>
                        {realCoordinatorsCount !== null && (
                          <p className="mt-1 text-[11px] text-sky-600 font-medium">Real Count</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-center">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Male Students
                        </p>
                        <p className="mt-1 text-sm sm:text-base font-bold text-slate-900">
                          {realStudentData?.male !== undefined ? realStudentData.male : renderValue(campus?.male_students)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-center">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Female Students
                        </p>
                        <p className="mt-1 text-sm sm:text-base font-bold text-slate-900">
                          {realStudentData?.female !== undefined ? realStudentData.female : renderValue(campus?.female_students)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-center">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Morning Shift
                        </p>
                        <p className="mt-1 text-sm sm:text-base font-bold text-slate-900">
                          {realStudentData?.morning !== undefined ? realStudentData.morning : renderValue(campus?.morning_students)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-center">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Afternoon Shift
                        </p>
                        <p className="mt-1 text-sm sm:text-base font-bold text-slate-900">
                          {realStudentData?.afternoon !== undefined ? realStudentData.afternoon : renderValue(campus?.afternoon_students)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-center">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Student Capacity
                        </p>
                        <p className="mt-1 text-lg font-bold text-slate-900">
                          {renderValue(campus?.student_capacity)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-center">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Avg Class Size
                        </p>
                        <p className="mt-1 text-lg font-bold text-slate-900">
                          {renderValue(campus?.avg_class_size)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>


                {/* Infrastructure - Large Card */}
                <Card className="shadow-sm border border-slate-200 bg-white/90 rounded-2xl overflow-hidden lg:col-span-2">
                  <CardHeader className="pb-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-sky-50">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-[#274c77]/10 flex items-center justify-center text-[#274c77]">
                        <Building className="w-4 h-4" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-semibold text-slate-900">
                          Infrastructure & Facilities
                        </CardTitle>
                        <p className="text-xs text-slate-500">
                          Rooms, labs, washrooms and key facilities
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-center">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Total Rooms
                        </p>
                        <p className="mt-1 text-xl font-bold text-slate-900">
                          {renderValue(campus?.total_rooms)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-center">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Classrooms
                        </p>
                        <p className="mt-1 text-xl font-bold text-slate-900">
                          {renderValue(campus?.total_classrooms)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-center">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Offices
                        </p>
                        <p className="mt-1 text-xl font-bold text-slate-900">
                          {renderValue(campus?.total_offices)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-center">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Computer Labs
                        </p>
                        <p className="mt-1 text-xl font-bold text-slate-900">
                          {renderValue(campus?.num_computer_labs)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-center">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Science Labs
                        </p>
                        <p className="mt-1 text-xl font-bold text-slate-900">
                          {renderValue(campus?.num_science_labs)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-center">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Biology Labs
                        </p>
                        <p className="mt-1 text-xl font-bold text-slate-900">
                          {renderValue(campus?.num_biology_labs)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-center">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Chemistry Labs
                        </p>
                        <p className="mt-1 text-xl font-bold text-slate-900">
                          {renderValue(campus?.num_chemistry_labs)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-center">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Physics Labs
                        </p>
                        <p className="mt-1 text-xl font-bold text-slate-900">
                          {renderValue(campus?.num_physics_labs)}
                        </p>
                      </div>
                    </div>

                    {/* Washrooms Section */}
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Washrooms
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-center">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Total Washrooms
                          </p>
                          <p className="mt-1 text-lg font-bold text-slate-900">
                            {renderValue(campus?.total_washrooms)}
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-center">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Male Teachers
                          </p>
                          <p className="mt-1 text-lg font-bold text-slate-900">
                            {renderValue(campus?.male_teachers_washrooms)}
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-center">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Female Teachers
                          </p>
                          <p className="mt-1 text-lg font-bold text-slate-900">
                            {renderValue(campus?.female_teachers_washrooms)}
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-center">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Male Students
                          </p>
                          <p className="mt-1 text-lg font-bold text-slate-900">
                            {renderValue(campus?.male_student_washrooms)}
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-center md:col-start-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Female Students
                          </p>
                          <p className="mt-1 text-lg font-bold text-slate-900">
                            {renderValue(campus?.female_student_washrooms)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Facilities */}
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Facilities
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className={`px-3 py-2.5 rounded-lg border text-center ${campus?.library_available ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Library
                          </p>
                          <p className="mt-1 text-sm font-bold text-slate-900">
                            {campus?.library_available ? 'Available' : 'No'}
                          </p>
                        </div>
                        <div className={`px-3 py-2.5 rounded-lg border text-center ${campus?.power_backup ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Power Backup
                          </p>
                          <p className="mt-1 text-sm font-bold text-slate-900">
                            {campus?.power_backup ? 'Available' : 'No'}
                          </p>
                        </div>
                        <div className={`px-3 py-2.5 rounded-lg border text-center ${campus?.internet_available ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Internet
                          </p>
                          <p className="mt-1 text-sm font-bold text-slate-900">
                            {campus?.internet_available ? 'Available' : 'No'}
                          </p>
                        </div>
                        <div className={`px-3 py-2.5 rounded-lg border text-center ${campus?.teacher_transport ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Teacher Transport
                          </p>
                          <p className="mt-1 text-sm font-bold text-slate-900">
                            {campus?.teacher_transport ? 'Available' : 'No'}
                          </p>
                        </div>
                        <div className={`px-3 py-2.5 rounded-lg border text-center ${campus?.canteen_facility ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Canteen
                          </p>
                          <p className="mt-1 text-sm font-bold text-slate-900">
                            {campus?.canteen_facility ? 'Available' : 'No'}
                          </p>
                        </div>
                        <div className={`px-3 py-2.5 rounded-lg border text-center ${campus?.meal_program ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Meal Program
                          </p>
                          <p className="mt-1 text-sm font-bold text-slate-900">
                            {campus?.meal_program ? 'Available' : 'No'}
                          </p>
                        </div>
                      </div>
                      {campus?.sports_available && (
                        <div className="mt-1">
                          <p className="text-[11px] font-semibold uppercase tracking-wide mb-1 text-slate-500">
                            Sports Available
                          </p>
                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900">
                            {renderValue(campus?.sports_available)}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

              </div>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="space-y-4 sm:space-y-6">
              {/* Key Metrics Overview */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* Total Students */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-5 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Total Students</p>
                    <p className="text-2xl sm:text-3xl font-black mt-1" style={{ color: '#274c77' }}>
                      {realStudentData?.total !== undefined ? realStudentData.total : renderValue(campus?.total_students)}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {realStudentData?.total !== undefined ? 'Real Database Count' : 'Campus Record'}
                    </p>
                  </div>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#274c771A' }}>
                    <Users className="w-5 h-5" style={{ color: '#274c77' }} />
                  </div>
                </div>

                {/* Total Staff */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-5 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Total Staff</p>
                    <p className="text-2xl sm:text-3xl font-black mt-1" style={{ color: '#274c77' }}>
                      {(realTeachersCount !== null || realCoordinatorsCount !== null)
                        ? ((realTeachersCount || 0) + (realCoordinatorsCount || 0) + (campus?.total_non_teaching_staff || 0))
                        : renderValue(campus?.total_staff_members)}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {(realTeachersCount !== null || realCoordinatorsCount !== null)
                        ? 'Teachers + Coordinators + Staff'
                        : 'Campus Record'}
                    </p>
                  </div>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#6096ba1A' }}>
                    <GraduationCap className="w-5 h-5" style={{ color: '#6096ba' }} />
                  </div>
                </div>

                {/* Total Rooms */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-5 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Total Rooms</p>
                    <p className="text-2xl sm:text-3xl font-black mt-1" style={{ color: '#274c77' }}>{renderValue(campus?.total_rooms)}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Capacity: {renderValue(campus?.student_capacity)}</p>
                  </div>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#7c3aed1A' }}>
                    <Building className="w-5 h-5" style={{ color: '#7c3aed' }} />
                  </div>
                </div>

                {/* Avg Class Size */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-5 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Avg Class Size</p>
                    <p className="text-2xl sm:text-3xl font-black mt-1" style={{ color: '#274c77' }}>{renderValue(campus?.avg_class_size)}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Optimal range: 25–30</p>
                  </div>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#d977061A' }}>
                    <Target className="w-5 h-5" style={{ color: '#d97706' }} />
                  </div>
                </div>
              </div>

              {/* Grade-wise Breakdown — total / boys / girls / attendance per grade */}
              {id && <CampusGradeBreakdown campusId={id} />}

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Student Demographics Chart */}
                <div>
                  <StudentRadialChart
                    data={{
                      // Use real data if available (even if 0), otherwise fallback to campus record
                      male_students: realStudentData !== null ? (realStudentData.male || 0) : (campus?.male_students || (campus?.total_students ? Math.floor(campus.total_students * 0.6) : 0)),
                      female_students: realStudentData !== null ? (realStudentData.female || 0) : (campus?.female_students || (campus?.total_students ? Math.floor(campus.total_students * 0.4) : 0)),
                      morning_students: realStudentData !== null ? (realStudentData.morning || 0) : (campus?.morning_students || (campus?.total_students ? Math.floor(campus.total_students * 0.7) : 0)),
                      afternoon_students: realStudentData !== null ? (realStudentData.afternoon || 0) : (campus?.afternoon_students || (campus?.total_students ? Math.floor(campus.total_students * 0.3) : 0)),
                      total_students: realStudentData !== null ? (realStudentData.total || 0) : (campus?.total_students || 0)
                    }}
                  />

                </div>

                {/* Staff Distribution Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      Staff Distribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3 sm:gap-4">
                        <div className="text-center p-3 sm:p-4 bg-blue-50 rounded-lg">
                          <div className="text-xl sm:text-2xl font-bold text-blue-600">
                            {realTeachersCount !== null ? realTeachersCount : renderValue(campus?.total_teachers)}
                          </div>
                          <div className="text-xs sm:text-sm text-gray-600">Teachers</div>
                          {realTeachersCount !== null ? (
                            <div className="text-xs text-gray-500 mt-1">Real Count</div>
                          ) : (
                            <div className="text-xs text-gray-500 mt-1">
                              {campus?.male_teachers}M, {campus?.female_teachers}F
                            </div>
                          )}
                        </div>
                        <div className="text-center p-3 sm:p-4 bg-green-50 rounded-lg">
                          <div className="text-xl sm:text-2xl font-bold text-green-600">{renderValue(campus?.total_maids)}</div>
                          <div className="text-xs sm:text-sm text-gray-600">Maids</div>
                        </div>
                        <div className="text-center p-3 sm:p-4 bg-purple-50 rounded-lg">
                          <div className="text-xl sm:text-2xl font-bold text-purple-600">
                            {realCoordinatorsCount !== null ? realCoordinatorsCount : renderValue(campus?.total_coordinators)}
                          </div>
                          <div className="text-xs sm:text-sm text-gray-600">Coordinators</div>
                          {realCoordinatorsCount !== null && (
                            <div className="text-xs text-gray-500 mt-1">Real Count</div>
                          )}
                        </div>
                        <div className="text-center p-3 sm:p-4 bg-red-50 rounded-lg">
                          <div className="text-xl sm:text-2xl font-bold text-red-600">{renderValue(campus?.total_guards)}</div>
                          <div className="text-xs sm:text-sm text-gray-600">Guards</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Infrastructure Overview */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="w-5 h-5" />
                      Infrastructure Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3 sm:gap-4">
                        <div className="text-center p-3 sm:p-4 border rounded-lg">
                          <div className="text-2xl sm:text-3xl font-bold text-indigo-600">{renderValue(campus?.total_classrooms)}</div>
                          <div className="text-xs sm:text-sm text-gray-600">Classrooms</div>
                        </div>
                        <div className="text-center p-3 sm:p-4 border rounded-lg">
                          <div className="text-2xl sm:text-3xl font-bold text-green-600">{renderValue(campus?.total_offices)}</div>
                          <div className="text-xs sm:text-sm text-gray-600">Offices</div>
                        </div>
                        <div className="text-center p-3 sm:p-4 border rounded-lg">
                          <div className="text-2xl sm:text-3xl font-bold text-purple-600">{renderValue(campus?.num_computer_labs)}</div>
                          <div className="text-xs sm:text-sm text-gray-600">Computer Labs</div>
                        </div>
                        <div className="text-center p-3 sm:p-4 border rounded-lg">
                          <div className="text-2xl sm:text-3xl font-bold text-orange-600">{renderValue(campus?.num_science_labs)}</div>
                          <div className="text-xs sm:text-sm text-gray-600">Science Labs</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Facilities Status */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wifi className="w-5 h-5" />
                      Facilities Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className={`p-3 sm:p-4 rounded-lg border-2 ${campus?.library_available ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs sm:text-sm font-medium">Library</span>
                          <div className={`w-3 h-3 rounded-full ${campus?.library_available ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        </div>
                      </div>
                      <div className={`p-3 sm:p-4 rounded-lg border-2 ${campus?.power_backup ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs sm:text-sm font-medium">Power Backup</span>
                          <div className={`w-3 h-3 rounded-full ${campus?.power_backup ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        </div>
                      </div>
                      <div className={`p-3 sm:p-4 rounded-lg border-2 ${campus?.internet_available ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs sm:text-sm font-medium">Internet</span>
                          <div className={`w-3 h-3 rounded-full ${campus?.internet_available ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        </div>
                      </div>
                      {campus?.sports_available && (
                        <div className={`p-3 sm:p-4 rounded-lg border-2 border-green-200 bg-green-50`}>
                          <div className="flex items-center justify-between">
                            <span className="text-xs sm:text-sm font-medium">Sports Available</span>
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                          </div>
                          <p className="text-xs text-gray-600 mt-1">{renderValue(campus?.sports_available)}</p>
                        </div>
                      )}
                      <div className={`p-3 sm:p-4 rounded-lg border-2 ${campus?.canteen_facility ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs sm:text-sm font-medium">Canteen</span>
                          <div className={`w-3 h-3 rounded-full ${campus?.canteen_facility ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        </div>
                      </div>
                      <div className={`p-3 sm:p-4 rounded-lg border-2 ${campus?.meal_program ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs sm:text-sm font-medium">Meal Program</span>
                          <div className={`w-3 h-3 rounded-full ${campus?.meal_program ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Performance Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Activity className="w-4 h-4 sm:w-5 sm:h-5" />
                    Performance Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                    <div className="text-center">
                      <div className="text-3xl sm:text-4xl font-bold text-blue-600 mb-2">
                        {(realStudentData?.total !== undefined ? realStudentData.total : campus?.total_students) && campus?.student_capacity ?
                          Math.round(((realStudentData?.total !== undefined ? realStudentData.total : campus?.total_students) / campus.student_capacity) * 100) : 0}%
                      </div>
                      <div className="text-sm text-gray-600">Capacity Utilization</div>
                      {realStudentData?.total !== undefined && (
                        <div className="text-xs text-gray-500 mt-1">Using Real Student Count</div>
                      )}
                      <Progress
                        value={(realStudentData?.total !== undefined ? realStudentData.total : campus?.total_students) && campus?.student_capacity ?
                          ((realStudentData?.total !== undefined ? realStudentData.total : campus?.total_students) / campus.student_capacity) * 100 : 0}
                        className="mt-2"
                      />
                    </div>
                    <div className="text-center">
                      <div className="text-3xl sm:text-4xl font-bold text-green-600 mb-2">
                        {(realTeachersCount || campus?.total_teachers) && (realStudentData?.total !== undefined ? realStudentData.total : campus?.total_students) ?
                          Math.round((realStudentData?.total !== undefined ? realStudentData.total : campus?.total_students) / (realTeachersCount || campus?.total_teachers || 1)) : 0}
                      </div>
                      <div className="text-sm text-gray-600">Student-Teacher Ratio</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {realTeachersCount !== null ? 'Using Real Count' : ''} Ideal: 15-20
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl sm:text-4xl font-bold text-purple-600 mb-2">
                        {campus?.total_classrooms && (realStudentData?.total !== undefined ? realStudentData.total : campus?.total_students) ?
                          Math.round((realStudentData?.total !== undefined ? realStudentData.total : campus?.total_students) / campus.total_classrooms) : 0}
                      </div>
                      <div className="text-sm text-gray-600">Students per Classroom</div>
                      <div className="text-xs text-gray-500 mt-1">Current avg: {renderValue(campus?.avg_class_size)}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Edit Campus Dialog — org_admin only */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-800">Edit Campus</DialogTitle>
          </DialogHeader>

          <div className="space-y-8 py-2">

            {/* Campus Photo */}
            <section className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b pb-1">Campus Photo</h3>
              <div className="flex items-center gap-4">
                {(photoPreview || editData.campus_photo) && (
                  <img
                    src={photoPreview || getImageUrl(editData.campus_photo) || ''}
                    alt="Campus"
                    className="h-24 w-auto max-w-[200px] rounded-lg border bg-white object-contain p-1"
                  />
                )}
                <div className="space-y-1">
                  <input ref={photoInputRef} type="file" accept="image/png,image/jpeg,image/gif" className="hidden" onChange={handlePhotoChange} />
                  <Button type="button" size="sm" variant="outline" onClick={() => photoInputRef.current?.click()}>
                    {(photoPreview || editData.campus_photo) ? 'Change Photo' : 'Upload Photo'}
                  </Button>
                  {(photoPreview || editData.campus_photo) && (
                    <Button type="button" size="sm" variant="ghost" className="text-red-600 ml-2"
                      onClick={() => { setPhotoFile(null); setPhotoPreview(null); handleEditField('campus_photo', null) }}>
                      Remove
                    </Button>
                  )}
                  <p className="text-xs text-slate-400">PNG, JPG or GIF</p>
                </div>
              </div>
            </section>

            {/* Basic Information */}
            <section className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b pb-1">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Campus Name</Label>
                  <select
                    value={editData.campus_name || ''}
                    onChange={e => {
                      const opt = CAMPUS_OPTIONS.find(o => o.name === e.target.value)
                      handleEditField('campus_name', e.target.value)
                      if (opt) handleEditField('campus_code', opt.code)
                    }}
                    className="h-10 w-full border border-slate-200 bg-white rounded-md px-3 py-2 text-sm"
                  >
                    <option value="">Select Campus Name</option>
                    {CAMPUS_OPTIONS.map(o => <option key={o.name} value={o.name}>{o.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Campus Code</Label>
                  <select
                    value={editData.campus_code || ''}
                    onChange={e => {
                      const opt = CAMPUS_OPTIONS.find(o => o.code === e.target.value)
                      handleEditField('campus_code', e.target.value)
                      if (opt) handleEditField('campus_name', opt.name)
                    }}
                    className="h-10 w-full border border-slate-200 bg-white rounded-md px-3 py-2 text-sm"
                  >
                    <option value="">Select Campus Code</option>
                    {CAMPUS_OPTIONS.map(o => <option key={o.code} value={o.code}>{o.code}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase text-slate-400">Campus ID</Label>
                  <div className="h-10 w-full border border-slate-200 bg-slate-100 rounded-md px-3 flex items-center gap-2 cursor-not-allowed">
                    <span className="font-mono text-xs text-slate-400 select-none">
                      {(() => {
                        const base = campus?.campus_id || ''
                        const origCode = campus?.campus_code || ''
                        const newCode = editData.campus_code || ''
                        if (base && origCode && newCode && base.endsWith('-' + origCode)) {
                          return base.slice(0, -(origCode.length)) + newCode
                        }
                        return base || '—'
                      })()}
                    </span>
                    <span className="ml-auto text-[10px] text-slate-400 font-medium">auto</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Campus Type</Label>
                  <select value={editData.campus_type || ''} onChange={e => handleEditField('campus_type', e.target.value)}
                    className="h-10 w-full border border-slate-200 bg-white rounded-md px-3 py-2 text-sm">
                    <option value="main">Main</option>
                    <option value="branch">Branch</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Status</Label>
                  <select value={editData.status || ''} onChange={e => handleEditField('status', e.target.value)}
                    className="h-10 w-full border border-slate-200 bg-white rounded-md px-3 py-2 text-sm">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="pending">Pending</option>
                    <option value="closed">Closed</option>
                    <option value="under_construction">Under Construction</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Established Year</Label>
                  <Input type="number" value={editData.established_year || ''} onChange={e => handleEditField('established_year', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Registration Number</Label>
                  <Input value={editData.registration_number || ''} onChange={e => handleEditField('registration_number', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Governing Body</Label>
                  <Input value={editData.governing_body || ''} onChange={e => handleEditField('governing_body', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Accreditation</Label>
                  <Input value={editData.accreditation || ''} onChange={e => handleEditField('accreditation', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Instruction Language</Label>
                  <select value={editData.instruction_language || ''} onChange={e => handleEditField('instruction_language', e.target.value)}
                    className="h-10 w-full border border-slate-200 bg-white rounded-md px-3 py-2 text-sm">
                    <option value="">Select</option>
                    <option value="Urdu">Urdu</option>
                    <option value="English">English</option>
                    <option value="Both">Both</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Location & Contact */}
            <section className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b pb-1">Location & Contact</h3>
              <div className="space-y-1">
                <Label className="text-xs font-semibold uppercase text-slate-500">Full Address</Label>
                <Textarea value={editData.address_full || ''} onChange={e => handleEditField('address_full', e.target.value)} className="min-h-[80px]" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase text-slate-500">City</Label>
                  <Input value={editData.city || ''} onChange={e => handleEditField('city', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase text-slate-500">District</Label>
                  <Input value={editData.district || ''} onChange={e => handleEditField('district', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Postal Code</Label>
                  <Input value={editData.postal_code || ''} onChange={e => handleEditField('postal_code', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Primary Phone</Label>
                  <Input value={editData.primary_phone || ''} onChange={e => handleEditField('primary_phone', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Secondary Phone</Label>
                  <Input value={editData.secondary_phone || ''} onChange={e => handleEditField('secondary_phone', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Official Email</Label>
                  <Input type="email" value={editData.official_email || ''} onChange={e => handleEditField('official_email', e.target.value)} />
                </div>
              </div>
            </section>

            {/* Administration */}
            <section className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b pb-1">Administration</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Campus Head Name</Label>
                  <Input value={editData.campus_head_name || ''} onChange={e => handleEditField('campus_head_name', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Campus Head Phone</Label>
                  <Input value={editData.campus_head_phone || ''} onChange={e => handleEditField('campus_head_phone', e.target.value)} />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Campus Head Email</Label>
                  <Input type="email" value={editData.campus_head_email || ''} onChange={e => handleEditField('campus_head_email', e.target.value)} />
                </div>
              </div>
            </section>

            {/* Academic */}
            <section className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b pb-1">Academic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Academic Year Start Month</Label>
                  <select value={editData.academic_year_start_month || ''} onChange={e => handleEditField('academic_year_start_month', e.target.value)}
                    className="h-10 w-full border border-slate-200 bg-white rounded-md px-3 py-2 text-sm">
                    <option value="">Select</option>
                    {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Academic Year End Month</Label>
                  <select value={editData.academic_year_end_month || ''} onChange={e => handleEditField('academic_year_end_month', e.target.value)}
                    className="h-10 w-full border border-slate-200 bg-white rounded-md px-3 py-2 text-sm">
                    <option value="">Select</option>
                    {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Shift Available</Label>
                  <select value={editData.shift_available || ''} onChange={e => handleEditField('shift_available', e.target.value)}
                    className="h-10 w-full border border-slate-200 bg-white rounded-md px-3 py-2 text-sm">
                    <option value="morning">Morning</option>
                    <option value="afternoon">Afternoon</option>
                    <option value="both">Both</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Student Capacity</Label>
                  <Input type="number" value={editData.student_capacity ?? ''} onChange={e => handleEditField('student_capacity', e.target.value)} />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Grades Available</Label>
                  <Input value={editData.grades_available || ''} onChange={e => handleEditField('grades_available', e.target.value)} placeholder="e.g. Nursery, 1, 2, 3" />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Grades Offered</Label>
                  <Input value={editData.grades_offered || ''} onChange={e => handleEditField('grades_offered', e.target.value)} />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Sports Available</Label>
                  <Input value={editData.sports_available || ''} onChange={e => handleEditField('sports_available', e.target.value)} placeholder="e.g. Cricket, Football" />
                </div>
              </div>
            </section>

            {/* Infrastructure */}
            <section className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b pb-1">Infrastructure</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Total Classrooms</Label>
                  <Input type="number" value={editData.total_classrooms ?? ''} onChange={e => handleEditField('total_classrooms', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase text-slate-500">Total Staff Rooms</Label>
                  <Input type="number" value={editData.total_staff_rooms ?? ''} onChange={e => handleEditField('total_staff_rooms', e.target.value)} />
                </div>
              </div>
            </section>

            {/* Facilities */}
            <section className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b pb-1">Facilities</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {([
                  ['library_available', 'Library'],
                  ['power_backup', 'Power Backup'],
                  ['internet_available', 'Internet'],
                  ['teacher_transport', 'Teacher Transport'],
                  ['student_transport', 'Student Transport'],
                  ['canteen_facility', 'Canteen'],
                  ['meal_program', 'Meal Program'],
                  ['has_computer_lab', 'Computer Lab'],
                  ['has_science_lab', 'Science Lab'],
                  ['has_biology_lab', 'Biology Lab'],
                  ['has_chemistry_lab', 'Chemistry Lab'],
                  ['has_physics_lab', 'Physics Lab'],
                ] as [string, string][]).map(([field, label]) => (
                  <label key={field} className="flex items-center gap-2 cursor-pointer rounded-lg border border-slate-200 px-3 py-2.5 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={!!editData[field]}
                      onChange={e => handleEditField(field, e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm font-medium text-slate-700">{label}</span>
                  </label>
                ))}
              </div>
            </section>

          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#274c77] hover:bg-[#1e3a5f] text-white">
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}

export default function AdminCampusProfilePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <CampusProfileContent />
    </Suspense>
  )
}