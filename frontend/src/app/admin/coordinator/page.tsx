"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  Users,
  UserCheck,
  Layers,
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  ArrowRight,
  Activity,
  PieChart,
  MapPin,
  RefreshCw,
  Download,
  Building2,
  Clock,
  GraduationCap,
  XCircle,
  Calendar,
  ArrowLeftRight,
  FileText,
  ClipboardCheck,
  Bell
} from "lucide-react"
import {
  getCoordinatorDashboardStats,
  findCoordinatorByEmployeeCode,
  getAllCoordinators,
  getCoordinatorClasses,
  getLevelAttendanceSummary,
  getCoordinatorRequests,
  getCoordinatorTeachers,
  getCoordinatorAttendanceStatus,
  remindCoordinatorAttendance,
  type CoordinatorAttendanceStatus
} from "@/lib/api"
import { getCurrentUserRole, getCurrentUser, usePermissions } from "@/lib/permissions"
import { AccessDenied } from "@/components/AccessDenied"
import CoordinatorNetworkDashboard from "@/components/dashboard/coordinator-network-dashboard"
import { ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell } from "recharts"
import type { PieLabelRenderProps } from "recharts"

type SubjectSlice = { name: string; value: number; percentage?: number; color?: string }

interface ClassroomData {
  id: number
  name: string
  code: string
  grade: string
  section: string
  shift: string
  campus?: string
  student_count?: number
  class_teacher?: {
    id?: number | null
    name?: string | null
    employee_code?: string | null
  } | null
  level?: { id: number; name: string } | null
}

type DashboardStatsPayload = {
  stats?: {
    total_teachers?: number
    total_students?: number
    total_classes?: number
    pending_requests?: number
  }
  subject_distribution?: SubjectSlice[]
} | null

type DashboardRequestOverview = RequestStats | { error?: string } | null

interface RequestStats {
  total_requests: number
  submitted: number
  under_review: number
  in_progress: number
  waiting: number
  resolved: number
  rejected: number
}

interface CoordinatorRequest {
  id: number
  subject: string
  category_display: string
  status: string
  status_display: string
  teacher_name: string
  updated_at: string
}

interface AttendanceSummary {
  date_range?: { start_date?: string; end_date?: string }
  summary: {
    total_classrooms: number
    total_students: number
    total_present: number
    total_absent: number
    total_late: number
    total_leave: number
    overall_percentage: number
  }
  classrooms: Array<{
    classroom: {
      id: number
      name: string
      grade?: string
      section?: string
      shift: string
      campus?: string | null
    }
    student_count: number
    average_percentage: number
    records_count?: number
    total_present?: number
    total_absent?: number
    total_late?: number
    total_leave?: number
    last_attendance?: string | null
  }>
}

const SHIFT_LABELS: Record<string, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  both: "Both Shifts",
  all: "All Shifts"
}

const normalizeShiftValue = (shift?: string | null) => {
  if (!shift) return "morning"
  const value = shift.toString().trim().toLowerCase()
  if (["both", "all", "morning+afternoon", "morning + afternoon"].includes(value)) return "both"
  if (value.startsWith("morn")) return "morning"
  if (value.startsWith("after")) return "afternoon"
  return value || "morning"
}

const getShiftLabel = (shiftValue: string) =>
  SHIFT_LABELS[shiftValue] || shiftValue.charAt(0).toUpperCase() + shiftValue.slice(1)

const normalizeShiftLabel = (shift?: string | null) => getShiftLabel(normalizeShiftValue(shift))

const extractEmployeeCode = (teacherName?: string | null) => {
  if (!teacherName) return null
  const match = teacherName.match(/\(([^)]+)\)\s*$/)
  return match ? match[1].trim() : null
}

const normalizeClassesResponse = (payload: any): ClassroomData[] => {
  if (Array.isArray(payload)) return payload
  if (payload?.results && Array.isArray(payload.results)) return payload.results
  if (payload?.data && Array.isArray(payload.data)) return payload.data
  return []
}

const formatNumber = (value?: number) => new Intl.NumberFormat("en-PK").format(value ?? 0)

const formatDate = (value?: string | null) => {
  if (!value) return "—"
  try {
    return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(new Date(value))
  } catch {
    return value
  }
}

const SUBJECT_COLORS = [
  "#b0c4b1",
  "#184e77",
  "#b7d1f3",
  "#98c1d9",
  "#936639",
  "#f8fafc",
  "#f8fafc",
  "#f8fafc"
]

const mergeAttendanceSummaries = (summaries: Array<any>): AttendanceSummary | null => {
  const valid = summaries.filter((item) => item && !item.error)
  if (!valid.length) return null

  const merged = valid.reduce<AttendanceSummary>(
    (acc, current) => {
      const summary = current?.summary || {}
      acc.summary.total_classrooms += summary.total_classrooms ?? 0
      acc.summary.total_students += summary.total_students ?? 0
      acc.summary.total_present += summary.total_present ?? 0
      acc.summary.total_absent += summary.total_absent ?? 0
      acc.summary.total_late += summary.total_late ?? 0
      acc.summary.total_leave += summary.total_leave ?? 0
      acc.classrooms = acc.classrooms.concat(
        (current?.classrooms || []).map((item: any) => ({
          classroom: item.classroom,
          student_count: item.student_count,
          average_percentage: item.average_percentage,
          last_attendance: item.last_attendance
        }))
      )

      const start = current?.date_range?.start_date
      const end = current?.date_range?.end_date
      if (start && (!acc.date_range?.start_date || start < acc.date_range.start_date)) {
        acc.date_range = { ...acc.date_range, start_date: start }
      }
      if (end && (!acc.date_range?.end_date || end > acc.date_range.end_date)) {
        acc.date_range = { ...acc.date_range, end_date: end }
      }
      return acc
    },
    {
      summary: {
        total_classrooms: 0,
        total_students: 0,
        total_present: 0,
        total_absent: 0,
        total_late: 0,
        total_leave: 0,
        overall_percentage: 0
      },
      classrooms: [],
      date_range: { start_date: undefined, end_date: undefined }
    }
  )

  const attendanceEvents = merged.summary.total_present + merged.summary.total_absent
  if (attendanceEvents > 0) {
    merged.summary.overall_percentage = Number(
      ((merged.summary.total_present / attendanceEvents) * 100).toFixed(2)
    )
  }

  merged.classrooms.sort((a, b) => (b.average_percentage || 0) - (a.average_percentage || 0))
  return merged
}

const RADIAN = Math.PI / 180

const GRADE_ORDER = [
  "nursery",
  "kg-i",
  "kg-ii",
  "kg iii",
  "grade 1",
  "grade i",
  "grade 2",
  "grade ii",
  "grade 3",
  "grade iii",
  "grade 4",
  "grade iv",
  "grade 5",
  "grade v",
  "grade 6",
  "grade vi",
  "grade 7",
  "grade vii",
  "grade 8",
  "grade viii",
  "grade 9",
  "grade ix",
  "grade 10",
  "grade x"
]

