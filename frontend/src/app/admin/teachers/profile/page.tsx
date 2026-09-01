"use client"
import React, { useState, useEffect, Suspense, useRef, useCallback } from "react"
// Force rebuild: 2026-04-15-T11-20
import { useRouter, useSearchParams } from "next/navigation"
import {
  Mail, Phone, MapPin, Shield, Calendar, GraduationCap,
  Building2, Clock, Award, Briefcase, Edit3, Key,
  Users, ClipboardList, CheckCircle, FileText, Megaphone,
  BarChart3, AlertTriangle, ArrowRight, ChevronRight,
  TrendingUp, User, Activity, Star, BookOpen, ArrowLeft,
  LayoutDashboard, Camera, Loader2, X, Info, XCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  getTeacherById,
  getAllTeachers,
  getTeacherClasses,
  getTeacherAttendanceSummary,
  getAttendanceForDate,
  getClassStudents,
  getTeacherWeeklyAttendance,
  apiPatchFormData,
  refreshUserProfile,
  API_ENDPOINTS
} from "@/lib/api"
import { SmartAvatar } from "@/components/ui/smart-avatar"
import { getCurrentUserRole } from '@/lib/permissions'
import { StaffAttendanceSection } from "@/components/attendance/staff-attendance-section"

// Newton AMS Theme Colors
const colors = {
  primary: '#274c77',
  secondary: '#6096ba',
  accent: '#a3cef1',
  light: '#e7ecef',
  dark: '#8b8c89',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444'
}

function TeacherProfileContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const teacherId = searchParams.get('id')
  const currentRole = getCurrentUserRole()
  const canSeeReportButtons = currentRole === 'coordinator' || currentRole === 'teacher'

  const [teacher, setTeacher] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [teacherClasses, setTeacherClasses] = useState<any[]>([])
  const [selectedClassroom, setSelectedClassroom] = useState<any>(null)
  const [attendanceData, setAttendanceData] = useState<any>(null)
  const [weeklyAttendance, setWeeklyAttendance] = useState<any[]>([])
  const [todayAttendance, setTodayAttendance] = useState<any>(null)
  const [classStudents, setClassStudents] = useState<any[]>([])
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0) // 0=current week, 1=previous, ...
  const [weekLeaveCount, setWeekLeaveCount] = useState(0)
  const [weekExtraLoading, setWeekExtraLoading] = useState(false)
  const [trendRange, setTrendRange] = useState<'7d' | '15d' | '30d'>('30d')
  const [trendData, setTrendData] = useState<Array<{ label: string, present: number, absent: number, pct: number }>>([])
  const [studentsOfMonth, setStudentsOfMonth] = useState<Array<{ id: number, name: string, present: number, percentage: number }>>([])
  const [studentsOfMonthLoading, setStudentsOfMonthLoading] = useState(false)

  // ── Photo Upload States ──
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [localPhoto,     setLocalPhoto]     = useState<string | null>(null)
  const [uploading,      setUploading]      = useState(false)
  const [uploadError,    setUploadError]    = useState<string | null>(null)
  const [uploadSuccess,  setUploadSuccess]  = useState(false)

  const photo = localPhoto || teacher?.photo || teacher?.profile_image || null

  // Report generation modal state
  const [reportOpen, setReportOpen] = useState(false)
  const [reportGenerating, setReportGenerating] = useState(false)
  const [reportScope, setReportScope] = useState<'date' | 'student'>('date') // date-wise or student-wise
  const [reportType, setReportType] = useState<'weekly' | 'monthly'>('weekly')
  const [reportWeekStart, setReportWeekStart] = useState<string>('')
  const [reportMonth, setReportMonth] = useState<string>('')
  const [weekMonth, setWeekMonth] = useState<string>('')

  // Helpers for week calculations
  const getMondayOfDate = (d: Date) => {
    const day = (d.getDay() + 6) % 7 // 0..6 => Mon=0
    const mon = new Date(d)
    mon.setDate(d.getDate() - day)
    mon.setHours(0, 0, 0, 0)
    return mon
  }

  const toISO = (d: Date) => d.toISOString().split('T')[0]

  const computeWeeksForMonth = (ym: string) => {
    if (!ym) return [] as Array<{ label: string; range: string; mondayISO: string }>
    const [y, m] = ym.split('-').map(Number)
    const first = new Date(y, m - 1, 1)
    const last = new Date(y, m, 0)
    const today = new Date()
    const capEnd = (y === today.getFullYear() && (m - 1) === today.getMonth()) ? today : last
    const weeks: Array<{ label: string; range: string; mondayISO: string }> = []
    const mon = getMondayOfDate(first)
    let idx = 1
    while (mon <= capEnd) {
      const start = new Date(mon)
      const end = new Date(mon)
      end.setDate(mon.getDate() + 6)
      const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
      const label = `Week ${idx}`
      const range = `${fmt(start)} – ${fmt(end)}`
      weeks.push({ label, range, mondayISO: toISO(start) })
      mon.setDate(mon.getDate() + 7)
      idx += 1
    }
    return weeks
  }

  useEffect(() => {
    document.title = "Teacher Profile | Newton AMS";
  }, []);

  useEffect(() => {
    async function fetchTeacherData() {
      if (!teacherId) {
        setError("No teacher ID provided")
        setLoading(false)
        return
      }

      try {
        const teacherData = await getTeacherById(teacherId)

        if (teacherData) {
          setTeacher(teacherData)

          // Derive classrooms from profile data
          const classrooms: any[] = []
          
          // 1. Check assigned_classrooms_details (detailed objects)
          if (Array.isArray(teacherData.assigned_classrooms_details)) {
            teacherData.assigned_classrooms_details.forEach((c: any) => {
              if (c && c.id && !classrooms.find(ex => ex.id === c.id)) {
                classrooms.push({
                  id: c.id,
                  name: c.name || `${c.grade_name || ''} - ${c.section || ''}`.trim()
                })
              }
            })
          }
          
          // 2. Check classroom_data (usually the primary assigned class)
          if (teacherData.classroom_data && !classrooms.find(ex => ex.id === teacherData.classroom_data.id)) {
            classrooms.push({
              id: teacherData.classroom_data.id,
              name: teacherData.classroom_data.name || `${teacherData.classroom_data.grade_name || ''} - ${teacherData.classroom_data.section || ''}`.trim()
            })
          }
          
          // 3. Check assigned_classrooms array (IDs)
          if (Array.isArray(teacherData.assigned_classrooms)) {
            teacherData.assigned_classrooms.forEach((c: any) => {
              const cid = typeof c === 'object' ? (c.id || c.classroom_id) : c
              if (cid && !classrooms.find(ex => ex.id === cid)) {
                classrooms.push({
                  id: cid,
                  name: typeof c === 'object' ? (c.name || c.title || c.grade_name) : 'Assigned Class'
                })
              }
            })
          }

          // 4. Fallback to assigned_classroom ID if nothing found yet
          if (classrooms.length === 0 && teacherData.assigned_classroom) {
             const cid = typeof teacherData.assigned_classroom === 'object' ? teacherData.assigned_classroom.id : teacherData.assigned_classroom
             classrooms.push({
               id: cid,
               name: teacherData.classroom_name || 'Assigned Class'
             })
          }

          setTeacherClasses(classrooms)
          if (classrooms.length > 0) {
            setSelectedClassroom(classrooms[0])
          }
        } else {
          const allTeachers = await getAllTeachers()
          const foundTeacher = allTeachers.find((t: any) => t.id.toString() === teacherId)

          if (foundTeacher) {
            setTeacher(foundTeacher)
          } else {
            setError("Teacher not found")
          }
        }
      } catch (err: any) {
        setError(err.message || "Failed to load teacher data")
      } finally {
        setLoading(false)
      }
    }

    fetchTeacherData()
  }, [teacherId])

  // Initialize report modal defaults when opening
  useEffect(() => {
    if (reportOpen) {
      const now = new Date()
      const mon = getMondayOfDate(now)
      setReportWeekStart(toISO(mon))
      setWeekMonth(now.toISOString().slice(0, 7))
      setReportMonth(now.toISOString().slice(0, 7))
    }
  }, [reportOpen])

  // Fetch attendance data when classroom is selected (only for teacher/coordinator roles)
  useEffect(() => {
    async function fetchAttendanceData() {
      if (!selectedClassroom?.id) return
      // Principals and org-admins cannot access teacher attendance APIs
      if (!['teacher', 'coordinator'].includes(currentRole)) return

      setAttendanceLoading(true)
      try {
        // Default pull for last 60 days to have enough data for trends
        const currentDate = new Date()
        const start = new Date(currentDate)
        start.setDate(currentDate.getDate() - 59)
        const startDate = start.toISOString().split('T')[0]
        const endDate = currentDate.toISOString().split('T')[0]
        const baseData = await getTeacherAttendanceSummary(selectedClassroom.id, startDate, endDate)
        setAttendanceData(Array.isArray(baseData) ? baseData : [])

        // Fetch weekly attendance
        const weeklyData = await getTeacherWeeklyAttendance(selectedClassroom.id)
        setWeeklyAttendance(Array.isArray(weeklyData) ? weeklyData : [])

        // Fetch today's attendance
        const todayDateStr = new Date().toISOString().split('T')[0]
        try {
          const todayData = await getAttendanceForDate(selectedClassroom.id, todayDateStr)
          setTodayAttendance(todayData)
        } catch (_) { /* No attendance for today yet */ }

        // Fetch class students
        const students = await getClassStudents(selectedClassroom.id)
        setClassStudents(Array.isArray(students) ? students : [])
      } catch (err) {
        // silently handle attendance fetch errors
      } finally {
        setAttendanceLoading(false)
      }
    }

    if (selectedClassroom) {
      fetchAttendanceData()
    }
  }, [selectedClassroom, currentRole])

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
      if (!teacherId) throw new Error("Teacher ID not found")

      const fd = new FormData()
      fd.append("photo", file)

      // PATCH returns the updated teacher with absolute photo URL
      const updated = await apiPatchFormData<any>(
        `${API_ENDPOINTS.TEACHERS}${teacherId}/`, fd
      )

      // Sync localStorage if editing own profile
      await refreshUserProfile()

      // Revoke blob URL — use the absolute URL returned by the server
      URL.revokeObjectURL(objectUrl)
      const rawPhoto = updated?.photo || null
      const serverPhoto = rawPhoto
        ? `${rawPhoto}${rawPhoto.includes("?") ? "&" : "?"}t=${Date.now()}`
        : null
      setLocalPhoto(serverPhoto)

      // Patch localStorage with cache-busted URL if we are the user being updated
      if (serverPhoto && typeof window !== "undefined") {
        try {
          const stored = JSON.parse(window.localStorage.getItem("sis_user") || "{}")
          if (stored.id === teacher?.user || stored.id === teacher?.user_id) {
            window.localStorage.setItem("sis_user", JSON.stringify({ ...stored, photo: serverPhoto }))
          }
        } catch {}
      }

      setUploadSuccess(true)
      setTimeout(() => setUploadSuccess(false), 3000)

      // Notify updates
      window.dispatchEvent(new Event("storage"))
      window.dispatchEvent(new Event("profile-photo-updated"))
    } catch (err: any) {
      setUploadError(err?.message || "Upload failed. Please try again.")
      setLocalPhoto(null)             // revert preview on error
    } finally {
      setUploading(false)
    }
  }, [teacherId, teacher])


  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'T'
  }

  const buildQualification = (t: any) => {
    const level = t?.education_level || t?.qualification || t?.highest_qualification
    const subjects = t?.education_subjects
    const grade = t?.education_grade
    const inst = t?.institution_name
    const year = t?.year_of_passing
    const parts: string[] = []
    if (level) parts.push(level)
    if (subjects) parts.push(`in ${subjects}`)
    const tail: string[] = []
    if (inst) tail.push(inst)
    if (year) tail.push(String(year))
    if (grade) tail.push(`Grade: ${grade}`)
    if (tail.length) parts.push(`(${tail.join(', ')})`)
    return parts.join(' ')
  }

  // Calculate attendance percentage

  const getWeekAttendanceMonSat = (offset: number = 0) => {
    if (!attendanceData || !Array.isArray(attendanceData)) return []

    const today = new Date()
    // Compute Monday of the current week (Mon=1, Sun=0)
    const day = today.getDay() // 0..6 (Sun..Sat)
    const offsetFromMonday = (day + 6) % 7
    const monday = new Date(today)
    monday.setDate(today.getDate() - offsetFromMonday - (offset * 7))

    const days: Array<{ day: string; present: number; leave: number; absent: number; date: string }> = []
    const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    for (let i = 0; i < 6; i++) {
      const date = new Date(monday)
      date.setDate(monday.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]

      const dayData = attendanceData.find((d: any) => d.date === dateStr)

      if (dayData) {
        const present = dayData.present_count || 0
        const absent = dayData.absent_count || 0
        const leave = dayData.leave_count ?? dayData.on_leave_count ?? 0
        const total = present + absent + leave
        const presentPct = total > 0 ? Math.round((present / total) * 100) : 0
        const leavePct = total > 0 ? Math.round((leave / total) * 100) : 0
        const absentPct = Math.max(0, 100 - presentPct - leavePct)
        days.push({ day: names[i], present: presentPct, leave: leavePct, absent: absentPct, date: dateStr })
      } else {
        days.push({ day: names[i], present: 0, leave: 0, absent: 0, date: dateStr })
      }
    }

    return days
  }

  // Get greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good Morning"
    if (hour < 17) return "Good Afternoon"
    return "Good Evening"
  }

  async function generateAttendanceReport() {
    if (!selectedClassroom?.id || !teacher) {
      return
    }
    setReportGenerating(true)
    try {
      let startDate = ''
      let endDate = ''
      if (reportType === 'weekly') {
        if (!reportWeekStart) {
          setReportGenerating(false)
          return
        }
        const mon = new Date(reportWeekStart)
        const sun = new Date(mon)
        sun.setDate(mon.getDate() + 6)
        startDate = mon.toISOString().split('T')[0]
        endDate = sun.toISOString().split('T')[0]
      } else {
        if (!reportMonth) {
          setReportGenerating(false)
          return
        }
        const [y, m] = reportMonth.split('-').map(Number)
        const first = new Date(y, m - 1, 1)
        const last = new Date(y, m, 0)
        startDate = first.toISOString().split('T')[0]
        endDate = last.toISOString().split('T')[0]
      }

      if (reportScope === 'student') {
        // Student-wise report: aggregate per-student across the selected range
        const rosterRes: any = await getClassStudents(selectedClassroom.id)
        const mapStudent = (s: any) => {
          const sid = s?.id ?? s?.student_id ?? s?.student?.id
          const sname = s?.full_name || s?.name || s?.student?.full_name || s?.student?.name || 'Student'
          return { id: sid, name: sname }
        }
        const roster: Array<{ id: number, name: string }> = Array.isArray(rosterRes)
          ? rosterRes.map(mapStudent)
          : (rosterRes?.students || []).map(mapStudent)
        const byStudent = new Map<number, { name: string, present: number, leave: number, absent: number }>()
        roster.forEach(s => byStudent.set(s.id, { name: s.name, present: 0, leave: 0, absent: 0 }))

        const iter = new Date(startDate)
        const endD = new Date(endDate)
        // Count total counted days in the range (exclude Sundays)
        let countedDays = 0
        while (iter <= endD) {
          const isSunday = iter.getDay() === 0
          const dstr = iter.toISOString().slice(0, 10)
          // Skip Sundays from totals
          if (!isSunday) {
            countedDays += 1
            try {
              const dayRes: any = await getAttendanceForDate(selectedClassroom.id, dstr)
              const itemsRaw: any = (dayRes && (dayRes.student_attendances || dayRes.student_attendance)) || []
              const items: any[] = Array.isArray(itemsRaw) ? itemsRaw : []
              const norm = (v: any) => String(v || '').toLowerCase()
              items.forEach((sa: any) => {
                const id = sa?.student_id ?? sa?.student ?? sa?.id
                if (!byStudent.has(id)) return
                const rec = byStudent.get(id)!
                const stRaw = norm(sa.status)
                const st = stRaw.replace(/[^a-z]/g, '')
                if (st === 'present') rec.present += 1
                else if (st.includes('leave') || st === 'l' || st === 'onleave') rec.leave += 1
                else if (st === 'absent') rec.absent += 1
              })
            } catch { }
          }
          iter.setDate(iter.getDate() + 1)
        }

        const rows = Array.from(byStudent.entries()).map(([id, s]) => {
          // For student-wise percentage, exclude leave from denominator
          const denom = s.present + s.absent
          const pct = denom > 0 ? Math.round((s.present / denom) * 100) : 0
          return `<tr>
            <td>${s.name}</td>
            <td style=\"text-align:center;\">${countedDays}</td>
            <td style=\"text-align:center;\">${s.present}</td>
            <td style=\"text-align:center;\">${s.leave}</td>
            <td style=\"text-align:center;\">${s.absent}</td>
            <td style=\"text-align:center; font-weight:600;\">${pct}%</td>
          </tr>`
        }).join('')

        const rangeLabel = `${startDate} to ${endDate}`
        const html = `<!doctype html>
        <html>
          <head>
            <meta charset=\"utf-8\" />
            <title>Student-wise Attendance Report</title>
            <style>
              :root{--primary:${colors.primary};--secondary:${colors.secondary};--accent:${colors.accent};}
              *{box-sizing:border-box}
              body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu; color:#0f172a; background:#ffffff}
              .container{max-width:980px;margin:28px auto;padding:0 18px}
              .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;background:linear-gradient(135deg,var(--primary),var(--secondary));color:#fff;padding:18px;border-radius:14px;box-shadow:0 8px 20px rgba(39,76,119,.18)}
              .title{font-size:22px;font-weight:800}
              .meta{font-size:12px;opacity:.9}
              .card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:16px;margin-bottom:18px;box-shadow:0 4px 14px rgba(2,6,23,.05)}
              table{width:100%;border-collapse:separate;border-spacing:0;margin-top:8px;overflow:hidden;border-radius:10px}
              th,td{border:1px solid #e5e7eb;padding:10px 12px;font-size:13px}
              th{background:#f8fafc;text-align:left;color:#0f172a}
              tr:nth-child(even) td{background:#fafafa}
              .footer{display:flex;justify-content:space-between;margin-top:20px;color:#64748b;font-size:12px}
              .badge{display:inline-block;background:rgba(255,255,255,.25);color:#fff;border:1px solid rgba(255,255,255,.5);border-radius:10px;padding:6px 10px;font-size:12px;font-weight:700}
              .note{margin-top:6px;font-size:12px}
              .btn{padding:8px 14px;border:2px solid var(--secondary);color:var(--secondary);background:#fff;border-radius:10px;font-weight:700}
              @media print {.no-print{display:none}.header{box-shadow:none}}
            </style>
          </head>
          <body>
            <div class=\"container\">
              <div class=\"header\">
                <div>
                  <div class=\"title\">Student-wise Attendance Report</div>
                  <div class=\"meta\">${teacher.full_name || ''} • ${selectedClassroom?.name || ''}</div>
                  <div class=\"meta\">Period: ${rangeLabel}</div>
                  <div class=\"note\"><strong>Note:</strong> Leave is excluded from Attendance % calculation.</div>
                </div>
                <div class=\"badge\">${reportType === 'weekly' ? 'Weekly' : 'Monthly'}</div>
              </div>
              <div class=\"card\">
                <table>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th style=\"text-align:center;\">Days</th>
                      <th style=\"text-align:center;\">Present</th>
                      <th style=\"text-align:center;\">Leave</th>
                      <th style=\"text-align:center;\">Absent</th>
                      <th style=\"text-align:center;\">Attendance %</th>
                    </tr>
                  </thead>
                  <tbody>
                  ${rows || '<tr><td colspan="6" style="text-align:center; padding:16px;">No records</td></tr>'}
                  </tbody>
                </table>
              </div>
              <div class=\"footer\">
                <div>Generated on ${new Date().toLocaleString()}</div>
                <div class=\"no-print\"><button class=\"btn\" onclick=\"window.print()\">Print / Save PDF</button></div>
              </div>
            </div>
          </body>
        </html>`
        const w = window.open('', '_blank')
        if (w) {
          w.document.open();
          w.document.write(html);
          w.document.close();
          // Focus on the new window after a brief delay
          setTimeout(() => {
            w?.focus()
          }, 100)
        }
        setReportGenerating(false)
        setReportOpen(false)
        return
      }

      const summary = await getTeacherAttendanceSummary(selectedClassroom.id, startDate, endDate)
      const list: any[] = Array.isArray(summary) ? summary : []
      const byDate = new Map<string, any>()
      list.forEach((d: any) => byDate.set(d.date, d))

      let totalPresent = 0
      let totalAbsent = 0
      let totalLeave = 0

      const rowsArr: string[] = []
      const iter = new Date(startDate)
      const end = new Date(endDate)
      while (iter <= end) {
        const dstr = iter.toISOString().slice(0, 10)
        const isSunday = iter.getDay() === 0
        const d = byDate.get(dstr)
        let p = d?.present_count || 0
        let a = d?.absent_count || 0
        let l = (d?.leave_count ?? d?.on_leave_count ?? d?.leaves_count ?? d?.leaves ?? d?.leave) || 0

        // Fallback fetch if summary has zeros but detailed record may exist
        if (!isSunday && (p + a + l) === 0) {
          try {
            const dayRes: any = await getAttendanceForDate(selectedClassroom.id, dstr)
            if (Array.isArray(dayRes?.student_attendances)) {
              const items = dayRes.student_attendances
              const norm = (v: any) => String(v || '').toLowerCase()
              p = items.filter((s: any) => norm(s.status) === 'present').length
              l = items.filter((s: any) => {
                const stRaw = norm(s.status)
                const st = stRaw.replace(/[^a-z]/g, '') // normalize e.g. 'on leave', 'on_leave'
                return st.includes('leave') || st === 'l' || st === 'onleave'
              }).length
              // Absent can be explicit or inferred
              a = items.filter((s: any) => norm(s.status) === 'absent').length
              if (l === 0 && Number.isFinite(dayRes?.total_students)) {
                const inferred = Math.max(Number(dayRes.total_students) - p - a, 0)
                if (inferred > 0) l = inferred
              }
            } else {
              // Try counts if provided
              p = dayRes?.present_count || p
              l = (dayRes?.leave_count ?? dayRes?.on_leave_count ?? dayRes?.leaves_count ?? dayRes?.leaves ?? dayRes?.leave) || l
              a = dayRes?.absent_count || a
              if (l === 0 && Number.isFinite(dayRes?.total_students)) {
                const inferred = Math.max(Number(dayRes.total_students) - p - a, 0)
                if (inferred > 0) l = inferred
              }
            }
          } catch { }
        }
        // If leave is still 0, try a lightweight fetch to compute it from daily records
        if (!isSunday && l === 0) {
          try {
            const dayRes: any = await getAttendanceForDate(selectedClassroom.id, dstr)
            if (Array.isArray(dayRes?.student_attendances)) {
              const items = dayRes.student_attendances
              const norm = (v: any) => String(v || '').toLowerCase()
              const computedLeave = items.filter((s: any) => {
                const stRaw = norm(s.status)
                const st = stRaw.replace(/[^a-z]/g, '')
                return st.includes('leave') || st === 'l' || st === 'onleave'
              }).length
              if (computedLeave > 0) l = computedLeave
              if (!p) p = items.filter((s: any) => norm(s.status) === 'present').length
              if (!a) a = items.filter((s: any) => norm(s.status) === 'absent').length
              if (l === 0 && Number.isFinite(dayRes?.total_students)) {
                const inferred = Math.max(Number(dayRes.total_students) - p - a, 0)
                if (inferred > 0) l = inferred
              }
            } else {
              // No detailed items but counts are available
              if (!p) p = dayRes?.present_count || 0
              if (!a) a = dayRes?.absent_count || 0
              const lc = (dayRes?.leave_count ?? dayRes?.on_leave_count ?? dayRes?.leaves_count ?? dayRes?.leaves ?? dayRes?.leave)
              if (Number.isFinite(lc) && lc > 0) l = Number(lc)
              if (l === 0 && Number.isFinite(dayRes?.total_students)) {
                const inferred = Math.max(Number(dayRes.total_students) - p - a, 0)
                if (inferred > 0) l = inferred
              }
            }
          } catch { }
        }

        let pctLabel = ''
        if (isSunday) {
          // For holiday (Sunday), mark all columns as Holiday for better visualization
          rowsArr.push(`<tr>
          <td>${dstr}</td>
          <td style=\"text-align:center;\">Holiday</td>
          <td style=\"text-align:center;\">Holiday</td>
          <td style=\"text-align:center;\">Holiday</td>
          <td style=\"text-align:center; font-weight:600;\">Holiday</td>
        </tr>`)
          iter.setDate(iter.getDate() + 1)
          continue
        } else {
          // Exclude leave from attendance percentage calculation
          const t = p + a
          const pp = t > 0 ? Math.round((p / t) * 100) : 0
          pctLabel = `${pp}%`
          totalPresent += p
          totalAbsent += a
          totalLeave += l
        }
        rowsArr.push(`<tr>
          <td>${dstr}</td>
          <td style=\"text-align:center;\">${p}</td>
          <td style=\"text-align:center;\">${l}</td>
          <td style=\"text-align:center;\">${a}</td>
          <td style=\"text-align:center; font-weight:600;\">${pctLabel}</td>
        </tr>`)
        iter.setDate(iter.getDate() + 1)
      }
      // Exclude leave from overall attendance percentage calculation
      const total = totalPresent + totalAbsent
      const pct = total > 0 ? Math.round((totalPresent / total) * 100) : 0
      const rows = rowsArr.join('')

      const rangeLabel = `${startDate} to ${endDate}`

      const html = `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Attendance Report</title>
          <style>
            :root{--primary:${colors.primary};--secondary:${colors.secondary};--accent:${colors.accent};}
            *{box-sizing:border-box}
            body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu; color:#0f172a; background:#ffffff}
            .container{max-width:980px;margin:28px auto;padding:0 18px}
            .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;background:linear-gradient(135deg,var(--primary),var(--secondary));color:#fff;padding:18px;border-radius:14px;box-shadow:0 8px 20px rgba(39,76,119,.18)}
            .title{font-size:22px;font-weight:800}
            .meta{font-size:12px;opacity:.9}
            .card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:16px;margin-bottom:18px;box-shadow:0 4px 14px rgba(2,6,23,.05)}
            table{width:100%;border-collapse:separate;border-spacing:0;margin-top:8px;overflow:hidden;border-radius:10px}
            th,td{border:1px solid #e5e7eb;padding:10px 12px;font-size:13px}
            th{background:#f8fafc;text-align:left;color:#0f172a}
            tr:nth-child(even) td{background:#fafafa}
            .footer{display:flex;justify-content:space-between;margin-top:20px;color:#64748b;font-size:12px}
            .badge{display:inline-block;background:rgba(255,255,255,.25);color:#fff;border:1px solid rgba(255,255,255,.5);border-radius:10px;padding:6px 10px;font-size:12px;font-weight:700}
            .btn{padding:8px 14px;border:2px solid var(--secondary);color:var(--secondary);background:#fff;border-radius:10px;font-weight:700}
            @media print {.no-print{display:none}.header{box-shadow:none}}
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div>
                <div class="title">Teacher Attendance Report</div>
                <div class="meta">${teacher.full_name || ''} • ${selectedClassroom?.name || ''}</div>
                <div class="meta">Period: ${rangeLabel}</div>
                <div style="margin-top:8px; font-size:11px; opacity:0.95;"><strong>Note:</strong> Leave is excluded from Attendance % calculation (percentage = Present / (Present + Absent) × 100)</div>
              </div>
              <div class="badge">${reportType === 'weekly' ? 'Weekly' : 'Monthly'}</div>
            </div>

            <div class="card">
              <div style="display:flex; gap:16px; flex-wrap:wrap;">
                <div>Total Present: <strong>${totalPresent}</strong></div>
                <div>Total Leave: <strong>${totalLeave}</strong></div>
                <div>Total Absent: <strong>${totalAbsent}</strong></div>
                <div>Overall Attendance: <strong>${pct}%</strong></div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th style="text-align:center;">Present</th>
                    <th style="text-align:center;">Leave</th>
                    <th style="text-align:center;">Absent</th>
                    <th style="text-align:center;">Attendance %</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows || '<tr><td colspan="5" style="text-align:center; padding:16px;">No attendance records</td></tr>'}
                </tbody>
              </table>
            </div>

            <div class="footer">
              <div>Generated on ${new Date().toLocaleString()}</div>
              <div class="no-print"><button class="btn" onclick="window.print()">Print / Save PDF</button></div>
            </div>
          </div>
        </body>
      </html>`

      const w = window.open('', '_blank')
      if (w) {
        w.document.open()
        w.document.write(html)
        w.document.close()
        // Focus on the new window after a brief delay
        setTimeout(() => {
          w?.focus()
        }, 100)
      }
      setReportGenerating(false)
      setReportOpen(false)
    } catch (e) {
      setReportGenerating(false)
      setReportOpen(false)
    }
  }

  // Get today's classes schedule (mock for now, can be enhanced with real timetable API)

  const last7Days = getWeekAttendanceMonSat(weekOffset)

  // Selected week range label (Mon–Sat)
  const getSelectedWeekRangeLabel = () => {
    const today = new Date()
    const day = today.getDay()
    const offsetFromMonday = (day + 6) % 7
    const monday = new Date(today)
    monday.setDate(today.getDate() - offsetFromMonday - (weekOffset * 7))
    const saturday = new Date(monday)
    saturday.setDate(monday.getDate() + 5)
    const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
    return `${fmt(monday)} – ${fmt(saturday)}`
  }

  // Attendance percentage for selected week
  const weekAttendancePercentage = (() => {
    if (!attendanceData || !Array.isArray(attendanceData) || last7Days.length === 0) return 0
    const dates = new Set(last7Days.map(d => d.date))
    const filtered = attendanceData.filter((d: any) => dates.has(d.date))
    const total = filtered.reduce((sum: number, d: any) => sum + (d.present_count || 0) + (d.absent_count || 0), 0)
    const present = filtered.reduce((sum: number, d: any) => sum + (d.present_count || 0), 0)
    return total > 0 ? Math.round((present / total) * 100) : 0
  })()

  // Weekly breakdown: present%, absent%, leave count
  const weekBreakdown = (() => {
    if (!attendanceData || !Array.isArray(attendanceData) || last7Days.length === 0) {
      return { presentPct: 0, absentPct: 0, leaveCount: 0 }
    }
    const dates = new Set(last7Days.map(d => d.date))
    const filtered = attendanceData.filter((d: any) => dates.has(d.date))
    const present = filtered.reduce((s: number, d: any) => s + (d.present_count || 0), 0)
    const absent = filtered.reduce((s: number, d: any) => s + (d.absent_count || 0), 0)
    const leave = filtered.reduce((s: number, d: any) => {
      // Be tolerant to different backend keys for leave
      const l = (d.leave_count ?? d.on_leave_count ?? d.leaves_count ?? d.leaves ?? d.leave ?? 0)
      return s + (Number.isFinite(l) ? l : 0)
    }, 0)
    const total = present + absent + leave
    const presentPct = total > 0 ? Math.round((present / total) * 100) : 0
    const absentPct = total > 0 ? Math.round((absent / total) * 100) : 0
    return { presentPct, absentPct, leaveCount: leave }
  })()

  // Fallback: If summary doesn't return leave_count, compute from per-day attendance
  useEffect(() => {
    async function computeWeekLeaveFromDaily() {
      try {
        if (!selectedClassroom?.id || last7Days.length === 0) return
        if (!['teacher', 'coordinator'].includes(currentRole)) return
        setWeekExtraLoading(true)
        const counts = await Promise.all(
          last7Days.map(async (d) => {
            try {
              const res: any = await getAttendanceForDate(selectedClassroom.id, d.date)
              const leaveFromItems = res?.student_attendances?.filter((s: any) => (s.status || '').toLowerCase().includes('leave')).length || 0
              const leaveFromCounts = res?.leave_count ?? res?.on_leave_count ?? 0
              return leaveFromCounts || leaveFromItems
            } catch (err) {
              return 0
            }
          })
        )
        const totalLeave = counts.reduce((a: number, b: number) => a + b, 0)
        setWeekLeaveCount(totalLeave)
      } catch (e) {
        // swallow errors; leave count may remain 0
      } finally {
        setWeekExtraLoading(false)
      }
    }

    computeWeekLeaveFromDaily()
  }, [selectedClassroom?.id, weekOffset, attendanceData, currentRole])

  // Build attendance trend data based on selected range
  useEffect(() => {
    async function buildTrend() {
      if (!selectedClassroom?.id) return
      if (!['teacher', 'coordinator'].includes(currentRole)) return
      // Decide date window
      const now = new Date()
      let start: Date = new Date(now)
      if (trendRange === '7d') {
        start = new Date(now)
        start.setDate(now.getDate() - 6)
      } else if (trendRange === '15d') {
        start = new Date(now)
        start.setDate(now.getDate() - 14)
      } else if (trendRange === '30d') {
        start = new Date(now)
        start.setDate(now.getDate() - 29)
      }

      const startDate = start.toISOString().split('T')[0]
      const endDate = now.toISOString().split('T')[0]
      const raw = await getTeacherAttendanceSummary(selectedClassroom.id, startDate, endDate)
      const list: any[] = Array.isArray(raw) ? raw : []

      // Build a date->summary lookup so that missing days are filled with 0
      const byDate = new Map<string, any>()
      list.forEach((d: any) => byDate.set(d.date, d))

      const days: Array<{ label: string; present: number; absent: number; pct: number }> = []
      const iter = new Date(start)
      while (iter <= now) {
        // Skip Sundays in trend visualization
        if (iter.getDay() === 0) { // 0 = Sunday
          iter.setDate(iter.getDate() + 1)
          continue
        }
        const dstr = iter.toISOString().slice(0, 10)
        const d = byDate.get(dstr)
        const present = d?.present_count || 0
        const absent = d?.absent_count || 0
        const leave = d?.leave_count || d?.on_leave_count || 0
        const inferredAbsent = absent || (d?.total_students ? Math.max((d.total_students - present - leave), 0) : 0)
        const total = present + inferredAbsent + leave
        const pct = total > 0 ? Math.round((present / total) * 100) : 0
        days.push({ label: dstr.slice(5), present, absent: inferredAbsent, pct })
        iter.setDate(iter.getDate() + 1)
      }

      setTrendData(days)
    }

    buildTrend()
  }, [selectedClassroom?.id, trendRange, currentRole])

  // Compute Students of the Month (previous month based on attendance)
  useEffect(() => {
    async function computeStudentsOfMonth() {
      try {
        if (!selectedClassroom?.id) return
        if (!['teacher', 'coordinator'].includes(currentRole)) return
        setStudentsOfMonthLoading(true)

        // Previous month window
        const now = new Date()
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const end = new Date(now.getFullYear(), now.getMonth(), 0)

        // Fetch students in class
        const rosterRes: any = await getClassStudents(selectedClassroom.id)
        const roster: any[] = Array.isArray(rosterRes) ? rosterRes : (rosterRes?.students || [])
        const map = new Map<number, { id: number, name: string, present: number }>()
        roster.forEach((s: any) => {
          map.set(s.id, { id: s.id, name: s.full_name || s.name, present: 0 })
        })

        let totalAttendanceDays = 0
        const daysSeenByStudent = new Map<number, number>()
        // Iterate days of prev month (skip Sundays automatically)
        const iter = new Date(start)
        while (iter <= end) {
          const isSunday = iter.getDay() === 0
          const dateStr = iter.toISOString().split('T')[0]
          
          // Skip Sundays - they are holidays and shouldn't count towards attendance days
          if (!isSunday) {
            try {
              const dayRes: any = await getAttendanceForDate(selectedClassroom.id, dateStr)
              if (dayRes && Array.isArray(dayRes.student_attendances)) {
                totalAttendanceDays += 1
                dayRes.student_attendances.forEach((sa: any) => {
                  const sid = sa.student_id
                  if (map.has(sid)) {
                    // Count that this student has a record for this day
                    daysSeenByStudent.set(sid, (daysSeenByStudent.get(sid) || 0) + 1)
                    if ((sa.status || '').toLowerCase() === 'present') {
                      const rec = map.get(sid) as any
                      rec.present += 1
                    }
                  }
                })
              }
            } catch (dayError) {
              // Ignore single-day fetch errors so it doesn't break the whole loop
            }
          }
          
          iter.setDate(iter.getDate() + 1)
        }

        // Only include students who have a complete record for ALL attendance days in the month
        const list = Array.from(map.values())
          .filter(s => (daysSeenByStudent.get(s.id) || 0) === totalAttendanceDays && totalAttendanceDays > 0)
          .map(s => ({
            id: s.id,
            name: s.name,
            present: s.present,
            percentage: Math.round((s.present / totalAttendanceDays) * 100)
          }))
        list.sort((a, b) => b.present - a.present || b.percentage - a.percentage)
        setStudentsOfMonth(list.slice(0, 3))
      } catch (e) {
        // silently handle computation errors for students of the month
        setStudentsOfMonth([])
      } finally {
        setStudentsOfMonthLoading(false)
      }
    }

    computeStudentsOfMonth()
  }, [selectedClassroom?.id, currentRole])

  if (loading) {
    return (
      <div className="bg-[#f6f8fb] min-h-screen">
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-12">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="w-full lg:w-[320px] space-y-4">
              <div className="bg-white rounded-2xl h-80 animate-pulse shadow-sm" />
              <div className="bg-white rounded-2xl h-48 animate-pulse shadow-sm" />
            </div>
            <div className="flex-1 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => <div key={i} className="bg-white rounded-2xl h-24 animate-pulse shadow-sm" />)}
              </div>
              <div className="bg-white rounded-2xl h-[500px] animate-pulse shadow-sm" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !teacher) {
    return (
      <div className="min-h-screen bg-[#f6f8fb] flex items-center justify-center p-4 text-center">
        <div className="bg-white p-10 rounded-2xl shadow-xl border border-gray-100 max-w-md w-full">
          <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">Teacher Profile Not Found</h2>
          <p className="text-sm text-gray-500 mb-8">{error || "The profile you are looking for does not exist or has been removed."}</p>
          <button onClick={() => router.back()} className="w-full py-4 bg-[#185FA5] text-white font-bold rounded-xl shadow-lg shadow-blue-200/50 hover:bg-[#1451a0] transition-all">
            Return to Directory
          </button>
        </div>
      </div>
    )
  }

  const campus     = teacher.campus_name || teacher.current_campus?.campus_name || "—"
  const designation = teacher.designation ?? "Teaching Staff"

  // ── Helper UI Components ──────────
  const SectionCard = ({ title, icon: Icon, children, className = "", action }: any) => (
    <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm ${className}`}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
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

  const InfoField = ({ label, value }: { label: string; value?: string | null }) => (
    <div>
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

  const KPICard = ({ label, value, icon: Icon, colorClass, bgClass, trend }: any) => (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4 h-full shadow-sm hover:border-[#185FA5]/30 transition-all group">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform ${bgClass}`}>
        <Icon className={`w-5 h-5 ${colorClass}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">{label}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-gray-900 tracking-tight">{value}</span>
          {trend && (
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 border border-emerald-100">
              <TrendingUp className="w-2.5 h-2.5" />{trend}
            </span>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="bg-[#f6f8fb] min-h-screen">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-6">

        {/* ── Top Bar ── */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
             <button
              onClick={() => router.push("/admin/teachers")}
              className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-[#185FA5] hover:border-[#185FA5]/40 transition-all shadow-sm"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight">Teacher Portfolio</h1>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{teacher.employee_code || "Staff ID"}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canSeeReportButtons && (
              <Button
                variant="outline"
                className="h-10 rounded-xl bg-white text-[#185FA5] border-gray-200 font-bold text-xs"
                onClick={() => setReportOpen(true)}
              >
                <ClipboardList className="w-4 h-4 mr-2" />
                Reports
              </Button>
            )}
            <Button
              className="h-10 rounded-xl bg-[#185FA5] text-white font-bold text-xs px-4 shadow-lg shadow-blue-200/50 hover:bg-[#1451a0] transition-all"
              onClick={() => {/* Edit Action */}}
            >
              <Edit3 className="w-4 h-4 mr-2" />
              Edit Account
            </Button>
          </div>
        </div>

        {/* ── KPI Row (Only for Teacher/Coordinator) ── */}
        {['teacher', 'coordinator'].includes(currentRole) && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <KPICard label="Weekly Present" value={`${weekBreakdown.presentPct}%`} icon={CheckCircle} colorClass="text-emerald-500" bgClass="bg-emerald-50" trend="+1.5%" />
            <KPICard label="Weekly Absent" value={`${weekBreakdown.absentPct}%`} icon={AlertTriangle} colorClass="text-red-500" bgClass="bg-red-50" />
            <KPICard label="Leaves" value={weekLeaveCount || weekBreakdown.leaveCount} icon={Clock} colorClass="text-amber-500" bgClass="bg-amber-50" />
            <KPICard label="Students Quality" value={studentsOfMonth[0]?.percentage ? `${studentsOfMonth[0].percentage}%` : "—"} icon={Award} colorClass="text-[#185FA5]" bgClass="bg-blue-50" />
          </div>
        )}

        {/* ── Layout ── */}
        <div className="flex flex-col lg:flex-row gap-6">

          {/* ════ Sidebar Portfolio (Left) ════ */}
          <div className="w-full lg:w-[320px] flex-shrink-0 space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="h-24 bg-gradient-to-r from-[#185FA5] to-[#1e3a5f]" />
              <div className="px-6 pb-6 -mt-10 text-center">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                <div className="relative inline-block mb-4">
                  <SmartAvatar src={photo} name={teacher.full_name} size="xl" ringClass="ring-4 ring-white shadow-lg" className="w-24 h-24" />
                  {uploading && (
                    <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    </div>
                  )}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-[#185FA5] border-2 border-white flex items-center justify-center shadow-md hover:scale-110 transition-transform active:scale-95"
                    title="Change Photo"
                  >
                    <Camera className="w-4 h-4 text-white" />
                  </button>
                </div>

                <h2 className="text-lg font-black text-gray-900 tracking-tight leading-none mb-1">{teacher.full_name}</h2>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">{designation}</p>

                <div className="flex items-center justify-center gap-1.5 mb-6">
                   <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-blue-50 text-[#185FA5] border border-blue-100">TEA-ID: {teacher.id}</span>
                </div>

                {uploadError && <div className="p-2 mb-4 bg-red-50 text-red-600 text-[10px] font-bold rounded-lg border border-red-100 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5"/> {uploadError}</div>}
                {uploadSuccess && <div className="p-2 mb-4 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-lg border border-emerald-100 flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5"/> Updated</div>}

                <div className="grid grid-cols-2 gap-2">
                  <button className="flex items-center justify-center gap-1.5 h-9 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-all">
                    MESSAGE
                  </button>
                  <button className="flex items-center justify-center gap-1.5 h-9 rounded-xl bg-blue-50 text-[#185FA5] text-xs font-black hover:bg-blue-100 transition-all">
                    ACCOUNT
                  </button>
                </div>
              </div>
            </div>

            <SectionCard title="Direct Contact" icon={Phone}>
              <div className="space-y-1">
                <ContactRow icon={Mail} value={teacher.email} />
                <ContactRow icon={Phone} value={teacher.contact_number} />
                <ContactRow icon={MapPin} value={teacher.address} />
              </div>
            </SectionCard>

            <div className="bg-[#185FA5] rounded-xl p-6 text-white overflow-hidden relative shadow-lg">
              <Activity className="absolute -right-6 -bottom-6 w-32 h-32 opacity-10" />
              <p className="text-[10px] font-black opacity-60 uppercase tracking-widest mb-4">Schedule</p>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                   <h3 className="text-lg font-black capitalize leading-none mb-1">{teacher.working_shift || teacher.shift || "Regular"}</h3>
                   <p className="text-xs opacity-70">Shift Period</p>
                </div>
              </div>
              <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                <span className="text-[10px] font-bold opacity-70">Exp: {teacher.experience_years || teacher.total_experience_years || "0"} Years</span>
                <TrendingUp className="w-4 h-4 opacity-70" />
              </div>
            </div>
          </div>

          {/* ════ Main Workspace (Right) ════ */}
          <div className="flex-1 space-y-6">

            {/* Attendance Analytics (Only for Teacher/Coordinator) */}
            {['teacher', 'coordinator'].includes(currentRole) && (
              <SectionCard
                title={`Attendance Ledger: ${selectedClassroom?.name || "Academic Section"}`}
                icon={BarChart3}
                action={
                  <div className="flex items-center gap-2">
                     <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => setWeekOffset(weekOffset + 1)}><ArrowLeft className="w-4 h-4" /></Button>
                     <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{getSelectedWeekRangeLabel()}</span>
                     <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" disabled={weekOffset === 0} onClick={() => setWeekOffset(Math.max(weekOffset - 1, 0))}><ChevronRight className="w-4 h-4" /></Button>
                  </div>
                }
              >
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50/80">
                        <th className="text-left py-3 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest rounded-l-xl">Day</th>
                        <th className="text-center py-3 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Present</th>
                        <th className="text-center py-3 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Leave</th>
                        <th className="text-center py-3 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Absent</th>
                        <th className="text-center py-3 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest rounded-r-xl">Trend</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {last7Days.map((day: any, idx) => (
                        <tr key={idx} className="group hover:bg-gray-50/50 transition-colors">
                          <td className="py-4 px-4 text-sm font-black text-gray-700">{day.date}</td>
                          <td className="py-4 px-4 text-center">
                            <span className="text-sm font-black text-emerald-600">{day.present}%</span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className="text-sm font-black text-amber-500">{day.leave}%</span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className="text-sm font-black text-rose-500">{day.absent}%</span>
                          </td>
                          <td className="py-4 px-4">
                             <div className="w-24 h-2 bg-gray-100 rounded-full mx-auto overflow-hidden flex ring-1 ring-gray-200">
                               <div style={{ width: `${day.present}%` }} className="bg-emerald-500 h-full" />
                               <div style={{ width: `${day.leave}%` }} className="bg-amber-400 h-full" />
                               <div style={{ width: `${day.absent}%` }} className="bg-rose-400 h-full" />
                             </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            )}

            {(teacher.user || teacher.user_id) && (
              <SectionCard title="Staff Attendance" icon={Calendar}>
                <StaffAttendanceSection userId={teacher.user || teacher.user_id} />
              </SectionCard>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SectionCard title="Constitutional Info" icon={User}>
                <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                   <InfoField label="DOB" value={teacher.date_of_birth || teacher.dob} />
                   <InfoField label="CNIC / NIC" value={teacher.cnic} />
                   <InfoField label="Gender" value={teacher.gender} />
                   <InfoField label="Religion" value={teacher.religion} />
                   <InfoField label="Nationality" value={teacher.nationality} />
                   <InfoField label="Marital Status" value={teacher.marital_status} />
                </div>
              </SectionCard>

              <SectionCard title="Professional Stance" icon={Shield}>
                <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                   <InfoField label="Campus" value={campus} />
                   <InfoField label="Specialization" value={teacher.education_subjects || "Multidisciplinary Faculty"} />
                   <InfoField label="Joining Period" value={teacher.joining_date} />
                   <InfoField label="ID Code" value={teacher.employee_code || "GEN-01"} />
                   <InfoField label="Service Status" value="Active Duty" />
                   <InfoField label="Faculty Grade" value={teacher.assigned_classroom?.name || teacher.classroom_name} />
                </div>
              </SectionCard>
            </div>

            <SectionCard title="Academic Background" icon={GraduationCap}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4">
                <InfoField label="Education Level" value={teacher.education_level} />
                <InfoField label="Institution" value={teacher.institution_name} />
                <InfoField label="Passing Year" value={teacher.year_of_passing?.toString()} />
              </div>
            </SectionCard>

            {['teacher', 'coordinator'].includes(currentRole) && (
              <SectionCard title="Students Excellence (Previous Month)" icon={Award}>
                {studentsOfMonthLoading ? (
                  <div className="flex flex-col items-center justify-center py-6 gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse">Computing Best Performers...</p>
                  </div>
                ) : studentsOfMonth.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-300 gap-2">
                    <Award className="w-8 h-8 opacity-20" />
                    <p className="text-xs font-bold italic opacity-40">No attendance data available for cycle.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                     {studentsOfMonth.slice(0, 3).map((st: any, i) => (
                       <div key={i} className="bg-[#f9fafb] rounded-xl p-4 border border-gray-100 flex items-center gap-3 transition-all hover:bg-white hover:shadow-md group">
                         <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-black text-white shadow-sm ${i === 0 ? "bg-amber-400 rotate-3" : i === 1 ? "bg-slate-300 -rotate-3" : "bg-orange-400"}`}>
                           {i + 1}
                         </div>
                         <div className="min-w-0">
                           <h4 className="text-xs font-black text-gray-800 truncate mb-1">{st.name}</h4>
                           <p className="text-[10px] font-bold text-[#185FA5] uppercase tracking-tighter">{st.percentage}% Monthly Attendance</p>
                         </div>
                       </div>
                     ))}
                  </div>
                )}
              </SectionCard>
            )}
          </div>
        </div>

        {/* ── Reports Modal ── */}
        {reportOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setReportOpen(false)} />
            <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-gray-100">
              <div className="p-6 bg-[#185FA5] text-white">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-lg font-black tracking-tight">Generate Academic Report</h3>
                  <button onClick={() => setReportOpen(false)} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs opacity-70 font-bold uppercase tracking-widest">Attendance Analytics</p>
              </div>

              <div className="p-6 space-y-6">
                 <div>
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Report Method</label>
                   <div className="grid grid-cols-2 gap-2">
                     <button
                       onClick={() => setReportScope('date')}
                       className={`h-11 rounded-xl text-xs font-black transition-all border ${reportScope === 'date' ? "bg-blue-50 border-[#185FA5] text-[#185FA5]" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"}`}
                     >
                       DATE-WISE
                     </button>
                     <button
                       onClick={() => setReportScope('student')}
                       className={`h-11 rounded-xl text-xs font-black transition-all border ${reportScope === 'student' ? "bg-blue-50 border-[#185FA5] text-[#185FA5]" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"}`}
                     >
                       STUDENT-WISE
                     </button>
                   </div>
                 </div>

                 <div>
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Frequency</label>
                   <div className="grid grid-cols-2 gap-2">
                     <button
                       onClick={() => setReportType('weekly')}
                       className={`h-11 rounded-xl text-xs font-black transition-all border ${reportType === 'weekly' ? "bg-blue-50 border-[#185FA5] text-[#185FA5]" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"}`}
                     >
                       WEEKLY
                     </button>
                     <button
                       onClick={() => setReportType('monthly')}
                       className={`h-11 rounded-xl text-xs font-black transition-all border ${reportType === 'monthly' ? "bg-blue-50 border-[#185FA5] text-[#185FA5]" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"}`}
                     >
                       MONTHLY
                     </button>
                   </div>
                 </div>

                 <div>
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Selection Period</label>
                   {reportType === 'weekly' ? (
                     <div className="space-y-3">
                       <input
                         type="month"
                         value={weekMonth}
                         onChange={(e) => setWeekMonth(e.target.value)}
                         className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5]"
                       />
                       <div className="grid grid-cols-3 gap-2">
                         {computeWeeksForMonth(weekMonth).map((w, i) => (
                           <button
                             key={i}
                             onClick={() => setReportWeekStart(w.mondayISO)}
                             className={`p-2 rounded-lg border text-center transition-all ${reportWeekStart === w.mondayISO ? "bg-[#185FA5] border-[#185FA5] text-white shadow-md scale-95" : "bg-gray-50 border-gray-100 text-gray-500 hover:bg-white hover:border-[#185FA5]/30"}`}
                           >
                              <p className="text-[10px] font-black leading-tight">{w.label}</p>
                              <p className="text-[8px] font-bold opacity-60 truncate">{w.range}</p>
                           </button>
                         ))}
                       </div>
                     </div>
                   ) : (
                     <input
                       type="month"
                       value={reportMonth}
                       onChange={(e) => setReportMonth(e.target.value)}
                       className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5]"
                     />
                   )}
                 </div>

                 <button
                   onClick={generateAttendanceReport}
                   disabled={reportGenerating}
                   className="w-full h-14 bg-[#185FA5] text-white font-black text-sm rounded-2xl shadow-xl shadow-blue-200/50 hover:bg-[#1451a0] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                 >
                   {reportGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                   {reportGenerating ? "GENERATING FILE..." : "GENERATE PDF REPORT"}
                 </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function TeacherProfilePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <TeacherProfileContent />
    </Suspense>
  )
}
