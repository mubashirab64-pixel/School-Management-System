/**
 * Data hook for the Attendance Review page.
 *
 * The dev guide specifies SWR with keepPreviousData. SWR is not a dependency of
 * this project and the rest of the codebase fetches with plain `fetch` through
 * lib/api.ts, so this reproduces the two behaviours that actually mattered
 * rather than adding a library:
 *
 *   - keepPreviousData: the grid is not blanked while a new range loads, so
 *     changing the date does not flash empty.
 *   - request sequencing: a slow response for an old range cannot overwrite a
 *     newer one that already arrived.
 *
 * Children are fetched on expand, not eagerly, so the initial load stays small.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "@/lib/api";
import { fetchReviewTree } from "@/lib/attendance-review-api";
import type {
  DateRange,
  MissingDay,
  ReviewMeta,
  ReviewRow,
  ReviewSummary,
} from "@/types/attendance-review";

/** Identifies a row across the tree — ids are only unique within a type. */
export function rowKey(row: ReviewRow): string {
  return `${row.type}:${row.id}`;
}

export interface UseAttendanceReviewResult {
  meta: ReviewMeta | null;
  rows: ReviewRow[];
  summary: ReviewSummary | null;
  missingDays: MissingDay[];
  workingDays: number | null;
  /** Children keyed by rowKey(parent). Absent until that row is expanded. */
  childrenByKey: Record<string, ReviewRow[]>;
  expandedKeys: Set<string>;
  /** True only for the first load; refreshes keep the old rows on screen. */
  loading: boolean;
  /** True while any request is in flight, including background refreshes. */
  refreshing: boolean;
  loadingKeys: Set<string>;
  error: ApiError | null;
  toggleRow: (row: ReviewRow) => void;
  refetch: () => void;
}

export function useAttendanceReview(range: DateRange): UseAttendanceReviewResult {
  const [meta, setMeta] = useState<ReviewMeta | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [missingDays, setMissingDays] = useState<MissingDay[]>([]);
  const [workingDays, setWorkingDays] = useState<number | null>(null);
  const [childrenByKey, setChildrenByKey] = useState<Record<string, ReviewRow[]>>({});
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  // Sequence number for the top-level request. Bumped on every load; a response
  // whose number is stale is dropped. Held in a ref because it must survive
  // re-renders without causing one.
  const requestSeq = useRef(0);
  const loadedOnce = useRef(false);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setRefreshing(true);
    setError(null);

    try {
      const data = await fetchReviewTree(range);
      if (seq !== requestSeq.current) return; // a newer range won

      setMeta(data.meta);
      setRows(data.rows);
      setSummary(data.summary ?? null);
      setMissingDays(data.missing_days ?? []);
      setWorkingDays(data.date_range.working_days);
      // Children belong to the old range; keeping them would show last month's
      // numbers under a freshly loaded row.
      setChildrenByKey({});
      setExpandedKeys(new Set());
      loadedOnce.current = true;
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setError(
        err instanceof ApiError
          ? err
          : new ApiError(String(err), 0, "Network Error"),
      );
      // Deliberately not clearing rows: on a failed refresh the previous range
      // stays visible under the error, which beats an empty page.
    } finally {
      if (seq === requestSeq.current) {
        setRefreshing(false);
        setLoading(false);
      }
    }
  }, [range.from, range.to]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleRow = useCallback(
    async (row: ReviewRow) => {
      const key = rowKey(row);

      if (expandedKeys.has(key)) {
        setExpandedKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        return;
      }

      setExpandedKeys((prev) => new Set(prev).add(key));

      // Already fetched — expanding again should not re-request.
      if (childrenByKey[key]) return;
      // Classrooms expand into the student roll, which DayRoll loads itself.
      if (row.type === "classroom" || row.type === "org") return;

      setLoadingKeys((prev) => new Set(prev).add(key));
      const seq = requestSeq.current;
      try {
        const data = await fetchReviewTree({
          ...range,
          expand: row.child_type,
          parent_id: row.id,
        });
        // The range may have changed while this was in flight; those children
        // would be for the wrong period.
        if (seq !== requestSeq.current) return;
        setChildrenByKey((prev) => ({ ...prev, [key]: data.rows }));
      } catch (err) {
        if (seq !== requestSeq.current) return;
        setError(
          err instanceof ApiError
            ? err
            : new ApiError(String(err), 0, "Network Error"),
        );
        setExpandedKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      } finally {
        setLoadingKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [expandedKeys, childrenByKey, range.from, range.to],
  );

  return {
    meta,
    rows,
    summary,
    missingDays,
    workingDays,
    childrenByKey,
    expandedKeys,
    loading: loading && !loadedOnce.current,
    refreshing,
    loadingKeys,
    error,
    toggleRow,
    refetch: load,
  };
}
