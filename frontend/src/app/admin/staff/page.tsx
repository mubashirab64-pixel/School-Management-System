"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Users, Search, RefreshCcw, ArrowLeftRight, Clock,
  Building2, CheckCircle2, XCircle, X, Loader2,
  GraduationCap, Award, Briefcase, ShieldCheck,
  Receipt, ClipboardList, UserCog, ChevronRight,
  AlertTriangle, Sparkles, MoreVertical, PowerOff, Power
} from "lucide-react"
import { getOrgStaff, switchUserRole, toggleUserActive, getAllCampuses, getLevels, OrgStaffMember, ApiError } from "@/lib/api"
import { getCurrentUserRole } from "@/lib/permissions"
import { useRouter } from "next/navigation"

// Custom scrollbar styles
const scrollbarStyles = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 5px;
    height: 5px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
`;

// ─── Role config ───────────────────────────────────────────────────────────────
const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  teacher:              { label: "Teacher",     color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200",  icon: GraduationCap },
  coordinator:          { label: "Coordinator", color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200", icon: Award },
  principal:            { label: "Principal",   color: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200",  icon: Briefcase },
  accounts_officer:     { label: "Accountant",  color: "text-emerald-700",bg: "bg-emerald-50",border: "border-emerald-200",icon: Receipt },
  admissions_counselor: { label: "Receptionist",color: "text-pink-700",   bg: "bg-pink-50",   border: "border-pink-200",   icon: ClipboardList },
  compliance_officer:   { label: "Auditor",     color: "text-gray-700",   bg: "bg-gray-100",  border: "border-gray-200",   icon: ShieldCheck },
  org_admin:            { label: "Org Admin",   color: "text-red-700",    bg: "bg-red-50",    border: "border-red-200",    icon: UserCog },
}

const AVATAR_COLORS = [
  "bg-[#2a4e78]", "bg-[#2a4e78]", "bg-[#2a4e78]",
  "bg-[#2a4e78]", "bg-[#2a4e78]", "bg-[#2a4e78]", "bg-[#2a4e78]",
]

function getAvatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getInitials(name: string) {
  const parts = name.trim().split(" ")
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

// Roles switchable TO
const SWITCHABLE_TO: Record<string, string[]> = {
  teacher:              ["coordinator","principal","accounts_officer","admissions_counselor","compliance_officer"],
  coordinator:          ["teacher","principal","accounts_officer","admissions_counselor","compliance_officer"],
  principal:            ["teacher","coordinator","accounts_officer","admissions_counselor","compliance_officer"],
  accounts_officer:     ["teacher","coordinator","principal","admissions_counselor","compliance_officer"],
  admissions_counselor: ["teacher","coordinator","principal","accounts_officer","compliance_officer"],
  compliance_officer:   ["teacher","coordinator","principal","accounts_officer","admissions_counselor"],
}

interface Campus { id: number; campus_name: string; campus_code: string }
interface Level  { id: number; name: string; shift: string; shift_display: string }

// ─── Role Badge ────────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const cfg = ROLE_CONFIG[role]
  if (!cfg) return <span className="text-xs text-gray-500">{role}</span>
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  )
}

// ─── Step Indicator ────────────────────────────────────────────────────────────
function StepDot({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return (
    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
      ${done ? "text-white" : active ? "text-white ring-4 ring-[#2a4e78]/20" : "bg-gray-100 text-gray-400"}`}
      style={done || active ? { backgroundColor: '#2a4e78' } : {}}>
      {done ? <CheckCircle2 className="w-4 h-4" /> : n}
    </div>
  )
}

