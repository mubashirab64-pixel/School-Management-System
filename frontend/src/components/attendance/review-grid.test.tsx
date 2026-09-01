/**
 * ReviewGrid — drill depth and role-adaptive rendering.
 *
 * These cover the dev guide's §9.2 checks: the grid renders to the depth
 * `meta.can_drill_to` allows, and DayRoll never appears when show_roll is false.
 *
 * Worth being precise about what this proves. It proves the UI *behaves*; it
 * does not protect data. A user who edits `meta` in the response still cannot
 * read a roll, because the server refuses the request. These tests guard the
 * experience, not the boundary.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ReviewGrid from "@/components/attendance/review-grid";
import type {
  AttendanceCounts,
  ClassroomRow,
  GradeRow,
  ReviewMeta,
} from "@/types/attendance-review";

// DayRoll fetches on mount; stub it so these tests are about the grid.
vi.mock("@/components/attendance/day-roll", () => ({
  default: ({ classroomId }: { classroomId: number }) => (
    <div data-testid="day-roll">roll for {classroomId}</div>
  ),
}));

const RANGE = { from: "2026-07-06", to: "2026-07-12" };

const COUNTS: AttendanceCounts = {
  total_students: 30,
  present: 24,
  absent: 3,
  late: 0,
  leave: 2,
  excused: 1,
};

function meta(overrides: Partial<ReviewMeta> = {}): ReviewMeta {
  return {
    role: "coordinator",
    scope_label: "Primary",
    start_level: "grade",
    can_drill_to: "student",
    show_roll: true,
    anonymised: false,
    can_approve: true,
    can_export: true,
    ...overrides,
  };
}

const classroomRow: ClassroomRow = {
  id: 5,
  type: "classroom",
  name: "Grade 5 - A",
  code: "G5A",
  section: "A",
  shift: "morning",
  grade_name: "Grade 5",
  class_teacher: { id: 1, name: "Maryam Khan", employee_code: "T-1" },
  student_count: 30,
  attendance_pct: 88.89,
  counts: COUNTS,
  latest_status: "submitted",
  latest_date: "2026-07-10",
  has_children: true,
  child_type: "student_matrix",
};

const gradeRow: GradeRow = {
  id: 2,
  type: "grade",
  name: "Grade 5",
  code: "G5",
  level_id: 1,
  attendance_pct: 90,
  counts: COUNTS,
  has_children: true,
  child_type: "classroom",
};

function renderGrid(props: Partial<Parameters<typeof ReviewGrid>[0]> = {}) {
  const onToggle = vi.fn();
  const utils = render(
    <ReviewGrid
      rows={[classroomRow]}
      meta={meta()}
      range={RANGE}
      childrenByKey={{}}
      expandedKeys={new Set()}
      loadingKeys={new Set()}
      onToggle={onToggle}
      {...props}
    />,
  );
  return { ...utils, onToggle };
}

describe("ReviewGrid", () => {
  it("renders a row with its counts and rate", () => {
    renderGrid();
    expect(screen.getByText("Grade 5 - A")).toBeInTheDocument();
    expect(screen.getByText("Maryam Khan")).toBeInTheDocument();
    expect(screen.getByText("88.89%")).toBeInTheDocument();
    expect(screen.getByText("Submitted")).toBeInTheDocument();
  });

  it("shows Missing when a class has no register in range", () => {
    renderGrid({ rows: [{ ...classroomRow, latest_status: null }] });
    expect(screen.getByText("Missing")).toBeInTheDocument();
  });

  it("shows an empty state when there are no rows", () => {
    renderGrid({ rows: [] });
    expect(
      screen.getByText(/no attendance records for this period/i),
    ).toBeInTheDocument();
  });

  // ── Drill depth ─────────────────────────────────────────────────────────

  it("offers expand when the user may drill to student level", () => {
    renderGrid({ meta: meta({ can_drill_to: "student" }) });
    expect(screen.getByRole("button", { name: /expand grade 5 - a/i })).toBeInTheDocument();
  });

  it("does not offer expand past the user's allowed depth", () => {
    // A classroom's children are students; a campus-capped role stops here.
    renderGrid({ meta: meta({ can_drill_to: "campus" }) });
    expect(screen.queryByRole("button", { name: /expand/i })).not.toBeInTheDocument();
  });

  it("calls onToggle with the row that was clicked", async () => {
    const { onToggle } = renderGrid();
    await userEvent.click(screen.getByRole("button", { name: /expand grade 5 - a/i }));
    expect(onToggle).toHaveBeenCalledWith(classroomRow);
  });

  it("renders children of an expanded row", () => {
    renderGrid({
      rows: [gradeRow],
      expandedKeys: new Set(["grade:2"]),
      childrenByKey: { "grade:2": [classroomRow] },
    });
    expect(screen.getByText("Grade 5")).toBeInTheDocument();
    expect(screen.getByText("Grade 5 - A")).toBeInTheDocument();
  });

  it("says so when an expanded row has no children", () => {
    renderGrid({
      rows: [gradeRow],
      expandedKeys: new Set(["grade:2"]),
      childrenByKey: { "grade:2": [] },
    });
    expect(screen.getByText(/nothing to show here/i)).toBeInTheDocument();
  });

  // ── show_roll ───────────────────────────────────────────────────────────

  it("renders the roll for an expanded classroom when show_roll is true", () => {
    renderGrid({
      meta: meta({ show_roll: true }),
      expandedKeys: new Set(["classroom:5"]),
    });
    expect(screen.getByTestId("day-roll")).toBeInTheDocument();
  });

  it("never renders the roll when show_roll is false", () => {
    renderGrid({
      meta: meta({ show_roll: false }),
      expandedKeys: new Set(["classroom:5"]),
    });
    expect(screen.queryByTestId("day-roll")).not.toBeInTheDocument();
  });

  // ── Anonymised (donor) ──────────────────────────────────────────────────

  it("shows no teacher name for an anonymised scope", () => {
    // Names are masked server-side, so the grid simply has nothing to print —
    // this pins that the row does not invent one.
    renderGrid({
      meta: meta({ role: "donor", anonymised: true, show_roll: false }),
      rows: [{ ...classroomRow, class_teacher: null }],
    });
    expect(screen.queryByText("Maryam Khan")).not.toBeInTheDocument();
    expect(screen.getByText("No class teacher")).toBeInTheDocument();
  });
});
