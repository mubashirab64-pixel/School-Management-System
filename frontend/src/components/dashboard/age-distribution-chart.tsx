"use client"

import { useState, useEffect } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Users } from "lucide-react"

interface AgeDistributionChartProps {
  data: any[]
  isLoading?: boolean
}

export function AgeDistributionChart({ data, isLoading }: AgeDistributionChartProps) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  if (isLoading) {
    return (
      <Card className="h-[400px] border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl flex flex-col bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold text-[#163B5C]">Age Distribution</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center p-6">
          <div className="w-full h-full animate-pulse bg-slate-50/50 rounded-xl" />
        </CardContent>
      </Card>
    )
  }

  let totalMale = 0
  let totalFemale = 0
  let maxCount = 0

  data.forEach((d) => {
    const m = Math.abs(d.male || 0)
    const f = Math.abs(d.female || 0)
    totalMale += m
    totalFemale += f
    maxCount = Math.max(maxCount, m, f)
  })

  const GAP = Math.max(Math.ceil(maxCount * 0.1), 10)

  const processedData = data
    .map((item) => {
      const m = Math.abs(item.male || 0)
      const f = Math.abs(item.female || 0)

      return {
        ...item,
        maleNeg: -m,
        maleSpacer: -GAP,
        female: f,
        femaleSpacer: GAP,
        maleCount: m,
        femaleCount: f,
        ageDisplay: item.age || item.name?.replace("Age ", ""),
      }
    })
    .sort((a, b) => (a.age || 0) - (b.age || 0))

  const domainMax = Math.ceil((maxCount + GAP) * 1.1) || 10

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null
    const d = payload[0].payload

    return (
      <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-xl text-xs">
        <p className="font-bold text-[#163B5C] text-center mb-1.5">Age {d.ageDisplay}</p>
        <div className="flex justify-between gap-6">
          <div className="text-center">
            <div className="text-[10px] uppercase text-gray-400 font-semibold">Male</div>
            <div className="font-bold text-sm text-[#2F6B8A]">{d.maleCount}</div>
          </div>
          <div className="text-center border-l border-gray-100 pl-4">
            <div className="text-[10px] uppercase text-gray-400 font-semibold">Female</div>
            <div className="font-bold text-sm text-[#EC4899]">{d.femaleCount}</div>
          </div>
        </div>
        <p className="text-[10px] text-center mt-1.5 text-gray-400 pt-1 border-t border-gray-50">
          Total: <span className="font-semibold text-gray-650">{d.maleCount + d.femaleCount}</span>
        </p>
      </div>
    )
  }

  const CustomSpineLabel = (props: any) => {
    const { x, y, width, height, value } = props
    const centerY = y + height / 2
    return (
      <g style={{ pointerEvents: 'none' }}>
        <text
          x={x}
          y={centerY}
          dominantBaseline="central"
          textAnchor="middle"
          stroke="#fff"
          strokeWidth={3}
          fontSize={10}
          fontWeight="850"
          style={{ opacity: 0.7 }}
        >
          {value}
        </text>
        <text
          x={x}
          y={centerY}
          dominantBaseline="central"
          textAnchor="middle"
          fill="#163B5C"
          fontSize={10}
          fontWeight="800"
        >
          {value}
        </text>
      </g>
    )
  }

  return (
    <Card className="h-[400px] border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 rounded-2xl flex flex-col bg-white overflow-hidden">
      <CardHeader className="pb-2 bg-white flex flex-row items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#2F6B8A]/10 flex items-center justify-center text-[#2F6B8A]">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-[#163B5C]">Age Distribution</CardTitle>
            <CardDescription className="text-xs text-gray-400">Student count by age pyramid</CardDescription>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-gray-50/50 px-2.5 py-1 rounded-lg border border-gray-100 shadow-sm text-[10px] no-print">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#163B5C]"></div>
            <div className="flex items-baseline gap-1 leading-none">
              <span className="font-bold text-gray-400 uppercase">M:</span>
              <span className="font-bold text-[#163B5C]">{totalMale}</span>
            </div>
          </div>
          <div className="h-3 w-[1px] bg-gray-200"></div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#EC4899]"></div>
            <div className="flex items-baseline gap-1 leading-none">
              <span className="font-bold text-gray-400 uppercase">F:</span>
              <span className="font-bold text-[#163B5C]">{totalFemale}</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-0 pb-4" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <div style={{ height: Math.max(320, processedData.length * 32), width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={processedData}
              layout="vertical"
              barCategoryGap={2}
              margin={{ top: 10, right: 30, left: 30, bottom: 5 }}
            >
              <defs>
                <linearGradient id="malePyramid" x1="1" y1="0" x2="0" y2="0">
                  <stop offset="0%" stopColor="#163B5C" stopOpacity={1} />
                  <stop offset="100%" stopColor="#2F6B8A" stopOpacity={0.7} />
                </linearGradient>
                <linearGradient id="femalePyramid" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#F472B6" stopOpacity={0.7} />
                  <stop offset="100%" stopColor="#EC4899" stopOpacity={1} />
                </linearGradient>
              </defs>

              <CartesianGrid horizontal={false} stroke="#F1F3F6" strokeDasharray="3 3" />
              <XAxis type="number" hide domain={[-domainMax, domainMax]} />
              <YAxis
                type="category"
                dataKey="ageDisplay"
                width={0}
                tick={false}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip cursor={{ fill: 'rgba(0,0,0,0.01)' }} content={<CustomTooltip />} />

              {/* Male Side */}
              <Bar
                dataKey="maleSpacer"
                stackId="male"
                fill="transparent"
                isAnimationActive={false}
              />
              <Bar
                dataKey="maleNeg"
                stackId="male"
                fill="url(#malePyramid)"
                barSize={12}
                radius={[3, 0, 0, 3]}
              />

              {/* Female Side */}
              <Bar
                dataKey="femaleSpacer"
                stackId="female"
                fill="transparent"
                isAnimationActive={false}
              >
                <LabelList dataKey="ageDisplay" content={<CustomSpineLabel />} />
              </Bar>
              <Bar
                dataKey="female"
                stackId="female"
                fill="url(#femalePyramid)"
                barSize={12}
                radius={[0, 3, 3, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
