"use client"

import { useEffect, useState, useMemo, useCallback, Fragment } from "react"
import {
  Users,
  CheckCircle2,
  XCircle,
  TrendingUp,
  RefreshCcw,
  Calendar,
  AlertCircle,
  FileText,
  UserX,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { fetchDailySummary, toApiDate } from "@/lib/attendance-review-api"
import type { DailySummaryResponse, DailySummaryRow } from "@/types/attendance-review"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

interface TodaysAttendanceSummaryProps {
  /** Optional initial date (YYYY-MM-DD). Defaults to today. */
  initialDate?: string
  /** Custom title if needed */
  title?: string
  /** Class name override for container */
  className?: string
}

export default function TodaysAttendanceSummary({
  initialDate,
  title = "Today's Daily Attendance Summary",
  className = "",
}: TodaysAttendanceSummaryProps) {
  const todayStr = useMemo(() => toApiDate(new Date()), [])
  const [selectedDate, setSelectedDate] = useState<string>(initialDate || todayStr)
  const [activePreset, setActivePreset] = useState<string>("today")
  const [data, setData] = useState<DailySummaryResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false)

  const loadData = useCallback(async (dateToFetch: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchDailySummary(dateToFetch)
      setData(res)
    } catch (err: any) {
      console.error("Failed to load daily attendance summary:", err)
      setError(err?.message || "Failed to load today's attendance summary.")
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadData(selectedDate)
  }, [selectedDate, loadData])

  const handleRefresh = () => {
    setIsRefreshing(true)
    loadData(selectedDate)
  }

  const isToday = selectedDate === todayStr
  const rows = data?.rows || []
  const summary = data?.summary || {
    total_students: 0,
    present: 0,
    absent: 0,
    boys_present: 0,
    total_boys: 0,
    girls_present: 0,
    total_girls: 0,
    class_count: 0,
    attendance_pct: 0,
  }

  // Calculate footer totals dynamically from displayed rows
  const calculatedTotals = useMemo(() => {
    if (!rows.length) return summary
    const total_students = rows.reduce((acc, r) => acc + (r.no_on_roll || 0), 0)
    const present = rows.reduce((acc, r) => acc + (r.present || 0), 0)
    const absent = rows.reduce((acc, r) => acc + (r.absent || 0), 0)
    const boys_present = rows.reduce((acc, r) => acc + (r.boys_present || 0), 0)
    const total_boys = rows.reduce((acc, r) => acc + (r.total_boys || 0), 0)
    const girls_present = rows.reduce((acc, r) => acc + (r.girls_present || 0), 0)
    const total_girls = rows.reduce((acc, r) => acc + (r.total_girls || 0), 0)
    const attendance_pct = total_students > 0 ? Number(((present / total_students) * 100).toFixed(2)) : 0
    return {
      total_students,
      present,
      absent,
      boys_present,
      total_boys,
      girls_present,
      total_girls,
      class_count: rows.length,
      attendance_pct,
    }
  }, [rows, summary])

  // Group the flat class rows by grade, preserving the backend's sort order
  // (grade order, then section), so the table reads like the review tree above
  // it: an expandable grade row whose children are its classes.
  const gradeGroups = useMemo(() => {
    const groups: { key: string; grade_name: string; rows: DailySummaryRow[] }[] = []
    const byKey = new Map<string, { key: string; grade_name: string; rows: DailySummaryRow[] }>()
    for (const r of rows) {
      const key = r.grade_id != null ? `g:${r.grade_id}` : `x:${r.class_name}`
      let group = byKey.get(key)
      if (!group) {
        group = { key, grade_name: r.grade_name || "Other", rows: [] }
        byKey.set(key, group)
        groups.push(group)
      }
      group.rows.push(r)
    }
    return groups
  }, [rows])

  const [expandedGrades, setExpandedGrades] = useState<Set<string>>(new Set())

  const toggleGrade = (key: string) => {
    setExpandedGrades((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Aggregated figures for an expandable grade row — the sum of its classes.
  const gradeTotals = (groupRows: DailySummaryRow[]) => {
    const sum = (get: (r: DailySummaryRow) => number) =>
      groupRows.reduce((acc, r) => acc + (get(r) || 0), 0)
    const total_students = sum((r) => r.no_on_roll)
    const present = sum((r) => r.present)
    const attendance_pct =
      total_students > 0 ? Number(((present / total_students) * 100).toFixed(2)) : 0
    return {
      total_students,
      present,
      absent: sum((r) => r.absent),
      boys_present: sum((r) => r.boys_present),
      total_boys: sum((r) => r.total_boys),
      girls_present: sum((r) => r.girls_present),
      total_girls: sum((r) => r.total_girls),
      attendance_pct,
    }
  }

  const handleExportPdf = () => {
    if (!data || !rows.length) return
    setIsExportingPdf(true)

    try {
      // Create landscape A4 PDF document
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      })

      const campusTitle = data.campus ? data.campus : "Campus"

      // Title & Subtitle Header
      doc.setFont("helvetica", "bold")
      doc.setFontSize(16)
      doc.setTextColor(22, 59, 92) // #163B5C
      doc.text(title, 14, 15)

      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      doc.setTextColor(100, 116, 139) // Slate-500
      doc.text(`${campusTitle} — Daily Summary Report for ${selectedDate}`, 14, 21)

      // KPI Highlights Box
      doc.setFillColor(248, 250, 252) // Slate-50
      doc.setDrawColor(226, 232, 240) // Slate-200
      doc.roundedRect(14, 25, 269, 16, 2, 2, "FD")

      doc.setFontSize(9)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(22, 59, 92)

      const kpiY = 35
      doc.text(`Total Students: ${calculatedTotals.total_students.toLocaleString()}`, 20, kpiY)
      doc.text(`Present: ${calculatedTotals.present.toLocaleString()}`, 75, kpiY)
      doc.text(`Absent: ${calculatedTotals.absent.toLocaleString()}`, 120, kpiY)
      doc.text(`Boys: ${calculatedTotals.boys_present}/${calculatedTotals.total_boys}`, 165, kpiY)
      doc.text(`Girls: ${calculatedTotals.girls_present}/${calculatedTotals.total_girls}`, 210, kpiY)
      doc.text(`Overall %: ${calculatedTotals.attendance_pct.toFixed(2)}%`, 250, kpiY)

      // Prepare Table Data
      const head = [
        [
          "Name of Class",
          "Teacher Name",
          "No. on Roll",
          "Present",
          "Absent",
          "Boys Present",
          "Total Boys",
          "Girls Present",
          "Total Girls",
          "Attendance %",
        ],
      ]

      const tableRows = rows.map((r) => [
        r.class_name,
        r.teacher?.name || "Not Assigned",
        r.no_on_roll,
        r.present,
        r.absent,
        r.boys_present ?? 0,
        r.total_boys ?? 0,
        r.girls_present ?? 0,
        r.total_girls ?? 0,
        `${r.attendance_pct.toFixed(2)}%`,
      ])

      const foot = [
        [
          "TOTAL",
          "—",
          calculatedTotals.total_students.toLocaleString(),
          calculatedTotals.present.toLocaleString(),
          calculatedTotals.absent.toLocaleString(),
          calculatedTotals.boys_present.toLocaleString(),
          calculatedTotals.total_boys.toLocaleString(),
          calculatedTotals.girls_present.toLocaleString(),
          calculatedTotals.total_girls.toLocaleString(),
          `${calculatedTotals.attendance_pct.toFixed(2)}%`,
        ],
      ]

      autoTable(doc, {
        startY: 46,
        head,
        body: tableRows,
        foot,
        theme: "striped",
        headStyles: {
          fillColor: [22, 59, 92],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 9,
          halign: "center",
        },
        footStyles: {
          fillColor: [240, 244, 248],
          textColor: [22, 59, 92],
          fontStyle: "bold",
          fontSize: 9,
          halign: "center",
        },
        bodyStyles: {
          fontSize: 8.5,
          textColor: [51, 65, 85],
        },
        columnStyles: {
          0: { halign: "left", fontStyle: "bold" },
          1: { halign: "left" },
          2: { halign: "center", fontStyle: "bold" },
          3: { halign: "center", textColor: [16, 185, 129] }, // Emerald
          4: { halign: "center", textColor: [225, 29, 72] }, // Rose
          5: { halign: "center", fillColor: [239, 246, 255] }, // Blue-50
          6: { halign: "center", fillColor: [239, 246, 255] },
          7: { halign: "center", fillColor: [253, 242, 248] }, // Pink-50
          8: { halign: "center", fillColor: [253, 242, 248] },
          9: { halign: "right", fontStyle: "bold" },
        },
        alternateRowStyles: {
          fillColor: [250, 250, 250],
        },
        margin: { left: 14, right: 14 },
      })

      // Page numbers footer
      const pageCount = (doc as any).internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(148, 163, 184)
        doc.text(
          `Generated on ${new Date().toLocaleDateString()} — Page ${i} of ${pageCount}`,
          14,
          doc.internal.pageSize.getHeight() - 8
        )
      }

      doc.save(`Daily_Attendance_Summary_${selectedDate}.pdf`)
    } catch (err) {
      console.error("PDF generation failed:", err)
    } finally {
      setIsExportingPdf(false)
    }
  }

  const getPercentageBadge = (pct: number) => {
    if (pct >= 90) {
      return "bg-emerald-50 text-emerald-700 border-emerald-200"
    } else if (pct >= 75) {
      return "bg-amber-50 text-amber-700 border-amber-200"
    } else {
      return "bg-rose-50 text-rose-700 border-rose-200"
    }
  }

  return (
    <div className={`space-y-6 ${className}`} id="todays-attendance-summary-container">
      {/* Container Card */}
      <Card className="border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl overflow-hidden bg-white" id="todays-attendance-summary-card">
        <CardHeader className="bg-gradient-to-r from-[#163B5C]/5 via-transparent to-transparent border-b border-gray-100 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-[#163B5C]/10 text-[#163B5C]">
                  <Calendar className="w-5 h-5" />
                </span>
                <CardTitle className="text-xl font-bold text-[#163B5C] tracking-tight">
                  {title}
                </CardTitle>
              </div>
              <p className="text-xs text-gray-500 mt-1 pl-9">
                {data?.campus ? `${data.campus} — ` : ""}
                {activePreset === "today" && isToday
                  ? "Campus-wide real-time attendance snapshot for today"
                  : `Daily summary for ${selectedDate}`}
              </p>
            </div>

            {/* Controls Bar */}
            <div className="flex items-center flex-wrap gap-2.5 no-print">
              {/* Date Picker */}
              <div className="relative flex items-center">
                <Calendar className="absolute left-2.5 h-3.5 w-3.5 text-[#163B5C] pointer-events-none" />
                <input
                  type="date"
                  value={selectedDate}
                  max={todayStr}
                  onChange={(e) => {
                    if (e.target.value) {
                      setActivePreset("custom")
                      setSelectedDate(e.target.value)
                    }
                  }}
                  className="bg-white border border-gray-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2F6B8A]/20 focus:border-[#2F6B8A] cursor-pointer"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={loading}
                title="Refresh Attendance Data"
                className="h-8 w-8 p-0 rounded-xl border-gray-200 hover:bg-gray-50 text-gray-600"
              >
                <RefreshCcw className={`w-3.5 h-3.5 ${isRefreshing || loading ? "animate-spin" : ""}`} />
              </Button>

              {/* Export PDF Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPdf}
                disabled={loading || !rows.length || isExportingPdf}
                title="Export as PDF Document"
                className="h-8 px-3 rounded-xl border-gray-200 hover:bg-gray-50 text-xs font-medium text-gray-700 gap-1.5"
              >
                <FileText className="w-3.5 h-3.5 text-rose-600" />
                <span className="hidden md:inline">{isExportingPdf ? "Exporting..." : "Export PDF"}</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-6">
          {/* Loading Skeleton */}
          {loading && !data && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-24 bg-gray-100 rounded-2xl" />
                ))}
              </div>
              <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
            </div>
          )}

          {/* Error Message */}
          {error && !loading && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center gap-3 text-rose-700 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <div className="flex-1">{error}</div>
              <Button size="sm" variant="outline" onClick={handleRefresh} className="border-rose-300 text-rose-700 hover:bg-rose-100">
                Retry
              </Button>
            </div>
          )}

          {!loading && data && (
            <>
              {/* 1. Campus Attendance Summary (Top KPI Section) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* Total Students */}
                <div className="bg-gradient-to-br from-blue-50/60 to-slate-50/50 rounded-2xl border border-blue-100 p-4 shadow-sm flex items-center gap-3 sm:gap-4">
                  <div className="p-3 rounded-xl bg-blue-500/10 text-[#163B5C] flex-shrink-0">
                    <Users className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Students</p>
                    <p className="text-2xl sm:text-3xl font-extrabold text-[#163B5C] leading-tight">
                      {calculatedTotals.total_students.toLocaleString()}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Boys: {calculatedTotals.total_boys} | Girls: {calculatedTotals.total_girls}
                    </p>
                  </div>
                </div>

                {/* Present Students */}
                <div className="bg-gradient-to-br from-emerald-50/60 to-slate-50/50 rounded-2xl border border-emerald-100 p-4 shadow-sm flex items-center gap-3 sm:gap-4">
                  <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 flex-shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Present</p>
                    <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 leading-tight">
                      {calculatedTotals.present.toLocaleString()}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Boys: {calculatedTotals.boys_present} | Girls: {calculatedTotals.girls_present}
                    </p>
                  </div>
                </div>

                {/* Absent Students */}
                <div className="bg-gradient-to-br from-rose-50/60 to-slate-50/50 rounded-2xl border border-rose-100 p-4 shadow-sm flex items-center gap-3 sm:gap-4">
                  <div className="p-3 rounded-xl bg-rose-500/10 text-rose-600 flex-shrink-0">
                    <XCircle className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Absent</p>
                    <p className="text-2xl sm:text-3xl font-extrabold text-rose-600 leading-tight">
                      {calculatedTotals.absent.toLocaleString()}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Not present today</p>
                  </div>
                </div>

                {/* Overall Attendance Percentage */}
                <div className="bg-gradient-to-br from-indigo-50/60 to-slate-50/50 rounded-2xl border border-indigo-100 p-4 shadow-sm flex items-center gap-3 sm:gap-4">
                  <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-600 flex-shrink-0">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Overall Attendance</p>
                    <p className="text-2xl sm:text-3xl font-extrabold text-indigo-700 leading-tight">
                      {calculatedTotals.attendance_pct.toFixed(2)}%
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Campus attendance rate</p>
                  </div>
                </div>
              </div>

              {/* 2. Class-wise Attendance Summary Table / Empty State */}
              {rows.length === 0 || (calculatedTotals.present === 0 && calculatedTotals.absent === 0 && calculatedTotals.total_students === 0) ? (
                /* Empty State */
                <div className="bg-gray-50/80 border border-dashed border-gray-200 rounded-2xl p-8 text-center flex flex-col items-center justify-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400">
                    <UserX className="w-6 h-6" />
                  </div>
                  <div className="max-w-md space-y-1">
                    <h4 className="text-base font-bold text-gray-700">No attendance has been submitted for today.</h4>
                    <p className="text-xs text-gray-500">
                      Attendance registers for {selectedDate} have not been submitted yet by class teachers, or no active classes are configured.
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={handleRefresh} className="mt-2 text-xs border-gray-200 text-gray-700">
                    <RefreshCcw className="w-3.5 h-3.5 mr-1.5" /> Check Again
                  </Button>
                </div>
              ) : (
                <div className="border border-gray-150 rounded-2xl overflow-hidden shadow-sm bg-white">
                  <div className="overflow-x-auto max-w-full">
                    <table className="w-full text-left text-xs sm:text-sm border-collapse">
                      <thead>
                        <tr className="bg-[#163B5C] text-white text-xs font-bold uppercase tracking-wider">
                          <th className="w-8 py-3 px-2" aria-label="Toggle grade" />
                          <th className="py-3 px-3 sm:px-4">Name of Class</th>
                          <th className="py-3 px-3 sm:px-4">Teacher Name</th>
                          <th className="py-3 px-3 sm:px-4 text-center">No. on Roll</th>
                          <th className="py-3 px-3 sm:px-4 text-center">Present</th>
                          <th className="py-3 px-3 sm:px-4 text-center">Absent</th>
                          <th className="py-3 px-3 sm:px-4 text-center bg-[#1f4a72]">Boys Present</th>
                          <th className="py-3 px-3 sm:px-4 text-center bg-[#1f4a72]">Total Boys</th>
                          <th className="py-3 px-3 sm:px-4 text-center bg-[#255683]">Girls Present</th>
                          <th className="py-3 px-3 sm:px-4 text-center bg-[#255683]">Total Girls</th>
                          <th className="py-3 px-3 sm:px-4 text-right">Attendance %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {gradeGroups.map((group) => {
                          const expanded = expandedGrades.has(group.key)
                          const totals = gradeTotals(group.rows)

                          return (
                            <Fragment key={group.key}>
                              {/* Grade row — expandable, shows the grade's aggregate */}
                              <tr
                                className="cursor-pointer hover:bg-slate-50/80 transition-colors bg-[#163B5C]/[0.04]"
                                onClick={() => toggleGrade(group.key)}
                              >
                                <td className="py-3 px-2 text-center">
                                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-[#163B5C]/10 text-[#163B5C]">
                                    {expanded ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                  </span>
                                </td>
                                <td className="py-3 px-3 sm:px-4">
                                  <div className="font-bold text-[#163B5C]">{group.grade_name}</div>
                                  <div className="text-[11px] text-gray-500">
                                    {group.rows.length} class{group.rows.length !== 1 ? "es" : ""}
                                  </div>
                                </td>
                                <td className="py-3 px-3 sm:px-4 text-gray-400 font-medium">—</td>
                                <td className="py-3 px-3 sm:px-4 text-center font-bold text-gray-800">
                                  {totals.total_students}
                                </td>
                                <td className="py-3 px-3 sm:px-4 text-center font-extrabold text-emerald-600">
                                  {totals.present}
                                </td>
                                <td className="py-3 px-3 sm:px-4 text-center font-extrabold text-rose-600">
                                  {totals.absent}
                                </td>
                                <td className="py-3 px-3 sm:px-4 text-center font-semibold text-blue-700 bg-blue-50/30">
                                  {totals.boys_present}
                                </td>
                                <td className="py-3 px-3 sm:px-4 text-center font-bold text-slate-700 bg-blue-50/30">
                                  {totals.total_boys}
                                </td>
                                <td className="py-3 px-3 sm:px-4 text-center font-semibold text-pink-700 bg-pink-50/30">
                                  {totals.girls_present}
                                </td>
                                <td className="py-3 px-3 sm:px-4 text-center font-bold text-slate-700 bg-pink-50/30">
                                  {totals.total_girls}
                                </td>
                                <td className="py-3 px-3 sm:px-4 text-right whitespace-nowrap">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold border ${getPercentageBadge(totals.attendance_pct)}`}>
                                    {totals.attendance_pct.toFixed(2)}%
                                  </span>
                                </td>
                              </tr>

                              {/* Class rows for this grade, shown when expanded */}
                              {expanded &&
                                group.rows.map((row) => {
                                  const teacherName = row.teacher?.name
                                  const pct = row.attendance_pct || 0

                                  return (
                                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                                      <td className="py-2 px-2" />
                                      <td className="py-2 pl-8 pr-3 sm:pl-10 sm:pr-4 whitespace-nowrap">
                                        <div className="font-semibold text-gray-700">{row.class_name}</div>
                                      </td>
                                      <td className="py-2 px-3 sm:px-4 whitespace-nowrap">
                                        {teacherName ? (
                                          <span className="font-medium text-gray-600">{teacherName}</span>
                                        ) : (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                            Not Assigned
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-2 px-3 sm:px-4 text-center font-bold text-gray-800">
                                        {row.no_on_roll}
                                      </td>
                                      <td className="py-2 px-3 sm:px-4 text-center font-extrabold text-emerald-600">
                                        {row.present}
                                      </td>
                                      <td className="py-2 px-3 sm:px-4 text-center font-extrabold text-rose-600">
                                        {row.absent}
                                      </td>
                                      <td className="py-2 px-3 sm:px-4 text-center font-semibold text-blue-700 bg-blue-50/30">
                                        {row.boys_present ?? 0}
                                      </td>
                                      <td className="py-2 px-3 sm:px-4 text-center font-bold text-slate-700 bg-blue-50/30">
                                        {row.total_boys ?? 0}
                                      </td>
                                      <td className="py-2 px-3 sm:px-4 text-center font-semibold text-pink-700 bg-pink-50/30">
                                        {row.girls_present ?? 0}
                                      </td>
                                      <td className="py-2 px-3 sm:px-4 text-center font-bold text-slate-700 bg-pink-50/30">
                                        {row.total_girls ?? 0}
                                      </td>
                                      <td className="py-2 px-3 sm:px-4 text-right whitespace-nowrap">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold border ${getPercentageBadge(pct)}`}>
                                          {pct.toFixed(2)}%
                                        </span>
                                      </td>
                                    </tr>
                                  )
                                })}
                            </Fragment>
                          )
                        })}
                      </tbody>

                      {/* Footer Totals */}
                      <tfoot className="bg-[#163B5C]/5 border-t-2 border-[#163B5C]/20 font-bold text-[#163B5C]">
                        <tr>
                          <td className="py-3.5 px-2" />
                          <td className="py-3.5 px-3 sm:px-4 text-xs sm:text-sm font-black uppercase">TOTAL</td>
                          <td className="py-3.5 px-3 sm:px-4 text-gray-400 font-semibold">—</td>
                          <td className="py-3.5 px-3 sm:px-4 text-center text-xs sm:text-sm font-black text-gray-900">
                            {calculatedTotals.total_students.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-3 sm:px-4 text-center text-xs sm:text-sm font-black text-emerald-700">
                            {calculatedTotals.present.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-3 sm:px-4 text-center text-xs sm:text-sm font-black text-rose-700">
                            {calculatedTotals.absent.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-3 sm:px-4 text-center text-xs sm:text-sm font-black text-blue-800 bg-blue-100/40">
                            {calculatedTotals.boys_present.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-3 sm:px-4 text-center text-xs sm:text-sm font-black text-slate-800 bg-blue-100/40">
                            {calculatedTotals.total_boys.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-3 sm:px-4 text-center text-xs sm:text-sm font-black text-pink-800 bg-pink-100/40">
                            {calculatedTotals.girls_present.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-3 sm:px-4 text-center text-xs sm:text-sm font-black text-slate-800 bg-pink-100/40">
                            {calculatedTotals.total_girls.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-3 sm:px-4 text-right text-xs sm:text-sm font-black">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black bg-[#163B5C] text-white shadow-sm">
                              {calculatedTotals.attendance_pct.toFixed(2)}%
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
