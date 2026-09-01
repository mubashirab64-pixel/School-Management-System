"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  getPendingEnrollmentRequests, approveEnrollmentRequest, rejectEnrollmentRequest,
} from "@/lib/api"
import { CheckCircle2, XCircle, Clock, User2 } from "lucide-react"
import { toast } from "sonner"

const LABEL: Record<string, string> = {
  enrolled: "Enrolled", left: "Left", re_enrolled: "Re-enrolled",
  graduated: "Graduated", transferred: "Transferred",
}
const BADGE: Record<string, string> = {
  enrolled: "bg-green-100 text-green-700",
  re_enrolled: "bg-blue-100 text-blue-700",
  left: "bg-rose-100 text-rose-700",
  transferred: "bg-amber-100 text-amber-700",
  graduated: "bg-purple-100 text-purple-700",
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-rose-100 text-rose-700",
}

export default function CoordinatorEnrollmentRequestsPage() {
  const [tab, setTab] = useState<"pending" | "all">("pending")
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [rejecting, setRejecting] = useState<any | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  const load = async () => {
    setLoading(true)
    try {
      const data: any = await getPendingEnrollmentRequests(tab === "all")
      setRows(Array.isArray(data) ? data : [])
    } catch {
      toast.error("Failed to load requests")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() /* eslint-disable-next-line */ }, [tab])

  const approve = async (r: any) => {
    setBusyId(r.id)
    try {
      await approveEnrollmentRequest(r.id)
      toast.success(`Approved — ${r.student_name} is now ${LABEL[r.requested_status] || r.requested_status}`)
      setRows((prev) => prev.filter((x) => x.id !== r.id))
    } catch (e: any) {
      const d = e?.data || e?.response?.data
      toast.error(d ? Object.values(d).flat().join(" ") : "Failed to approve")
    } finally {
      setBusyId(null)
    }
  }

  const submitReject = async () => {
    if (!rejecting || !rejectReason.trim()) return
    setBusyId(rejecting.id)
    try {
      await rejectEnrollmentRequest(rejecting.id, rejectReason.trim())
      toast.success(`Rejected request for ${rejecting.student_name}`)
      setRows((prev) => prev.filter((x) => x.id !== rejecting.id))
      setRejecting(null); setRejectReason("")
    } catch (e: any) {
      const d = e?.data || e?.response?.data
      toast.error(d ? Object.values(d).flat().join(" ") : "Failed to reject")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-[#274c77]">Enrollment Status Requests</h1>
          <p className="text-xs text-gray-500">Teachers&apos; student status-change requests awaiting your approval.</p>
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {([["pending", "Pending"], ["all", "All"]] as const).map(([k, lbl]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-4 py-1.5 text-xs font-bold ${tab === k ? "bg-[#274c77] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>{lbl}</button>
          ))}
        </div>
      </div>

      <Card className="border border-gray-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-[#274c77] flex items-center gap-2">
            <Clock className="h-4 w-4" /> {tab === "pending" ? "Pending" : "All"} Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No {tab === "pending" ? "pending " : ""}requests.</p>
          ) : (
            <div className="space-y-3">
              {rows.map((r) => (
                <div key={r.id} className="border border-gray-100 rounded-xl p-4 flex flex-wrap items-center gap-4">
                  <div className="min-w-[180px] flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-800">{r.student_name}</span>
                      {r.student_code && <span className="text-[11px] text-gray-400">{r.student_code}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs">
                      <span className={`px-2 py-0.5 rounded-full font-semibold ${BADGE[r.current_status] || "bg-gray-100 text-gray-600"}`}>
                        {LABEL[r.current_status] || r.current_status}
                      </span>
                      <span className="text-gray-400">→</span>
                      <span className={`px-2 py-0.5 rounded-full font-semibold ${BADGE[r.requested_status] || "bg-gray-100 text-gray-600"}`}>
                        {LABEL[r.requested_status] || r.requested_status}
                      </span>
                      <span className="text-gray-400">· {r.event_date}</span>
                    </div>
                    {r.reason && <p className="text-xs text-gray-500 mt-1">Reason: {r.reason}</p>}
                    <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                      <User2 className="h-3 w-3" /> {r.requested_by_name || "—"}
                      {r.campus_name ? ` · ${r.campus_name}` : ""}
                    </p>
                  </div>

                  {r.status === "pending" ? (
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        disabled={busyId === r.id} onClick={() => approve(r)}>
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="text-rose-600 border-rose-200 hover:bg-rose-50"
                        disabled={busyId === r.id} onClick={() => { setRejecting(r); setRejectReason("") }}>
                        <XCircle className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    </div>
                  ) : (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${BADGE[r.status] || "bg-gray-100 text-gray-600"}`}>
                      {r.status}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject modal */}
      {rejecting && (
        <div className="fixed inset-0 z-[120] bg-black/50 flex items-center justify-center p-4" onClick={() => setRejecting(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#274c77]">Reject Request</h3>
            <p className="text-sm text-gray-500">
              {rejecting.student_name}: {LABEL[rejecting.current_status]} → {LABEL[rejecting.requested_status]}
            </p>
            <div>
              <label className="text-sm font-semibold text-gray-600 block mb-1">Reason <span className="text-rose-600">*</span></label>
              <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3}
                placeholder="Why are you rejecting this request?"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#274c77] resize-none" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="ghost" className="flex-1" onClick={() => setRejecting(null)} disabled={busyId === rejecting.id}>Cancel</Button>
              <Button className="flex-1 bg-rose-600 hover:bg-rose-700 text-white"
                onClick={submitReject} disabled={!rejectReason.trim() || busyId === rejecting.id}>
                {busyId === rejecting.id ? "Rejecting…" : "Reject"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
