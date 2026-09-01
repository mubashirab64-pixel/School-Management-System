/**
 * Unified Attendance Review — API calls.
 *
 * Kept out of lib/api.ts, which is already 4k+ lines. Still goes through its
 * `apiGet`, so token refresh, retry and ApiError handling stay in one place.
 *
 * Backend: attendance/services/review_view.py
 */
import { apiGet, apiPost, authorizedFetch } from "@/lib/api";
import type {
  DailySummaryResponse,
  DatePreset,
  DateRange,
  ReviewMatrixResponse,
  ReviewMissingResponse,
  ReviewQuery,
  ReviewTreeResponse,
} from "@/types/attendance-review";

const BASE = "/api/attendance/review";

/** Format a Date as the `YYYY-MM-DD` the API expects, in local time.
 *
 *  `toISOString()` would convert to UTC first, which in Pakistan (UTC+5) turns
 *  any local date before 05:00 into the previous day.
 */
export function toApiDate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * 🔧 resolveDatePreset()
 * Purpose: Turn a named preset into the concrete range the API takes.
 * Input:  preset, and today (injectable so tests need not mock the clock)
 * Output: DateRange — never reaches into the future, which the API rejects.
 */
export function resolveDatePreset(preset: DatePreset, today = new Date()): DateRange {
  switch (preset) {
    case "today":
      return { from: toApiDate(today), to: toApiDate(today) };
    case "yesterday": {
      const yesterday = addDays(today, -1);
      return { from: toApiDate(yesterday), to: toApiDate(yesterday) };
    }
    case "last_7":
      // Inclusive of today, so 6 days back — not 7.
      return { from: toApiDate(addDays(today, -6)), to: toApiDate(today) };
    case "last_30":
      return { from: toApiDate(addDays(today, -29)), to: toApiDate(today) };
    case "this_month":
      return {
        from: toApiDate(new Date(today.getFullYear(), today.getMonth(), 1)),
        // Capped at today: the month's remaining days have not happened yet.
        to: toApiDate(today),
      };
    case "prev_month": {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: toApiDate(first), to: toApiDate(last) };
    }
    case "custom":
    default:
      return { from: toApiDate(today), to: toApiDate(today) };
  }
}

