"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Users, Building2, GraduationCap, TrendingUp, RefreshCw, AlertCircle, XCircle } from "lucide-react"
import { useState, useEffect } from "react"
import { getCurrentUserProfile, getClassroomStudents, getTeacherTodayAttendance, getTeacherWeeklyAttendance, getTeacherMonthlyTrend, getAttendanceHistory, getClassTimetable, getShiftTimings, getTeacherMyClasses } from "@/lib/api"
import { getCurrentUserRole, usePermissions } from "@/lib/permissions"
import ClassTeacherNetworkDashboard from "@/components/dashboard/class-teacher-network-dashboard"
import { AccessDenied } from "@/components/AccessDenied"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart } from "recharts"
import { Skeleton } from "@/components/ui/skeleton"
import { BarChart2, UserCheck, Users as UsersIcon, Award, CalendarCheck, BookOpen, UserPlus, FileText, PieChart as PieChartIcon, TrendingUp as TrendingUpIcon, Activity, Clock, Star, History as HistoryIcon, Calendar, Plus, Download } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

const WEEK_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
];

interface TopStudent {
  name: string;
  marks: number;
}

interface RecentActivity {
  text: string;
  color: string;
}

interface ClassInfo {
  name: string;
  section: string;
  totalStudents: number;
  boys: number;
  girls: number;
  attendanceToday: { present: number; absent: number; leave: number };
  topStudents: TopStudent[];
  recentActivity: RecentActivity[];
  attendanceData: Array<{ day: string; present: number; absent: number }>;
  gradeDistribution: Array<{ grade: string; count: number }>;
  monthlyTrend: Array<{ month: string; students: number }>;
}

type AtRiskReason =
  | { type: 'low_attendance'; attendanceRate: number }
  | { type: 'consecutive_absence'; streakLength: number; startedOn?: string; lastAbsentOn?: string };

interface AtRiskStudent {
  id: number | string;
  name: string;
  code?: string;
  reasons: AtRiskReason[];
}

