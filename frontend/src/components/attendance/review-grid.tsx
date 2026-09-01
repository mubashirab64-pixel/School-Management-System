"use client";
/**
 * The review tree: campus → level → grade → classroom → student roll.
 *
 * ReviewRow is recursive and renders the same way at every depth. It knows its
 * own depth and asks `meta.can_drill_to` whether it may expand — no component
 * below AttendanceReview reads the user's role, so adding a role changes the
 * backend's scope resolver and nothing here.
 */
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BellOff, ChevronDown, ChevronRight, Users } from "lucide-react";

import DayRoll from "@/components/attendance/day-roll";
import { rowKey } from "@/hooks/useAttendanceReview";
import type {
  AttendanceCounts,
  DateRange,
  DrillDepth,
  ReviewMeta,
  ReviewRow as ReviewRowType,
  WorkflowStatus,
} from "@/types/attendance-review";

/** Tree order, used to compare a row's depth against meta.can_drill_to. */
const DEPTH_ORDER: DrillDepth[] = [
  "org",
  "campus",
  "level",
  "grade",
  "classroom",
  "student",
];

/**
 * 🔧 canExpand()
 * Purpose: May this row be opened, given the user's allowed drill depth?
 * Input:  the row, and meta.can_drill_to
 * Output: boolean — false when the row's children sit deeper than allowed.
 */
function canExpand(row: ReviewRowType, canDrillTo: DrillDepth): boolean {
  if (!row.has_children) return false;
  const childDepth: DrillDepth =
    row.type === "classroom" ? "student" : (row.child_type as DrillDepth);
  return DEPTH_ORDER.indexOf(childDepth) <= DEPTH_ORDER.indexOf(canDrillTo);
}

const WORKFLOW_LABEL: Record<WorkflowStatus, { text: string; className: string }> = {
  draft: { text: "Draft", className: "bg-gray-100 text-gray-700" },
  submitted: { text: "Submitted", className: "bg-amber-100 text-amber-800" },
  under_review: { text: "Under Review", className: "bg-blue-100 text-blue-800" },
  approved: { text: "Approved", className: "bg-green-100 text-green-800" },
  holiday: { text: "Holiday", className: "bg-purple-100 text-purple-800" },
};

function rateColour(pct: number): string {
  if (pct >= 90) return "text-green-600";
  if (pct >= 75) return "text-amber-600";
  return "text-red-600";
}

/** Show detailed counts only for today / yesterday (≤ 2 days). */
function isShortRange(range: DateRange): boolean {
  const ms = new Date(range.to).getTime() - new Date(range.from).getTime();
  return Math.floor(ms / 86_400_000) + 1 <= 2;
}

function CountCell({ value, total, className }: { value: number; total: number; className: string }) {
  const share = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <td className="px-2 py-2 text-right whitespace-nowrap">
      <span className={className}>{value}</span>
      <span className="ml-1 text-xs text-gray-400">({share}%)</span>
    </td>
  );
}

function subtitleFor(row: ReviewRowType): string | null {
  switch (row.type) {
    case "classroom":
      return row.class_teacher?.name ?? "No class teacher";
    case "level":
      return row.coordinator ?? null;
    case "grade":
      return `${row.class_count} class${row.class_count !== 1 ? "es" : ""}`;
    default:
      return null;
  }
}

interface ReviewRowProps {
  row: ReviewRowType;
  depth: number;
  meta: ReviewMeta;
  range: DateRange;
  childrenByKey: Record<string, ReviewRowType[]>;
  expandedKeys: Set<string>;
  loadingKeys: Set<string>;
  onToggle: (row: ReviewRowType) => void;
}

