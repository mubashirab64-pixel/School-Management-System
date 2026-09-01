"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Building2, MapPin, Users, GraduationCap, UserCheck } from "lucide-react"
import { getAllCampuses, getStudentCampusStats, getTeacherCampusStats, getCampusAttendanceStats } from "@/lib/api"

// Campus cards embedded on the donor dashboard (mirrors the Campus List page) so
// the donor can see every campus and drill into one without leaving the
// dashboard. Each card links to that campus's profile.
export default function CampusOverviewCards() {
  const [campuses, setCampuses] = useState<any[]>([])
  const [sCounts, setSCounts] = useState<Record<number, number>>({})
  const [tCounts, setTCounts] = useState<Record<number, number>>({})
  const [aPct, setAPct] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    Promise.all([getAllCampuses(), getStudentCampusStats(), getTeacherCampusStats(), getCampusAttendanceStats()])
      .then(([campusesData, sStats, tStats, aStats]: any[]) => {
        if (!mounted) return
        const list = Array.isArray(campusesData)
          ? campusesData
          : (Array.isArray(campusesData?.results) ? campusesData.results : [])
        // Order by campus number (Campus 1, 2, 3, …) parsed from the code/name,
        // so the cards aren't in arbitrary DB order.
        const numOf = (c: any) => {
          const m = String(c.campus_code || c.code || c.campus_name || c.name || "").match(/(\d+)/)
          return m ? parseInt(m[1], 10) : 9999
        }
        list.sort((a: any, b: any) => numOf(a) - numOf(b))
        setCampuses(list)
        const s: Record<number, number> = {}, t: Record<number, number> = {}, a: Record<number, number> = {}
        list.forEach((camp: any) => {
          if (!camp?.id) return
          const name = camp.campus_name || camp.name
          s[camp.id] = (Array.isArray(sStats) ? sStats.find((x: any) => x.campus === name)?.count : 0) ?? 0
          t[camp.id] = (Array.isArray(tStats) ? tStats.find((x: any) => x.campus === name)?.count : 0) ?? 0
          a[camp.id] = (Array.isArray(aStats) ? aStats.find((x: any) => x.campus === name)?.percentage : 0) ?? 0
        })
        setSCounts(s); setTCounts(t); setAPct(a)
      })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  if (loading) return <div className="mb-6 text-sm text-gray-400">Loading campuses…</div>
  if (!campuses.length) return null

  return (
    <div className="mb-6">
      <h2 className="text-lg font-bold text-[#274c77] mb-3 flex items-center gap-2">
        <Building2 className="h-5 w-5" /> Campuses
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {campuses.map((c: any, i: number) => {
          const location = c.address_full || c.address
          const stats: Array<{ label: string; value: string | number; Icon: any; color: string }> = [
            { label: "Students", value: sCounts[c.id] ?? 0, Icon: Users, color: "#6096ba" },
            { label: "Teachers", value: tCounts[c.id] ?? 0, Icon: GraduationCap, color: "#059669" },
            { label: "Attendance", value: `${aPct[c.id] ?? 0}%`, Icon: UserCheck, color: "#7c3aed" },
          ]
          return (
            <Link
              key={c.id || i}
              href={`/admin/campus/profile?id=${encodeURIComponent(String(c.id))}`}
              className="block group"
              aria-label={`Open campus ${c.campus_name || c.name}`}
            >
              <div className="h-full bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-[#6096ba]/40 transition-all duration-200 p-4 flex flex-col">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-[#274c77]/10 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-[#274c77]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-bold text-[#274c77] truncate group-hover:text-[#1e3a5f] transition-colors">
                        {c.campus_name || c.name || "Campus"}
                      </h3>
                      {c.status && (
                        <span className="flex-shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize bg-emerald-50 text-emerald-700">
                          {c.status}
                        </span>
                      )}
                    </div>
                    {location && (
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5 min-w-0">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{location}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5 mt-4">
                  {stats.map(({ label, value, Icon, color }) => (
                    <div key={label} className="rounded-lg border border-gray-100 bg-gray-50/60 p-2.5">
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        <Icon className="w-3.5 h-3.5" style={{ color }} />
                        <span className="truncate">{label}</span>
                      </div>
                      <div className="text-lg font-bold text-[#274c77]">{value}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 pt-2 text-right">
                  <span className="text-xs font-semibold text-[#6096ba] group-hover:text-[#274c77]">View Details →</span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
