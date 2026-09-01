import type { ChartData, TrendData } from "@/types/dashboard"

// Stable color by label
const colorFor = (label: string) => `hsl(${Array.from(label).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0) % 360}, 70%, 55%)`

export function getMotherTongueDistribution(students: any[]): ChartData[] {
  const norm = (s: any) => (s ?? "").toString().trim()
  const distribution = (students || []).reduce(
    (acc: Record<string, number>, student: any) => {
      const key = norm(student.motherTongue)
      if (!key || key === "" || key.toLowerCase() === "unknown") {
        acc["Others"] = (acc["Others"] || 0) + 1
        return acc
      }
      acc[key] = (acc[key] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  // Group languages with count < 10 into "Others"
  const result: ChartData[] = []
  let othersCount = 0
  
  Object.entries(distribution).forEach(([tongue, count]) => {
    if (count < 10) {
      othersCount += count
    } else {
      result.push({
        name: tongue,
        value: count,
        fill: colorFor(tongue),
      })
    }
  })
  
  // Add "Others" if there are any languages with count < 10
  if (othersCount > 0) {
    result.push({
      name: "Others",
      value: othersCount,
      fill: colorFor("Others"),
    })
  }
  
  return result
}

export function getReligionDistribution(students: any[]): ChartData[] {
  const distribution = (students || []).reduce(
    (acc: Record<string, number>, student: any) => {
      const key = (student.religion ?? "").toString().trim()
      if (!key) return acc
      acc[key] = (acc[key] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )
  return Object.entries(distribution).map(([religion, count]) => ({
    name: religion,
    value: count,
    fill: colorFor(religion),
  }))
}

export function getGradeDistribution(students: any[]): ChartData[] {
  const distribution = (students || []).reduce(
    (acc: Record<string, number>, student: any) => {
      const key = (student.grade ?? "").toString().trim()
      if (!key) return acc
      acc[key] = (acc[key] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  return Object.entries(distribution).map(([grade, count]) => ({
    name: grade,
    value: count,
    fill: colorFor(grade),
  }))
}

export function getGenderDistribution(students: any[]): ChartData[] {
  const mapKey = (g: string = "") => g.trim()
  const distribution = (students || []).reduce(
    (acc: Record<string, number>, student: any) => {
      const g = mapKey((student.gender ?? "Unknown").toString())
      if (!g) return acc
      acc[g] = (acc[g] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  return Object.entries(distribution).map(([gender, count]) => ({
    name: gender,
    value: count,
    fill: colorFor(gender),
  }))
}

export function getCampusPerformance(students: any[]): ChartData[] {
  const norm = (s: any) => (s ?? "").toString().trim()
  type Agg = { totalScore: number; count: number; display: string }
  const campusData = (students || []).reduce(
    (acc: Record<string, Agg>, student: any) => {
      const label = norm(student.campus)
      if (!label || label.toLowerCase() === "unknown") return acc
      const key = label.toLowerCase()
      if (!acc[key]) {
        acc[key] = { totalScore: 0, count: 0, display: label }
      }
      acc[key].totalScore += Number(student.averageScore || 0)
      acc[key].count += 1
      return acc
    },
    {} as Record<string, Agg>,
  )

  return Object.values(campusData).map(({ display, totalScore, count }) => ({
    name: display,
    value: count ? Math.round(totalScore / count) : 0,
    fill: colorFor(display),
  }))
}

export function getEnrollmentTrend(students: any[]): TrendData[] {
  // Use enrollment_year from rawData - start from 2023
  const years = Array.from(new Set((students || [])
    .map((s: any) => {
      const enrollYear = s.rawData?.enrollment_year || s.enrollment_year || s.academicYear
      return Number(enrollYear)
    })
    .filter((y: any) => Number.isFinite(y) && y >= 2023) as number[])).sort((a, b) => a - b)

  return years.map((year) => {
    const yearStudents = (students || []).filter((s: any) => {
      const enrollYear = s.rawData?.enrollment_year || s.enrollment_year || s.academicYear
      return Number(enrollYear) === year
    })
    const retainedStudents = yearStudents.filter((s: any) => Boolean(s.retentionFlag))
    return {
      year,
      enrollment: yearStudents.length,
      retention: yearStudents.length ? Math.round((retainedStudents.length / yearStudents.length) * 100) : 0,
    }
  })
}

export function getAgeDistribution(students: any[]): ChartData[] {
  const ageRanges = {
    '5-7': 0,
    '8-10': 0,
    '11-13': 0,
    '14-16': 0,
    '17+': 0,
  }

  students.forEach((student: any) => {
    if (!student.rawData?.dob) return
    
    const dob = new Date(student.rawData.dob)
    const today = new Date()
    let age = today.getFullYear() - dob.getFullYear()
    const monthDiff = today.getMonth() - dob.getMonth()
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--
    }

    if (age >= 5 && age <= 7) ageRanges['5-7']++
    else if (age >= 8 && age <= 10) ageRanges['8-10']++
    else if (age >= 11 && age <= 13) ageRanges['11-13']++
    else if (age >= 14 && age <= 16) ageRanges['14-16']++
    else if (age >= 17) ageRanges['17+']++
  })

  return Object.entries(ageRanges).map(([name, value]) => ({
    name,
    value,
    fill: colorFor(name),
  }))
}

export function getZakatStatusDistribution(students: any[]): ChartData[] {
  const distribution = students.reduce(
    (acc: Record<string, number>, student: any) => {
      const status = (student.rawData?.zakat_status ?? "Not Applicable").toString().trim()
      const normalized = status.toLowerCase().replace('_', ' ')
      acc[normalized] = (acc[normalized] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  return Object.entries(distribution).map(([name, value]) => ({
    name,
    value,
    fill: colorFor(name),
  }))
}

export function getHouseOwnershipDistribution(students: any[]): ChartData[] {
  const distribution = { owned: 0, rented: 0 }

  students.forEach((student: any) => {
    if (student.rawData?.house_owned === true) {
      distribution.owned++
    } else {
      distribution.rented++
    }
  })

  return [
    { name: 'Owned', value: distribution.owned, fill: colorFor('Owned') },
    { name: 'Rented', value: distribution.rented, fill: colorFor('Rented') },
  ]
}


