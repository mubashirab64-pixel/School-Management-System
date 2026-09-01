"use client"

import { useState, useEffect, useCallback } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { getNewAdmissionsStats, NewAdmissionsStats } from "@/lib/api"
import { UserPlus } from "lucide-react"

interface NewAdmissionsChartProps {
  campusId?: number
  isLoading?: boolean
}

export function NewAdmissionsChart({ campusId, isLoading: parentLoading }: NewAdmissionsChartProps) {
  const [data, setData] = useState<NewAdmissionsStats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    try {
      const stats = await getNewAdmissionsStats('year', campusId)
      setData(stats)
    } catch (error) {
      console.error("Failed to fetch new admissions stats:", error)
    } finally {
      setLoading(false)
    }
  }, [campusId])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-xl text-xs">
          <p className="font-bold text-[#163B5C] mb-1">{payload[0].payload.date || payload[0].payload.grade}</p>
          <p className="text-gray-500">
            Admissions: <span className="font-semibold text-[#2F6B8A]">{payload[0].value}</span>
          </p>
        </div>
      )
    }
    return null
  }

  const chartLoading = loading || parentLoading

  if (chartLoading) {
    return (
      <Card className="h-[400px] border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl flex flex-col bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold text-[#163B5C]">New Admissions</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center p-6">
          <div className="w-full h-full animate-pulse bg-slate-50/50 rounded-xl" />
        </CardContent>
      </Card>
    )
  }

  // Format trend data from API, fallback to by_grade if trend is empty
  const chartData = data?.trend && data.trend.length > 0
    ? data.trend.map(item => ({
        name: item.date,
        value: item.count
      }))
    : data?.by_grade && data.by_grade.length > 0
      ? data.by_grade.map(item => ({
          name: item.grade,
          value: item.count
        }))
      : []

  const maxValue = Math.max(...chartData.map(d => d.value), 0)
  const yMax = maxValue === 0 ? 10 : Math.ceil(maxValue * 1.2 / 5) * 5

  return (
    <Card className="h-[400px] border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 rounded-2xl flex flex-col bg-white overflow-hidden">
      <CardHeader className="pb-2 bg-white flex flex-row items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#2F6B8A]/10 flex items-center justify-center text-[#2F6B8A]">
            <UserPlus className="w-4 h-4" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-[#163B5C]">New Admissions</CardTitle>
            <CardDescription className="text-xs text-gray-400">Admissions count over past year</CardDescription>
          </div>
        </div>
        {data && (
          <div className="text-right">
            <span className="text-xs text-gray-450">Total New</span>
            <div className="text-sm font-bold text-[#2F6B8A] leading-none">{data.total_new}</div>
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-2 flex-1 min-h-0 pb-4">
        <div className="h-full w-full">
          {chartData.length === 0 ? (
            <div className="h-full w-full flex items-center justify-center text-xs text-gray-400">
              No admissions data found
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 15, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="admissionsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2F6B8A" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#5F93B3" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F3F6" />
                <XAxis
                  dataKey="name"
                  stroke="#A0AEC0"
                  style={{ fontSize: '10px', fontWeight: '500' }}
                  tickLine={false}
                  axisLine={false}
                  dy={8}
                />
                <YAxis
                  stroke="#A0AEC0"
                  style={{ fontSize: '10px', fontWeight: '500' }}
                  domain={[0, yMax]}
                  tickLine={false}
                  axisLine={false}
                  dx={-8}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill="url(#admissionsGradient)" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
