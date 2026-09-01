"use client";
import React, { useState, useEffect, useMemo, Suspense } from "react";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import EnrollmentStatusCard from "@/components/students/enrollment-status-card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, Users, CheckCircle, XCircle, AlertCircle, Save, RefreshCw, Edit3, History, Eraser, Clock3, Bell, Eye, EyeOff, X, GraduationCap, Search, Clock, ShieldCheck, Keyboard, ChevronLeft, Layers } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUserRole } from "@/lib/permissions";
import { getCurrentUserProfile, getClassStudents, markBulkAttendance, getAttendanceHistory, getAttendanceForDate, editAttendance, submitAttendance, getBackfillPermissions, finalizeAttendance, coordinatorApproveAttendance, getApiBaseUrl, ApiError, getHolidays } from "@/lib/api";
import MarkingFilters, { type MarkingFilter, type MarkingSort } from "@/components/attendance/marking-filters";
import MarkingStatCards from "@/components/attendance/marking-stat-cards";
import MarkingSummaryPanel from "@/components/attendance/marking-summary-panel";
import { attendancePercentage as calcAttendancePercentage, percentageFromCounts } from "@/lib/attendance-metrics";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useAutoSave } from "@/hooks/useAutoSave";
import { SaveStatusIndicator } from "@/components/offline/SaveStatusIndicator";
import { DraftRecoveryDialog } from "@/components/offline/DraftRecoveryDialog";


type AttendanceStatus = "present" | "absent" | "late" | "leave" | "excused";

// 📘 Concept: const assertion + lookup table
// Kaam: Har status ka label, color aur icon ek jagah rakhta hai (DRY).
// Isse UI mein 5 pills bar-bar hardcode karne se bachtein hain.
const ATTENDANCE_STATUSES: AttendanceStatus[] = ["present", "absent", "late", "leave", "excused"];

const STATUS_META: Record<AttendanceStatus, { label: string; short: string; text: string; bg: string; border: string; activeBg: string; icon: any }> = {
  present: { label: "Present", short: "P", text: "text-green-600", bg: "bg-green-50", border: "border-green-500", activeBg: "bg-green-600 hover:bg-green-700 text-white", icon: CheckCircle },
  absent: { label: "Absent", short: "A", text: "text-red-600", bg: "bg-red-50", border: "border-red-500", activeBg: "bg-red-600 hover:bg-red-700 text-white", icon: XCircle },
  late: { label: "Late", short: "L", text: "text-orange-600", bg: "bg-orange-50", border: "border-orange-500", activeBg: "bg-orange-600 hover:bg-orange-700 text-white", icon: Clock },
  leave: { label: "Leave", short: "Lv", text: "text-purple-600", bg: "bg-purple-50", border: "border-purple-500", activeBg: "bg-purple-600 hover:bg-purple-700 text-white", icon: Calendar },
  excused: { label: "Excused", short: "Ex", text: "text-teal-600", bg: "bg-teal-50", border: "border-teal-500", activeBg: "bg-teal-600 hover:bg-teal-700 text-white", icon: ShieldCheck },
};

// 📘 Concept: Reusable component (AttendanceStatusPills)
// Kaam: 5-status pill selector — ek jagah define kiya, mobile + desktop dono mein reuse.
//
// `compact` renders letter-only pills that never wrap, for the register's
// Today's Status column. Without it the full labels make each pill wide enough
// that flex-wrap stacks all five vertically, and every row grows to five lines.
function AttendanceStatusPills({ studentId, status, editable, onChange, compact = false }: {
  studentId: number;
  status?: AttendanceStatus;
  editable: boolean;
  onChange: (id: number, s: AttendanceStatus) => void;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="flex flex-nowrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {ATTENDANCE_STATUSES.map((st) => {
          const meta = STATUS_META[st];
          const active = status === st;
          return (
            <button
              key={st}
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(studentId, st); }}
              disabled={!editable}
              title={meta.label}
              aria-label={meta.label}
              aria-pressed={active}
              className={`h-6 min-w-[1.75rem] rounded-full border px-1.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                active
                  ? `${meta.activeBg} border-transparent`
                  : `${meta.border} ${meta.text} bg-white hover:${meta.bg}`
              }`}
            >
              {meta.short}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
      {ATTENDANCE_STATUSES.map((st) => {
        const meta = STATUS_META[st];
        const active = status === st;
        const Icon = meta.icon;
        return (
          <Button
            key={st}
            size="sm"
            type="button"
            variant={active ? "default" : "outline"}
            className={`${active ? meta.activeBg : `${meta.border} ${meta.text} hover:bg-gray-50`} px-2 py-1 text-xs`}
            onClick={(e) => { e.stopPropagation(); onChange(studentId, st); }}
            disabled={!editable}
            title={meta.label}
          >
            <Icon className="h-3 w-3 mr-1" />
            <span className="hidden sm:inline">{meta.label}</span>
            <span className="sm:hidden">{meta.short}</span>
          </Button>
        );
      })}
    </div>
  );
}

// 📘 Concept: Read-only history matrix (Plan 3.9)
// Kaam: Student rows × date columns grid, color-coded cells. Edit yahan se nahi hota.
//
// Every day in the period gets a column, not just the days that happen to have a
// record. A day the teacher forgot to mark is the single most useful thing this
// grid can show, and it is invisible if missing days produce no column.
//
// Weekend rule mirrors backend/attendance/services/calendar_utils.py: Sunday.
// Campuses running Saturday–Thursday are not supported there either — when that
// changes, both sides change together.
const SUNDAY = 0;

// 🔧 studentIdOf()
// Purpose: Pull the student's id out of a StudentAttendance row.
// Input:  a serialized row from /api/attendance/class/<id>/
// Output: number | null
// Why:    AttendanceSerializer exposes the FK as `student` (fields = [... 'student' ...]);
//         there is no `student_id`. `student_id` is a real field on the Student
//         model itself, which is what made the wrong guess look plausible.
function studentIdOf(row: any): number | null {
  const raw = row?.student ?? row?.student_id;
  if (raw == null) return null;
  return typeof raw === "object" ? raw.id ?? null : Number(raw);
}

type DayKind = "working" | "weekend" | "holiday";

