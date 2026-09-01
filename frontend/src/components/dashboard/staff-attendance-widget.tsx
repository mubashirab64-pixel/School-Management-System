"use client"

import { useEffect, useState } from "react"
import { WeeklyAttendanceChart } from "./weekly-attendance-chart"
import { getStaffDailyAttendanceStats } from "@/lib/api"

type AttendancePeriod = 'weekly' | 'monthly' | '3month' | '6month'

interface StaffAttendanceWidgetProps {
  campusId?: string | number
}

const DAYS_FOR_PERIOD: Record<AttendancePeriod, number> = {
  weekly: 7,
  monthly: 30,
  '3month': 90,
  '6month': 180,
}

// Buckets a flat day-list (as returned by getStaffDailyAttendanceStats) into
// one row per month — same aggregation the student widget does for 3/6 months.
function bucketByMonth(days: Array<{ date: string; present: number; absent: number }>) {
  const monthMap: Record<string, { day: string; present: number; absent: number; order: number }> = {}
  days.forEach((d) => {
    const date = new Date(d.date)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const label = `${date.toLocaleString('default', { month: 'short' })} '${String(date.getFullYear()).slice(2)}`
    if (!monthMap[key]) monthMap[key] = { day: label, present: 0, absent: 0, order: date.getFullYear() * 100 + date.getMonth() }
    monthMap[key].present += d.present
    monthMap[key].absent += d.absent
  })
  return Object.values(monthMap).sort((a, b) => a.order - b.order)
}

/** Staff-equivalent of the dashboard's student Attendance Overview widget —
 * a separate, self-contained card (own fetch/loading state) so it doesn't
 * touch the existing student attendance pipeline. */
export function StaffAttendanceWidget({ campusId }: StaffAttendanceWidgetProps) {
  const [period, setPeriod] = useState<AttendancePeriod>('weekly')
  const [data, setData] = useState<Array<{ day: string; present: number; absent: number }>>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    getStaffDailyAttendanceStats(DAYS_FOR_PERIOD[period], campusId)
      .then((days) => {
        if (cancelled) return
        if (period === '3month' || period === '6month') {
          setData(bucketByMonth(days))
        } else if (period === 'weekly') {
          // Match the student widget's convention of hiding Sunday on the weekly view.
          setData(days.filter((d) => new Date(d.date).getDay() !== 0))
        } else {
          setData(days.map((d) => ({ ...d, day: `${new Date(d.date).getDate()} ${new Date(d.date).toLocaleString('default', { month: 'short' })}` })))
        }
      })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [period, campusId])

  return (
    <WeeklyAttendanceChart
      data={data}
      isLoading={isLoading}
      campusId={campusId}
      period={period}
      onPeriodChange={setPeriod}
      title="Staff Attendance Overview"
      description="Teacher, coordinator & principal attendance"
      showExport
      exportPath="/api/attendance/staff/export-csv/"
      exportCampusParam="campus_id"
      exportFilenamePrefix="Staff_Attendance_Report"
    />
  )
}
