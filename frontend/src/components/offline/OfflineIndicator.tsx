"use client";

/**
 * OfflineIndicator (Phase 4) — app-wide offline banner + draft housekeeping.
 * ------------------------------------------------------------------------
 * Root layout mein mount hota hai. Do kaam:
 *  1. Net jaate hi ek chhota fixed banner: "You're offline — changes are being
 *     saved on this device." Wapas online hone par 2s ke liye "Back online".
 *  2. App startup par ek baar purane drafts (TTL cross) purge — IndexedDB
 *     bharti na rahe.
 *
 * Note: local-recovery model — koi server sync nahi. Banner sirf batata hai ke
 * data locally safe hai, server ka koi wada nahi karta.
 */

import { useEffect, useRef, useState } from "react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { purgeExpiredDrafts } from "@/lib/offline/db";
import { CloudOff, Wifi } from "lucide-react";

export function OfflineIndicator() {
  const online = useOnlineStatus();
  const [showBackOnline, setShowBackOnline] = useState(false);
  const wasOffline = useRef(false);

  // Startup par ek baar expired drafts saaf karo.
  useEffect(() => {
    purgeExpiredDrafts().catch(() => {});
  }, []);

  // Offline → online transition par short "Back online" flash.
  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      setShowBackOnline(false);
      return;
    }
    if (wasOffline.current) {
      wasOffline.current = false;
      setShowBackOnline(true);
      const t = setTimeout(() => setShowBackOnline(false), 2500);
      return () => clearTimeout(t);
    }
  }, [online]);

  if (online && !showBackOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] pointer-events-none"
    >
      {!online ? (
        <div className="flex items-center gap-2 rounded-full bg-amber-500 text-white px-4 py-2 text-sm font-semibold shadow-lg shadow-amber-900/20">
          <CloudOff className="h-4 w-4 shrink-0" />
          Offline — changes are saved on this device
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-full bg-green-600 text-white px-4 py-2 text-sm font-semibold shadow-lg shadow-green-900/20 animate-in fade-in slide-in-from-bottom-2">
          <Wifi className="h-4 w-4 shrink-0" />
          Back online
        </div>
      )}
    </div>
  );
}
