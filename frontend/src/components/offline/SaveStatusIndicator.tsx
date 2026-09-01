"use client";

/**
 * SaveStatusIndicator (Phase 2)
 * -----------------------------
 * Chhota badge jo auto-save ka current state dikhata hai (Google Docs jaisa
 * "Saving… / Saved" text). Phase 4 mein syncing/synced states bhi live honge.
 */

import type { SaveStatus } from "@/hooks/useAutoSave";
import {
  Check,
  CloudOff,
  Loader2,
  RefreshCw,
  CloudUpload,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SaveStatusIndicatorProps {
  status: SaveStatus;
  lastSavedAt?: number | null;
  className?: string;
}

const CONFIG: Record<
  SaveStatus,
  { label: string; icon: React.ReactNode; classes: string } | null
> = {
  idle: null,
  saving: {
    label: "Saving…",
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    classes: "text-slate-500 bg-slate-100",
  },
  saved: {
    label: "Saved",
    icon: <Check className="h-3.5 w-3.5" />,
    classes: "text-green-700 bg-green-100",
  },
  offline: {
    label: "Offline – changes stored locally",
    icon: <CloudOff className="h-3.5 w-3.5" />,
    classes: "text-amber-700 bg-amber-100",
  },
  syncing: {
    label: "Syncing…",
    icon: <RefreshCw className="h-3.5 w-3.5 animate-spin" />,
    classes: "text-blue-700 bg-blue-100",
  },
  synced: {
    // Local-recovery model — koi server sync nahi; ye state ab trigger nahi
    // hoti, par label local-only rakha (server imply na kare).
    label: "Saved on this device",
    icon: <CloudUpload className="h-3.5 w-3.5" />,
    classes: "text-green-700 bg-green-100",
  },
  error: {
    label: "Save failed",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    classes: "text-red-700 bg-red-100",
  },
};

export function SaveStatusIndicator({
  status,
  className,
}: SaveStatusIndicatorProps) {
  const cfg = CONFIG[status];
  if (!cfg) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
        cfg.classes,
        className
      )}
      role="status"
      aria-live="polite"
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}
