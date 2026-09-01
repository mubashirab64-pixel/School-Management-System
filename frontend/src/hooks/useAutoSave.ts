/**
 * useAutoSave (Phase 1/2) — generic debounced auto-save into IndexedDB.
 * --------------------------------------------------------------------
 * Deliberately form-library agnostic: koi bhi serializable `data` object do
 * (React Hook Form ka `watch()` result, ya plain `useState` object) aur ye
 * debounce ke baad usko draft ke roop mein local DB mein save kar deta hai.
 *
 * Phase 1-3 mein ye sirf LOCAL save karta hai (server sync nahi). Status
 * badge ke liye `SaveStatus` return hota hai.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { saveDraft, deleteDraft } from "@/lib/offline/db";

export type SaveStatus =
  | "idle"
  | "saving"
  | "saved"
  | "offline"
  | "syncing"
  | "synced"
  | "error";

interface UseAutoSaveOptions {
  /** Debounce wait (ms). Default 800ms. */
  debounceMs?: number;
  /**
   * Auto-save enable/disable. Restore prompt dikh raha ho ya form abhi ready
   * na ho to `false` karke save rok sakte hain.
   */
  enabled?: boolean;
  /**
   * Empty/pristine data ko save na karein (khaali draft banane se bachao).
   * Default: agar object ke saare values empty hon to skip.
   */
  isEmpty?: (data: unknown) => boolean;
  /**
   * Edit forms ke liye: pehla non-empty data snapshot "baseline" (server se
   * loaded record) maan lo aur jab tak user usme actual change na kare tab tak
   * save mat karo. Isse unchanged record ka draft nahi banta (na false restore
   * prompt aata). Add forms ke liye `false` (default).
   */
  baselineSkip?: boolean;
}

function defaultIsEmpty(data: unknown): boolean {
  if (data == null) return true;
  if (typeof data !== "object") return !data;
  const values = Object.values(data as Record<string, unknown>);
  if (values.length === 0) return true;
  return values.every((v) => {
    if (v == null) return true;
    if (typeof v === "string") return v.trim() === "";
    if (typeof v === "object") return Object.keys(v).length === 0;
    return false;
  });
}

export function useAutoSave<T>(
  formId: string,
  data: T,
  options: UseAutoSaveOptions = {}
) {
  const {
    debounceMs = 800,
    enabled = true,
    isEmpty = defaultIsEmpty,
    baselineSkip = false,
  } = options;

  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Pehle render pe save skip karna hai — warna sirf mount hone se hi
  // empty/initial draft ban jayega.
  const isFirstRun = useRef(true);
  // Edit forms: pehla non-empty snapshot (loaded record) — iske barabar data
  // ko save nahi karte.
  const baselineRef = useRef<string | null>(null);
  // Latest values ko closure staleness se bachane ke liye refs.
  const enabledRef = useRef(enabled);
  const isEmptyRef = useRef(isEmpty);
  enabledRef.current = enabled;
  isEmptyRef.current = isEmpty;

  // formId badalne par (ek hi modal instance doosre record ke liye reuse ho)
  // baseline reset — warna naye record ka unchanged data draft ban jata.
  useEffect(() => {
    baselineRef.current = null;
  }, [formId]);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    if (!enabledRef.current) return;
    if (isEmptyRef.current(data)) return;

    // baselineSkip: pehla non-empty snapshot yaad rakho; jab tak data usi ke
    // barabar hai (user ne change nahi kiya) save skip karo.
    if (baselineSkip) {
      const serialized = JSON.stringify(data);
      if (baselineRef.current === null) {
        baselineRef.current = serialized;
        return;
      }
      if (baselineRef.current === serialized) return;
    }

    setStatus("saving");
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      try {
        await saveDraft(formId, data);
        setStatus(navigator.onLine ? "saved" : "offline");
        setLastSavedAt(Date.now());
      } catch (err) {
        console.error("[useAutoSave] draft save failed:", err);
        setStatus("error");
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // `data` change hone par hi re-run — JSON compare se deep change detect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId, JSON.stringify(data), debounceMs]);

  // Online/offline transition par badge update.
  useEffect(() => {
    const onOnline = () =>
      setStatus((s) => (s === "offline" ? "saved" : s));
    const onOffline = () => setStatus("offline");
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  /** Submit success ke baad draft hata do (ab server ke paas permanent hai). */
  const clearDraft = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    await deleteDraft(formId);
    setStatus("idle");
    setLastSavedAt(null);
  }, [formId]);

  return { status, lastSavedAt, clearDraft };
}
