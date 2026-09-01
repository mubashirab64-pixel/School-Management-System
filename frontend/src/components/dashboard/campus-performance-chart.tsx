"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ChartData } from "@/types/dashboard"

import { Skeleton } from "@/components/ui/skeleton"

interface CampusPerformanceChartProps {
  data: ChartData[]
  valueKind?: "average" | "count"
  isLoading?: boolean
}

export function CampusPerformanceChart({ data, valueKind = "average", isLoading }: CampusPerformanceChartProps) {
  if (isLoading) {
    return (
      <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
          <Skeleton className="h-6 w-48 mb-2 bg-slate-200" />
          <Skeleton className="h-4 w-64 bg-slate-100" />
        </CardHeader>
        <CardContent className="pt-6">
          <div className="h-80 w-full flex flex-col justify-around opacity-60">
            {/* Custom SVG Bar Horizontal Skeleton */}
            <svg width="100%" height="100%" preserveAspectRatio="none">
              {[...Array(6)].map((_, i) => {
                // Deterministic width
                const w = 40 + ((i * 17) % 50);
                return (
                  <g key={i} transform={`translate(0, ${i * 50 + 20})`}>
                    {/* Label placeholder */}
                    <rect x="0" y="0" width="80" height="15" fill="#e2e8f0" rx="4" />
                    {/* Bar */}
                    <rect x="100" y="0" width={`${w}%`} height="15" fill="#bae6fd" rx="4" />
                  </g>
                )
              })}
            </svg>
          </div>
        </CardContent>
      </Card>
    )
  }
  const maxValue = data.reduce((m, d) => Math.max(m, d.value), 0)
  const xDomain = valueKind === "count" ? [0, Math.max(5, Math.ceil(maxValue * 1.2 / 100) * 100)] : [0, 100]

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{label}</p>
          <p className="text-sm text-muted-foreground">
            {valueKind === "count" ? (
              <>
                Students: <span className="font-medium text-foreground">{payload[0].value}</span>
              </>
            ) : (
              <>
                Average Score: <span className="font-medium text-foreground">{payload[0].value}</span>
              </>
            )}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
        <CardTitle className="text-xl font-bold text-[#274c77]">
          {valueKind === "count" ? "Campus Students" : "Campus Performance"}
        </CardTitle>
        <CardDescription className="text-gray-600">
          {valueKind === "count" ? "Total students per campus" : "Average academic scores by campus"}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="horizontal"
              margin={{ top: 20, right: 50, left: 20, bottom: 40 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11 }}
                domain={xDomain as any}
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11 }}
                width={100}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              {/* Custom palette for campus bars */}
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {data.map((entry, idx) => {
                  const BAR_COLORS = [
                    '#E7ECEF',
                    '#A3CEF1',
                    '#6096BA',
                    '#8B8C89',
                    '#274C77',
                    '#BFD7ED',
                    '#C9D6DF',
                  ];
                  return (
                    <Cell key={entry.name} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
