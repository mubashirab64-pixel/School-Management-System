"use client";
/**
 * Student × date roll for one classroom.
 *
 * Rendered only when meta.show_roll is true. That flag is a UI hint, not the
 * guard: the server refuses roll requests from roles without access, so a bug
 * here leaks nothing.
 *
 * The mock shows an audit tooltip ("Marked by … Edited by Coordinator …") on
 * each cell. The API carries no audit fields, so cells show the status only.
 */
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api";
import { fetchStudentRoll } from "@/lib/attendance-review-api";
import type {
  DateRange,
  RollCell,
  StudentMatrix,
} from "@/types/attendance-review";

/** Cell styling per status. Keys cover every RollCell, so a new status added to
 *  the union without a style here is a compile error, not a blank cell. */
const CELL_STYLE: Record<RollCell, { short: string; className: string }> = {
  present: { short: "P", className: "bg-green-100 text-green-700" },
  absent: { short: "A", className: "bg-red-100 text-red-700" },
  late: { short: "L", className: "bg-orange-100 text-orange-700" },
  leave: { short: "Lv", className: "bg-purple-100 text-purple-700" },
  excused: { short: "Ex", className: "bg-teal-100 text-teal-700" },
  weekend: { short: "—", className: "bg-gray-100 text-gray-400" },
  holiday: { short: "H", className: "bg-blue-50 text-blue-400" },
  unmarked: { short: "·", className: "bg-white text-gray-300 border border-dashed" },
};

const WORKFLOW_STYLE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-amber-100 text-amber-800",
  under_review: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
};

export interface DayRollProps {
  classroomId: number;
  range: DateRange;
}

export default function DayRoll({ classroomId, range }: DayRollProps) {
  const [matrix, setMatrix] = useState<StudentMatrix | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true; // ignore this response if the range changed meanwhile
    setLoading(true);
    setError(null);

    fetchStudentRoll(classroomId, range)
      .then((data) => {
        if (active) setMatrix(data.data);
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err instanceof ApiError ? err : new ApiError(String(err), 0, "Network Error"),
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [classroomId, range.from, range.to]);

  if (loading) return <Skeleton className="h-40 w-full rounded" />;

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {error.message}
      </div>
    );
  }

  if (!matrix || matrix.students.length === 0) {
    return (
      <p className="p-3 text-sm text-gray-500">
        No enrolled students in this class.
      </p>
    );
  }

  return (
    <div className="rounded border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <span className="text-sm font-medium">
          {matrix.total_students} students · {matrix.working_days} working days
        </span>
        <div className="flex flex-wrap gap-1">
          {Object.entries(matrix.workflow).map(([date, info]) => (
            <Badge
              key={date}
              variant="secondary"
              className={`text-xs font-normal ${
                WORKFLOW_STYLE[info.status] ?? "bg-gray-100 text-gray-700"
              }`}
            >
              {date.slice(5)} {info.status.replace("_", " ")}
            </Badge>
          ))}
        </div>
      </div>

      {/* Scrolls in both directions inside its own box: wide date columns
          horizontally, and ~5 students before the list scrolls vertically, so a
          35-student class does not push the whole page down. The header stays
          pinned (top) and so does the Student column (left). */}
      <div className="max-h-[20rem] overflow-auto">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-xs">
              <th className="sticky left-0 top-0 z-30 bg-gray-50 px-3 py-2 text-left font-medium">
                Student
              </th>
              {matrix.dates.map((d) => (
                <th
                  key={d.date}
                  className={`sticky top-0 z-20 bg-gray-50 px-2 py-2 text-center font-medium ${
                    d.type === "working" ? "text-gray-600" : "text-gray-400"
                  }`}
                  title={d.type !== "working" ? d.type : undefined}
                >
                  <div>{d.day}</div>
                  <div className="font-normal">{d.date.slice(8)}</div>
                </th>
              ))}
              <th className="sticky top-0 z-20 bg-gray-50 px-3 py-2 text-right font-medium">%</th>
            </tr>
          </thead>
          <tbody>
            {matrix.students.map((student) => (
              <tr key={student.student_id} className="border-b last:border-0">
                <td className="sticky left-0 z-10 bg-white px-3 py-1.5">
                  <div className="font-medium">{student.student_name}</div>
                  {student.gr_no && (
                    <div className="text-xs text-gray-400">{student.gr_no}</div>
                  )}
                </td>
                {matrix.dates.map((d) => {
                  const cell = student.dates[d.date] ?? "unmarked";
                  const style = CELL_STYLE[cell];
                  return (
                    <td key={d.date} className="px-1 py-1.5 text-center">
                      <span
                        className={`inline-flex h-6 w-7 items-center justify-center rounded text-xs font-medium ${style.className}`}
                        title={cell}
                      >
                        {style.short}
                      </span>
                    </td>
                  );
                })}
                <td className="px-3 py-1.5 text-right font-medium">
                  {student.attendance_pct}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
