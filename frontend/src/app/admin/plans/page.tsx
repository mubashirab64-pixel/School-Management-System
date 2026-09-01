"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Award, CheckCircle2, Globe, Users, Building2, ShieldCheck, RefreshCw, Layers, Plus, Edit2, Trash2, X, ChevronDown, DollarSign, Zap } from "lucide-react"

interface SubscriptionPlan {
  id: number
  name: string
  max_users: number
  max_students: number
  max_campuses: number
  price_per_student: number
  price_per_user: number
  base_price: number
  is_enterprise: boolean
  description: string
  is_active: boolean
  created_by: number | null
}

const API = `${process.env.NEXT_PUBLIC_API_BASE_URL}/api`

function getAuthHeader(): HeadersInit {
  if (typeof window === "undefined") return {}
  const token = localStorage.getItem("sis_access_token") || ""
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
}


function PlanModal({
  mode,
  initial,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit"
  initial?: SubscriptionPlan
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    max_users: initial?.max_users ?? 30,
    max_students: initial?.max_students ?? 200,
    max_campuses: initial?.max_campuses ?? 20,
    price_per_student: initial?.price_per_student ?? 40,
    price_per_user: initial?.price_per_user ?? 0,
    base_price: initial?.base_price ?? 8000,
    is_enterprise: initial?.is_enterprise ?? false,
    description: initial?.description ?? "",
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof typeof form, v: any) =>
    setForm(prev => {
      const next = { ...prev, [k]: v };
      if (k === "max_students" || k === "price_per_student" || k === "is_enterprise") {
        const calcBasis = next.is_enterprise ? 5000 : next.max_students;
        next.base_price = calcBasis * next.price_per_student;
      }
      return next;
    })

  // Auto-calculate base price
  useEffect(() => {
    const perStudent = Number(form.price_per_student) || 0
    let calculatedNum = 0

    if (form.is_enterprise) {
      // Enterprise pricing is ALWAYS based on 5000 students minimum commitment
      calculatedNum = parseFloat((5000 * perStudent).toFixed(2))
    } else {
      // Standard pricing is based on the student quota
      const students = Number(form.max_students) || 0
      calculatedNum = parseFloat((students * perStudent).toFixed(2))
    }
    
    if (form.base_price !== calculatedNum) {
      set("base_price", calculatedNum)
    }
  }, [form.max_students, form.price_per_student, form.is_enterprise])

  // Enterprise specific defaults (triggered only on toggle)
  useEffect(() => {
     if (form.is_enterprise) {
       setForm(prev => ({
         ...prev,
         max_students: 999999,
         max_users: 300,
         max_campuses: 20,
         price_per_student: 15,
       }))
     }
  }, [form.is_enterprise])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      let url = `${API}/plans/`
      let method = "POST"

      if (mode === "edit") {
        url = `${API}/plans/${initial?.id}/`
        method = "PATCH"
      }

      const res = await fetch(url, {
        method,
        headers: getAuthHeader(),
        body: JSON.stringify(form)
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || "Failed to save plan")
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving plan")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
          <div>
            <h2 className="text-xl font-black text-gray-900">{mode === "create" ? "Add New Package" : "Edit Package"}</h2>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-tight">Subscription Configuration</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={submit} className="p-8 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-4">
               <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">Package Name</label>
                <input
                  required
                  placeholder="e.g. Starter, Pro, Mega"
                  value={form.name}
                  onChange={e => set("name", e.target.value)}
                  className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-[#2a4e78]/10 transition-all font-semibold"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Students", key: "max_students" as const, icon: <Users className="w-4 h-4 text-emerald-500" /> },
                  { label: "Users", key: "max_users" as const, icon: <ShieldCheck className="w-4 h-4 text-blue-500" /> },
                  { label: "Campuses", key: "max_campuses" as const, icon: <Building2 className="w-4 h-4 text-purple-500" /> },
                ].map(({ label, key, icon }) => (
                  <div key={key}>
                    <label className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase tracking-tighter mb-2 ml-1">
                      {icon}{label}
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={form[key]}
                      onChange={e => set(key, parseInt(e.target.value) || 1)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-center font-bold focus:outline-none focus:ring-4 focus:ring-[#2a4e78]/10 bg-gray-50/30"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">Description (Internal)</label>
                <textarea
                  placeholder="Briefly describe who this plan is for..."
                  value={form.description}
                  onChange={e => set("description", e.target.value)}
                  rows={3}
                  className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-[#2a4e78]/10 transition-all font-medium resize-none italic"
                />
              </div>
            </div>

            <div className="space-y-4 bg-blue-50/30 p-6 rounded-[2rem] border border-blue-100/50">
               <div>
                  <label className="block text-xs font-bold text-[#2a4e78] uppercase tracking-wider mb-6 ml-1 flex items-center gap-2">
                    <Zap className="w-4 h-4" /> Pricing Model (PKR)
                  </label>
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between items-center mb-2 px-1">
                         <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Rate Per Student</span>
                         <span className="text-[10px] font-black text-emerald-600">SCALABLE</span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-emerald-600">PKR</span>
                        <input
                          type="number" step="0.01" required
                          placeholder="0.00"
                          value={form.price_per_student}
                          onChange={e => set("price_per_student", e.target.value)}
                          className="w-full pl-12 border border-gray-100 rounded-2xl py-3 text-sm font-black focus:outline-none focus:ring-4 focus:ring-emerald-500/10 bg-white"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2 px-1">
                         <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Base Monthly Fee</span>
                         <span className="text-[10px] font-black text-blue-600">FIXED</span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#2a4e78]">PKR</span>
                        <input
                          type="number" step="0.01" required
                          placeholder="0.00"
                          value={form.base_price}
                          onChange={e => set("base_price", e.target.value)}
                          className="w-full pl-12 border border-gray-100 rounded-2xl py-3 text-sm font-black focus:outline-none focus:ring-4 focus:ring-[#2a4e78]/10 bg-white"
                        />
                      </div>
                    </div>
                  </div>
               </div>

               <div className="pt-4">
                  <label className="flex items-center gap-3 cursor-pointer p-5 bg-white rounded-[1.5rem] border border-blue-100 group hover:border-[#2a4e78] transition-colors">
                    <input
                      type="checkbox"
                      checked={form.is_enterprise}
                      onChange={e => set("is_enterprise", e.target.checked)}
                      className="w-5 h-5 rounded-lg border-2 border-blue-200 text-[#2a4e78] focus:ring-offset-0 focus:ring-0"
                    />
                    <div>
                      <span className="block text-xs font-black text-gray-800 uppercase leading-none mb-1">Enterprise Package</span>
                      <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-widest leading-none">Custom Quotas Enabled</span>
                    </div>
                  </label>
               </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3.5 rounded-2xl border border-gray-100 text-sm font-bold text-gray-500 hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-[2] bg-[#2a4e78] text-white px-6 py-3.5 rounded-2xl text-sm font-black hover:bg-[#1a3e68] transition-all shadow-xl shadow-blue-900/10 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              {mode === "create" ? "Create Package" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────────
export default function PlansPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modal State
  const [modal, setModal] = useState<{ show: boolean, mode: "create" | "edit", initial?: SubscriptionPlan }>({
    show: false,
    mode: "create"
  })
  
  const [activeTab, setActiveTab] = useState<"system" | "custom">("system")
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const u = localStorage.getItem("sis_user")
      if (u) setUser(JSON.parse(u))
    }
  }, [])

  async function fetchPlans() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/plans/`, { headers: getAuthHeader() })
      if (!res.ok) throw new Error("Failed to fetch plans")
      const data = await res.json()
      setPlans(Array.isArray(data) ? data : data.results ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error")
    } finally {
      setLoading(false)
    }
  }

  async function deletePlan(id: number) {
    if (!confirm("Are you SURE you want to delete this plan? This cannot be undone.")) return
    try {
      const res = await fetch(`${API}/plans/${id}/`, {
        method: "DELETE",
        headers: getAuthHeader()
      })
      if (!res.ok) throw new Error("Failed to delete plan")
      setPlans(prev => prev.filter(p => p.id !== id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error deleting plan")
    }
  }

  useEffect(() => {
    fetchPlans()
  }, [])

  const systemPlans = plans.filter(p => p.created_by === null)
  const customPlans = plans.filter(p => p.created_by !== null)
  const currentPlans = activeTab === "system" ? systemPlans : customPlans

  if (loading && plans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <RefreshCw className="w-8 h-8 animate-spin mb-4 text-[#2a4e78]" />
        <p className="font-medium animate-pulse">Loading subscription packages…</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-8 animate-in fade-in duration-500">
      {/* Header section */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#2a4e78]/10 rounded-2xl">
              <Award className="w-6 h-6 text-[#2a4e78]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">Subscription Packages</h1>
              <p className="text-sm text-gray-500 font-medium">Manage and view platform-wide service tiers</p>
            </div>
          </div>
        </div>

        {user?.role === 'admin' && (
          <button
            onClick={() => setModal({ show: true, mode: "create" })}
            className="bg-[#2a4e78] text-white px-6 py-3 rounded-2xl text-sm font-black hover:bg-[#1a3e68] transition-all shadow-lg flex items-center gap-2 active:scale-95"
          >
            <Plus className="w-5 h-5" /> Add New Package
          </button>
        )}
        {user?.role === 'superadmin' && (
           <button
           onClick={() => setModal({ show: true, mode: "create" })}
           className="bg-emerald-600 text-white px-6 py-3 rounded-2xl text-sm font-black hover:bg-emerald-700 transition-all shadow-lg flex items-center gap-2 active:scale-95"
         >
           <Plus className="w-5 h-5" /> Add System Package
         </button>
        )}
      </div>

      {(user?.role === 'admin' || user?.role === 'superadmin') && (
        <div className="flex p-1 bg-gray-100 rounded-2xl w-fit mb-4">
          <button
            onClick={() => setActiveTab("system")}
            className={`px-6 py-2 rounded-xl text-xs font-black uppercase transition-all ${activeTab === "system" ? 'bg-white text-[#2a4e78] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            System Packages
          </button>
          <button
            onClick={() => setActiveTab("custom")}
            className={`px-6 py-2 rounded-xl text-xs font-black uppercase transition-all ${activeTab === "custom" ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {user?.role === 'superadmin' ? 'Partner Custom Packages' : 'My Custom Packages'}
          </button>
        </div>
      )}

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center max-w-2xl mx-auto">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-6 h-6 text-red-600" />
          </div>
          <h3 className="text-lg font-bold text-red-800 mb-2">Connection Issue</h3>
          <p className="text-red-600 text-sm mb-6">{error}. This usually happens if the backend services need a restart.</p>
          <button
            onClick={fetchPlans}
            className="bg-red-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-700 transition-all shadow-sm"
          >
            Retry Connection
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {currentPlans.map((plan) => (
            <div
              key={plan.id}
              className={`group bg-white rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col relative ${
                plan.is_enterprise ? 'ring-2 ring-[#2a4e78] ring-offset-4' : ''
              }`}
            >
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setModal({ show: true, mode: "edit", initial: plan })}
                  className="p-2 bg-white/90 backdrop-blur-sm border border-gray-100 rounded-xl text-blue-600 shadow-sm hover:bg-blue-50 transition-all font-bold"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deletePlan(plan.id)}
                  className="p-2 bg-white/90 backdrop-blur-sm border border-gray-100 rounded-xl text-red-600 shadow-sm hover:bg-red-50 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="p-8 pb-4">
                <div className="flex items-center justify-between mb-4 pr-16 lg:pr-0">
                  <div className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                    plan.created_by === null ? 'bg-gray-100 text-gray-600' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {plan.created_by === null ? 'System Tier' : 'My Custom Tier'}
                  </div>
                  {plan.is_enterprise && (
                    <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                      <Zap className="w-3.5 h-3.5 fill-current" />
                    </div>
                  )}
                </div>
                
                <h3 className="text-3xl font-black text-gray-900 mb-2 truncate" title={plan.name}>{plan.name}</h3>
                
                <div className="flex items-baseline gap-1 mt-4 mb-2">
                   <span className="text-4xl font-black text-[#2a4e78] tracking-tighter">Rs.{plan.base_price}</span>
                   <span className="text-xs font-bold text-gray-400 uppercase">/month</span>
                </div>

                <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100/50 mb-6">
                   <div className="flex justify-between items-center mb-1">
                      <span className="text-[9px] font-black text-emerald-700 uppercase tracking-widest leading-none">Scalable Rate</span>
                      <Users className="w-3 h-3 text-emerald-500" />
                   </div>
                   <div className="flex items-baseline gap-1">
                      <span className="text-xl font-black text-emerald-900 leading-none">Rs.{plan.price_per_student}</span>
                      <span className="text-[10px] font-bold text-emerald-600/70 uppercase">/ Per Student</span>
                   </div>
                </div>

                <div className="space-y-3 pt-6 border-t border-gray-50">
                  <div className="flex items-center justify-between opacity-80">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                        <Users className="w-3.5 h-3.5 text-emerald-600" />
                      </div>
                      <span className="text-xs font-medium text-gray-500">Students Max</span>
                    </div>
                    <span className="text-xs font-bold text-gray-900">
                      {plan.max_students >= 999999 ? "Unlimited" : plan.max_students.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between opacity-80">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                      </div>
                      <span className="text-xs font-medium text-gray-500">User Seats</span>
                    </div>
                    <span className="text-xs font-bold text-gray-900">{plan.max_users}</span>
                  </div>

                  <div className="flex items-center justify-between opacity-80">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
                        <Building2 className="w-3.5 h-3.5 text-purple-600" />
                      </div>
                      <span className="text-xs font-medium text-gray-500">Campuses</span>
                    </div>
                    <span className="text-xs font-bold text-gray-900">
                      {plan.max_campuses >= 999 ? "Unlimited" : plan.max_campuses}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-auto p-6 bg-gray-50/50 flex items-center justify-center border-t border-gray-100">
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 group-hover:text-[#2a4e78] transition-colors uppercase tracking-widest">
                  <Layers className="w-4 h-4" /> Platform Billing Policy
                </div>
              </div>
            </div>
          ))}
        </div>
      )}


      {/* Modal Render */}
      {modal.show && (
        <PlanModal
          mode={modal.mode}
          initial={modal.initial}
          onClose={() => setModal({ show: false, mode: "create" })}
          onSaved={() => {
            setModal({ show: false, mode: "create" })
            fetchPlans()
          }}
        />
      )}
    </div>
  )
}
