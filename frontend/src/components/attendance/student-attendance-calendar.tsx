"use client";
/**
 * Monthly attendance calendar for a student's profile.
 *
 * One coloured square per day — green present, red absent, orange late, purple
 * leave, teal excused — and quiet greys for weekends, holidays, unmarked, and
 * days still to come. The colours match the review roll so a parent sees the
 * same thing a coordinator does.
 *
 * Weekend/holiday come from the server, which is the only place that knows a
 * class's own holidays; the calendar just paints what it is told.
 */
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError } from "@/lib/api";
import { fetchStudentCalendar } from "@/lib/attendance-review-api";
import type {
  CalendarCellStatus,
  CalendarDay,
  StudentCalendarResponse,
} from "@/lib/attendance-review-api";

const CELL: Record<CalendarCellStatus, { bg: string; text: string; label: string }> = {
  present: { bg: "bg-green-600", text: "text-white", label: "Present" },
  absent: { bg: "bg-red-600", text: "text-white", label: "Absent" },
  late: { bg: "bg-orange-500", text: "text-white", label: "Late" },
  leave: { bg: "bg-purple-600", text: "text-white", label: "Leave" },
  excused: { bg: "bg-teal-600", text: "text-white", label: "Excused" },
  holiday: { bg: "bg-slate-400", text: "text-white", label: "Holiday" },
  weekend: { bg: "bg-gray-200", text: "text-gray-400", label: "Weekend" },
  unmarked: { bg: "bg-gray-100", text: "text-gray-500", label: "Not marked" },
  future: { bg: "bg-transparent", text: "text-gray-300", label: "Upcoming" },
};

// The legend only shows what a reader needs to decode the squares.
const LEGEND: CalendarCellStatus[] = ["present", "absent", "late", "leave", "excused", "holiday"];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** `YYYY-MM` for a Date, in local time. */
function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthTitle(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export interface StudentAttendanceCalendarProps {
  studentId: number;
}

export default function StudentAttendanceCalendar({ studentId }: StudentAttendanceCalendarProps) {
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [data, setData] = useState<StudentCalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchStudentCalendar(studentId, month));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load attendance.");
    } finally {
      setLoading(false);
    }
  }, [studentId, month]);

  useEffect(() => {
    void load();
  }, [load]);

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split("-").map(Number);
    setMonth(monthKey(new Date(y, m - 1 + delta, 1)));
  };

  const nextDisabled = month >= monthKey(new Date());

  // Pad the first week so day 1 lands under its real weekday.
  const cells = useMemo<(CalendarDay | null)[]>(() => {
    if (!data || data.days.length === 0) return [];
    const firstWeekday = new Date(`${data.days[0].date}T00:00:00`).getDay();
    const padding: (CalendarDay | null)[] = Array(firstWeekday).fill(null);
    return [...padding, ...data.days];
  }, [data]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h3 className="rounded-md bg-green-700 px-6 py-1.5 text-sm font-semibold text-white">
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
          {/* Fixed-size circles, centred in each column, capped width — without
              the cap `aspect-square` blew each circle up to the full column. */}
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
              ),
            )}
          </div>

          {data && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {LEGEND.map((status) => (
                  <span key={status} className="flex items-center gap-1 text-[11px] text-gray-500">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${CELL[status].bg}`} />
                    {CELL[status].label}
                  </span>
                ))}
              </div>
              <span className="text-sm">
                <span className="text-gray-500">Attendance:</span>{" "}
                <span className="font-semibold text-green-700">
                  {data.summary.attendance_pct}%
                </span>
                <span className="ml-2 text-xs text-gray-400">
                  ({data.summary.present}/{data.summary.marked_days} present)
                </span>
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
