/**
 * Unified Attendance Review — API contract.
 *
 * These types mirror what `GET /api/attendance/review/` actually returns today,
 * not the shape sketched in the dev guide. Where the two differ, the server
 * wins and the comment says so — a type that describes a nicer API than the one
 * we have is worse than no type at all.
 *
 * Backend: attendance/services/review_view.py
 */

// ─────────────────────────────────────────────────────────────────────────────
//  Meta — UI hints
// ─────────────────────────────────────────────────────────────────────────────

/**
 * How the UI should present itself for this user.
 *
 * These are *hints*, never permission checks. The server enforces access on
 * every request; ignoring `show_roll` here gets you a 403, not student names.
 * Read this only in the top-level AttendanceReview component and pass what
 * children need — nothing below it should know the user's role.
 */
export interface ReviewMeta {
  role: ReviewRole;
  /** Page subtitle, e.g. "Primary & Middle" or "Class 5 - A". May be empty. */
  scope_label: string;
  /** Which row type the tree starts at for this role. */
  start_level: EntityType | "org";
  /** Deepest level this user may expand. */
  can_drill_to: DrillDepth;
  /** False → never render DayRoll; the server will refuse it anyway. */
  show_roll: boolean;
  /** True → student names are masked server-side ("Student #12"). */
  anonymised: boolean;
  can_approve: boolean;
  can_export: boolean;
}

export type ReviewRole =
  | "teacher"
  | "coordinator"
  | "principal"
  | "org_admin"
  | "accounts_officer"
  | "donor";

/**
 * A union, not `string`, so adding a depth to the backend forces every switch
 * on this to be revisited rather than silently falling through a default.
 */
export type DrillDepth = "org" | "campus" | "level" | "grade" | "classroom" | "student";

export type EntityType = "campus" | "level" | "grade" | "classroom";

// ─────────────────────────────────────────────────────────────────────────────
//  Date range
// ─────────────────────────────────────────────────────────────────────────────

export type DatePreset =
  | "today"
  | "yesterday"
  | "last_7"
  | "last_30"
  | "this_month"
  | "prev_month"
  | "custom";

/** Both ends inclusive, `YYYY-MM-DD`. Neither may be in the future. */
export interface DateRange {
  from: string;
  to: string;
}

export interface DateRangeMeta extends DateRange {
  /** Teaching days in the range: excludes Sundays and the holidays that apply
   *  to this user's own levels. Not simply `to - from`. */
  working_days: number;
}

/** The widest range the API accepts. Enforced server-side too. */
export const MAX_RANGE_DAYS = 366;

// ─────────────────────────────────────────────────────────────────────────────
//  Counts and rows
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aggregated student-days across the range.
 *
 * `attendance_pct` is NOT `present / total_students`. Approved absences come
 * out of the denominator:
 *
 *     present / (total_students − leave − excused)
 *
 * Do not recompute it on the client — the server owns this formula
 * (attendance/services/metrics.py) and a second implementation here would drift.
 */
export interface AttendanceCounts {
  total_students: number;
  present: number;
  absent: number;
  late: number;
  leave: number;
  excused: number;
}

interface ReviewRowBase {
  id: number;
  name: string;
  attendance_pct: number;
  counts: AttendanceCounts;
  student_count: number;
  has_children: boolean;
}

export interface CampusRow extends ReviewRowBase {
  type: "campus";
  code: string | null;
  child_type: "level";
}

export interface LevelRow extends ReviewRowBase {
  type: "level";
  shift: string;
  campus_id: number;
  coordinator: string | null;
  child_type: "grade";
}

export interface GradeRow extends ReviewRowBase {
  type: "grade";
  code: string | null;
  level_id: number;
  class_count: number;
  child_type: "classroom";
}

export interface ClassTeacherRef {
  id: number;
  name: string;
  employee_code: string | null;
}

export interface ClassroomRow extends ReviewRowBase {
  type: "classroom";
  code: string;
  section: string;
  shift: string;
  grade_name: string;
  class_teacher: ClassTeacherRef | null;
  /** Workflow state of the most recent register in range; null if none exists. */
  latest_status: WorkflowStatus | null;
  latest_date: string | null;
  child_type: "student_matrix";
}

/** Donor only — a single anonymised organisation total. */
export interface OrgRow extends ReviewRowBase {
  type: "org";
  has_children: false;
}

/**
 * Discriminated on `type`, so narrowing by it gives the right fields and an
 * unhandled variant is a compile error rather than `undefined` at runtime.
 */
export type ReviewRow = CampusRow | LevelRow | GradeRow | ClassroomRow | OrgRow;

// ─────────────────────────────────────────────────────────────────────────────
//  Missing submissions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A classroom that has not submitted on one or more teaching days.
 *
 * "Missing" means no register reached `submitted` — a `draft` still counts as
 * missing. Weekends, holidays for that class, and days before the class existed
 * are already excluded server-side; render `dates` as-is.
 */
export interface MissingDay {
  classroom_id: number;
  classroom_label: string;
  /** Who to remind. Null when no class teacher is assigned. */
  class_teacher: Pick<ClassTeacherRef, "id" | "name"> | null;
  /** `YYYY-MM-DD`, ascending. */
  dates: string[];
}

