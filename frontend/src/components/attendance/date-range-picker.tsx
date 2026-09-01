"use client";
/**
 * Date controls for the Attendance Review page.
 *
 * Presets plus a custom range. Future dates are blocked here *and* on the
 * server — this is only so the user finds out before the round-trip, never as
 * the enforcement point.
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "lucide-react";
import { useState } from "react";

import { resolveDatePreset, toApiDate } from "@/lib/attendance-review-api";
import type { DatePreset, DateRange } from "@/types/attendance-review";
import { MAX_RANGE_DAYS } from "@/types/attendance-review";

const PRESETS: { value: Exclude<DatePreset, "custom">; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last_7", label: "Last 7 Days" },
  { value: "last_30", label: "Last 30 Days" },
  { value: "this_month", label: "This Month" },
  { value: "prev_month", label: "Previous Month" },
];

/** Inclusive day count, matching how the API measures the span. */
function daySpan(from: string, to: string): number {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Math.floor(ms / 86_400_000) + 1;
}

function validate(from: string, to: string): string | null {
  if (!from || !to) return null;
  const today = toApiDate(new Date());
  if (from > to) return "Start date must be before end date.";
  if (to > today) return "Attendance cannot be reviewed for future dates.";
  if (daySpan(from, to) > MAX_RANGE_DAYS) {
    return `Date range cannot exceed ${MAX_RANGE_DAYS} days.`;
  }
  return null;
}

export interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  /** Teaching days in the current range — not the raw day count. */
  workingDays?: number | null;
}

export default function DateRangePicker({
  value,
  onChange,
  workingDays,
}: DateRangePickerProps) {
  const [preset, setPreset] = useState<DatePreset>("this_month");
  const [draft, setDraft] = useState<DateRange>(value); // custom inputs, pre-apply
  const today = toApiDate(new Date());
  const draftError = validate(draft.from, draft.to);

  const applyPreset = (next: Exclude<DatePreset, "custom">) => {
    setPreset(next);
    const range = resolveDatePreset(next);
    setDraft(range);
    onChange(range);
  };

  const applyCustom = () => {
    if (draftError) return;
    setPreset("custom");
    onChange(draft);
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((item) => (
          <Button
            key={item.value}
            type="button"
            size="sm"
            variant={preset === item.value ? "default" : "outline"}
            onClick={() => applyPreset(item.value)}
          >
            {item.label}
          </Button>
        ))}

        <div className="mx-1 hidden h-6 w-px bg-gray-200 sm:block" />

        <div className="flex flex-wrap items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-400" />
          <Input
            type="date"
            aria-label="From date"
            className="h-8 w-[9.5rem]"
            value={draft.from}
            max={today}
            onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
          />
          <span className="text-sm text-gray-400">to</span>
          <Input
            type="date"
            aria-label="To date"
            className="h-8 w-[9.5rem]"
            value={draft.to}
            max={today}
            onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={applyCustom}
            disabled={!!draftError}
          >
            Apply
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        {draftError ? (
          <span className="text-red-600" role="alert">
            {draftError}
          </span>
        ) : (
          <span className="text-gray-500">
            Showing {value.from} — {value.to}
            {workingDays != null && (
              <>
                {" · "}
                <span className="font-medium text-gray-700">
                  {workingDays} working {workingDays === 1 ? "day" : "days"}
                </span>
                {" (excludes Sundays and holidays)"}
              </>
            )}
          </span>
        )}
        <span className="text-gray-400">Max {MAX_RANGE_DAYS} days</span>
      </div>
    </div>
  );
}
