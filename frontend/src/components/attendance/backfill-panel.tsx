"use client";
/**
 * Backfill access across the coordinator's classes.
 *
 * Backfill = letting a teacher go back and mark a date they missed. The backend
 * has had this for a while (model + grant endpoint) with no UI at all, so a
 * coordinator could grant access but never see what they had granted.
 *
 * It is a GRANT, not a REQUEST. AttendanceBackfillPermission has granted_to /
 * granted_by / deadline / is_used — there is no requesting teacher and no
 * pending state. A teacher cannot ask for access. So this panel lists and
 * grants; there is deliberately no Approve/Deny, because there is nothing to
 * approve. Adding that would need a request model first.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Clock, KeyRound, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ApiError } from "@/lib/api";
import { fetchBackfillInScope } from "@/lib/attendance-review-api";
import type { BackfillGrant, BackfillState } from "@/lib/attendance-review-api";

const STATE_STYLE: Record<BackfillState, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-green-100 text-green-800 border-green-300" },
  used: { label: "Used", className: "bg-blue-100 text-blue-800 border-blue-300" },
  expired: { label: "Expired", className: "bg-gray-100 text-gray-600 border-gray-300" },
};

/**
 * 🔧 formatCountdown()
 * Purpose: "2h 15m" until the deadline.
 * Output: string | null — null once it has passed, so callers can stop showing it.
 */
function formatCountdown(deadline: string, now: number): string | null {
  const left = Date.parse(deadline) - now;
  if (Number.isNaN(left) || left <= 0) return null;
  const minutes = Math.floor(left / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

function formatDate(iso: string) {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function BackfillPanel({ onGrant }: { onGrant?: () => void }) {
  const [grants, setGrants] = useState<BackfillGrant[]>([]);
  const [counts, setCounts] = useState<Record<BackfillState, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Ticks so the countdown moves. Stored as a number, not a Date, so the value
  // is comparable and re-renders only when the minute actually changes.
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBackfillInScope();
      setGrants(data.permissions);
      setCounts(data.counts);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    // A minute is enough: the countdown is shown to the minute.
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <KeyRound className="h-4 w-4 text-[#274c77]" />
        <h3 className="font-semibold text-[#274c77]">Backfill Access</h3>
        {counts && counts.active > 0 && (
          <Badge variant="outline" className="border-green-300 bg-green-100 text-xs text-green-800">
            {counts.active} active
          </Badge>
        )}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="ml-auto h-7 px-2"
          onClick={load}
          disabled={loading}
          aria-label="Refresh backfill access"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
        {onGrant && (
          <Button type="button" size="sm" className="h-7 text-xs" onClick={onGrant}>
            Grant Access
          </Button>
        )}
      </div>

      <div className="p-4">
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : error ? (
          <p className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </p>
        ) : grants.length === 0 ? (
          <div className="py-6 text-center">
            <Clock className="mx-auto mb-2 h-7 w-7 text-gray-300" />
            <p className="text-sm text-gray-500">No backfill access granted.</p>
            <p className="mt-1 text-xs text-gray-400">
              Grant a teacher access to mark a date they missed.
            </p>
          </div>
        ) : (
          <div className="max-h-64 overflow-auto">
            <table className="w-full min-w-max text-sm">
              <thead className="sticky top-0 bg-white text-xs uppercase text-gray-500">
                <tr className="border-b">
                  <th className="px-2 py-1.5 text-left font-medium">Teacher</th>
                  <th className="px-2 py-1.5 text-left font-medium">Class</th>
                  <th className="px-2 py-1.5 text-left font-medium">For Date</th>
                  <th className="px-2 py-1.5 text-left font-medium">Reason</th>
                  <th className="px-2 py-1.5 text-left font-medium">Expires</th>
                  <th className="px-2 py-1.5 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {grants.map((grant) => {
                  const countdown =
                    grant.state === "active" ? formatCountdown(grant.deadline, now) : null;
                  return (
                    <tr key={grant.id} className="border-b last:border-0">
                      <td className="px-2 py-1.5 font-medium text-gray-900">{grant.granted_to}</td>
                      <td className="px-2 py-1.5 text-gray-600">{grant.classroom_name}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-gray-600">
                        {formatDate(grant.date)}
                      </td>
                      <td className="max-w-[14rem] truncate px-2 py-1.5 text-gray-500" title={grant.reason}>
                        {grant.reason}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-xs">
                        {countdown ? (
                          <span className="font-medium text-green-700">Expires in {countdown}</span>
                        ) : grant.state === "used" ? (
                          <span className="text-gray-400">Used</span>
                        ) : (
                          <span className="text-gray-400">Expired</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <Badge
                          variant="outline"
                          className={`text-xs ${STATE_STYLE[grant.state].className}`}
                        >
                          {STATE_STYLE[grant.state].label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
