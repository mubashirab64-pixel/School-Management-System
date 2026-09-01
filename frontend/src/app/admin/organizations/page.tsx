"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Globe, Plus, Search, Edit2, Trash2, Users, BookOpen,
  Building2, RefreshCw, CheckCircle2, XCircle, ChevronUp, ChevronDown, X, Eye, EyeOff, ShieldCheck,
  Layers, Zap, Banknote, FileText, CalendarDays, ArrowRightLeft,
  ClipboardList, CheckSquare, Fingerprint, type LucideIcon,
} from "lucide-react"
import { FEATURES, getDefaultFeatures } from "@/config/features"

const FEATURE_ICONS: Record<string, LucideIcon> = {
  staff_management: Users,
  academic_structure: Building2,
  fees_management: Banknote,
  result_management: FileText,
  student_attendance: CheckSquare,
  staff_attendance: Fingerprint,
  timetable: CalendarDays,
  transfers: ArrowRightLeft,
  support_desk: ClipboardList,
  subject_assignment: BookOpen,
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Organization {
  id: number
  name: string
  subdomain: string | null
  max_users: number
  max_students: number
  max_campuses: number
  is_active: boolean
  created_at: string
  updated_at: string
  used_users: number
  used_students: number
  used_campuses: number
  enabled_features: Record<string, boolean>
}

interface SubscriptionPlan {
  id: number
  name: string
  max_users: number
  max_students: number
  max_campuses: number
  description: string
}

interface CreateOrgPayload {
  name: string
  subdomain: string
  plan: number | null
  max_users: number
  max_students: number
  max_campuses: number
  admin_email: string
  admin_password: string
  admin_full_name: string
  enabled_features: Record<string, boolean>
  is_active?: boolean
}

function getAuthHeader(): HeadersInit {
  if (typeof window === "undefined") return {}
  const token = localStorage.getItem("sis_access_token") || ""
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
}

const API = `${process.env.NEXT_PUBLIC_API_BASE_URL}/api`

function QuotaBar({ used, max, color }: { used: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(Math.round((used / max) * 100), 100) : 0
  const barColor =
    pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-400" : `bg-${color}-500`
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{used.toLocaleString()} / {max.toLocaleString()}</span>
        <span className={pct >= 90 ? "text-red-600 font-semibold" : ""}>{pct}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function OrgModal({
  mode,
  initial,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit"
  initial?: Organization
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<CreateOrgPayload>({
    name: initial?.name ?? "",
    subdomain: initial?.subdomain ?? "",
    plan: (initial as any)?.plan ?? null,
    max_users: initial?.max_users ?? 30,
    max_students: initial?.max_students ?? 200,
    max_campuses: initial?.max_campuses ?? 20,
    admin_email: "",
    admin_password: "",
    admin_full_name: "",
    enabled_features: initial?.enabled_features ?? getDefaultFeatures(),
    is_active: initial?.is_active ?? true,
  })
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loadingPlans, setLoadingPlans] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof CreateOrgPayload, v: any) =>
    setForm(prev => ({ ...prev, [k]: v }))

  useEffect(() => {
    async function fetchPlans() {
      setLoadingPlans(true)
      try {
        const res = await fetch(`${API}/plans/`, { headers: getAuthHeader() })
        const data = await res.json()
        setPlans(Array.isArray(data) ? data : data.results ?? [])
      } catch (err) {
        console.error("Failed to fetch plans", err)
      } finally {
        setLoadingPlans(false)
      }
    }
    fetchPlans()
  }, [])

  const selectedPlan = plans.find(p => p.id === form.plan)

  const handlePlanChange = (planId: number) => {
    const plan = plans.find(p => p.id === planId)
    if (plan) {
      setForm(prev => ({
        ...prev,
        plan: planId,
        max_users: plan.max_users,
        max_students: plan.max_students,
        max_campuses: plan.max_campuses,
      }))
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      let url = `${API}/organizations/`
      let method = "POST"
      let body: Partial<CreateOrgPayload> = { ...form }

      if (mode === "edit" && initial) {
        url = `${API}/organizations/${initial.id}/`
        method = "PATCH"
        body = {
          name: form.name,
          subdomain: form.subdomain,
          plan: form.plan,
          max_users: form.max_users,
          max_students: form.max_students,
          max_campuses: form.max_campuses,
          enabled_features: form.enabled_features,
          is_active: form.is_active,
        }
      }

      const res = await fetch(url, {
        method,
        headers: getAuthHeader(),
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(Object.values(data).flat().join(" ") || "Request failed")
      }
      onSaved()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-8 border-b border-gray-50 bg-gray-50/50">
          <div>
            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <Globe className="w-6 h-6 text-[#6096ba]" />
              {mode === "create" ? "Provision New Organization" : `Manage — ${initial?.name}`}
            </h2>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-tight mt-1">Platform Tenant Configuration</p>
          </div>
          <button onClick={onClose} className="p-2.5 rounded-full hover:bg-white transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={submit} className="p-8 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-10">
            {/* Left Column: Organization & Admin Info */}
            <div className="space-y-6">
               <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1.5 h-4 bg-[#6096ba] rounded-full" />
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Core Identity</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2 ml-1">Organization Name</label>
                    <input
                      required
                      value={form.name}
                      onChange={e => set("name", e.target.value)}
                      placeholder="e.g. Al-Khair School System"
                      className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-[#6096ba]/10 transition-all font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2 ml-1">Platform Subdomain</label>
                    <div className="relative">
                       <input
                        value={form.subdomain}
                        onChange={e => set("subdomain", e.target.value)}
                        placeholder="alkhair"
                        className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-[#6096ba]/10 transition-all font-semibold pr-32"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400 uppercase tracking-tighter">.iak.ngo</div>
                    </div>
                  </div>
               </div>

               {mode === "create" && (
                <div className="space-y-4 pt-4 border-t border-gray-50">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1.5 h-4 bg-blue-500 rounded-full" />
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Root Administrator</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2 ml-1">Admin Full Name</label>
                    <input
                      required
                      value={form.admin_full_name}
                      onChange={e => set("admin_full_name", e.target.value)}
                      placeholder="e.g. Rahat Ali"
                      className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none font-semibold bg-gray-50/50"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2 ml-1">Email ID</label>
                      <input
                        required
                        type="email"
                        value={form.admin_email}
                        onChange={e => set("admin_email", e.target.value)}
                        placeholder="admin@system.com"
                        className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none font-semibold bg-gray-50/50"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2 ml-1">Password</label>
                      <div className="relative">
                        <input
                          required
                          type={showPass ? "text" : "password"}
                          value={form.admin_password}
                          onChange={e => set("admin_password", e.target.value)}
                          placeholder="••••••••"
                          className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none font-semibold bg-gray-50/50 pr-10"
                        />
                        <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                          {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
               )}

               {/* Feature Modules */}
               <div className="space-y-4 pt-6 border-t border-gray-50">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1.5 h-4 bg-indigo-500 rounded-full" />
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Feature Modules</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {FEATURES.map(feat => {
                      const Icon = FEATURE_ICONS[feat.key] ?? ShieldCheck
                      const enabled = form.enabled_features[feat.key] ?? false
                      return (
                        <label key={feat.key} className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer shadow-sm
                          ${enabled ? "bg-white border-blue-100" : "bg-white border-gray-100 opacity-60"}`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`p-2 rounded-xl flex-shrink-0 ${enabled ? "bg-blue-50 text-blue-600" : "bg-gray-100 text-gray-400"}`}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <span className={`text-[11px] font-black uppercase tracking-tight block truncate ${enabled ? "text-gray-900" : "text-gray-400"}`}>{feat.label}</span>
                              <span className="text-[9px] text-gray-400 leading-tight block truncate">{feat.description}</span>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded-md border-gray-300 text-[#6096ba] focus:ring-[#6096ba] flex-shrink-0 ml-2"
                            checked={enabled}
                            onChange={e => set("enabled_features", { ...form.enabled_features, [feat.key]: e.target.checked })}
                          />
                        </label>
                      )
                    })}
                  </div>
               </div>
            </div>

            {/* Right Column: Plan & Limits */}
            <div className="space-y-6 bg-blue-50/30 p-8 rounded-[2.5rem] border border-blue-100/50">
               <div className="space-y-4">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs font-black text-[#6096ba] uppercase tracking-widest">Pricing & Limits</p>
                    {loadingPlans && <RefreshCw className="w-4 h-4 animate-spin text-[#6096ba]" />}
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2 ml-1">Active Subscription Plan</label>
                    <div className="relative">
                      <select
                        required
                        value={form.plan ?? ""}
                        onChange={e => handlePlanChange(parseInt(e.target.value))}
                        className="w-full border border-gray-200 rounded-2xl px-5 py-4 text-sm font-black text-[#6096ba] bg-white appearance-none focus:outline-none focus:ring-4 focus:ring-[#6096ba]/10 transition-all shadow-sm"
                      >
                        <option value="" disabled>Select a plan to apply limits...</option>
                        {plans.map(p => (
                          <option key={p.id} value={p.id}>{p.name} Tier</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  {selectedPlan ? (
                    <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 border border-blue-100 shadow-sm space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                       <div className="grid grid-cols-3 gap-6">
                          <div className="text-center">
                             <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto mb-2 text-emerald-600">
                                <Users className="w-5 h-5" />
                             </div>
                             <p className="text-[9px] font-black text-gray-400 uppercase">Students</p>
                             <p className="text-sm font-black text-gray-900">{selectedPlan.max_students >= 999999 ? "∞" : selectedPlan.max_students.toLocaleString()}</p>
                          </div>
                          <div className="text-center border-x border-gray-100 px-2">
                             <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-2 text-blue-600">
                                <ShieldCheck className="w-5 h-5" />
                             </div>
                             <p className="text-[9px] font-black text-gray-400 uppercase">Users</p>
                             <p className="text-sm font-black text-gray-900">{selectedPlan.max_users}</p>
                          </div>
                          <div className="text-center">
                             <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center mx-auto mb-2 text-purple-600">
                                <Building2 className="w-5 h-5" />
                             </div>
                             <p className="text-[9px] font-black text-gray-400 uppercase">Campuses</p>
                             <p className="text-sm font-black text-gray-900">{selectedPlan.max_campuses >= 999 ? "∞" : selectedPlan.max_campuses}</p>
                          </div>
                       </div>
                       
                       <div className="pt-4 border-t border-gray-50 flex items-center justify-center">
                          <div className="flex items-center gap-2 text-[9px] font-black text-blue-400 uppercase tracking-widest">
                             <Layers className="w-4 h-4" /> Policy Enforcement Enabled
                          </div>
                       </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-blue-100 rounded-3xl p-10 flex flex-col items-center justify-center text-center opacity-40">
                       <Zap className="w-8 h-8 text-[#6096ba] mb-3" />
                       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Select a plan to view<br/>resource quotas</p>
                    </div>
                  )}
               </div>


               {/* Status Toggle */}
               <div className="pt-4 border-t border-blue-100/50">
                  <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-blue-100 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${form.is_active ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                        {form.is_active ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-[#6096ba]">Organization Status</p>
                        <p className="text-[10px] font-bold text-gray-400">Current state: {form.is_active ? "ACTIVE" : "INACTIVE"}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => set("is_active", !form.is_active)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                        ${form.is_active ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"}`}
                    >
                      {form.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
               </div>
            </div>
          </div>

          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold flex items-center gap-2">
              <XCircle className="w-4 h-4" /> {error}
            </div>
          )}

          <div className="flex gap-4 pt-8">
            <button type="button" onClick={onClose} className="flex-1 px-8 py-4 rounded-2xl border border-gray-100 text-sm font-black text-gray-400 hover:bg-gray-50 transition-all uppercase tracking-widest">Cancel</button>
            <button
              type="submit"
              disabled={saving}
              className="flex-[2] bg-[#6096ba] text-white rounded-2xl py-4 text-sm font-black hover:bg-[#4a7ba0] disabled:opacity-60 transition-all shadow-xl shadow-[#6096ba]/20 active:scale-[0.98] transition-all uppercase tracking-widest cursor-pointer"
            >
              {saving ? "Provisioning..." : mode === "create" ? "Provision Organization" : "Commit Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [modal, setModal] = useState<{ mode: "create" | "edit"; org?: Organization } | null>(null)
  const [toggleTarget, setToggleTarget] = useState<Organization | null>(null)
  const [toggling, setToggling] = useState(false)
  const [sortKey, setSortKey] = useState<"name" | "created_at" | "used_students">("created_at")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null)

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/organizations/`, { headers: getAuthHeader() })
      const data = await res.json()
      setOrgs(Array.isArray(data) ? data : data.results ?? [])
    } catch {
      showToast("Failed to load organizations", "error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleActive() {
    if (!toggleTarget) return
    setToggling(true)
    try {
      const res = await fetch(`${API}/organizations/${toggleTarget.id}/`, {
        method: "PATCH",
        headers: getAuthHeader(),
        body: JSON.stringify({ is_active: !toggleTarget.is_active })
      })
      if (!res.ok) throw new Error()
      showToast(`"${toggleTarget.name}" is now ${!toggleTarget.is_active ? "Active" : "Inactive"}`)
      setToggleTarget(null)
      load()
    } catch {
      showToast("Failed to update status", "error")
    } finally {
      setToggling(false)
    }
  }

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("asc") }
  }

  const filtered = orgs
    .filter(o => o.name.toLowerCase().includes(search.toLowerCase()) ||
      (o.subdomain ?? "").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let res = 0
      if (sortKey === "name") res = a.name.localeCompare(b.name)
      if (sortKey === "created_at") res = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      if (sortKey === "used_students") res = a.used_students - b.used_students
      return sortDir === "asc" ? res : -res
    })

  function SortIcon({ k }: { k: typeof sortKey }) {
    if (sortKey !== k) return <ChevronUp className="w-3.5 h-3.5 text-gray-300" />
    return sortDir === "asc"
      ? <ChevronUp className="w-3.5 h-3.5 text-[#6096ba]" />
      : <ChevronDown className="w-3.5 h-3.5 text-[#6096ba]" />
  }

  return (
    <div className="min-h-screen">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-[100] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all
          ${toast.type === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>
          {toast.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Globe className="w-6 h-6 text-[#6096ba]" /> Organizations
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage all client organizations and their quota limits
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-2.5 border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setModal({ mode: "create" })}
            className="flex items-center gap-2 bg-[#6096ba] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#1e3a5c] transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> New Organization
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Orgs", value: orgs.length, color: "text-[#6096ba]", bg: "bg-blue-50" },
          { label: "Active", value: orgs.filter(o => o.is_active).length, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Total Students", value: orgs.reduce((s, o) => s + o.used_students, 0).toLocaleString(), color: "text-purple-600", bg: "bg-purple-50" },
          { label: "Total Users", value: orgs.reduce((s, o) => s + o.used_users, 0).toLocaleString(), color: "text-amber-600", bg: "bg-amber-50" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-2xl px-4 py-3`}>
            <p className="text-xs text-gray-500">{label}</p>
            <p className={`text-xl font-bold mt-0.5 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or subdomain…"
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6096ba]/30"
        />
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Globe className="w-10 h-10 mb-3 opacity-30" />
            <p className="font-medium">No organizations found</p>
            <p className="text-sm mt-1">Create your first organization to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-left">
                  <th className="px-5 py-3 font-semibold text-gray-600">
                    <button onClick={() => toggleSort("name")} className="flex items-center gap-1 hover:text-[#6096ba] transition-colors">
                      Organization <SortIcon k="name" />
                    </button>
                  </th>
                  <th className="px-5 py-3 font-semibold text-gray-600 hidden md:table-cell">
                    <button onClick={() => toggleSort("used_students")} className="flex items-center gap-1 hover:text-[#6096ba] transition-colors">
                      Students <SortIcon k="used_students" />
                    </button>
                  </th>
                  <th className="px-5 py-3 font-semibold text-gray-600 hidden lg:table-cell">Users</th>
                  <th className="px-5 py-3 font-semibold text-gray-600 hidden lg:table-cell">Campuses</th>
                  <th className="px-5 py-3 font-semibold text-gray-600 hidden sm:table-cell">
                    <button onClick={() => toggleSort("created_at")} className="flex items-center gap-1 hover:text-[#6096ba] transition-colors">
                      Created <SortIcon k="created_at" />
                    </button>
                  </th>
                  <th className="px-5 py-3 font-semibold text-gray-600">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(org => (
                  <tr key={org.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-4 text-xs">
                      <p className="font-bold text-gray-800">{org.name}</p>
                      {org.subdomain && <p className="text-gray-400 font-medium">{org.subdomain}</p>}
                      <div className="mt-1 flex items-center gap-1.5">
                         <span className="bg-blue-50 text-[#6096ba] px-2 py-0.5 rounded-md font-black uppercase text-[9px] border border-blue-100">
                            {(org as any).plan_name || "No Plan"}
                         </span>
                         {(org as any).plan_details?.base_price && (
                            <span className="text-emerald-600 font-bold text-[10px]">
                               Rs.{(org as any).plan_details.base_price}
                            </span>
                         )}
                      </div>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell min-w-[140px]">
                      <QuotaBar used={org.used_students} max={org.max_students} color="emerald" />
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell min-w-[130px]">
                      <QuotaBar used={org.used_users} max={org.max_users} color="blue" />
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell min-w-[130px]">
                      <QuotaBar used={org.used_campuses} max={org.max_campuses} color="purple" />
                    </td>
                    <td className="px-5 py-4 hidden sm:table-cell text-gray-500 text-xs whitespace-nowrap">
                      {new Date(org.created_at).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold
                        ${org.is_active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                        {org.is_active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {org.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setModal({ mode: "edit", org })}
                          className="p-1.5 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setToggleTarget(org)}
                          className={`p-1.5 rounded-lg transition-colors ${org.is_active ? "text-gray-400 hover:bg-red-50 hover:text-red-600" : "text-emerald-500 hover:bg-emerald-50"}`}
                          title={org.is_active ? "Deactivate" : "Activate"}
                        >
                          {org.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Components */}
      {modal && (
        <OrgModal
          mode={modal.mode}
          initial={modal.org}
          onClose={() => setModal(null)}
          onSaved={() => { showToast(modal.mode === "create" ? "Organization created!" : "Changes saved!"); load() }}
        />
      )}

      {/* Confirmation Dialogs */}
      {toggleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${toggleTarget.is_active ? "bg-red-100" : "bg-emerald-100"}`}>
                {toggleTarget.is_active ? <XCircle className="w-5 h-5 text-red-600" /> : <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
              </div>
              <div>
                <h3 className="font-bold text-gray-800">{toggleTarget.is_active ? "Deactivate" : "Activate"} Organization?</h3>
                <p className="text-sm text-gray-500">{toggleTarget.name}</p>
              </div>
            </div>
            <p className={`text-sm rounded-xl px-4 py-3 mb-5 ${toggleTarget.is_active ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"}`}>
              {toggleTarget.is_active 
                ? "⚠️ Deactivating will prevent ALL users of this organization from logging in and accessing their portal."
                : "✅ Activating will restore access for all users of this organization."}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setToggleTarget(null)}
                className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={toggleActive}
                disabled={toggling}
                className={`flex-1 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60 transition-colors
                  ${toggleTarget.is_active ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
              >
                {toggling ? "Updating…" : toggleTarget.is_active ? "Deactivate Now" : "Activate Now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
