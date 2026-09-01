"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { changeStudentEnrollmentStatus } from "@/lib/api"
import { getCurrentUserRole } from "@/lib/permissions"
import { toast } from "sonner"

// Teachers file a request for coordinator approval; everyone else changes directly.
const NEEDS_APPROVAL_ROLES = new Set(["teacher"])

// Mirrors the backend state machine (students/models.py ENROLLMENT_TRANSITIONS).
const TRANSITIONS: Record<string, string[]> = {
  enrolled: ["left", "graduated", "transferred"],
  left: ["re_enrolled"],
  re_enrolled: ["left", "graduated", "transferred"],
  transferred: ["re_enrolled", "left"],
  graduated: [],
}
const LABEL: Record<string, string> = {
  enrolled: "Enrolled", left: "Left", re_enrolled: "Re-enrolled",
  graduated: "Graduated", transferred: "Transferred",
}
const BADGE: Record<string, string> = {
  enrolled: "bg-green-100 text-green-700 border-green-200",
  re_enrolled: "bg-blue-100 text-blue-700 border-blue-200",
  left: "bg-rose-100 text-rose-700 border-rose-200",
  transferred: "bg-amber-100 text-amber-700 border-amber-200",
  graduated: "bg-purple-100 text-purple-700 border-purple-200",
}

function fmtGap(days?: number | null) {
  if (days == null) return null
  const months = Math.floor(days / 30)
  const rem = days % 30
  if (months <= 0) return `${days} day${days === 1 ? "" : "s"} gap`
  return `${months} month${months === 1 ? "" : "s"}${rem ? ` ${rem}d` : ""} gap`
}

export default function EnrollmentStatusCard({
  student,
  onUpdated,
  className = "",
}: {
  student: any
  onUpdated?: (updated: any) => void
  className?: string
}) {
  const status: string = student?.enrollment_status || "enrolled"
  const events: any[] = Array.isArray(student?.enrollment_events) ? student.enrollment_events : []
  const options = TRANSITIONS[status] || []
  const needsApproval = NEEDS_APPROVAL_ROLES.has(getCurrentUserRole())

  const [open, setOpen] = useState(false)
  const [newStatus, setNewStatus] = useState("")
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [reason, setReason] = useState("")
  const [reasonCode, setReasonCode] = useState("")
  const [saving, setSaving] = useState(false)

  // Reason is always required; an exit reason code is required when leaving.
  const reasonRequired = true
  const needsReasonCode = newStatus === "left"
  const canSave = !!newStatus && !!eventDate && reason.trim().length > 0 && (!needsReasonCode || !!reasonCode)

  const currentGap = useMemo(() => fmtGap(student?.current_gap_days), [student?.current_gap_days])

  const submit = async () => {
    if (!canSave) return
    try {
      setSaving(true)
      const res: any = await changeStudentEnrollmentStatus(student.id, {
        status: newStatus,
        event_date: eventDate,
        reason: reason.trim() || undefined,
        reason_code: needsReasonCode ? reasonCode : undefined,
      })
      // Teacher path returns { message, request } (pending approval); direct path
      // returns the updated student.
      if (res && res.request) {
        toast.success(`Request sent to coordinator for approval (${LABEL[newStatus] || newStatus})`)
      } else {
        toast.success(`Status changed to ${LABEL[newStatus] || newStatus}`)
        onUpdated?.(res)
      }
      setOpen(false)
      setNewStatus(""); setReason(""); setReasonCode("")
    } catch (e: any) {
      // Backend returns { field: [msg] } on validation errors.
      const data = e?.data || e?.response?.data
      const msg = data
        ? Object.values(data).flat().join(" ")
        : e?.message || "Failed to change status"
      toast.error(String(msg))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className={`border border-gray-100 ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-bold text-[#274c77]">Enrollment Status</CardTitle>
        {options.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            {needsApproval ? "Request Change" : "Change Status"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${BADGE[status] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
            {LABEL[status] || status}
          </span>
          {currentGap && status !== "enrolled" && status !== "re_enrolled" && status !== "graduated" && (
            <span className="text-xs text-rose-600 font-semibold">Away: {currentGap}</span>
          )}
        </div>

        {events.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">Timeline</p>
            <ol className="space-y-2">
              {events.map((ev) => (
                <li key={ev.id} className="flex items-start gap-2 text-sm">
                  <span className={`mt-0.5 h-2 w-2 rounded-full flex-shrink-0 ${(BADGE[ev.event_type] || "").split(" ")[0]}`} />
                  <div className="flex-1">
                    <span className="font-semibold text-gray-800">{LABEL[ev.event_type] || ev.event_type}</span>
                    <span className="text-gray-400"> — {ev.event_date}</span>
                    {ev.gap_days != null && (
                      <span className="ml-2 text-[11px] font-bold text-blue-600">⟵ {fmtGap(ev.gap_days)}</span>
                    )}
                    {ev.reason && <div className="text-xs text-gray-500">Reason: {ev.reason}</div>}
                    {ev.created_by_name && <div className="text-[11px] text-gray-400">by {ev.created_by_name}</div>}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </CardContent>

      {open && (
        <div className="fixed inset-0 z-[120] bg-black/50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#274c77]">
              {needsApproval ? "Request Enrollment Status Change" : "Change Enrollment Status"}
            </h3>
            {needsApproval && (
              <p className="text-xs text-amber-600 -mt-2">This change requires coordinator approval.</p>
            )}

            <div>
              <label className="text-sm font-semibold text-gray-600 block mb-1">New status</label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                {/* z above the modal (z-120) so the options aren't hidden behind it */}
                <SelectContent className="z-[200]">
                  {options.map((o) => (
                    <SelectItem key={o} value={o}>{o === "left" ? "Left-dropdown" : LABEL[o]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Exit reason code — required when leaving (drives Dropout% analytics) */}
            {needsReasonCode && (
              <div>
                <label className="text-sm font-semibold text-gray-600 block mb-1">
                  Exit reason <span className="text-rose-600">*</span>
                </label>
                <Select value={reasonCode} onValueChange={setReasonCode}>
                  <SelectTrigger><SelectValue placeholder="Why is the student leaving?" /></SelectTrigger>
                  <SelectContent className="z-[200]">
                    <SelectItem value="dropout">Dropout</SelectItem>
                    <SelectItem value="transferred_out">Transferred Out</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <label className="text-sm font-semibold text-gray-600 block mb-1">Date</label>
              <input type="date" value={eventDate} max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#274c77]" />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-600 block mb-1">
                Reason {reasonRequired && <span className="text-rose-600">*</span>}
              </label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                placeholder={reasonRequired ? "Required" : "Optional"}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#274c77] resize-none" />
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="ghost" className="flex-1" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
              <Button className="flex-1 bg-[#274c77] hover:bg-[#1e3a5f] text-white" onClick={submit} disabled={!canSave || saving}>
                {saving ? "Saving…" : needsApproval ? "Send Request" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
