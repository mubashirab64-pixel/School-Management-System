/**
 * Mirrors backend/attendance/tests/test_metrics.py.
 *
 * The formula lives in two languages because the marking page needs a live
 * percentage before anything is saved. These cases are copied from the Python
 * suite on purpose: if the two ever disagree, one of the two files failed to
 * follow the other, and that is the bug this catches.
 */
import { describe, expect, it } from "vitest";

import {
  attendancePercentage,
  eligibleCount,
  percentageFromCounts,
} from "@/lib/attendance-metrics";

describe("attendancePercentage", () => {
  it("takes approved leave out of the denominator", () => {
    // 30 students, 2 on leave, 1 excused → 27 were expected.
    expect(attendancePercentage({ present: 24, total: 30, leave: 2, excused: 1 })).toBe(
      88.89,
    );
  });

  it("does not agree with the old present/total formula", () => {
    // The number this page used to show for the same register.
    expect(Math.round((24 / 30) * 100)).toBe(80);
    expect(attendancePercentage({ present: 24, total: 30, leave: 2, excused: 1 })).not.toBe(
      80,
    );
  });

  it("reports 100 when everyone expected attended", () => {
    expect(attendancePercentage({ present: 27, total: 30, leave: 2, excused: 1 })).toBe(100);
  });

  it("reports 0 when everyone was on leave", () => {
    expect(attendancePercentage({ present: 0, total: 5, leave: 5 })).toBe(0);
  });

  it("reports 0 for an empty class", () => {
    expect(attendancePercentage({ present: 0, total: 0 })).toBe(0);
  });

  it("clamps rather than going negative when counters drift", () => {
    expect(eligibleCount(5, 10)).toBe(0);
    expect(attendancePercentage({ present: 2, total: 5, leave: 10 })).toBe(0);
  });

  it("does not count late as present", () => {
    expect(attendancePercentage({ present: 8, total: 10 })).toBe(80);
  });

  it("matches the screenshot case that exposed the mismatch", () => {
    // 35 students: 31 present, 1 late, 2 leave, 1 excused.
    // The page showed 91%; the review page showed 96.88% for the same register.
    expect(attendancePercentage({ present: 31, total: 35, leave: 2, excused: 1 })).toBe(
      96.88,
    );
  });
});

describe("percentageFromCounts", () => {
  it("agrees with the numeric form", () => {
    expect(
      percentageFromCounts({ present: 24, absent: 3, late: 0, leave: 2, excused: 1 }),
    ).toBe(attendancePercentage({ present: 24, total: 30, leave: 2, excused: 1 }));
  });

  it("reports 0 with no records", () => {
    expect(percentageFromCounts({})).toBe(0);
  });

  it("treats missing keys as zero", () => {
    expect(percentageFromCounts({ present: 5, absent: 5 })).toBe(50);
  });
});
