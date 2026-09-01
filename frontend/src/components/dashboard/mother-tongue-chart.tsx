"use client"

import { useState, useEffect, useMemo } from "react"
import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import type { ChartData } from "@/types/dashboard"
import { Languages } from "lucide-react"

interface MotherTongueChartProps {
  data: ChartData[]
  isLoading?: boolean
}

const THEME_COLORS = [
  "#2F6B8A", // Primary Blue
  "#5F93B3", // Secondary Light Blue
  "#163B5C", // Dark Sidebar Blue
  "#E6AD45", // Warm Gold
  "#E87A5D", // Salmon/Terra
  "#94A3B8", // Slate Gray
]

export function MotherTongueChart({ data = [], isLoading }: MotherTongueChartProps) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Sort and process data before conditional rendering to respect the rules of hooks
  const { chartData, totalStudents } = useMemo(() => {
    const sorted = [...data].sort((a, b) => b.value - a.value)

    // Top 5 and others
    const topItems = sorted.slice(0, 5)
    const others = sorted.slice(5)
    const othersTotal = others.reduce((sum, item) => sum + item.value, 0)

    const processed = [
      ...topItems,
      ...(othersTotal > 0 ? [{ name: "Others", value: othersTotal }] : [])
    ].map((item, index) => ({
      name: item.name,
      value: item.value,
      fill: THEME_COLORS[index % THEME_COLORS.length]
    }))

    const total = data.reduce((acc, curr) => acc + curr.value, 0)
    return { chartData: processed, totalStudents: total }
  }, [data])

  if (isLoading) {
    return (
      <Card className="h-[400px] border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl flex flex-col bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold text-[#163B5C]">Mother Tongue</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center p-6">
          <div className="w-full h-full animate-pulse bg-slate-50/50 rounded-xl" />
        </CardContent>
      </Card>
    )
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload
      return (
        <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-xl text-xs">
          <p className="font-bold text-[#163B5C] capitalize">{item.name}</p>
          <p className="text-gray-500 mt-0.5">
            Students: <span className="font-semibold text-[#2F6B8A]">{item.value}</span>
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <Card className="h-[400px] border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 rounded-2xl flex flex-col bg-white overflow-hidden">
      <CardHeader className="pb-2 bg-white flex flex-row items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#2F6B8A]/10 flex items-center justify-center text-[#2F6B8A]">
            <Languages className="w-4 h-4" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-[#163B5C]">Mother Tongue</CardTitle>
            <CardDescription className="text-xs text-gray-400">Language distribution</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 pt-2 min-h-0 flex flex-col justify-center pb-4">
        <div className="h-[200px] w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius="65%"
                outerRadius="85%"
                dataKey="value"
                paddingAngle={3}
                cornerRadius={6}
                stroke="none"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                wrapperStyle={{ bottom: -10, fontSize: isMobile ? '9px' : '10px', fontWeight: '500' }}
                formatter={(value, entry: any) => {
                  const val = entry.payload?.value;
                  const percent = (totalStudents > 0 && val) ? (val / totalStudents * 100).toFixed(1) : 0;
                  return <span className="capitalize text-gray-500">{value}: <span className="font-bold text-[#163B5C]">{val}</span> ({percent}%)</span>
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Center Text */}
          <div className="absolute top-[50%] left-[50%] transform -translate-x-1/2 -translate-y-[62%] text-center pointer-events-none">
            <div className="text-2xl font-extrabold text-[#163B5C]">{totalStudents}</div>
            <div className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider">Students</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
