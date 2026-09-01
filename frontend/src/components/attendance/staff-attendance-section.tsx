"use client";
/**
 * Staff attendance for a profile page (Teacher / Coordinator / Principal) —
 * a monthly calendar (mirrors StudentAttendanceCalendar's day-square pattern)
 * plus a donut chart of the same month's status breakdown, both driven by a
 * single fetch so the two views never disagree.
 */
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError, fetchStaffCalendar } from "@/lib/api";
import type { StaffCalendarDay, StaffCalendarResponse } from "@/lib/api";

const CELL: Record<StaffCalendarDay['status'], { bg: string; text: string; label: string }> = {
  present: { bg: "bg-green-600", text: "text-white", label: "Present" },
  absent: { bg: "bg-red-600", text: "text-white", label: "Absent" },
  late: { bg: "bg-orange-500", text: "text-white", label: "Late" },
  leave: { bg: "bg-purple-600", text: "text-white", label: "Leave" },
  half_day: { bg: "bg-teal-600", text: "text-white", label: "Half Day" },
  holiday: { bg: "bg-slate-400", text: "text-white", label: "Holiday" },
  weekend: { bg: "bg-gray-200", text: "text-gray-400", label: "Weekend" },
  unmarked: { bg: "bg-gray-100", text: "text-gray-500", label: "Not marked" },
  future: { bg: "bg-transparent", text: "text-gray-300", label: "Upcoming" },
};

const LEGEND: StaffCalendarDay['status'][] = ["present", "absent", "late", "leave", "half_day", "holiday"];
const DONUT_SEGMENTS: { key: 'present' | 'absent' | 'late' | 'leave' | 'half_day'; color: string }[] = [
  { key: 'present', color: '#16a34a' },
  { key: 'absent', color: '#dc2626' },
  { key: 'late', color: '#f97316' },
  { key: 'leave', color: '#9333ea' },
  { key: 'half_day', color: '#0d9488' },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthTitle(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export interface StaffAttendanceSectionProps {
  userId: number;
}

export function StaffAttendanceSection({ userId }: StaffAttendanceSectionProps) {
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [data, setData] = useState<StaffCalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchStaffCalendar(userId, month));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load attendance.");
    } finally {
      setLoading(false);
    }
  }, [userId, month]);

  useEffect(() => {
    void load();
  }, [load]);

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split("-").map(Number);
    setMonth(monthKey(new Date(y, m - 1 + delta, 1)));
  };

  const nextDisabled = month >= monthKey(new Date());

  const cells = useMemo<(StaffCalendarDay | null)[]>(() => {
    if (!data || data.days.length === 0) return [];
    const firstWeekday = new Date(`${data.days[0].date}T00:00:00`).getDay();
    const padding: (StaffCalendarDay | null)[] = Array(firstWeekday).fill(null);
    return [...padding, ...data.days];
  }, [data]);

  // Donut chart geometry — same segments the calendar's own tally counts.
  const donut = useMemo(() => {
    if (!data) return { segments: [] as { color: string; dash: number }[], circumference: 251.3 };
    const circumference = 2 * Math.PI * 40; // r=40
    const total = data.summary.marked_days || 1;
    let offset = 0;
    const segments = DONUT_SEGMENTS.filter((s) => data.summary[s.key] > 0).map((s) => {
      const value = data.summary[s.key]
      const length = (value / total) * circumference;
      const seg = { color: s.color, dash: length, offset };
      offset += length;
      return seg;
    });
    return { segments, circumference };
  }, [data]);

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h3 className="rounded-md bg-[#274c77] px-6 py-1.5 text-sm font-semibold text-white">
              {monthTitle(month)}
            </h3>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              disabled={nextDisabled}
              className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {loading ? (
            <Skeleton className="h-56 w-full rounded-lg" />
          ) : error ? (
            <p className="flex items-center justify-center gap-2 py-8 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </p>
          ) : (
            <>
              <div className="mx-auto grid max-w-md grid-cols-7 justify-items-center gap-y-2 text-center">
                {WEEKDAYS.map((wd) => (
                  <div key={wd} className="pb-1 text-[11px] font-medium text-gray-400">
                    {wd}
                  </div>
                ))}
                {cells.map((cell, i) =>
                  cell === null ? (
                    <div key={`pad-${i}`} className="h-9 w-9" />
                  ) : (
                    <div
                      key={cell.date}
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${CELL[cell.status].bg} ${CELL[cell.status].text}`}
                      title={`${cell.date} — ${CELL[cell.status].label}`}
                    >
                      {cell.day}
                    </div>
                  )
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 border-t pt-3">
                {LEGEND.map((s) => (
                  <span key={s} className="flex items-center gap-1 text-[11px] text-gray-500">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${CELL[s].bg}`} />
                    {CELL[s].label}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Donut chart */}
        <div className="flex flex-col items-center justify-center border-t lg:border-t-0 lg:border-l pt-4 lg:pt-0 lg:pl-6">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Attendance Rate</span>
          {loading || !data ? (
            <Skeleton className="h-40 w-40 rounded-full" />
          ) : (
            <>
              <svg viewBox="0 0 100 100" className="w-36 h-36 -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#E2E8F0" strokeWidth="12" />
                {donut.segments.map((seg) => (
                  <circle
                    key={seg.color}
                    cx="50" cy="50" r="40" fill="none"
                    stroke={seg.color}
                    strokeWidth="12"
                    strokeDasharray={`${seg.dash} ${donut.circumference}`}
                    strokeDashoffset={-seg.offset}
                  />
                ))}
              </svg>
              <div className="-mt-24 text-center pointer-events-none">
                <div className="text-2xl font-extrabold text-[#163B5C]">{data.summary.attendance_pct}%</div>
                <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Present</div>
              </div>
              <div className="mt-24 text-xs text-gray-500 text-center">
                {data.summary.present}/{data.summary.marked_days} days present this month
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default StaffAttendanceSection;
