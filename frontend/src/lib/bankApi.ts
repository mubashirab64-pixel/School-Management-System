/**
 * Bank & Payment Transaction API helpers
 * All functions read JWT from localStorage / sessionStorage automatically.
 */

import { getApiBaseUrl } from './api';

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("sis_access_token") || null;
}

async function authFetch(path: string, init: RequestInit = {}) {
  const base = getApiBaseUrl();
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const token = getToken();
  const res = await fetch(`${cleanBase}${cleanPath}`, {
    ...init,
    headers: {
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

// ─── Bank Accounts ────────────────────────────────────────────────────────────

export interface BankAccount {
  id: number;
  bank_name: string;
  account_title: string;
  account_number: string;
  iban: string;
  is_active: boolean;
}

/** Returns all active bank accounts for current org */
export async function getActiveBanks(): Promise<BankAccount[]> {
  const data = await authFetch("/api/fees/banks/active/");
  return Array.isArray(data) ? data : data?.results || [];
}

// ─── Payment Transactions ─────────────────────────────────────────────────────

export interface PaymentTransaction {
  id: number;
  challan: number;
  challan_number: string;
  challan_month: number;
  challan_year: number;
  challan_total: string;
  student: number;
  student_name: string;
  bank_account: number | null;
  bank_name: string | null;
  amount: string;
  transaction_id: string;
  screenshot_url: string | null;
  status: "pending" | "approved" | "rejected";
  reject_reason: string;
  verified_by: number | null;
  verified_by_name: string | null;
  verified_at: string | null;
  submitted_at: string;
}

/**
 * Student submits bank transfer proof.
 * Uses multipart/form-data (for screenshot upload).
 */
export async function submitPayment(payload: {
  challan_id: number;
  bank_account_id: number;
  transaction_id: string;
  amount: number | string;
  screenshot?: File | null;
}): Promise<PaymentTransaction> {
  const form = new FormData();
  form.append("challan_id", String(payload.challan_id));
  form.append("bank_account_id", String(payload.bank_account_id));
  form.append("transaction_id", payload.transaction_id);
  form.append("amount", String(payload.amount));
  if (payload.screenshot) form.append("screenshot", payload.screenshot);

  return authFetch("/api/fees/payment-transactions/submit/", {
    method: "POST",
    body: form,
    // Note: do NOT set Content-Type — browser sets it with boundary for FormData
  });
}

/**
 * Get the latest payment transaction for a specific challan.
 * Student uses this to check current status.
 */
export async function getPaymentStatus(challanId: number): Promise<PaymentTransaction | null> {
  const data = await authFetch(
    `/api/fees/payment-transactions/by-challan/?challan_id=${challanId}`
  );
  const list = Array.isArray(data) ? data : data?.results || [];
  return list.length > 0 ? list[0] : null;
}

/**
 * Get recent activity (approved, rejected, or pending)
 */
export async function getRecentTransactions(limit = 10): Promise<PaymentTransaction[]> {
  const data = await authFetch(`/api/fees/payment-transactions/?limit=${limit}`);
  return Array.isArray(data) ? data : data?.results || [];
}

/**
 * Officer: get all pending payment transactions.
 */
export async function getPendingPayments(): Promise<PaymentTransaction[]> {
  const data = await authFetch("/api/fees/payment-transactions/pending/");
  return Array.isArray(data) ? data : data?.results || [];
}

/**
 * Officer: approve or reject a payment transaction.
 */
export async function verifyPayment(
  id: number,
  action: "approve" | "reject",
  rejectReason = ""
): Promise<PaymentTransaction> {
  return authFetch(`/api/fees/payment-transactions/${id}/verify/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, reject_reason: rejectReason }),
  });
}