function ReviewRow({
  row,
  depth,
  meta,
  range,
  childrenByKey,
  expandedKeys,
  loadingKeys,
  onToggle,
}: ReviewRowProps) {
  const key = rowKey(row);
  const expanded = expandedKeys.has(key);
  const loadingChildren = loadingKeys.has(key);
  const expandable = canExpand(row, meta.can_drill_to);
  const children = childrenByKey[key];
  const counts: AttendanceCounts = row.counts;
  const total = counts.total_students;
  const showDetailCounts = isShortRange(range);

  // Classrooms open into the roll, which is student-level data.
  const showsRoll = row.type === "classroom" && expanded && meta.show_roll;
  const columnCount = showDetailCounts ? 9 : 5;

  return (
    <>
      <tr className={`border-b hover:bg-gray-50 ${depth > 0 ? "bg-gray-50/40" : ""}`}>
        <td className="px-2 py-2">
          {expandable ? (
            <button
              type="button"
              onClick={() => onToggle(row)}
              aria-expanded={expanded}
              aria-label={expanded ? `Collapse ${row.name}` : `Expand ${row.name}`}
              className="rounded p-1 hover:bg-gray-200"
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <span className="inline-block h-6 w-6" />
          )}
        </td>

        <td
          className="px-2 py-2"
          style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}
          onClick={expandable ? () => onToggle(row) : undefined}
          role={expandable ? "button" : undefined}
          tabIndex={expandable ? 0 : undefined}
          onKeyDown={
            expandable
              ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(row); } }
              : undefined
          }
        >
          <div className={`font-medium ${expandable ? "cursor-pointer" : ""}`}>{row.name}</div>
          {subtitleFor(row) && (
            <div className="text-xs text-gray-500">{subtitleFor(row)}</div>
          )}
        </td>

        <td
          className={`px-2 py-2 text-right ${expandable ? "cursor-pointer" : ""} text-gray-600`}
          style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}
          onClick={expandable ? () => onToggle(row) : undefined}
          role={expandable ? "button" : undefined}
          tabIndex={expandable ? 0 : undefined}
          onKeyDown={
            expandable
              ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(row); } }
              : undefined
          }
        >
          {row.student_count ?? "—"}
        </td>

        {showDetailCounts && (
          <>
            <CountCell value={counts.present} total={total} className="text-green-600" />
            <CountCell value={counts.absent} total={total} className="text-red-600" />
            <CountCell value={counts.late} total={total} className="text-orange-600" />
            <CountCell value={counts.leave} total={total} className="text-purple-600" />
            <CountCell value={counts.excused} total={total} className="text-teal-600" />
          </>
        )}

        <td
          className={`px-2 py-2 text-right ${expandable ? "cursor-pointer" : ""}`}
          style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}
          onClick={expandable ? () => onToggle(row) : undefined}
          role={expandable ? "button" : undefined}
          tabIndex={expandable ? 0 : undefined}
          onKeyDown={
            expandable
              ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(row); } }
              : undefined
          }
        >
          <span className={`font-semibold ${rateColour(row.attendance_pct)}`}>
            {row.attendance_pct}%
          </span>
        </td>

        <td
          className={`px-2 py-2 whitespace-nowrap ${expandable ? "cursor-pointer" : ""}`}
          style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}
          onClick={expandable ? () => onToggle(row) : undefined}
          role={expandable ? "button" : undefined}
          tabIndex={expandable ? 0 : undefined}
          onKeyDown={
            expandable
              ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(row); } }
              : undefined
          }
        >
          {row.latest_status ? (
            <Badge
              variant="secondary"
              className={`text-xs font-normal ${WORKFLOW_LABEL[row.latest_status]?.className ?? ''}`}
            >
              {WORKFLOW_LABEL[row.latest_status]?.text ?? row.latest_status}
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-red-100 text-xs font-normal text-red-700">
              Missing
            </Badge>
          )}
          {row.latest_status === "holiday" && (
            <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] text-gray-400" title="Notifications blocked for holidays">
              <BellOff className="h-3 w-3" /> Blocked
            </span>
          )}
        </td>
      </tr>

      {expanded && loadingChildren && (
        <tr>
          <td colSpan={columnCount + 1} className="px-4 py-2">
            <Skeleton className="h-10 w-full" />
          </td>
        </tr>
      )}

      {expanded &&
        children?.map((child) => (
          <ReviewRow
            key={rowKey(child)}
            row={child}
            depth={depth + 1}
            meta={meta}
            range={range}
            childrenByKey={childrenByKey}
            expandedKeys={expandedKeys}
            loadingKeys={loadingKeys}
            onToggle={onToggle}
          />
        ))}

      {expanded && children?.length === 0 && (
        <tr>
          <td colSpan={columnCount + 1} className="px-4 py-3 text-sm text-gray-500">
            Nothing to show here.
          </td>
        </tr>
      )}

      {showsRoll && (
        <tr>
          <td colSpan={columnCount + 1} className="bg-gray-50 p-3">
            <DayRoll classroomId={row.id} range={range} />
          </td>
        </tr>
      )}
    </>
  );
}

export interface ReviewGridProps {
  rows: ReviewRowType[];
  meta: ReviewMeta;
  range: DateRange;
  childrenByKey: Record<string, ReviewRowType[]>;
  expandedKeys: Set<string>;
  loadingKeys: Set<string>;
  onToggle: (row: ReviewRowType) => void;
}

export default function ReviewGrid({
  rows,
  meta,
  range,
  childrenByKey,
  expandedKeys,
  loadingKeys,
  onToggle,
}: ReviewGridProps) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border bg-white p-10 text-center">
        <Users className="h-8 w-8 text-gray-300" />
        <p className="text-sm text-gray-500">
          No attendance records for this period.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-xs uppercase text-gray-500">
            <th className="w-10 px-2 py-2" />
            <th className="px-2 py-2 text-left font-medium">Class</th>
            <th className="px-2 py-2 text-right font-medium">Students</th>
            {isShortRange(range) && (
              <>
                <th className="px-2 py-2 text-right font-medium">Present</th>
                <th className="px-2 py-2 text-right font-medium">Absent</th>
                <th className="px-2 py-2 text-right font-medium">Late</th>
                <th className="px-2 py-2 text-right font-medium">Leave</th>
                <th className="px-2 py-2 text-right font-medium">Excused</th>
              </>
            )}
            <th className="px-2 py-2 text-right font-medium">Rate</th>
            <th className="px-2 py-2 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <ReviewRow
              key={rowKey(row)}
              row={row}
              depth={0}
              meta={meta}
              range={range}
              childrenByKey={childrenByKey}
              expandedKeys={expandedKeys}
              loadingKeys={loadingKeys}
              onToggle={onToggle}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
