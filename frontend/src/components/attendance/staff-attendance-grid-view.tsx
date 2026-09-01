"use client";
/**
 * Weekly/Monthly staff attendance grid — staff down the side, dates across
 * the top, one status dot per cell. Mirrors the student class-history grid
 * (HistoryGridView in admin/teachers/attendance/page.tsx) but keyed by staff
 * member instead of student, and fetches exactly the date range shown
 * instead of slicing a pre-fetched blob client-side.
 */
import { useEffect, useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { ApiError, getStaffAttendanceHistory } from "@/lib/api";
import type { StaffAttendanceHistoryResponse } from "@/lib/api";
import { percentageFromCounts } from "@/lib/attendance-metrics";

type StaffAttendanceStatus = "present" | "absent" | "late" | "leave" | "half_day";

const STATUS_META: Record<StaffAttendanceStatus, { label: string; short: string; bg: string; border: string }> = {
  present: { label: "Present", short: "P", bg: "bg-green-50", border: "border-green-500" },
  absent: { label: "Absent", short: "A", bg: "bg-red-50", border: "border-red-500" },
  late: { label: "Late", short: "L", bg: "bg-orange-50", border: "border-orange-500" },
  leave: { label: "Leave", short: "Lv", bg: "bg-purple-50", border: "border-purple-500" },
  half_day: { label: "Half Day", short: "HD", bg: "bg-teal-50", border: "border-teal-500" },
};
const STATUSES: StaffAttendanceStatus[] = ["present", "absent", "late", "leave", "half_day"];

const SUNDAY = 0;

function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Monday-start week (weekly) or the full calendar month (monthly) containing `anchorDate`. */
function rangeFor(mode: "weekly" | "monthly", anchorDate: string): { start: string; end: string } {
  const anchor = new Date(`${anchorDate}T00:00:00`);
  if (mode === "weekly") {
    const offset = (anchor.getDay() + 6) % 7; // Monday = 0
    const from = new Date(anchor);
    from.setDate(anchor.getDate() - offset);
    const to = new Date(from);
    to.setDate(from.getDate() + 6);
    return { start: toKey(from), end: toKey(to) };
  }
  const from = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const to = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  return { start: toKey(from), end: toKey(to) };
}

export interface StaffAttendanceGridViewProps {
  mode: "weekly" | "monthly";
  /** Anchors which week/month is shown. */
  anchorDate: string;
  campusId?: string | number;
}

export function StaffAttendanceGridView({ mode, anchorDate, campusId }: StaffAttendanceGridViewProps) {
  const { start, end } = useMemo(() => rangeFor(mode, anchorDate), [mode, anchorDate]);
  const [data, setData] = useState<StaffAttendanceHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getStaffAttendanceHistory(start, end, campusId)
      .then((res) => { if (!cancelled) setData(res); })
      .catch((err) => { if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not load attendance."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [start, end, campusId]);

  const days = useMemo(() => {
    if (!data) return [];
    return data.days.map((d) => {
      const date = new Date(`${d.date}T00:00:00`);
      return {
        key: d.date,
        label: String(date.getDate()),
        dow: date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2),
        isWeekend: date.getDay() === SUNDAY,
        records: d.records,
      };
    });
  }, [data]);

  if (loading) {
    return <Skeleton className="h-64 w-full rounded-lg" />;
  }
  if (error) {
    return (
      <p className="flex items-center justify-center gap-2 py-8 text-sm text-red-600">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {error}
      </p>
    );
  }
  if (!data || data.staff.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-500">No staff found for this scope.</p>;
  }

  const periodLabel =
    mode === "weekly"
      ? `${start} → ${end}`
      : new Date(`${start}T00:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="font-medium text-gray-700">{periodLabel}</span>
        <span className="text-gray-500">{data.staff.length} staff members</span>
        <span className="ml-auto flex flex-wrap items-center gap-2 text-gray-500">
          {STATUSES.map((st) => (
            <span key={st} className="flex items-center gap-1">
              <span className={`inline-block h-2.5 w-2.5 rounded-full border ${STATUS_META[st].bg} ${STATUS_META[st].border}`} />
              {STATUS_META[st].label}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full border border-dashed border-gray-400" />
            Not marked
          </span>
        </span>
      </div>

      <div className="max-h-[60vh] overflow-auto rounded-md border">
        <Table>
          <TableHeader className="sticky top-0 z-20 bg-white shadow-[0_1px_0_0_rgb(229_231_235)]">
            <TableRow>
              <TableHead className="sticky left-0 z-30 bg-white text-xs">Staff</TableHead>
              {days.map((d) => (
                <TableHead
                  key={d.key}
                  className={`whitespace-nowrap px-1 text-center text-[10px] ${d.isWeekend ? "text-gray-400" : "text-gray-600"}`}
                  title={d.isWeekend ? "Weekend" : undefined}
                >
                  <div>{d.dow}</div>
                  <div className="font-normal">{d.label}</div>
                </TableHead>
              ))}
              <TableHead className="whitespace-nowrap px-2 text-right text-[10px]">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.staff.map((s) => {
              const tally: Partial<Record<StaffAttendanceStatus, number>> = {};
              days.forEach((d) => {
                const st = d.records[String(s.id)] as StaffAttendanceStatus | undefined;
                if (st) tally[st] = (tally[st] ?? 0) + 1;
              });
              return (
                <TableRow key={s.id}>
                  <TableCell className="sticky left-0 z-10 whitespace-nowrap bg-white text-xs font-medium">
                    <div>{s.name}</div>
                    <div className="text-[10px] font-normal text-gray-400">{s.role} · {s.employee_code}</div>
                  </TableCell>
                  {days.map((d) => {
                    if (d.isWeekend) {
                      return (
                        <TableCell key={d.key} className="px-1 text-center" title="Weekend">
                          <span className="inline-block h-4 w-4 rounded bg-gray-100" />
                        </TableCell>
                      );
                    }
                    const st = d.records[String(s.id)] as StaffAttendanceStatus | undefined;
                    if (!st) {
                      return (
                        <TableCell key={d.key} className="px-1 text-center" title="Not marked">
                          <span className="inline-block h-4 w-4 rounded border border-dashed border-gray-300" />
                        </TableCell>
                      );
                    }
                    const meta = STATUS_META[st];
                    return (
                      <TableCell key={d.key} className="px-1 text-center">
                        <span
                          className={`inline-block h-4 w-4 rounded-full border ${meta.bg} ${meta.border}`}
                          title={`${meta.label} — ${d.key}`}
                        />
                      </TableCell>
                    );
                  })}
                  <TableCell className="px-2 text-right text-xs font-medium">
                    {percentageFromCounts(tally)}%
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default StaffAttendanceGridView;