function buildQuery(query: ReviewQuery): string {
  const params = new URLSearchParams();
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.expand) params.set("expand", query.expand);
  if (query.parent_id != null) params.set("parent_id", String(query.parent_id));
  if (query.classroom_id != null) {
    params.set("classroom_id", String(query.classroom_id));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * 🔧 fetchReviewTree()
 * Purpose: The grid rows for the current scope, or one branch of it.
 * Input:  ReviewQuery — omit `expand` for the initial load.
 * Output: ReviewTreeResponse. `summary` and `missing_days` are present only
 *         when `expand` is omitted.
 */
export function fetchReviewTree(query: ReviewQuery): Promise<ReviewTreeResponse> {
  return apiGet<ReviewTreeResponse>(`${BASE}/${buildQuery(query)}`);
}

/**
 * 🔧 fetchStudentRoll()
 * Purpose: The student × date matrix for one classroom.
 * Output: ReviewMatrixResponse. Throws ApiError 403 for roles without roll
 *         access — do not call it when meta.show_roll is false.
 */
export function fetchStudentRoll(
  classroomId: number,
  range: DateRange,
): Promise<ReviewMatrixResponse> {
  return apiGet<ReviewMatrixResponse>(
    `${BASE}/${buildQuery({ ...range, classroom_id: classroomId })}`,
  );
}

/**
 * 🔧 fetchMissingSubmissions()
 * Purpose: The missing-day list on its own, for the dedicated tab.
 */
export function fetchMissingSubmissions(
  range: DateRange,
): Promise<ReviewMissingResponse> {
  return apiGet<ReviewMissingResponse>(`${BASE}/missing/${buildQuery(range)}`);
}

/**
 * 🔧 fetchDailySummary()
 * Purpose: Fetch single-day attendance summary (campus & class-wise) for Principal Dashboard.
 * Input: optional date YYYY-MM-DD
 */
export function fetchDailySummary(date?: string): Promise<DailySummaryResponse> {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  return apiGet<DailySummaryResponse>(`${BASE}/daily/${query}`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Backfill access
// ─────────────────────────────────────────────────────────────────────────────

/** Where a grant is in its short life. There is no "pending": see below. */
export type BackfillState = "active" | "used" | "expired";

export interface BackfillGrant {
  id: number;
  classroom_id: number;
  classroom_name: string;
  /** The date the teacher may go back and mark, `YYYY-MM-DD`. */
  date: string;
  reason: string;
  /** ISO timestamp the access dies at. */
  deadline: string;
  granted_to: string;
  granted_to_id: number;
  granted_by: string | null;
  granted_at: string;
  is_used: boolean;
  used_at: string | null;
  state: BackfillState;
}

export interface BackfillScopeResponse {
  permissions: BackfillGrant[];
  counts: Record<BackfillState, number>;
}

/**
 * 🔧 fetchBackfillInScope()
 * Purpose: Every backfill grant across the caller's classes.
 * Output: BackfillScopeResponse
 *
 * Not to be confused with /backfill/permissions/, which filters
 * `granted_to=request.user` and so answers a teacher's "what do I hold?" — a
 * coordinator calling that gets an empty list.
 *
 * These are grants, not requests. AttendanceBackfillPermission has no
 * requesting teacher and no pending state, so nothing here can be approved or
 * denied — a coordinator grants access outright.
 */
export function fetchBackfillInScope(): Promise<BackfillScopeResponse> {
  return apiGet<BackfillScopeResponse>("/api/attendance/backfill/in-scope/");
}


// ─────────────────────────────────────────────────────────────────────────────
//  File downloads
// ─────────────────────────────────────────────────────────────────────────────

export type ExportFormat = "csv" | "excel" | "pdf";

const EXPORT_PATH: Record<ExportFormat, string> = {
  csv: "export-csv",
  excel: "export-excel",
  pdf: "export-pdf",
};

/**
 * 🔧 downloadExport()
 * Purpose: Download an attendance export as a file.
 * Input:  format, and the date range (plus optional campus).
 * Output: Promise<void> — resolves once the browser has the file.
 *
 * Why not window.open(url)? These endpoints authenticate with a Bearer token
 * kept in localStorage, not a cookie. A plain navigation sends no Authorization
 * header, so the server answers 401 and the "download" is an error page in a
 * new tab. This fetches through authorizedFetch (which attaches the token and
 * retries once on a 401), then saves the response body as a blob.
 */
export async function downloadExport(
  format: ExportFormat,
  range: DateRange,
  campusId?: number,
): Promise<void> {
  const params = new URLSearchParams({ start_date: range.from, end_date: range.to });
  if (campusId != null) params.set("campus", String(campusId));

  const response = await authorizedFetch(
    `/api/attendance/${EXPORT_PATH[format]}/?${params.toString()}`,
    { headers: { Accept: "*/*" } },
  );

  if (!response.ok) {
    // The error envelope is JSON even though a success would be a file, so read
    // the message rather than handing the user a blob named ".csv" full of it.
    let message = `Export failed (${response.status})`;
    try {
      const body = await response.json();
      message = body?.error?.message ?? body?.error ?? message;
    } catch {
      /* non-JSON error body — keep the status message */
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const filename = filenameFromResponse(response, format, range);

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke on the next tick: revoking synchronously can cancel the download in
  // some browsers before it has read the blob.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const EXTENSION: Record<ExportFormat, string> = { csv: "csv", excel: "xlsx", pdf: "pdf" };

function filenameFromResponse(
  response: Response,
  format: ExportFormat,
  range: DateRange,
): string {
  // Prefer the server's Content-Disposition filename; fall back to a sensible
  // one so the download is never named "download".
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  if (match) return match[1];
  return `attendance_${range.from}_to_${range.to}.${EXTENSION[format]}`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Chronic absentees
// ─────────────────────────────────────────────────────────────────────────────

/** How far below the threshold a student is. Not a risk model — see the view. */
export type AbsenteeBand = "low" | "severe";

export interface ChronicAbsentee {
  student_id: number;
  student_name: string;
  classroom_id: number;
  classroom_name: string;
  attendance_pct: number;
  absent: number;
  marked: number;
  band: AbsenteeBand;
}

export interface ChronicAbsenteesResponse {
  absentees: ChronicAbsentee[];
  threshold: number;
  severe_threshold: number;
  count: number;
  date_range: DateRange;
}

/**
 * 🔧 fetchChronicAbsentees()
 * Purpose: Students below `threshold`% attendance across the caller's scope.
 * Input:  range, and the threshold (default 75).
 * Output: ChronicAbsenteesResponse, worst attendance first.
 */
export function fetchChronicAbsentees(
  range: DateRange,
  threshold = 75,
): Promise<ChronicAbsenteesResponse> {
  const params = new URLSearchParams({
    from: range.from,
    to: range.to,
    threshold: String(threshold),
  });
  return apiGet<ChronicAbsenteesResponse>(
    `/api/attendance/review/chronic-absentees/?${params.toString()}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Reminders
// ─────────────────────────────────────────────────────────────────────────────

export interface RemindResult {
  sent: boolean;
  classroom_id: number;
  teacher: string;
}

/**
 * 🔧 remindTeacher()
 * Purpose: Notify a classroom's teacher that attendance is outstanding.
 * Input:  classroomId, and optionally the missing dates (for the message).
 * Output: RemindResult. Throws ApiError — notably 409 NO_TEACHER_ACCOUNT when
 *         the class has no linked teacher account to reach.
 */
export function remindTeacher(
  classroomId: number,
  dates?: string[],
): Promise<RemindResult> {
  return apiPost<RemindResult>("/api/attendance/review/remind/", {
    classroom_id: classroomId,
    dates: dates ?? [],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Student attendance calendar (profile)
// ─────────────────────────────────────────────────────────────────────────────

/** Marked statuses plus the reasons a day carries no mark. */
export type CalendarCellStatus =
  | "present"
  | "absent"
  | "late"
  | "leave"
  | "excused"
  | "weekend"
  | "holiday"
  | "unmarked"
  | "future";

export interface CalendarDay {
  date: string;
  /** Day of month, 1–31. */
  day: number;
  weekday: string;
  status: CalendarCellStatus;
}

export interface StudentCalendarResponse {
  student_id: number;
  /** `YYYY-MM`. */
  month: string;
  days: CalendarDay[];
  summary: {
    present: number;
    absent: number;
    late: number;
    leave: number;
    excused: number;
    marked_days: number;
    attendance_pct: number;
  };
}

/**
 * 🔧 fetchStudentCalendar()
 * Purpose: One student's day-by-day attendance for a month, for their profile.
 * Input:  studentId, and month as `YYYY-MM` (defaults to current month).
 */
export function fetchStudentCalendar(
  studentId: number,
  month?: string,
): Promise<StudentCalendarResponse> {
  const query = month ? `?month=${encodeURIComponent(month)}` : "";
  return apiGet<StudentCalendarResponse>(
    `/api/attendance/student/${studentId}/calendar/${query}`,
  );
}

/** Result of reminding every delinquent class at once. */
export interface RemindAllResult {
  sent_count: number;
  no_teacher_count: number;
  sent: { classroom_id: number; classroom_label: string; teacher: string }[];
  no_teacher: string[];
}

/**
 * 🔧 remindAllTeachers()
 * Purpose: One request that reminds every teacher in scope whose class has an
 *          outstanding submission, so the coordinator does not click row by row.
 * Input:  the date range to consider (defaults server-side to the current month).
 */
export function remindAllTeachers(range?: Partial<DateRange>): Promise<RemindAllResult> {
  return apiPost<RemindAllResult>("/api/attendance/review/remind-all/", {
    ...(range?.from ? { from: range.from } : {}),
    ...(range?.to ? { to: range.to } : {}),
  });
}
