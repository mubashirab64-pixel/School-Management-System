"use client";
/**
 * Attendance Review — the single page all staff roles share.
 *
 * This is the ONLY component that reads `meta`. Children get the data and flags
 * they need and never look up the user's role, so what a role can see is
 * decided by the backend's scope resolver alone. That is the whole point of the
 * unified design: one component tree, one endpoint, no per-role page to drift.
 */
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, BellOff, CalendarOff, Download, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ApiError } from "@/lib/api";
import DateRangePicker from "@/components/attendance/date-range-picker";
import MissingDaysAlert from "@/components/attendance/missing-days-alert";
import ReviewGrid from "@/components/attendance/review-grid";
import TodaysAttendanceSummary from "@/components/attendance/todays-attendance-summary";
import SummaryStats from "@/components/attendance/summary-stats";
import { useAttendanceReview } from "@/hooks/useAttendanceReview";
import { downloadExport, resolveDatePreset, type ExportFormat } from "@/lib/attendance-review-api";
import type { DateRange, ReviewMeta, ReviewRow } from "@/types/attendance-review";

/** What the top-level rows represent for this role — only used for a label. */
function rowLabelFor(meta: ReviewMeta | null): string {
  switch (meta?.start_level) {
    case "campus":
      return "Campuses";
    case "level":
      return "Levels";
    case "grade":
      return "Grades";
    case "classroom":
      return "My Classes";
    default:
      return "Rows";
  }
}

/** Human role name for the context strip. */
const ROLE_LABEL: Record<string, string> = {
  teacher: "Teacher",
  coordinator: "Coordinator",
  principal: "Principal",
  org_admin: "Org Admin",
  accounts_officer: "Accounts Officer",
  donor: "Donor",
};

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function AttendanceReview() {
  const [range, setRange] = useState<DateRange>(() => resolveDatePreset("this_month"));
  const {
    meta,
    rows,
    summary,
    missingDays,
    workingDays,
    childrenByKey,
    expandedKeys,
    loadingKeys,
    loading,
    refreshing,
    error,
    toggleRow,
    refetch,
  } = useAttendanceReview(range);

  // SCOPE_EMPTY is a 403, but it is not a failure: it means nothing is assigned
  // to this user yet. Most teachers in this org have no class teacher record,
  // so a red error banner would be the normal case for them. Show an empty
  // state instead and keep the alarm for real problems.
  const noScope = error?.code === "SCOPE_EMPTY";
  // Any other 403 means the module is closed to them — there is no partial view
  // to fall back to, so the page becomes the message.
  const denied = error?.status === 403 && !noScope;

  const [exporting, setExporting] = useState(false);

  // Check if any loaded row has holiday status
  function hasHolidayRows(): boolean {
    const seen = new Set<string>();
    const check = (items: ReviewRow[]): boolean => {
      for (const r of items) {
        const k = `${r.type}:${r.id}`;
        if (seen.has(k)) continue;
        seen.add(k);
        if (r.latest_status === "holiday") return true;
        const children = childrenByKey[k];
        if (children && check(children)) return true;
      }
      return false;
    };
    return check(rows);
  }

  const holidayPresent = hasHolidayRows();

  // 🔧 exportRange()
  // Purpose: Download the current scope + range as a file.
  // Goes through downloadExport (authorizedFetch → blob), never window.open —
  // these endpoints take a Bearer token, and a plain navigation sends none.
  const exportRange = async (format: ExportFormat) => {
    setExporting(true);
    try {
      await downloadExport(format, range);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4 p-4 sm:p-6">
      {/* Header ─────────────────────────────────────────────────────────── */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {/* Context strip: who is looking, at what, when. */}
          <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
            {meta?.role && (
              <>
                <span>
                  <span className="text-gray-400">Role:</span>{" "}
                  <span className="font-medium text-gray-700">
                    {ROLE_LABEL[meta.role] ?? meta.role}
                  </span>
                </span>
                <span className="text-gray-300">|</span>
              </>
            )}
            <span>
              <span className="text-gray-400">Scope:</span>{" "}
              <span className="font-medium text-gray-700">{meta?.scope_label || "—"}</span>
            </span>
            <span className="text-gray-300">|</span>
            <span className="font-medium text-gray-700">
              {formatDate(range.from)} — {formatDate(range.to)}
            </span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Attendance Review</h1>
          <p className="text-sm text-gray-500">
            Review submitted attendance for any past period.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={refetch} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {meta?.can_export && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  className="bg-gray-900 text-white hover:bg-gray-800"
                  disabled={exporting}
                >
                  <Download className={`mr-2 h-4 w-4 ${exporting ? "animate-pulse" : ""}`} />
                  {exporting ? "Exporting…" : "Export"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportRange("csv")}>CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportRange("excel")}>Excel</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportRange("pdf")}>PDF Summary</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      {error && !noScope && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p>{error.message}</p>
            {!denied && (
              <button type="button" onClick={refetch} className="mt-1 font-medium underline">
                Try again
              </button>
            )}
          </div>
        </div>
      )}

      {noScope && (
        <div className="flex flex-col items-center gap-2 rounded-xl border bg-white p-12 text-center shadow-sm">
          <CalendarOff className="h-10 w-10 text-gray-300" />
          <p className="font-medium">Nothing assigned to you yet</p>
          <p className="max-w-md text-sm text-gray-500">
            Attendance review shows the classes in your scope. Ask an administrator to
            assign you a class, level or campus.
          </p>
        </div>
      )}

      {!denied && !noScope && (
        <>
          <MissingDaysAlert
            missingDays={missingDays}
            // Reminders are a coordinator action; can_approve is the closest
            // meta flag to "this viewer is the one who chases teachers".
            canRemind={meta?.can_approve ?? false}
            range={range}
            onNotify={(message, ok) => (ok ? toast.success(message) : toast.error(message))}
          />

          {holidayPresent && meta?.can_approve && (
            <div className="flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-xs text-purple-700">
              <BellOff className="h-3.5 w-3.5 shrink-0" />
              <span>
                Reminders are blocked for classes with{" "}
                <span className="font-medium">Holiday</span> status. Attendance
                is not expected on holidays.
              </span>
            </div>
          )}

          <SummaryStats
            summary={summary}
            rowCount={rows.length}
            rowLabel={rowLabelFor(meta)}
            workingDays={workingDays}
            loading={loading}
          />

          {/* Everything below sits in one card — filters, then the register —
              so the page reads as a single surface rather than stacked strips. */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <DateRangePicker value={range} onChange={setRange} workingDays={workingDays} />

            <div className="mt-4">
              {loading ? (
                <Skeleton className="h-64 w-full rounded-lg" />
              ) : (
                meta && (
                  // Dimmed while a new range loads. The old rows stay put rather
                  // than blanking, so the page does not jump on every date change.
                  <div className={refreshing ? "opacity-60 transition-opacity" : ""}>
                    <ReviewGrid
                      rows={rows}
                      meta={meta}
                      range={range}
                      childrenByKey={childrenByKey}
                      expandedKeys={expandedKeys}
                      loadingKeys={loadingKeys}
                      onToggle={toggleRow}
                    />
                  </div>
                )
              )}
            </div>
          </div>

          {/* Today's Daily Attendance Summary Section */}
          <TodaysAttendanceSummary className="mt-8" />
        </>
      )}
    </div>
  );
}