function HistoryGridView({
  mode,
  history,
  students,
  selectedDate,
  holidays,
}: {
  mode: "weekly" | "monthly";
  history: any[];
  students: any[];
  /** Anchors the period — the week or month this date falls in. */
  selectedDate: string;
  holidays: any[];
}) {
  const norm = (d: any) => String(d).split("T")[0];
  const toKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const holidayMap = useMemo(() => {
    const map: Record<string, string> = {};
    (holidays || []).forEach((h: any) => {
      map[norm(h.date)] = h.reason || "Holiday";
    });
    return map;
  }, [holidays]);

  // Every calendar day in the period, labelled.
  const days = useMemo(() => {
    const anchor = new Date(`${norm(selectedDate)}T00:00:00`);
    if (Number.isNaN(anchor.getTime())) return [];

    let from: Date;
    let to: Date;
    if (mode === "weekly") {
      // Monday-start week containing the selected date. getDay() is 0 for
      // Sunday, which must land at the END of the week, not the start.
      const offset = (anchor.getDay() + 6) % 7;
      from = new Date(anchor);
      from.setDate(anchor.getDate() - offset);
      to = new Date(from);
      to.setDate(from.getDate() + 6);
    } else {
      from = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      to = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    }

    const out: { key: string; label: string; dow: string; kind: DayKind; reason?: string }[] = [];
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const key = toKey(d);
      const kind: DayKind =
        d.getDay() === SUNDAY ? "weekend" : holidayMap[key] ? "holiday" : "working";
      out.push({
        key,
        label: String(d.getDate()),
        dow: d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2),
        kind,
        reason: holidayMap[key],
      });
    }
    return out;
  }, [mode, selectedDate, holidayMap]);

  // date -> student -> status
  const statusMap = useMemo(() => {
    const map: Record<string, Record<number, AttendanceStatus>> = {};
    (history || []).forEach((h) => {
      const d = norm(h.date);
      map[d] = {};
      (h.student_attendance || []).forEach((r: any) => {
        // The serializer exposes the FK as `student`, not `student_id` — reading
        // the latter keyed every status under `undefined`, so every cell showed
        // "not marked" even on days that clearly had a register.
        const sid = studentIdOf(r);
        if (sid != null) map[d][sid] = r.status;
      });
    });
    return map;
  }, [history]);

  const workingDays = days.filter((d) => d.kind === "working");
  const missingDays = workingDays.filter((d) => !statusMap[d.key]);

  if (days.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-500">Select a date to view history.</p>;
  }

  const periodLabel =
    mode === "weekly"
      ? `${days[0].key} → ${days[days.length - 1].key}`
      : new Date(`${days[0].key}T00:00:00`).toLocaleDateString(undefined, {
          month: "long",
          year: "numeric",
        });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="font-medium text-gray-700">{periodLabel}</span>
        <span className="text-gray-500">{workingDays.length} working days</span>
        {missingDays.length > 0 ? (
          <span className="font-medium text-red-600">
            {missingDays.length} not submitted: {missingDays.map((d) => d.key.slice(5)).join(", ")}
          </span>
        ) : (
          <span className="font-medium text-green-600">All working days submitted</span>
        )}
        <span className="ml-auto flex flex-wrap items-center gap-2 text-gray-500">
          {ATTENDANCE_STATUSES.map((st) => (
            <span key={st} className="flex items-center gap-1">
              <span className={`inline-block h-2.5 w-2.5 rounded-full border ${STATUS_META[st].bg} ${STATUS_META[st].border}`} />
              {STATUS_META[st].label}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full border border-dashed border-gray-400" />
            Not marked
          </span>
        </span>
      </div>

      <div className="max-h-[60vh] overflow-auto rounded-md border">
        <Table>
          <TableHeader className="sticky top-0 z-20 bg-white shadow-[0_1px_0_0_rgb(229_231_235)]">
            <TableRow>
              <TableHead className="sticky left-0 z-30 bg-white text-xs">Student</TableHead>
              {days.map((d) => (
                <TableHead
                  key={d.key}
                  className={`whitespace-nowrap px-1 text-center text-[10px] ${
                    d.kind === "working" ? "text-gray-600" : "text-gray-400"
                  }`}
                  title={d.reason ?? d.kind}
                >
                  <div>{d.dow}</div>
                  <div className="font-normal">{d.label}</div>
                </TableHead>
              ))}
              <TableHead className="whitespace-nowrap px-2 text-right text-[10px]">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((s) => {
              const tally: Partial<Record<AttendanceStatus, number>> = {};
              days.forEach((d) => {
                const st = statusMap[d.key]?.[s.id];
                if (st) tally[st] = (tally[st] ?? 0) + 1;
              });
              return (
                <TableRow key={s.id}>
                  <TableCell className="sticky left-0 z-10 whitespace-nowrap bg-white text-xs font-medium">
                    {s.name}
                  </TableCell>
                  {days.map((d) => {
                    const st = statusMap[d.key]?.[s.id] as AttendanceStatus | undefined;
                    if (d.kind !== "working") {
                      return (
                        <TableCell key={d.key} className="px-1 text-center" title={d.reason ?? "Weekend"}>
                          <span className="inline-block h-4 w-4 rounded bg-gray-100" />
                        </TableCell>
                      );
                    }
                    if (!st) {
                      return (
                        <TableCell key={d.key} className="px-1 text-center" title="Not marked">
                          <span className="inline-block h-4 w-4 rounded border border-dashed border-gray-300" />
                        </TableCell>
                      );
                    }
                    const meta = STATUS_META[st];
                    return (
                      <TableCell key={d.key} className="px-1 text-center">
                        <span
                          className={`inline-block h-4 w-4 rounded-full border ${meta.bg} ${meta.border}`}
                          title={`${meta.label} — ${d.key}`}
                        />
                      </TableCell>
                    );
                  })}
                  <TableCell className="px-2 text-right text-xs font-medium">
                    {percentageFromCounts(tally)}%
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

interface Student {
  id: number;
  name: string;
  father_name?: string;
  father_cnic?: string;
  student_code: string;
  student_id?: string;
  gr_no?: string;
  gender: string;
  photo?: string;
}

interface ClassInfo {
  id: number;
  name: string;
  code: string;
  grade: string;
  section: string;
  shift: string;
  campus?: string;
}



interface SimpleClassRoom {
  id: number;
  name: string;
  code?: string;
  grade?: any;
  section?: string;
  shift?: string;
  campus?: any;
}

interface TeacherProfile {
  assigned_classroom?: SimpleClassRoom;
  assigned_classrooms?: SimpleClassRoom[];
}

function TeacherAttendanceContent() {
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<number, AttendanceStatus>>({});
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [attendanceHistory] = useState<unknown[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [existingAttendanceId, setExistingAttendanceId] = useState<number | null>(null);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showBackfillModal, setShowBackfillModal] = useState(false);
  const [backfillPermissions, setBackfillPermissions] = useState<any[]>([]);
  const [hasNewPermissions, setHasNewPermissions] = useState(false);
  const [last6DaysAttendance, setLast6DaysAttendance] = useState<any[]>([]);
  const [loadingLast6Days, setLoadingLast6Days] = useState(false);
  const [expandedAttendance, setExpandedAttendance] = useState<number | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [attendanceHistoryData, setAttendanceHistoryData] = useState<any[]>([]);
  const [attendanceSubmitted, setAttendanceSubmitted] = useState(false);
  const [attendanceLoaded, setAttendanceLoaded] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [classroomOptions, setClassroomOptions] = useState<SimpleClassRoom[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  // `holidays` above is filtered to today-and-future for the "upcoming" badges.
  // The history grid looks backwards, so it needs the unfiltered list.
  const [allHolidays, setAllHolidays] = useState<any[]>([]);
  const [selectedHoliday, setSelectedHoliday] = useState<any | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showStudentModal, setShowStudentModal] = useState(false);

  // ─── Plan Section 3 enhancements ─────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"mark" | "weekly" | "monthly">("mark");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<MarkingFilter>("all");
  const [letterFilter, setLetterFilter] = useState<string | null>(null);

  // ── Offline auto-save (Phase 7) ──────────────────────────────────────
  // Attendance ek bulk sheet hai (Record<studentId, status>), par chhota hai
  // isliye whole-object draft theek hai. Draft ki pehchaan = classroom + date.
  // baselineSkip: server se loaded attendance ka draft tab tak nahi banta jab
  // tak user actual change na kare (false restore prompt se bachne ke liye).
  const attendanceDraftId = `attendance-${classInfo?.id ?? "na"}-${selectedDate}`;
  const {
    status: attSaveStatus,
    lastSavedAt: attLastSavedAt,
    clearDraft: clearAttendanceDraft,
  } = useAutoSave<Record<number, AttendanceStatus>>(
    attendanceDraftId,
    attendance,
    { enabled: !!classInfo?.id && !attendanceSubmitted, baselineSkip: true }
  );
  const [sortBy, setSortBy] = useState<MarkingSort>("roll");
  const [sortAsc, setSortAsc] = useState(true);
  const [studentStats, setStudentStats] = useState<Record<number, { pct: number; consecutive: number; yesterday: AttendanceStatus | null }>>({});
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const LOW_ATTENDANCE_THRESHOLD = 75;
  const CONSECUTIVE_ALERT_THRESHOLD = 3;
  const [focusedStudentId, setFocusedStudentId] = useState<number | null>(null);

  // Helper function to normalize date format (YYYY-MM-DD)
  const normalizeDate = (dateStr: string | undefined | null): string => {
    if (!dateStr) return '';
    // Handle both date objects and strings
    if (typeof dateStr === 'string') {
      return dateStr.split('T')[0]; // Remove time part if present
    }
    return dateStr;
  };

  const router = useRouter();
  const searchParams = useSearchParams();
  const resolveMediaUrl = (url?: string) => {
    if (!url) return "";
    if (/^(https?:)?\/\//.test(url) || url.startsWith('data:')) return url;
    const base = getApiBaseUrl();
    const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${cleanBase}${path}`;
  };


  const userRole = getCurrentUserRole();
  const classroomId = searchParams.get('classroom');
  const isWeekend = new Date(selectedDate).getDay() === 0; // Sunday

  useEffect(() => {
    if (userRole === 'teacher') {
      document.title = "Mark Attendance | Newton AMS";
      fetchTeacherData();
      fetchBackfillPermissions();
    } else if (userRole === 'coordinator' && classroomId) {
      document.title = "View Attendance | Newton AMS";
      fetchCoordinatorClassData();
      fetchCurrentMonthAttendance();
    }
  }, [userRole, classroomId]);

  // Check for approved attendance notifications
  useEffect(() => {
    if (userRole === 'teacher' && attendanceHistory) {
      checkForApprovedAttendance();
    }
  }, [attendanceHistory, userRole]);

  // Removed periodic check - approval notifications now come via WebSocket only

  // 📘 Concept: useEffect + window event listener
  // Kaam: Keyboard shortcuts (P/A/L/E/V) se focused student ka status badalta hai.
  // Plan 3.7: keyboard navigation support.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (activeTab !== "mark") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (!focusedStudentId) return;
      if (!isDateEditable()) return;
      const map: Record<string, AttendanceStatus> = { p: "present", a: "absent", l: "late", e: "excused", v: "leave" };
      const status = map[e.key.toLowerCase()];
      if (status) {
        e.preventDefault();
        handleAttendanceChange(focusedStudentId, status);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeTab, focusedStudentId, isDateEditable]);

  const fetchTeacherData = async () => {
    try {
      setLoading(true);
      setLoadingStudents(true);
      setError("");

      // Get teacher's profile and classroom
      const teacherProfile = await getCurrentUserProfile() as TeacherProfile;

      if (!teacherProfile) {
        setError("Failed to load user profile. Please login again.");
        // Redirect to login after a short delay
        setTimeout(() => {
          router.push('/login');
        }, 2000);
        return;
      }

      const multi = Array.isArray(teacherProfile.assigned_classrooms) ? teacherProfile.assigned_classrooms : []
      if (!teacherProfile.assigned_classroom && multi.length === 0) {
        setError("No classroom assigned to you. Please contact administrator.");
        return;
      }

      // Build classroom selection list
      const options: SimpleClassRoom[] = multi.length > 0 ? multi : (teacherProfile.assigned_classroom ? [teacherProfile.assigned_classroom] : [])
      setClassroomOptions(options)

      // Choose classroom from URL ?classroom=ID or default to first
      const urlParamId = searchParams.get('classroom')
      const selected = (urlParamId ? options.find(c => String(c.id) === String(urlParamId)) : options[0]) as any
      if (!selected) {
        setError("No classroom assigned to you. Please contact administrator.");
        return;
      }

      // Set class info
      setClassInfo({
        id: selected.id,
        name: selected.name || "Unknown Class",
        code: selected.code || "",
        grade: (selected as any).grade?.name || "",
        section: (selected as any).section || "",
        shift: (selected as any).shift || "",
        campus: (selected as any).campus?.campus_name || ""
      });

      // Fetch students for this classroom
      const studentsData = await getClassStudents(selected.id) as Student[];
      setStudents(studentsData);
      setLoadingStudents(false);

      // Determine initial date (support ?date=YYYY-MM-DD)
      const dateParam = searchParams.get('date')
      const initialDate = dateParam || selectedDate
      setSelectedDate(initialDate)

      // Fetch holidays FIRST before loading attendance - try multiple ways to get level ID
      let levelId: number | null = null;

      // Method 1: Try level_id (direct - from backend update)
      if ((selected as any).level_id) {
        levelId = (selected as any).level_id;
      }
      // Method 2: Try grade.level.id (nested structure)
      else if ((selected as any).grade?.level?.id) {
        levelId = (selected as any).grade.level.id;
      }
      // Method 3: Try level.id (direct structure)
      else if ((selected as any).level?.id) {
        levelId = (selected as any).level.id;
      }
      // Method 4: Fallback - fetch full classroom details if we still don't have level_id
      if (!levelId && selected.id) {
        try {
          const { getClassrooms } = await import('@/lib/api');
          const classroomsData = await getClassrooms();
          const classroomsList = Array.isArray(classroomsData)
            ? classroomsData
            : ((classroomsData as any)?.results || []);
          const fullClassroom = classroomsList.find((c: any) => c.id === selected.id);
          if (fullClassroom) {
            // Try level_id first (from backend)
            if (fullClassroom.level_id) {
              levelId = fullClassroom.level_id;
            }
            // Try grade.level.id (nested)
            else if (fullClassroom.grade?.level?.id) {
              levelId = fullClassroom.grade.level.id;
            }
            // Try level.id (direct)
            else if (fullClassroom.level?.id) {
              levelId = fullClassroom.level.id;
            }
          }
        } catch (fetchError) {
          console.error('Failed to fetch classroom details:', fetchError);
        }
      }

      // Fetch holidays FIRST before loading attendance
      let allHolidaysForCheck: any[] = [];
      if (levelId) {
        try {
          const holidaysData = await getHolidays({ levelId });
          allHolidaysForCheck = Array.isArray(holidaysData) ? holidaysData : [];
          setAllHolidays(allHolidaysForCheck);
          // Filter to only future holidays (including today) for display badges
          const today = normalizeDate(new Date().toISOString());
          const futureHolidays = allHolidaysForCheck.filter((h: any) => {
            const holidayDate = normalizeDate(h.date);
            return holidayDate >= today; // Only future or today
          });
          setHolidays(futureHolidays);
        } catch (error) {
          console.error('Failed to fetch holidays:', error);
          setHolidays([]);
        }
      }

      // Load existing attendance for initial date AFTER holidays are fetched
      // Pass levelId and allHolidays to ensure holiday check works properly
      await loadExistingAttendance(selected.id, initialDate, levelId, allHolidaysForCheck);

      // Fetch per-student stats for risk badges (yesterday %, consecutive absence).
      // Pass the id directly: setClassInfo above does not update `classInfo`
      // until the next render, so reading it here would still see the old value.
      fetchStudentStats(selected.id);

    } catch (err: unknown) {
      console.error('Error fetching teacher data:', err);
      setError("Failed to load class data. Please try again.");
    } finally {
      setLoading(false);
      setLoadingStudents(false);
    }
  };

  // 🔧 fetchStudentStats()
  // Purpose: Har student ki attendance % + consecutive absence + kal ka status nikalta hai (risk badges ke liye).
  // Input: classroomId — passed in, NOT read from state. Callers run in the same
  //        tick as setClassInfo(), where `classInfo` is still the previous value
  //        (null on first load), which silently emptied every risk column.
  // Output: studentStats state update
  const fetchStudentStats = async (classroomId?: number) => {
    const targetId = classroomId ?? classInfo?.id;
    if (!targetId) return;
    try {
      setLoadingHistory(true);
      const history = (await getAttendanceHistory(targetId)) as any[];
      const days = Array.isArray(history) ? history : [];
      setHistoryData(days);

      const sorted = [...days].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const map: Record<number, { tally: Partial<Record<AttendanceStatus, number>>; sequence: AttendanceStatus[]; byDate: Record<string, AttendanceStatus> }> = {};

      sorted.forEach((day: any) => {
        (day.student_attendance || []).forEach((r: any) => {
          const sid = studentIdOf(r);
          if (sid == null) return;
          const st = r.status as AttendanceStatus;
          if (!map[sid]) map[sid] = { tally: {}, sequence: [], byDate: {} };
          map[sid].tally[st] = (map[sid].tally[st] ?? 0) + 1;
          map[sid].sequence.push(st);
          map[sid].byDate[normalizeDate(day.date)] = st;
        });
      });

      const result: Record<number, { pct: number; consecutive: number; yesterday: AttendanceStatus | null }> = {};
      const selTime = new Date(normalizeDate(selectedDate)).getTime();
      Object.entries(map).forEach(([sid, v]) => {
        // Same rule as the live counter above and as the server.
        const pct = percentageFromCounts(v.tally);
        let consecutive = 0;
        for (let i = v.sequence.length - 1; i >= 0; i--) {
          if (v.sequence[i] === 'absent') consecutive += 1; else break;
        }
        let bestDate = '';
        Object.keys(v.byDate).forEach((d) => {
          if (new Date(d).getTime() < selTime && d > bestDate) bestDate = d;
        });
        result[Number(sid)] = { pct, consecutive, yesterday: bestDate ? v.byDate[bestDate] : null };
      });
      setStudentStats(result);
    } catch (e) {
      console.error('Error fetching student stats:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadExistingAttendance = async (classroomId: number, date: string, providedLevelId?: number | null, providedHolidays?: any[]) => {
    try {
      // Use provided levelId and holidays if available, otherwise try to get them
      let levelId: number | null = providedLevelId ?? null;
      let allHolidays: any[] = providedHolidays ?? [];

      // If not provided, try to get level ID from classroom options
      if (!levelId) {
        const currentClassroom = classroomOptions.find(c => c.id === classroomId);

        if (currentClassroom) {
          // Method 1: Try level_id (direct - from backend update)
          if ((currentClassroom as any).level_id) {
            levelId = (currentClassroom as any).level_id;
          }
          // Method 2: Try grade.level.id (nested structure)
          else if ((currentClassroom as any).grade?.level?.id) {
            levelId = (currentClassroom as any).grade.level.id;
          }
          // Method 3: Try level.id (direct structure)
          else if ((currentClassroom as any).level?.id) {
            levelId = (currentClassroom as any).level.id;
          }
          // Method 4: Try grade.level (if level is an object with id)
          else if ((currentClassroom as any).grade?.level && typeof (currentClassroom as any).grade.level === 'object' && (currentClassroom as any).grade.level.id) {
            levelId = (currentClassroom as any).grade.level.id;
          }
        }
      }

      // If holidays not provided, fetch them fresh
      if (allHolidays.length === 0 && levelId) {
        try {
          const holidaysData = await getHolidays({ levelId });
          allHolidays = Array.isArray(holidaysData) ? holidaysData : [];

          // Filter to only future holidays (including today) for display badges
          const today = normalizeDate(new Date().toISOString());
          const futureHolidays = allHolidays.filter((h: any) => {
            const holidayDate = normalizeDate(h.date);
            return holidayDate >= today; // Only future or today
          });
          setHolidays(futureHolidays);
        } catch (error) {
          console.error('Failed to fetch holidays:', error);
          // Fallback to state if fetch fails
          allHolidays = holidays;
        }
      } else if (allHolidays.length === 0) {
        // Fallback to state if no levelId
        allHolidays = holidays;
      }

      // Check if this date is a holiday (check all holidays, including past and today)
      const normalizedDate = normalizeDate(date);
      const holiday = allHolidays.find((h: any) => {
        const holidayDate = normalizeDate(h.date);
        return holidayDate === normalizedDate;
      });

      if (holiday) {
        // If holiday exists, don't load attendance - show holiday instead
        setSelectedHoliday(holiday);
        setAttendance({});
        setIsEditMode(false);
        setExistingAttendanceId(null);
        setAttendanceLoaded(false);
        return;
      }

      // Clear holiday selection if not a holiday
      setSelectedHoliday(null);

      const attendanceData = await getAttendanceForDate(classroomId, date) as any;
      if (attendanceData && attendanceData.id) {
        // Load the attendance data to show as read-only
        const existingAttendance: Record<number, AttendanceStatus> = {};
        if (attendanceData.student_attendance) {
          attendanceData.student_attendance.forEach((record: any) => {
            existingAttendance[record.student_id] = record.status;
          });
        }
        setAttendance(existingAttendance);
        setExistingAttendanceId(attendanceData.id);
        setIsEditMode(false); // Not in edit mode initially - read-only
        setAttendanceLoaded(false); // Not loaded for editing yet
      } else {
        setAttendance({});
        setIsEditMode(false);
        setExistingAttendanceId(null);
        setAttendanceLoaded(false);
      }
    } catch (error: unknown) {
      console.error('Error loading existing attendance:', error);
      setAttendance({});
      setIsEditMode(false);
      setExistingAttendanceId(null);
      setAttendanceLoaded(false);
    }
  };

  const handleAttendanceChange = (studentId: number, status: AttendanceStatus) => {
    // Allow changes if in edit mode OR if no existing attendance (new attendance)
    if (!isEditMode && existingAttendanceId) {
      return;
    }

    setAttendance(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const handleDateChange = async (newDate: string) => {
    setSelectedDate(newDate);
    setAttendance({});
    setIsEditMode(false);
    setExistingAttendanceId(null);
    setSelectedHoliday(null);

    // Refresh holidays when date changes (in case new holidays were added)
    // Try to get level ID from classroom options
    let levelId: number | null = null;
    const currentClassroom = classroomOptions.find(c => c.id === classInfo?.id);

    if (currentClassroom) {
      // Method 1: Try level_id (direct - from backend update)
      if ((currentClassroom as any).level_id) {
        levelId = (currentClassroom as any).level_id;
      }
      // Method 2: Try grade.level.id (nested structure)
      else if ((currentClassroom as any).grade?.level?.id) {
        levelId = (currentClassroom as any).grade.level.id;
      }
      // Method 3: Try level.id (direct structure)
      else if ((currentClassroom as any).level?.id) {
        levelId = (currentClassroom as any).level.id;
      }
      // Method 4: Try grade.level (if level is an object with id)
      else if ((currentClassroom as any).grade?.level && typeof (currentClassroom as any).grade.level === 'object' && (currentClassroom as any).grade.level.id) {
        levelId = (currentClassroom as any).grade.level.id;
      }
    }

    if (levelId) {
      try {
        const holidaysData = await getHolidays({ levelId });
        const allHolidays = Array.isArray(holidaysData) ? holidaysData : [];

        // Filter to only future holidays (including today) for display badges
        const today = normalizeDate(new Date().toISOString());
        const futureHolidays = allHolidays.filter((h: any) => {
          const holidayDate = normalizeDate(h.date);
          return holidayDate >= today; // Only future or today
        });
        setHolidays(futureHolidays);

        // Check if new date is a holiday (check all holidays, including past)
        const normalizedNewDate = normalizeDate(newDate);
        const holiday = allHolidays.find((h: any) => normalizeDate(h.date) === normalizedNewDate);
        if (holiday) {
          // If holiday found, set it and don't load attendance
          setSelectedHoliday(holiday);
          setAttendance({});
          setIsEditMode(false);
          setExistingAttendanceId(null);
          setAttendanceLoaded(false);
          return; // Don't load attendance for holidays
        }
      } catch (error) {
        console.error('Error fetching holidays:', error);
      }
    } else {
      // Fallback: check existing holidays (normalize date format)
      const normalizedNewDate = normalizeDate(newDate);
      const holiday = holidays.find((h: any) => normalizeDate(h.date) === normalizedNewDate);
      if (holiday) {
        // If holiday found, set it and don't load attendance
        setSelectedHoliday(holiday);
        setAttendance({});
        setIsEditMode(false);
        setExistingAttendanceId(null);
        setAttendanceLoaded(false);
        return; // Don't load attendance for holidays
      }
    }

    // Only load attendance if it's not a holiday
    if (classInfo) {
      await loadExistingAttendance(classInfo.id, newDate);
    }
  };

  const handleSubmit = () => {
    // Check if date is a holiday (normalize date format)
    const normalizedSelectedDate = normalizeDate(selectedDate);
    const holiday = holidays.find((h: any) => normalizeDate(h.date) === normalizedSelectedDate);
    if (holiday) {
      toast.warning(`This date is a holiday: ${holiday.reason}. Attendance marking is disabled.`);
      return;
    }

    // Block Sunday marking entirely
    if (isWeekend) {
      toast.info('Weekend (Sunday) — Attendance marking disabled. System will auto-record as Weekend/Holiday.');
      return;
    }
    // Check if attendance already exists for this date
    if (existingAttendanceId && !isEditMode) {
      toast.warning('Attendance Already Marked!', {
        description: 'You have already marked attendance for this date. To edit previous attendance, please click "Load Saved Attendance" button first.'
      });
      return;
    }

    // Check if all students have attendance marked
    if (students.length === 0) {
      toast.error('No Students Found!', {
        description: 'Please make sure students are loaded for this classroom.'
      });
      return;
    }

    const markedStudents = Object.keys(attendance).length;
    const totalStudents = students.length;

    if (markedStudents < totalStudents) {
      const unmarkedCount = totalStudents - markedStudents;
      toast.error('Incomplete Attendance!', {
        description: `You have marked attendance for ${markedStudents} out of ${totalStudents} students. Please mark attendance for all remaining students before submitting.`
      });
      return;
    }

    // Show confirmation modal instead of directly submitting
    setShowConfirmationModal(true);
  };

  const confirmSubmit = async () => {
    if (!classInfo) return;

    try {
      setSaving(true);
      setShowConfirmationModal(false);

      // Prepare student attendance data
      const studentAttendanceData = Object.entries(attendance).map(([studentId, status]) => ({
        student_id: parseInt(studentId),
        status: status,
        remarks: ''
      }));

      let result;

      if (isEditMode && existingAttendanceId) {
        // Edit existing attendance
        result = await editAttendance(existingAttendanceId, {
          student_attendance: studentAttendanceData
        });
      } else {
        // Mark new attendance
        result = await markBulkAttendance({
          classroom_id: classInfo.id,
          date: selectedDate,
          student_attendance: studentAttendanceData
        });
      }

      toast.success(`Attendance ${isEditMode ? 'Updated' : 'Marked'} Successfully!`, {
        description: isEditMode ? 'Your changes have been saved.' : 'Attendance has been recorded for this date.'
      });

      // Server pe save ho gaya — local draft hata do.
      clearAttendanceDraft();

      // Keep the sheet filled after saving - don't clear it
      // setAttendance({}); // Removed - keep sheet filled
      setIsEditMode(false);

      // Set existingAttendanceId for future loads
      if (result && (result as any).attendance_id) {
        setExistingAttendanceId((result as any).attendance_id);
      } else if (result && (result as any).id) {
        setExistingAttendanceId((result as any).id);
      } else if (result && (result as any).data && (result as any).data.id) {
        setExistingAttendanceId((result as any).data.id);
      }

      // If in edit mode, auto-submit for review ONLY if status is 'draft'
      if (isEditMode && existingAttendanceId) {
        try {
          // Check status from result to avoid unnecessary submission (and 400 errors) if already submitted
          const currentStatus = (result as any)?.status || (result as any)?.data?.status;

          // Only auto-submit if it's currently a draft
          if (currentStatus === 'draft') {
            await handleSubmitForReview(true);
          } else {
            console.log(`[Auto-Submit] Skipping submission because status is '${currentStatus}' (not 'draft')`);
          }
        } catch (error) {
          console.error('Error auto-submitting for review:', error);
          // Don't show error here as the update was successful
        }
      }

    } catch (err: unknown) {
      console.error('Error marking attendance:', err);

      // Handle ApiError with user-friendly messages
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error(`Failed to ${isEditMode ? 'Update' : 'Mark'} Attendance!`, {
          description: 'Please check your internet connection and try again.'
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const markAllPresent = () => {
    const newAttendance: Record<number, AttendanceStatus> = {};
    students.forEach(student => {
      newAttendance[student.id] = 'present';
    });
    setAttendance(newAttendance);
  };

  const markAllAbsent = () => {
    const newAttendance: Record<number, AttendanceStatus> = {};
    students.forEach(student => {
      newAttendance[student.id] = 'absent';
    });
    setAttendance(newAttendance);
  };

  const clearAllAttendance = () => {
    setAttendance({});
  };


  const handleSubmitForReview = async (silent: boolean = false) => {
    if (!existingAttendanceId) return;

    // Check if all students have attendance marked
    if (students.length === 0) {
      if (!silent) toast.error('No Students Found!', {
        description: 'Please make sure students are loaded for this classroom.'
      });
      return;
    }

    const markedStudents = Object.keys(attendance).length;
    const totalStudents = students.length;

    if (markedStudents < totalStudents) {
      const unmarkedCount = totalStudents - markedStudents;
      if (!silent) {
        toast.error('Incomplete Attendance!', {
          description: `You have marked attendance for ${markedStudents} out of ${totalStudents} students. Please mark attendance for all students before submitting.`
        });
      }
      return;
    }

    try {
      setSubmitting(true);
      await submitAttendance(existingAttendanceId);

      if (!silent) {
        toast.success('Attendance submitted for review successfully!', {
          description: 'Your attendance has been sent to the coordinator for review.'
        });

        // Clear the sheet after submitting for review
        clearAttendanceDraft();
        setAttendance({});
        setIsEditMode(false);
        setExistingAttendanceId(null);
        setAttendanceSubmitted(true); // Mark as submitted

        // Refresh data
        fetchTeacherData();
      }
    } catch (error) {
      console.error('Error submitting attendance:', error);
      if (!silent) {
        toast.error('Failed to submit attendance. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const fetchBackfillPermissions = async () => {
    try {
      const permissions = await getBackfillPermissions() as any[];
      setBackfillPermissions(permissions);
      // Check if there are any new permissions (not used)
      const newPermissions = permissions.filter((p: any) => !p.is_used);
      setHasNewPermissions(newPermissions.length > 0);
    } catch (error) {
      console.error('Error fetching backfill permissions:', error);
    }
  };

  const handleBackfillIconClick = () => {
    setShowBackfillModal(true);
    fetchBackfillPermissions();
  };

  const fetchCoordinatorClassData = async () => {
    try {
      setLoading(true);
      setError("");

      if (!classroomId) {
        setError("No classroom specified");
        return;
      }

      // Get classroom info directly from classrooms API
      const classroomResponse = await fetch(`/api/classrooms/${classroomId}/`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        }
      });

      let classroomData = null;
      if (classroomResponse.ok) {
        classroomData = await classroomResponse.json();
      } else {
        console.log('❌ Classroom API failed with status:', classroomResponse.status);
      }

      // Get students and attendance history
      const [classStudents, attendanceHistory] = await Promise.all([
        getClassStudents(parseInt(classroomId)),
        getAttendanceHistory(parseInt(classroomId))
      ]);

      // Set classroom info from API or fallback
      if (classroomData) {
        setClassInfo({
          id: classroomData.id,
          name: classroomData.name || `Classroom ${classroomId}`,
          code: classroomData.code || `C06-L2-G03-A`, // Use real code, fallback to A
          grade: classroomData.grade?.name || '',
          section: classroomData.section || '',
          shift: classroomData.shift || '',
          campus: classroomData.campus?.campus_name || ''
        });
      } else if (classStudents && Array.isArray(classStudents) && classStudents.length > 0) {
        // Fallback: Extract from first student
        const firstStudent = classStudents[0] as any;

        setClassInfo({
          id: parseInt(classroomId),
          name: firstStudent.classroom_name || `Classroom ${classroomId}`,
          code: firstStudent.classroom_code || `C06-L2-G03-A`, // Use real code, fallback to A
          grade: firstStudent.grade || '',
          section: firstStudent.section || '',
          shift: firstStudent.shift || '',
          campus: firstStudent.campus_name || ''
        });
      } else {
        // Final fallback with default code
        setClassInfo({
          id: parseInt(classroomId),
          name: `Classroom ${classroomId}`,
          code: `C06-L2-G03-A`, // Default to A
          grade: '',
          section: '',
          shift: '',
          campus: ''
        });
      }

      if (classStudents && Array.isArray(classStudents)) {
        setStudents(classStudents as Student[]);
      }

      if (attendanceHistory && Array.isArray(attendanceHistory) && attendanceHistory.length > 0) {
        setLast6DaysAttendance(attendanceHistory as any[]);
      }

    } catch (error) {
      console.error('Error fetching coordinator class data:', error);
      setError('Failed to load classroom data');
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentMonthAttendance = async () => {
    try {
      setLoadingLast6Days(true);

      if (!classroomId) return;

      // Get current month start and end dates
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      const attendanceData = await getAttendanceHistory(
        parseInt(classroomId),
        firstDay.toISOString().split('T')[0],
        lastDay.toISOString().split('T')[0]
      );

      if (Array.isArray(attendanceData) && attendanceData.length > 0) {
        console.log('👥 Student attendance length:', Array.isArray(attendanceData[0].student_attendance) ? attendanceData[0].student_attendance.length : 'Not an array');
        if (Array.isArray(attendanceData[0].student_attendance) && attendanceData[0].student_attendance.length > 0) {
          console.log('👥 First student in attendance:', attendanceData[0].student_attendance[0]);
          console.log('👥 First student father_name:', attendanceData[0].student_attendance[0]?.student_father_name);
        }
      }

      setLast6DaysAttendance((attendanceData as any[]) || []);
    } catch (error) {
      console.error('Error fetching last 6 days attendance:', error);
    } finally {
      setLoadingLast6Days(false);
    }
  };

  const handleApproveAttendance = async (attendanceId: number) => {
    try {
      console.log('Approving attendance:', attendanceId);

      // First check the current status and handle accordingly
      const attendanceRecord = last6DaysAttendance.find(record => record.id === attendanceId);

      if (!attendanceRecord) {
        toast.error('Attendance record not found!');
        return;
      }

      console.log('Current status:', attendanceRecord.status);
      console.log('User role:', userRole);

      // Different approval flow based on user role
      if (userRole === 'coordinator') {
        // Coordinator approval flow - use new direct approval API
        if (attendanceRecord.status === 'draft' || attendanceRecord.status === 'submitted') {
          console.log('Coordinator: Directly approving attendance...');
          await coordinatorApproveAttendance(attendanceId);
          console.log('Attendance approved successfully');

          toast.success('Attendance approved successfully!');
        }
        else if (attendanceRecord.status === 'under_review') {
          console.log('Coordinator: Finalizing under review attendance...');
          await finalizeAttendance(attendanceId);
          console.log('Attendance approved successfully');

          toast.success('Attendance approved successfully!');
        }
        else if (attendanceRecord.status === 'approved') {
          toast.info('Attendance is already approved!');
          return;
        }
      } else if (userRole === 'teacher') {
        // Teacher approval flow (can only submit, not finalize)
        if (attendanceRecord.status === 'draft') {
          console.log('Teacher: Submitting attendance...');
          const result = await submitAttendance(attendanceId);
          console.log('Attendance submitted successfully');

          if ((result as any).status === 'under_review') {
            toast.success('Attendance submitted for coordinator review!');
          } else {
            toast.error('Only draft attendance can be submitted by teachers.');
          }
        } else {
          toast.error('Only draft attendance can be submitted by teachers.');
          return;
        }
      } else {
        toast.error('Access denied. Only teachers and coordinators can approve attendance.');
        return;
      }

      // Refresh the data
      await fetchCurrentMonthAttendance();

    } catch (error) {
      console.error('Error approving attendance:', error);
      toast.error('Error approving attendance. Please try again.');
    }
  };

  const toggleAttendanceExpansion = (attendanceId: number) => {
    setExpandedAttendance(expandedAttendance === attendanceId ? null : attendanceId);
  };

  const fetchAttendanceHistory = async () => {
    if (!classInfo) return;

    try {
      const history = await getAttendanceHistory(classInfo.id);
      setAttendanceHistoryData(history as any[]);
      setShowHistoryModal(true);
    } catch (error) {
      console.error('Error fetching attendance history:', error);
      toast.error('Failed to fetch attendance history. Please try again.');
    }
  };

  // Check if attendance is approved for the selected date
  const isAttendanceApproved = async () => {
    if (!classInfo) return false;

    try {
      const attendanceData = await getAttendanceForDate(classInfo.id, selectedDate) as any;
      return attendanceData && attendanceData.status === 'approved';
    } catch (error) {
      console.error('Error checking approval status:', error);
      return false;
    }
  };

  // Check for newly approved attendance
  const checkForApprovedAttendance = () => {
    if (attendanceHistory && Array.isArray(attendanceHistory)) {
      const approvedAttendance = attendanceHistory.find((record: any) =>
        record.status === 'approved' &&
        record.finalized_at &&
        new Date(record.finalized_at) > new Date(Date.now() - 30000) // Last 30 seconds
      );

      // Approval notifications now come via WebSocket only
    }
  };


  const enableEditMode = async () => {
    if (!classInfo) return;

    try {
      setLoading(true);
      const attendanceData = await getAttendanceForDate(classInfo.id, selectedDate) as any;

      if (attendanceData && attendanceData.id) {
        // Check if attendance is approved - prevent editing
        if (attendanceData.status === 'approved') {
          toast.warning('❌ Cannot Edit Approved Attendance!', {
            description: 'This attendance has been approved by the coordinator and cannot be modified. Please contact the coordinator if changes are needed.'
          });
          return;
        }

        // Enable edit mode
        setIsEditMode(true);
        setAttendanceLoaded(true);

        toast.success('✅ Edit Mode Enabled!', {
          description: 'You can now modify the attendance. Click "Update Attendance" to save your changes.'
        });
      } else {
        toast.error('No attendance found for this date.');
      }
    } catch (error) {
      console.error('Error enabling edit mode:', error);
      toast.error('Failed to enable edit mode. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadSavedAttendance = async () => {
    if (!classInfo) return;

    try {
      setLoading(true);
      const attendanceData = await getAttendanceForDate(classInfo.id, selectedDate) as any;

      if (attendanceData && attendanceData.id) {
        // Check if attendance is approved - prevent editing
        if (attendanceData.status === 'approved') {
          toast.warning('❌ Cannot Edit Approved Attendance!', {
            description: 'This attendance has been approved by the coordinator and cannot be modified. Please contact the coordinator if changes are needed.'
          });
          return;
        }

        const existingAttendance: Record<number, AttendanceStatus> = {};
        attendanceData.student_attendance.forEach((record: any) => {
          existingAttendance[record.student_id] = record.status;
        });
        setAttendance(existingAttendance);
        setIsEditMode(true);
        setExistingAttendanceId(attendanceData.id);
        setAttendanceLoaded(true);

        // Approval notifications now come via WebSocket only

        toast.success('Saved attendance loaded successfully!', {
          description: 'You can now make changes and update.'
        });
      } else {
        toast.error('No saved attendance found for this date.');
      }
    } catch (error: unknown) {
      console.error('Error loading saved attendance:', error);
      toast.error('Failed to load saved attendance. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const totalStudents = students.length;
  const presentCount = Object.values(attendance).filter(status => status === 'present').length;
  const absentCount = Object.values(attendance).filter(status => status === 'absent').length;
  const lateCount = Object.values(attendance).filter(status => status === 'late').length;
  const leaveCount = Object.values(attendance).filter(status => status === 'leave').length;
  const excusedCount = Object.values(attendance).filter(status => status === 'excused').length;
  const markedCount = Object.keys(attendance).length;
  const unmarkedCount = totalStudents - markedCount;
  const statusCounts = { present: presentCount, absent: absentCount, late: lateCount, leave: leaveCount, excused: excusedCount };
  // One definition for the whole system — see lib/attendance-metrics.
  // Previously this page used (present + excused) / total, which read 91% on a
  // register the review page reported as 96.88%. Same data, two numbers.
  // Denominator is markedCount, not totalStudents: an unmarked student has no
  // status yet, so counting them would drag the live % down as you mark.
  const attendancePercentage = calcAttendancePercentage({
    present: presentCount,
    total: markedCount,
    leave: leaveCount,
    excused: excusedCount,
  });

  // 🔧 rollNoOf()
  // Purpose: The register's "Roll No" column.
  // Note: Student has no roll_no field — gr_no is the closest real identifier,
  // so that is what this shows rather than inventing a sequence number.
  const rollNoOf = (s: Student) => String((s as any).gr_no || s.student_id || s.student_code || "");

  // Initials actually present, so the A–Z strip can grey out dead letters.
  const availableLetters = useMemo(
    () => new Set(students.map((s) => (s.name || "").trim().charAt(0).toUpperCase()).filter(Boolean)),
    [students],
  );

  // 📘 Concept: useMemo — expensive filter ko re-compute rokta hai jab deps na badlein.
  const filteredStudents = useMemo(() => {
    const rows = students.filter((s) => {
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const match = s.name.toLowerCase().includes(q) || rollNoOf(s).toLowerCase().includes(q);
        if (!match) return false;
      }
      if (letterFilter && (s.name || "").trim().charAt(0).toUpperCase() !== letterFilter) return false;
      if (statusFilter === "unmarked") return attendance[s.id] === undefined;
      if (statusFilter !== "all") return attendance[s.id] === statusFilter;
      return true;
    });

    const dir = sortAsc ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sortBy === "name") return dir * a.name.localeCompare(b.name);
      if (sortBy === "pct") {
        return dir * ((studentStats[a.id]?.pct ?? 0) - (studentStats[b.id]?.pct ?? 0));
      }
      // Roll numbers are codes like C05-M-23-12246, so compare as text with
      // numeric awareness — plain string order puts "10" before "9".
      return dir * rollNoOf(a).localeCompare(rollNoOf(b), undefined, { numeric: true });
    });
  }, [students, searchTerm, statusFilter, letterFilter, sortBy, sortAsc, attendance, studentStats]);

  // Who still has no mark — drives the summary panel's jump list.
  const remainingStudents = useMemo(
    () =>
      students
        .filter((s) => attendance[s.id] === undefined)
        .map((s) => ({ id: s.id, name: s.name, rollNo: rollNoOf(s).slice(-2) })),
    [students, attendance],
  );

  // 🔧 jumpToStudent()
  // Purpose: Scroll a remaining student's row into view and flash it.
  const jumpToStudent = (studentId: number) => {
    const row = document.getElementById(`student-row-${studentId}`);
    if (!row) return;
    row.scrollIntoView({ behavior: "smooth", block: "center" });
    row.classList.add("ring-2", "ring-[#6096ba]");
    window.setTimeout(() => row.classList.remove("ring-2", "ring-[#6096ba]"), 1600);
  };

  // Check if date is editable (within 7 days)
  function isDateEditable() {
    // Block holidays
    if (selectedHoliday) return false;

    const selectedDateObj = new Date(selectedDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - selectedDateObj.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Check if date is within 7 days
    if (diffDays > 7) return false;
    // Block weekends (Sunday)
    if (isWeekend) return false;

    // Check if attendance is approved (prevent editing approved attendance)
    // This will be checked in the component when needed
    return true;
  };

  if (loading) {
    return (
      <div className=" mx-auto mt-8 p-4 sm:p-6 space-y-6 sm:space-y-8 animate-in fade-in duration-500">
        {/* Header Skeleton */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/50 p-4 rounded-xl border border-gray-100/50 shadow-sm backdrop-blur-sm">
          <div className="space-y-3 w-full md:w-auto">
            <Skeleton className="h-8 w-48 rounded-lg bg-gray-200/80" />
            <div className="flex gap-2">
              <Skeleton className="h-4 w-32 rounded-md bg-gray-200/60" />
              <Skeleton className="h-4 w-24 rounded-md bg-gray-200/60" />
            </div>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <Skeleton className="h-10 w-full md:w-40 rounded-lg bg-gray-200/80" />
            <Skeleton className="h-10 w-10 rounded-lg bg-gray-200/80" />
          </div>
        </div>

        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-4 rounded-xl border border-white bg-white/60 shadow-sm space-y-3 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent translate-x-[-100%] animate-[shimmer_1.5s_infinite]" />
              <div className="flex justify-between items-start">
                <Skeleton className="h-4 w-16 rounded bg-gray-200/70" />
                <Skeleton className="h-8 w-8 rounded-full bg-gray-100" />
              </div>
              <Skeleton className="h-8 w-16 rounded-lg bg-gray-200" />
            </div>
          ))}
        </div>

        {/* Detailed List Skeleton */}
        <div className="rounded-xl border border-gray-200/80 bg-white/80 shadow-sm backdrop-blur-sm overflow-hidden">
          {/* Table Header */}
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex gap-4 overflow-x-auto">
            <div className="min-w-[600px] w-full grid grid-cols-12 gap-4">
              <Skeleton className="col-span-4 h-5 w-24 bg-gray-200/70 rounded" />
              <Skeleton className="col-span-3 h-5 w-20 bg-gray-200/70 rounded" />
              <Skeleton className="col-span-2 h-5 w-16 bg-gray-200/70 rounded" />
              <Skeleton className="col-span-3 h-5 w-24 bg-gray-200/70 rounded" />
            </div>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-gray-100">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="p-4 hover:bg-gray-50/50 transition-colors">
                <div className="min-w-[600px] w-full grid grid-cols-12 gap-4 items-center">
                  {/* Student Info */}
                  <div className="col-span-4 flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full bg-gray-200 flex-shrink-0" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-32 bg-gray-300/70 rounded" />
                      <Skeleton className="h-3 w-20 bg-gray-200 rounded" />
                    </div>
                  </div>

                  {/* Code/ID */}
                  <div className="col-span-3">
                    <Skeleton className="h-6 w-24 rounded-full bg-gray-100" />
                  </div>

                  {/* Gender */}
                  <div className="col-span-2">
                    <Skeleton className="h-6 w-16 rounded-full bg-gray-50 border border-gray-100" />
                  </div>

                  {/* Actions */}
                  <div className="col-span-3 flex gap-2">
                    <Skeleton className="h-9 w-9 rounded-lg bg-green-50/50 border border-green-100/50" />
                    <Skeleton className="h-9 w-9 rounded-lg bg-red-50/50 border border-red-100/50" />
                    <Skeleton className="h-9 w-9 rounded-lg bg-blue-50/50 border border-blue-100/50" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    const isNoClassroom = error.includes("No classroom assigned");
    return (
      <div className=" flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-white/70 backdrop-blur-md rounded-2xl shadow-xl border border-slate-100 p-8 text-center space-y-6 transition-all duration-300 hover:shadow-2xl">
          {isNoClassroom ? (
            <>
              <div className="inline-flex p-4 bg-amber-50 rounded-full text-amber-500 ring-8 ring-amber-50/50 animate-pulse">
                <GraduationCap className="h-12 w-12" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-800 tracking-tight">No Classroom Assigned</h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  It looks like you haven't been assigned to any classrooms or subjects for the current session.
                </p>
              </div>
              
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-left space-y-1">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Next Steps</p>
                <p className="text-xs text-slate-600 leading-normal">
                  Please contact the administration or your coordinator to link your profile to a classroom. Once assigned, you will be able to manage and mark student attendance.
                </p>
              </div>

              {classroomOptions.length > 1 && (
                <div className="text-left space-y-1.5 p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
                  <label className="block text-xs font-semibold text-blue-600 uppercase tracking-wider">Switch Classroom</label>
                  <select
                    className="w-full border border-blue-200 rounded-lg px-3 py-1.5 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    onChange={(e) => router.push(`/admin/teachers/attendance?classroom=${e.target.value}`)}
                    defaultValue={classroomOptions[0]?.id}
                  >
                    {classroomOptions.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-2 flex flex-col gap-3">
                <Button 
                  onClick={() => router.push('/admin')} 
                  className="w-full bg-[#274c77] hover:bg-[#6096ba] text-white py-2.5 rounded-xl transition-all duration-200 shadow-md font-semibold text-sm"
                >
                  Go to Home
                </Button>
                <button 
                  onClick={() => {
                    toast.loading("Re-checking assignment status...");
                    fetchTeacherData();
                  }} 
                  className="text-xs text-[#274c77] hover:text-[#6096ba] hover:underline font-semibold flex items-center justify-center gap-1.5 mx-auto transition-all mt-1"
                >
                  <RefreshCw className="h-3 w-3" /> Re-check Assignment Status
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="inline-flex p-4 bg-red-50 rounded-full text-red-500 ring-8 ring-red-50/50">
                <AlertCircle className="h-12 w-12" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-800 tracking-tight">Failed to Load Attendance Sheet</h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  {error || "An unexpected error occurred while loading your classroom attendance."}
                </p>
              </div>

              {classroomOptions.length > 1 && (
                <div className="text-left space-y-1.5 p-3 bg-red-50/20 border border-red-100 rounded-xl">
                  <label className="block text-xs font-semibold text-red-600 uppercase tracking-wider">Switch Classroom</label>
                  <select
                    className="w-full border border-red-200 rounded-lg px-3 py-1.5 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-400"
                    onChange={(e) => router.push(`/admin/teachers/attendance?classroom=${e.target.value}`)}
                    defaultValue={classroomOptions[0]?.id}
                  >
                    {classroomOptions.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <Button 
                onClick={fetchTeacherData} 
                className="w-full bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl transition-all duration-200 shadow-md font-semibold text-sm flex items-center justify-center gap-2"
              >
                <RefreshCw className="h-4 w-4" /> Try Again
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  // Coordinator view - Last 6 days attendance
  if (userRole === 'coordinator' && classroomId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className=" mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Attendance Review</h1>
                  <p className="text-sm text-gray-600 mt-1">
                    {classInfo?.code || classInfo?.name || `Classroom ${classroomId}`} • {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <Button
                  onClick={() => router.back()}
                  variant="outline"
                  className="border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </div>
            </div>
          </div>


          {/* Detailed Attendance Sheets */}
          {last6DaysAttendance.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              {/* Table Header */}
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <div className="grid grid-cols-12 gap-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <div className="col-span-3">Date & Status</div>
                  <div className="col-span-2">Marked By</div>
                  <div className="col-span-2">Students</div>
                  <div className="col-span-3">Attendance</div>
                  <div className="col-span-2">Actions</div>
                </div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-gray-200">
                {last6DaysAttendance.map((record: any, index: number) => (
                  <div key={index} className="hover:bg-gray-50 transition-colors duration-200">
                    {/* Main Row */}
                    <div className="px-6 py-4">
                      <div className="grid grid-cols-12 gap-4 items-center min-h-[80px]">
                        {/* Date & Status */}
                        <div className="col-span-3 flex items-center">
                          <div className="flex items-center space-x-3 w-full">
                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <Calendar className="h-5 w-5 text-blue-600" />
                            </div>
                            <div className="flex flex-col space-y-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {new Date(record.date).toLocaleDateString()}
                              </p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                <Badge
                                  variant="outline"
                                  className={`w-fit ${record.status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' :
                                    record.status === 'submitted' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                      record.status === 'under_review' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                        'bg-gray-50 text-gray-700 border-gray-200'
                                    }`}
                                >
                                  {record.display_status || (record.status?.charAt(0).toUpperCase() + record.status?.slice(1)) || 'Draft'}
                                </Badge>
                                {record.is_holiday && (
                                  <Badge className="bg-yellow-500 text-white border-yellow-600 text-xs">
                                    <Calendar className="h-3 w-3 mr-1" />
                                    Holiday
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Marked By */}
                        <div className="col-span-2 flex items-center">
                          <div className="flex items-center space-x-2 w-full">
                            <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                              <Users className="h-4 w-4 text-gray-600" />
                            </div>
                            <span className="text-sm text-gray-900 truncate">{record.marked_by_name || 'Unknown'}</span>
                          </div>
                        </div>

                        {/* Students Count */}
                        <div className="col-span-2 flex items-center">
                          <div className="flex items-center space-x-2 w-full">
                            <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                              <Users className="h-4 w-4 text-purple-600" />
                            </div>
                            <span className="text-sm font-medium text-gray-900">{record.total_students || 0}</span>
                          </div>
                        </div>

                        {/* Attendance Stats */}
                        <div className="col-span-3 flex items-center">
                          <div className="flex items-center space-x-4 w-full">
                            <div className="flex items-center space-x-1">
                              <div className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0"></div>
                              <span className="text-sm text-gray-600">{record.present_count || 0}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <div className="w-2 h-2 bg-red-400 rounded-full flex-shrink-0"></div>
                              <span className="text-sm text-gray-600">{record.absent_count || 0}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <div className="w-2 h-2 bg-blue-400 rounded-full flex-shrink-0"></div>
                              <span className="text-sm text-gray-600">{record.leave_count || 0}</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="col-span-2 flex items-center justify-end">
                          <div className="flex items-center space-x-1">
                            <Button
                              onClick={() => toggleAttendanceExpansion(record.id)}
                              variant="outline"
                              size="sm"
                              className="border-gray-300 text-gray-700 hover:bg-gray-50 text-xs px-2 py-1"
                            >
                              {expandedAttendance === record.id ? (
                                <>
                                  <EyeOff className="h-3 w-3 mr-1" />
                                  Hide
                                </>
                              ) : (
                                <>
                                  <Eye className="h-3 w-3 mr-1" />
                                  View
                                </>
                              )}
                            </Button>

                            {/* Approved Button - Show only for non-final statuses */}
                            {record.status !== 'approved' && (
                              <Button
                                onClick={() => handleApproveAttendance(record.id)}
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1"
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Approve
                              </Button>
                            )}

                            {/* Approved Badge - Show only for final status */}
                            {record.status === 'approved' && (
                              <Badge
                                variant="outline"
                                className="bg-green-50 text-green-700 border-green-200 text-xs px-2 py-1"
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Approved
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Collapsible Content with Smooth Animation */}
                    <div
                      className={`overflow-hidden transition-all duration-500 ease-in-out ${expandedAttendance === record.id
                        ? 'max-h-[800px] opacity-100'
                        : 'max-h-0 opacity-0'
                        }`}
                    >
                      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                        {/* Student Table */}
                        {record.student_attendance && Array.isArray(record.student_attendance) && record.student_attendance.length > 0 ? (
                          <div className="overflow-x-auto max-h-[600px] overflow-y-auto border border-gray-200 rounded-lg bg-white">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50 sticky top-0 z-10">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gender</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {record.student_attendance.map((studentRecord: any, studentIndex: number) => {
                                  // Debug: Log first student record to check data structure
                                  if (studentIndex === 0 && index === 0) {
                                    console.log('🔍 Student Record Data:', studentRecord);
                                    console.log('🔍 Has student_father_name?', 'student_father_name' in studentRecord);
                                    console.log('🔍 student_father_name value:', studentRecord.student_father_name);
                                  }
                                  return (
                                    <tr key={studentIndex} className="hover:bg-gray-50">
                                      <td className="px-4 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                                            <span className="text-sm font-medium text-blue-600">
                                              {studentRecord.student_name?.charAt(0).toUpperCase() || 'S'}
                                            </span>
                                          </div>
                                          <div className="ml-3">
                                            <div className="text-sm font-medium text-gray-900">
                                              {studentRecord.student_name || 'Unknown Student'}
                                            </div>
                                            {studentRecord.student_father_name && studentRecord.student_father_name.trim() && (
                                              <div className="text-xs text-gray-600">
                                                S/O {studentRecord.student_father_name}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-4 py-4 whitespace-nowrap">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                          {studentRecord.student_code || studentRecord.student_id || 'N/A'}
                                        </span>
                                      </td>
                                      <td className="px-4 py-4 whitespace-nowrap">
                                        <Badge
                                          variant="outline"
                                          className={
                                            studentRecord.student_gender === 'male' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                              studentRecord.student_gender === 'female' ? 'bg-pink-50 text-pink-700 border-pink-200' :
                                                'bg-gray-50 text-gray-700 border-gray-200'
                                          }
                                        >
                                          {studentRecord.student_gender?.charAt(0).toUpperCase() + studentRecord.student_gender?.slice(1) || 'N/A'}
                                        </Badge>
                                      </td>
                                      <td className="px-4 py-4 whitespace-nowrap">
                                        <Badge
                                          variant="outline"
                                          className={
                                            studentRecord.status === 'present' ? 'bg-green-50 text-green-700 border-green-200' :
                                              studentRecord.status === 'absent' ? 'bg-red-50 text-red-700 border-red-200' :
                                                studentRecord.status === 'leave' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                  'bg-gray-50 text-gray-700 border-gray-200'
                                          }
                                        >
                                          {studentRecord.status?.charAt(0).toUpperCase() + studentRecord.status?.slice(1) || 'Unknown'}
                                        </Badge>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <div className="text-gray-400 mb-2">
                              <Users className="h-12 w-12 mx-auto" />
                            </div>
                            <p className="text-gray-500 text-sm">No student records found for this date</p>
                            <p className="text-gray-400 text-xs mt-1">Please check if attendance was marked for this classroom</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mt-4 sm:mt-6 lg:mt-8 p-2 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
      {/* Offline: is class+date ka adhoora attendance-draft mila to restore prompt (Phase 7). */}
      <DraftRecoveryDialog<Record<number, AttendanceStatus>>
        formId={attendanceDraftId}
        onRestore={(d) => setAttendance(d)}
      />

      {/* Approval notifications now come via WebSocket only - no toast needed */}

      {/* Header Section */}
      <div className="bg-gradient-to-r from-[#274c77] to-[#6096ba] rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2 sm:mb-3 flex-wrap">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Mark Attendance</h1>
              {activeTab === "mark" && (
                <SaveStatusIndicator status={attSaveStatus} lastSavedAt={attLastSavedAt} />
              )}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 text-sm sm:text-base lg:text-lg">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="truncate">{classInfo?.name}</span>
              </div>
              <div className="flex items-center space-x-2 flex-wrap">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
                <div className="relative">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className={`bg-white/20 border rounded-lg px-2 sm:px-3 py-1 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/50 text-xs sm:text-sm ${selectedHoliday ? 'border-yellow-400 border-2 ring-2 ring-yellow-400/50' : 'border-white/30'
                      }`}
                    title={selectedHoliday ? `Holiday: ${selectedHoliday.reason}` : ''}
                  />
                  {/* Show holiday indicator if current selected date is a holiday */}
                  {selectedHoliday && (
                    <div
                      className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full border-2 border-white animate-pulse z-10"
                      title={`Holiday: ${selectedHoliday.reason}`}
                    />
                  )}
                </div>
                {selectedHoliday && (
                  <Badge className="bg-yellow-500 text-white border-yellow-600 text-xs sm:text-sm px-2 sm:px-3 py-1 font-bold animate-pulse shadow-md">
                    <Calendar className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    Holiday
                  </Badge>
                )}
                {/* Show list of upcoming holidays only (future dates, not past) */}
                {(() => {
                  const today = normalizeDate(new Date().toISOString());
                  const upcomingHolidays = holidays.filter((h: any) => {
                    const holidayDate = normalizeDate(h.date);
                    return holidayDate >= today; // Only future or today
                  });

                  if (upcomingHolidays.length > 0 && !selectedHoliday) {
                    return (
                      <div className="flex flex-wrap gap-1">
                        {upcomingHolidays.slice(0, 3).map((h: any) => {
                          const holidayDate = normalizeDate(h.date);
                          const holidayDay = new Date(h.date).getDate();
                          return (
                            <Badge
                              key={h.id}
                              className="bg-yellow-400/80 text-yellow-900 border-yellow-500 text-[10px] px-1.5 py-0.5 cursor-pointer hover:bg-yellow-400 transition-all"
                              title={`${h.date}: ${h.reason}`}
                              onClick={() => handleDateChange(holidayDate)}
                            >
                              {holidayDay}
                            </Badge>
                          );
                        })}
                        {upcomingHolidays.length > 3 && (
                          <Badge className="bg-yellow-400/80 text-yellow-900 border-yellow-500 text-[10px] px-1.5 py-0.5">
                            +{upcomingHolidays.length - 3}
                          </Badge>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="text-xs sm:text-sm">
                  {Object.keys(attendance).length} / {students.length} students marked
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {classroomOptions.length > 1 && (
              <div className="flex items-center gap-2 bg-white/15 border border-white/25 rounded-lg px-2 py-1">
                <span className="text-xs opacity-90">Class</span>
                <select
                  className="bg-transparent text-white text-xs sm:text-sm focus:outline-none"
                  value={classInfo?.id || classroomOptions[0]?.id}
                  onChange={(e) => router.push(`/admin/teachers/attendance?classroom=${e.target.value}`)}
                >
                  {classroomOptions.map((c) => (
                    <option key={c.id} value={c.id} className="text-black">{c.name}</option>
                  ))}
                </select>
              </div>
            )}
            {!isWeekend && (
              <div className="relative">
                <Button
                  onClick={handleBackfillIconClick}
                  className="bg-white/20 hover:bg-white/30 text-white border border-white/30 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
                  size="sm"
                >
                  <Clock3 className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Backfill</span>
                </Button>
                {hasNewPermissions && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 sm:w-3 sm:h-3 bg-red-500 rounded-full flex items-center justify-center">
                    <Bell className="h-1 w-1 sm:h-2 sm:w-2 text-white" />
                  </div>
                )}
              </div>
            )}

            {isEditMode && (
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300 text-xs">
                <Edit3 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                <span className="hidden sm:inline">Edit Mode</span>
                <span className="sm:hidden">Edit</span>
              </Badge>
            )}
            {!isDateEditable() && (
              <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 text-xs">
                <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                <span className="hidden sm:inline">
                  Read Only {
                    selectedHoliday
                      ? `(Holiday: ${selectedHoliday.reason})`
                      : isWeekend
                        ? '(Weekend/Sunday)'
                        : '(Older than 7 days)'
                  }
                </span>
                <span className="sm:hidden">Read Only</span>
              </Badge>
            )}
          </div>
        </div>
      </div>


      {/* Backfill Permissions Modal */}
      <Dialog open={showBackfillModal} onOpenChange={setShowBackfillModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock3 className="h-5 w-5" />
              Backfill Permissions
            </DialogTitle>
            <DialogDescription>
              View and manage your backfill permissions for missed attendance dates.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {backfillPermissions.length === 0 ? (
              <div className="text-center py-8">
                <Clock3 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No backfill permissions found</p>
                <p className="text-gray-400 text-sm">Contact your coordinator for backfill permissions.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {backfillPermissions.map((permission: any, index: number) => (
                  <Card key={index} className={`${!permission.is_used ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">
                            {permission.classroom?.name || 'Unknown Class'}
                          </h4>
                          <p className="text-sm text-gray-600">
                            Date: {new Date(permission.date).toLocaleDateString()}
                          </p>
                          <p className="text-sm text-gray-600">
                            Deadline: {new Date(permission.deadline).toLocaleString()}
                          </p>
                          {permission.reason && (
                            <p className="text-sm text-gray-500 mt-1">
                              Reason: {permission.reason}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          {permission.is_used ? (
                            <Badge variant="outline" className="bg-gray-100 text-gray-600">
                              Used
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-100 text-green-600 border-green-200">
                              Available
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBackfillModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tabs: Mark Attendance / Weekly / Monthly (Plan 3.9) */}
      {!selectedHoliday && (
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
          {([["mark", "Mark Attendance"], ["weekly", "Weekly View"], ["monthly", "Monthly View"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${activeTab === key ? "bg-white text-[#274c77] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* KPI Cards — 5 statuses + Total + %, with vs-yesterday deltas */}
      {activeTab === "mark" && !selectedHoliday && (
        <MarkingStatCards
          counts={statusCounts}
          totalStudents={totalStudents}
          attendancePercentage={attendancePercentage}
          studentStats={studentStats}
        />
      )}

      {/* Quick Actions - Hide when holiday is selected */}
      {activeTab === "mark" && !selectedHoliday && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[#274c77] text-base sm:text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={markAllPresent}
                className="bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2"
                disabled={!isDateEditable()}
              >
                <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Mark All Present</span>
                <span className="sm:hidden">All Present</span>
              </Button>
              <Button
                onClick={markAllAbsent}
                variant="outline"
                className="border-red-500 text-red-500 hover:bg-red-50 text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2"
                disabled={!isDateEditable()}
              >
                <XCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Mark All Absent</span>
                <span className="sm:hidden">All Absent</span>
              </Button>
              <Button
                onClick={clearAllAttendance}
                variant="outline"
                className="border-orange-500 text-orange-500 hover:bg-orange-50 text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2"
                disabled={!isDateEditable()}
              >
                <Eraser className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Clear All</span>
                <span className="sm:hidden">Clear</span>
              </Button>
              {/* Smart Button Logic */}
              {attendanceLoaded && isEditMode ? (
                // Show Update & Submit button when in edit mode
                <Button
                  onClick={handleSubmit}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2"
                  disabled={saving || !isDateEditable()}
                >
                  {saving ? (
                    <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 animate-spin" />
                  ) : (
                    <Save className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  )}
                  <span className="hidden sm:inline">Update & Submit</span>
                  <span className="sm:hidden">Update</span>
                </Button>
              ) : existingAttendanceId && !isEditMode ? (
                // Show Edit Attendance button when attendance exists but not in edit mode
                <Button
                  onClick={enableEditMode}
                  variant="outline"
                  className="border-green-500 text-green-500 hover:bg-green-50 text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2"
                  disabled={loading || !isDateEditable()}
                >
                  {loading ? (
                    <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 animate-spin" />
                  ) : (
                    <Edit3 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  )}
                  <span className="hidden sm:inline">Edit Attendance</span>
                  <span className="sm:hidden">Edit</span>
                </Button>
              ) : (
                // Show Save/Update button when no attendance exists or in edit mode
                <Button
                  onClick={handleSubmit}
                  className="bg-[#6096ba] hover:bg-[#274c77] text-white text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2"
                  disabled={saving || !isDateEditable()}
                >
                  {saving ? (
                    <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 animate-spin" />
                  ) : (
                    <Save className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  )}
                  <span className="hidden sm:inline">{isEditMode ? 'Update Attendance' : 'Save Attendance'}</span>
                  <span className="sm:hidden">{isEditMode ? 'Update' : 'Save'}</span>
                </Button>
              )}

              {/* Attendance History Button */}
              {/* <Button
              onClick={fetchAttendanceHistory}
              variant="outline"
              className="border-purple-500 text-purple-500 hover:bg-purple-50 text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2"
            >
              <History className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Attendance History</span>
              <span className="sm:hidden">History</span>
            </Button> */}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Holiday Display - Premium VIP Style */}
      {selectedHoliday && (
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 shadow-2xl">
          {/* Animated background pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(251,191,36,0.3),transparent_50%)] animate-pulse"></div>
            <div className="absolute top-10 right-10 w-32 h-32 bg-yellow-300 rounded-full blur-3xl animate-pulse delay-300"></div>
            <div className="absolute bottom-10 left-10 w-40 h-40 bg-amber-300 rounded-full blur-3xl animate-pulse delay-700"></div>
          </div>

          {/* Decorative border */}
          <div className="absolute inset-0 border-4 border-transparent bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-400 rounded-lg p-[4px]">
            <div className="w-full h-full bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 rounded-lg"></div>
          </div>

          <CardContent className="relative p-8 sm:p-12 lg:p-16 text-center">
            <div className="flex flex-col items-center space-y-8">
              {/* Premium Icon with glow effect */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full blur-xl opacity-60 animate-pulse"></div>
                <div className="relative h-32 w-32 sm:h-36 sm:w-36 rounded-full bg-gradient-to-br from-yellow-400 via-amber-400 to-yellow-500 flex items-center justify-center shadow-2xl transform hover:scale-110 transition-transform duration-300">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/30 to-transparent"></div>
                  <Calendar className="h-16 w-16 sm:h-20 sm:w-20 text-white drop-shadow-lg relative z-10" />
                </div>
                {/* Sparkle effects */}
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-300 rounded-full animate-ping"></div>
                <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-amber-300 rounded-full animate-ping delay-300"></div>
              </div>

              {/* Premium Badge */}
              <div className="relative">
                <Badge className="bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-500 text-white border-0 text-lg sm:text-xl px-6 py-3 font-bold shadow-xl transform hover:scale-105 transition-transform duration-200">
                  <Calendar className="h-5 w-5 sm:h-6 sm:w-6 mr-2" />
                  <span className="tracking-wider">HOLIDAY</span>
                </Badge>
                <div className="absolute -inset-1 bg-gradient-to-r from-yellow-400 to-amber-400 rounded-lg blur opacity-50 -z-10"></div>
              </div>

              {/* Main Title */}
              <div>
                <h3 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold bg-gradient-to-r from-yellow-700 via-amber-700 to-yellow-700 bg-clip-text text-transparent mb-6 drop-shadow-sm">
                  Holiday Declared
                </h3>

                {/* Premium Card for Holiday Details */}
                <div className="relative max-w-md mx-auto">
                  {/* Card glow effect */}
                  <div className="absolute -inset-1 bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-400 rounded-2xl blur opacity-30"></div>

                  {/* Main card */}
                  <div className="relative bg-white/95 backdrop-blur-sm rounded-2xl p-6 sm:p-8 shadow-2xl border-2 border-yellow-200/50">
                    {/* Decorative top border */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-yellow-400 to-transparent"></div>

                    {/* Holiday Reason */}
                    <div className="mb-4">
                      <p className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-yellow-600 to-amber-600 bg-clip-text text-transparent">
                        {selectedHoliday.reason}
                      </p>
                    </div>

                    {/* Date with icon */}
                    <div className="flex items-center justify-center gap-3 mt-6 pt-6 border-t-2 border-yellow-200/50">
                      <div className="p-2 bg-gradient-to-br from-yellow-100 to-amber-100 rounded-lg">
                        <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-700" />
                      </div>
                      <p className="text-base sm:text-lg lg:text-xl font-semibold text-gray-700">
                        {new Date(selectedHoliday.date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Warning Message - Premium Style */}
                <div className="mt-8 max-w-md mx-auto">
                  <div className="relative bg-gradient-to-r from-amber-100 via-yellow-100 to-amber-100 rounded-xl p-4 sm:p-5 border-2 border-amber-300/50 shadow-lg">
                    <div className="flex items-center justify-center gap-3">
                      <div className="p-2 bg-amber-200 rounded-full">
                        <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-amber-700" />
                      </div>
                      <p className="text-sm sm:text-base font-semibold text-amber-800">
                        Attendance marking is disabled for this date
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Register + summary panel side by side, stacking on narrow screens. */}
      {activeTab === "mark" && !selectedHoliday && (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
              <CardTitle className="text-[#274c77] text-base sm:text-lg">Students List ({students.length} students)</CardTitle>
              {existingAttendanceId && !isEditMode && (
                <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300 text-xs">
                  <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  <span className="hidden sm:inline">Read-Only Mode - Click "Edit Attendance" to modify</span>
                  <span className="sm:hidden">Read-Only</span>
                </Badge>
              )}
              {isEditMode && (
                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 text-xs">
                  <Edit3 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  <span className="hidden sm:inline">Edit Mode - Make your changes</span>
                  <span className="sm:hidden">Edit Mode</span>
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {students.length === 0 ? (
              <div className="text-center py-6 sm:py-8">
                <Users className="h-12 w-12 sm:h-16 sm:w-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
                <p className="text-gray-600 text-base sm:text-lg">No students found in this class</p>
                <p className="text-gray-500 text-sm">Please contact administrator to add students to this classroom</p>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <MarkingFilters
                    search={searchTerm}
                    onSearchChange={setSearchTerm}
                    filter={statusFilter}
                    onFilterChange={setStatusFilter}
                    letter={letterFilter}
                    onLetterChange={setLetterFilter}
                    sort={sortBy}
                    onSortChange={setSortBy}
                    sortAsc={sortAsc}
                    onSortDirectionToggle={() => setSortAsc((v) => !v)}
                    availableLetters={availableLetters}
                  />
                </div>

                {filteredStudents.length === 0 && (
                  <p className="text-center text-sm text-gray-500 py-6">No students match the current filter.</p>
                )}

                {/* Mobile list view — same reason as the table: scroll the list,
                    not the page, so the action bar stays reachable. */}
                <div className="block max-h-[60vh] space-y-2 overflow-y-auto sm:hidden">
                  {filteredStudents.map((student) => {
                    const st = studentStats[student.id];
                    return (
                      <div
                        key={student.id}
                        onMouseEnter={() => setFocusedStudentId(student.id)}
                        className="p-3 rounded-lg border border-gray-200 bg-white cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => {
                          setSelectedStudent(student);
                          setShowStudentModal(true);
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">{student.name}</p>
                            {student.father_name && (
                              <p className="text-[11px] text-gray-600 truncate">{student.father_name}</p>
                            )}
                            <div className="flex items-center gap-2 text-[11px] text-gray-600 mt-1">
                              <span className="px-2 py-0.5 rounded-full bg-gray-100">{student.student_id || student.student_code || 'Not Assigned'}</span>
                              <span className="px-2 py-0.5 rounded-full bg-gray-100 capitalize">{student.gender}</span>
                              {st && <span className="px-2 py-0.5 rounded-full bg-gray-100">{st.pct}%</span>}
                              {st?.yesterday && <span className={`px-2 py-0.5 rounded-full ${STATUS_META[st.yesterday].bg} ${STATUS_META[st.yesterday].text}`}>{STATUS_META[st.yesterday].short}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <AttendanceStatusPills studentId={student.id} status={attendance[student.id]} editable={isDateEditable()} onChange={handleAttendanceChange} />
                          {studentStats[student.id] && (
                            (studentStats[student.id].consecutive >= CONSECUTIVE_ALERT_THRESHOLD) ? (
                              <span className="text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5 whitespace-nowrap">🔴 {studentStats[student.id].consecutive}x</span>
                            ) : (studentStats[student.id].pct < LOW_ATTENDANCE_THRESHOLD) ? (
                              <span className="text-[10px] font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5 whitespace-nowrap">⚠ {studentStats[student.id].pct}%</span>
                            ) : null
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop/Tablet table view.
                    The register scrolls inside its own box rather than growing
                    the page: with 35+ students the action bar and summary panel
                    would otherwise be scrolled far out of reach while marking. */}
                <div className="hidden max-h-[60vh] overflow-auto rounded-md border sm:block">
                  <Table>
                    {/* Sticky, or the column names scroll away and the P/A/L/Lv/Ex
                        pills lose their meaning halfway down the class. */}
                    <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_rgb(229_231_235)]">
                      <TableRow>
                        <TableHead className="w-14 text-xs sm:text-sm">Photo</TableHead>
                        <TableHead className="w-full text-xs sm:text-sm">Name</TableHead>
                        <TableHead className="whitespace-nowrap text-xs sm:text-sm">Roll No</TableHead>
                        <TableHead className="whitespace-nowrap text-xs sm:text-sm">Yesterday&apos;s Status</TableHead>
                        <TableHead className="whitespace-nowrap text-xs sm:text-sm">Attendance %</TableHead>
                        <TableHead className="whitespace-nowrap text-xs sm:text-sm">Consecutive Absence</TableHead>
                        <TableHead className="whitespace-nowrap text-xs sm:text-sm">Today&apos;s Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.map((student) => {
                        const st = studentStats[student.id];
                        return (
                          <TableRow
                            key={student.id}
                            id={`student-row-${student.id}`}
                            onMouseEnter={() => setFocusedStudentId(student.id)}
                            className={`cursor-pointer transition-colors hover:bg-gray-50 ${
                              (st?.consecutive ?? 0) >= CONSECUTIVE_ALERT_THRESHOLD
                                ? "border-l-4 border-l-red-500"
                                : ""
                            }`}
                            onClick={() => {
                              setSelectedStudent(student);
                              setShowStudentModal(true);
                            }}
                          >
                            <TableCell>
                              {student.photo ? (
                                <img src={resolveMediaUrl(student.photo)} alt={student.name} className="h-8 w-8 rounded-full object-cover" />
                              ) : (
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#6096ba] text-sm font-medium text-white">
                                  {student.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">
                              <div className="flex min-w-0 flex-col">
                                <span className="truncate text-xs font-medium sm:text-sm">{student.name}</span>
                                {student.father_name && (
                                  <span className="truncate text-[10px] text-gray-600 sm:text-xs">{student.father_name}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-gray-600 sm:text-sm">{rollNoOf(student) || "—"}</TableCell>
                            <TableCell className="text-xs sm:text-sm">
                              {st?.yesterday ? (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_META[st.yesterday].bg} ${STATUS_META[st.yesterday].text}`}>
                                  {STATUS_META[st.yesterday].label}
                                </span>
                              ) : <span className="text-gray-400">—</span>}
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm">
                              {st ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-700">{st.pct}%</span>
                                  {st.pct < LOW_ATTENDANCE_THRESHOLD && (
                                    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
                                      <AlertCircle className="h-3 w-3" /> Low Attendance
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm">
                              {(st?.consecutive ?? 0) >= CONSECUTIVE_ALERT_THRESHOLD ? (
                                <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                                  <XCircle className="h-3 w-3" /> Consecutive Absences ({st.consecutive})
                                </span>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <AttendanceStatusPills studentId={student.id} status={attendance[student.id]} editable={isDateEditable()} onChange={handleAttendanceChange} compact />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Sticks while the register scrolls — its job is to be glanceable. */}
        <div className="xl:sticky xl:top-4 xl:self-start">
          <MarkingSummaryPanel
            counts={statusCounts}
            attendancePercentage={attendancePercentage}
            markedCount={markedCount}
            totalStudents={totalStudents}
            remaining={remainingStudents}
            onJumpTo={jumpToStudent}
          />
        </div>
      </div>
      )}

      {/* Sticky Bottom Bar (Plan 3.7) */}
      {activeTab === "mark" && !selectedHoliday && (
        <div className="sticky bottom-0 z-20 mt-4 -mx-2 sm:-mx-4 lg:-mx-6 px-2 sm:px-4 lg:px-6 py-3 bg-white/95 backdrop-blur border-t border-gray-200 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <span className="font-semibold text-[#274c77]">{markedCount}/{totalStudents} marked</span>
              <span className="hidden sm:inline text-gray-400">|</span>
              <span className="hidden sm:inline flex items-center gap-1"><Keyboard className="h-3 w-3" /> P/A/L/E/V = mark focused row</span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={clearAllAttendance} disabled={!isDateEditable()} className="flex-1 sm:flex-none">
                <Eraser className="h-4 w-4 mr-1" /> Clear
              </Button>
              <Button onClick={handleSubmit} disabled={saving || !isDateEditable()} className="flex-1 sm:flex-none bg-[#6096ba] hover:bg-[#274c77] text-white">
                {saving ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                {existingAttendanceId && !isEditMode ? "Submit Attendance" : isEditMode ? "Update & Submit" : "Save Attendance"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Weekly / Monthly History Views (Plan 3.9) — read-only */}
      {activeTab !== "mark" && !selectedHoliday && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[#274c77] text-base sm:text-lg">
                {activeTab === "weekly" ? "Weekly Attendance" : "Monthly Attendance"}
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => setActiveTab("mark")}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back to Marking
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingHistory ? (
              <div className="text-center py-8"><RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" /></div>
            ) : (
              <HistoryGridView
                mode={activeTab}
                history={historyData}
                students={students}
                selectedDate={selectedDate}
                holidays={allHolidays}
              />
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={showConfirmationModal} onOpenChange={setShowConfirmationModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#274c77] text-lg sm:text-xl font-bold">
              Confirm Attendance
            </DialogTitle>
            <DialogDescription className="text-gray-600 text-sm">
              Are you sure you want to {isEditMode ? 'update' : 'mark'} attendance for {classInfo?.name} on {selectedDate}?
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 sm:py-4">
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              {/* Present Count */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4 text-center">
                <div className="flex items-center justify-center mb-1 sm:mb-2">
                  <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-green-700">{presentCount}</div>
                <div className="text-xs sm:text-sm text-green-600 font-medium">Present</div>
              </div>

              {/* Absent Count */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4 text-center">
                <div className="flex items-center justify-center mb-1 sm:mb-2">
                  <XCircle className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-red-700">{absentCount}</div>
                <div className="text-xs sm:text-sm text-red-600 font-medium">Absent</div>
              </div>

              {/* Late Count */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 sm:p-4 text-center">
                <div className="flex items-center justify-center mb-1 sm:mb-2">
                  <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-orange-700">{lateCount}</div>
                <div className="text-xs sm:text-sm text-orange-600 font-medium">Late</div>
              </div>

              {/* Leave Count */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 sm:p-4 text-center">
                <div className="flex items-center justify-center mb-1 sm:mb-2">
                  <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-purple-700">{leaveCount}</div>
                <div className="text-xs sm:text-sm text-purple-600 font-medium">Leave</div>
              </div>

              {/* Excused Count */}
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 sm:p-4 text-center">
                <div className="flex items-center justify-center mb-1 sm:mb-2">
                  <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6 text-teal-600" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-teal-700">{excusedCount}</div>
                <div className="text-xs sm:text-sm text-teal-600 font-medium">Excused</div>
              </div>

              {/* Total Count */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4 text-center">
                <div className="flex items-center justify-center mb-1 sm:mb-2">
                  <Users className="h-5 w-5 sm:h-6 sm:w-6 text-gray-600" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-gray-700">{markedCount}</div>
                <div className="text-xs sm:text-sm text-gray-600 font-medium">Marked</div>
              </div>
            </div>

            {/* Attendance Percentage */}
            <div className="mt-3 sm:mt-4 bg-[#274c77] text-white rounded-lg p-2 sm:p-3 text-center">
              <div className="text-base sm:text-lg font-semibold">
                Attendance: {attendancePercentage}%
              </div>
              <div className="text-xs sm:text-sm opacity-90">
                {presentCount} out of {totalStudents} students
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirmationModal(false)}
              disabled={saving}
              className="text-xs sm:text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmSubmit}
              className="bg-[#6096ba] hover:bg-[#274c77] text-white text-xs sm:text-sm"
              disabled={saving}
            >
              {saving ? (
                <>
                  <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 animate-spin" />
                  <span className="hidden sm:inline">{isEditMode ? 'Updating...' : 'Saving...'}</span>
                  <span className="sm:hidden">{isEditMode ? 'Update' : 'Save'}</span>
                </>
              ) : (
                <>
                  <Save className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">{isEditMode ? 'Update Attendance' : 'Save Attendance'}</span>
                  <span className="sm:hidden">{isEditMode ? 'Update' : 'Save'}</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      {/* Student Details Modal */}
      <Dialog open={showStudentModal} onOpenChange={setShowStudentModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#274c77] text-lg sm:text-xl font-bold">
              Student Details
            </DialogTitle>
          </DialogHeader>

          {selectedStudent && (
            <div className="py-4 space-y-4">
              {/* Student Photo/Avatar */}
              <div className="flex justify-center mb-4">
                {selectedStudent.photo ? (
                  <img
                    src={resolveMediaUrl(selectedStudent.photo)}
                    alt={selectedStudent.name}
                    className="h-20 w-20 sm:h-24 sm:w-24 rounded-full object-cover border-4 border-[#6096ba]"
                  />
                ) : (
                  <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-[#6096ba] flex items-center justify-center text-white text-2xl sm:text-3xl font-medium">
                    {selectedStudent.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Student Details */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-semibold text-gray-600 mb-1 sm:mb-0">Name:</span>
                  <span className="text-sm sm:text-base font-medium text-gray-900">{selectedStudent.name}</span>
                </div>

                {selectedStudent.father_name && (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-semibold text-gray-600 mb-1 sm:mb-0">Father Name:</span>
                    <span className="text-sm sm:text-base font-medium text-gray-900">{selectedStudent.father_name}</span>
                  </div>
                )}

                {selectedStudent.father_cnic && (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-semibold text-gray-600 mb-1 sm:mb-0">Father CNIC:</span>
                    <span className="text-sm sm:text-base font-medium text-gray-900">{selectedStudent.father_cnic}</span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-semibold text-gray-600 mb-1 sm:mb-0">Student ID:</span>
                  <span className="text-sm sm:text-base font-medium text-gray-900">{selectedStudent.student_id || selectedStudent.student_code || 'Not Assigned'}</span>
                </div>

                {selectedStudent.gr_no && (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-semibold text-gray-600 mb-1 sm:mb-0">GR No:</span>
                    <span className="text-sm sm:text-base font-medium text-gray-900">{selectedStudent.gr_no}</span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-semibold text-gray-600 mb-1 sm:mb-0">Gender:</span>
                  <span className="text-sm sm:text-base font-medium text-gray-900 capitalize">{selectedStudent.gender}</span>
                </div>
              </div>

              {/* Enrollment status — teacher can mark Left / Re-enroll here */}
              <EnrollmentStatusCard
                student={selectedStudent}
                onUpdated={(u: any) => {
                  setSelectedStudent(u);
                  // If the student is no longer active (left/transferred), drop
                  // them from the class roster; otherwise update in place.
                  setStudents((prev) =>
                    u.is_active
                      ? prev.map((s: any) => (s.id === u.id ? { ...s, ...u } : s))
                      : prev.filter((s: any) => s.id !== u.id)
                  );
                }}
              />
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={() => setShowStudentModal(false)}
              variant="outline"
              className="border-gray-300 text-xs sm:text-sm"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

export default function TeacherAttendancePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <TeacherAttendanceContent />
    </Suspense>
  )
}