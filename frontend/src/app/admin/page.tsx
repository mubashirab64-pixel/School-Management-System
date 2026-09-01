"use client"
import Link from "next/link"
import { useState, useMemo, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MultiSelectFilter } from "@/components/dashboard/multi-select-filter"
import { AccessDenied } from "@/components/AccessDenied"
import { GradeDistributionChart } from "@/components/dashboard/grade-distribution-chart"
import OrgNetworkDashboard from "@/components/dashboard/org-network-dashboard"
import PrincipalNetworkDashboard from "@/components/dashboard/principal-network-dashboard"
import ClassTeacherNetworkDashboard from "@/components/dashboard/class-teacher-network-dashboard"
import DonorNetworkDashboard from "@/components/dashboard/donor-network-dashboard"
import CampusOverviewCards from "@/components/dashboard/campus-overview-cards"
import AccountsNetworkDashboard from "@/components/dashboard/accounts-network-dashboard"
import { GenderDistributionChart } from "@/components/dashboard/gender-distribution-chart"
import { MotherTongueChart } from "@/components/dashboard/mother-tongue-chart"
import { ReligionChart } from "@/components/dashboard/religion-chart"
import { EnrollmentTrendChart } from "@/components/dashboard/enrollment-trend-chart"
import { AgeDistributionChart } from "@/components/dashboard/age-distribution-chart"
import { WeeklyAttendanceChart } from "@/components/dashboard/weekly-attendance-chart"
import { StaffAttendanceWidget } from "@/components/dashboard/staff-attendance-widget"
import { ZakatStatusChart } from "@/components/dashboard/zakat-status-chart"
import { HouseOwnershipChart } from "@/components/dashboard/house-ownership-chart"
import { ChartSlider } from "@/components/dashboard/chart-slider"
import { OrgAdminInsights } from "@/components/dashboard/org-admin-insights"
import { UserGreeting } from "@/components/dashboard/user-greeting"
import { SuperAdminDashboard } from "@/components/dashboard/SuperAdminDashboard"
import { Users, GraduationCap, UsersRound, RefreshCcw, EllipsisVertical, Globe, Building2, ChevronDown, Search, Mail, Bell, Download, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { UserProfilePopup } from "@/components/admin/user-profile-popup"
import { NotificationBell } from "@/components/admin/notification-bell"
import { Skeleton, CardSkeleton, ChartSkeleton, KpiCardSkeleton } from "@/components/ui/skeleton"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { getGradeDistribution, getGenderDistribution, getEnrollmentTrend, getMotherTongueDistribution, getReligionDistribution, getAgeDistribution } from "@/lib/chart-utils"
import type { FilterState, LegacyStudent as DashboardStudent } from "@/types/dashboard"
import { useRouter } from "next/navigation"
import { getDashboardStats, getAllStudents, getAllCampuses, apiGet, getCurrentUserProfile, getFilteredStudents, getDashboardChartData, getNewAdmissionsStats } from "@/lib/api"
import { getCurrentUserRole, getCurrentUser, usePermissions } from "@/lib/permissions"

if (typeof window !== 'undefined') {
  import('html2pdf.js').then(mod => { (window as any).html2pdf = mod.default; });
}

interface CircularProgressProps {
  percentage: number
  colorClass: string
  bgClass: string
  direction: "up" | "down"
}

function CircularProgress({ percentage, colorClass, bgClass, direction }: CircularProgressProps) {
  const radius = 24
  const strokeWidth = 5
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <div className="relative flex items-center justify-center w-16 h-16 flex-shrink-0">
      <svg className="w-full h-full transform -rotate-90">
        <circle
          cx="32"
          cy="32"
          r={radius}
          className={`${bgClass}`}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx="32"
          cy="32"
          r={radius}
          className={`${colorClass} transition-all duration-500 ease-out`}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      <span className={`absolute ${colorClass} group-hover:scale-110 transition-transform duration-300`}>
        {direction === "up" ? (
          <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
        ) : (
          <ArrowDownRight className="w-5 h-5 stroke-[2.5]" />
        )}
      </span>
    </div>
  )
}

