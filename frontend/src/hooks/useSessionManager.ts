"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes

export function useSessionManager() {
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const doLogout = () => {
    if (typeof window === 'undefined') return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    localStorage.clear();
    document.cookie = 'sis_access_token=; path=/; max-age=0';
    document.cookie = 'sis_refresh_token=; path=/; max-age=0';
    // Full page navigation — clears all React state, no hard refresh needed
    window.location.replace('/login');
  };

  const resetTimer = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(doLogout, INACTIVITY_TIMEOUT);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.pathname === '/login') return;
    if (!localStorage.getItem('sis_access_token')) return;

    // Start timer on mount
    resetTimer();

    // Any user activity resets the 15-min timer
    const events = ['mousemove', 'mousedown', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));

    // When tab becomes visible again after being hidden, reset timer
    const onVisibilityChange = () => {
      if (!document.hidden) resetTimer();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      events.forEach(e => window.removeEventListener(e, resetTimer));
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [router]);

  return { logout: doLogout };
}
