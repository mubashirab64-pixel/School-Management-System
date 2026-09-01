/**
 * useDraftRecovery (Phase 3) — mount par saved draft check karo.
 * -------------------------------------------------------------
 * Component mount hote hi is form ka pehle se saved (un-synced) draft dhoondta
 * hai. Agar mila to `draft` set hota hai taaki UI "Restore karein?" prompt
 * dikha sake. Restore/Discard actions consumer handle karta hai.
 */

import { useCallback, useEffect, useState } from "react";
import { getDraft, deleteDraft, type FormDraft } from "@/lib/offline/db";

export function useDraftRecovery<T>(formId: string) {
  const [draft, setDraft] = useState<FormDraft<T> | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const found = await getDraft<T>(formId);
      if (active) {
        setDraft(found);
        setChecked(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [formId]);

  /** Prompt band karo bina draft delete kiye (baad mein phir pooch sakte hain). */
  const dismiss = useCallback(() => setDraft(null), []);

  /** Draft permanently delete + prompt band. */
  const discardDraft = useCallback(async () => {
    await deleteDraft(formId);
    setDraft(null);
  }, [formId]);

  return { draft, checked, hasDraft: !!draft, dismiss, discardDraft };
}
