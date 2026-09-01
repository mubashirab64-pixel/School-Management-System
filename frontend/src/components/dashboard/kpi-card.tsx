"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"


interface KpiCardProps {
  title: string
  value: string | number
  description: string
  icon: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
  progress?: {
    value: number
    max: number
    color?: string
  }
  className?: string
  bgColor?: string
  textColor?: string
}


export function KpiCard({ title, value, description, icon: Icon, trend, progress, className, bgColor, textColor }: KpiCardProps) {
  const cardBg = bgColor ? { background: bgColor } : undefined;
  const cardText = textColor ? textColor : "text-foreground";
  return (
    <Card className={cn("relative overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300", className)} style={cardBg}>
      <CardHeader className={cn("flex flex-row items-center justify-between space-y-0 pb-2", textColor)}>
        <CardTitle className={cn("text-sm font-medium", textColor ? textColor : "text-muted-foreground")}>{title}</CardTitle>
        <div className={cn("h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center", textColor)}>
          <Icon className="h-5 w-5" />
        </div>
      </CardHeader>
      <CardContent className={cn("space-y-3", textColor)}>
        <div className="flex items-baseline justify-between">
          <div className={cn("text-3xl font-bold", cardText)}>
            {typeof value === "number" ? value.toLocaleString() : value}
          </div>
          {trend && (
            <div
              className={cn(
                "flex items-center text-xs font-medium",
                trend.isPositive ? "text-green-600" : "text-red-600",
              )}
            >
              <span className={cn("mr-1", trend.isPositive ? "text-green-600" : "text-red-600")}> 
                {trend.isPositive ? "↗" : "↘"}
              </span>
              {Math.abs(trend.value)}%
            </div>
          )}
        </div>

        <p className={cn("text-xs", textColor ? textColor : "text-muted-foreground")}>{description}</p>

        {progress && (
          <div className="space-y-1">
            <Progress value={(progress.value / progress.max) * 100} className="h-2" />
            <div className={cn("flex justify-between text-xs", textColor ? textColor : "text-muted-foreground")}> 
              <span>{progress.value}</span>
              <span>{progress.max}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
