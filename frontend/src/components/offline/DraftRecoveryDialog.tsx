"use client";

/**
 * DraftRecoveryDialog (Phase 3)
 * -----------------------------
 * `window.confirm` ki jagah proper dialog. Form mount par agar saved draft
 * mila to ye "Restore karein?" prompt dikhata hai. Consumer sirf `formId`
 * aur `onRestore(data)` deta hai — restore karne par saved data callback
 * mein wapas jaata hai jise form apne state mein bhar leta hai.
 */

import { useDraftRecovery } from "@/hooks/useDraftRecovery";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { History } from "lucide-react";

function formatWhen(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "abhi kuch der pehle";
  if (mins < 60) return `${mins} minute pehle`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ghante pehle`;
  return new Date(ms).toLocaleString();
}

interface DraftRecoveryDialogProps<T> {
  formId: string;
  onRestore: (data: T) => void;
  /** Optional custom heading text. */
  title?: string;
}

export function DraftRecoveryDialog<T>({
  formId,
  onRestore,
  title = "Saved draft mila",
}: DraftRecoveryDialogProps<T>) {
  const { draft, hasDraft, dismiss, discardDraft } = useDraftRecovery<T>(formId);

  return (
    <AlertDialog open={hasDraft}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-blue-600" />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {draft
              ? `Aapka adhoora bhara hua form ${formatWhen(
                  draft.lastModified
                )} save hua tha. Kya aap use restore karna chahte hain?`
              : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => discardDraft()}>
            Discard karein
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (draft) onRestore(draft.data);
              dismiss();
            }}
          >
            Restore karein
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
