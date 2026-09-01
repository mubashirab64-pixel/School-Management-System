"use client";
/**
 * "Today's Summary" — the panel down the right of the marking page.
 *
 * Not the app navigation; this sits inside the page content, beside the
 * register. Its job is to answer "am I done yet?" without scrolling: the
 * running tally, how far through the class the teacher is, and who is still
 * unmarked with a jump link to each.
 */
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { useState } from "react";

import type { MarkingStatus } from "@/components/attendance/marking-stat-cards";

const DOT: Record<MarkingStatus, string> = {
  present: "bg-green-500",
  absent: "bg-red-500",
  late: "bg-orange-500",
  leave: "bg-purple-500",
  excused: "bg-teal-500",
};

const LABEL: Record<MarkingStatus, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  leave: "Leave",
  excused: "Excused",
};

const VISIBLE_REMAINING = 5;

function Meter({ value, className }: { value: number; className: string }) {
  return (
    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
      <div
        className={`h-full rounded-full transition-all ${className}`}
        // Clamped: a value above 100 would overflow the track.
        style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
      />
    </div>
  );
}

export interface RemainingStudent {
  id: number;
  name: string;
  rollNo: string;
}

export interface MarkingSummaryPanelProps {
  counts: Record<MarkingStatus, number>;
  attendancePercentage: number;
  markedCount: number;
  totalStudents: number;
  remaining: RemainingStudent[];
  /** Scroll the student's row into view and highlight it. */
  onJumpTo: (studentId: number) => void;
}

export default function MarkingSummaryPanel({
  counts,
  attendancePercentage,
  markedCount,
  totalStudents,
  remaining,
  onJumpTo,
}: MarkingSummaryPanelProps) {
  const [showAll, setShowAll] = useState(false);
  const markedPct = totalStudents > 0 ? (markedCount / totalStudents) * 100 : 0;
  const shown = showAll ? remaining : remaining.slice(0, VISIBLE_REMAINING);

  return (
    <Card className="shadow-sm">
      <CardContent className="space-y-4 p-4">
        <h3 className="flex items-center gap-2 font-semibold text-[#274c77]">
          <BarChart3 className="h-4 w-4" />
          Today&apos;s Summary
        </h3>

        <ul className="space-y-1.5">
          {(Object.keys(LABEL) as MarkingStatus[]).map((status) => (
            <li key={status} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-gray-600">
                <span className={`h-2 w-2 rounded-full ${DOT[status]}`} />
                {LABEL[status]}
              </span>
              <span className="font-semibold text-gray-900">{counts[status]}</span>
            </li>
          ))}
        </ul>

        <div className="border-t pt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Attendance %</span>
            <span className="font-semibold text-blue-700">{attendancePercentage}%</span>
          </div>
          <Meter value={attendancePercentage} className="bg-blue-500" />
        </div>

        <div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Marked Progress</span>
            <span className="font-semibold text-gray-900">
              {markedCount} / {totalStudents} Marked
            </span>
          </div>
          <Meter value={markedPct} className="bg-green-500" />
          <p className="mt-1.5 text-xs text-gray-500">
            {remaining.length === 0
              ? "All students marked"
              : `${remaining.length} ${remaining.length === 1 ? "Student" : "Students"} Remaining`}
          </p>
        </div>

        {remaining.length > 0 && (
          <div className="border-t pt-3">
            <h4 className="mb-2 text-sm font-semibold text-gray-700">Students Remaining</h4>
            <ul className="space-y-1">
              {shown.map((student) => (
                <li key={student.id} className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 text-sm">
                    <span className="w-6 shrink-0 text-xs text-gray-400">{student.rollNo}</span>
                    <span className="truncate text-gray-700">{student.name}</span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 shrink-0 px-2 text-xs"
                    onClick={() => onJumpTo(student.id)}
                  >
                    Go
                  </Button>
                </li>
              ))}
            </ul>
            {remaining.length > VISIBLE_REMAINING && (
              <button
                type="button"
                className="mt-2 w-full text-center text-xs font-medium text-blue-600 hover:underline"
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? "Show less" : `View all (${remaining.length})`}
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
