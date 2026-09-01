"use client";
/**
 * Chronic absentees — students below an attendance threshold in the coordinator's
 * scope.
 *
 * The design mock has Risk Level and "Parent Alert Sent" columns. Neither is
 * backed by anything in the data model, so this shows a rate band (below 60 is
 * severe, below the threshold is low) — a fact the number supports — rather than
 * inventing a risk score or a notification record.
 */
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, TrendingDown, UserX } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ApiError } from "@/lib/api";
import { fetchChronicAbsentees } from "@/lib/attendance-review-api";
import type { ChronicAbsentee } from "@/lib/attendance-review-api";
import type { DateRange } from "@/types/attendance-review";

const THRESHOLDS = [60, 70, 75, 80, 90];

const BAND_STYLE: Record<ChronicAbsentee["band"], string> = {
  severe: "bg-red-100 text-red-800 border-red-300",
  low: "bg-orange-100 text-orange-800 border-orange-300",
};

export interface ChronicAbsenteesPanelProps {
  range: DateRange;
}

export default function ChronicAbsenteesPanel({ range }: ChronicAbsenteesPanelProps) {
  const [threshold, setThreshold] = useState(75);
  const [absentees, setAbsentees] = useState<ChronicAbsentee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchChronicAbsentees(range, threshold);
      setAbsentees(data.absentees);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, threshold]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <TrendingDown className="h-4 w-4 text-[#274c77]" />
        <h3 className="font-semibold text-[#274c77]">Chronic Absentees</h3>
        {!loading && !error && (
          <Badge variant="outline" className="border-red-300 bg-red-50 text-xs text-red-700">
            {absentees.length}
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-500">
          <span>Below</span>
          <Select value={String(threshold)} onValueChange={(v) => setThreshold(Number(v))}>
            <SelectTrigger className="h-7 w-[4.5rem] text-xs" aria-label="Attendance threshold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {THRESHOLDS.map((t) => (
                <SelectItem key={t} value={String(t)}>
                  {t}%
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : error ? (
          <p className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </p>
        ) : absentees.length === 0 ? (
          <div className="py-6 text-center">
            <UserX className="mx-auto mb-2 h-7 w-7 text-gray-300" />
            <p className="text-sm text-gray-500">
              No students below {threshold}% for this period.
            </p>
          </div>
        ) : (
          <div className="max-h-72 overflow-auto">
            <table className="w-full min-w-max text-sm">
              <thead className="sticky top-0 bg-white text-xs uppercase text-gray-500">
                <tr className="border-b">
                  <th className="px-2 py-1.5 text-left font-medium">Student</th>
                  <th className="px-2 py-1.5 text-left font-medium">Class</th>
                  <th className="px-2 py-1.5 text-right font-medium">Absent</th>
                  <th className="px-2 py-1.5 text-right font-medium">Attendance %</th>
                  <th className="px-2 py-1.5 text-left font-medium">Band</th>
                </tr>
              </thead>
              <tbody>
                {absentees.map((student) => (
                  <tr key={student.student_id} className="border-b last:border-0">
                    <td className="px-2 py-1.5 font-medium text-gray-900">
                      {student.student_name}
                    </td>
                    <td className="px-2 py-1.5 text-gray-600">{student.classroom_name}</td>
                    <td className="px-2 py-1.5 text-right text-gray-600">
                      {student.absent} / {student.marked}
                    </td>
                    <td
                      className={`px-2 py-1.5 text-right font-semibold ${
                        student.band === "severe" ? "text-red-600" : "text-orange-600"
                      }`}
                    >
                      {student.attendance_pct}%
                    </td>
                    <td className="px-2 py-1.5">
                      <Badge variant="outline" className={`text-xs ${BAND_STYLE[student.band]}`}>
                        {student.band === "severe" ? "Severe" : "Low"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
