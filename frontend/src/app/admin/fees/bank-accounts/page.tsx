"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { FeeTabs } from "../components/FeeTabs";
import { getApiBaseUrl } from "@/lib/api";
import { toast } from "sonner"

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
  if (res.status === 204) return null;
  return res.json();
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface BankAccount {
  id: number;
  bank_name: string;
  account_title: string;
  account_number: string;
  iban: string;
  is_active: boolean;
  created_at: string;
}

const EMPTY: Omit<BankAccount, "id" | "created_at"> = {
  bank_name: "",
  account_title: "",
  account_number: "",
  iban: "",
  is_active: true,
};

// ─── Bank Form Modal ──────────────────────────────────────────────────────────
function BankFormModal({
  initial,
  onSave,
  onClose,
  saving,
}: {
  initial?: Partial<BankAccount>;
  onSave: (data: typeof EMPTY) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({ ...EMPTY, ...initial });
  const set = (k: keyof typeof EMPTY, v: any) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-bold text-[#013a63] text-xl mb-5">
          {initial?.id ? "Edit Bank Account" : "Add Bank Account"}
        </h2>
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Bank Name *</label>
            <input
              type="text"
              value={form.bank_name}
              onChange={(e) => set("bank_name", e.target.value)}
              placeholder="e.g. Meezan Bank"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Account Title *</label>
            <input
              type="text"
              value={form.account_title}
              onChange={(e) => set("account_title", e.target.value)}
              placeholder="e.g. Al-Khair School"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Account Number *</label>
            <input
              type="text"
              value={form.account_number}
              onChange={(e) => set("account_number", e.target.value)}
              placeholder="e.g. 0123-4567890-1"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">IBAN (optional)</label>
            <input
              type="text"
              value={form.iban}
              onChange={(e) => set("iban", e.target.value)}
              placeholder="e.g. PK36MEZN0001234567890101"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => set("is_active", e.target.checked)}
              className="w-4 h-4 accent-[#013a63]"
            />
            <span className="text-sm font-medium text-slate-700">Active (show in challans)</span>
          </label>
        </div>
        <div className="flex gap-3 mt-6">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose}>Cancel</Button>
          <Button
            className="flex-1 rounded-xl bg-[#013a63] hover:bg-[#024a7a] text-white"
            onClick={() => {
              if (!form.bank_name.trim() || !form.account_title.trim() || !form.account_number.trim()) {
                toast.error("Bank Name, Account Title, and Account Number are required.");
                return;
              }
              onSave(form);
            }}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Bank Account"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BankAccountsPage() {
  const { toast } = useToast();
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<BankAccount | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/fees/banks/");
      setBanks(Array.isArray(data) ? data : (data?.results || []));
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(form: typeof EMPTY) {
    setSaving(true);
    try {
      if (editTarget) {
        const updated = await apiFetch(`/api/fees/banks/${editTarget.id}/`, {
          method: "PATCH",
          body: JSON.stringify(form),
        });
        setBanks((prev) => prev.map((b) => (b.id === editTarget.id ? updated : b)));
        toast({ title: "Bank updated successfully." });
      } else {
        const created = await apiFetch("/api/fees/banks/", {
          method: "POST",
          body: JSON.stringify(form),
        });
        setBanks((prev) => [...prev, created]);
        toast({ title: "Bank account added." });
      }
      setShowForm(false);
      setEditTarget(null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this bank account?")) return;
    setDeletingId(id);
    try {
      await apiFetch(`/api/fees/banks/${id}/`, { method: "DELETE" });
      setBanks((prev) => prev.filter((b) => b.id !== id));
      toast({ title: "Bank account deleted." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-3xl font-extrabold text-[#274c77] mb-2 tracking-wide flex items-center gap-3">
            <Building2 className="h-8 w-8 text-[#6096ba]" />
            Bank Accounts
          </h2>
          <p className="text-gray-600 text-lg">Manage bank accounts shown on student fee challans.</p>
        </div>
        <Button
          className="bg-[#274c77] hover:bg-[#1e3a5f] text-white rounded-xl gap-2 self-start md:self-end"
          onClick={() => { setEditTarget(null); setShowForm(true); }}
        >
          <Plus className="w-4 h-4" />
          Add Bank
        </Button>
      </div>

      <FeeTabs active="bank-accounts" />

      <div className="w-full">

        {/* List */}
        {loading ? (
          <div className="py-20 text-center text-slate-400">Loading...</div>
        ) : banks.length === 0 ? (
          <Card className="border border-border shadow-sm rounded-2xl bg-card max-w-lg mx-auto">
            <CardContent className="py-16 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-primary/5 rounded-full flex items-center justify-center mb-4">
                <Building2 className="w-8 h-8 text-primary/40" />
              </div>
              <p className="font-extrabold text-slate-700 text-lg">No bank accounts yet</p>
              <p className="text-sm text-slate-500 mt-1 mb-6">Add your first bank account to display it on student fee challans.</p>
              <Button
                className="bg-primary hover:bg-primary/90 text-white rounded-xl gap-2 font-semibold px-6 shadow-sm"
                onClick={() => { setEditTarget(null); setShowForm(true); }}
              >
                <Plus className="w-4 h-4" /> Add First Bank
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {banks.map((b) => (
              <Card key={b.id} className="border border-border shadow-sm rounded-2xl overflow-hidden bg-card hover:shadow-md transition-all duration-300 flex flex-col group">
                <CardContent className="p-6 flex flex-col flex-1">
                  <div className="flex items-start justify-between mb-5">
                    <div className="w-12 h-12 bg-primary/5 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <Building2 className="w-6 h-6 text-primary" />
                    </div>
                    {b.is_active ? (
                      <span className="text-[9px] font-black px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase tracking-widest">Active</span>
                    ) : (
                      <span className="text-[9px] font-black px-2.5 py-1 rounded-md bg-slate-50 text-slate-500 border border-slate-100 uppercase tracking-widest">Inactive</span>
                    )}
                  </div>
                  
                  <div className="mb-6">
                      <h3 className="font-extrabold text-slate-800 text-lg leading-tight mb-1">{b.bank_name}</h3>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{b.account_title}</p>
                  </div>
                  
                  <div className="mt-auto space-y-3 pt-5 border-t border-slate-100 border-dashed">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Account Number</p>
                      <p className="text-sm font-mono font-bold text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100 select-all">{b.account_number}</p>
                    </div>
                    {b.iban && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">IBAN</p>
                        <p className="text-xs font-mono font-bold text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100 break-all select-all">{b.iban}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2 pt-5 mt-5 border-t border-slate-100">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 rounded-xl h-9 gap-1.5 text-primary border-primary/20 hover:bg-primary/5 font-semibold"
                        onClick={() => { setEditTarget(b); setShowForm(true); }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 rounded-xl h-9 gap-1.5 text-destructive border-destructive/20 hover:bg-destructive/5 font-semibold"
                        disabled={deletingId === b.id}
                        onClick={() => handleDelete(b.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {deletingId === b.id ? "..." : "Delete"}
                      </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <BankFormModal
          initial={editTarget ?? undefined}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditTarget(null); }}
          saving={saving}
        />
      )}
    </div>
  );
}
