"use client"

import { useState, useEffect } from "react"
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { authorizedFetch } from "@/lib/api"

interface WeeklyAttendanceData {
  day: string
  present: number
  absent: number
  percentage?: number
}

type AttendancePeriod = 'weekly' | 'monthly' | '3month' | '6month'

interface WeeklyAttendanceChartProps {
  data: WeeklyAttendanceData[]
  isLoading?: boolean
  campusId?: string | number
  period: AttendancePeriod
  onPeriodChange: (period: AttendancePeriod) => void
  title?: string
  description?: string
  showExport?: boolean
  /** CSV export endpoint — defaults to the student export; pass the staff one for the staff widget. */
  exportPath?: string
  /** Query param name the export endpoint expects for the campus filter (student: `campus`, staff: `campus_id`). */
  exportCampusParam?: string
  exportFilenamePrefix?: string
}

const periodLabels: Record<AttendancePeriod, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  '3month': '3 Months',
  '6month': '6 Months',
}

export function WeeklyAttendanceChart({
  data, isLoading, campusId, period, onPeriodChange,
  title = 'Attendance Overview', description = 'Student attendance breakdown', showExport = true,
  exportPath = '/api/attendance/export-csv/', exportCampusParam = 'campus', exportFilenamePrefix = 'Attendance_Report',
}: WeeklyAttendanceChartProps) {
  const [isMobile, setIsMobile] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const handleDownloadCsv = async () => {
    setIsDownloading(true)
    try {
      const today = new Date()
      const endDate = today.toISOString().split('T')[0]
      const startDateObj = new Date(today)
      const daysBack = { weekly: 6, monthly: 29, '3month': 89, '6month': 179 }[period] ?? 29
      startDateObj.setDate(today.getDate() - daysBack)
      const startDate = startDateObj.toISOString().split('T')[0]

      const params = new URLSearchParams({ start_date: startDate, end_date: endDate })
      if (campusId) params.append(exportCampusParam, String(campusId))
      const url = `${exportPath}?${params.toString()}`
      const response = await authorizedFetch(url)

      if (!response.ok) {
        throw new Error('Export failed')
      }

      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.setAttribute('download', `${exportFilenamePrefix}_${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error('Export failed:', error)
      alert('Failed to download attendance report. Please try again.')
    } finally {
      setIsDownloading(false)
    }
  }

  // Calculate overall attendance rate
  const totalPresent = data.reduce((sum, item) => sum + item.present, 0)
  const totalAbsent = data.reduce((sum, item) => sum + item.absent, 0)
  const totalCount = totalPresent + totalAbsent
  const attendanceRate = totalCount > 0 ? Math.round((totalPresent / totalCount) * 100) : 0

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const percentage = payload[0].payload.percentage ?? (
        payload[0].payload.present + payload[0].payload.absent > 0
          ? Math.round((payload[0].payload.present / (payload[0].payload.present + payload[0].payload.absent)) * 100)
          : 0
      )
      return (
        <div className="bg-white border border-gray-150 rounded-xl p-3 shadow-xl text-xs">
          <p className="font-bold text-[#163B5C] border-b pb-1.5 mb-1.5">{payload[0].payload.day}</p>
          <div className="space-y-1">
            <p className="flex justify-between gap-4">
              <span className="text-gray-400 font-medium">Present:</span>
              <span className="font-semibold text-emerald-600">{payload[0].payload.present}</span>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-gray-400 font-medium">Absent:</span>
              <span className="font-semibold text-rose-500">{payload[0].payload.absent}</span>
            </p>
            <p className="flex justify-between gap-4 pt-1.5 mt-1 border-t border-gray-100">
              <span className="text-[#163B5C] font-semibold">Attendance:</span>
              <span className="font-bold text-[#2F6B8A]">{percentage}%</span>
            </p>
          </div>
        </div>
      )
    }
    return null
  }

  const maxValue = Math.max(...data.map(d => Math.max(d.present, d.absent)), 0)
  const yMax = Math.ceil(maxValue * 1.2 / 10) * 10

  if (isLoading) {
    return (
      <Card className="h-[400px] border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl flex flex-col bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold text-[#163B5C]">{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center p-6">
          <div className="w-full h-full animate-pulse bg-slate-50/50 rounded-xl" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-auto lg:h-[400px] border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 rounded-2xl flex flex-col bg-white overflow-hidden">
      <CardHeader className="pb-2 bg-white flex flex-row items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#2F6B8A]/10 flex items-center justify-center text-[#2F6B8A]">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-[#163B5C]">{title}</CardTitle>
            <CardDescription className="text-xs text-gray-400">{description}</CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-2 no-print">
          <Select value={period} onValueChange={(val: any) => onPeriodChange(val)}>
            <SelectTrigger className="w-[95px] h-7 text-[11px] rounded-lg border-gray-250 text-[#163B5C] focus:ring-[#2F6B8A]">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="3month">3 Months</SelectItem>
              <SelectItem value="6month">6 Months</SelectItem>
            </SelectContent>
          </Select>
          {showExport && (
            <Button
              size="sm"
              disabled={isDownloading}
              className="h-7 text-[11px] gap-1 bg-[#2F6B8A] text-white hover:bg-[#163B5C] transition-colors shadow-sm rounded-lg"
              onClick={handleDownloadCsv}
            >
              {isDownloading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Download className="h-3 w-3" />
              )}
              <span>Export</span>
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pt-2 flex-1 min-h-0 pb-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:h-full">
          {/* Semi-Donut Progress Chart */}
          <div className="flex flex-col items-center justify-center border-r border-gray-50 pr-2 h-[180px] lg:h-full">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Avg Attendance</span>
            <div className="w-full max-w-[170px]">
              <svg viewBox="0 0 200 112" className="w-full">
                {/* Track */}
                <path
                  d="M 20 100 A 80 80 0 0 1 180 100"
                  fill="none"
                  stroke="#E2E8F0"
                  strokeWidth="16"
                  strokeLinecap="round"
                />
                {/* Fill */}
                <path
                  d="M 20 100 A 80 80 0 0 1 180 100"
                  fill="none"
                  stroke="#2F6B8A"
                  strokeWidth="16"
                  strokeLinecap="round"
                  strokeDasharray={`${(attendanceRate / 100) * 251.3} 251.3`}
                  style={{ transition: "stroke-dasharray 0.7s ease-in-out" }}
                />
                {/* Percentage */}
                <text x="100" y="86" textAnchor="middle" fill="#163B5C" fontSize="26" fontWeight="800" fontFamily="inherit">
                  {attendanceRate}%
                </text>
                <text x="100" y="104" textAnchor="middle" fill="#9CA3AF" fontSize="9" fontWeight="600" letterSpacing="1.5" fontFamily="inherit">
                  ATTENDED
                </text>
              </svg>
            </div>
            <div className="flex gap-4 mt-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#2F6B8A]" />
                <span className="text-gray-500">Present</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-200" />
                <span className="text-gray-500">Absent</span>
              </div>
            </div>
          </div>

          {/* Daily composed trend chart */}
          <div className="lg:col-span-2 h-[220px] lg:h-full flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={data}
                margin={{ top: 10, right: 5, left: -25, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="presentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#2F6B8A" stopOpacity={1} />
                    <stop offset="95%" stopColor="#2F6B8A" stopOpacity={0.45} />
                  </linearGradient>
                  <linearGradient id="absentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#e61717" stopOpacity={1} />
                    <stop offset="95%" stopColor="#e61717" stopOpacity={0.45} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F3F6" vertical={false} />
                <XAxis
                  dataKey="day"
                  stroke="#A0AEC0"
                  style={{ fontSize: '9px', fontWeight: '500' }}
                  tickLine={false}
                  axisLine={false}
                  interval={period === 'monthly' ? (isMobile ? 5 : 3) : 0}
                />
                <YAxis
                  stroke="#A0AEC0"
                  style={{ fontSize: '9px', fontWeight: '500' }}
                  domain={[0, yMax]}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="present"
                  stackId="a"
                  fill="url(#presentGrad)"
                  radius={[0, 0, 10, 10]}
                  barSize={period === 'weekly' ? 18 : 12}
                />
                <Bar
                  dataKey="absent"
                  stackId="a"
                  fill="url(#absentGrad)"
                  radius={[10, 10, 0, 0]}
                  barSize={period === 'weekly' ? 18 : 12}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
