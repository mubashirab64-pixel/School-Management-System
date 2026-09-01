"use client"

import { useState, useEffect } from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import type { ChartData } from "@/types/dashboard"
import { Users } from "lucide-react"

interface GenderDistributionChartProps {
  data: ChartData[]
  isLoading?: boolean
}

const GENDER_COLORS: Record<string, string> = {
  female: '#F472B6', // Premium Soft Pink
  male: '#2F6B8A',   // Primary Blue
  other: '#163B5C',  // Dark Blue/Gray
}

export function GenderDistributionChart({ data, isLoading }: GenderDistributionChartProps) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  if (isLoading) {
    return (
      <Card className="h-[400px] border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl flex flex-col bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold text-[#163B5C]">Gender Distribution</CardTitle>
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

  const total = data.reduce((acc, curr) => acc + curr.value, 0)

  return (
    <Card className="h-[400px] border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 rounded-2xl flex flex-col bg-white overflow-hidden">
      <CardHeader className="pb-2 bg-white flex flex-row items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#2F6B8A]/10 flex items-center justify-center text-[#2F6B8A]">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-[#163B5C]">Gender Distribution</CardTitle>
            <CardDescription className="text-xs text-gray-400">Total student breakdown</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 pt-2 min-h-0 flex flex-col justify-center pb-4">
        <div className="h-[200px] w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data as any[]}
                cx="50%"
                cy="50%"
                innerRadius="65%"
                outerRadius="85%"
                dataKey="value"
                paddingAngle={3}
                cornerRadius={6}
                stroke="none"
              >
                {data.map((entry, index) => {
                  const key = (entry.name || '').toLowerCase()
                  return <Cell key={`cell-${index}`} fill={GENDER_COLORS[key] || '#94a3b8'} />
                })}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                wrapperStyle={{ bottom: -10, fontSize: isMobile ? '10px' : '11px', fontWeight: '500' }}
                formatter={(value, entry: any) => {
                  const val = entry.payload?.value;
                  const percent = (total > 0 && val) ? (val / total * 100).toFixed(1) : 0;
                  return <span className="capitalize text-gray-500">{value}: <span className="font-bold text-[#163B5C]">{val}</span> ({percent}%)</span>
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Center Text */}
          <div className="absolute top-[50%] left-[50%] transform -translate-x-1/2 -translate-y-[62%] text-center pointer-events-none">
            <div className="text-2xl font-extrabold text-[#163B5C]">{total}</div>
            <div className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider">Students</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