function StepBar({ step, needsExtra }: { step: string; needsExtra: boolean }) {
  const steps = needsExtra
    ? ["Select Role", "Assign", "Confirm"]
    : ["Select Role", "Confirm"]

  const currentIdx =
    step === "select_role" ? 0
    : step === "select_extra" ? 1
    : needsExtra ? 2 : 1

  return (
    <div className="flex items-center gap-0 px-6 py-3 bg-gray-50 border-b">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center gap-0 flex-1">
          <div className="flex flex-col items-center gap-1">
            <StepDot n={i+1} active={currentIdx === i} done={currentIdx > i} />
            <span className={`text-[10px] font-medium whitespace-nowrap`}
              style={{ color: currentIdx >= i ? '#2a4e78' : '#9ca3af' }}>
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mb-4 mx-1 rounded`}
              style={{ backgroundColor: currentIdx > i ? '#2a4e78' : '#e5e7eb' }} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Switch Role Modal ─────────────────────────────────────────────────────────
function SwitchRoleModal({ staff, onClose, onSuccess }: {
  staff: OrgStaffMember
  onClose: () => void
  onSuccess: (newCode: string, newRole: string) => void
}) {
  const [step, setStep] = useState<"select_role"|"select_extra"|"confirm">("select_role")
  const [selectedRole, setSelectedRole] = useState("")
  const [campuses, setCampuses] = useState<Campus[]>([])
  const [levels, setLevels] = useState<Level[]>([])
  const [selectedCampusId, setSelectedCampusId] = useState<number|null>(null)
  const [selectedLevelIds, setSelectedLevelIds] = useState<number[]>([])
  const [customCode, setCustomCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const needsCampus = selectedRole === "principal"
  const needsLevel  = false
  const needsExtra  = needsCampus

  const allowedRoles = SWITCHABLE_TO[staff.role] || []

  useEffect(() => {
    if (step !== "select_extra") return
    setLoading(true)
    ;(async () => {
      try {
        if (needsCampus) {
          const d = await getAllCampuses()
          setCampuses(Array.isArray(d) ? d : (d as any).results ?? [])
        }
        if (needsLevel) {
          const d = await getLevels()
          setLevels(Array.isArray(d) ? d : (d as any).results ?? [])
        }
      } catch { setError("Could not load data. Please try again.") }
      finally   { setLoading(false) }
    })()
  }, [step, selectedRole])

  const goToExtra = (role: string) => {
    setSelectedRole(role); setError("")
    if (role === "principal") setStep("select_extra")
    else setStep("confirm")
  }

  const goToConfirm = () => {
    if (needsCampus && !selectedCampusId) { setError("Please select a campus."); return }
    setStep("confirm"); setError("")
  }

  const confirm = async () => {
    setSubmitting(true); setError("")
    try {
      const opts: Record<string, any> = {}
      if (selectedCampusId)               opts.campus_id  = selectedCampusId
      if (selectedLevelIds.length > 0)    opts.level_ids  = selectedLevelIds
      if (customCode.trim())              opts.custom_code = customCode.trim()
      const result = await switchUserRole(staff.id, selectedRole, opts)
      onSuccess(result.new_employee_code, result.new_role)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Unexpected error.")
      setSubmitting(false)
    }
  }

  const fromCfg = ROLE_CONFIG[staff.role]
  const toCfg   = ROLE_CONFIG[selectedRole]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-slate-50 to-[#eef2f7]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#2a4e78' }}>
              <ArrowLeftRight className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Switch Role</h2>
              <p className="text-xs text-gray-500">{staff.full_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step bar */}
        <StepBar step={step} needsExtra={needsExtra && step !== "select_role"} />

        <div className="px-8 py-6">

          {/* ── Step 1 ── */}
          {step === "select_role" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
                {fromCfg && (() => { const Icon = fromCfg.icon; return <Icon className={`w-4 h-4 ${fromCfg.color}`} /> })()}
                <div>
                  <p className="text-xs text-gray-500">Current role</p>
                  <p className={`text-sm font-semibold ${fromCfg?.color}`}>{fromCfg?.label || staff.role}</p>
                </div>
                <span className="ml-auto font-mono text-xs bg-white border border-gray-200 px-2 py-1 rounded-lg text-gray-600">
                  {staff.employee_code}
                </span>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Select new role</p>
                <div className="grid grid-cols-2 gap-2">
                  {allowedRoles.map((role) => {
                    const cfg = ROLE_CONFIG[role]
                    if (!cfg) return null
                    const Icon = cfg.icon
                    return (
                      <button key={role} onClick={() => goToExtra(role)}
                        className={`flex items-center gap-2.5 px-3 py-3 rounded-xl border-2 text-left transition-all
                          hover:border-[#2a4e78]/30 hover:bg-[#2a4e78]/5 hover:shadow-sm
                          border-gray-150 bg-gray-50/50 group`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cfg.bg} ${cfg.border} border`}>
                          <Icon className={`w-4 h-4 ${cfg.color}`} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800 group-hover:text-[#2a4e78]">{cfg.label}</p>
                          {role === "principal" && <p className="text-[10px] text-gray-400">Needs campus</p>}
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-300 ml-auto group-hover:text-[#2a4e78]/60" />
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2 ── */}
          {step === "select_extra" && (
            <div className="space-y-4">
              <button onClick={() => { setStep("select_role"); setError("") }}
                className="flex items-center gap-1 text-xs text-[#2a4e78] hover:underline font-medium">
                ← Back to role selection
              </button>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin text-[#2a4e78]" />
                  <p className="text-sm">Loading options…</p>
                </div>
              ) : needsLevel ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-700">
                      Select Level(s) <span className="text-red-500">*</span>
                    </p>
                    {selectedLevelIds.length > 0 && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                        {selectedLevelIds.length} selected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">Which level(s) will this coordinator manage?</p>
                  <div className="border border-gray-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto divide-y divide-gray-50">
                    {levels.length === 0
                      ? <p className="text-sm text-gray-400 p-4 text-center">No levels found.</p>
                      : levels.map(l => {
                          const checked = selectedLevelIds.includes(l.id)
                          return (
                            <label key={l.id}
                              className={`w-full flex items-center gap-3 px-4 py-3 text-sm cursor-pointer transition-colors
                                ${checked ? "bg-purple-50" : "hover:bg-gray-50"}`}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setSelectedLevelIds(prev =>
                                    prev.includes(l.id) ? prev.filter(id => id !== l.id) : [...prev, l.id]
                                  )
                                }}
                                className="w-4 h-4 rounded border-gray-300 accent-[#2a4e78] flex-shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <span className={`font-medium ${checked ? "text-purple-800" : "text-gray-700"}`}>
                                  {l.name}
                                </span>
                              </div>
                              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0
                                ${l.shift === 'morning'  ? "bg-amber-50  text-amber-700  border-amber-200"
                                : l.shift === 'afternoon'? "bg-blue-50   text-blue-700   border-blue-200"
                                : l.shift === 'evening'  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                :                          "bg-gray-100  text-gray-600   border-gray-200"}`}>
                                {l.shift_display || l.shift}
                              </span>
                            </label>
                          )
                        })
                    }
                  </div>
                </div>
              ) : needsCampus ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-700">
                    Select Campus <span className="text-red-500">*</span>
                  </p>
                  <p className="text-xs text-gray-400">Which campus will this principal manage?</p>
                  <div className="border border-gray-200 rounded-xl overflow-hidden max-h-52 overflow-y-auto divide-y divide-gray-50">
                    {campuses.length === 0
                      ? <p className="text-sm text-gray-400 p-4 text-center">No campuses found.</p>
                      : campuses.map(c => (
                        <button key={c.id} onClick={() => setSelectedCampusId(c.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors
                            ${selectedCampusId === c.id
                              ? "bg-amber-50 text-amber-800 font-semibold"
                              : "hover:bg-gray-50 text-gray-700"}`}>
                          <Building2 className={`w-4 h-4 flex-shrink-0 ${selectedCampusId === c.id ? "text-amber-500" : "text-gray-400"}`} />
                          <span className="flex-1">{c.campus_name}</span>
                          <span className="text-xs text-gray-400 font-mono">{c.campus_code}</span>
                          {selectedCampusId === c.id && <CheckCircle2 className="w-4 h-4 text-amber-500" />}
                        </button>
                      ))
                    }
                  </div>
                </div>
              ) : null}

              {error && (
                <p className="flex items-center gap-1.5 text-xs text-red-600">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />{error}
                </p>
              )}

              <button onClick={goToConfirm}
                className="w-full py-2.5 bg-[#2a4e78] hover:bg-[#1e3a5c] text-white text-sm font-semibold rounded-xl transition-colors">
                Continue →
              </button>
            </div>
          )}

          {/* ── Step 3 ── */}
          {step === "confirm" && (
            <div className="space-y-4">
              <button onClick={() => { setStep(needsExtra ? "select_extra" : "select_role"); setError("") }}
                className="flex items-center gap-1 text-xs text-[#2a4e78] hover:underline font-medium">
                ← Go back
              </button>

              {/* Summary card */}
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Change Summary</p>
                </div>
                <div className="divide-y divide-gray-50">
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs text-gray-500">Staff member</span>
                    <span className="text-sm font-semibold text-gray-900">{staff.full_name}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs text-gray-500">Role change</span>
                    <div className="flex items-center gap-2">
                      <RoleBadge role={staff.role} />
                      <ArrowLeftRight className="w-3.5 h-3.5 text-gray-400" />
                      <RoleBadge role={selectedRole} />
                    </div>
                  </div>
                  <div className="px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Employee code</span>
                      <div className="flex items-center gap-2 text-xs font-mono">
                        <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded line-through">{staff.employee_code}</span>
                        <span className="text-gray-400">→</span>
                        <span className="bg-[#2a4e78]/10 text-[#2a4e78] border border-[#2a4e78]/20 px-2 py-0.5 rounded font-semibold">
                          {customCode.trim() || "auto-generated"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={customCode}
                        onChange={e => setCustomCode(e.target.value)}
                        placeholder="Leave blank for auto-generated code…"
                        className="flex-1 text-xs font-mono px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a4e78] bg-gray-50 placeholder:text-gray-300"
                      />
                      {customCode && (
                        <button onClick={() => setCustomCode("")} className="text-gray-300 hover:text-gray-500">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-400">Optional: enter a custom code, or leave blank to auto-generate.</p>
                  </div>
                  {selectedCampusId && (
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-xs text-gray-500">Campus</span>
                      <span className="text-sm font-medium text-gray-800">{campuses.find(c => c.id === selectedCampusId)?.campus_name}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  This staff member will be <strong>automatically logged out</strong> and must re-login to access their new role dashboard.
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}

              <button onClick={confirm} disabled={submitting}
                className="w-full py-3 bg-[#2a4e78] hover:bg-[#1e3a5c] disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-[#2a4e78]/20">
                {submitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Switching role…</>
                  : <><Sparkles className="w-4 h-4" /> Confirm Role Switch</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function StaffManagementPage() {
  const router = useRouter()
  const [staff, setStaff] = useState<OrgStaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState("")
  const [switchTarget, setSwitchTarget] = useState<OrgStaffMember|null>(null)
  const [openMenuId, setOpenMenuId] = useState<number|null>(null)
  const [menuPos, setMenuPos] = useState<{top: number; right: number} | null>(null)
  const [toast, setToast] = useState<{msg: string; code?: string; type?: "success"|"error"}|null>(null)

  useEffect(() => {
    const role = getCurrentUserRole()
    if (role && role !== "org_admin") router.replace("/admin")
  }, [router])

  const fetchStaff = useCallback(async () => {
    setLoading(true); setError("")
    try { setStaff(await getOrgStaff()) }
    catch (e) { setError(e instanceof ApiError ? e.message : "Failed to load staff.") }
    finally   { setLoading(false) }
  }, [])

  useEffect(() => { fetchStaff() }, [fetchStaff])

  const handleSuccess = (newCode: string, newRole: string) => {
    setSwitchTarget(null)
    setToast({ msg: `Role switched successfully! New employee code:`, code: newCode, type: "success" })
    setTimeout(() => setToast(null), 6000)
    fetchStaff()
  }

  const handleToggleActive = async (member: OrgStaffMember) => {
    setOpenMenuId(null)
    try {
      const res = await toggleUserActive(member.id)
      setToast({ msg: res.message, type: "success" })
      setTimeout(() => setToast(null), 4000)
      fetchStaff()
    } catch (e) {
      setToast({ msg: e instanceof ApiError ? e.message : "Failed to update status.", type: "error" })
      setTimeout(() => setToast(null), 4000)
    }
  }

  const filtered = staff.filter(s => {
    const q = searchQuery.toLowerCase()
    return (!q || s.full_name.toLowerCase().includes(q) || s.employee_code.toLowerCase().includes(q) || s.email.toLowerCase().includes(q))
      && (!roleFilter || s.role === roleFilter)
  })

  const ROLE_ORDER = ["org_admin","principal","coordinator","teacher","accounts_officer","admissions_counselor","compliance_officer"]
  const uniqueRoles  = Array.from(new Set(staff.map(s => s.role)))
  const roleCounts   = Object.fromEntries(uniqueRoles.map(r => [r, staff.filter(s => s.role === r).length]))
  const displayRoles = ROLE_ORDER.filter(r => r !== "org_admin" && uniqueRoles.includes(r))

  const formatLogin = (dt: string|null) => {
    if (!dt) return { date: "Never", time: "" }
    const d = new Date(dt)
    return {
      date: d.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" }),
      time: d.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" }),
    }
  }

  return (
    <div className="bg-[#f8f9fc] pb-10">
      <style dangerouslySetInnerHTML={{ __html: scrollbarStyles }} />
      {/* Modal */}
      {switchTarget && (
        <SwitchRoleModal staff={switchTarget} onClose={() => setSwitchTarget(null)} onSuccess={handleSuccess} />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-[100] flex items-center gap-3 bg-white shadow-xl rounded-2xl px-4 py-3 animate-in slide-in-from-right duration-300
          ${toast.type === "error" ? "border border-red-200" : "border border-emerald-200"}`}>
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0
            ${toast.type === "error" ? "bg-red-100" : "bg-emerald-100"}`}>
            {toast.type === "error"
              ? <XCircle className="w-4 h-4 text-red-600" />
              : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{toast.msg}</p>
            {toast.code && <p className="text-xs font-mono text-emerald-600 font-bold">{toast.code}</p>}
          </div>
          <button onClick={() => setToast(null)} className="ml-2 text-gray-300 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="p-4 md:p-6 space-y-5">

        {/* ── Header ── */}
        <div className="bg-gradient-to-br from-[#1a3a5c] to-[#2a5298] rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                <UserCog className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black">Staff Management</h1>
                <p className="text-blue-200 text-sm mt-0.5">Manage roles and access for your organization's staff</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-3xl font-black">{staff.length}</p>
                <p className="text-blue-200 text-xs">Total Staff</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Role Stats ── */}
        {displayRoles.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {displayRoles.map(role => {
              const cfg = ROLE_CONFIG[role]
              if (!cfg) return null
              const Icon = cfg.icon
              return (
                <button key={role} onClick={() => setRoleFilter(roleFilter === role ? "" : role)}
                  className={`p-3.5 rounded-xl border-2 text-left transition-all hover:shadow-md
                    ${roleFilter === role
                      ? `${cfg.bg} ${cfg.border} shadow-sm`
                      : "bg-white border-gray-100 hover:border-gray-200"}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${cfg.bg}`}>
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                  </div>
                  <p className="text-xl font-black text-gray-900">{roleCounts[role] || 0}</p>
                  <p className={`text-xs font-semibold ${roleFilter === role ? cfg.color : "text-gray-500"}`}>
                    {cfg.label}s
                  </p>
                </button>
              )
            })}
          </div>
        )}

        {/* ── Search + Filter ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search by name, employee code or email…"
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2a4e78] focus:bg-white transition-colors" />
          </div>
          {roleFilter && (
            <button onClick={() => setRoleFilter("")}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#2a4e78] bg-[#2a4e78]/8 border border-[#2a4e78]/20 rounded-xl hover:bg-[#2a4e78]/15">
              <X className="w-3 h-3" /> Clear filter
            </button>
          )}
          <button onClick={fetchStaff} disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors whitespace-nowrap">
            <RefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* ── Table ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          {loading ? (
            <div className="space-y-0 divide-y divide-gray-50">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4 animate-pulse">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-gray-100 rounded w-40" />
                    <div className="h-3 bg-gray-50 rounded w-28" />
                  </div>
                  <div className="h-7 w-24 bg-gray-100 rounded-full" />
                  <div className="h-4 w-20 bg-gray-50 rounded" />
                  <div className="h-4 w-16 bg-gray-50 rounded" />
                  <div className="h-4 w-12 bg-gray-50 rounded" />
                  <div className="h-8 w-28 bg-gray-100 rounded-xl" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-red-500">
              <XCircle className="w-10 h-10 opacity-50" />
              <p className="text-sm font-medium">{error}</p>
              <button onClick={fetchStaff} className="text-xs text-[#2a4e78] hover:underline">Try again</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
              <Users className="w-12 h-12 opacity-20" />
              <p className="font-medium text-sm">No staff found</p>
              {searchQuery && <p className="text-xs">Try a different search term</p>}
            </div>
          ) : (
            <>
              <div className={`overflow-x-auto ${filtered.length > 10 ? 'max-h-[850px] overflow-y-auto custom-scrollbar' : 'overflow-y-visible'}`}>
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-100">
                      <th className="px-6 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Staff Member</th>
                      <th className="px-4 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Employee Code</th>
                      <th className="px-4 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Role</th>
                      <th className="px-4 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider hidden md:table-cell">Campus</th>
                      <th className="px-4 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider hidden lg:table-cell">Last Login</th>
                      <th className="px-4 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map((member, index) => {
                      const canSwitch = !!SWITCHABLE_TO[member.role]?.length
                      const avatarColor = "bg-[#2a4e78]"
                      const initials = getInitials(member.full_name)
                      const login = formatLogin(member.last_login)
                      const isNearBottom = index >= filtered.length - 2 // kept for reference, dropdown now uses fixed pos

                      return (
                        <tr key={member.id} className="hover:bg-[#2a4e78]/5 transition-colors group">
                          {/* Staff Member */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full ${avatarColor} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                                {initials}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{member.full_name}</p>
                                <p className="text-xs text-gray-400">{member.email}</p>
                              </div>
                            </div>
                          </td>

                          {/* Code */}
                          <td className="px-4 py-4">
                            <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2.5 py-1.5 rounded-lg border border-gray-200">
                              {member.employee_code}
                            </span>
                          </td>

                          {/* Role */}
                          <td className="px-4 py-4">
                            <RoleBadge role={member.role} />
                          </td>

                          {/* Campus */}
                          <td className="px-4 py-4 hidden md:table-cell">
                            {member.campus_name ? (
                              <div className="flex items-center gap-1.5">
                                <div className="w-6 h-6 bg-[#2a4e78]/8 rounded-lg flex items-center justify-center flex-shrink-0">
                                  <Building2 className="w-3 h-3 text-[#2a4e78]" />
                                </div>
                                <span className="text-sm text-gray-700">{member.campus_name}</span>
                              </div>
                            ) : (
                              <span className="text-gray-300 text-sm">—</span>
                            )}
                          </td>

                          {/* Last Login */}
                          <td className="px-4 py-4 hidden lg:table-cell">
                            {login.date === "Never" ? (
                              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                                <Clock className="w-3 h-3" /> Never
                              </span>
                            ) : (
                              <div>
                                <p className="text-xs font-medium text-gray-800">{login.date}</p>
                                <p className="text-xs text-gray-400">{login.time}</p>
                              </div>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-4">
                            {member.is_active ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold">
                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-600 border border-red-200 rounded-full text-xs font-semibold">
                                <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                                Inactive
                              </span>
                            )}
                          </td>

                          {/* Action */}
                          <td className="px-4 py-4">
                            {member.role === 'org_admin' ? (
                              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                                <ShieldCheck className="w-3.5 h-3.5" /> Protected
                              </span>
                            ) : (
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    if (openMenuId === member.id) {
                                      setOpenMenuId(null); setMenuPos(null)
                                    } else {
                                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                                      const spaceBelow = window.innerHeight - rect.bottom
                                      const dropH = canSwitch ? 96 : 48
                                      setMenuPos(spaceBelow < dropH + 8
                                        ? { top: rect.top - dropH - 4, right: window.innerWidth - rect.right }
                                        : { top: rect.bottom + 4, right: window.innerWidth - rect.right }
                                      )
                                      setOpenMenuId(member.id)
                                    }
                                  }}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
                                  <MoreVertical className="w-4 h-4" />
                                </button>
                                {openMenuId === member.id && menuPos && (
                                  <>
                                    <div className="fixed inset-0 z-[998]" onClick={() => { setOpenMenuId(null); setMenuPos(null) }} />
                                    <div
                                      style={{ top: menuPos.top, right: menuPos.right }}
                                      className="fixed z-[999] w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 overflow-hidden">
                                      {canSwitch && (
                                        <button
                                          onClick={() => { setOpenMenuId(null); setMenuPos(null); setSwitchTarget(member) }}
                                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-[#2a4e78]/5 hover:text-[#2a4e78] transition-colors">
                                          <ArrowLeftRight className="w-4 h-4" />
                                          Switch Role
                                        </button>
                                      )}
                                      <button
                                        onClick={() => { setOpenMenuId(null); setMenuPos(null); handleToggleActive(member) }}
                                        className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors
                                          ${member.is_active
                                            ? "text-red-600 hover:bg-red-50"
                                            : "text-emerald-600 hover:bg-emerald-50"}`}>
                                        {member.is_active
                                          ? <><PowerOff className="w-4 h-4" /> Deactivate</>
                                          : <><Power className="w-4 h-4" /> Activate</>}
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="px-6 py-3 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  Showing <span className="font-semibold text-gray-600">{filtered.length}</span> of <span className="font-semibold text-gray-600">{staff.length}</span> staff members
                </p>
                {roleFilter && (
                  <span className={`text-xs font-semibold ${ROLE_CONFIG[roleFilter]?.color || "text-gray-600"}`}>
                    Filtered by: {ROLE_CONFIG[roleFilter]?.label || roleFilter}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
