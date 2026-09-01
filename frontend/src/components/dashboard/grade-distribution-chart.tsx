"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, LabelList, Cell } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ChartData } from "@/types/dashboard"
import { GraduationCap } from "lucide-react"

interface GradeDistributionChartProps {
  data: ChartData[]
  isLoading?: boolean
}

const NUM_TO_ROMAN: Record<number, string> = {
  1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V',
  6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X',
  11: 'XI', 12: 'XII',
}

function formatGradeName(name: string): string {
  return name.replace(/(\d+)$/, (_, n) => NUM_TO_ROMAN[parseInt(n)] ?? n)
}

const BAR_COLORS = [
  '#2F6B8A', // Primary Blue
  '#5F93B3', // Secondary Light Blue
  '#163B5C', // Dark Sidebar Blue
  '#E6AD45', // Warm Gold
  '#E87A5D', // Salmon/Terra
  '#38A3A5', // Teal Accent
]

export function GradeDistributionChart({ data, isLoading }: GradeDistributionChartProps) {
  if (isLoading) {
    return (
      <Card className="h-[400px] border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl flex flex-col bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold text-[#163B5C]">Grade Distribution</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center p-6">
          <div className="w-full h-full animate-pulse bg-slate-50/50 rounded-xl" />
        </CardContent>
      </Card>
    )
  }

  const maxValue = data.reduce((max, item) => Math.max(max, item.value), 0)
  const yMax = maxValue === 0 ? 10 : Math.ceil(maxValue * 1.25)

  return (
    <Card className="h-[400px] border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 rounded-2xl flex flex-col bg-white overflow-hidden">
      <CardHeader className="pb-2 bg-white flex flex-row items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#2F6B8A]/10 flex items-center justify-center text-[#2F6B8A]">
            <GraduationCap className="w-4 h-4" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-[#163B5C]">Grade Distribution</CardTitle>
            <CardDescription className="text-xs text-gray-400">Student enrollment by grade level</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2 flex-1 min-h-0 pb-4">
        <div className="h-full w-full">
          {data.length === 0 ? (
            <div className="h-full w-full flex items-center justify-center text-xs text-gray-400">
              No grade data found
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 20, right: 15, left: -20, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F3F6" />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  stroke="#A0AEC0"
                  style={{ fontSize: '10px', fontWeight: '500' }}
                  tickFormatter={formatGradeName}
                />
                <YAxis
                  domain={[0, yMax]}
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  stroke="#A0AEC0"
                  style={{ fontSize: '10px', fontWeight: '500' }}
                />
                <Tooltip
                  cursor={false}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload
                      return (
                        <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-xl text-xs">
                          <p className="font-bold text-[#163B5C]">{formatGradeName(d.name)}</p>
                          <p className="text-gray-500 mt-0.5">
                            Students: <span className="font-semibold text-[#2F6B8A]">{d.value}</span>
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Bar dataKey="value" radius={[5, 5, 0, 0]} barSize={22}>
                  {data.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                  ))}
                  <LabelList
                    dataKey="value"
                    position="top"
                    offset={8}
                    style={{ fill: '#163B5C', fontSize: '9px', fontWeight: '600' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
