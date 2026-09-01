/**
 * useAutoSaveRows (Phase 6) — Result Sheet ke liye ROW-LEVEL auto-save.
 * -------------------------------------------------------------------
 * Bulk marksheet mein 30-40 students × kai subjects = sainkdo fields hote hain.
 * Poori sheet ko ek blob mein baar-baar likhna wasteful hai, isliye har student
 * ki row ka apna alag IndexedDB draft banta hai:
 *
 *     <sheetId>::row::<rowKey>
 *
 * Sirf woh row save/delete hoti hai jiska data actually badla — baaki untouched.
 * Ye sab LOCAL hai (server sync nahi); sheet submit "Post Marks" button se hi
 * hota hai. Refresh/crash par `loadRows` se poori sheet wapas bhar jaati hai.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  saveDraft,
  deleteDraft,
  deleteDraftsByPrefix,
  listDraftsByPrefix,
} from "@/lib/offline/db";

const ROW_SEP = "::row::";

function rowDraftId(sheetId: string, rowKey: string | number) {
  return `${sheetId}${ROW_SEP}${rowKey}`;
}

interface RowDraftPayload {
  sheetId: string;
  rowKey: string;
  data: unknown;
}

interface UseAutoSaveRowsOptions {
  debounceMs?: number;
  enabled?: boolean;
  /** Row ko empty maano (khaali row ka draft na bane). */
  isRowEmpty?: (row: unknown) => boolean;
}

function defaultIsRowEmpty(row: unknown): boolean {
  if (row == null) return true;
  if (typeof row !== "object") return !row;
  const values = Object.values(row as Record<string, unknown>);
  if (values.length === 0) return true;
  return values.every((v) => v === undefined || v === null || v === "" || v === false);
}

export function useAutoSaveRows<T extends Record<string | number, unknown>>(
  sheetId: string,
  rows: T,
  options: UseAutoSaveRowsOptions = {}
) {
  const {
    debounceMs = 700,
    enabled = true,
    isRowEmpty = defaultIsRowEmpty,
  } = options;

  const [savedRowKeys, setSavedRowKeys] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  // Har row ka last-saved JSON — sirf changed rows ko dobara likhne ke liye.
  const lastSavedRef = useRef<Record<string, string>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRun = useRef(true);
  const enabledRef = useRef(enabled);
  const isRowEmptyRef = useRef(isRowEmpty);
  const sheetIdRef = useRef(sheetId);
  enabledRef.current = enabled;
  isRowEmptyRef.current = isRowEmpty;

  // sheetId badalte hi (classroom/exam/month change) local tracking reset.
  useEffect(() => {
    sheetIdRef.current = sheetId;
    lastSavedRef.current = {};
    setSavedRowKeys(new Set());
    isFirstRun.current = true;
  }, [sheetId]);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    if (!enabledRef.current || !sheetId) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    setIsSaving(true);

    timerRef.current = setTimeout(async () => {
      try {
        const currentKeys = new Set(Object.keys(rows));
        const nextSaved = new Set(savedRowKeys);

        // Changed / naye rows save karo.
        for (const rowKey of currentKeys) {
          const row = rows[rowKey];
          const id = rowDraftId(sheetId, rowKey);

          if (isRowEmptyRef.current(row)) {
            // Row khaali ho gayi → agar pehle saved thi to delete.
            if (lastSavedRef.current[rowKey] !== undefined) {
              await deleteDraft(id);
              delete lastSavedRef.current[rowKey];
              nextSaved.delete(rowKey);
            }
            continue;
          }

          const serialized = JSON.stringify(row);
          if (lastSavedRef.current[rowKey] === serialized) continue; // unchanged

          const payload: RowDraftPayload = { sheetId, rowKey, data: row };
          await saveDraft(id, payload);
          lastSavedRef.current[rowKey] = serialized;
          nextSaved.add(rowKey);
        }

        // Jo rows object se hat gayi (pehle saved thi) → unke drafts delete.
        for (const rowKey of Object.keys(lastSavedRef.current)) {
          if (!currentKeys.has(rowKey)) {
            await deleteDraft(rowDraftId(sheetId, rowKey));
            delete lastSavedRef.current[rowKey];
            nextSaved.delete(rowKey);
          }
        }

        setSavedRowKeys(nextSaved);
      } catch (err) {
        console.error("[useAutoSaveRows] row save failed:", err);
      } finally {
        setIsSaving(false);
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetId, JSON.stringify(rows), debounceMs]);

  /** Is sheet ke saare saved rows load karo (recovery ke liye). */
  const loadRows = useCallback(async (): Promise<Record<string, unknown>> => {
    const drafts = await listDraftsByPrefix<RowDraftPayload>(
      `${sheetId}${ROW_SEP}`
    );
    const out: Record<string, unknown> = {};
    for (const d of drafts) {
      if (d.data?.rowKey != null) out[d.data.rowKey] = d.data.data;
    }
    return out;
  }, [sheetId]);

  /** Kitne rows saved hain (badge ke liye). */
  const countSaved = useCallback(async (): Promise<number> => {
    const drafts = await listDraftsByPrefix(`${sheetId}${ROW_SEP}`);
    return drafts.length;
  }, [sheetId]);

  /** Submit success / discard par is sheet ke saare row drafts hata do. */
  const clearSheet = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    await deleteDraftsByPrefix(`${sheetId}${ROW_SEP}`);
    lastSavedRef.current = {};
    setSavedRowKeys(new Set());
  }, [sheetId]);

  return {
    savedRowKeys,
    savedCount: savedRowKeys.size,
    isSaving,
    loadRows,
    countSaved,
    clearSheet,
  };
}
