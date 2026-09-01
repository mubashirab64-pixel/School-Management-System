import { getApiBaseUrl } from './api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('sis_access_token');
}

export interface CashPaymentPayload {
  challan_id: number;
  student_id: number;
  amount: number;
}

export interface CashPaymentResult {
  success: true;
  challan_id: number;
  invoice_number: string;
  student: string;
  amount: number;
  payment_method: 'cash';
  paid_at: string;
  paid_date: string;
  paid_time: string;
  received_by: string;
  receipt_no: string;
  challan_status: string;
}

/**
 * One-click cash payment.
 * Backend auto-adds: received_by (JWT), paid_at (now)
 */
export async function recordCashPayment(
  payload: CashPaymentPayload
): Promise<CashPaymentResult> {
  const base = getApiBaseUrl();
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const token = getToken();

  const res = await fetch(`${cleanBase}/api/fees/cash/record/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      challan_id: payload.challan_id,
      student_id: payload.student_id,
      amount: payload.amount,
      payment_method: 'cash',
    }),
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  return data as CashPaymentResult;
}
