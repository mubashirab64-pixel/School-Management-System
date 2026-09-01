"use client";

/**
 * ResultSheetRecoveryDialog (Phase 6)
 * -----------------------------------
 * Bulk marksheet khulte hi (bulkEntryMode) is sheet (classroom+exam+month) ke
 * pehle se saved row-drafts check karta hai. Mile to "X students ka adhoora
 * marksheet mila — Restore karein?" prompt. Restore par saari rows wapas
 * `marksheetData` mein bhar jaati hain.
 */

import { useEffect, useState } from "react";
import {
  listDraftsByPrefix,
  deleteDraftsByPrefix,
} from "@/lib/offline/db";
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
import { ClipboardList } from "lucide-react";

const ROW_SEP = "::row::";

interface RowDraftPayload {
  sheetId: string;
  rowKey: string;
  data: unknown;
}

interface Props {
  sheetId: string;
  /** Sirf tab check karo jab sheet mode active ho. */
  enabled: boolean;
  onRestore: (rows: Record<string, unknown>) => void;
}

export function ResultSheetRecoveryDialog({
  sheetId,
  enabled,
  onRestore,
}: Props) {
  const [rows, setRows] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!enabled || !sheetId) {
      setRows(null);
      return;
    }
    let active = true;
    (async () => {
      const drafts = await listDraftsByPrefix<RowDraftPayload>(
        `${sheetId}${ROW_SEP}`
      );
      if (!active) return;
      if (drafts.length === 0) {
        setRows(null);
        return;
      }
      const out: Record<string, unknown> = {};
      for (const d of drafts) {
        if (d.data?.rowKey != null) out[d.data.rowKey] = d.data.data;
      }
      setRows(out);
    })();
    return () => {
      active = false;
    };
  }, [sheetId, enabled]);

  const count = rows ? Object.keys(rows).length : 0;

  return (
    <AlertDialog open={count > 0}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-[#274c77]" />
            Adhoora marksheet mila
          </AlertDialogTitle>
          <AlertDialogDescription>
            Is class/exam ke <strong>{count}</strong> students ke marks pehle se
            locally save the (net gaya ya page refresh hua). Kya aap unhe restore
            karna chahte hain?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={async () => {
              await deleteDraftsByPrefix(`${sheetId}${ROW_SEP}`);
              setRows(null);
            }}
          >
            Discard karein
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (rows) onRestore(rows);
              setRows(null);
            }}
          >
            Restore karein
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