export interface ReviewSummary {
  total_students: number;
  class_count: number;
  avg_rate: number;
  /** Counts classroom-days, not classrooms: 3 classes × 2 days = 6. */
  missing_submissions: number;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Daily summary (Principal's Today's Attendance Summary)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One classroom for a single day.
 *
 * `no_on_roll` is the active student count (matches the tree's student_count);
 * `present`/`absent` come from that day's register, so a class nobody marked
 * reads 0 / 0. `attendance_pct` uses the requirement formula —
 * (present ÷ total) × 100, rounded to 2 decimals — NOT the tree's
 * leave-adjusted metric.
 */
export interface DailySummaryRow {
  id: number;
  /** Null when the classroom has no grade — group under "Other". */
  grade_id: number | null;
  grade_name: string;
  class_name: string;
  /** Null when no class teacher is assigned — display "Not Assigned". */
  teacher: ClassTeacherRef | null;
  no_on_roll: number;
  present: number;
  absent: number;
  boys_present: number;
  total_boys: number;
  girls_present: number;
  total_girls: number;
  attendance_pct: number;
}

/**
 * Campus-level totals for one day. Always the sum of the rows, so a footer
 * built from this can never disagree with the table above it.
 */
export interface DailySummary {
  total_students: number;
  present: number;
  absent: number;
  boys_present: number;
  total_boys: number;
  girls_present: number;
  total_girls: number;
  class_count: number;
  attendance_pct: number;
}

/** GET /api/attendance/review/daily/?date=YYYY-MM-DD */
export interface DailySummaryResponse {
  type: "daily_summary";
  /** `YYYY-MM-DD`. */
  date: string;
  campus: string;
  rows: DailySummaryRow[];
  summary: DailySummary;
  meta: ReviewMeta;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Student roll
// ─────────────────────────────────────────────────────────────────────────────

export type AttendanceStatus = "present" | "absent" | "late" | "leave" | "excused";

/** Cell values in the roll: a marked status, or why there is no mark. */
export type RollCell = AttendanceStatus | "weekend" | "holiday" | "unmarked";

export type DayType = "working" | "weekend" | "holiday";

export type WorkflowStatus = "draft" | "submitted" | "under_review" | "approved" | "holiday";

export interface RollDate {
  date: string;
  /** Short weekday name, e.g. "Mon". */
  day: string;
  type: DayType;
}

export interface StudentRollRow {
  student_id: number;
  /** "Student #12" when meta.anonymised. */
  student_name: string;
  father_name: string;
  gr_no: string;
  /** Keyed by `YYYY-MM-DD`, one entry per date in `dates`. */
  dates: Record<string, RollCell>;
  stats: Record<AttendanceStatus, number>;
  attendance_pct: number;
}

export interface StudentMatrix {
  dates: RollDate[];
  students: StudentRollRow[];
  /** Keyed by `YYYY-MM-DD`; only dates with a register appear. */
  workflow: Record<string, { attendance_id: number; status: WorkflowStatus }>;
  total_students: number;
  working_days: number;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Responses
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/attendance/review/
 *
 * `summary` and `missing_days` are present ONLY on the initial load. A
 * drill-down (`?expand=…`) returns one branch's rows and omits them, so treat
 * them as optional rather than assuming the shape is uniform.
 */
export interface ReviewTreeResponse {
  type: "tree";
  rows: ReviewRow[];
  meta: ReviewMeta;
  date_range: DateRangeMeta;
  summary?: ReviewSummary;
  missing_days?: MissingDay[];
}

/** GET /api/attendance/review/?classroom_id=… */
export interface ReviewMatrixResponse {
  type: "student_matrix";
  data: StudentMatrix;
  meta: ReviewMeta;
  date_range: DateRangeMeta;
}

/** GET /api/attendance/review/missing/ */
export interface ReviewMissingResponse {
  type: "missing_days";
  missing_days: MissingDay[];
  /** Total classroom-days, matching summary.missing_submissions. */
  total_missing: number;
  meta: ReviewMeta;
  date_range: DateRangeMeta;
}

export type ReviewResponse =
  | ReviewTreeResponse
  | ReviewMatrixResponse
  | ReviewMissingResponse;

// ─────────────────────────────────────────────────────────────────────────────
//  Requests and errors
// ─────────────────────────────────────────────────────────────────────────────

export interface ReviewQuery extends Partial<DateRange> {
  /** Child type to load. Omit for the initial load. */
  expand?: EntityType;
  /** Parent of `expand`: a campus id for expand=level, a level id for
   *  expand=grade, a grade id for expand=classroom. Validated against the
   *  user's scope server-side. */
  parent_id?: number;
  /** Fetch the roll for one classroom instead of the tree. */
  classroom_id?: number;
}

/**
 * Stable error codes. Switch on `code`, never on `message`, which is prose meant
 * for humans and may be reworded.
 */
export type ReviewErrorCode =
  /** 403 — the `view_attendance` toggle is off for this role. Comes from the
   *  permission layer, which DRF raises, so it carries the generic code and the
   *  specific reason lives in `message`. */
  | "FORBIDDEN"
  /** 403 — role recognised but nothing assigned to it. */
  | "SCOPE_EMPTY"
  /** 403 — this role may never read student-level data. */
  | "ROLL_ACCESS_DENIED"
  /** 403 — the requested id sits outside the user's scope. */
  | "SCOPE_VIOLATION"
  /** 404 */
  | "CLASSROOM_NOT_FOUND"
  /** 400 — bad format, from > to, or a future date. */
  | "INVALID_DATE_RANGE"
  /** 400 — span exceeds MAX_RANGE_DAYS. */
  | "RANGE_TOO_WIDE"
  /** 400 — a non-numeric id. */
  | "INVALID_PARAM";

/**
 * The project-wide error envelope (utils/exceptions.py). `lib/api.ts` parses
 * this into an ApiError, so components normally see that rather than this shape.
 */
export interface ReviewErrorResponse {
  success: false;
  error: {
    code: ReviewErrorCode;
    message: string;
    details: Record<string, unknown>;
    status: number;
  };
}
