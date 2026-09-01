"use client"

import { useState, useEffect, useCallback } from "react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { ChartData } from "@/types/dashboard"
import { getEnrollmentTrendMonthly } from "@/lib/api"
import { TrendingUp } from "lucide-react"

interface EnrollmentTrendChartProps {
  data: ChartData[]
  isLoading?: boolean
}

export function EnrollmentTrendChart({ data, isLoading }: EnrollmentTrendChartProps) {
  const [isMobile, setIsMobile] = useState(false)
  const [viewMode, setViewMode] = useState<'year' | 'month'>('year')
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [monthData, setMonthData] = useState<ChartData[]>([])
  const [monthLoading, setMonthLoading] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const availableYears = data
    .map(d => d.name)
    .filter(Boolean)
    .sort((a, b) => Number(b) - Number(a))

  useEffect(() => {
    if (viewMode === 'month' && !selectedYear && availableYears.length > 0) {
      setSelectedYear(availableYears[0])
    }
  }, [viewMode, availableYears, selectedYear])

  const fetchMonthData = useCallback(async (year: string) => {
    if (!year) return
    setMonthLoading(true)
    try {
      const result = await getEnrollmentTrendMonthly(Number(year))
      setMonthData(result.map(item => ({ name: item.month, value: item.count })))
    } catch {
      setMonthData([])
    } finally {
      setMonthLoading(false)
    }
  }, [])

  useEffect(() => {
    if (viewMode === 'month' && selectedYear) {
      fetchMonthData(selectedYear)
    }
  }, [viewMode, selectedYear, fetchMonthData])

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-xl">
          <p className="font-bold text-[#163B5C] text-xs uppercase tracking-wider">{payload[0].payload.name}</p>
          <p className="text-sm text-gray-500 mt-1">
            Students: <span className="font-semibold text-[#2F6B8A]">{payload[0].value}</span>
          </p>
        </div>
      )
    }
    return null
  }

  const displayData = viewMode === 'month' ? monthData : data
  const maxValue = Math.max(...displayData.map(d => d.value), 0)
  const yMax = maxValue === 0 ? 10 : Math.ceil(maxValue * 1.2 / 10) * 10

  const chartLoading = isLoading || (viewMode === 'month' && monthLoading)

  if (chartLoading) {
    return (
      <Card className="h-[400px] border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl flex flex-col bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold text-[#163B5C]">Enrollment Trend</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center p-6">
          <div className="w-full h-full animate-pulse bg-slate-50/50 rounded-xl" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-[400px] border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 rounded-2xl flex flex-col bg-white overflow-hidden">
      <CardHeader className="pb-2 bg-white flex flex-row items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#2F6B8A]/10 flex items-center justify-center text-[#2F6B8A]">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-[#163B5C]">Enrollment Trend</CardTitle>
            <CardDescription className="text-xs text-gray-400">Student registration timeline</CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-2 no-print">
          <div className="flex rounded-lg overflow-hidden border border-gray-150 p-0.5 bg-gray-50/80 text-[10px] font-bold">
            <button
              onClick={() => setViewMode('year')}
              className={`px-3 py-1 rounded-md transition-all ${viewMode === 'year' ? 'bg-white text-[#163B5C] shadow-sm' : 'text-gray-400 hover:text-[#163B5C]'}`}
            >
              By Year
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 rounded-md transition-all ${viewMode === 'month' ? 'bg-white text-[#163B5C] shadow-sm' : 'text-gray-400 hover:text-[#163B5C]'}`}
            >
              By Month
            </button>
          </div>
          {viewMode === 'month' && availableYears.length > 0 && (
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="h-7 w-[85px] text-[11px] rounded-lg border-gray-250 text-gray-650 focus:ring-[#2F6B8A]">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map(y => (
                  <SelectItem key={y} value={y} className="text-xs">{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-2 flex-1 min-h-0 pb-4">
        <div className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={displayData}
              margin={{ top: 10, right: 15, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorEnrollment" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2F6B8A" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#2F6B8A" stopOpacity={0.00} />
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
              <Area
                type="monotone"
                dataKey="value"
                stroke="#2F6B8A"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorEnrollment)"
                dot={{ stroke: '#2F6B8A', strokeWidth: 2, fill: '#FFFFFF', r: 4 }}
                activeDot={{ stroke: '#2F6B8A', strokeWidth: 2, fill: '#2F6B8A', r: 6 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
