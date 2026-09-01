"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Scale } from "lucide-react"
import {
  ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis,
  ReferenceLine, Tooltip, LabelList,
} from "recharts"
import { getRegionalVariance } from "@/lib/api"

// Diverging by sign: above the regional average = emerald, below = rose, with a
// neutral zero midpoint. Colour is never the only cue — every bar is direct-
// labelled with its value and sits left/right of zero (position = second encoding).
const ABOVE = "#059669"   // emerald-600
const BELOW = "#e11d48"   // rose-600
const NEUTRAL = "#9ca3af" // gray-400

type Row = {
  subject: string
  school_avg: number
  regional_avg: number
  variance: number
  direction: string
}

function VarianceTooltip({ active, payload, scopeLabel }: any) {
  if (!active || !payload?.length) return null
  const r: Row = payload[0].payload
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm text-xs">
      <p className="font-bold text-[#274c77] mb-1">{r.subject}</p>
      <p className="text-gray-600">{scopeLabel || "School"}: <span className="font-semibold">{r.school_avg}%</span></p>
      <p className="text-gray-600">Regional: <span className="font-semibold">{r.regional_avg}%</span></p>
      <p className={r.variance >= 0 ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>
        {r.variance >= 0 ? "+" : ""}{r.variance} pts {r.variance >= 0 ? "above" : "below"}
      </p>
    </div>
  )
}

export default function RegionalVarianceCard({
  campusId,
  academicYear,
  examType,
}: {
  campusId?: number | string
  academicYear?: string
  examType?: string
}) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    getRegionalVariance({ academic_year: academicYear, campus_id: campusId, exam_type: examType })
      .then((d: any) => { if (alive) setData(d) })
      .catch(() => { if (alive) setData(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [campusId, academicYear, examType])

  const subjects: Row[] = data?.subjects ?? []
  const scopeLabel: string = data?.scope_label || "School"
  const avgVar = data?.avg_variance ?? 0
  const maxAbs = Math.max(2, ...subjects.map((s) => Math.abs(s.variance)))
  const tone = avgVar > 0 ? "text-emerald-600" : avgVar < 0 ? "text-rose-600" : "text-gray-500"

  return (
    <Card className="border border-gray-100">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold text-[#274c77] flex items-center gap-2">
          <Scale className="h-4 w-4" /> Regional Score Variance
        </CardTitle>
        {data?.benchmark_source && (
          <p className="text-[11px] text-gray-400">vs {data.benchmark_source}</p>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-gray-400 py-2">Loading…</p>
        ) : !data?.has_data ? (
          <p className="text-[12px] text-amber-600 py-3">
            No regional benchmark for these subjects yet — upload Ministry / regional
            averages to compare against.
          </p>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-2">
              {scopeLabel} avg vs regional average:{" "}
              <span className={`text-lg font-black ${tone}`}>
                {avgVar > 0 ? "+" : ""}{avgVar} pts
              </span>
            </p>
            <ResponsiveContainer width="100%" height={Math.max(160, subjects.length * 34)}>
              <BarChart layout="vertical" data={subjects} margin={{ left: 8, right: 28, top: 4, bottom: 4 }}>
                <XAxis
                  type="number"
                  domain={[-maxAbs, maxAbs]}
                  tickFormatter={(v) => `${v > 0 ? "+" : ""}${v}`}
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="subject"
                  tick={{ fontSize: 11, fill: "#4b5563" }}
                  width={92}
                  axisLine={false}
                  tickLine={false}
                />
                <ReferenceLine x={0} stroke={NEUTRAL} strokeWidth={1.5} />
                <Tooltip content={(props) => <VarianceTooltip {...props} scopeLabel={scopeLabel} />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                <Bar dataKey="variance" radius={[3, 3, 3, 3]} barSize={16} isAnimationActive={false}>
                  {subjects.map((s, i) => (
                    <Cell key={i} fill={s.variance > 0 ? ABOVE : s.variance < 0 ? BELOW : NEUTRAL} />
                  ))}
                  <LabelList
                    dataKey="variance"
                    position="right"
                    formatter={(v: any) => `${Number(v) > 0 ? "+" : ""}${v}`}
                    style={{ fontSize: 10, fontWeight: 700, fill: "#4b5563" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-2 flex items-center gap-4 text-[10px] text-gray-400">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm" style={{ background: ABOVE }} /> Above regional
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm" style={{ background: BELOW }} /> Below regional
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
