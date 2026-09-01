"use client"

import React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
// mock data removed; using real API data only
import { getAllCampuses, getStudentCampusStats, getTeacherCampusStats, getClassroomCampusStats, apiGet } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Search, Building2, MapPin, Users, GraduationCap, ChevronRight, Loader2, LayoutGrid, User } from "lucide-react"
import { getCurrentUserRole, usePermissions } from "@/lib/permissions"
import { CacheManager } from "@/lib/cache"

export default function CampusListPage() {
  useEffect(() => {
    document.title = "Campus List | Newton AMS";
  }, []);

  const router = useRouter()
  const [query, setQuery] = React.useState("")
  const [campuses, setCampuses] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [realStudentCounts, setRealStudentCounts] = React.useState<Record<number, number>>({})
  const [realTeacherCounts, setRealTeacherCounts] = React.useState<Record<number, number>>({})
  const [realClassroomCounts, setRealClassroomCounts] = React.useState<Record<number, number>>({})
  const [principalsByCampus, setPrincipalsByCampus] = React.useState<Record<number, { name: string; photo?: string }>>({})

  // Role-based access control
  const { canAddCampus } = usePermissions()
  const [userRole, setUserRole] = React.useState<string>("")

  React.useEffect(() => {
    setUserRole(getCurrentUserRole())
  }, [])

  // Fetch the actual Principal assigned to each campus (not the free-text head field)
  React.useEffect(() => {
    let mounted = true
    apiGet('/api/principals/?page_size=500')
      .then((data: any) => {
        if (!mounted) return
        const list = Array.isArray(data) ? data : (data?.results || [])
        const map: Record<number, { name: string; photo?: string }> = {}
        list.forEach((p: any) => {
          const cid = typeof p.campus === 'object' ? p.campus?.id : p.campus
          if (cid && !map[cid] && (p.is_currently_active !== false)) {
            map[cid] = { name: p.full_name || '', photo: p.photo || undefined }
          }
        })
        setPrincipalsByCampus(map)
      })
      .catch(() => { })
    return () => { mounted = false }
  }, [])

  const filtered = (Array.isArray(campuses) ? campuses : [])
    .filter((c: any) =>
      (c?.campus_name || c?.name || "").toLowerCase().includes(query.toLowerCase())
    )
    .sort((a, b) => {
      const nameA = (a?.campus_name || a?.name || "");
      const nameB = (b?.campus_name || b?.name || "");

      // Extract numbers from campus names (e.g., "Campus 1" -> 1)
      const numA = parseInt(nameA.match(/\d+/)?.[0] || "0");
      const numB = parseInt(nameB.match(/\d+/)?.[0] || "0");

      // Sort by number in ascending order
      if (numA !== numB) {
        return numA - numB;
      }

      // If numbers are same or not found, fallback to alphabetical
      return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    });

  // metrics from API data only (fallbacks to 0 for avg score)

  React.useEffect(() => {
    let mounted = true

    // Try to hydrate from cache first so revisits are instant
    const cachedCampuses = CacheManager.get(CacheManager.KEYS.CAMPUSES) as any[] | null
    const cachedStudentCounts = CacheManager.get(CacheManager.KEYS.CAMPUS_STUDENT_COUNTS) as Record<number, number> | null
    const cachedTeacherCounts = CacheManager.get(CacheManager.KEYS.CAMPUS_TEACHER_COUNTS) as Record<number, number> | null
    const cachedClassroomCounts = CacheManager.get(CacheManager.KEYS.CAMPUS_CLASSROOM_COUNTS) as Record<number, number> | null

    if (cachedCampuses && mounted) setCampuses(cachedCampuses)
    if (cachedStudentCounts && mounted) setRealStudentCounts(cachedStudentCounts)
    if (cachedTeacherCounts && mounted) setRealTeacherCounts(cachedTeacherCounts)
    if (cachedClassroomCounts && mounted) setRealClassroomCounts(cachedClassroomCounts)

    const hasFullCache = !!(cachedCampuses && cachedStudentCounts && cachedTeacherCounts && cachedClassroomCounts)

    if (!hasFullCache) {
      setLoading(true)

      // Fetch campuses and aggregate counts (students + teachers) using lightweight stats APIs
      Promise.all([
        getAllCampuses(),
        getStudentCampusStats(),
        getTeacherCampusStats(),
        getClassroomCampusStats()
      ])
        .then(([campusesData, studentStats, teacherStats, classroomStats]) => {
          if (!mounted) return

          const list = Array.isArray(campusesData)
            ? campusesData
            : (Array.isArray((campusesData as any)?.results) ? (campusesData as any).results : [])

          setCampuses(list)

          const studentCounts: Record<number, number> = {}
          const teacherCounts: Record<number, number> = {}
          const classroomCounts: Record<number, number> = {}

          list.forEach((campus: any) => {
            if (!campus?.id) return
            const campusName = campus.campus_name || campus.name

            const studentStat = Array.isArray(studentStats)
              ? studentStats.find((s) => s.campus === campusName)
              : undefined
            const teacherStat = Array.isArray(teacherStats)
              ? teacherStats.find((t) => t.campus === campusName)
              : undefined
            const classroomStat = Array.isArray(classroomStats)
              ? classroomStats.find((cl) => cl.campus === campusName)
              : undefined

            studentCounts[campus.id] = studentStat?.count ?? 0
            teacherCounts[campus.id] = teacherStat?.count ?? 0
            classroomCounts[campus.id] = classroomStat?.count ?? 0
          })

          setRealStudentCounts(studentCounts)
          setRealTeacherCounts(teacherCounts)
          setRealClassroomCounts(classroomCounts)

          // Cache the final data for fast revisits while the user is logged in
          CacheManager.set(CacheManager.KEYS.CAMPUSES, list, 30 * 60 * 1000)
          CacheManager.set(CacheManager.KEYS.CAMPUS_STUDENT_COUNTS, studentCounts, 30 * 60 * 1000)
          CacheManager.set(CacheManager.KEYS.CAMPUS_TEACHER_COUNTS, teacherCounts, 30 * 60 * 1000)
          CacheManager.set(CacheManager.KEYS.CAMPUS_CLASSROOM_COUNTS, classroomCounts, 30 * 60 * 1000)
        })
        .catch((err) => {
          console.error(err)
          if (!mounted) return
          setError(err.message || "Failed to load campuses")
        })
        .finally(() => mounted && setLoading(false))
    }

    return () => {
      mounted = false
    }
  }, [])

  // Helper function to get full image URL
  const getImageUrl = (imagePath: string | null | undefined) => {
    if (!imagePath) return null
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath
    }
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL!
    return `${apiBase}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`
  }

  const isSuperAdmin = userRole === "superadmin"

  // Aggregate metrics for superadmin overview cards
  const summary = React.useMemo(() => {
    const campusArray = Array.isArray(campuses) ? campuses : []
    let totalStudents = 0
    let totalTeachers = 0
    let totalClassrooms = 0

    campusArray.forEach((c: any) => {
      if (!c?.id) return
      const s = realStudentCounts.hasOwnProperty(c.id)
        ? realStudentCounts[c.id]
        : (typeof c.num_students === 'number' ? c.num_students : (c.total_students || 0))
      const t = realTeacherCounts.hasOwnProperty(c.id)
        ? realTeacherCounts[c.id]
        : (c.total_teachers || 0)
      const cl = realClassroomCounts.hasOwnProperty(c.id)
        ? realClassroomCounts[c.id]
        : (c.total_classrooms || c.num_classrooms || 0)

      totalStudents += s || 0
      totalTeachers += t || 0
      totalClassrooms += cl || 0
    })

    return {
      totalCampuses: campusArray.length,
      totalStudents,
      totalTeachers,
      totalClassrooms,
    }
  }, [campuses, realStudentCounts, realTeacherCounts, realClassroomCounts])

  const topCampusesByStudents = React.useMemo(() => {
    const campusArray = Array.isArray(campuses) ? campuses : []
    const scored = campusArray.map((c: any) => {
      const hasRealStudentCount = realStudentCounts.hasOwnProperty(c.id)
      const studentCount = hasRealStudentCount
        ? realStudentCounts[c.id]
        : (typeof c.num_students === 'number' ? c.num_students : (c.total_students || 0))
      return { campus: c, studentCount }
    })
      .sort((a, b) => (b.studentCount || 0) - (a.studentCount || 0))
      .slice(0, 5)

    return scored
  }, [campuses, realStudentCounts])

  const statusBadgeClass = (status: string) =>
    status === 'active'
      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
      : status === 'inactive'
        ? 'bg-amber-50 text-amber-700 border border-amber-200'
        : 'bg-gray-100 text-gray-600 border border-gray-200'

  const kpis = [
    { label: 'Total Campuses', value: summary.totalCampuses, Icon: Building2, color: '#274c77' },
    { label: 'Total Students', value: summary.totalStudents, Icon: Users, color: '#6096ba' },
    { label: 'Total Teachers', value: summary.totalTeachers, Icon: GraduationCap, color: '#059669' },
    { label: 'Total Classrooms', value: summary.totalClassrooms, Icon: LayoutGrid, color: '#7c3aed' },
  ]

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold" style={{ color: '#274c77' }}>Campus List</h1>
          <p className="text-sm text-gray-600 mt-1">Manage campuses, profiles and quick actions</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative flex-1 sm:flex-initial sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search campuses..."
              className="w-full h-10 pl-9 pr-3 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2F6B8A]/20 focus:border-[#2F6B8A] transition-colors"
              aria-label="Search campuses"
            />
          </div>
          {canAddCampus && (
            <Button
              onClick={() => router.push("/admin/campus/add")}
              style={{ backgroundColor: '#274c77' }}
              className="flex items-center gap-2 h-10 px-4 whitespace-nowrap font-semibold"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden xs:inline">Add Campus</span>
              <span className="xs:hidden">Add</span>
            </Button>
          )}
        </div>
      </div>

      {/* Summary KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
        {kpis.map(({ label, value, Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide truncate">{label}</div>
              {loading ? (
                <div className="h-7 w-12 bg-gray-200 animate-pulse rounded mt-1.5" />
              ) : (
                <div className="text-2xl font-black mt-1" style={{ color: '#274c77' }}>{value}</div>
              )}
            </div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}1A` }}>
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
          </div>
        ))}
      </div>

      {/* Campus Cards */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#274c77]" />
          <p className="text-gray-600">Loading campuses...</p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <p className="text-red-600 font-medium">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-700 font-medium">No campuses found</p>
          <p className="text-sm text-gray-500 mt-2">
            {query ? 'Try adjusting your search query' : 'Get started by adding a new campus'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c, i) => {
            const hasRealStudentCount = realStudentCounts.hasOwnProperty(c.id)
            const studentCount = hasRealStudentCount ? realStudentCounts[c.id] : (typeof c.num_students === 'number' ? c.num_students : (c.total_students || 0))

            const hasRealTeacherCount = realTeacherCounts.hasOwnProperty(c.id)
            const teacherCount = hasRealTeacherCount ? realTeacherCounts[c.id] : (c.total_teachers || 0)

            const hasRealClassroomCount = realClassroomCounts.hasOwnProperty(c.id)
            const classroomCount = hasRealClassroomCount ? realClassroomCounts[c.id] : (c.total_classrooms || c.num_classrooms || 0)

            const code = c.campus_code || c.code || `C${String(i + 1).padStart(2, "0")}`
            const location = c.address_full || c.address
            const cityLine = c.city
              ? `${c.city.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')}${c.district ? `, ${c.district.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')}` : ''}`
              : ''

            const stats = [
              { label: 'Students', value: studentCount, Icon: Users, color: '#6096ba' },
              { label: 'Teachers', value: teacherCount, Icon: GraduationCap, color: '#059669' },
              { label: 'Classrooms', value: classroomCount, Icon: LayoutGrid, color: '#7c3aed' },
            ]

            const principal = principalsByCampus[c.id]
            const principalName = principal?.name || ''
            const principalPhoto = getImageUrl(principal?.photo)

            return (
              <Link
                key={c.id || i}
                href={`/admin/campus/profile?id=${encodeURIComponent(String(c.id))}`}
                className="block group"
                aria-label={`Open campus ${c.campus_name || c.name}`}
              >
                <div className="h-full bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-[#6096ba]/40 transition-all duration-200 p-4 sm:p-5 flex flex-col">
                  {/* Header */}
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-[#274c77]/10 flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-[#274c77]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-base sm:text-lg font-bold text-[#274c77] truncate group-hover:text-[#1e3a5f] transition-colors">
                          {c.campus_name || c.name || 'Unknown Campus'}
                        </h3>
                        <span className={`flex-shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${statusBadgeClass(c.status)}`}>
                          {c.status || '—'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-gray-500 mt-0.5">
                        <span className="font-semibold text-gray-600">Code: {code}</span>
                        {location && (
                          <>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1 min-w-0">
                              <MapPin className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate max-w-[140px]">{location}</span>
                            </span>
                          </>
                        )}
                      </div>
                      {cityLine && <div className="text-xs text-gray-400 mt-0.5">{cityLine}</div>}
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    {c.campus_type && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#6096ba]/10 text-[#274c77]">
                        {c.campus_type === 'main' ? 'Main Campus' : 'Branch Campus'}
                      </span>
                    )}
                    {c.shift_available && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700">
                        Shift: {c.shift_available.charAt(0).toUpperCase() + c.shift_available.slice(1).toLowerCase()}
                      </span>
                    )}
                  </div>

                  {/* Principal */}
                  <div className="mt-3 pt-3 border-t border-gray-50">
                    <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Principal</div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#6096ba] flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden">
                        {principalPhoto ? (
                          <img src={principalPhoto} alt={principalName} className="w-full h-full object-cover" />
                        ) : principalName ? (
                          principalName.trim().split(/\s+/).slice(0, 2).map((w: string) => w.charAt(0).toUpperCase()).join('')
                        ) : (
                          <User className="w-4 h-4" />
                        )}
                      </div>
                      <span className="text-sm font-semibold text-gray-800 truncate">
                        {principalName || 'Not Assigned'}
                      </span>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-2.5 mt-4">
                    {stats.map(({ label, value, Icon, color }) => (
                      <div key={label} className="rounded-lg border border-gray-100 bg-gray-50/60 p-2.5">
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          <Icon className="w-3.5 h-3.5" style={{ color }} />
                          <span className="truncate">{label}</span>
                        </div>
                        <div className="text-lg sm:text-xl font-bold text-[#274c77]">{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-end mt-4 pt-3 border-t border-gray-100">
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#274c77] group-hover:gap-2.5 transition-all">
                      View Details
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}