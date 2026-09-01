/**
 * useOnlineStatus (Phase 4) — browser ka live online/offline state.
 * ----------------------------------------------------------------
 * `navigator.onLine` + `online`/`offline` events ko ek reactive boolean mein
 * badalta hai. Global offline banner aur status badges isko use karte hain.
 * (Local-recovery model — koi server sync nahi; ye sirf UX feedback ke liye.)
 */

import { useEffect, useState } from "react";

export function useOnlineStatus(): boolean {
  // SSR par by default online maano (hydration mismatch se bachne ke liye).
  const [online, setOnline] = useState(true);

  useEffect(() => {
    // Mount ke baad actual value set karo.
    setOnline(navigator.onLine);

    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}