const normalizeGradeKey = (grade?: string) => {
  if (!grade) return ""
  return grade
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function renderSubjectLabel({
  cx,
  cy,
  midAngle,
  outerRadius,
  name,
  value,
  payload
}: PieLabelRenderProps) {
  const numericCx = typeof cx === "number" ? cx : Number(cx) || 0
  const numericCy = typeof cy === "number" ? cy : Number(cy) || 0
  const numericOuterRadius =
    typeof outerRadius === "number" ? outerRadius : Number(outerRadius) || 0
  const numericMidAngle = typeof midAngle === "number" ? midAngle : Number(midAngle) || 0
  const numericValue = typeof value === "number" ? value : Number(value) || 0
  const label = typeof name === "string" ? name : String(name)

  // Get percentage from payload if available
  const percentage = (payload as any)?.percentage
  const percentageText = percentage !== undefined ? `${percentage}%` : ""

  const radius = numericOuterRadius + 18
  const x = numericCx + radius * Math.cos(-numericMidAngle * RADIAN)
  const y = numericCy + radius * Math.sin(-numericMidAngle * RADIAN)

  return (
    <text
      x={x}
      y={y}
      fill="#274c77"
      textAnchor={x > numericCx ? "start" : "end"}
      dominantBaseline="central"
      fontSize={12}
    >
      {percentageText ? `${label} - ${percentageText}` : `${label}`}
    </text>
  )
}

export default function CoordinatorPage() {
  const { canViewCoordinatorDashboard, canViewNetworkPerformanceChart } = usePermissions();
  const router = useRouter()
  const [coreStats, setCoreStats] = useState({
    total_teachers: 0,
    total_students: 0,
    total_classes: 0,
    pending_requests: 0
  })
  const [subjectData, setSubjectData] = useState<SubjectSlice[]>([])
  const [classrooms, setClassrooms] = useState<ClassroomData[]>([])
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null)
  const [levelSummaries, setLevelSummaries] = useState<Record<number, AttendanceSummary>>({})
  const [requestStats, setRequestStats] = useState<RequestStats | null>(null)
  const [allRequests, setAllRequests] = useState<CoordinatorRequest[]>([])
  const [coordinatorInfo, setCoordinatorInfo] = useState<any>(null)
  const [coordinators, setCoordinators] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])
  const [userRole, setUserRole] = useState("")
  const [userCampus, setUserCampus] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attendanceStatus, setAttendanceStatus] = useState<CoordinatorAttendanceStatus | null>(null)
  const [reminding, setReminding] = useState(false)
  const [remindMsg, setRemindMsg] = useState<string | null>(null)
  const [selectedShift, setSelectedShift] = useState<string | null>(null)
  const [selectedLevelId, setSelectedLevelId] = useState<string>("all")

  useEffect(() => {
    document.title = "Coordinator Dashboard | Newton AMS"
    const role = getCurrentUserRole()
    setUserRole(role)

    const user = getCurrentUser() as any
    if (user?.campus?.campus_name) {
      setUserCampus(user.campus.campus_name)
    }
  }, [])

  const fetchDashboard = useCallback(async () => {
    try {
      setError(null)
      setLoading(true)

      if (userRole === "principal" && userCampus) {
        const allCoordinators: any = await getAllCoordinators();
        const coordinatorList = Array.isArray(allCoordinators) ? allCoordinators : (allCoordinators.results || []);
        const campusCoordinators = coordinatorList.filter(
          (coord: any) =>
            coord.campus?.campus_name === userCampus || coord.campus === userCampus
        )
        setCoordinators(campusCoordinators)
        return
      }

      const rawUser = localStorage.getItem("sis_user")
      if (!rawUser) {
        setError("Session expired. Please sign in again.")
        return
      }

      const parsedUser = JSON.parse(rawUser)
      const coordinator = await findCoordinatorByEmployeeCode(parsedUser.username)
      if (!coordinator) {
        setError("Coordinator profile not found.")
        return
      }
      setCoordinatorInfo(coordinator)

      const [core, classPayload, requestOverview, requestList, teachersPayload, statusPayload] = await Promise.all([
        getCoordinatorDashboardStats(coordinator.id),
        getCoordinatorClasses(),
        getCoordinatorDashboardStats(),
        getCoordinatorRequests(),
        getCoordinatorTeachers(coordinator.id),
        getCoordinatorAttendanceStatus(coordinator.id)
      ])

      const typedCore = core as DashboardStatsPayload
      setCoreStats({
        total_teachers: typedCore?.stats?.total_teachers ?? 0,
        total_students: typedCore?.stats?.total_students ?? 0,
        total_classes: typedCore?.stats?.total_classes ?? 0,
        pending_requests: typedCore?.stats?.pending_requests ?? 0
      })

      setSubjectData(
        Array.isArray(typedCore?.subject_distribution) ? typedCore.subject_distribution : []
      )

      setAttendanceStatus((statusPayload as CoordinatorAttendanceStatus) ?? null)

      const normalizedClasses = normalizeClassesResponse(classPayload)
      setClassrooms(normalizedClasses)
      setTeachers(Array.isArray((teachersPayload as any)?.teachers) ? (teachersPayload as any).teachers : [])

      const explicitLevelIds: number[] = []
      // assigned_levels is a list of PKs (numbers) from the API
      if (Array.isArray(coordinator.assigned_levels) && coordinator.assigned_levels.length) {
        coordinator.assigned_levels.forEach((lvl: any) => {
          const id = Number(typeof lvl === 'object' ? lvl?.id : lvl)
          if (!Number.isNaN(id)) {
            explicitLevelIds.push(id)
          }
        })
      } else if (coordinator.level?.id) {
        explicitLevelIds.push(Number(coordinator.level.id))
      }

      const derivedLevelIds = normalizedClasses
        .map((cls) => (cls.level?.id !== undefined ? Number(cls.level.id) : NaN))
        .filter((id) => !Number.isNaN(id))

      const uniqueLevelIds = Array.from(new Set([...explicitLevelIds, ...derivedLevelIds]))

      if (uniqueLevelIds.length) {
        const summaries = await Promise.all(
          uniqueLevelIds.map(async (id) => {
            try {
              return await getLevelAttendanceSummary(id)
            } catch (summaryError: any) {
              if (summaryError?.status === 403 || summaryError?.status === 401) {
                return { error: "access_denied" }
              }
              throw summaryError
            }
          })
        )
        const summaryMap: Record<number, AttendanceSummary> = {}
        uniqueLevelIds.forEach((id, index) => {
          const payload = summaries[index]
          if (payload && !(payload as any)?.error) {
            summaryMap[id] = payload as AttendanceSummary
          }
        })
        setLevelSummaries(summaryMap)
        setAttendanceSummary(mergeAttendanceSummaries(Object.values(summaryMap)))
      } else {
        setLevelSummaries({})
        setAttendanceSummary(null)
      }

      const overviewPayload = requestOverview as DashboardRequestOverview
      if (overviewPayload && "error" in overviewPayload) {
        setRequestStats(null)
      } else {
        setRequestStats((overviewPayload ?? null) as RequestStats | null)
      }

      if (Array.isArray(requestList)) {
        const sorted = [...requestList].sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )
        setAllRequests(sorted)
      } else {
        setAllRequests([])
      }
    } catch (err) {
      console.error("Coordinator dashboard load failed:", err)
      setError("Unable to load dashboard. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [userRole, userCampus])

  const exportAttendanceCSV = () => {
    if (!filteredGrades.length) return;
    const headers = ['Grade', 'Shift', 'Attendance %', 'Last Marked', 'Sections'];
    const rows = [headers.join(',')];
    filteredGrades.forEach((row) => {
      const sections = row.sections.map((s) => `${s.name}: ${s.percentage}%`).join(' | ');
      rows.push([
        `"${row.grade}"`,
        row.shift ? normalizeShiftLabel(row.shift) : 'N/A',
        row.percentage,
        row.last_attendance || 'N/A',
        `"${sections}"`
      ].join(','));
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Attendance_Summary_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportTeachersCSV = () => {
    if (!filteredTeachers.length) return;
    const headers = [
      'Employee Code', 'Biometric ID', 'Full Name', 'Father Name', 'Gender', 'Date of Birth',
      'Contact Number', 'Email', 'CNIC', 'Marital Status',
      'Current Address', 'Permanent Address',
      'Education Level', 'Institution Name', 'Passing Year', 'Education Subjects', 'Education Grade',
      'Previous Institution', 'Previous Position', 'Experience From', 'Experience To', 'Total Exp Years',
      'Joining Date', 'Current Campus', 'Current Role', 'Shift', 'Assigned Classrooms', 'Coordinators',
      'Subjects Taught', 'Classes Taught', 'Extra Responsibilities', 'Role Start Date', 'Status'
    ];
    const rows = [headers.join(',')];
    filteredTeachers.forEach((t: any) => {
      rows.push([
        t.employee_code || 'N/A',
        t.biometric_id || 'N/A',
        `"${t.full_name || t.name || 'N/A'}"`,
        `"${t.father_name || 'N/A'}"`,
        t.gender || 'N/A',
        t.dob || 'N/A',
        `"${t.contact_number || 'N/A'}"`,
        t.email || 'N/A',
        t.cnic || 'N/A',
        t.marital_status || 'N/A',
        `"${t.current_address || 'N/A'}"`,
        `"${t.permanent_address || 'N/A'}"`,
        `"${t.education_level || 'N/A'}"`,
        `"${t.institution_name || 'N/A'}"`,
        t.year_of_passing || 'N/A',
        `"${t.education_subjects || 'N/A'}"`,
        t.education_grade || 'N/A',
        `"${t.previous_institution_name || 'N/A'}"`,
        `"${t.previous_position || 'N/A'}"`,
        t.experience_from_date || 'N/A',
        t.experience_to_date || 'N/A',
        t.total_experience_years || 'N/A',
        t.joining_date || 'N/A',
        `"${t.campus_name || t.current_campus_name || 'N/A'}"`,
        `"${t.current_role_title || 'N/A'}"`,
        normalizeShiftLabel(t.shift),
        `"${t.assigned_classrooms_display || t.assigned_classroom_names || 'N/A'}"`,
        `"${t.coordinator_names || 'N/A'}"`,
        `"${t.current_subjects || 'N/A'}"`,
        `"${t.current_classes_taught || 'N/A'}"`,
        `"${t.current_extra_responsibilities || 'N/A'}"`,
        t.role_start_date || 'N/A',
        t.is_currently_active ? 'Active' : 'Inactive'
      ].join(','));
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Teachers_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!userRole || !canViewCoordinatorDashboard) return
    fetchDashboard()
  }, [userRole, userCampus, fetchDashboard, canViewCoordinatorDashboard])

  const handleRemindAll = useCallback(async () => {
    if (!coordinatorInfo?.id) return
    try {
      setReminding(true)
      setRemindMsg(null)
      const result = await remindCoordinatorAttendance(coordinatorInfo.id, attendanceStatus?.date)
      let msg = `${result.sent} reminder${result.sent === 1 ? "" : "s"} sent`
      if (result.skipped > 0) {
        msg += `, ${result.skipped} skipped (no teacher linked)`
      }
      setRemindMsg(msg)
      // Refresh status so sent counts update
      const refreshed = await getCoordinatorAttendanceStatus(coordinatorInfo.id, attendanceStatus?.date)
      setAttendanceStatus(refreshed)
    } catch (err) {
      console.error("Remind failed:", err)
      setRemindMsg("Failed to send reminders. Please try again.")
    } finally {
      setReminding(false)
    }
  }, [coordinatorInfo, attendanceStatus])

  const unmarkedTeachers = useMemo(() => {
    if (!attendanceStatus?.grades) return []
    return attendanceStatus.grades.flatMap((g) =>
      g.unmarked_teachers.map((t) => ({ ...t, grade: g.grade, level: g.level }))
    )
  }, [attendanceStatus])

  if (!canViewCoordinatorDashboard) {
    return <AccessDenied title="Coordinator Access Restricted" message="Your dashboard access has been disabled by the administration." />
  }

  const shiftStructure = useMemo(() => {
    const levelsByShift = new Map<string, Map<number, string>>()
    const uniqueLevels = new Map<number, string>()
    classrooms.forEach((cls) => {
      const shiftValue = normalizeShiftValue(cls.shift)
      if (!levelsByShift.has(shiftValue)) {
        levelsByShift.set(shiftValue, new Map())
      }
      const levelId = cls.level?.id
      const levelName = cls.level?.name || cls.grade
      if (levelId && levelName) {
        levelsByShift.get(shiftValue)!.set(levelId, levelName)
        uniqueLevels.set(levelId, levelName)
      }
    })
    const order = ["morning", "afternoon", "both"]
    const baseShiftOptions = Array.from(levelsByShift.entries())
      .map(([value, levelMap]) => ({
        value,
        label: getShiftLabel(value),
        levels: Array.from(levelMap.entries()).map(([id, name]) => ({ id, name }))
      }))
      .sort((a, b) => {
        const ai = order.indexOf(a.value)
        const bi = order.indexOf(b.value)
        if (ai === -1 && bi === -1) return a.label.localeCompare(b.label)
        if (ai === -1) return 1
        if (bi === -1) return -1
        return ai - bi
      })
    return {
      baseShiftOptions,
      combinedLevels: Array.from(uniqueLevels.entries()).map(([id, name]) => ({ id, name }))
    }
  }, [classrooms])

  const shiftOptions = useMemo(() => {
    if (shiftStructure.baseShiftOptions.length > 1) {
      return [
        { value: "both", label: "Both Shifts", levels: shiftStructure.combinedLevels },
        ...shiftStructure.baseShiftOptions
      ]
    }
    if (shiftStructure.baseShiftOptions.length === 1) {
      return shiftStructure.baseShiftOptions
    }
    if (coordinatorInfo?.shift) {
      const value = normalizeShiftValue(coordinatorInfo.shift)
      return [{ value, label: getShiftLabel(value), levels: shiftStructure.combinedLevels }]
    }
    return []
  }, [shiftStructure, coordinatorInfo])

  useEffect(() => {
    if (!shiftOptions.length) {
      setSelectedShift(null)
      return
    }
    if (!selectedShift || !shiftOptions.some((option) => option.value === selectedShift)) {
      setSelectedShift(shiftOptions[0].value)
    }
  }, [shiftOptions, selectedShift])

  const currentShiftValue = selectedShift ?? shiftOptions[0]?.value ?? null
  const currentShiftOption = useMemo(
    () => shiftOptions.find((option) => option.value === currentShiftValue) ?? shiftOptions[0],
    [shiftOptions, currentShiftValue]
  )

  const allLevelOptions = useMemo(() => {
    const seen = new Map<number, string>()
    shiftStructure.combinedLevels.forEach((item) => {
      if (item.id) {
        seen.set(item.id, item.name || `Level ${item.id}`)
      }
    })
    return Array.from(seen.entries()).map(([id, name]) => ({ value: id.toString(), label: name }))
  }, [shiftStructure])

  const currentLevelOptions = useMemo(() => {
    if (!currentShiftOption) return allLevelOptions
    const seen = new Map<number, string>()
      ; (currentShiftOption.levels || allLevelOptions).forEach((item) => {
        if (item.id) {
          seen.set(item.id, item.name || `Level ${item.id}`)
        }
      })
    const levelList = Array.from(seen.entries()).map(([id, name]) => ({
      value: id.toString(),
      label: name
    }))
    if (levelList.length > 1) {
      return [{ value: "all", label: "All Levels" }, ...levelList]
    }
    return levelList
  }, [currentShiftOption, allLevelOptions])

  useEffect(() => {
    if (!currentLevelOptions.length) {
      setSelectedLevelId("all")
      return
    }
    const actualLevels = currentLevelOptions.filter((option) => option.value !== "all")
    if (actualLevels.length === 1) {
      setSelectedLevelId(actualLevels[0].value)
      return
    }
    if (!currentLevelOptions.some((option) => option.value === selectedLevelId)) {
      setSelectedLevelId("all")
    }
  }, [currentLevelOptions, selectedLevelId])

  const showShiftFilter = shiftOptions.length > 1
  const showLevelFilter =
    currentLevelOptions.filter((option) => option.value !== "all").length > 1

  const fallbackLevelIds = useMemo(
    () =>
      Object.keys(levelSummaries)
        .map((id) => Number(id))
        .filter((id) => !Number.isNaN(id)),
    [levelSummaries]
  )

  const baseLevelIds = useMemo(
    () =>
      currentLevelOptions
        .filter((option) => option.value !== "all")
        .map((option) => Number(option.value))
        .filter((id) => !Number.isNaN(id)),
    [currentLevelOptions]
  )

  const isSpecificLevelSelected =
    selectedLevelId !== "all" &&
    currentLevelOptions.some((option) => option.value === selectedLevelId)

  const effectiveLevelIds = useMemo(() => {
    const availableIds = baseLevelIds.length ? baseLevelIds : fallbackLevelIds
    if (!availableIds.length) return []
    if (!isSpecificLevelSelected || !selectedLevelId) return availableIds
    const numericId = Number(selectedLevelId)
    if (Number.isNaN(numericId)) return availableIds
    return availableIds.includes(numericId) ? [numericId] : availableIds
  }, [baseLevelIds, fallbackLevelIds, isSpecificLevelSelected, selectedLevelId])

  const levelFilterSet = useMemo(() => new Set(effectiveLevelIds), [effectiveLevelIds])
  const shiftFilterValue =
    currentShiftOption && currentShiftOption.value !== "both" ? currentShiftOption.value : null
  const filtersActive = Boolean(shiftFilterValue) || isSpecificLevelSelected

  const filteredClassrooms = useMemo(() => {
    return classrooms.filter((classroom) => {
      const shiftValue = normalizeShiftValue(classroom.shift)
      if (shiftFilterValue && shiftValue !== shiftFilterValue) return false
      if (levelFilterSet.size) {
        const levelId = classroom.level?.id
        if (!levelId) return false
        return levelFilterSet.has(levelId)
      }
      return true
    })
  }, [classrooms, shiftFilterValue, levelFilterSet])

  const teacherLevelMap = useMemo(() => {
    const map = new Map<number, Set<number>>()
    classrooms.forEach((classroom) => {
      const teacherId = classroom.class_teacher?.id
      const levelId = classroom.level?.id
      if (teacherId && levelId) {
        if (!map.has(teacherId)) {
          map.set(teacherId, new Set())
        }
        map.get(teacherId)!.add(levelId)
      }
    })
    return map
  }, [classrooms])

  const teacherMetaByCode = useMemo(() => {
    const map = new Map<
      string,
      { shiftValue: string; levelIds: Set<number> }
    >()
    teachers.forEach((teacher: any) => {
      const code = teacher.employee_code || teacher.employeeCode
      if (!code) return
      const shiftValue = normalizeShiftValue(teacher.shift)
      const levelIds = teacherLevelMap.get(teacher.id) || new Set<number>()
      map.set(code, { shiftValue, levelIds })
    })
    return map
  }, [teachers, teacherLevelMap])

  const filteredTeachers = useMemo(() => {
    return teachers.filter((teacher: any) => {
      const shiftValue = normalizeShiftValue(teacher.shift)
      if (shiftFilterValue && shiftValue !== shiftFilterValue) return false
      if (!isSpecificLevelSelected || !levelFilterSet.size) return true
      const teacherLevels = teacherLevelMap.get(teacher.id)
      if (!teacherLevels || !teacherLevels.size) return true
      return Array.from(teacherLevels).some((id) => levelFilterSet.has(id))
    })
  }, [teachers, shiftFilterValue, levelFilterSet, teacherLevelMap, isSpecificLevelSelected])

  const filteredSubjectData = useMemo(() => {
    if (!filteredTeachers.length) return []
    const counts: Record<string, number> = {}
    let teachersWithSubjects = 0

    filteredTeachers.forEach((teacher: any) => {
      if (teacher.current_subjects) {
        const subjects = teacher.current_subjects
          .split(",")
          .map((subject: string) => subject.trim())
          .filter(Boolean)
        if (subjects.length > 0) {
          teachersWithSubjects += 1
          subjects.forEach((subject: string) => {
            counts[subject] = (counts[subject] || 0) + 1
          })
        }
      }
    })

    // Add "none" category for teachers without subjects
    const teachersWithoutSubjects = filteredTeachers.length - teachersWithSubjects
    if (teachersWithoutSubjects > 0) {
      counts['none'] = teachersWithoutSubjects
    }

    // Calculate percentage for each subject based on total teachers (not filtered)
    // Use coreStats.total_teachers for consistent percentage calculation
    const totalTeachers = coreStats.total_teachers || filteredTeachers.length

    // First calculate raw percentages
    const rawData = Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      rawPercentage: totalTeachers > 0 ? (value / totalTeachers) * 100 : 0
    }))

    // Calculate sum of all raw percentages
    const sumOfPercentages = rawData.reduce((sum, item) => sum + item.rawPercentage, 0)

    // Normalize percentages so they sum to 100%
    return rawData.map((item) => ({
      name: item.name,
      value: item.value,
      percentage: sumOfPercentages > 0
        ? Math.round((item.rawPercentage / sumOfPercentages) * 100 * 10) / 10
        : 0
    }))
  }, [filteredTeachers, coreStats.total_teachers])

  const subjectChartData = useMemo(() => {
    const source =
      filtersActive || filteredSubjectData.length
        ? filteredSubjectData
        : subjectData

    if (source.length === 0) return []

    // Recalculate percentage based on real total_teachers for accuracy
    const totalTeachers = coreStats.total_teachers || 0

    // First, calculate raw percentages
    const dataWithRawPercentages = source.map((slice) => {
      const rawPercentage = totalTeachers > 0
        ? (slice.value / totalTeachers) * 100
        : (slice.percentage || 0)

      return {
        ...slice,
        rawPercentage
      }
    })

    // Calculate sum of all raw percentages
    const sumOfPercentages = dataWithRawPercentages.reduce((sum, item) => sum + item.rawPercentage, 0)

    // Normalize percentages so they sum to 100%
    const normalizedData = dataWithRawPercentages.map((item, index) => {
      const normalizedPercentage = sumOfPercentages > 0
        ? Math.round((item.rawPercentage / sumOfPercentages) * 100 * 10) / 10
        : 0

      return {
        ...item,
        percentage: normalizedPercentage,
        color: SUBJECT_COLORS[index % SUBJECT_COLORS.length]
      }
    })

    return normalizedData
  }, [filteredSubjectData, subjectData, filtersActive, coreStats.total_teachers])

  const filteredLevelSummaries = useMemo(() => {
    if (!effectiveLevelIds.length) return Object.values(levelSummaries)
    return effectiveLevelIds.map((id) => levelSummaries[id]).filter(Boolean)
  }, [effectiveLevelIds, levelSummaries])

  const scopedAttendanceSummary = useMemo(() => {
    if (filteredLevelSummaries.length) {
      return mergeAttendanceSummaries(filteredLevelSummaries) ?? attendanceSummary
    }
    return attendanceSummary
  }, [filteredLevelSummaries, attendanceSummary])

  const studentsManaged = useMemo(() => {
    if (scopedAttendanceSummary?.summary?.total_students !== undefined) {
      return scopedAttendanceSummary.summary.total_students
    }
    return filteredClassrooms.reduce((total, classroom) => total + (classroom.student_count ?? 0), 0)
  }, [scopedAttendanceSummary, filteredClassrooms])

  const classesManaged =
    scopedAttendanceSummary?.summary?.total_classrooms ?? filteredClassrooms.length

  const filteredShiftBreakdown = useMemo(() => {
    return filteredClassrooms.reduce<Record<string, number>>((acc, classroom) => {
      const label = normalizeShiftLabel(classroom.shift)
      acc[label] = (acc[label] || 0) + 1
      return acc
    }, {})
  }, [filteredClassrooms])

  const filteredTopClasses = useMemo(() => {
    return [...filteredClassrooms]
      .sort((a, b) => (b.student_count ?? 0) - (a.student_count ?? 0))
      .slice(0, 4)
  }, [filteredClassrooms])

  const gradeAttendanceRows = useMemo(() => {
    if (!scopedAttendanceSummary?.classrooms?.length) return []
    type GradeRow = {
      grade: string
      weightedTotal: number
      totalWeight: number
      percentage: number
      last_attendance?: string | null
      shift?: string
      sections: { name: string; percentage: number }[]
    }
    const map = new Map<string, GradeRow>()
    scopedAttendanceSummary.classrooms.forEach((entry) => {
      const sectionName = entry.classroom.name || "Section"
      const gradeName =
        entry.classroom.grade ||
        sectionName.split(" - ")?.[0] ||
        "Grade"
      const key = `${gradeName}__${entry.classroom.shift}`
      const recordsCount = entry.records_count || 1
      const sectionAverage = entry.average_percentage || 0
      const current = map.get(key) || {
        grade: gradeName,
        weightedTotal: 0,
        totalWeight: 0,
        percentage: 0,
        last_attendance: entry.last_attendance,
        shift: entry.classroom.shift,
        sections: []
      }
      current.weightedTotal += sectionAverage * recordsCount
      current.totalWeight += recordsCount
      if (
        entry.last_attendance &&
        (!current.last_attendance || entry.last_attendance > current.last_attendance)
      ) {
        current.last_attendance = entry.last_attendance
      }
      const existingSection = current.sections.find((sec) => sec.name === sectionName)
      const sectionPercentage = sectionAverage
      if (existingSection) {
        existingSection.percentage = sectionPercentage
      } else {
        current.sections.push({ name: sectionName, percentage: sectionPercentage })
      }
      current.percentage =
        current.totalWeight > 0 ? Number((current.weightedTotal / current.totalWeight).toFixed(1)) : 0
      map.set(key, current)
    })
    return Array.from(map.values()).sort((a, b) => {
      const keyA = normalizeGradeKey(a.grade)
      const keyB = normalizeGradeKey(b.grade)
      const indexA = GRADE_ORDER.indexOf(keyA)
      const indexB = GRADE_ORDER.indexOf(keyB)
      if (indexA !== -1 && indexB !== -1) return indexA - indexB
      if (indexA !== -1) return -1
      if (indexB !== -1) return 1
      if (keyA === keyB) {
        return (a.shift || "").localeCompare(b.shift || "")
      }
      return keyA.localeCompare(keyB)
    })
  }, [scopedAttendanceSummary])

  const filteredGrades = useMemo(() => {
    if (!gradeAttendanceRows.length) return []
    if (!levelFilterSet.size) return gradeAttendanceRows
    return gradeAttendanceRows.filter((row) => {
      const matchingClassrooms = filteredClassrooms.filter(
        (cls) =>
          cls.grade === row.grade &&
          (!row.shift || normalizeShiftValue(cls.shift) === normalizeShiftValue(row.shift))
      )
      return matchingClassrooms.length > 0
    })
  }, [gradeAttendanceRows, filteredClassrooms, levelFilterSet])

  const filteredTeacherIdsFromClasses = useMemo(() => {
    const ids = new Set<number>()
    filteredClassrooms.forEach((classroom) => {
      if (classroom.class_teacher?.id) {
        ids.add(classroom.class_teacher.id)
      }
    })
    return ids
  }, [filteredClassrooms])

  const filteredRequests = useMemo(() => {
    if (!filtersActive) return allRequests
    return allRequests.filter((request) => {
      const code = extractEmployeeCode(request.teacher_name)
      if (!code) return false
      const meta = teacherMetaByCode.get(code)
      if (!meta) return false
      if (shiftFilterValue && meta.shiftValue !== shiftFilterValue) return false
      if (!isSpecificLevelSelected || !levelFilterSet.size) return true
      if (!meta.levelIds || !meta.levelIds.size) return false
      return Array.from(meta.levelIds).some((id) => levelFilterSet.has(id))
    })
  }, [allRequests, filtersActive, shiftFilterValue, isSpecificLevelSelected, levelFilterSet, teacherMetaByCode])

  type RequestStatusSummary = {
    submitted: number
    under_review: number
    in_progress: number
    waiting: number
    resolved: number
    rejected: number
  }

  const filteredRequestStats = useMemo<RequestStatusSummary>(() => {
    const summary: RequestStatusSummary = {
      submitted: 0,
      under_review: 0,
      in_progress: 0,
      waiting: 0,
      resolved: 0,
      rejected: 0
    }
    filteredRequests.forEach((request) => {
      const status = (request.status || "").toLowerCase() as keyof RequestStatusSummary
      if (summary[status] !== undefined) {
        summary[status] += 1
      }
    })
    return summary
  }, [filteredRequests])

  const filteredOpenRequestsCount =
    filteredRequestStats.submitted +
    filteredRequestStats.under_review +
    filteredRequestStats.in_progress +
    filteredRequestStats.waiting

  const displayedRequests = useMemo(() => filteredRequests.slice(0, 5), [filteredRequests])

  const subjectGroupCount = filtersActive ? filteredSubjectData.length : subjectData.length

  const derivedLevelNames = useMemo(() => {
    const names = new Set<string>()
    classrooms.forEach((cls) => {
      if (cls.level?.name) {
        names.add(cls.level.name)
      } else if (cls.grade) {
        names.add(cls.grade)
      }
    })
    return Array.from(names)
  }, [classrooms])

  const levelsDisplay = useMemo(() => {
    // Use assigned_levels_details (has id, name, shift) from coordinator serializer
    const details: Array<{id: number; name: string; shift?: string}> =
      Array.isArray(coordinatorInfo?.assigned_levels_details) && coordinatorInfo.assigned_levels_details.length
        ? coordinatorInfo.assigned_levels_details
        : []
    if (details.length) {
      const shifts = [...new Set(details.map((l: any) => l.shift).filter(Boolean))]
      if (shifts.length > 1) {
        const grouped = new Map<string, string[]>()
        details.forEach((l: any) => {
          const s = l.shift || 'morning'
          if (!grouped.has(s)) grouped.set(s, [])
          grouped.get(s)!.push(l.name)
        })
        const order = ['morning', 'afternoon', 'evening']
        return Array.from(grouped.entries())
          .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
          .map(([s, names]) => `${getShiftLabel(s)}: ${names.join(', ')}`)
          .join(' | ')
      }
      return details.map((l: any) => l.name).filter(Boolean).join(', ')
    }
    if (coordinatorInfo?.level?.name) {
      return coordinatorInfo.level.name
    }
    if (derivedLevelNames.length) {
      return derivedLevelNames.join(", ")
    }
    return "—"
  }, [coordinatorInfo, derivedLevelNames])

  const campusDisplay = useMemo(() => {
    return (
      coordinatorInfo?.campus?.campus_name ||
      coordinatorInfo?.campus_name ||
      userCampus ||
      "—"
    )
  }, [coordinatorInfo, userCampus])

  const shiftDisplayLabel = currentShiftOption?.label || normalizeShiftLabel(coordinatorInfo?.shift)
  const currentLevelLabel = useMemo(() => {
    if (showLevelFilter && isSpecificLevelSelected) {
      return (
        currentLevelOptions.find((option) => option.value === selectedLevelId)?.label ||
        levelsDisplay
      )
    }
    return levelsDisplay
  }, [showLevelFilter, isSpecificLevelSelected, currentLevelOptions, selectedLevelId, levelsDisplay])

  const filteredTeacherCount = filteredTeachers.length || filteredTeacherIdsFromClasses.size
  const displayTeacherCount = filtersActive
    ? filteredTeacherCount
    : teachers.length || coreStats.total_teachers || filteredTeacherCount

  const overviewCards = [
    {
      title: "Teachers",
      value: formatNumber(displayTeacherCount),
      icon: Users,
      accent: "bg-[#274c77]",
      detail: `${subjectGroupCount} subject groups`
    },
    {
      title: "Students",
      value: formatNumber(studentsManaged),
      icon: UserCheck,
      accent: "bg-[#6096ba]",
      detail: `${classesManaged} classes`
    },
    {
      title: "Classes",
      value: formatNumber(classesManaged),
      icon: Layers,
      accent: "bg-[#a3cef1]",
      detail: `${Object.keys(filteredShiftBreakdown).length || 0} shifts`
    },
    {
      title: "Open Requests",
      value: formatNumber(filteredOpenRequestsCount),
      icon: ClipboardList,
      accent: "bg-[#f7b267]",
      detail: `${formatNumber(filteredRequests.length)} total`
    }
  ]

  if (loading) {
    return (
      <div className="px-3 py-6 space-y-6">
        <div className="bg-white/70 border border-[#a3cef1] rounded-3xl p-6 animate-pulse space-y-4">
          <div className="h-6 w-1/3 bg-gray-200 rounded" />
          <div className="h-4 w-1/4 bg-gray-200 rounded" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="h-28 bg-gray-100 rounded-2xl" />
            ))}
          </div>
        </div>
        <div className="h-64 bg-white/70 border border-[#a3cef1] rounded-3xl animate-pulse" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-3 py-10">
        <Card className="border-2 border-red-200 bg-red-50">
          <CardContent className="flex flex-col items-center text-center space-y-4 py-10">
            <AlertTriangle className="h-12 w-12 text-red-500" />
            <div>
              <p className="text-lg font-semibold text-red-600">{error}</p>
              <p className="text-sm text-gray-600 mt-1">
                Please refresh the page or log in again to continue.
              </p>
            </div>
            <Button
              onClick={fetchDashboard}
              className="bg-[#274c77] hover:bg-[#1d3557] text-white"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const coordName = coordinatorInfo?.full_name || (getCurrentUser() as any)?.name || (getCurrentUser() as any)?.first_name || "Coordinator"
  const pctTone = (p: number) => (p >= 75 ? '#10B981' : p >= 50 ? '#F59E0B' : '#EF4444')
  const pendingReq = filteredRequestStats.submitted + filteredRequestStats.under_review + filteredRequestStats.in_progress + filteredRequestStats.waiting
  const classOverview = scopedAttendanceSummary?.classrooms?.length
    ? [...scopedAttendanceSummary.classrooms]
        .sort((a, b) => (b.student_count || 0) - (a.student_count || 0))
        .map((c) => ({ name: c.classroom?.name || '—', students: c.student_count ?? 0, pct: Math.round(c.average_percentage ?? 0) as number | null }))
    : filteredTopClasses.map((c) => ({ name: c.name, students: c.student_count ?? 0, pct: null as number | null }))

  return (
    <div className="space-y-5">
      {/* Welcome */}
      <section className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-[#274c77] tracking-tight">Hello {coordName}!</h1>
          <p className="text-xs text-gray-500 mt-1">Track attendance, classes, and requests across your assigned levels.</p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-[#274c77] shadow-sm">
              <Building2 className="h-3.5 w-3.5 text-[#6096ba]" /> {campusDisplay}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-[#274c77] shadow-sm">
              <GraduationCap className="h-3.5 w-3.5 text-[#6096ba]" /> {currentLevelLabel}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-[#274c77] shadow-sm">
              <Clock className="h-3.5 w-3.5 text-[#F59E0B]" /> {shiftDisplayLabel}
            </span>
          </div>
        </div>
        {((showShiftFilter && shiftOptions.length > 1) || (showLevelFilter && currentLevelOptions.length > 1)) && (
          <div className="flex flex-wrap gap-2">
            {showShiftFilter && shiftOptions.length > 1 && (
              <Select value={currentShiftValue || ""} onValueChange={(v) => setSelectedShift(v)}>
                <SelectTrigger className="h-9 w-36 bg-white border border-gray-200 text-sm"><SelectValue placeholder="Shift" /></SelectTrigger>
                <SelectContent>{shiftOptions.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}</SelectContent>
              </Select>
            )}
            {showLevelFilter && currentLevelOptions.length > 1 && (
              <Select value={selectedLevelId} onValueChange={setSelectedLevelId}>
                <SelectTrigger className="h-9 w-40 bg-white border border-gray-200 text-sm"><SelectValue placeholder="Level" /></SelectTrigger>
                <SelectContent>{currentLevelOptions.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}</SelectContent>
              </Select>
            )}
          </div>
        )}
      </section>

      {/* Hero attendance + KPI cards */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-5">
        {/* Hero Attendance */}
        <div className="xl:col-span-5 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#6096ba]">Attendance Today</p>
              <p className="text-4xl sm:text-5xl font-black text-[#274c77] mt-2 leading-none">
                {scopedAttendanceSummary?.summary.overall_percentage ?? 0}%
              </p>
              <p className="text-sm text-gray-500 mt-1.5">Overall Attendance Rate</p>
            </div>
            <div className="w-16 h-16 rounded-2xl bg-[#6096ba]/10 flex items-center justify-center flex-shrink-0">
              <ClipboardCheck className="h-8 w-8 text-[#6096ba]" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2.5 mt-5">
            <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1"><UserCheck className="h-3.5 w-3.5 text-[#10B981]" /> Present</div>
              <p className="text-xl font-bold text-[#274c77]">{formatNumber(scopedAttendanceSummary?.summary.total_present)}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1"><Users className="h-3.5 w-3.5 text-[#EF4444]" /> Absent</div>
              <p className="text-xl font-bold text-[#274c77]">{formatNumber(scopedAttendanceSummary?.summary.total_absent)}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1"><Clock className="h-3.5 w-3.5 text-[#F59E0B]" /> Late</div>
              <p className="text-xl font-bold text-[#274c77]">{formatNumber(scopedAttendanceSummary?.summary.total_late)}</p>
            </div>
          </div>
        </div>

        {/* KPI cards */}
        <div className="xl:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {overviewCards.map((card) => {
            const Icon = card.icon
            const tint = card.title === "Teachers" ? "#274c77" : card.title === "Students" ? "#6096ba" : card.title === "Classes" ? "#8B5CF6" : "#F59E0B"
            return (
              <div key={card.title} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 flex flex-col">
                <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ backgroundColor: `${tint}1A` }}>
                  <Icon className="h-5 w-5" style={{ color: tint }} />
                </div>
                <p className="text-sm font-semibold text-gray-500 mt-3">{card.title}</p>
                <p className="text-2xl sm:text-3xl font-black text-[#274c77] mt-0.5">{card.value}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{card.detail}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Attendance Pulse · Class Overview · Requests */}
      <section className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-12 gap-4 sm:gap-5">
        {/* Attendance Pulse */}
        <div className="xl:col-span-5 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="flex items-center gap-2 font-bold text-[#274c77]"><Activity className="h-5 w-5 text-[#6096ba]" /> Attendance Pulse</h3>
              {scopedAttendanceSummary?.date_range && (
                <p className="text-xs text-gray-400 mt-0.5">{formatDate(scopedAttendanceSummary.date_range.start_date)} – {formatDate(scopedAttendanceSummary.date_range.end_date)}</p>
              )}
            </div>
            <button onClick={exportAttendanceCSV} disabled={!filteredGrades.length} className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>
          {filteredGrades.length ? (
            <div className="space-y-3">
              <div className="grid grid-cols-[1fr_auto_96px] gap-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-1">
                <span>Class</span><span>Last Marked</span><span className="text-right">Attendance</span>
              </div>
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 -mr-1">
              {filteredGrades.map((entry) => (
                <div key={`${entry.grade}-${entry.shift || 'all'}`} className="grid grid-cols-[1fr_auto_96px] gap-3 items-center">
                  <p className="text-sm font-semibold text-gray-800 truncate min-w-0">{entry.grade}{entry.shift ? ` – ${normalizeShiftLabel(entry.shift)}` : ''}</p>
                  <p className="text-xs text-gray-500 whitespace-nowrap">{entry.last_attendance ? formatDate(entry.last_attendance) : '—'}</p>
                  <div>
                    <p className="text-xs font-bold text-right" style={{ color: pctTone(entry.percentage) }}>{entry.percentage}%</p>
                    <div className="h-1.5 bg-gray-100 rounded-full mt-1"><div className="h-full rounded-full" style={{ width: `${entry.percentage}%`, backgroundColor: pctTone(entry.percentage) }} /></div>
                  </div>
                </div>
              ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 py-6 text-center">Attendance analytics will appear after teachers submit records.</p>
          )}
        </div>

        {/* Class Overview */}
        <div className="xl:col-span-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="flex items-center gap-2 font-bold text-[#274c77] mb-4"><Layers className="h-5 w-5 text-[#6096ba]" /> Class Overview</h3>
          {classOverview.length ? (
            <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1 -mr-1">
              {classOverview.map((c, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="font-semibold text-gray-800 truncate pr-2">{c.name}</span>
                    <span className="text-xs text-gray-500 whitespace-nowrap">{formatNumber(c.students)} {c.students === 1 ? 'Student' : 'Students'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full"><div className="h-full rounded-full bg-[#6096ba]" style={{ width: `${c.pct ?? 0}%` }} /></div>
                    {c.pct !== null && <span className="text-xs font-bold w-9 text-right" style={{ color: pctTone(c.pct) }}>{c.pct}%</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 py-6 text-center">No class data yet.</p>
          )}
        </div>

        {/* Requests & Approvals */}
        <div className="xl:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col">
          <h3 className="flex items-center gap-2 font-bold text-[#274c77] mb-4"><ClipboardList className="h-5 w-5 text-[#6096ba]" /> Requests & Approvals</h3>
          <div className="space-y-2.5 flex-1">
            {[
              { label: 'Pending Requests', value: pendingReq, Icon: Clock, color: '#F59E0B' },
              { label: 'Approved Requests', value: filteredRequestStats.resolved, Icon: CheckCircle2, color: '#10B981' },
              { label: 'Rejected Requests', value: filteredRequestStats.rejected, Icon: XCircle, color: '#EF4444' },
            ].map(({ label, value, Icon, color }) => (
              <div key={label} className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2.5">
                <span className="flex items-center gap-2 text-sm text-gray-700"><Icon className="h-4 w-4" style={{ color }} /> {label}</span>
                <span className="flex items-center gap-2"><span className="font-bold text-[#274c77]">{formatNumber(value)}</span><ArrowRight className="h-3.5 w-3.5 text-gray-300" /></span>
              </div>
            ))}
          </div>
          <button onClick={() => router.push('/admin/coordinator/requests')} className="mt-4 w-full h-9 text-sm font-semibold text-[#274c77] bg-[#6096ba]/10 hover:bg-[#6096ba]/20 rounded-lg transition-colors">Go to Requests Desk</button>
        </div>
      </section>

      {/* Wing Performance Dashboard (own wing internals + wing vs campus) */}
      {canViewNetworkPerformanceChart && (
        <section className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-4 sm:p-6">
          <div className="mb-4">
            <h2 className="text-lg font-black text-[#274c77]">Wing Performance Dashboard</h2>
            <p className="text-xs text-gray-500">Your wing internals & comparison against the campus baseline (approved results)</p>
          </div>
          <CoordinatorNetworkDashboard />
        </section>
      )}

      {/* Quick Actions — Announcements and Recent Activities moved to the
          Notifications page, so this now stands on its own, full width. */}
      <section>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="flex items-center gap-2 font-bold text-[#274c77] mb-4"><MapPin className="h-5 w-5 text-[#6096ba]" /> Quick Actions</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Approve Attendance', Icon: ClipboardCheck, route: '/admin/coordinator/attendance-review', color: '#6096ba' },
              { label: 'Manage Students', Icon: Users, route: '/admin/coordinator/student-list', color: '#10B981' },
              { label: 'Approve Results', Icon: FileText, route: '/admin/coordinator/result-approval', color: '#8B5CF6' },
              { label: 'Teacher Directory', Icon: GraduationCap, route: '/admin/coordinator/teacher-list', color: '#F59E0B' },
              { label: 'Timetable Management', Icon: Calendar, route: '/admin/coordinator/time-table', color: '#274c77' },
              { label: 'Transfer Requests', Icon: ArrowLeftRight, route: '/admin/principals/transfers', color: '#EF4444' },
            ].map(({ label, Icon, route, color }) => (
              <button key={label} onClick={() => router.push(route)} className="rounded-xl border border-gray-100 p-4 text-left hover:shadow-md hover:border-gray-200 transition-all" style={{ backgroundColor: `${color}0D` }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: `${color}1F` }}><Icon className="h-5 w-5" style={{ color }} /></div>
                <p className="text-sm font-semibold text-gray-800 leading-tight">{label}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Attendance Marking Status · Remind */}
      {attendanceStatus && (attendanceStatus.total_classrooms > 0 || attendanceStatus.grades.length > 0) && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h3 className="flex items-center gap-2 font-bold text-[#274c77]">
                <ClipboardCheck className="h-5 w-5 text-[#6096ba]" /> Attendance Marking Status
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {attendanceStatus.date ? `For ${formatDate(attendanceStatus.date)}` : "Today"} ·{" "}
                <span className="text-[#10B981] font-semibold">{attendanceStatus.marked_count} marked</span> ·{" "}
                <span className="text-[#EF4444] font-semibold">{attendanceStatus.unmarked_count} pending</span>
                {attendanceStatus.holiday_count > 0 && (
                  <> · <span className="text-[#F59E0B] font-semibold">{attendanceStatus.holiday_count} holiday</span></>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {remindMsg && (
                <span className="text-xs font-medium text-[#274c77] bg-[#6096ba]/10 px-3 py-1.5 rounded-lg">{remindMsg}</span>
              )}
              <Button
                onClick={handleRemindAll}
                disabled={reminding || attendanceStatus.unmarked_count === 0}
                className="inline-flex items-center gap-1.5 h-9 px-4 text-sm font-semibold text-white bg-[#274c77] hover:bg-[#1d3557] rounded-lg transition-colors disabled:opacity-50"
              >
                <Bell className="h-4 w-4" /> {reminding ? "Sending…" : `Remind All (${attendanceStatus.unmarked_count})`}
              </Button>
            </div>
          </div>

          {attendanceStatus.unmarked_count > 0 ? (
            /* Scrolls after ~5 grades so a wing with many classes does not push
               the rest of the dashboard down. */
            <div className="space-y-3 max-h-[24rem] overflow-y-auto pr-1">
              {attendanceStatus.grades.map((g) => (
                <div key={`${g.grade}-${g.level || 'x'}`} className="rounded-xl border border-gray-100 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold text-[#274c77]">
                      {g.grade}{g.level ? ` · ${g.level}` : ""}
                      <span className="ml-2 text-xs font-medium text-gray-400">
                        {g.marked_count}/{g.total_classrooms} marked
                      </span>
                      {g.holiday_count > 0 && (
                        <span className="ml-2 text-xs font-semibold text-amber-500">
                          {g.holiday_count} holiday
                        </span>
                      )}
                    </p>
                    <span className="text-xs font-semibold text-[#EF4444]">
                      {g.unmarked_teachers.length} pending
                    </span>
                  </div>
                  {g.unmarked_teachers.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {g.unmarked_teachers.map((t) => (
                        <span
                          key={t.classroom_id}
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg bg-red-50 text-[#EF4444] border border-red-100"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          {t.full_name}
                          <span className="text-red-300">· {t.grade} {t.section}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-[#10B981] bg-green-50 border border-green-100 rounded-xl px-4 py-3">
              <CheckCircle2 className="h-5 w-5" /> {attendanceStatus.holiday_count > 0 ? 'All classes have attendance marked or are on holiday.' : 'All classes have attendance marked for this date.'}
            </div>
          )}
        </section>
      )}

      {userRole === "principal" && coordinators.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-[#274c77]">Campus Coordinators</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {coordinators.map((coord: any) => (
              <Card key={coord.id} className="border border-[#d7e3fc] rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-[#274c77]">{coord.full_name}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-gray-600 space-y-1">
                  <p>Campus: {coord.campus?.campus_name || coord.campus || "—"}</p>
                  <p>Level: {coord.level?.name || "—"}</p>
                  <p>Email: {coord.email || "—"}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

