"use client"

import type { ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarDays, GraduationCap, Trophy, CheckCircle2, Circle } from "lucide-react"

/**
 * Standard grade progression for this school system, oldest to newest.
 * Used only to find a student's position in the ladder — actual grade
 * names/labels always come from the student's own `current_grade`.
 */
const GRADE_LADDER = [
  "Nursery", "KG-I", "KG-II",
  "Grade I", "Grade II", "Grade III", "Grade IV", "Grade V",
  "Grade VI", "Grade VII", "Grade VIII", "Grade IX", "Grade X",
]

function formatAcademicYear(year: number): string {
  return `${year}/${String((year + 1) % 100).padStart(2, "0")}`
}

function findGradeIndex(gradeName?: string | null): number {
  if (!gradeName) return -1
  const normalized = gradeName.trim().toLowerCase()
  return GRADE_LADDER.findIndex((g) => g.toLowerCase() === normalized)
}

type JourneyStatus = "completed" | "current" | "upcoming"

interface JourneyRow {
  academicYear: string
  grade: string
  status: JourneyStatus
}

interface AcademicYearJourneyProps {
  enrollmentYear?: number | string | null
  currentGrade?: string | null
}

/**
 * 🔧 buildJourney()
 * Purpose: Derive the student's full grade-by-grade academic year timeline
 *   from just their enrollment year and current grade — no separate
 *   promotion-history record exists in the backend, so this assumes the
 *   normal case of one grade per year with no repeats.
 * Input: enrollment year (e.g. 2019) and current grade name (e.g. "Grade IV")
 * Output: ordered rows from the student's starting grade through to the
 *   final grade in the ladder, each tagged completed / current / upcoming
 */
function buildJourney(enrollmentYear?: number | string | null, currentGrade?: string | null): JourneyRow[] {
  const currentIndex = findGradeIndex(currentGrade)
  const joinYear = Number(enrollmentYear)
  if (!joinYear || currentIndex === -1) return []

  const currentCalendarYear = new Date().getFullYear()
  const yearsElapsed = Math.max(0, currentCalendarYear - joinYear)
  const startIndex = Math.max(0, currentIndex - yearsElapsed)

  const rows: JourneyRow[] = []
  for (let i = startIndex; i < GRADE_LADDER.length; i++) {
    const status: JourneyStatus = i < currentIndex ? "completed" : i === currentIndex ? "current" : "upcoming"
    rows.push({
      academicYear: formatAcademicYear(joinYear + (i - startIndex)),
      grade: GRADE_LADDER[i],
      status,
    })
  }
  return rows
}

const STATUS_BADGE: Record<JourneyStatus, { text: string; className: string; icon: ReactNode }> = {
  completed: {
    text: "Completed",
    className: "bg-green-100 text-green-700",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  current: {
    text: "Current",
    className: "bg-blue-100 text-[#2563EB]",
    icon: <Circle className="h-3.5 w-3.5 fill-[#2563EB] text-[#2563EB]" />,
  },
  upcoming: {
    text: "Upcoming",
    className: "bg-gray-100 text-gray-500",
    icon: <Circle className="h-3.5 w-3.5" />,
  },
}

export function AcademicYearJourney({ enrollmentYear, currentGrade }: AcademicYearJourneyProps) {
  const rows = buildJourney(enrollmentYear, currentGrade)
  if (rows.length === 0) return null

  const joined = rows[0]
  const current = rows.find((r) => r.status === "current")
  const graduation = rows[rows.length - 1]
  // Only completed/current years are shown — the point is "how far the
  // student has come," not a speculative multi-year forecast.
  const visibleRows = rows.filter((r) => r.status !== "upcoming")

  return (
    <Card className="bg-white border shadow-sm rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold text-[#274c77]">Academic Year Journey</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Timeline table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 border-b">
                <th className="w-8" />
                <th className="py-2 pr-4">Academic Year</th>
                <th className="py-2 pr-4">Grade</th>
                <th className="py-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, i) => {
                const badge = STATUS_BADGE[row.status]
                const isLast = i === visibleRows.length - 1
                return (
                  <tr key={row.academicYear} className="border-b last:border-0">
                    <td className="relative py-3">
                      <div className="flex flex-col items-center">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            row.status === "upcoming" ? "bg-gray-300" : "bg-[#2563EB]"
                          }`}
                        />
                        {!isLast && <span className="w-px flex-1 bg-gray-200 mt-1" style={{ minHeight: "1.25rem" }} />}
                      </div>
                    </td>
                    <td className="py-3 pr-4 font-medium text-gray-800 whitespace-nowrap">{row.academicYear}</td>
                    <td className="py-3 pr-4 text-gray-700 whitespace-nowrap">{row.grade}</td>
                    <td className="py-3 pr-4">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${badge.className}`}>
                        {badge.icon}
                        {badge.text}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-5 sm:mt-6">
          <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3 sm:p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#2563EB]">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Year Joined</p>
              <p className="text-sm font-semibold text-gray-800">{joined.academicYear}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3 sm:p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#2563EB]">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Current Academic Year</p>
              <p className="text-sm font-semibold text-gray-800">{current?.academicYear || "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3 sm:p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#2563EB]">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Expected Graduation</p>
              <p className="text-sm font-semibold text-gray-800">{graduation.academicYear}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
