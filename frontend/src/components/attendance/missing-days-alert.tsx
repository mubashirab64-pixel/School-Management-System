"use client";
/**
 * Banner listing classes that have not submitted attendance.
 *
 * This names a teacher and says they failed to submit, so it is worth being
 * precise about what it claims. The server has already removed weekends, that
 * class's own holidays, and days before the class existed — these dates are
 * genuine teaching days with no register at `submitted` or beyond. A `draft`
 * still counts as missing.
 *
 * Each row can remind its teacher — one POST that creates a notification and
 * pushes it over the WebSocket. `canRemind` gates it: only a coordinator (a role
 * with approve rights) should be nudging teachers, so the page passes that in
 * rather than this component guessing from data it should not read.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Bell, Check, ChevronDown, ChevronRight, X } from "lucide-react";
import { useState } from "react";

import { ApiError } from "@/lib/api";
import { remindAllTeachers, remindTeacher } from "@/lib/attendance-review-api";
import type { MissingDay } from "@/types/attendance-review";

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

export interface MissingDaysAlertProps {
  missingDays: MissingDay[];
  /** Show a per-row "Remind" button. Off unless the viewer may approve. */
  canRemind?: boolean;
  /** Notify a toast; kept out of this component so it owns no toast library. */
  onNotify?: (message: string, ok: boolean) => void;
  /** The visible range, so "Remind all" nudges the same period being shown. */
  range?: { from: string; to: string };
}

export default function MissingDaysAlert({
  missingDays,
  canRemind = false,
  onNotify,
  range,
}: MissingDaysAlertProps) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  // Per-classroom send state, so one row's spinner does not freeze the others.
  const [sending, setSending] = useState<Record<number, boolean>>({});
  const [sent, setSent] = useState<Record<number, boolean>>({});
  const [remindingAll, setRemindingAll] = useState(false);

  // Only show & remind for the last 7 days
  const cutoffDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  })();

  const filteredMissingDays = missingDays
    .map((row) => ({
      ...row,
      dates: row.dates.filter((d) => d >= cutoffDate),
    }))
    .filter((row) => row.dates.length > 0);

  const remind = async (row: MissingDay) => {
    const last7Dates = row.dates.filter((d) => d >= cutoffDate);
    if (last7Dates.length === 0) return;
    setSending((s) => ({ ...s, [row.classroom_id]: true }));
    try {
      const result = await remindTeacher(row.classroom_id, last7Dates);
      setSent((s) => ({ ...s, [row.classroom_id]: true }));
      onNotify?.(`Reminder sent to ${result.teacher}.`, true);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Could not send the reminder.";
      onNotify?.(message, false);
    } finally {
      setSending((s) => ({ ...s, [row.classroom_id]: false }));
    }
  };

  // 🔧 remindAll()
  // Purpose: One click reminds every class here that has a teacher account.
  const remindAll = async () => {
    setRemindingAll(true);
    try {
      const result = await remindAllTeachers({
        from: cutoffDate,
        to: new Date().toISOString().split("T")[0],
      });
      const marks: Record<number, boolean> = {};
      result.sent.forEach((s) => (marks[s.classroom_id] = true));
      setSent((prev) => ({ ...prev, ...marks }));
      const tail =
        result.no_teacher_count > 0
          ? ` ${result.no_teacher_count} class${result.no_teacher_count === 1 ? "" : "es"} had no teacher.`
          : "";
      onNotify?.(
        `Reminded ${result.sent_count} teacher${result.sent_count === 1 ? "" : "s"}.${tail}`,
        result.sent_count > 0,
      );
    } catch (err) {
      onNotify?.(
        err instanceof ApiError ? err.message : "Could not send reminders.",
        false,
      );
    } finally {
      setRemindingAll(false);
    }
  };

  if (dismissed || filteredMissingDays.length === 0) return null;

  const classCount = filteredMissingDays.length;
  const dayCount = filteredMissingDays.reduce((sum, m) => sum + m.dates.length, 0);

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50">
      <div className="flex items-start gap-3 p-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

        <div className="min-w-0 flex-1">
          <button
            type="button"
            className="flex items-center gap-1 text-left text-sm font-medium text-amber-900"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            {classCount} {classCount === 1 ? "class has" : "classes have"} not
            submitted attendance for {dayCount}{" "}
            {dayCount === 1 ? "day" : "days"}
          </button>

          {/* One click reminds every class here that has a teacher, so the
              coordinator does not walk the list row by row. */}
          {canRemind && (
            <div className="mt-2">
              <Button
                type="button"
                size="sm"
                className="h-7 bg-amber-600 text-xs text-white hover:bg-amber-700"
                onClick={remindAll}
                disabled={remindingAll}
              >
                <Bell className="mr-1 h-3.5 w-3.5" />
                {remindingAll ? "Reminding…" : "Remind all teachers"}
              </Button>
            </div>
          )}

                {expanded && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-amber-800/70">
                    <th className="pb-2 pr-4 font-medium">Class</th>
                    <th className="pb-2 pr-4 font-medium">Teacher</th>
                    <th className="pb-2 pr-4 font-medium">Missing dates (last 7 days)</th>
                    {canRemind && <th className="pb-2 font-medium">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredMissingDays.map((row) => (
                    <tr
                      key={row.classroom_id}
                      className="border-t border-amber-200/60"
                    >
                      <td className="py-2 pr-4 font-medium text-amber-900">
                        {row.classroom_label}
                      </td>
                      <td className="py-2 pr-4 text-amber-800">
                        {row.class_teacher?.name ?? (
                          <span className="italic text-amber-700/60">
                            No class teacher
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex flex-wrap gap-1">
                          {row.dates.map((date) => (
                            <Badge
                              key={date}
                              variant="outline"
                              className="border-amber-300 bg-white/60 text-xs font-normal text-amber-900"
                            >
                              {formatDate(date)}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      {canRemind && (
                        <td className="py-2">
                          {sent[row.classroom_id] ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                              <Check className="h-3.5 w-3.5" /> Sent
                            </span>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 border-amber-300 px-2 text-xs text-amber-800 hover:bg-amber-100"
                              disabled={!row.class_teacher || sending[row.classroom_id]}
                              onClick={() => remind(row)}
                              title={row.class_teacher ? undefined : "No teacher to remind"}
                            >
                              <Bell className="mr-1 h-3.5 w-3.5" />
                              {sending[row.classroom_id] ? "Sending…" : "Remind"}
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 w-7 shrink-0 p-0 text-amber-700 hover:bg-amber-100"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
