"use client";
/**
 * KPI row for the coordinator's approvals register.
 *
 * Plain divs rather than <Card>: that component bakes in `py-6` and `gap-6`,
 * which on a card this small is 48px of dead vertical space and makes the row
 * three times taller than the design.
 *
 * Every card is derived from the classes on screen. The design mock also shows a
 * sparkline and a "vs yesterday" delta on each card, plus "Reopened" and
 * "Pending Backfill Requests". Those are left out rather than faked: there is no
 * trend endpoint to draw a sparkline from, `reopened` is not one of
 * Attendance.STATUS_CHOICES (draft / submitted / under_review / approved), and
 * backfill requests are a separate model this page does not load.
 */
import { AlertCircle, BookOpen, CheckCircle, Clock, PieChart, Send } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo } from "react";

import { attendancePercentage } from "@/lib/attendance-metrics";

export interface ClassSummaryRow {
  classroom_id: number;
  status: string;
  total_students: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  leave_count: number;
  excused_count: number;
}

/** Statuses that mean the teacher has handed the register in. */
const SUBMITTED_STATUSES = ["submitted", "under_review", "approved"];

function StatCard({
  icon: Icon,
  label,
  value,
  ring,
  text,
  share,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  ring: string;
  text: string;
  /** Share of today's classes, shown beside the count like the design. */
  share?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start gap-2.5">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${ring}`}>
          <Icon className={`h-[18px] w-[18px] ${text}`} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium text-gray-500">{label}</p>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-2xl font-bold leading-tight ${text}`}>{value}</span>
            {share && <span className="text-[11px] font-medium text-gray-400">{share}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ApprovalStatCards({ rows }: { rows: ClassSummaryRow[] }) {
  const stats = useMemo(() => {
    const totals = rows.reduce(
      (acc, row) => {
        acc.present += row.present_count;
        acc.leave += row.leave_count;
        acc.excused += row.excused_count;
        // Normalise: status can arrive capitalised ("Approved") or spaced
        // ("under review"); comparing raw would misfile an approved class as pending.
        const st = String(row.status || "").toLowerCase().replace(/\s+/g, "_");
        if (SUBMITTED_STATUSES.includes(st)) acc.submitted += 1;
        if (st === "approved") acc.approved += 1;
        else if (st === "not_marked" || st === "") acc.missing += 1;
        else acc.pending += 1;
        return acc;
      },
      { present: 0, leave: 0, excused: 0, submitted: 0, approved: 0, pending: 0, missing: 0 },
    );

    // Denominator counts only students in classes that were actually marked.
    // Including an unmarked class would report it as 0% attendance, which is a
    // different claim from "not submitted yet".
    const markedStudents = rows
      .filter((row) => row.status !== "not_marked")
      .reduce((sum, row) => sum + row.total_students, 0);

    return {
      ...totals,
      rate: attendancePercentage({
        present: totals.present,
        total: markedStudents,
        leave: totals.leave,
        excused: totals.excused,
      }),
    };
  }, [rows]);

  const pct = (n: number) =>
    rows.length > 0 ? `(${Math.round((n / rows.length) * 100)}%)` : undefined;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <StatCard
        icon={BookOpen}
        label="Today's Classes"
        value={rows.length}
        ring="bg-blue-50"
        text="text-blue-700"
      />
      <StatCard
        icon={Send}
        label="Submitted"
        value={stats.submitted}
        share={pct(stats.submitted)}
        ring="bg-emerald-50"
        text="text-emerald-600"
      />
      <StatCard
        icon={Clock}
        label="Pending Review"
        value={stats.pending}
        share={pct(stats.pending)}
        ring="bg-amber-50"
        text="text-amber-600"
      />
      <StatCard
        icon={CheckCircle}
        label="Approved"
        value={stats.approved}
        share={pct(stats.approved)}
        ring="bg-green-50"
        text="text-green-600"
      />
      <StatCard
        icon={AlertCircle}
        label="Missing Submissions"
        value={stats.missing}
        share={pct(stats.missing)}
        ring="bg-red-50"
        text="text-red-600"
      />
      <StatCard
        icon={PieChart}
        label="Overall Attendance %"
        value={`${stats.rate}%`}
        ring="bg-indigo-50"
        text="text-indigo-700"
      />
    </div>
  );
}
