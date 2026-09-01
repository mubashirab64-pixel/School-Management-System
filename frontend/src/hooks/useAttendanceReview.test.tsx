/**
 * useAttendanceReview — loading behaviour the dev guide asked SWR for.
 *
 * SWR is not a dependency here, so the two behaviours that mattered are hand
 * written and therefore need pinning: keepPreviousData, and dropping a stale
 * response that lands after a newer one.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAttendanceReview } from "@/hooks/useAttendanceReview";
import type { ClassroomRow, ReviewTreeResponse } from "@/types/attendance-review";

const fetchReviewTree = vi.hoisted(() => vi.fn());
vi.mock("@/lib/attendance-review-api", () => ({ fetchReviewTree }));

// Hoisted with the mock: vi.mock is lifted above the file body, so a class
// declared normally below would not exist yet when the factory runs.
const FakeApiError = vi.hoisted(
  () =>
    class FakeApiError extends Error {
      status: number;
      code: string;
      constructor(message: string, status: number, code: string) {
        super(message);
        this.status = status;
        this.code = code;
      }
    },
);
vi.mock("@/lib/api", () => ({ ApiError: FakeApiError }));

function row(id: number, name: string): ClassroomRow {
  return {
    id,
    type: "classroom",
    name,
    code: `C${id}`,
    section: "A",
    shift: "morning",
    grade_name: "Grade 5",
    class_teacher: null,
    student_count: 30,
    attendance_pct: 90,
    counts: { total_students: 30, present: 27, absent: 3, late: 0, leave: 0, excused: 0 },
    latest_status: "submitted",
    latest_date: "2026-07-10",
    has_children: true,
    child_type: "student_matrix",
  };
}

function response(rows: ClassroomRow[], from = "2026-07-01"): ReviewTreeResponse {
  return {
    type: "tree",
    rows,
    meta: {
      role: "teacher",
      scope_label: "Grade 5 - A",
      start_level: "classroom",
      can_drill_to: "student",
      show_roll: true,
      anonymised: false,
      can_approve: false,
      can_export: true,
    },
    date_range: { from, to: "2026-07-17", working_days: 15 },
    summary: { total_students: 30, avg_rate: 90, missing_submissions: 2 },
    missing_days: [],
  };
}

const RANGE = { from: "2026-07-01", to: "2026-07-17" };

beforeEach(() => {
  fetchReviewTree.mockReset();
});

describe("useAttendanceReview", () => {
  it("loads rows, summary and missing days", async () => {
    fetchReviewTree.mockResolvedValue(response([row(1, "Grade 5 - A")]));
    const { result } = renderHook(() => useAttendanceReview(RANGE));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.summary?.avg_rate).toBe(90);
    expect(result.current.workingDays).toBe(15);
    expect(result.current.meta?.scope_label).toBe("Grade 5 - A");
  });

  it("surfaces the error code so callers can tell SCOPE_EMPTY from a real fault", async () => {
    fetchReviewTree.mockRejectedValue(
      new FakeApiError("No attendance records are within your access scope.", 403, "SCOPE_EMPTY"),
    );
    const { result } = renderHook(() => useAttendanceReview(RANGE));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.code).toBe("SCOPE_EMPTY");
  });

  it("keeps the previous rows visible while a new range loads", async () => {
    // The keepPreviousData behaviour: changing the date must not blank the grid.
    fetchReviewTree.mockResolvedValue(response([row(1, "Grade 5 - A")]));
    const { result, rerender } = renderHook(({ range }) => useAttendanceReview(range), {
      initialProps: { range: RANGE },
    });
    await waitFor(() => expect(result.current.rows).toHaveLength(1));

    let release: (value: ReviewTreeResponse) => void = () => {};
    fetchReviewTree.mockReturnValue(
      new Promise<ReviewTreeResponse>((resolve) => {
        release = resolve;
      }),
    );
    rerender({ range: { from: "2026-06-01", to: "2026-06-30" } });

    // Mid-flight: old rows still on screen, and `refreshing` marks it.
    await waitFor(() => expect(result.current.refreshing).toBe(true));
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.loading).toBe(false);

    await act(async () => {
      release(response([row(2, "Grade 6 - B"), row(3, "Grade 6 - C")], "2026-06-01"));
    });
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
  });

  it("keeps the old rows when a refresh fails", async () => {
    fetchReviewTree.mockResolvedValue(response([row(1, "Grade 5 - A")]));
    const { result } = renderHook(() => useAttendanceReview(RANGE));
    await waitFor(() => expect(result.current.rows).toHaveLength(1));

    fetchReviewTree.mockRejectedValue(new FakeApiError("Network error", 0, "NETWORK_ERROR"));
    await act(async () => {
      result.current.refetch();
    });

    await waitFor(() => expect(result.current.error).not.toBeNull());
    // An error banner over the last good data beats an empty page.
    expect(result.current.rows).toHaveLength(1);
  });

  it("drops a slow response for an old range", async () => {
    // The race this guards: request A (slow) then request B (fast). B lands
    // first; A must not overwrite it when it finally arrives.
    let releaseSlow: (value: ReviewTreeResponse) => void = () => {};
    fetchReviewTree.mockReturnValueOnce(
      new Promise<ReviewTreeResponse>((resolve) => {
        releaseSlow = resolve;
      }),
    );

    const { result, rerender } = renderHook(({ range }) => useAttendanceReview(range), {
      initialProps: { range: RANGE },
    });

    fetchReviewTree.mockResolvedValueOnce(response([row(2, "NEW")], "2026-06-01"));
    rerender({ range: { from: "2026-06-01", to: "2026-06-30" } });
    await waitFor(() => expect(result.current.rows[0]?.name).toBe("NEW"));

    await act(async () => {
      releaseSlow(response([row(1, "STALE")]));
    });

    // Still the newer range's data.
    expect(result.current.rows[0]?.name).toBe("NEW");
  });

  it("clears expanded children when the range changes", async () => {
    // Children were fetched for the old period; showing them under a freshly
    // loaded row would mix two date ranges in one table.
    fetchReviewTree.mockResolvedValue(response([row(1, "Grade 5 - A")]));
    const { result, rerender } = renderHook(({ range }) => useAttendanceReview(range), {
      initialProps: { range: RANGE },
    });
    await waitFor(() => expect(result.current.rows).toHaveLength(1));

    await act(async () => {
      await result.current.toggleRow(result.current.rows[0]);
    });
    expect(result.current.expandedKeys.has("classroom:1")).toBe(true);

    rerender({ range: { from: "2026-06-01", to: "2026-06-30" } });
    await waitFor(() => expect(result.current.expandedKeys.size).toBe(0));
  });

  it("does not refetch children that are already loaded", async () => {
    fetchReviewTree.mockResolvedValueOnce({
      ...response([]),
      rows: [
        {
          id: 2,
          type: "grade",
          name: "Grade 5",
          code: "G5",
          level_id: 1,
          attendance_pct: 90,
          counts: { total_students: 30, present: 27, absent: 3, late: 0, leave: 0, excused: 0 },
          has_children: true,
          child_type: "classroom",
        },
      ],
    } as ReviewTreeResponse);
    const { result } = renderHook(() => useAttendanceReview(RANGE));
    await waitFor(() => expect(result.current.rows).toHaveLength(1));

    fetchReviewTree.mockResolvedValue(response([row(1, "Grade 5 - A")]));
    const grade = result.current.rows[0];

    await act(async () => {
      await result.current.toggleRow(grade);
    });
    const callsAfterFirstExpand = fetchReviewTree.mock.calls.length;

    await act(async () => {
      await result.current.toggleRow(grade); // collapse
    });
    await act(async () => {
      await result.current.toggleRow(grade); // expand again
    });

    expect(fetchReviewTree.mock.calls.length).toBe(callsAfterFirstExpand);
    expect(result.current.childrenByKey["grade:2"]).toHaveLength(1);
  });
});