function RecentDeletionsWidget({ userRole }: { userRole: string }) {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL!
        const token =
          localStorage.getItem('sis_access_token') ||
          localStorage.getItem('token') ||
          localStorage.getItem('access') ||
          localStorage.getItem('auth_token') || ''
        const res = await fetch(`${apiBase}/api/attendance/audit-logs/?action=delete&page_size=5`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (res.ok) {
          const data = await res.json()
          setLogs(data.results || [])
        }
      } catch { /* silent */ }
      setLoading(false)
    }
    fetchLogs()
  }, [])

  const timeAgo = (ts: string) => {
    const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
    if (m < 1) return 'Just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  }

  const canRestore = ['superadmin', 'admin', 'org_admin'].includes(userRole)

  if (!loading && logs.length === 0) return null

  return (
    <div className="mt-6 mb-2 bg-white rounded-xl border border-red-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-red-50 border-b border-red-100">
        <div className="flex items-center gap-2">
          <span className="text-lg">🗑️</span>
          <span className="font-semibold text-red-800 text-sm">Recent Deletions</span>
          {logs.length > 0 && (
            <span className="bg-red-200 text-red-800 text-xs font-bold px-2 py-0.5 rounded-full">{logs.length}</span>
          )}
        </div>
        <a href="/admin/notifications" className="text-xs text-red-600 hover:underline font-medium">View all →</a>
      </div>
      {loading ? (
        <div className="px-5 py-4 text-xs text-gray-400">Loading...</div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {logs.map((log: any) => (
            <li key={log.id} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{log.entity_name || `ID: ${log.entity_id}`}</p>
                  <p className="text-xs text-gray-400 truncate">{log.feature_display} • {log.user_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs text-gray-400 whitespace-nowrap">{timeAgo(log.timestamp)}</span>
                {canRestore && !log.is_recovered && (
                  <a
                    href="/admin/notifications"
                    className="text-xs px-2 py-1 bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100 transition-colors font-medium"
                  >
                    Restore
                  </a>
                )}
                {log.is_recovered && (
                  <span className="text-xs text-green-600 font-medium">✓ Restored</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function QuotaCard({ title, used, max, pct, icon, color }: any) {
  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : `bg-${color}-500`;
  return (
    <Card className="border-none shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 bg-gray-50 rounded-lg">{icon}</div>
          <span className={`text-sm font-bold ${pct >= 90 ? 'text-red-600' : 'text-gray-600'}`}>{pct}%</span>
        </div>
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
        <p className="text-xl font-bold text-gray-800 mt-1">{used.toLocaleString()} <span className="text-sm font-normal text-gray-400">/ {max.toLocaleString()}</span></p>
        <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full transition-all duration-1000 ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function MainDashboardPage() {
  // Get current user role and permissions
  const {
    canViewDashboard,
    canViewAdminDashboard,
    canViewTeacherDashboard,
    canViewCoordinatorDashboard,
    canViewPrincipalDashboard,
    canViewStudentDashboard,
    canViewSuperadminDashboard,
    canViewAccountsDashboard,
    canViewAdmissionsDashboard,
    canViewComplianceDashboard,
    canViewGradeDistributionChart,
    canViewGenderDistributionChart,
    canViewMotherTongueChart,
    canViewReligionChart,
    canViewEnrollmentTrendChart,
    canViewAgeDistributionChart,
    canViewWeeklyAttendanceChart,
    canViewZakatStatusChart,
    canViewHouseOwnershipChart,
    canViewNetworkPerformanceChart,
    canViewTotalStudentsKpi,
    canViewTotalTeachersKpi,
    canViewTeacherStudentRatioKpi,
    canViewAvgAttendanceKpi
  } = usePermissions();

  const permissions = usePermissions();

  const [userName, setUserName] = useState<string>("Admin")
  const [userRole, setUserRole] = useState<string>("")
  const router = useRouter();

  // Check if role-specific dashboard is allowed
  const isDashboardAllowed = useMemo(() => {
    const role = getCurrentUserRole();
    if (role === 'superadmin' || role === 'org_admin') return true;
    if (role === 'teacher') return permissions.canViewTeacherDashboard;
    if (role === 'principal') return permissions.canViewPrincipalDashboard;
    if (role === 'coordinator') return permissions.canViewCoordinatorDashboard;
    if (role === 'accounts_officer') return permissions.canViewAccountsDashboard;
    if (role === 'donor') return permissions.canViewDashboard;
    return permissions.canViewDashboard;
  }, [permissions]);

  // Redirect Accountants to fees if they land on main dashboard and it's restricted for them
  useEffect(() => {
    if (userRole === 'accounts_officer' && !isDashboardAllowed) {
      router.push('/admin/fees');
    }
  }, [userRole, isDashboardAllowed, router]);

  if (!isDashboardAllowed) {
    return <AccessDenied />;
  }

  const hasAnyChartOrKpi = canViewGradeDistributionChart ||
    canViewGenderDistributionChart ||
    canViewMotherTongueChart ||
    canViewReligionChart ||
    canViewEnrollmentTrendChart ||
    canViewAgeDistributionChart ||
    canViewWeeklyAttendanceChart ||
    canViewZakatStatusChart ||
    canViewHouseOwnershipChart ||
    canViewNetworkPerformanceChart ||
    canViewTotalStudentsKpi ||
    canViewTotalTeachersKpi ||
    canViewTeacherStudentRatioKpi ||
    canViewAvgAttendanceKpi;

  const [isClearing, setIsClearing] = useState<boolean>(false)
  const [customExportOpen, setCustomExportOpen] = useState(false)
  const [selectedSections, setSelectedSections] = useState<Record<string, boolean>>({
    greeting: false,
    kpis: false,
    gender: true,
    religion: true,
    motherTongue: true,
    enrollmentTrend: true,
    gradeDistribution: true,
    weeklyAttendance: true,
    ageDistribution: true,
    newAdmissions: true,
  })

  // Section refs for custom export
  const greetingRef = useRef<HTMLDivElement>(null)
  const kpisRef = useRef<HTMLDivElement>(null)
  const genderReligionRef = useRef<HTMLDivElement>(null)
  const motherEnrollmentRef = useRef<HTMLDivElement>(null)
  const gradeDistributionRef = useRef<HTMLDivElement>(null)
  const weeklyAgeRef = useRef<HTMLDivElement>(null)
  const zakatHouseRef = useRef<HTMLDivElement>(null)
  const genderChartRef = useRef<HTMLDivElement>(null)
  const religionChartRef = useRef<HTMLDivElement>(null)
  const motherTongueChartRef = useRef<HTMLDivElement>(null)
  const enrollmentTrendChartRef = useRef<HTMLDivElement>(null)
  const weeklyAttendanceChartRef = useRef<HTMLDivElement>(null)
  const ageDistributionChartRef = useRef<HTMLDivElement>(null)
  const zakatChartRef = useRef<HTMLDivElement>(null)
  const houseChartRef = useRef<HTMLDivElement>(null)
  const hasInitialChartsLoadedRef = useRef(false)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const userStr = window.localStorage.getItem("sis_user");
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          const role = user.role?.toLowerCase();
          setUserRole(role || "");
          
          let fullName = user.full_name || user.name || user.username || user.email || "Admin"
          if (user.first_name && user.last_name) {
            fullName = `${user.first_name} ${user.last_name}`
          } else if (user.first_name) {
            fullName = user.first_name
          }
          setUserName(fullName.trim() || "Admin")
        } catch {
          setUserRole("");
          setUserName("Admin")
        }
      }
    }
  }, []);
  function studentsToCSV(students: DashboardStudent[]) {
    if (!students.length) return '';
    const header = Object.keys(students[0] as any);
    const rows = students.map((s) => header.map((h) => JSON.stringify((s as any)[h] ?? "")).join(","));
    return [header.join(","), ...rows].join("\r\n");
  }

  function studentsToExcel(students: DashboardStudent[]) {
    return studentsToCSV(students);
  }

  function downloadFile(data: string, filename: string, type: string) {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  const [userCampus, setUserCampus] = useState<string>("");
  const [allCampuses, setAllCampuses] = useState<any[]>([]);
  const [, setPrincipalShift] = useState<string>("both");

  function handlePrintDashboard() {
    const w = window.open('', '_blank')
    if (!w) return
    const doc = w.document
    const styleNodes = Array.from(document.querySelectorAll('link[rel="stylesheet"], style')) as HTMLElement[]

    type ChartItem = { title: string; element?: HTMLElement | null; data?: any[]; kind?: string, fullWidth?: boolean }

    const normalBlocks: HTMLElement[] = []
    if (greetingRef.current) normalBlocks.push(greetingRef.current)
    if (kpisRef.current) normalBlocks.push(kpisRef.current)

    const chartBlocks: ChartItem[] = []
    chartBlocks.push({ title: 'Gender Distribution', element: genderChartRef.current, data: chartData.genderDistribution })
    chartBlocks.push({ title: 'Religion Distribution', element: religionChartRef.current, data: chartData.religionDistribution })
    chartBlocks.push({ title: 'Mother Tongue', element: motherTongueChartRef.current, data: chartData.motherTongueDistribution })
    chartBlocks.push({ title: 'Enrollment Trend', element: enrollmentTrendChartRef.current, data: (chartData.enrollmentTrend || []).map((t: any) => ({ name: String(t.name), value: t.value })) })
    chartBlocks.push({ title: 'Grade Distribution', element: gradeDistributionRef.current, data: chartData.gradeDistribution, fullWidth: true })
    chartBlocks.push({ title: 'Weekly Attendance', element: weeklyAttendanceChartRef.current, kind: 'weekly' })
    chartBlocks.push({ title: 'Age Distribution', element: ageDistributionChartRef.current, data: chartData.ageDistribution })

    doc.open()
    doc.write('<!doctype html><html><head>')
    doc.write('<meta charset="utf-8" />')
    doc.write('<title>Dashboard Report</title>')
    styleNodes.forEach((n) => doc.write(n.outerHTML))
    doc.write(`<style>
      @page { size: A4; margin: 10mm; }
      html, body { background: #ffffff !important; margin: 0; padding: 0; font-family: 'Inter', system-ui, sans-serif; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .no-print, button, [role="button"], input, select { display: none !important; }
      .print-container { width: 100%; max-width: 100%; margin: 0 auto; overflow: hidden; }
      .print-header { display:flex; justify-content:space-between; align-items:flex-start; margin-top: 15px; margin-bottom: 25px; padding:12px; border-radius:10px; color:#fff; background: linear-gradient(135deg,#274c77,#6096ba); }
      .print-title { font-size: 18px; font-weight: 800; }
      .print-meta { font-size: 11px; opacity: .9; }
      .filters-bar { margin: 8px 0 15px; display:flex; flex-wrap:wrap; gap:6px; }
      .filters-bar .tag { display:inline-block; background:#f1f5f9; border:1px solid #e2e8f0; color:#334155; padding:3px 10px; border-radius:9999px; font-size:11px; font-weight:600; }
      #print-kpis { display: grid !important; grid-template-columns: repeat(4, 1fr) !important; gap: 10px !important; flex-wrap: nowrap !important; }
      #print-kpis > div { min-width: 0 !important; flex: none !important; width: 100% !important; page-break-inside: avoid; }
      .chart-page { page-break-inside: avoid; margin-bottom: 25px; padding-top: 10px; display: flex; flex-direction: column; align-items: center; width: 100%; }
      .chart-wrapper { width: 100%; max-width: 750px; margin: 0 auto; text-align: center; page-break-inside: avoid; }
      .chart-summary { margin-top: 20px; width: 100%; max-width: 750px; margin-left: auto; margin-right: auto; page-break-inside: avoid; }
      .chart-summary .caption { font-size: 14px; font-weight: 700; color: #1e3a8a; margin-bottom: 8px; text-align: left; padding-left: 8px; border-left: 4px solid #3b82f6; }
      .chart-summary table { width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
      .chart-summary th, .chart-summary td { border-bottom: 1px solid #e2e8f0; padding: 8px 12px; font-size: 11px; }
      .chart-summary tr:last-child td { border-bottom: none; }
      .chart-summary th { background: #f8fafc; text-align: left; font-weight: 700; color: #334155; text-transform: uppercase; font-size: 10px; }
      .chart-summary tr:nth-child(even) { background-color: #f8fbff; }
    </style>`)
    doc.write('</head><body>')
    doc.write('<div class="print-container">')
    doc.write('<div class="print-header"><div><div class="print-title">Dashboard Report</div><div class="print-meta">Generated on ' + new Date().toLocaleString() + '</div></div><div class="print-meta">Newton AMS</div></div>')
    {
      const parts: string[] = []
      const push = (label: string, vals: any[]) => {
        if (Array.isArray(vals) && vals.length) parts.push(`<span class="tag">${label}: ${String(vals.join(', '))}</span>`)
      }
      push('Year', (filters.academicYears || []) as unknown as any[])
      push('Campus', (filters.campuses || []) as unknown as any[])
      push('Grade', (filters.grades || []) as unknown as any[])
      push('Gender', (filters.genders || []) as unknown as any[])
      push('Mother Tongue', (filters.motherTongues || []) as unknown as any[])
      push('Religion', (filters.religions || []) as unknown as any[])
      if (String(shiftFilter || 'all') !== 'all') parts.push(`<span class="tag">Shift: ${String(shiftFilter)}</span>`)
      if (parts.length) doc.write('<div class="filters-bar">' + parts.join(' ') + '</div>')
    }
    normalBlocks.forEach((el) => doc.write(el.outerHTML))

    function buildSummaryHTML(item: ChartItem): string {
      if (item.kind === 'weekly') {
        const rows = (weeklyAttendanceData || []).map((d: any) => `<tr><td>${d.day}</td><td style="text-align:center;">${Number(d.present ?? 0)}</td><td style="text-align:center;">${Number(d.absent ?? 0)}</td></tr>`).join('')
        return `<div class="chart-summary"><div class="caption">Weekly Attendance Summary</div><table><thead><tr><th>Day</th><th style="text-align:center;">Present</th><th style="text-align:center;">Absent</th></tr></thead><tbody>${rows || '<tr><td colspan=3 style="text-align:center;">No data</td></tr>'}</tbody></table></div>`
      }
      let data = Array.isArray(item.data) ? [...item.data] : []
      if (data.length === 0) return ''

      const total = data.reduce((acc: number, it: any) => acc + Number(it.value ?? it.count ?? it.present ?? 0), 0)

      // Sort data descending
      data.sort((a, b) => {
        const valA = Number(a.value ?? a.count ?? a.present ?? 0)
        const valB = Number(b.value ?? b.count ?? b.present ?? 0)
        return valB - valA
      })

      // Limit Mother Tongue to top 7
      if (item.title === 'Mother Tongue') {
        data = data.slice(0, 7)
      }

      const rows = data.map((it: any) => {
        const label = String(it.name ?? it.label ?? it.category ?? it.group ?? it.ageGroup ?? it.status ?? '-')
        const val = Number(it.value ?? it.count ?? it.present ?? 0)
        const pct = total > 0 ? Math.round((val / total) * 100) : 0
        return `<tr><td>${label}</td><td style="text-align:center;">${val}</td><td style="text-align:center;">${pct}%</td></tr>`
      }).join('')
      return `<div class="chart-summary"><div class="caption">${item.title} - Details</div><table><thead><tr><th>Category</th><th style="text-align:center;">Count</th><th style="text-align:center;">%</th></tr></thead><tbody>${rows}</tbody></table></div>`
    }

    if (chartBlocks.length > 0) {
      chartBlocks.forEach((item) => {
        if (!item.element) return
        doc.write('<div class="chart-page">')
        doc.write('<div class="chart-wrapper">')
        doc.write(item.element.outerHTML)
        doc.write('</div>')
        doc.write('<div class="chart-summary">')
        doc.write(buildSummaryHTML(item))
        doc.write('</div>')
        doc.write('</div>')
      })
    }

    doc.write('</div>')
    doc.write('<script>setTimeout(function(){window.print();}, 300);</script>')
    doc.write('</body></html>')
    doc.close()
    setTimeout(() => { w?.focus() }, 100)
  }

  // Build custom export HTML from selected refs
  function handleCustomExport() {
    const w = window.open('', '_blank')
    if (!w) return
    const doc = w.document
    const styleNodes = Array.from(document.querySelectorAll('link[rel="stylesheet"], style')) as HTMLElement[]

    const normalBlocks: HTMLElement[] = []
    if (selectedSections.greeting && greetingRef.current) normalBlocks.push(greetingRef.current)
    if (selectedSections.kpis && kpisRef.current) normalBlocks.push(kpisRef.current)

    type ChartItem = { title: string; element?: HTMLElement | null; data?: any[]; kind?: string, fullWidth?: boolean }
    const chartBlocks: ChartItem[] = []
    if (selectedSections.gender) chartBlocks.push({ title: 'Gender Distribution', element: genderChartRef.current, data: chartData.genderDistribution })
    if (selectedSections.religion) chartBlocks.push({ title: 'Religion Distribution', element: religionChartRef.current, data: chartData.religionDistribution })
    if (selectedSections.motherTongue) chartBlocks.push({ title: 'Mother Tongue', element: motherTongueChartRef.current, data: chartData.motherTongueDistribution })
    if (selectedSections.enrollmentTrend) chartBlocks.push({ title: 'Enrollment Trend', element: enrollmentTrendChartRef.current, data: (chartData.enrollmentTrend || []).map((t: any) => ({ name: String(t.name), value: t.value })) })
    if (selectedSections.gradeDistribution) chartBlocks.push({ title: 'Grade Distribution', element: gradeDistributionRef.current, data: chartData.gradeDistribution, fullWidth: true })
    if (selectedSections.weeklyAttendance) chartBlocks.push({ title: 'Weekly Attendance', element: weeklyAttendanceChartRef.current, kind: 'weekly' })
    if (selectedSections.ageDistribution) chartBlocks.push({ title: 'Age Distribution', element: ageDistributionChartRef.current, data: chartData.ageDistribution })
    if (selectedSections.zakatStatus) chartBlocks.push({ title: 'Zakat Status Distribution', element: zakatChartRef.current, data: chartData.zakatStatus })
    if (selectedSections.houseOwnership) chartBlocks.push({ title: 'House Ownership Distribution', element: houseChartRef.current, data: chartData.houseOwnership })

    doc.open()
    doc.write('<!doctype html><html><head>')
    doc.write('<meta charset="utf-8" />')
    doc.write('<title>Custom Dashboard Report</title>')
    styleNodes.forEach((n) => doc.write(n.outerHTML))
    doc.write(`<style>
      @page { size: A4; margin: 10mm; }
      html, body { background: #ffffff !important; margin: 0; padding: 0; font-family: 'Inter', system-ui, sans-serif; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .no-print, button, [role="button"], input, select { display: none !important; }
      .print-container { width: 100%; max-width: 100%; margin: 0 auto; overflow: hidden; }
      .print-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px; padding:12px; border-radius:10px; color:#fff; background: linear-gradient(135deg,#274c77,#6096ba); }
      .print-title { font-size: 18px; font-weight: 800; }
      .print-meta { font-size: 11px; opacity: .9; }
      .filters-bar { margin: 8px 0 15px; display:flex; flex-wrap:wrap; gap:6px; }
      .filters-bar .tag { display:inline-block; background:#f1f5f9; border:1px solid #e2e8f0; color:#334155; padding:3px 10px; border-radius:9999px; font-size:11px; font-weight:600; }
      #print-kpis { display: grid !important; grid-template-columns: repeat(4, 1fr) !important; gap: 10px !important; flex-wrap: nowrap !important; }
      #print-kpis > div { min-width: 0 !important; flex: none !important; width: 100% !important; page-break-inside: avoid; }
      .chart-page { page-break-inside: avoid; margin-bottom: 25px; padding-top: 10px; display: flex; flex-direction: column; align-items: center; width: 100%; }
      .chart-wrapper { width: 100%; max-width: 750px; margin: 0 auto; text-align: center; page-break-inside: avoid; }
      .chart-summary { margin-top: 20px; width: 100%; max-width: 750px; margin-left: auto; margin-right: auto; }
      .chart-summary .caption { font-size: 14px; font-weight: 700; color: #1e3a8a; margin-bottom: 8px; text-align: left; padding-left: 8px; border-left: 4px solid #3b82f6; }
      .chart-summary table { width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
      .chart-summary th, .chart-summary td { border-bottom: 1px solid #e2e8f0; padding: 8px 12px; font-size: 11px; }
      .chart-summary tr:last-child td { border-bottom: none; }
      .chart-summary th { background: #f8fafc; text-align: left; font-weight: 700; color: #334155; text-transform: uppercase; font-size: 10px; }
      .chart-summary tr:nth-child(even) { background-color: #f8fbff; }
    </style>`)
    doc.write('</head><body>')
    doc.write('<div class="print-container">')
    doc.write('<div class="print-header"><div><div class="print-title">Custom Dashboard Report</div><div class="print-meta">Generated on ' + new Date().toLocaleString() + '</div></div><div class="print-meta">Newton AMS</div></div>')
    {
      const parts2: string[] = []
      const push2 = (label: string, vals: any[]) => {
        if (Array.isArray(vals) && vals.length) parts2.push(`<span class="tag">${label}: ${String(vals.join(', '))}</span>`)
      }
      push2('Year', (filters.academicYears || []) as unknown as any[])
      push2('Campus', (filters.campuses || []) as unknown as any[])
      push2('Grade', (filters.grades || []) as unknown as any[])
      push2('Gender', (filters.genders || []) as unknown as any[])
      push2('Mother Tongue', (filters.motherTongues || []) as unknown as any[])
      push2('Religion', (filters.religions || []) as unknown as any[])
      if (String(shiftFilter || 'all') !== 'all') parts2.push(`<span class="tag">Shift: ${String(shiftFilter)}</span>`)
      if (parts2.length) doc.write('<div class="filters-bar">' + parts2.join(' ') + '</div>')
    }
    normalBlocks.forEach((el) => doc.write(el.outerHTML))
    // helper to build generic summary tables
    function buildSummaryHTML(item: ChartItem): string {
      if (item.kind === 'weekly') {
        const rows = (weeklyAttendanceData || []).map((d: any) => `<tr><td>${d.day}</td><td style="text-align:center;">${Number(d.present ?? 0)}</td><td style="text-align:center;">${Number(d.absent ?? 0)}</td></tr>`).join('')
        return `<div class="chart-summary"><div class="caption">Weekly Attendance Summary</div><table><thead><tr><th>Day</th><th style="text-align:center;">Present</th><th style="text-align:center;">Absent</th></tr></thead><tbody>${rows || '<tr><td colspan=3 style="text-align:center;">No data</td></tr>'}</tbody></table></div>`
      }
      let data = Array.isArray(item.data) ? [...item.data] : []
      if (data.length === 0) return ''

      const total = data.reduce((acc: number, it: any) => acc + Number(it.value ?? it.count ?? it.present ?? 0), 0)

      // Sort data descending
      data.sort((a, b) => {
        const valA = Number(a.value ?? a.count ?? a.present ?? 0)
        const valB = Number(b.value ?? b.count ?? b.present ?? 0)
        return valB - valA
      })

      // Limit Mother Tongue to top 7
      if (item.title === 'Mother Tongue') {
        data = data.slice(0, 7)
      }

      const rows = data.map((it: any) => {
        const label = String(it.name ?? it.label ?? it.category ?? it.group ?? it.ageGroup ?? it.status ?? '-')
        const val = Number(it.value ?? it.count ?? it.present ?? 0)
        const pct = total > 0 ? Math.round((val / total) * 100) : 0
        return `<tr><td>${label}</td><td style="text-align:center;">${val}</td><td style="text-align:center;">${pct}%</td></tr>`
      }).join('')
      return `<div class="chart-summary"><div class="caption">${item.title} - Details</div><table><thead><tr><th>Category</th><th style="text-align:center;">Count</th><th style="text-align:center;">%</th></tr></thead><tbody>${rows}</tbody></table></div>`
    }

    if (chartBlocks.length > 0) {
      chartBlocks.forEach((item) => {
        if (!item.element) return
        doc.write('<div class="chart-page">')
        doc.write('<div class="chart-wrapper">')
        doc.write(item.element.outerHTML)
        doc.write('</div>')
        doc.write('<div class="chart-summary">')
        doc.write(buildSummaryHTML(item))
        doc.write('</div>')
        doc.write('</div>')
      })
    }
    doc.write('</div>')
    doc.write('<script>setTimeout(function(){window.print();}, 300);</script>')
    doc.write('</body></html>')
    doc.close()
    setTimeout(() => { w?.focus() }, 100)
    setCustomExportOpen(false)
  }
  // Global sync for permissions and role-based initialization
  useEffect(() => {
    const syncUser = async () => {
      if (typeof window === "undefined") return;

      try {
        const profileResponse = await getCurrentUserProfile() as any;
        if (profileResponse) {
          // Update local storage to ensure permission hooks have latest data
          window.localStorage.setItem('sis_user', JSON.stringify(profileResponse));

          const role = profileResponse.role?.toLowerCase() || "";
          setUserRole(role);

          if (role === "teacher") {
            router.replace("/admin/teachers/stats");
          }
          

          if (role === "principal") {
            if (profileResponse.shift) setPrincipalShift(String(profileResponse.shift));
            if (profileResponse.campus?.campus_name) {
              setUserCampus(profileResponse.campus.campus_name);
            } else if (profileResponse.campus) {
              setUserCampus(profileResponse.campus);
            }
          }
        }
      } catch (errSync) {
        console.error("Sync error:", errSync);
        // Fallback for role initialization
        const roleStatic = getCurrentUserRole();
        setUserRole(roleStatic);
      }
    };

    syncUser();
  }, [router]);
  const [filters, setFilters] = useState<FilterState>({
    academicYears: [],
    campuses: [],
    grades: [],
    genders: [],
    motherTongues: [],
    religions: [],
  })
  const [students, setStudents] = useState<DashboardStudent[]>([])
  const [loading, setLoading] = useState(false) // Start with false to show UI immediately
  const [showLoader, setShowLoader] = useState(false) // Don't show full loader initially
  const [, setPrincipalCampusId] = useState<number | null>(null)
  const [, setCacheTimestamp] = useState<number>(0)
  const [totalStudentsCount, setTotalStudentsCount] = useState<number>(0)
  const [teachersCount, setTeachersCount] = useState<number>(0)
  const [newAdmissionsCount, setNewAdmissionsCount] = useState<number>(0)
  const [alumniCount, setAlumniCount] = useState<number>(0)
  const [noClassroomCount, setNoClassroomCount] = useState<number>(0)
  const [campusCount, setCampusCount] = useState<number>(0)
  const [teachers, setTeachers] = useState<any[]>([])
  const [attendancePeriod, setAttendancePeriod] = useState<'weekly' | 'monthly' | '3month' | '6month'>('weekly')
  const [weeklyAttendanceData, setWeeklyAttendanceData] = useState<any[]>([]) // Weekly attendance data
  const [, setIsRefreshing] = useState<boolean>(false) // Refresh state
  const [shiftFilter, setShiftFilter] = useState<string>("all");
  const [dashboardView, setDashboardView] = useState<'full' | 'partial'>('full');

  const [orgQuota, setOrgQuota] = useState<any>(null)

  // Fetch Org Quota for Org Admins
  // Total campuses count for the org-admin / superadmin KPI card
  useEffect(() => {
    if (!['org_admin', 'superadmin'].includes(userRole)) return
    let mounted = true
    getAllCampuses()
      .then((c: any) => {
        const arr = Array.isArray(c) ? c : (c?.results || [])
        if (mounted) setCampusCount(arr.length)
      })
      .catch(() => {})
    return () => { mounted = false }
  }, [userRole])

  useEffect(() => {
    async function fetchOrgQuota() {
      if (userRole === 'org_admin' || userRole === 'principal') {
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/organizations/my-dashboard/`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('sis_access_token')}`,
              'Content-Type': 'application/json'
            }
          });
          if (res.ok) {
            const data = await res.json();
            setOrgQuota(data);
          }
        } catch (err) {
          console.error("Error fetching org quota:", err);
        }
      }
    }
    fetchOrgQuota();
  }, [userRole]);

  // Progressive loading states for different sections
  const [kpisLoading, setKpisLoading] = useState(true)
  const [chartsLoading, setChartsLoading] = useState(true)
  const [filtersLoading, setFiltersLoading] = useState(true)

  // State for API chart data (optimized endpoints)
  const [apiChartData, setApiChartData] = useState<any>(null)
  // Stable grade list — populated once on first load, not affected by grade filter
  const [allGradesOptions, setAllGradesOptions] = useState<string[]>([])

  useEffect(() => {
    // Dynamic title based on user role
    if (userRole === 'principal' && userCampus) {
      document.title = `${userCampus} Dashboard | Newton AMS`
    } else if (userRole === 'superadmin') {
      document.title = "Super Admin Dashboard | Newton AMS"
    } else {
      document.title = "Dashboard | Newton AMS"
    }
    let loaderTimeout: NodeJS.Timeout;

    async function fetchData() {
      if (!userRole) return;

      // Check cache first to prevent reload flashing
      const cacheKey = `dashboard_v3_${userRole}_${userCampus || 'all'}_${shiftFilter}_${attendancePeriod}`;
      const cached = localStorage.getItem(cacheKey);
      const cachedTime = localStorage.getItem(cacheKey + '_time');

      // Cache valid for 5 minutes
      if (cached && cachedTime && (Date.now() - Number(cachedTime) < 5 * 60 * 1000)) {
        try {
          const data = JSON.parse(cached);
          setTotalStudentsCount(data.totalStudentsCount);
          setTeachersCount(data.teachersCount);
          setNewAdmissionsCount(data.newAdmissionsCount || 0);
          setAlumniCount(data.alumniCount || 0);
          setNoClassroomCount(data.noClassroomCount || 0);
          setWeeklyAttendanceData(data.weeklyAttendanceData);
          setApiChartData(data.apiChartData);
          setAllCampuses(data.allCampuses);
          setStudents(data.students);
          setAllGradesOptions(prev => {
            if (prev.length > 0) return prev
            const gradeOrder = ["Special Class","Nursery","KG-I","KG-II","Grade I","Grade II","Grade III","Grade IV","Grade V","Grade VI","Grade VII","Grade VIII","Grade IX","Grade X","Unknown Grade"]
            const raw = Array.from(new Set((data.apiChartData?.gradeDistribution || []).map((g: any) => (g.name || '').toString().trim()))).filter(Boolean) as string[]
            return [...raw].sort((a, b) => { const ia = gradeOrder.indexOf(a); const ib = gradeOrder.indexOf(b); return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) })
          })

          setKpisLoading(false);
          setChartsLoading(false);
          setFiltersLoading(false);
          return;
        } catch (e) {
          console.error("Cache error", e);
          localStorage.removeItem(cacheKey);
        }
      }

      try {
        // Set all loading states at once
        setKpisLoading(true)
        setChartsLoading(true)
        setFiltersLoading(true)

        // OPTIMIZED: Fetch ALL data in parallel (KPIs, charts, filters) - Single load!
        const [kpiAndChartData, filterData] = await Promise.all([
          // Combined KPI + Chart data fetch
          (async () => {
            // For principals, we need campus-filtered count, for superadmin use total stats
            const countPromise = userRole === 'principal' && userCampus
              ? (async () => {
                try {
                  const campuses = await getAllCampuses().catch(() => [])
                  const campusArray = Array.isArray(campuses) ? campuses : (Array.isArray((campuses as any)?.results) ? (campuses as any).results : [])
                  const principalCampus = campusArray.find((c: any) => {
                    if (!c) return false;
                    return c.campus_name === userCampus ||
                      c.name === userCampus ||
                      c.campus_code === userCampus ||
                      String(c.id) === String(userCampus);
                  })

                  if (principalCampus) {
                    const countResp: any = await getFilteredStudents({
                      page: 1,
                      page_size: 1,
                      current_state: 'active',
                      campus: Number(principalCampus.id),
                      shift: shiftFilter !== 'all' ? shiftFilter : undefined
                    })
                    return countResp?.count || 0
                  }
                  return 0
                } catch {
                  return 0
                }
              })()
              : getDashboardStats().then(stats => stats.totalStudents || 0).catch(() => 0)

            const chartParams: any = {
              enrollment_year: filters.academicYears,
              campus: userRole === 'principal' && userCampus ? undefined : campusFilterIds,
              current_grade: filters.grades,
              gender: (filters.genders || []).map((g: any) => String(g).toLowerCase()),
              shift: shiftFilter !== 'all' ? shiftFilter : undefined,
            }

            // Fetch KPIs and Charts in parallel
            const [studentsCount, teachersCount, attendanceResponse, chartDataResponse, admissionsCount, alumniCountData, noClassroomCountData] = await Promise.all([
              countPromise,
              (async () => {
                try {
                  const campusIds = userRole === 'principal' && userCampus ? undefined : campusFilterIds
                  const qp = new URLSearchParams()
                  if (shiftFilter && shiftFilter !== 'all') qp.append('shift', shiftFilter)
                  if (campusIds && campusIds.length > 0) qp.append('current_campus', campusIds.join(','))
                  if (filters.genders && filters.genders.length > 0) qp.append('gender', String(filters.genders[0]).toLowerCase())
                  const q = qp.toString() ? `?${qp.toString()}` : ''
                  const response: any = await apiGet(`/api/teachers/total/${q}`)
                  return response?.totalTeachers ?? 0
                } catch {
                  return 0
                }
              })(),
              (async () => {
                try {
                  const daysMap: Record<string, number> = { weekly: 7, monthly: 30, '3month': 90, '6month': 180 }
                  const days = daysMap[attendancePeriod] ?? 30
                  const params = new URLSearchParams({ days: String(days) })
                  if (campusFilterIds && campusFilterIds.length > 0)
                    params.append('campus', String(campusFilterIds[0]))
                  const timeout = new Promise<[]>((resolve) => setTimeout(() => resolve([]), 10000))
                  const resp: any = await Promise.race([
                    apiGet(`/api/attendance/?${params.toString()}`),
                    timeout
                  ])
                  return Array.isArray(resp) ? resp : []
                } catch {
                  return []
                }
              })(),
              getDashboardChartData(chartParams).catch((error) => {
                console.error('Error fetching chart data:', error)
                return {
                  gradeDistribution: [],
                  genderDistribution: [],
                  enrollmentTrend: [],
                  motherTongueDistribution: [],
                  religionDistribution: [],
                  campusPerformance: [],
                  ageDistribution: [],
                  zakatStatus: [],
                  houseOwnership: []
                }
              }),
              // New admissions since April 1 (campus-scoped via backend role filtering)
              (async () => {
                try {
                  const aprilStart = `${new Date().getFullYear()}-04-01`;
                  const qp = new URLSearchParams({ created_after: aprilStart })
                  // Pass single grade only (StudentFilter supports one value at a time)
                  if (filters.grades && filters.grades.length === 1) qp.append('current_grade', filters.grades[0])
                  const res: any = await apiGet(`/api/students/total/?${qp.toString()}`);
                  return res?.totalStudents || 0;
                } catch {
                  return 0;
                }
              })(),
              // Alumni count
              (async () => {
                try {
                  const res: any = await apiGet(`/api/students/?current_grade=Alumni&page_size=1`);
                  return res?.count || 0;
                } catch {
                  return 0;
                }
              })(),
              // No-classroom count
              (async () => {
                try {
                  const res: any = await apiGet(`/api/students/?classroom__isnull=true&page_size=1`);
                  return res?.count || 0;
                } catch {
                  return 0;
                }
              })()
            ])

            return { studentsCount, teachersCount, attendanceResponse, chartDataResponse, admissionsCount, alumniCountData, noClassroomCountData }
          })(),

          // Filter data fetch
          (async () => {
            const [campuses, filterStudentsResponse] = await Promise.all([
              getAllCampuses().catch(() => []),
              getFilteredStudents({
                page: 1,
                page_size: 100,
                current_state: 'active'
              }).catch(() => ({ results: [], count: 0, next: null, previous: null }))
            ])
            return { campuses, filterStudentsResponse }
          })()
        ])

        // Process all data
        const { studentsCount, teachersCount, attendanceResponse, chartDataResponse, admissionsCount, alumniCountData, noClassroomCountData } = kpiAndChartData as any
        const { campuses, filterStudentsResponse } = filterData

        // Process attendance data based on selected period
        const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        let weeklyData: any[] = []

        if (Array.isArray(attendanceResponse) && attendanceResponse.length > 0) {
          if (attendancePeriod === '3month' || attendancePeriod === '6month') {
            // Aggregate by month
            const monthMap: Record<string, { day: string; present: number; absent: number; total: number; order: number }> = {}
            attendanceResponse.forEach((record: any) => {
              const d = new Date(record.date)
              const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
              const label = `${d.toLocaleString('default', { month: 'short' })} '${String(d.getFullYear()).slice(2)}`
              if (!monthMap[key]) monthMap[key] = { day: label, present: 0, absent: 0, total: 0, order: d.getFullYear() * 100 + d.getMonth() }
              monthMap[key].present += record.present_count || 0
              monthMap[key].absent += record.absent_count || 0
              monthMap[key].total += record.total_students || (record.present_count + record.absent_count) || 0
            })
            weeklyData = Object.values(monthMap)
              .sort((a, b) => a.order - b.order)
              .map(m => ({
                ...m,
                percentage: studentsCount > 0
                  ? Number(((m.present / studentsCount) * 100).toFixed(1))
                  : 0
              }))
          } else {
            // Day-by-day (weekly = 7 days, monthly = 30 days)
            const daysToProcess = attendancePeriod === 'weekly' ? 7 : 30
            const targetDays = Array.from({ length: daysToProcess }, (_, i) => {
              const d = new Date()
              d.setDate(d.getDate() - (daysToProcess - 1 - i))
              return d
            })
            let attendanceData = targetDays.map((date) => {
              const dayName = attendancePeriod === 'weekly'
                ? daysOfWeek[date.getDay() === 0 ? 6 : date.getDay() - 1]
                : `${date.getDate()} ${date.toLocaleString('default', { month: 'short' })}`
              const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
              const dayRecords = attendanceResponse.filter((record: any) =>
                record.date === dateStr || record.date?.startsWith(dateStr)
              )
              let present = 0, absent = 0, total = 0
              dayRecords.forEach((record: any) => {
                if (record.present_count) present += record.present_count
                if (record.absent_count) absent += record.absent_count
                if (record.total_students) total += record.total_students
              })
              // Fallback to present+absent if total_students is missing or smaller
              const denominator = Math.max(total, present + absent)

              return {
                day: dayName,
                present,
                absent,
                percentage: studentsCount > 0
                  ? Number(((present / studentsCount) * 100).toFixed(1))
                  : 0
              }
            })
            if (attendancePeriod === 'weekly') {
              attendanceData = attendanceData.filter((item: any) => item.day !== 'Sun')
            }
            weeklyData = attendanceData
          }
        } else {
          const weekDaysWithoutSunday = daysOfWeek.filter(day => day !== 'Sun')
          weeklyData = weekDaysWithoutSunday.map(day => ({ day, present: 0, absent: 0 }))
        }

        // Transform chart data
        const transformedChartData = {
          gradeDistribution: (chartDataResponse.gradeDistribution || []).map((item: any) => ({
            name: item.name || item.grade,
            value: item.value || item.count || 0
          })),
          genderDistribution: chartDataResponse.genderDistribution || [],
          enrollmentTrend: (chartDataResponse.enrollmentTrend || []).map((item: any) => {
            const year = item.year || item.name
            const value = item.enrollment || item.value || item.count || 0
            return {
              name: String(year || ''),
              value: Number(value)
            }
          }),
          motherTongueDistribution: chartDataResponse.motherTongueDistribution || [],
          religionDistribution: chartDataResponse.religionDistribution || [],
          ageDistribution: (chartDataResponse.ageDistribution || []).map((item: any) => {
            const m = Number(item.male || 0)
            const f = Number(item.female || 0)
            const age = item.age ?? item.name?.replace("Age ", "")
            return {
              name: String(item.name || `Age ${age}`),
              age: age,
              male: m,
              female: f,
              value: m + f
            }
          }),
          zakatStatus: (chartDataResponse.zakatStatus || []).map((item: any) => ({
            name: item.name || item.status || 'Unknown',
            value: item.value || item.count || 0
          })),
          houseOwnership: (chartDataResponse.houseOwnership || []).map((item: any) => ({
            name: item.name || item.status || 'Unknown',
            value: item.value || item.count || 0
          }))
        }

        // Process filter data
        const studentsArray = filterStudentsResponse.results || []
        const campusArray = Array.isArray(campuses) ? campuses : (Array.isArray((campuses as any)?.results) ? (campuses as any).results : [])

        const idToCampusCode = new Map<string, string>(
          campusArray.map((c: any) => [String(c.id), String(c.campus_code || c.code || '')])
        )

        const mapped: DashboardStudent[] = studentsArray.map((item: any, idx: number) => {
          const createdAt = typeof item?.created_at === "string" ? item.created_at : ""
          const year = createdAt ? Number(createdAt.split("-")[0]) : new Date().getFullYear()
          const genderRaw = (item?.gender ?? "").toString().trim()
          const campusCode = (() => {
            const raw = item?.campus
            if (raw && typeof raw === 'object') return String(raw?.campus_code || raw?.code || 'Unknown').trim()
            if (typeof raw === 'number' || typeof raw === 'string') {
              const hit = idToCampusCode.get(String(raw))
              if (hit) return hit
            }
            return 'Unknown'
          })()
          const gradeName = (item?.current_grade ?? "Unknown").toString().trim()
          const motherTongue = (item?.mother_tongue ?? "Other").toString().trim()
          const religion = (item?.religion ?? "Other").toString().trim()
          return {
            rawData: item,
            studentId: String(item?.gr_no || item?.id || idx + 1),
            name: item?.name || "Unknown",
            academicYear: isNaN(year) ? new Date().getFullYear() : year,
            campus: campusCode,
            grade: gradeName,
            current_grade: gradeName,
            gender: genderRaw || "Unknown",
            motherTongue: motherTongue,
            religion: religion,
            attendancePercentage: 0,
            averageScore: 0,
            retentionFlag: (item?.current_state || "").toLowerCase() === "active",
            enrollmentDate: createdAt ? new Date(createdAt) : new Date(),
          }
        })

        // Calculate derived total from chart data
        const derivedTotal = (transformedChartData.genderDistribution || []).reduce((sum: number, item: any) => sum + Number(item.value || 0), 0)
        const finalStudentCount = derivedTotal >= 0 ? derivedTotal : studentsCount

        // BATCH ALL STATE UPDATES TOGETHER - Single re-render!
        setTotalStudentsCount(finalStudentCount)
        setTeachersCount(teachersCount)
        setNewAdmissionsCount(admissionsCount || 0)
        // Populate stable grade list once (only when no grade filter is active)
        setAllGradesOptions(prev => {
          if (prev.length > 0) return prev
          const gradeOrder = ["Special Class","Nursery","KG-I","KG-II","Grade I","Grade II","Grade III","Grade IV","Grade V","Grade VI","Grade VII","Grade VIII","Grade IX","Grade X","Unknown Grade"]
          const raw = Array.from(new Set((transformedChartData.gradeDistribution || []).map((g: any) => (g.name || '').toString().trim()))).filter(Boolean) as string[]
          return [...raw].sort((a, b) => { const ia = gradeOrder.indexOf(a); const ib = gradeOrder.indexOf(b); return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) })
        })
        setAlumniCount(alumniCountData || 0)
        setNoClassroomCount(noClassroomCountData || 0)
        setWeeklyAttendanceData(weeklyData)
        setApiChartData(transformedChartData)
        setAllCampuses(campusArray)
        setStudents(mapped)

        // Save to cache
        try {
          localStorage.setItem(cacheKey, JSON.stringify({
            totalStudentsCount: finalStudentCount,
            teachersCount,
            newAdmissionsCount: admissionsCount || 0,
            alumniCount: alumniCountData || 0,
            noClassroomCount: noClassroomCountData || 0,
            weeklyAttendanceData: weeklyData,
            apiChartData: transformedChartData,
            allCampuses: campusArray,
            students: mapped
          }));
          localStorage.setItem(cacheKey + '_time', Date.now().toString());
        } catch (e) { console.error("Cache save error", e); }

        // Turn off all loading states together
        setKpisLoading(false)
        setChartsLoading(false)
        setFiltersLoading(false)
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
        setKpisLoading(false)
        setChartsLoading(false)
        setFiltersLoading(false)
      }
    }

    // Only fetch if userRole is set
    if (userRole) {
      fetchData()
    }
  }, [userRole, userCampus, shiftFilter, attendancePeriod])

  // Map selected campus labels (e.g., "Campus 6" or "C06") to backend IDs
  // so that Django's ModelChoiceFilter(campus=...) receives valid PK values.
  const campusFilterIds = useMemo(() => {
    if (!filters.campuses.length || !allCampuses.length) return undefined

    const labelToId = new Map<string, number>()
    allCampuses.forEach((c: any) => {
      const label = (c.campus_name || c.name || c.campus_code || c.code || '').toString().trim()
      if (label) {
        labelToId.set(label, Number(c.id))
      }
    })

    const ids = filters.campuses
      .map((label) => labelToId.get(String(label)))
      .filter((v): v is number => v !== undefined)

    return ids.length ? ids : undefined
  }, [filters.campuses, allCampuses])

  // Refetch weekly attendance when campus filter or shift changes
  useEffect(() => {
    if (!userRole) return
    let cancelled = false

    async function fetchWeeklyAttendance() {
      try {
        const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        const campusIdParam =
          campusFilterIds && campusFilterIds.length > 0
            ? `?campus=${encodeURIComponent(String(campusFilterIds[0]))}`
            : ''

        const attendanceResponse: any = await apiGet(`/api/attendance/${campusIdParam}`).catch(() => [])

        if (cancelled) return

        if (attendanceResponse && Array.isArray(attendanceResponse)) {
          // Get total students for this specific context (campus/shift)
          // to ensure percentage is relative to total enrollment
          const campusId = campusFilterIds && campusFilterIds.length > 0 ? campusFilterIds[0] : undefined;
          const totalStudentsResp: any = await apiGet(`/api/students/total/?current_state=active${campusId ? `&campus=${campusId}` : ''}${shiftFilter !== 'all' ? `&shift=${shiftFilter}` : ''}`).catch(() => ({ totalStudents: 0 }));
          const currentTotalStudents = totalStudentsResp?.totalStudents || 0;

          const last7Days = Array.from({ length: 7 }, (_, i) => {
            const date = new Date()
            date.setDate(date.getDate() - (6 - i))
            return date
          })

          const weekData = last7Days.map((date) => {
            const dayName = daysOfWeek[date.getDay() === 0 ? 6 : date.getDay() - 1]
            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
            const dayRecords = attendanceResponse.filter((record: any) =>
              record.date === dateStr || record.date?.startsWith(dateStr)
            )

            let present = 0
            let absent = 0
            let total = 0
            dayRecords.forEach((record: any) => {
              if (record.present_count) present += record.present_count
              if (record.absent_count) absent += record.absent_count
              if (record.total_students) total += record.total_students
            })

            const denominator = Math.max(currentTotalStudents, total, present + absent);

            return {
              day: dayName,
              present,
              absent,
              totalStudentsInRecords: total,
              percentage: denominator > 0
                ? Number(((present / denominator) * 100).toFixed(1))
                : 0
            }
          })

          const filteredWeekData = weekData.filter((item: any) => item.day !== 'Sun')
          setWeeklyAttendanceData(filteredWeekData)
        } else {
          const weekDaysWithoutSunday = daysOfWeek.filter(day => day !== 'Sun')
          setWeeklyAttendanceData(weekDaysWithoutSunday.map(day => ({ day, present: 0, absent: 0 })))
        }
      } catch (e) {
        console.error('Error fetching weekly attendance for campus filter:', e)
      }
    }

    fetchWeeklyAttendance()
    return () => { cancelled = true }
  }, [campusFilterIds, shiftFilter, userRole])

  // Refetch charts when filters change (so charts always reflect selected filters)
  useEffect(() => {
    let cancelled = false
    async function refetchChartsForFilters() {
      // Skip until role known
      if (!userRole) return
      // On very first load, main fetchData already fetched charts,
      // so we just mark as loaded and skip this effect once to avoid
      // double-loading and duplicate chart flashes.
      if (!hasInitialChartsLoadedRef.current) {
        hasInitialChartsLoadedRef.current = true
        return
      }
      setChartsLoading(true)
      try {
        const chartParams: any = {
          enrollment_year: filters.academicYears,
          campus: userRole === 'principal' && userCampus ? undefined : campusFilterIds,
          current_grade: filters.grades,
          gender: (filters.genders || []).map((g: any) => String(g).toLowerCase()),
          // mother_tongue: filters.motherTongues, // disabled
          // religion: filters.religions, // disabled
          shift: shiftFilter !== 'all' ? shiftFilter : undefined,
        }
        const chartDataResponse = await getDashboardChartData(chartParams)
        if (cancelled) return
        const transformedChartData = {
          gradeDistribution: (chartDataResponse.gradeDistribution || []).map((item: any) => ({
            name: item.name || item.grade,
            value: item.value || item.count || 0
          })),
          genderDistribution: chartDataResponse.genderDistribution || [],
          enrollmentTrend: (chartDataResponse.enrollmentTrend || []).map((item: any) => ({
            name: String(item.year || item.name || ''),
            value: item.enrollment || item.value || item.count || 0
          })),
          motherTongueDistribution: chartDataResponse.motherTongueDistribution || [],
          religionDistribution: chartDataResponse.religionDistribution || [],
          ageDistribution: (chartDataResponse.ageDistribution || []).map((item: any) => {
            const m = Number(item.male || 0)
            const f = Number(item.female || 0)
            const age = item.age ?? item.name?.replace("Age ", "")
            return {
              name: String(item.name || `Age ${age}`),
              age: age,
              male: m,
              female: f,
              value: m + f
            }
          }),
          zakatStatus: (chartDataResponse.zakatStatus || []).map((item: any) => ({
            name: item.name || item.status || 'Unknown',
            value: item.value || item.count || 0
          })),
          houseOwnership: (chartDataResponse.houseOwnership || []).map((item: any) => ({
            name: item.name || item.status || 'Unknown',
            value: item.value || item.count || 0
          })),
          campusPerformance: (chartDataResponse.campusPerformance || []).map((c: any) => ({ name: c.name, value: c.value }))
        }
        setApiChartData(transformedChartData)
        // Update KPI total based on filtered aggregates
        const derivedTotal = (transformedChartData.genderDistribution || []).reduce((sum: number, item: any) => sum + Number(item.value || 0), 0)
        if (derivedTotal >= 0) {
          setTotalStudentsCount(derivedTotal)
        }

        // Also refetch teacher count to keep KPI accurate
        try {
          const campusIds = userRole === 'principal' && userCampus ? undefined : campusFilterIds
          const qp = new URLSearchParams()
          if (shiftFilter && shiftFilter !== 'all') qp.append('shift', shiftFilter)
          if (campusIds && campusIds.length > 0) qp.append('current_campus', campusIds.join(','))
          if (filters.genders && filters.genders.length > 0) qp.append('gender', String(filters.genders[0]).toLowerCase())
          const q = qp.toString() ? `?${qp.toString()}` : ''
          const tResp: any = await apiGet(`/api/teachers/total/${q}`)
          setTeachersCount(tResp?.totalTeachers ?? 0)
        } catch (err) {
          console.error('Error refetching teacher total:', err)
        }

        // Refetch new admissions count with active grade/gender filters
        try {
          const aprilStart = `${new Date().getFullYear()}-04-01`
          const admQp = new URLSearchParams({ created_after: aprilStart })
          if (filters.grades && filters.grades.length === 1) admQp.append('current_grade', filters.grades[0])
          const admRes: any = await apiGet(`/api/students/total/?${admQp.toString()}`)
          if (!cancelled) setNewAdmissionsCount(admRes?.totalStudents || 0)
        } catch {
          // keep previous value
        }
      } catch (e) {
        console.error('Error refetching charts for filters:', e)
      } finally {
        if (!cancelled) setChartsLoading(false)
      }
    }
    refetchChartsForFilters()
    return () => { cancelled = true }
  }, [filters, shiftFilter, userRole, userCampus, campusFilterIds])

  const filteredStudents = useMemo(() => {
    if (filters.academicYears.length === 0 &&
      filters.campuses.length === 0 &&
      filters.grades.length === 0 &&
      filters.genders.length === 0) {
      return students;
    }

    return students.filter((student) => {
      // Principal campus filtering is already done in fetchData, so we only need to apply other filters
      if (filters.academicYears.length > 0 && !filters.academicYears.includes(student.academicYear)) return false
      if (filters.campuses.length > 0 && !filters.campuses.includes(student.campus)) return false
      if (filters.grades.length > 0 && !filters.grades.includes(student.grade)) return false
      if (filters.genders.length > 0 && !filters.genders.includes(student.gender)) return false
      if (filters.motherTongues.length > 0 && !filters.motherTongues.includes(student.motherTongue)) return false
      if (filters.religions.length > 0 && !filters.religions.includes(student.religion)) return false
      return true
    })
  }, [filters, students])

  // Filter teachers according to current filters so KPI reacts like charts
  // Teachers count is now handled by the totalTeachers API directly
  // to ensure accuracy across thousands of records.
  const teachersCountKPI = useMemo(() => teachersCount, [teachersCount])

  const metrics = useMemo(() => {
    // Use totalStudentsCount from API (actual count), not filteredStudents.length (which is only 100 for filters)
    const totalStudents = totalStudentsCount > 0 ? totalStudentsCount : filteredStudents.length
    const teachersVisible = teachersCountKPI


    const today = new Date()
    const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const todayDayName = daysOfWeek[today.getDay() === 0 ? 6 : today.getDay() - 1] // Convert Sunday=0 to Monday=1

    const todayData = weeklyAttendanceData.find((day: any) => day.day === todayDayName)
    const averageAttendance = todayData
      ? (() => {
        const present = todayData.present || 0
        const absentFromRecords = todayData.absent || 0
        const totalStudentsInRecords = todayData.totalStudentsInRecords || 0

        // Total students = actual total students count (from API)
        const totalStudentsCount = totalStudents > 0 ? totalStudents : 0

        // Students without attendance records = Total - Students in records
        const studentsWithoutRecords = totalStudentsCount > totalStudentsInRecords
          ? totalStudentsCount - totalStudentsInRecords
          : 0

        // Final absent = Absent from records + Students without records
        const totalAbsent = absentFromRecords + studentsWithoutRecords

        // Total for calculation = Present + Total Absent
        const totalForCalculation = present + totalAbsent

        if (totalForCalculation > 0) {
          return Math.round((present / totalForCalculation) * 100)
        }
        return 0
      })()
      : 0

    // Teacher:Student ratio based on actual student count
    const teacherStudentRatio = teachersVisible > 0 ? Math.round(totalStudents / teachersVisible) : 0



    return {
      totalStudents,
      averageAttendance,
      teachersCount: teachersVisible,
      teacherStudentRatio,
      averageScore: 0, // Removed
      retentionRate: 0 // Removed
    }
  }, [totalStudentsCount, filteredStudents.length, teachersCountKPI, weeklyAttendanceData])

  // Campus performance data - use filtered students
  const campusPerformanceData = useMemo(() => {
    // Use filtered students for accurate campus counts based on applied filters
    const counts = filteredStudents.reduce((acc: Record<string, number>, s) => {
      const campusName = s.campus || 'Unknown'
      if (campusName !== 'Unknown') {
        acc[campusName] = (acc[campusName] || 0) + 1
      }
      return acc
    }, {})
    const campusData = Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value) // Sort by count descending

    return campusData
  }, [filteredStudents])

  const chartData = useMemo(() => {
    // Use API chart data if available (optimized), otherwise fallback to client-side calculation
    if (apiChartData && !chartsLoading) {
      return {
        ...apiChartData,
        campusPerformance: campusPerformanceData,
      }
    }

    // Fallback: Calculate from filtered students (slower, but works if API fails)
    const gradeDistribution = getGradeDistribution(filteredStudents as unknown as any[])
    const genderDistribution = getGenderDistribution(filteredStudents as unknown as any[])
    const enrollmentTrend = getEnrollmentTrend(filteredStudents as unknown as any[])
    const motherTongueDistribution = getMotherTongueDistribution(filteredStudents as unknown as any[])
    const religionDistribution = getReligionDistribution(filteredStudents as unknown as any[])
    const ageDistribution = getAgeDistribution(filteredStudents as unknown as any[])

    return {
      gradeDistribution,
      genderDistribution,
      campusPerformance: campusPerformanceData,
      enrollmentTrend,
      motherTongueDistribution,
      religionDistribution,
      ageDistribution,
    }
  }, [apiChartData, chartsLoading, filteredStudents, campusPerformanceData, filters])

  // Dynamic filter options based on real data
  const collator = useMemo(() => new Intl.Collator(undefined, { sensitivity: 'base', numeric: true }), [])
  const dynamicAcademicYears = useMemo(() => {
    if (apiChartData && !chartsLoading) {
      const years = Array.from(new Set((apiChartData.enrollmentTrend || []).map((e: any) => {
        const n = Number(String(e.name || e.year))
        return isNaN(n) ? null : n
      }).filter(Boolean))).sort((a, b) => (Number(a) - Number(b))) as number[]
      return years as number[]
    }
    const years = Array.from(new Set(students.map(s => s.academicYear))).sort((a, b) => a - b)
    return years as number[]
  }, [apiChartData, chartsLoading, students])

  const dynamicCampuses = useMemo(() => {
    // Prefer full campus list from backend so we show campuses
    // even if they currently have 0 students.
    if (allCampuses && allCampuses.length > 0) {
      const campuses = Array.from(
        new Set(
          allCampuses.map((c: any) =>
            (c.campus_name || c.name || c.campus_code || c.code || '').toString().trim()
          )
        )
      )
        .filter(Boolean)
        .sort((a, b) => collator.compare(a as string, b as string))
      return campuses as string[]
    }

    // Fallbacks based on chart data or students (legacy behaviour)
    if (apiChartData && !chartsLoading && Array.isArray(apiChartData.campusPerformance)) {
      const campuses = Array.from(new Set(apiChartData.campusPerformance.map((c: any) => (c.name || '').toString().trim())))
        .filter(Boolean)
        .sort((a, b) => collator.compare(a as string, b as string))
      return campuses as string[]
    }
    const campuses = Array.from(new Set(students.map(s => (s.campus || '').toString().trim())))
      .filter(Boolean)
      .sort((a, b) => collator.compare(a as string, b as string))
    return campuses as string[]
  }, [allCampuses, apiChartData, chartsLoading, students, collator])

  const dynamicGrades = useMemo(() => {
    // Desired logical order for grade labels coming from backend normalization
    const gradeOrder = [
      "Special Class",
      "Nursery",
      "KG-I",
      "KG-II",
      "Grade I",
      "Grade II",
      "Grade III",
      "Grade IV",
      "Grade V",
      "Grade VI",
      "Grade VII",
      "Grade VIII",
      "Grade IX",
      "Grade X",
      "Unknown Grade",
    ]

    const sortByCustomGradeOrder = (arr: string[]) => {
      return [...arr].sort((a, b) => {
        const ia = gradeOrder.indexOf(a)
        const ib = gradeOrder.indexOf(b)
        const aRank = ia === -1 ? gradeOrder.length + 1 : ia
        const bRank = ib === -1 ? gradeOrder.length + 1 : ib
        if (aRank !== bRank) return aRank - bRank
        // Fallback to locale compare for any unknown labels
        return collator.compare(a, b)
      })
    }

    if (apiChartData && !chartsLoading) {
      const grades = Array.from(
        new Set(
          (apiChartData.gradeDistribution || []).map((g: any) =>
            (g.name || "").toString().trim()
          )
        )
      ).filter(Boolean) as string[]

      return sortByCustomGradeOrder(grades)
    }

    const grades = Array.from(
      new Set(
        students.map((s) => (s.grade || "").toString().trim())
      )
    ).filter(Boolean) as string[]

    return sortByCustomGradeOrder(grades)
  }, [apiChartData, chartsLoading, students, collator])

  const dynamicMotherTongues = useMemo(() => {
    if (apiChartData && !chartsLoading) {
      const motherTongues = Array.from(new Set((apiChartData.motherTongueDistribution || []).map((m: any) => (m.name || '').toString().trim())))
        .filter(Boolean)
        .sort((a, b) => collator.compare(a as string, b as string))
      return motherTongues as string[]
    }
    const motherTongues = Array.from(new Set(students.map(s => (s.motherTongue || "").toString().trim())))
      .filter(Boolean)
      .sort((a, b) => collator.compare(a as string, b as string))
    return motherTongues as string[]
  }, [apiChartData, chartsLoading, students, collator])

  const dynamicReligions = useMemo(() => {
    if (apiChartData && !chartsLoading) {
      const religions = Array.from(new Set((apiChartData.religionDistribution || []).map((r: any) => (r.name || '').toString().trim())))
        .filter(Boolean)
        .sort((a, b) => collator.compare(a as string, b as string))
      return religions as string[]
    }
    const religions = Array.from(new Set(students.map(s => (s.religion || "").toString().trim())))
      .filter(Boolean)
      .sort((a, b) => collator.compare(a as string, b as string))
    return religions as string[]
  }, [apiChartData, chartsLoading, students, collator])

  const dynamicGenders = useMemo(() => {
    if (apiChartData && !chartsLoading) {
      const genders = Array.from(new Set((apiChartData.genderDistribution || []).map((g: any) => (g.name || '').toString().trim())))
        .filter(Boolean)
        .sort((a, b) => collator.compare(a as string, b as string))
      return genders as string[]
    }
    const genders = Array.from(new Set(students.map(s => (s.gender || "").toString().trim())))
      .filter(Boolean)
      .sort((a, b) => collator.compare(a as string, b as string))
    return genders as string[]
  }, [apiChartData, chartsLoading, students, collator])

  const dynamicShifts = useMemo(() => {
    if (userRole === 'principal' && userCampus) {
      const principalCampus = allCampuses.find(c => (c.campus_name || c.name || c.campus_code || c.code) === userCampus);
      const shiftAvail = principalCampus?.shift_available || 'both';
      if (shiftAvail === 'morning') return ["All", "Morning"];
      if (shiftAvail === 'afternoon') return ["All", "Afternoon"];
      return ["All", "Morning", "Afternoon"];
    }

    if (!filters.campuses || filters.campuses.length === 0) return ["All", "Morning", "Afternoon"];

    // For superadmin with selected campuses
    const selectedCampuses = allCampuses.filter(c =>
      filters.campuses.includes((c.campus_name || c.name || c.campus_code || c.code || '').toString().trim())
    );

    const hasMorning = selectedCampuses.some(c => c.shift_available === 'morning' || c.shift_available === 'both');
    const hasAfternoon = selectedCampuses.some(c => c.shift_available === 'afternoon' || c.shift_available === 'both');

    const options = ["All"];
    if (hasMorning) options.push("Morning");
    if (hasAfternoon) options.push("Afternoon");
    return options;
  }, [allCampuses, userRole, userCampus, filters.campuses])

  const resetFilters = () => {
    setIsClearing(true)
    setFilters({ academicYears: [], campuses: [], grades: [], genders: [], motherTongues: [], religions: [] })
    // Allow the refresh icon to animate once
    setTimeout(() => setIsClearing(false), 700)
  }

  // Refresh data function
  const refreshData = async () => {
    setIsRefreshing(true)
    setLoading(true)
    setShowLoader(true)
    try {
      // Clear ALL dashboard cache to force fresh data
      const keysToRemove = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('dashboard_')) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key))
      keysToRemove.forEach(key => localStorage.removeItem(key))

      // Force re-fetch by calling the useEffect logic directly
      window.location.reload()
    } catch (error) {
      console.error('Error refreshing data:', error)
    } finally {
      setIsRefreshing(false)
      setLoading(false)
      setShowLoader(false)
    }
  }

  // Auto-refresh disabled to prevent cache issues
  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     refreshData()
  //   }, 5 * 60 * 1000) // 5 minutes

  //   return () => clearInterval(interval)
  // }, [userRole, userCampus])

  // Clear cache when user role changes (login/logout)
  useEffect(() => {
    if (userRole) {
      try {
        const keysToRemove = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && key.startsWith('dashboard_')) {
            keysToRemove.push(key)
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key))
      } catch (error) {
        console.warn('Error clearing cache on role change:', error)
      }
    }
  }, [userRole])

  // Function to clear old localStorage data to prevent quota exceeded

  // Extract fetchData function to be reusable
  const fetchData = async () => {
    // Clear ALL localStorage cache on every refresh to get fresh data
    try {
      const keysToRemove = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('dashboard_')) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key))
      keysToRemove.forEach(key => localStorage.removeItem(key))
    } catch (error) {
      console.warn('Error clearing localStorage:', error)
    }

    const now = Date.now()
    const cacheKey = `dashboard_${userRole}_${userCampus || 'all'}`

    setLoading(true)

    try {
      // Fetch teachers count, weekly attendance data, and new admissions
      try {
        const q = shiftFilter && shiftFilter !== 'all' ? `?shift=${encodeURIComponent(shiftFilter)}` : ''
        const teachersResponse: any = await apiGet(`/api/teachers/${q}`)
        const list = Array.isArray(teachersResponse)
          ? teachersResponse
          : (Array.isArray(teachersResponse?.results) ? teachersResponse.results : [])
        setTeachers(list)
        setTeachersCount(list.length)

        try {
          const campusIds = userRole === 'principal' && userCampus ? undefined : campusFilterIds;
          const cId = campusIds && campusIds.length > 0 ? campusIds[0] : undefined;
          const res = await getNewAdmissionsStats('today', cId ? Number(cId) : undefined);
          setNewAdmissionsCount(res?.total_new || 0);
        } catch {
          setNewAdmissionsCount(0);
        }
      } catch (error) {
        console.error('Error fetching teachers:', error)
        setTeachersCount(0)
        setTeachers([])
      }

      // Fetch weekly attendance data (last 7 days)
      try {
        const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

        // Try to fetch real attendance data
        try {
          const attendanceResponse: any = await apiGet('/api/attendance/')

          if (attendanceResponse && Array.isArray(attendanceResponse)) {
            // Process attendance data for last 7 days
            const last7Days = Array.from({ length: 7 }, (_, i) => {
              const date = new Date()
              date.setDate(date.getDate() - (6 - i))
              return date
            })

            const weekData = last7Days
              .map((date) => {
                const dayName = daysOfWeek[date.getDay() === 0 ? 6 : date.getDay() - 1]
                const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

                // Find attendance records for this date
                const dayRecords = attendanceResponse.filter((record: any) =>
                  record.date === dateStr || record.date?.startsWith(dateStr)
                )

                // Calculate present/absent from records and total students
                let present = 0
                let absent = 0
                let totalStudentsInRecords = 0

                dayRecords.forEach((record: any) => {
                  if (record.present_count) present += record.present_count
                  if (record.absent_count) absent += record.absent_count
                  if (record.total_students) totalStudentsInRecords += record.total_students
                })

                return { day: dayName, present, absent, totalStudentsInRecords }
              })
              .filter((item: any) => item.day !== 'Sun') // Filter out Sunday

            setWeeklyAttendanceData(weekData)
          } else {
            // Fallback to empty data if API doesn't return array - exclude Sunday
            const weekDaysWithoutSunday = daysOfWeek.filter(day => day !== 'Sun')
            const weekData = weekDaysWithoutSunday.map(day => ({ day, present: 0, absent: 0 }))
            setWeeklyAttendanceData(weekData)
          }
        } catch (apiError) {
          console.error('Error fetching real attendance:', apiError)
          // Fallback to empty data - exclude Sunday
          const weekDaysWithoutSunday = daysOfWeek.filter(day => day !== 'Sun')
          const weekData = weekDaysWithoutSunday.map(day => ({ day, present: 0, absent: 0 }))
          setWeeklyAttendanceData(weekData)
        }
      } catch (error) {
        console.error('Error processing attendance:', error)
      }

      // Principal: Fetch campus-specific data
      if (userRole === 'principal' && userCampus) {
        // Optimize: Only fetch essential data first
        const [apiStudents, caps] = await Promise.all([
          getAllStudents(false, shiftFilter === 'all' ? undefined : shiftFilter),
          getAllCampuses()
        ])

        // Fetch stats separately to avoid blocking
        const apiStats = await getDashboardStats()



        // Filter students by principal's campus
        const studentsArray = Array.isArray(apiStudents) ? apiStudents : [];
        const campusArray = Array.isArray(caps) ? caps : (Array.isArray((caps as any)?.results) ? (caps as any).results : [])



        // Find principal's campus ID
        const principalCampus = campusArray.find((c: any) => {
          if (!c) return false;
          return c.campus_name === userCampus ||
            c.name === userCampus ||
            c.campus_code === userCampus ||
            String(c.id) === String(userCampus);
        })

        if (principalCampus) {

          setPrincipalCampusId(principalCampus.id)

          const campusStudents = studentsArray.filter((student: any) => {
            const studentCampus = student.campus
            if (!studentCampus) return false

            // Check if student belongs to this 
            if (typeof studentCampus === 'object') {
              return studentCampus.id === principalCampus.id ||
                studentCampus.campus_name === userCampus ||
                studentCampus.campus_code === userCampus
            } else {
              return String(studentCampus) === String(principalCampus.id) ||
                studentCampus === userCampus
            }
          })



          // Map students to dashboard format
          const idToCampusCode = new Map()
          campusArray.forEach((c: any) => {
            if (c?.id && c?.campus_code) {
              idToCampusCode.set(String(c.id), c.campus_code)
            }
          })

          const mapped: DashboardStudent[] = campusStudents.map((item: any, idx: number) => {
            const createdAt = typeof item?.created_at === "string" ? item.created_at : ""
            const year = createdAt ? Number(createdAt.split("-")[0]) : new Date().getFullYear()
            const genderRaw = (item?.gender ?? "").toString().trim()
            const campusCode = (() => {
              const raw = item?.campus
              if (raw && typeof raw === 'object') return String(raw?.campus_code || raw?.code || 'Unknown').trim()
              if (typeof raw === 'number' || typeof raw === 'string') {
                const hit = idToCampusCode.get(String(raw))
                if (hit) return hit
              }
              return 'Unknown'
            })()
            const gradeName = (item?.current_grade ?? "Unknown").toString().trim()
            const motherTongue = (item?.mother_tongue ?? "Other").toString().trim()
            const religion = (item?.religion ?? "Other").toString().trim()
            return {
              rawData: item,
              studentId: String(item?.gr_no || item?.id || idx + 1),
              name: item?.name || "Unknown",
              academicYear: isNaN(year) ? new Date().getFullYear() : year,
              campus: campusCode,
              grade: gradeName,
              current_grade: gradeName,
              gender: genderRaw || "Unknown",
              motherTongue: motherTongue,
              religion: religion,
              attendancePercentage: 0,
              averageScore: 0,
              retentionFlag: (item?.current_state || "").toLowerCase() === "active",
              enrollmentDate: createdAt ? new Date(createdAt) : new Date(),
            }
          })

          setStudents(mapped)
          setCacheTimestamp(Date.now())
          const cacheData = {
            totalCount: mapped.length,
            students: mapped.slice(0, 50),
            hasMore: mapped.length > 50
          }
          localStorage.setItem(cacheKey, JSON.stringify(cacheData))
          localStorage.setItem(`${cacheKey}_time`, now.toString())
        } else {
          console.warn('Principal campus not found in API response')
          setStudents([])
        }
      } else {
        // Super Admin: Fetch all data
        const [apiStudents, caps, apiStats] = await Promise.all([
          getAllStudents(false, shiftFilter === 'all' ? undefined : shiftFilter),
          getAllCampuses(),
          getDashboardStats()
        ])



        const studentsArray = Array.isArray(apiStudents) ? apiStudents : [];
        const campusArray = Array.isArray(caps) ? caps : (Array.isArray((caps as any)?.results) ? (caps as any).results : [])

        // Map all students
        const idToCampusCode = new Map()
        campusArray.forEach((c: any) => {
          if (c?.id && c?.campus_code) {
            idToCampusCode.set(String(c.id), c.campus_code)
          }
        })

        const mapped: DashboardStudent[] = studentsArray.map((item: any, idx: number) => {
          const createdAt = typeof item?.created_at === "string" ? item.created_at : ""
          const year = createdAt ? Number(createdAt.split("-")[0]) : new Date().getFullYear()
          const genderRaw = (item?.gender ?? "").toString().trim()
          const campusCode = (() => {
            const raw = item?.campus
            if (raw && typeof raw === 'object') return String(raw?.campus_code || raw?.code || 'Unknown').trim()
            if (typeof raw === 'number' || typeof raw === 'string') {
              const hit = idToCampusCode.get(String(raw))
              if (hit) return hit
            }
            return 'Unknown'
          })()
          const gradeName = (item?.current_grade ?? "Unknown").toString().trim()
          const motherTongue = (item?.mother_tongue ?? "Other").toString().trim()
          const religion = (item?.religion ?? "Other").toString().trim()
          return {
            rawData: item,
            studentId: String(item?.gr_no || item?.id || idx + 1),
            name: item?.name || "Unknown",
            academicYear: isNaN(year) ? new Date().getFullYear() : year,
            campus: campusCode,
            grade: gradeName,
            current_grade: gradeName,
            gender: genderRaw || "Unknown",
            motherTongue: motherTongue,
            religion: religion,
            attendancePercentage: 0, // Will be calculated from real attendance data
            averageScore: 0, // Removed mock data
            retentionFlag: (item?.current_state || "").toLowerCase() === "active",
            enrollmentDate: createdAt ? new Date(createdAt) : new Date(),
          }
        })

        setStudents(mapped)
        setTotalStudentsCount(mapped.length)
        setCacheTimestamp(Date.now())

        // Save to cache (with total count) - only store essential data to avoid quota exceeded
        const cacheData = {
          totalCount: mapped.length,
          // Only store first 50 students to avoid localStorage quota issues
          students: mapped.slice(0, 50),
          hasMore: mapped.length > 50
        }
        localStorage.setItem(cacheKey, JSON.stringify(cacheData))
        localStorage.setItem(`${cacheKey}_time`, now.toString())
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      // Fallback to empty array
      setStudents([])
    } finally {
      setLoading(false)
    }
  }

  // Special view for SuperAdmin (Software Owner) and Admin (Reseller)
  if (userRole === 'superadmin' || userRole === 'admin') {
    return <SuperAdminDashboard />;
  }

  // Accountant (campus-scoped): finance-focused dashboard instead of the
  // academic one. Data is auto-scoped to their campus by the backend.
  if (userRole === 'accounts_officer' && isDashboardAllowed) {
    return (
      <main className="min-h-screen bg-[#F5F7FA]">
        <div className="w-full mx-auto">
          {/* Mobile top bar */}
          <div className="flex items-center justify-between mb-5 lg:hidden">
            <button
              onClick={() => window.dispatchEvent(new Event("toggle-admin-sidebar"))}
              className="p-2 -ml-1 rounded-lg text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors"
              aria-label="Open sidebar"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-2.5">
              <NotificationBell />
              <UserProfilePopup />
            </div>
          </div>

          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-extrabold text-[#163B5C] tracking-tight">Hello {userName}!</h1>
              <p className="text-xs text-gray-500 mt-1">
                {userCampus ? `${userCampus} — ` : ""}Track fee collection, outstanding balances and defaulters.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="relative hidden lg:block"><NotificationBell /></div>
              <div className="hidden lg:block"><UserProfilePopup /></div>
            </div>
          </div>

          <AccountsNetworkDashboard campusName={userCampus} />
          {/* Announcements moved to the Notifications page (Announcements tab). */}
        </div>
      </main>
    );
  }

  if (!canViewDashboard || (!hasAnyChartOrKpi && userRole !== 'org_admin' && userRole !== 'accounts_officer')) {
    // For accountant, don't show restricted screen, let the redirect useEffect handle it (no flicker)
    if (userRole === 'accounts_officer') return null;

    return <AccessDenied title="Dashboard Restricted" message="You do not have the required permissions to access this dashboard. Please contact your system administrator to request access." />
  }

  return (
    <main className="min-h-screen bg-[#F5F7FA]" id="dashboard-print-root">
      <div className="w-full mx-auto">
        {/* Mobile Top Bar — hamburger toggle + notification + profile */}
        <div className="flex items-center justify-between mb-5 lg:hidden no-print">
          <button
            onClick={() => window.dispatchEvent(new Event("toggle-admin-sidebar"))}
            className="p-2 -ml-1 rounded-lg text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors"
            aria-label="Open sidebar"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2.5">
            <NotificationBell />
            <UserProfilePopup />
          </div>
        </div>

        {/* Modern SaaS Header */}
        <div ref={greetingRef} className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-[#163B5C] tracking-tight">
              Hello {userName}!
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Track, analyze, and manage your school's academic growth and performance.
            </p>
          </div>
          
          <div className="flex items-center flex-wrap gap-2.5 no-print">
            {/* Year Dropdown */}
            <div className="relative">
              <select 
                value={attendancePeriod} 
                onChange={(e) => setAttendancePeriod(e.target.value as "weekly" | "monthly" | "3month" | "6month")}
                className="appearance-none bg-white border border-gray-200 rounded-xl px-4 py-2 pr-8 text-xs font-semibold text-gray-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2F6B8A]/20 focus:border-[#2F6B8A] cursor-pointer"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="3month">3 Months</option>
                <option value="6month">6 Months</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-gray-400">
                <ChevronDown className="h-3.5 w-3.5" />
              </div>
            </div>

            

            {/* Reset Button (as custom mail-like square button) */}
            <button 
              onClick={resetFilters} 
              title="Reset Filters"
              className="w-9 h-9 flex items-center justify-center bg-white border border-gray-200 rounded-xl text-gray-550 hover:text-[#2F6B8A] shadow-sm hover:bg-gray-50 transition-all"
            >
              <RefreshCcw className={`w-3.5 h-3.5 ${isClearing ? 'animate-spin' : ''}`} />
            </button>

            {/* Export Dropdown (as custom square button) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  title="Export Options"
                  className="w-9 h-9 flex items-center justify-center bg-white border border-gray-200 rounded-xl text-gray-550 hover:text-[#2F6B8A] shadow-sm hover:bg-gray-50 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 rounded-xl border-gray-150 shadow-xl">
                <DropdownMenuItem onClick={handlePrintDashboard} className="text-sm py-2">
                  Print / Save PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCustomExportOpen(true)} className="text-sm py-2">
                  Export Custom
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Notification Bell — hidden on mobile (shown in mobile top bar) */}
            <div className="relative hidden lg:block">
              <NotificationBell />
            </div>

            {/* User Profile Avatar — hidden on mobile (shown in mobile top bar) */}
            <div className="hidden lg:block">
              <UserProfilePopup />
            </div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="mb-6 no-print">
          <div className="py-2">
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[130px]">
                <MultiSelectFilter title="Academic Year" options={dynamicAcademicYears} selectedValues={filters.academicYears} onSelectionChange={(val) => setFilters((prev) => ({ ...prev, academicYears: val as number[] }))} placeholder="All years" />
              </div>
              {userRole !== 'principal' && (
                <div className="flex-1 min-w-[130px]">
                  <MultiSelectFilter
                    title="Campus"
                    options={dynamicCampuses}
                    selectedValues={filters.campuses}
                    onSelectionChange={(val) => {
                      const newCampuses = val as string[];
                      setFilters((prev) => ({ ...prev, campuses: newCampuses }));
                      if (newCampuses.length > 0 && shiftFilter !== 'all') {
                        const selectedCampuses = allCampuses.filter(c =>
                          newCampuses.includes((c.campus_name || c.name || c.campus_code || c.code || '').toString().trim())
                        );
                        const hasMorning = selectedCampuses.some(c => c.shift_available === 'morning' || c.shift_available === 'both');
                        const hasAfternoon = selectedCampuses.some(c => c.shift_available === 'afternoon' || c.shift_available === 'both');
                        if (shiftFilter === 'morning' && !hasMorning) setShiftFilter('all');
                        if (shiftFilter === 'afternoon' && !hasAfternoon) setShiftFilter('all');
                      }
                    }}
                    placeholder="All campuses"
                  />
                </div>
              )}
              <div className="flex-1 min-w-[130px]">
                <MultiSelectFilter title="Grade" options={allGradesOptions.length > 0 ? allGradesOptions : dynamicGrades} selectedValues={filters.grades} onSelectionChange={(val) => setFilters((prev) => ({ ...prev, grades: val as string[] }))} placeholder="All grades" />
              </div>
              <div className="flex-1 min-w-[130px]">
                <MultiSelectFilter title="Gender" options={dynamicGenders} selectedValues={filters.genders} onSelectionChange={(val) => setFilters((prev) => ({ ...prev, genders: val as ("Male" | "Female" | "Other")[] }))} placeholder="All genders" />
              </div>
              <div className="flex-1 min-w-[130px]">
                <MultiSelectFilter
                  title="Shift"
                  options={dynamicShifts}
                  selectedValues={[
                    shiftFilter === 'all' ? 'All' :
                      shiftFilter === 'morning' ? 'Morning' :
                        shiftFilter === 'afternoon' ? 'Afternoon' : 'All'
                        
                  ]}
                  onSelectionChange={(val) => {
                    const newSelection = val as (string | number)[]
                    const choice = String(newSelection[newSelection.length - 1] || 'All')
                    const normalized = choice.toLowerCase()
                    setShiftFilter(normalized)
                  }}
                  placeholder="All shifts"
                />
              </div>
              <div className="flex-1 min-w-[130px] flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">View</label>
                <select
                  value={dashboardView}
                  onChange={(e) => setDashboardView(e.target.value as 'full' | 'partial')}
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2F6B8A]/20 focus:border-[#2F6B8A] transition-all duration-200"
                >
                  <option value="full">Full View</option>
                  <option value="partial">Partial View</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div ref={kpisRef} id="print-kpis" className="mb-8">
          {(kpisLoading || chartsLoading) ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm flex items-center gap-4 animate-pulse">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-6 bg-gray-100 rounded w-16" />
                    <div className="h-3 bg-gray-100 rounded w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={`grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 ${['org_admin', 'superadmin'].includes(userRole) ? 'xl:grid-cols-6' : 'xl:grid-cols-5'}`}>
              {['org_admin', 'superadmin'].includes(userRole) && (
                <Link href="/admin/campus/list" className="group bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-[#163B5C]/20 transition-all duration-300 flex items-center gap-3 sm:gap-4 cursor-pointer">
                  <CircularProgress
                    percentage={Math.min(100, Math.max(15, campusCount * 12))}
                    colorClass="text-[#163B5C]"
                    bgClass="text-slate-100"
                    direction="up"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-2xl font-bold text-[#163B5C] group-hover:text-[#2F6B8A] transition-colors duration-300 leading-tight">
                      {campusCount.toLocaleString()}
                    </p>
                    <p className="text-xs font-medium text-gray-400 leading-tight mt-1">
                      Total Campuses
                    </p>
                  </div>
                </Link>
              )}

              {canViewTotalStudentsKpi && (
                <Link href="/admin/students/student-list" className="group bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-[#163B5C]/20 transition-all duration-300 flex items-center gap-3 sm:gap-4 cursor-pointer">
                  <CircularProgress
                    percentage={Math.min(100, Math.max(15, Math.round((metrics.totalStudents / 500) * 100)))}
                    colorClass="text-[#163B5C]"
                    bgClass="text-slate-100"
                    direction="up"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-2xl font-bold text-[#163B5C] group-hover:text-[#2F6B8A] transition-colors duration-300 leading-tight">
                      {metrics.totalStudents.toLocaleString()}
                    </p>
                    <p className="text-xs font-medium text-gray-400 leading-tight mt-1">
                      {userRole === 'principal' && userCampus ? 'Active Students' : 'Total Students'}
                    </p>
                  </div>
                </Link>
              )}

              {['org_admin', 'principal', 'coordinator'].includes(userRole) && (
                <Link href="/admin/students/student-list" className="group bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-emerald-600/20 transition-all duration-300 flex items-center gap-3 sm:gap-4 cursor-pointer">
                  <CircularProgress
                    percentage={Math.min(100, Math.max(15, Math.round((newAdmissionsCount / 200) * 100)))}
                    colorClass="text-emerald-600"
                    bgClass="text-emerald-50"
                    direction="up"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-2xl font-bold text-[#163B5C] group-hover:text-emerald-600 transition-colors duration-300 leading-tight">
                      {newAdmissionsCount.toLocaleString()}
                    </p>
                    <p className="text-xs font-medium text-gray-400 leading-tight mt-1">
                      New Admissions
                    </p>
                  </div>
                </Link>
              )}

              {canViewTotalTeachersKpi && (
                <Link href="/admin/teachers/list" className="group bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-[#2F6B8A]/20 transition-all duration-300 flex items-center gap-3 sm:gap-4 cursor-pointer">
                  <CircularProgress
                    percentage={Math.min(100, Math.max(15, Math.round((metrics.teachersCount / 30) * 100)))}
                    colorClass="text-[#2F6B8A]"
                    bgClass="text-blue-50"
                    direction="up"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-2xl font-bold text-[#163B5C] group-hover:text-[#2F6B8A] transition-colors duration-300 leading-tight">
                      {metrics.teachersCount.toLocaleString()}
                    </p>
                    <p className="text-xs font-medium text-gray-400 leading-tight mt-1">
                      Total Teachers
                    </p>
                  </div>
                </Link>
              )}

              {canViewTeacherStudentRatioKpi && (
                <Link href="/admin/teachers/stats" className="group bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-purple-600/20 transition-all duration-300 flex items-center gap-3 sm:gap-4 cursor-pointer">
                  <CircularProgress
                    percentage={Math.min(100, Math.max(15, Math.round((metrics.teacherStudentRatio / 30) * 100)))}
                    colorClass="text-purple-600"
                    bgClass="text-purple-50"
                    direction="up"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-2xl font-bold text-[#163B5C] group-hover:text-purple-600 transition-colors duration-300 leading-tight">
                      1:{metrics.teacherStudentRatio}
                    </p>
                    <p className="text-xs font-medium text-gray-400 leading-tight mt-1">
                      Teacher:Student Ratio
                    </p>
                  </div>
                </Link>
              )}

              {['org_admin', 'principal', 'coordinator'].includes(userRole) && (
                <Link href="/admin/principals/campus-management" className="group bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-rose-600/20 transition-all duration-300 flex items-center gap-3 sm:gap-4 cursor-pointer">
                  <CircularProgress
                    percentage={Math.min(100, Math.max(15, Math.round((alumniCount / Math.max(1, alumniCount + noClassroomCount)) * 100)))}
                    colorClass="text-rose-600"
                    bgClass="text-rose-50"
                    direction="down"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <p className="text-2xl font-bold text-[#163B5C] group-hover:text-rose-600 transition-colors duration-300 leading-tight">
                        {alumniCount.toLocaleString()}
                      </p>
                      <span className="text-[10px] text-gray-400 font-normal">
                        / {noClassroomCount.toLocaleString()} no class
                      </span>
                    </div>
                    <p className="text-xs font-medium text-gray-400 leading-tight mt-1">
                      Alumni
                    </p>
                  </div>
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Charts Section */}
        {/* Row 1: Enrollment Trend (2/3) + Attendance Overview (1/3) */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
          {canViewEnrollmentTrendChart && (
            <div ref={enrollmentTrendChartRef} className="xl:col-span-2 bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
              <EnrollmentTrendChart
                data={chartData.enrollmentTrend}
                isLoading={kpisLoading || chartsLoading}
              />
            </div>
          )}
          {canViewWeeklyAttendanceChart && userRole !== 'donor' && (
            <div ref={weeklyAttendanceChartRef} className="xl:col-span-1 bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
              <WeeklyAttendanceChart
                data={weeklyAttendanceData}
                isLoading={kpisLoading || chartsLoading}
                campusId={campusFilterIds && campusFilterIds.length > 0 ? campusFilterIds[0] : undefined}
                period={attendancePeriod}
                onPeriodChange={setAttendancePeriod}
              />
            </div>
          )}
        </div>

        <ChartSlider>
          {/* Each chart is its own slide — mobile: 1 per slide, desktop: 3 per view */}
          {canViewWeeklyAttendanceChart && userRole !== 'donor' && userRole !== 'student' ? (
            <div className="h-full bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
              <StaffAttendanceWidget
                campusId={campusFilterIds && campusFilterIds.length > 0 ? campusFilterIds[0] : undefined}
              />
            </div>
          ) : null}

          {canViewGradeDistributionChart ? (
            <div ref={gradeDistributionRef} className="h-full bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
              <GradeDistributionChart data={chartData.gradeDistribution} isLoading={kpisLoading || chartsLoading} />
            </div>
          ) : null}

          {dashboardView === 'full' && canViewGenderDistributionChart ? (
            <div ref={genderChartRef} className="h-full bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
              <GenderDistributionChart data={chartData.genderDistribution} isLoading={kpisLoading || chartsLoading} />
            </div>
          ) : null}

          {dashboardView === 'full' && canViewReligionChart ? (
            <div ref={religionChartRef} className="h-full bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
              <ReligionChart data={chartData.religionDistribution} isLoading={kpisLoading || chartsLoading} />
            </div>
          ) : null}

          {dashboardView === 'full' && canViewMotherTongueChart ? (
            <div ref={motherTongueChartRef} className="h-full bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
              <MotherTongueChart data={chartData.motherTongueDistribution} isLoading={kpisLoading || chartsLoading} />
            </div>
          ) : null}

          {dashboardView === 'full' && canViewAgeDistributionChart ? (
            <div ref={ageDistributionChartRef} className="h-full bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
              <AgeDistributionChart data={chartData.ageDistribution} isLoading={kpisLoading || chartsLoading} />
            </div>
          ) : null}

          {dashboardView === 'full' && canViewZakatStatusChart && userRole !== 'org_admin' ? (
            <div ref={zakatChartRef} className="h-full bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
              <ZakatStatusChart data={chartData.zakatStatus} isLoading={kpisLoading || chartsLoading} />
            </div>
          ) : null}

          {dashboardView === 'full' && canViewHouseOwnershipChart ? (
            <div ref={houseChartRef} className="h-full bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
              <HouseOwnershipChart data={chartData.houseOwnership} isLoading={kpisLoading || chartsLoading} />
            </div>
          ) : null}
        </ChartSlider>
      </div>

        {/* Campus cards — donor only: browse every campus, placed below the charts. */}
        {userRole === 'donor' && <CampusOverviewCards />}

        {/* Network Performance — principal sees own-campus + ranking, org-admin sees all campuses */}
        {canViewNetworkPerformanceChart && (
          <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-4 sm:p-6 mb-6">
            <div className="mb-4">
              <h2 className="text-lg font-black text-[#274c77]">
                {userRole === 'principal' ? 'Principal Performance Dashboard'
                  : userRole === 'teacher' ? 'Class Performance Dashboard'
                  : userRole === 'donor' ? 'Donor Impact & Performance Dashboard'
                  : 'Global Network Performance'}
              </h2>
              <p className="text-xs text-gray-500">
                {userRole === 'principal'
                  ? 'Your campus performance & network ranking (approved results)'
                  : userRole === 'teacher'
                  ? 'Your class internals & comparison against the campus baseline (approved results)'
                  : userRole === 'donor'
                  ? 'Sponsored-network impact & per-campus results (approved results)'
                  : 'Result comparison across campuses (approved results)'}
              </p>
            </div>
            {userRole === 'principal' ? <PrincipalNetworkDashboard />
              : userRole === 'teacher' ? <ClassTeacherNetworkDashboard />
              : userRole === 'donor' ? <DonorNetworkDashboard />
              : <OrgNetworkDashboard />}
          </div>
        )}

        {/* Horizontal Charts Slider */}

      {/* Organization-wide insights — org admin & superadmin only */}
      {(userRole === 'org_admin' || userRole === 'superadmin') && <OrgAdminInsights />}

      {/* Announcements feed — other roles (teacher, principal, etc.) */}
      {userRole && !['org_admin', 'superadmin'].includes(userRole) && (
        <div className="mt-6">
          {/* <AnnouncementsCard /> */}
        </div>
      )}

      {/* Custom Export Modal */}
      {customExportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCustomExportOpen(false)} />
          <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
            <div className="px-6 py-4 bg-[#163B5C] text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Export Custom Report</h3>
                <p className="text-xs text-white/70">Select sections to include in your report</p>
              </div>
              <button className="rounded-full h-8 w-8 flex items-center justify-center hover:bg-white/20 transition-colors text-xl" onClick={() => setCustomExportOpen(false)}>×</button>
            </div>
            <div className="p-5 space-y-1 max-h-[60vh] overflow-y-auto">
              <label className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={!!selectedSections.greeting} onChange={(e) => setSelectedSections(s => ({ ...s, greeting: e.target.checked }))} className="rounded border-gray-300 text-[#2F6B8A] focus:ring-[#2F6B8A]" />
                <span className="text-sm font-medium text-gray-700">Greeting</span>
              </label>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 pt-3 pb-1">KPIs</div>
              {canViewTotalStudentsKpi && (
                <label className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={!!selectedSections.kpis} onChange={(e) => setSelectedSections(s => ({ ...s, kpis: e.target.checked }))} className="rounded border-gray-300 text-[#2F6B8A] focus:ring-[#2F6B8A]" />
                  <span className="text-sm text-gray-700">Total Students</span>
                </label>
              )}
              {canViewTotalTeachersKpi && (
                <label className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={!!selectedSections.kpis} onChange={(e) => setSelectedSections(s => ({ ...s, kpis: e.target.checked }))} className="rounded border-gray-300 text-[#2F6B8A] focus:ring-[#2F6B8A]" />
                  <span className="text-sm text-gray-700">Total Teachers</span>
                </label>
              )}
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 pt-3 pb-1">Charts</div>
              {canViewGenderDistributionChart && (
                <label className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={!!selectedSections.gender} onChange={(e) => setSelectedSections(s => ({ ...s, gender: e.target.checked }))} className="rounded border-gray-300 text-[#2F6B8A] focus:ring-[#2F6B8A]" />
                  <span className="text-sm text-gray-700">Gender</span>
                </label>
              )}
              {canViewReligionChart && (
                <label className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={!!selectedSections.religion} onChange={(e) => setSelectedSections(s => ({ ...s, religion: e.target.checked }))} className="rounded border-gray-300 text-[#2F6B8A] focus:ring-[#2F6B8A]" />
                  <span className="text-sm text-gray-700">Religion</span>
                </label>
              )}
              {canViewMotherTongueChart && (
                <label className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={!!selectedSections.motherTongue} onChange={(e) => setSelectedSections(s => ({ ...s, motherTongue: e.target.checked }))} className="rounded border-gray-300 text-[#2F6B8A] focus:ring-[#2F6B8A]" />
                  <span className="text-sm text-gray-700">Mother Tongue</span>
                </label>
              )}
              {canViewEnrollmentTrendChart && (
                <label className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={!!selectedSections.enrollmentTrend} onChange={(e) => setSelectedSections(s => ({ ...s, enrollmentTrend: e.target.checked }))} className="rounded border-gray-300 text-[#2F6B8A] focus:ring-[#2F6B8A]" />
                  <span className="text-sm text-gray-700">Enrollment Trend</span>
                </label>
              )}
              {['org_admin', 'principal', 'coordinator'].includes(userRole) && (
                <label className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={!!selectedSections.newAdmissions} onChange={(e) => setSelectedSections(s => ({ ...s, newAdmissions: e.target.checked }))} className="rounded border-gray-300 text-[#2F6B8A] focus:ring-[#2F6B8A]" />
                  <span className="text-sm text-gray-700">New Admissions</span>
                </label>
              )}
              {canViewGradeDistributionChart && (
                <label className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={!!selectedSections.gradeDistribution} onChange={(e) => setSelectedSections(s => ({ ...s, gradeDistribution: e.target.checked }))} className="rounded border-gray-300 text-[#2F6B8A] focus:ring-[#2F6B8A]" />
                  <span className="text-sm text-gray-700">Grade Distribution</span>
                </label>
              )}
              {canViewWeeklyAttendanceChart && (
                <label className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={!!selectedSections.weeklyAttendance} onChange={(e) => setSelectedSections(s => ({ ...s, weeklyAttendance: e.target.checked }))} className="rounded border-gray-300 text-[#2F6B8A] focus:ring-[#2F6B8A]" />
                  <span className="text-sm text-gray-700">Weekly Attendance</span>
                </label>
              )}
              {canViewAgeDistributionChart && (
                <label className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={!!selectedSections.ageDistribution} onChange={(e) => setSelectedSections(s => ({ ...s, ageDistribution: e.target.checked }))} className="rounded border-gray-300 text-[#2F6B8A] focus:ring-[#2F6B8A]" />
                  <span className="text-sm text-gray-700">Age Distribution</span>
                </label>
              )}
              {canViewZakatStatusChart && userRole !== 'org_admin' && (
                <label className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={!!selectedSections.zakatStatus} onChange={(e) => setSelectedSections(s => ({ ...s, zakatStatus: e.target.checked }))} className="rounded border-gray-300 text-[#2F6B8A] focus:ring-[#2F6B8A]" />
                  <span className="text-sm text-gray-700">Zakat Status</span>
                </label>
              )}
              {canViewHouseOwnershipChart && (
                <label className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={!!selectedSections.houseOwnership} onChange={(e) => setSelectedSections(s => ({ ...s, houseOwnership: e.target.checked }))} className="rounded border-gray-300 text-[#2F6B8A] focus:ring-[#2F6B8A]" />
                  <span className="text-sm text-gray-700">House Ownership</span>
                </label>
              )}
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setCustomExportOpen(false)} className="px-5 py-2 text-sm border-gray-200 text-gray-600 hover:text-gray-800 hover:bg-gray-100">Cancel</Button>
              <Button onClick={handleCustomExport} className="px-5 py-2 text-sm bg-[#2F6B8A] text-white hover:bg-[#163B5C] shadow-lg shadow-[#2F6B8A]/20 transition-all duration-200">Generate Report</Button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}