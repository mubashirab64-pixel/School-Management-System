"use client";
/**
 * KPI row for the teacher marking page.
 *
 * The "vs yesterday" deltas are computed here from the per-student history the
 * page already loads (studentStats.yesterday), not from a trends endpoint —
 * there isn't one. That history only covers this classroom, which is all this
 * page shows, so the comparison is honest.
 *
 * A student with no record yesterday contributes to no bucket, so the deltas
 * compare like with like rather than treating "not marked" as absent.
 */
import {
  ArrowRight,
  Calendar,
  CheckCircle,
  Clock,
  Layers,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo } from "react";

export type MarkingStatus = "present" | "absent" | "late" | "leave" | "excused";

export interface StudentDayStats {
  pct: number;
  consecutive: number;
  yesterday: MarkingStatus | null;
}

const CARD_META: Record<
  MarkingStatus,
  { label: string; icon: LucideIcon; ring: string; text: string }
> = {
  present: { label: "Present", icon: CheckCircle, ring: "bg-green-50", text: "text-green-600" },
  absent: { label: "Absent", icon: XCircle, ring: "bg-red-50", text: "text-red-600" },
  late: { label: "Late", icon: Clock, ring: "bg-orange-50", text: "text-orange-600" },
  leave: { label: "Leave", icon: Calendar, ring: "bg-purple-50", text: "text-purple-600" },
  excused: { label: "Excused", icon: ShieldCheck, ring: "bg-teal-50", text: "text-teal-600" },
};

/**
 * 🔧 Trend()
 * Purpose: Render "↑ 5 vs yesterday" with the arrow the change deserves.
 * Input:  delta, and whether more of this thing is good
 * Output: JSX — a flat arrow when nothing moved.
 */
function Trend({ delta, goodWhenUp }: { delta: number; goodWhenUp: boolean }) {
  if (delta === 0) {
    return (
      <p className="mt-1 flex items-center gap-1 text-[11px] text-gray-400">
        <ArrowRight className="h-3 w-3" />0 vs yesterday
      </p>
    );
  }
  const up = delta > 0;
  const good = up === goodWhenUp;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <p
      className={`mt-1 flex items-center gap-1 text-[11px] ${
        good ? "text-green-600" : "text-red-600"
      }`}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(delta)} vs yesterday
    </p>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  ring,
  text,
  trend,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  ring: string;
  text: string;
  trend?: React.ReactNode;
}) {
  // Plain div, not <Card>: that component bakes in py-6 + gap-6, which is 48px
  // of dead space on a card this small and triples the row's height.
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start gap-2.5">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${ring}`}>
          <Icon className={`h-[18px] w-[18px] ${text}`} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium text-gray-500">{label}</p>
          <p className={`text-2xl font-bold leading-tight ${text}`}>{value}</p>
        </div>
      </div>
      {trend}
    </div>
  );
}

export interface MarkingStatCardsProps {
  counts: Record<MarkingStatus, number>;
  totalStudents: number;
  attendancePercentage: number;
  /** Per-student history, keyed by student id. Empty until it loads. */
  studentStats: Record<number, StudentDayStats>;
}

export default function MarkingStatCards({
  counts,
  totalStudents,
  attendancePercentage,
  studentStats,
}: MarkingStatCardsProps) {
  const yesterday = useMemo(() => {
    const tally: Record<MarkingStatus, number> = {
      present: 0,
      absent: 0,
      late: 0,
      leave: 0,
      excused: 0,
    };
    let marked = 0;
    for (const stat of Object.values(studentStats)) {
      if (!stat.yesterday) continue;
      tally[stat.yesterday] += 1;
      marked += 1;
    }
    // Same formula the server uses: approved absences leave the denominator.
    const eligible = Math.max(marked - tally.leave - tally.excused, 0);
    const pct = eligible > 0 ? (tally.present / eligible) * 100 : 0;
    return { tally, pct, marked };
  }, [studentStats]);

  // No history yet means no baseline — showing "0 vs yesterday" would claim
  // nothing changed, which is a different statement from "we don't know".
  const hasBaseline = yesterday.marked > 0;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-7">
      {(Object.keys(CARD_META) as MarkingStatus[]).map((status) => {
        const meta = CARD_META[status];
        return (
          <StatCard
            key={status}
            icon={meta.icon}
            label={meta.label}
            value={counts[status]}
            ring={meta.ring}
            text={meta.text}
            trend={
              hasBaseline ? (
                <Trend
                  delta={counts[status] - yesterday.tally[status]}
                  goodWhenUp={status === "present"}
                />
              ) : undefined
            }
          />
        );
      })}

      <StatCard
        icon={Users}
        label="Total Students"
        value={totalStudents}
        ring="bg-slate-100"
        text="text-slate-700"
      />

      <StatCard
        icon={Layers}
        label="Attendance %"
        value={`${attendancePercentage}%`}
        ring="bg-blue-50"
        text="text-blue-700"
        trend={
          hasBaseline ? (
            <Trend
              delta={Number((attendancePercentage - yesterday.pct).toFixed(2))}
              goodWhenUp
            />
          ) : undefined
        }
      />
    </div>
  );
}
