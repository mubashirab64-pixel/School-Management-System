import { describe, expect, it } from "vitest";

import { resolveDatePreset, toApiDate } from "@/lib/attendance-review-api";

// A fixed "today" so these never depend on when they run.
// 2026-07-17 is a Friday.
const TODAY = new Date(2026, 6, 17);

describe("toApiDate", () => {
  it("formats as YYYY-MM-DD", () => {
    expect(toApiDate(new Date(2026, 6, 5))).toBe("2026-07-05");
  });

  it("uses local time, not UTC", () => {
    // The bug this guards: toISOString() converts to UTC first, so any local
    // time before 05:00 in Pakistan (UTC+5) would report the previous day.
    // Here 01:30 local on the 17th must stay the 17th.
    expect(toApiDate(new Date(2026, 6, 17, 1, 30))).toBe("2026-07-17");
  });

  it("pads single-digit months and days", () => {
    expect(toApiDate(new Date(2026, 0, 9))).toBe("2026-01-09");
  });
});

describe("resolveDatePreset", () => {
  it("today is a single day", () => {
    expect(resolveDatePreset("today", TODAY)).toEqual({
      from: "2026-07-17",
      to: "2026-07-17",
    });
  });

  it("yesterday is a single day", () => {
    expect(resolveDatePreset("yesterday", TODAY)).toEqual({
      from: "2026-07-16",
      to: "2026-07-16",
    });
  });

  it("last_7 is inclusive of today, so it goes back 6 days", () => {
    expect(resolveDatePreset("last_7", TODAY)).toEqual({
      from: "2026-07-11",
      to: "2026-07-17",
    });
  });

  it("last_30 is inclusive of today", () => {
    expect(resolveDatePreset("last_30", TODAY)).toEqual({
      from: "2026-06-18",
      to: "2026-07-17",
    });
  });

  it("this_month stops at today, not at the end of the month", () => {
    // The API rejects future dates, so "this month" cannot mean 1–31 July while
    // it is still the 17th.
    expect(resolveDatePreset("this_month", TODAY)).toEqual({
      from: "2026-07-01",
      to: "2026-07-17",
    });
  });

  it("prev_month covers the whole previous month", () => {
    expect(resolveDatePreset("prev_month", TODAY)).toEqual({
      from: "2026-06-01",
      to: "2026-06-30",
    });
  });

  it("prev_month handles the January → December rollover", () => {
    expect(resolveDatePreset("prev_month", new Date(2026, 0, 15))).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
  });

  it("prev_month gets February right in a leap year", () => {
    expect(resolveDatePreset("prev_month", new Date(2028, 2, 10))).toEqual({
      from: "2028-02-01",
      to: "2028-02-29",
    });
  });

  it("no preset ever returns a future date", () => {
    const today = toApiDate(TODAY);
    const presets = [
      "today",
      "yesterday",
      "last_7",
      "last_30",
      "this_month",
      "prev_month",
      "custom",
    ] as const;
    for (const preset of presets) {
      const range = resolveDatePreset(preset, TODAY);
      expect(range.to <= today, `${preset} must not reach the future`).toBe(true);
      expect(range.from <= range.to, `${preset} must not be inverted`).toBe(true);
    }
  });
});