export default function TeacherClassDashboard() {
  const { canViewTeacherDashboard, canViewNetworkPerformanceChart } = usePermissions();
  const permissions = usePermissions();
  const [classInfo, setClassInfo] = useState<ClassInfo>({
    name: "Loading...",
    section: "",
    totalStudents: 0,
    boys: 0,
    girls: 0,
    attendanceToday: { present: 0, absent: 0, leave: 0 },
    topStudents: [],
    recentActivity: [],
    attendanceData: [],
    gradeDistribution: [],
    monthlyTrend: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [absenteesToday, setAbsenteesToday] = useState<Array<{ id: number; name: string; code?: string; gender?: string }>>([])
  const [atRisk, setAtRisk] = useState<AtRiskStudent[]>([])
  const [recentSubmissions, setRecentSubmissions] = useState<any[]>([])
  const [classroomOptions, setClassroomOptions] = useState<Array<{ id: number; name: string; grade?: string; section?: string; shift?: string; role?: string; subject_id?: number | null; subject_name?: string; key?: string }>>([])
  const [selectedClassroomId, setSelectedClassroomId] = useState<number | null>(null)
  const [selectedRole, setSelectedRole] = useState<'class_teacher' | 'subject_teacher'>('class_teacher')
  const [selectedSubjectName, setSelectedSubjectName] = useState<string>('')
  const [timetable, setTimetable] = useState<any[]>([])
  const [timeSlots, setTimeSlots] = useState<any[]>([])
  const userRole = getCurrentUserRole()

  const formatAlertDate = (value?: string) => {
    if (!value) return ""
    const dateObj = new Date(value)
    if (isNaN(dateObj.getTime())) return value
    return dateObj.toLocaleDateString?.() || value
  }

  useEffect(() => {
    const role = getCurrentUserRole()
    if (role === 'teacher') {
      document.title = "My Class Statistics | Newton AMS";
    } else {
      document.title = "Class Statistics | Newton AMS";
    }
  }, []);

  const handleExportCSV = async (days: number) => {
    try {
      if (!selectedClassroomId) {
        toast.error("Please select a classroom first");
        return;
      }
      toast.info(`Generating CSV for the last ${days} days...`);
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - days);
      const s = start.toISOString().split('T')[0];
      const e = end.toISOString().split('T')[0];

      const data = (await getAttendanceHistory(selectedClassroomId, s, e)) as any[];

      if (!data || data.length === 0) {
        toast.error("No attendance data found for this period");
        return;
      }

      // Build student-level rows
      const headers = ['Date', 'Student Name', 'Father Name', 'Student Code', 'Gender', 'Status', 'Remarks'];
      const csvRows = [headers.join(',')];

      data.forEach((record: any) => {
        const date = record.date || 'N/A';
        const studentAttendances = record.student_attendance || [];
        
        if (studentAttendances.length === 0) {
          // If no student data, add a summary row
          csvRows.push([date, '-', '-', '-', '-', `Present: ${record.present_count || 0} / Absent: ${record.absent_count || 0}`, ''].join(','));
        } else {
          studentAttendances.forEach((sa: any) => {
            csvRows.push([
              date,
              `"${sa.student_name || 'N/A'}"`,
              `"${sa.student_father_name || 'N/A'}"`,
              sa.student_code || 'N/A',
              sa.student_gender || 'N/A',
              sa.status || 'N/A',
              `"${sa.remarks || ''}"`
            ].join(','));
          });
        }
      });

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      const className = classroomOptions.find((c: any) => c.id === selectedClassroomId)?.name || 'Class';
      link.setAttribute('download', `Attendance_${className.replace(/[^a-z0-9]/gi, '_')}_${days}days.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success("CSV Downloaded successfully");
    } catch (error) {
      console.error("Error exporting CSV:", error);
      toast.error("Failed to export CSV");
    }
  };

  useEffect(() => {
    async function fetchClassData() {
      try {
        setLoading(true)
        setError("")

        const role = getCurrentUserRole()
        if (role === 'teacher') {
          // Get teacher's classroom data
          const teacherProfile = await getCurrentUserProfile() as any

          // Use my-classes API to get all assignments (class teacher + subject teacher)
          let allAssignmentsData: any[] = []
          try {
            const myClassesData = await getTeacherMyClasses()
            allAssignmentsData = myClassesData?.assignments || []
          } catch {}

          // Fallback to teacherProfile if my-classes API fails
          if (allAssignmentsData.length === 0) {
            const multi = Array.isArray(teacherProfile?.assigned_classrooms) ? teacherProfile.assigned_classrooms : []
            const single = teacherProfile?.assigned_classroom ? [teacherProfile.assigned_classroom] : []
            const fallbackClassrooms = multi.length > 0 ? multi : single
            allAssignmentsData = fallbackClassrooms.map((c: any) => ({
              classroom_id: c.id,
              grade_name: typeof c.grade === 'string' ? c.grade : c.grade?.name || '',
              section: c.section || '',
              shift: c.shift || '',
              role: 'Class Teacher',
              subject_id: null,
              subject_name: 'All Subjects',
            }))
          }

          if (allAssignmentsData.length === 0) {
            setError("No classroom assigned to you. Please contact administrator.")
            setLoading(false)
            return
          }

          // Build options from all assignments (class teacher + subject teacher)
          const options = allAssignmentsData.map((a: any) => ({
            id: a.classroom_id,
            name: `${a.grade_name} - ${a.section}`.trim() || `Classroom ${a.classroom_id}`,
            grade: a.grade_name,
            section: a.section,
            shift: a.shift,
            role: a.role,
            subject_id: a.subject_id,
            subject_name: a.subject_name,
            key: `${a.classroom_id}|${a.role}|${a.subject_id || ''}`,
          }))
          setClassroomOptions(options)

          // Determine which assignment to load
          let assignmentToLoad = options[0]
          if (selectedClassroomId) {
            const found = options.find((o: any) => o.id === selectedClassroomId)
            if (found) assignmentToLoad = found
          } else {
            // Default: prefer class teacher first
            const ctOption = options.find((o: any) => o.role === 'Class Teacher')
            assignmentToLoad = ctOption || options[0]
          }

          const newRole = assignmentToLoad.role === 'Subject Teacher' ? 'subject_teacher' : 'class_teacher'
          setSelectedRole(newRole)
          setSelectedSubjectName(assignmentToLoad.subject_name || '')

          if (!selectedClassroomId) {
            setSelectedClassroomId(assignmentToLoad.id)
          }

          // Subject teacher: just load timetable and show simple view
          if (newRole === 'subject_teacher') {
            try {
              const [classTimetable, shiftSlots] = await Promise.all([
                getClassTimetable({ classroom: assignmentToLoad.id }),
                getShiftTimings(teacherProfile?.campus?.id || 1, assignmentToLoad.shift || 'morning')
              ])
              setTimetable(classTimetable || [])
              const filteredSlots = (shiftSlots || [])
                .filter((s: any) => (s.timetable_type || 'class') === 'class')
                .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
              setTimeSlots(filteredSlots)
            } catch {}
            setLoading(false)
            return
          }

          const classroomId = assignmentToLoad.id

          // Fetch all data in parallel for better performance
          const [classroomData, todayAttendance, weeklyAttendance, monthlyTrend, last30DaysHistory, classTimetable, shiftSlots] = await Promise.all([
            getClassroomStudents(classroomId, teacherProfile.teacher_id) as any,
            getTeacherTodayAttendance(classroomId),
            getTeacherWeeklyAttendance(classroomId),
            getTeacherMonthlyTrend(classroomId),
            (async () => {
              const end = new Date()
              const start = new Date()
              start.setDate(end.getDate() - 30)
              const s = start.toISOString().split('T')[0]
              const e = end.toISOString().split('T')[0]
              return await getAttendanceHistory(classroomId, s, e)
            })(),
            getClassTimetable({ classroom: classroomId }),
            getShiftTimings(teacherProfile?.campus?.id || 1, assignmentToLoad.shift || 'morning')
          ])

          setTimetable(classTimetable || [])
          
          // Filter shift slots by 'class' type and sort by order
          const filteredSlots = (shiftSlots || [])
            .filter((s: any) => (s.timetable_type || 'class') === 'class')
            .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
          setTimeSlots(filteredSlots)

          // Handle different response formats
          let students = []
          if (Array.isArray(classroomData)) {
            // Direct array response from get_class_students API
            students = classroomData
          } else if (classroomData && Array.isArray(classroomData.students)) {
            // Object with students property
            students = classroomData.students
          } else {
            students = []
          }

          // Calculate statistics
          const boys = students.filter((s: any) => s.gender === 'male').length
          const girls = students.filter((s: any) => s.gender === 'female').length

          // Process today's attendance
          let attendanceToday = { present: 0, absent: 0, leave: 0 }
          if (todayAttendance && typeof todayAttendance === 'object') {
            attendanceToday = {
              present: (todayAttendance as any).present_count || 0,
              absent: (todayAttendance as any).absent_count || 0,
              leave: (todayAttendance as any).leave_count || 0
            }
            try {
              const studentAttendance = (todayAttendance as any).student_attendance || []
              const abs = studentAttendance
                .filter((r: any) => r.status === 'absent')
                .map((r: any) => ({ id: r.student_id, name: r.student_name, code: r.student_code, gender: r.student_gender }))
              setAbsenteesToday(abs)
            } catch { }
          }

          // Process weekly attendance data
          let attendanceData = []

          if (weeklyAttendance && Array.isArray(weeklyAttendance) && weeklyAttendance.length > 0) {
            // Group by day of week
            const dayMap: { [key: string]: { present: number; absent: number } } = {}

            weeklyAttendance.forEach((record: any) => {
              const date = new Date(record.date)
              const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })

              if (!dayMap[dayName]) {
                dayMap[dayName] = { present: 0, absent: 0 }
              }
              dayMap[dayName].present += record.present_count || 0
              dayMap[dayName].absent += record.absent_count || 0
            })

            // Generate labels for the last 7 days
            const last7Days = Array.from({ length: 7 }, (_, i) => {
              const d = new Date()
              d.setDate(d.getDate() - (6 - i))
              return d
            })

            attendanceData = last7Days.map(date => {
              const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
              return {
                day: dayName,
                present: dayMap[dayName]?.present || 0,
                absent: dayMap[dayName]?.absent || 0
              }
            })
          } else {
            // Fallback: Generate empty last 7 days
            const last7Days = Array.from({ length: 7 }, (_, i) => {
              const d = new Date()
              d.setDate(d.getDate() - (6 - i))
              return d.toLocaleDateString('en-US', { weekday: 'short' })
            })

            attendanceData = last7Days.map(day => ({
              day,
              present: 0,
              absent: 0
            }))
          }

          // Process monthly trend data
          let monthlyTrendData = []
          if (monthlyTrend && Array.isArray(monthlyTrend)) {
            // Group by month
            const monthMap: { [key: string]: number } = {}

            monthlyTrend.forEach((record: any) => {
              const date = new Date(record.date)
              const monthName = date.toLocaleDateString('en-US', { month: 'short' })

              if (!monthMap[monthName]) {
                monthMap[monthName] = 0
              }
              monthMap[monthName] += record.present_count || 0
            })

            monthlyTrendData = Object.entries(monthMap).map(([month, count]) => ({
              month,
              students: count
            }))
          } else {
            // Fallback to mock data
            monthlyTrendData = [
              { month: 'Jan', students: Math.floor(students.length * 0.8) },
              { month: 'Feb', students: Math.floor(students.length * 0.85) },
              { month: 'Mar', students: Math.floor(students.length * 0.9) },
              { month: 'Apr', students: Math.floor(students.length * 0.95) },
              { month: 'May', students: students.length },
            ]
          }

          // Mock grade distribution (since we don't have grades API yet)
          const gradeDistribution = [
            { grade: 'A+', count: Math.floor(students.length * 0.15) },
            { grade: 'A', count: Math.floor(students.length * 0.25) },
            { grade: 'B+', count: Math.floor(students.length * 0.30) },
            { grade: 'B', count: Math.floor(students.length * 0.20) },
            { grade: 'C', count: Math.floor(students.length * 0.10) },
          ]

          // Compute at-risk students combining low attendance and consecutive absence alerts
          try {
            const buildStudentKey = (record: any) => {
              const base =
                record.student_id ??
                record.student_code ??
                record.student_gr_no ??
                record.student_name ??
                Math.random().toString(36).slice(2)
              return String(base)
            }

            const deriveIdValue = (record: any): number | string => {
              if (record.student_id !== undefined && record.student_id !== null) return record.student_id
              if (record.student_code) return record.student_code
              if (record.student_gr_no) return record.student_gr_no
              return record.student_name || "unknown"
            }

            const perStudent: Record<string, { name: string; code?: string; present: number; total: number; history: Array<{ date?: string; status: string }>; idValue: number | string }> = {}
            if (Array.isArray(last30DaysHistory)) {
              last30DaysHistory.forEach((sheet: any) => {
                const arr = sheet.student_attendance || []
                const sheetDateRaw = sheet?.date ?? sheet?.attendance_date ?? sheet?.created_at
                let sheetDate: string | undefined
                if (typeof sheetDateRaw === 'string') {
                  sheetDate = sheetDateRaw
                } else if (sheetDateRaw) {
                  try {
                    sheetDate = new Date(sheetDateRaw).toISOString().split('T')[0]
                  } catch {
                    sheetDate = undefined
                  }
                }

                arr.forEach((r: any) => {
                  const key = buildStudentKey(r)
                  const studentCode = r.student_code || r.student_id || r.student_gr_no
                  if (!perStudent[key]) {
                    perStudent[key] = {
                      name: r.student_name || String(key),
                      code: studentCode,
                      present: 0,
                      total: 0,
                      history: [],
                      idValue: deriveIdValue(r),
                    }
                  } else if (!perStudent[key].code && studentCode) {
                    perStudent[key].code = studentCode
                  }
                  perStudent[key].total += 1
                  if (r.status === 'present') perStudent[key].present += 1
                  perStudent[key].history.push({ date: sheetDate, status: r.status })
                })
              })
            }

            const lowAttendanceList = Object.entries(perStudent)
              .map(([key, v]) => ({
                key,
                idValue: v.idValue ?? key,
                name: v.name,
                code: v.code,
                attendanceRate: v.total ? Math.round((v.present / v.total) * 100) : 0,
              }))
              .filter(x => x.attendanceRate < 80)

            const riskMap = new Map<string, AtRiskStudent>()

            const ensureRiskEntry = (key: string, idValue: number | string, name: string, code?: string) => {
              if (!riskMap.has(key)) {
                riskMap.set(key, { id: idValue, name, code, reasons: [] })
              }
              const entry = riskMap.get(key)!
              if (code && !entry.code) entry.code = code
              return entry
            }

            lowAttendanceList.forEach((student) => {
              const entry = ensureRiskEntry(String(student.key), student.idValue, student.name, student.code)
              entry.reasons.push({ type: 'low_attendance', attendanceRate: student.attendanceRate })
            })

            const consecutiveAbsenceList = Object.entries(perStudent)
              .map(([key, info]) => {
                const sortedHistory = [...info.history].filter((record) => record.status && record.date).sort((a, b) => {
                  if (!a.date || !b.date) return 0
                  return new Date(b.date).getTime() - new Date(a.date).getTime()
                })
                let streak = 0
                let lastAbsentOn: string | undefined
                let streakStart: string | undefined
                let previousDate: Date | undefined

                for (const record of sortedHistory) {
                  if (!record.date) break
                  const current = new Date(record.date)
                  if (isNaN(current.getTime())) break

                  if (record.status === 'absent') {
                    if (!previousDate) {
                      streak = 1
                      lastAbsentOn = record.date
                      streakStart = record.date
                      previousDate = current
                      continue
                    }

                    const diffDays = Math.round((previousDate.getTime() - current.getTime()) / 86400000)
                    if (diffDays !== 1) {
                      break
                    }
                    streak += 1
                    previousDate = current
                    streakStart = record.date || streakStart
                  } else if (record.status === 'leave') {
                    streak = 0
                    break
                  } else {
                    break
                  }
                }

                return {
                  key,
                  idValue: info.idValue ?? key,
                  name: info.name,
                  code: info.code,
                  streakLength: streak,
                  startedOn: streak >= 1 ? streakStart : undefined,
                  lastAbsentOn: streak >= 1 ? lastAbsentOn : undefined,
                }
              })
              .filter((item) => item.streakLength >= 3)

            consecutiveAbsenceList.forEach((student) => {
              const entry = ensureRiskEntry(String(student.key), student.idValue, student.name, student.code)
              entry.reasons.push({
                type: 'consecutive_absence',
                streakLength: student.streakLength,
                startedOn: student.startedOn,
                lastAbsentOn: student.lastAbsentOn,
              })
            })


            const getMaxStreak = (student: AtRiskStudent) =>
              student.reasons.reduce((max, reason) => {
                if (reason.type === 'consecutive_absence') {
                  return Math.max(max, reason.streakLength)
                }
                return max
              }, 0)

            const getAttendanceRate = (student: AtRiskStudent) => {
              const attendanceReason = student.reasons.find((reason) => reason.type === 'low_attendance') as
                | { type: 'low_attendance'; attendanceRate: number }
                | undefined
              return attendanceReason ? attendanceReason.attendanceRate : 101
            }

            const riskList = Array.from(riskMap.values())
              .sort((a, b) => {
                const streakDiff = getMaxStreak(b) - getMaxStreak(a)
                if (streakDiff !== 0) return streakDiff
                return getAttendanceRate(a) - getAttendanceRate(b)
              })
              .slice(0, 8)

            setAtRisk(riskList)
          } catch { }

          // Recent submissions (last 6 records)
          try {
            const recent = Array.isArray(last30DaysHistory) ? last30DaysHistory.slice(0, 6) : []
            setRecentSubmissions(recent)
          } catch { }

          const finalClassInfo = {
            name: assignmentToLoad.name || "Unknown Class",
            section: assignmentToLoad.section || "",
            totalStudents: students.length,
            boys: boys,
            girls: girls,
            attendanceToday,
            topStudents: students.slice(0, 3).map((s: any, i: number) => ({
              name: s.name,
              marks: 95 - (i * 2) // Mock marks for now
            })),
            recentActivity: [
              { text: `Class ${assignmentToLoad.name} loaded`, color: "bg-green-500" },
              { text: `${students.length} students in class`, color: "bg-blue-500" },
              { text: `Today's attendance: ${attendanceToday.present}/${students.length}`, color: "bg-purple-500" },
            ],
            attendanceData,
            gradeDistribution,
            monthlyTrend: monthlyTrendData,
          }

          setClassInfo(finalClassInfo)
        } else {
          // For non-teachers, show placeholder data
          setClassInfo({
            name: "All Classes",
            section: "Overview",
            totalStudents: 0,
            boys: 0,
            girls: 0,
            attendanceToday: { present: 0, absent: 0, leave: 0 },
            topStudents: [],
            recentActivity: [
              { text: "Class statistics overview", color: "bg-blue-500" },
            ],
            attendanceData: [],
            gradeDistribution: [],
            monthlyTrend: [],
          })
        }
      } catch (err: any) {
        console.error('Error fetching class data:', err)
        setError("Failed to load class data. Please try again.")
      } finally {
        setLoading(false)
      }
    }

    fetchClassData()
  }, [selectedClassroomId])

  if (!canViewTeacherDashboard) {
    return <AccessDenied title="Teacher Statistics Restricted" message="Your dashboard access has been disabled by the administration." />
  }

  if (loading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div>
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-6 w-96" />
        </div>

        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-2">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-16 mb-1" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Middle Section Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-2">
              <CardHeader>
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((j) => (
                    <Skeleton key={j} className="h-12 w-full rounded-lg" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Chart Skeleton */}
        <Card className="border-2">
          <CardHeader>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-72 w-full rounded-lg" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    const isNoClassroom = error.includes("No classroom assigned");
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-extrabold text-[#274c77] mb-2 tracking-wide">Class Dashboard</h2>
          <p className="text-slate-500 text-sm">Overview of class performance and attendance</p>
        </div>

        <div className="flex items-center justify-center py-12">
          <div className="max-w-md w-full bg-white/70 backdrop-blur-md rounded-2xl shadow-lg border border-slate-100 p-8 text-center space-y-6 transition-all duration-300 hover:shadow-xl">
            {isNoClassroom ? (
              <>
                <div className="inline-flex p-4 bg-amber-50 rounded-full text-amber-500 ring-8 ring-amber-50/50 animate-pulse">
                  <GraduationCap className="h-12 w-12" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-800 tracking-tight">No Classroom Assigned</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    It looks like you haven't been assigned to any classrooms or subjects for the current session.
                  </p>
                </div>
                
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-left space-y-1">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Next Steps</p>
                  <p className="text-xs text-slate-600 leading-normal">
                    Please contact the administration or your coordinator to link your profile to a classroom. Once assigned, you will be able to manage attendance, view timetables, and monitor student performance.
                  </p>
                </div>

                <div className="pt-2 flex flex-col gap-3">
                  <Link href="/admin" className="w-full">
                    <Button 
                      className="w-full bg-[#274c77] hover:bg-[#6096ba] text-white py-2.5 rounded-xl transition-all duration-200 shadow-md font-semibold text-sm"
                    >
                      Go to Home
                    </Button>
                  </Link>
                  <button 
                    onClick={() => {
                      toast.loading("Re-checking assignment status...");
                      window.location.reload();
                    }} 
                    className="text-xs text-[#274c77] hover:text-[#6096ba] hover:underline font-semibold flex items-center justify-center gap-1.5 mx-auto transition-all mt-1"
                  >
                    <RefreshCw className="h-3 w-3" /> Re-check Assignment Status
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="inline-flex p-4 bg-red-50 rounded-full text-red-500 ring-8 ring-red-50/50">
                  <AlertCircle className="h-12 w-12" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-800 tracking-tight">Failed to Load Dashboard</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    {error || "An unexpected error occurred while loading your classroom stats."}
                  </p>
                </div>
                <Button 
                  onClick={() => window.location.reload()} 
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl transition-all duration-200 shadow-md font-semibold text-sm flex items-center justify-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" /> Try Again
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  const handleAssignmentChange = (key: string) => {
    const assignment = classroomOptions.find((o: any) => o.key === key)
    if (!assignment) return
    setSelectedClassroomId(assignment.id)
    setSelectedRole(assignment.role === 'Subject Teacher' ? 'subject_teacher' : 'class_teacher')
    setSelectedSubjectName(assignment.subject_name || '')
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h2 className="text-3xl font-extrabold text-[#274c77] mb-2 tracking-wide">Class Dashboard</h2>
            <p className="text-gray-600 text-lg">Welcome! Here is an overview of your class <span className="font-bold text-[#6096ba]">{classInfo.name}</span></p>
          </div>
          {classroomOptions.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor="classroom-select" className="text-sm font-medium text-gray-700 whitespace-nowrap">
                Select Class:
              </label>
              <select
                id="classroom-select"
                value={classroomOptions.find((o: any) =>
                  o.id === selectedClassroomId &&
                  o.role === (selectedRole === 'class_teacher' ? 'Class Teacher' : 'Subject Teacher')
                )?.key || classroomOptions[0]?.key || ''}
                onChange={(e) => handleAssignmentChange(e.target.value)}
                className="px-4 py-2 border-2 border-[#6096ba] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6096ba] bg-white text-[#274c77] font-medium min-w-[220px]"
              >
                {classroomOptions.some((o: any) => o.role === 'Class Teacher') && (
                  <optgroup label="My Class (Class Teacher)">
                    {classroomOptions.filter((o: any) => o.role === 'Class Teacher').map((o: any) => (
                      <option key={o.key} value={o.key}>
                        {o.name} {o.shift ? `(${o.shift})` : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
                {classroomOptions.some((o: any) => o.role === 'Subject Teacher') && (
                  <optgroup label="Subject Classes">
                    {classroomOptions.filter((o: any) => o.role === 'Subject Teacher').map((o: any) => (
                      <option key={o.key} value={o.key}>
                        {o.name} — {o.subject_name} {o.shift ? `(${o.shift})` : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          )}
        </div>
      </div>


      {/* Subject Teacher Dashboard */}
      {selectedRole === 'subject_teacher' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-2 bg-gradient-to-br from-blue-50 to-blue-100/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-blue-600" /> Subject
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-700">{selectedSubjectName || '—'}</div>
              </CardContent>
            </Card>
            <Card className="border-2 bg-gradient-to-br from-[#e7ecef] to-[#a3cef1]/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-[#6096ba]" /> Class
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-[#274c77]">
                  {classroomOptions.find((o: any) => o.id === selectedClassroomId && o.role === 'Subject Teacher')?.name || '—'}
                </div>
                <p className="text-xs text-gray-500 mt-1 capitalize">
                  {classroomOptions.find((o: any) => o.id === selectedClassroomId && o.role === 'Subject Teacher')?.shift || ''} shift
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Today's Schedule */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="text-[#274c77] flex items-center gap-2">
                <Calendar className="h-5 w-5" /> Today's Schedule
              </CardTitle>
              <CardDescription>Timetable for this class</CardDescription>
            </CardHeader>
            <CardContent>
              {timetable.length === 0 ? (
                <p className="text-sm text-gray-500">No timetable configured for this class.</p>
              ) : (
                <div className="space-y-2">
                  {timetable.slice(0, 8).map((period: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                      <span className="font-medium text-gray-700">{period.subject_name || period.subject || `Period ${idx + 1}`}</span>
                      <span className="text-sm text-gray-500">{period.time_slot || period.start_time || ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Class Teacher Dashboard */}
      {selectedRole === 'class_teacher' && (<><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-xl transition-all duration-300 cursor-pointer border-2 bg-gradient-to-br from-[#e7ecef] to-[#a3cef1]/30 hover:scale-105">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Students</CardTitle>
            <div className="p-2 rounded-full bg-[#6096ba]/10">
              <UsersIcon className="h-5 w-5 text-[#6096ba]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#274c77] mb-1">{classInfo.totalStudents}</div>
            <p className="text-xs text-gray-500">Active students</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-xl transition-all duration-300 cursor-pointer border-2 bg-gradient-to-br from-blue-50 to-blue-100/50 hover:scale-105">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Boys</CardTitle>
            <div className="p-2 rounded-full bg-blue-100">
              <UserCheck className="h-5 w-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700 mb-1">{classInfo.boys}</div>
            <p className="text-xs text-blue-600">
              {classInfo.totalStudents > 0 ? Math.round((classInfo.boys / classInfo.totalStudents) * 100) : 0}% of total
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-xl transition-all duration-300 cursor-pointer border-2 bg-gradient-to-br from-pink-50 to-pink-100/50 hover:scale-105">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Girls</CardTitle>
            <div className="p-2 rounded-full bg-pink-100">
              <UserCheck className="h-5 w-5 text-pink-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-pink-700 mb-1">{classInfo.girls}</div>
            <p className="text-xs text-pink-600">
              {classInfo.totalStudents > 0 ? Math.round((classInfo.girls / classInfo.totalStudents) * 100) : 0}% of total
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-xl transition-all duration-300 cursor-pointer border-2 bg-gradient-to-br from-green-50 to-green-100/50 hover:scale-105">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Attendance Today</CardTitle>
            <div className="p-2 rounded-full bg-green-100">
              <CalendarCheck className="h-5 w-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 text-lg font-bold mb-1">
              <span className="text-green-600">P: {classInfo.attendanceToday.present}</span>
              <span className="text-red-500">A: {classInfo.attendanceToday.absent}</span>
            </div>
            <p className="text-xs text-green-600">
              {classInfo.totalStudents > 0 ? Math.round((classInfo.attendanceToday.present / classInfo.totalStudents) * 100) : 0}% present
            </p>
          </CardContent>
        </Card>
      </div>
      {/* Class Performance Dashboard (result metrics: heatmap, roster, vs campus) */}
      {canViewNetworkPerformanceChart && (
        <div className="bg-white rounded-2xl border-2 p-4 sm:p-6">
          <div className="mb-4">
            <h2 className="text-lg font-black text-[#274c77]">Class Performance Dashboard</h2>
            <p className="text-xs text-gray-500">Your class internals & comparison against the campus baseline (approved results)</p>
          </div>
          <ClassTeacherNetworkDashboard />
        </div>
      )}

      {/* Absentees Today and At-Risk */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-2 bg-white">
          <CardHeader>
            <CardTitle className="text-[#274c77] flex items-center gap-2">
              <Users className="h-5 w-5 text-[#ef4444]" />
              Absentees Today
            </CardTitle>
            <CardDescription>Students absent today</CardDescription>
          </CardHeader>

          <CardContent>
            <div className="max-h-60 overflow-y-auto pr-1">
              {absenteesToday.length === 0 ? (
                <div className="text-sm text-gray-500">No absentees today. </div>
              ) : (
                <div className="space-y-2">
                  {absenteesToday.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-2 rounded-lg border border-gray-200">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                        <p className="text-xs text-gray-500 truncate">{s.code}</p>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-full bg-red-50 text-red-600 border border-red-200">Absent</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 bg-white">
          <CardHeader>
            <CardTitle className="text-[#274c77] flex items-center gap-2">
              <Activity className="h-5 w-5 text-[#f59e0b]" />
              At-Risk (30 days)
            </CardTitle>
            <CardDescription>Attendance rate below 80%</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-60 overflow-y-auto pr-1">
              {atRisk.length === 0 ? (
                <div className="text-sm text-gray-500">No at-risk students in last 30 days.</div>
              ) : (
                <div className="space-y-2">
                  {atRisk.map((student) => (
                    <div key={student.id} className="flex items-start justify-between gap-3 p-2 rounded-lg border border-gray-200">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{student.name}</p>
                        {student.code && <p className="text-xs text-gray-500 truncate">{student.code}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {student.reasons.map((reason, idx) => {
                          if (reason.type === 'low_attendance') {
                            return (
                              <span
                                key={`low-${student.id}-${idx}`}
                                className="text-xs px-2 py-1 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200"
                              >
                                {reason.attendanceRate}% / 30d
                              </span>
                            )
                          }
                          const streakText = `${reason.streakLength} day streak`
                          const lastAbsentText = reason.lastAbsentOn ? ` • Last: ${formatAlertDate(reason.lastAbsentOn)}` : ""
                          return (
                            <span
                              key={`streak-${student.id}-${idx}`}
                              className="text-xs px-2 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200 text-right"
                            >
                              {streakText}
                              {lastAbsentText}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 bg-white">
          <CardHeader>
            <CardTitle className="text-[#274c77] flex items-center gap-2">
              <HistoryIcon className="h-5 w-5 text-[#6096ba]" />
              Recent Attendance
            </CardTitle>
            <CardDescription>Latest attendance sheets and status</CardDescription>
          </CardHeader>
          <CardContent>
            {Array.isArray(recentSubmissions) && recentSubmissions.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 max-h-60 overflow-y-auto pr-1">
                {recentSubmissions.map((r, idx) => {
                  const dateObj = new Date(r.date)
                  const dateStr = isNaN(dateObj.getTime()) ? String(r.date) : dateObj.toISOString().split('T')[0]
                  return (
                    <Link key={idx} href={`/admin/teachers/attendance?date=${encodeURIComponent(dateStr)}`} className="p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{dateObj.toLocaleDateString?.() || String(r.date)}</p>
                        <span className={`shrink-0 text-xs px-2 py-1 rounded-full border ${r.status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' : r.status === 'submitted' ? 'bg-blue-50 text-blue-700 border-blue-200' : r.status === 'under_review' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>{r.display_status || (r.status || 'draft').replace('_', ' ')}</span>
                      </div>
                      <div className="mt-2 text-xs text-gray-600 grid grid-cols-2 gap-2">
                        <span className="truncate">Present: {r.present_count || 0}</span>
                        <span className="truncate">Absent: {r.absent_count || 0}</span>
                      </div>
                      <div className="mt-1 text-xs font-semibold text-[#274c77]">
                        Attendance: {(() => {
                          const p = Number(r.present_count || 0)
                          const a = Number(r.absent_count || 0)
                          const l = Number(r.leave_count || 0)
                          const total = Number(r.total_students || 0) || (p + a + l)
                          if (!total) return 0
                          return Math.round((p / total) * 100)
                        })()}%
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="text-sm text-gray-500">No recent sheets found.</div>
            )}
          </CardContent>
        </Card>
      </div>
      {/* Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gender Distribution */}
        <Card className="border-2 bg-white">
          <CardHeader>
            <CardTitle className="text-[#274c77] flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-[#6096ba]" />
              Gender Distribution
            </CardTitle>
            <CardDescription>Visual breakdown of boys and girls in class</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center h-80">
            {classInfo.totalStudents > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Boys', value: classInfo.boys },
                      { name: 'Girls', value: classInfo.girls }
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    <Cell fill="#6096ba" />
                    <Cell fill="#ec4899" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-gray-500">No data available</div>
            )}
            <div className="flex gap-4 mt-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#6096ba]"></div>
                <span className="text-sm font-medium text-gray-600">Boys: {classInfo.boys}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ec4899]"></div>
                <span className="text-sm font-medium text-gray-600">Girls: {classInfo.girls}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Class Timetable Section */}
        <Card className="border-2 bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-[#274c77] flex items-center gap-2">
              <Clock className="h-5 w-5 text-[#6096ba]" />
              Today's Schedule
            </CardTitle>
            <CardDescription>Class timings for {WEEK_DAYS[new Date().getDay() === 0 ? 0 : new Date().getDay() - 1]}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1 hide-scrollbar">
              {timeSlots.length > 0 ? (
                timeSlots.map((slot, idx) => {
                  const currentDay = WEEK_DAYS[new Date().getDay() === 0 ? 0 : new Date().getDay() - 1];
                  const period = timetable.find(p => 
                    p.day === currentDay.toLowerCase() && 
                    p.start_time.startsWith(slot.start_time.slice(0, 5))
                  );

                  if (slot.is_break) {
                    return (
                      <div key={idx} className="flex items-center justify-center p-2 rounded-lg bg-orange-50/50 border border-orange-100 italic text-[10px] text-orange-600 font-bold uppercase tracking-widest">
                        — Break Time —
                      </div>
                    );
                  }

                  return (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-slate-50 hover:bg-slate-50 transition-colors group">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                          {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                        </span>
                        <span className="font-extrabold text-[#274c77] text-sm group-hover:text-[#6096ba] transition-colors">
                          {period ? (period.subject_name || period.subject?.name) : "Free Period"}
                        </span>
                      </div>
                      {period && (
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Teacher</p>
                          <p className="text-[#6096ba] font-bold text-xs">{period.teacher_name || period.teacher?.full_name || "Assigned"}</p>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-10">
                  <div className="bg-slate-50 p-4 rounded-full inline-block mb-3">
                    <Calendar className="h-6 w-6 text-slate-300" />
                  </div>
                  <p className="text-sm text-gray-400 font-medium">No schedule available for today</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        {/* Attendance Chart - New UI */}
        <Card className="border-2 bg-gradient-to-br from-[#e7ecef] to-[#a3cef1]/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-[#274c77] flex items-center gap-2">
                <CalendarCheck className="h-5 w-5 text-[#6096ba]" />
                Weekly Attendance Overview
              </CardTitle>
              <CardDescription>Daily attendance pattern for this week</CardDescription>
            </div>
            
            {['org-admin', 'principal', 'teacher', 'coordinator'].includes(userRole) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1 border-4 border-[#274c77] text-[#274c77] hover:bg-[#6096ba] ">
                    <Download className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                      Export CSV
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white">
                  <DropdownMenuLabel>Select Duration</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer hover:bg-gray-100" onClick={() => handleExportCSV(7)}>Last 7 Days</DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer hover:bg-gray-100" onClick={() => handleExportCSV(30)}>Last 1 Month</DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer hover:bg-gray-100" onClick={() => handleExportCSV(90)}>Last 3 Months</DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer hover:bg-gray-100" onClick={() => handleExportCSV(180)}>Last 6 Months</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={classInfo.attendanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#a3cef1" opacity={0.3} />
                  <XAxis
                    dataKey="day"
                    stroke="#274c77"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#274c77"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, Math.ceil((classInfo.totalStudents || 10) * 1.2)]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '2px solid #6096ba',
                      borderRadius: '12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}
                    labelStyle={{ color: '#274c77', fontWeight: 'bold' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="present"
                    stroke="#6096ba"
                    strokeWidth={4}
                    dot={{ fill: '#6096ba', strokeWidth: 2, r: 6 }}
                    activeDot={{ r: 8, stroke: '#6096ba', strokeWidth: 2 }}
                    name="Present Students"
                  />
                  <Line
                    type="monotone"
                    dataKey="absent"
                    stroke="#ef4444"
                    strokeWidth={4}
                    dot={{ fill: '#ef4444', strokeWidth: 2, r: 6 }}
                    activeDot={{ r: 8, stroke: '#ef4444', strokeWidth: 2 }}
                    name="Absent Students"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex justify-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#6096ba]"></div>
                <span className="text-sm text-gray-600">Present</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ef4444]"></div>
                <span className="text-sm text-gray-600">Absent</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      </>)}
    </div>
  )
}
