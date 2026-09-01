"use client";
/**
 * Top-of-page metric cards.
 *
 * Every card here is backed by a real field in the review payload. The design
 * mock also shows sparklines and "vs yesterday" deltas on each card, plus
 * Submitted / Pending / Approved / Reopened counts — none of those exist in the
 * API today (there is no trend endpoint, and `reopened` is not even one of
 * Attendance.STATUS_CHOICES). They are left out rather than filled with
 * placeholder numbers: a metric that looks real and is not is worse than a
 * missing one.
 */
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, BookOpen, PieChart, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { ReviewSummary } from "@/types/attendance-review";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "warning";
}

function StatCard({ icon: Icon, label, value, hint, tone = "default" }: StatCardProps) {
  const warn = tone === "warning";
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            warn ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm text-gray-500">{label}</p>
          <p
            className={`text-2xl font-semibold ${
              warn && value !== 0 ? "text-red-600" : "text-gray-900"
            }`}
          >
            {value}
          </p>
          {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export interface SummaryStatsProps {
  summary: ReviewSummary | null;
  /** Rows currently in scope — the API has no separate count for this. */
  rowCount: number;
  rowLabel: string;
  workingDays: number | null;
  loading?: boolean;
}

export default function SummaryStats({
  summary,
  rowCount,
  rowLabel,
  workingDays,
  loading,
}: SummaryStatsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[5.5rem] w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={BookOpen}
        label={rowLabel}
        value={rowCount}
        hint={summary?.class_count != null ? `${summary.class_count} classes` : undefined}
      />
      <StatCard
        icon={Users}
        label="Total Students"
        value={summary?.total_students ?? "—"}
      />
      <StatCard
        icon={PieChart}
        label="Attendance %"
        value={summary ? `${summary.avg_rate}%` : "—"}
        // Spelled out because it is not the obvious formula: approved leave is
        // removed from the denominator, so this is not present ÷ total.
        hint="Excludes leave & excused from the total"
      />
      <StatCard
        icon={AlertCircle}
        label="Missing Submissions"
        value={summary?.missing_submissions ?? "—"}
        hint={
          workingDays != null ? `across ${workingDays} working days` : undefined
        }
        tone="warning"
      />
    </div>
  );
}
