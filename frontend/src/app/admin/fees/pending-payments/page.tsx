"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Eye, Clock, RefreshCw, ShieldCheck } from "lucide-react";
import { FeeTabs } from "../components/FeeTabs";
import { getApiBaseUrl } from "@/lib/api";
import { toast } from "sonner";

// ─── API helper ──────────────────────────────────────────────────────────────
function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("sis_access_token");
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const base = getApiBaseUrl();
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const token = getToken();
  const res = await fetch(`${cleanBase}${cleanPath}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || err?.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface PendingPayment {
  id: number;
  student_name: string;
  challan_number: string;
  challan_month: number;
  challan_year: number;
  challan_total: string;
  amount: string;
  transaction_id: string;
  bank_name: string | null;
  screenshot_url: string | null;
  submitted_at: string;
  status: string;
}

const MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ─── Screenshot Modal ─────────────────────────────────────────────────────────
function ScreenshotModal({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <span className="font-bold text-slate-700">Payment Screenshot</span>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl font-bold"
          >
            ×
          </button>
        </div>
        <div className="p-4">
          <img src={url} alt="Payment proof" className="w-full rounded-xl object-contain max-h-[70vh]" />
        </div>
      </div>
    </div>
  );
}

// ─── Reject Modal ─────────────────────────────────────────────────────────────
function RejectModal({
  txnId,
  studentName,
  onConfirm,
  onClose,
}: {
  txnId: number;
  studentName: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold text-slate-800 text-lg mb-1">Reject Payment</h3>
        <p className="text-sm text-slate-500 mb-4">
          Rejecting payment for <strong>{studentName}</strong>. Provide a reason:
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="e.g. Wrong amount transferred, invalid screenshot..."
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-300"
        />
        <div className="flex gap-3 mt-4">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white"
            onClick={() => {
              if (!reason.trim()) { toast.error("Please enter a reason."); return; }
              onConfirm(reason.trim());
            }}
          >
            Confirm Reject
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PendingPaymentsPage() {
  const { toast } = useToast();
  const [payments, setPayments] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: number; name: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/fees/payment-transactions/pending/");
      setPayments(Array.isArray(data) ? data : (data?.results || []));
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function verify(id: number, action: "approve" | "reject", rejectReason = "") {
    setProcessingId(id);
    try {
      await apiFetch(`/api/fees/payment-transactions/${id}/verify/`, {
        method: "POST",
        body: JSON.stringify({ action, reject_reason: rejectReason }),
      });
      toast({
        title: action === "approve" ? "Payment Approved ✅" : "Payment Rejected ❌",
        description: action === "approve"
          ? "Challan has been marked as PAID."
          : "Student will be notified to resubmit.",
      });
      setPayments((prev) => prev.filter((p) => p.id !== id));
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setProcessingId(null);
      setRejectTarget(null);
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-3xl font-extrabold text-[#274c77] mb-2 tracking-wide flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-[#6096ba]" />
            Verify Payments
          </h2>
          <p className="text-gray-600 text-lg">Review and verify student bank transfer submissions.</p>
        </div>
        <Button
          variant="outline"
          className="rounded-xl gap-2 self-start md:self-end"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <FeeTabs active="pending-payments" />

      <div className="max-w-6xl mx-auto">

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="border-0 shadow-md rounded-2xl">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-50 rounded-xl">
                  <Clock className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pending</p>
                  <p className="text-2xl font-black text-slate-800">{payments.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md rounded-2xl">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 rounded-xl">
                  <Eye className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Amount</p>
                  <p className="text-2xl font-black text-slate-800">
                    Rs {payments.reduce((s, p) => s + Number(p.amount), 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md rounded-2xl">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 rounded-xl">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">With Screenshots</p>
                  <p className="text-2xl font-black text-slate-800">
                    {payments.filter((p) => p.screenshot_url).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card className="border-0 shadow-lg rounded-3xl overflow-hidden">
          <CardHeader className="bg-[#013a63] text-white p-5">
            <CardTitle className="text-lg font-bold">Payment Verification Queue</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-20 text-center text-slate-400">Loading...</div>
            ) : payments.length === 0 ? (
              <div className="py-20 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
                <p className="font-bold text-slate-600 text-lg">All caught up!</p>
                <p className="text-slate-400 text-sm mt-1">No pending payment verifications.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left p-4 font-bold text-slate-500 text-[11px] uppercase tracking-wider">Student</th>
                      <th className="text-left p-4 font-bold text-slate-500 text-[11px] uppercase tracking-wider">Challan</th>
                      <th className="text-left p-4 font-bold text-slate-500 text-[11px] uppercase tracking-wider">Amount</th>
                      <th className="text-left p-4 font-bold text-slate-500 text-[11px] uppercase tracking-wider">Transaction ID</th>
                      <th className="text-left p-4 font-bold text-slate-500 text-[11px] uppercase tracking-wider">Bank</th>
                      <th className="text-left p-4 font-bold text-slate-500 text-[11px] uppercase tracking-wider">Submitted</th>
                      <th className="text-right p-4 font-bold text-slate-500 text-[11px] uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-4">
                          <span className="font-bold text-slate-800">{p.student_name}</span>
                        </td>
                        <td className="p-4">
                          <div>
                            <span className="font-mono text-[11px] text-slate-500">{p.challan_number}</span>
                            <br />
                            <span className="text-[11px] text-slate-400">
                              {MONTH_NAMES[p.challan_month]} {p.challan_year}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="font-black text-slate-800">Rs {Number(p.amount).toLocaleString()}</span>
                        </td>
                        <td className="p-4">
                          <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded-lg text-slate-700">{p.transaction_id}</span>
                        </td>
                        <td className="p-4">
                          <span className="text-xs text-slate-500">{p.bank_name || "—"}</span>
                        </td>
                        <td className="p-4">
                          <span className="text-[11px] text-slate-400">
                            {new Date(p.submitted_at).toLocaleDateString("en-GB")}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-end gap-2">
                            {/* View screenshot */}
                            {p.screenshot_url && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-xl h-9 px-3 gap-1.5 text-blue-600 border-blue-100 hover:bg-blue-50"
                                onClick={() => setScreenshotUrl(p.screenshot_url!)}
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Proof
                              </Button>
                            )}
                            {/* Approve */}
                            <Button
                              size="sm"
                              className="rounded-xl h-9 px-3 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                              disabled={processingId === p.id}
                              onClick={() => verify(p.id, "approve")}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {processingId === p.id ? "..." : "Approve"}
                            </Button>
                            {/* Reject */}
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-xl h-9 px-3 gap-1.5 text-rose-600 border-rose-100 hover:bg-rose-50"
                              disabled={processingId === p.id}
                              onClick={() => setRejectTarget({ id: p.id, name: p.student_name })}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Reject
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Screenshot Modal */}
      {screenshotUrl && (
        <ScreenshotModal url={screenshotUrl} onClose={() => setScreenshotUrl(null)} />
      )}

      {/* Reject Reason Modal */}
      {rejectTarget && (
        <RejectModal
          txnId={rejectTarget.id}
          studentName={rejectTarget.name}
          onConfirm={(reason) => verify(rejectTarget.id, "reject", reason)}
          onClose={() => setRejectTarget(null)}
        />
      )}
    </div>
  );
}
