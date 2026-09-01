/**
 * The attendance percentage, client-side.
 *
 * A mirror of backend/attendance/services/metrics.py — kept deliberately, not
 * by accident: the marking page must show a live percentage as the teacher
 * marks, before anything is saved, so it cannot ask the server for it.
 *
 * The rule, decided once for the whole system:
 *
 *     present / (total − leave − excused)
 *
 * Approved absences leave the denominator; they are not counted against the
 * class. `late` is not `present`.
 *
 * If this ever disagrees with metrics.py, the same register reads one number on
 * the teacher's screen and another in the coordinator's review — which is how a
 * report stops being believed. Change both, or neither.
 */

export type AttendanceMark = "present" | "absent" | "late" | "leave" | "excused";

/** Students who were actually expected to attend. Never negative. */
export function eligibleCount(total: number, leave = 0, excused = 0): number {
  return Math.max(total - leave - excused, 0);
}

/**
 * 🔧 attendancePercentage()
 * Purpose: Present students as a share of those expected, to 2 decimals.
 * Input:  counts
 * Output: number — 0 when nobody was expected (empty class, or all on leave).
 */
export function attendancePercentage({
  present,
  total,
  leave = 0,
  excused = 0,
}: {
  present: number;
  total: number;
  leave?: number;
  excused?: number;
}): number {
  const eligible = eligibleCount(total, leave, excused);
  if (eligible <= 0) return 0;
  return Math.round((present / eligible) * 100 * 100) / 100;
}

/** attendancePercentage() over a {status: count} tally. */
export function percentageFromCounts(
  counts: Partial<Record<AttendanceMark, number>>,
): number {
  const total = Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0);
  return attendancePercentage({
    present: counts.present ?? 0,
    total,
    leave: counts.leave ?? 0,
    excused: counts.excused ?? 0,
  });
}
