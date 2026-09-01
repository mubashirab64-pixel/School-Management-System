import React, { useState } from "react";
import { StudentFee } from "@/services/feeService";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BankDetails {
  id: number;
  bank_name: string;
  account_title: string;
  account_number: string;
  iban?: string;
}

export interface PaymentTransactionData {
  id: number;
  status: "pending" | "approved" | "rejected";
  transaction_id: string;
  reject_reason?: string | null;
  verified_at?: string | null;
  verified_by_name?: string | null;
}

export interface SubmitPaymentPayload {
  transactionId: string;
  bankAccountId: number;
  screenshot: File | null;
}

export interface ChallanTemplateProps {
  fee: StudentFee;
  /** Active bank accounts for current org — shown in both copies */
  bankDetails?: BankDetails[];
  /** Existing payment transaction for this challan */
  paymentTransaction?: PaymentTransactionData | null;
  /** Called when student submits payment proof (Student Copy only, screen only) */
  onSubmitPayment?: (payload: SubmitPaymentPayload) => Promise<void>;
  isSubmitting?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function numberToWords(num: number): string {
  if (num === 0) return "Zero";
  const a = ["", "One ", "Two ", "Three ", "Four ", "Five ", "Six ", "Seven ", "Eight ", "Nine ", "Ten ", "Eleven ", "Twelve ", "Thirteen ", "Fourteen ", "Fifteen ", "Sixteen ", "Seventeen ", "Eighteen ", "Nineteen "];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const numStr = Math.floor(num).toString();
  if (numStr.length > 9) return "Amount too large";
  const n = ("000000000" + numStr).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return "";
  let str = "";
  str += n[1] !== "00" ? (a[Number(n[1])] || b[Number(n[1][0])] + " " + a[Number(n[1][1])]) + "Crore " : "";
  str += n[2] !== "00" ? (a[Number(n[2])] || b[Number(n[2][0])] + " " + a[Number(n[2][1])]) + "Lakh " : "";
  str += n[3] !== "00" ? (a[Number(n[3])] || b[Number(n[3][0])] + " " + a[Number(n[3][1])]) + "Thousand " : "";
  str += n[4] !== "0" ? a[Number(n[4])] + "Hundred " : "";
  str += n[5] !== "00" ? ((str !== "") ? "and " : "") + (a[Number(n[5])] || b[Number(n[5][0])] + " " + a[Number(n[5][1])]) : "";
  return str.trim();
}

function getPreviousMonthName(currentMonth: number): string {
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const prevMonthIdx = currentMonth === 1 ? 11 : currentMonth - 2;
  return months[prevMonthIdx];
}

// ─── Bank Details Block (shared, print-safe) ─────────────────────────────────

const BankDetailsBlock: React.FC<{ banks: BankDetails[] }> = ({ banks }) => {
  if (!banks || banks.length === 0) return null;
  return (
    <div style={{ border: "1px solid #555", borderRadius: "3px", padding: "6px 10px", marginTop: "10px", background: "#f8fafc" }}>
      <div style={{ fontWeight: "bold", marginBottom: "4px", fontSize: "11px", letterSpacing: "0.5px", textTransform: "uppercase", color: "#333", borderBottom: "1px solid #ddd", paddingBottom: "3px" }}>
        Bank Transfer Details (Deposit in ANY ONE account)
      </div>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", paddingTop: "4px" }}>
        {banks.map((b, idx) => (
          <div key={b.id} style={{ flex: 1, minWidth: "150px", borderRight: idx < banks.length - 1 ? "1px dashed #ccc" : "none", paddingRight: idx < banks.length - 1 ? "10px" : "0" }}>
            <div style={{ fontWeight: "bold", fontSize: "12px", color: "#0f172a" }}>{b.bank_name}</div>
            <div style={{ fontSize: "11px", color: "#334155", marginTop: "1px" }}>Title: {b.account_title}</div>
            <div style={{ fontSize: "12px", fontFamily: "monospace", fontWeight: "bold", color: "#1e293b", marginTop: "2px" }}>A/c: {b.account_number}</div>
            {b.iban && <div style={{ fontSize: "10px", fontFamily: "monospace", color: "#475569", marginTop: "1px", wordBreak: "break-all" }}>IBAN: {b.iban}</div>}
          </div>
        ))}
      </div>
    </div>
  );
};


// ─── Student-Copy Payment Form (screen only, never prints) ───────────────────

const PaymentSubmitForm: React.FC<{
  fee: StudentFee;
  banks: BankDetails[];
  paymentTransaction?: PaymentTransactionData | null;
  onSubmitPayment?: (payload: SubmitPaymentPayload) => Promise<void>;
  isSubmitting?: boolean;
}> = ({ fee, banks, paymentTransaction, onSubmitPayment, isSubmitting }) => {
  const [txnId, setTxnId] = useState("");
  const [selectedBank, setSelectedBank] = useState<number>(banks[0]?.id ?? 0);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [fileLabel, setFileLabel] = useState("No file chosen");

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setScreenshot(f);
    setFileLabel(f ? f.name : "No file chosen");
  };

  const handleSubmit = async () => {
    if (!txnId.trim()) { toast.error("Please enter a Transaction ID."); return; }
    if (!selectedBank) { toast.error("Please select a bank."); return; }
    if (!onSubmitPayment) return;
    await onSubmitPayment({ transactionId: txnId, bankAccountId: selectedBank, screenshot });
  };

  // ── Approved ──
  if (paymentTransaction?.status === "approved") {
    return (
      <div className="no-print" style={{ marginTop: "12px", borderTop: "2px solid #16a34a", paddingTop: "10px" }}>
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "6px", padding: "12px", textAlign: "center" }}>
          <div style={{ fontSize: "20px", marginBottom: "4px" }}>✅</div>
          <div style={{ fontWeight: "bold", color: "#15803d", fontSize: "14px" }}>PAID — Verified</div>
          {paymentTransaction.verified_at && (
            <div style={{ fontSize: "11px", color: "#166534", marginTop: "4px" }}>
              {new Date(paymentTransaction.verified_at).toLocaleDateString("en-GB")}
              {paymentTransaction.verified_by_name ? ` · ${paymentTransaction.verified_by_name}` : ""}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Rejected ──
  if (paymentTransaction?.status === "rejected") {
    return (
      <div className="no-print" style={{ marginTop: "12px", borderTop: "2px solid #dc2626", paddingTop: "10px" }}>
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", padding: "12px", textAlign: "center" }}>
          <div style={{ fontSize: "20px", marginBottom: "4px" }}>❌</div>
          <div style={{ fontWeight: "bold", color: "#b91c1c", fontSize: "14px" }}>Payment Rejected</div>
          {paymentTransaction.reject_reason && (
            <div style={{ fontSize: "12px", color: "#7f1d1d", marginTop: "4px" }}>
              Reason: {paymentTransaction.reject_reason}
            </div>
          )}
          <div style={{ fontSize: "11px", color: "#991b1b", marginTop: "6px" }}>Please resubmit with correct details below.</div>
        </div>
        {/* Allow resubmit after rejection */}
        <PaymentSubmitForm fee={fee} banks={banks} paymentTransaction={null} onSubmitPayment={onSubmitPayment} isSubmitting={isSubmitting} />
      </div>
    );
  }

  // ── Pending ──
  if (paymentTransaction?.status === "pending") {
    return (
      <div className="no-print" style={{ marginTop: "12px", borderTop: "2px solid #d97706", paddingTop: "10px" }}>
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "6px", padding: "12px", textAlign: "center" }}>
          <div style={{ fontSize: "20px", marginBottom: "4px" }}>🕐</div>
          <div style={{ fontWeight: "bold", color: "#92400e", fontSize: "14px" }}>Verification Pending</div>
          <div style={{ fontSize: "12px", color: "#78350f", marginTop: "4px" }}>
            TXN ID: <strong>{paymentTransaction.transaction_id}</strong>
          </div>
          <div style={{ fontSize: "11px", color: "#92400e", marginTop: "4px" }}>
            Your payment proof has been submitted and is awaiting officer verification.
          </div>
        </div>
      </div>
    );
  }

  // ── No transaction yet — show submit form ──
  if (!onSubmitPayment || banks.length === 0) return null;

  return (
    <div className="no-print" style={{ marginTop: "12px", borderTop: "1px dashed #94a3b8", paddingTop: "10px" }}>
      <div style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "8px", color: "#1e3a5f", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        Transfer Karne Ke Baad — Submit Payment Proof
      </div>

      {/* Bank selector (if multiple banks) */}
      {banks.length > 1 && (
        <div style={{ marginBottom: "8px" }}>
          <label style={{ fontSize: "11px", fontWeight: "bold", color: "#475569", display: "block", marginBottom: "3px" }}>Select Bank:</label>
          <select
            value={selectedBank}
            onChange={(e) => setSelectedBank(Number(e.target.value))}
            style={{ width: "100%", padding: "6px 8px", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "12px" }}
          >
            {banks.map((b) => (
              <option key={b.id} value={b.id}>{b.bank_name} — {b.account_title}</option>
            ))}
          </select>
        </div>
      )}

      {/* Transaction ID */}
      <div style={{ marginBottom: "8px" }}>
        <label style={{ fontSize: "11px", fontWeight: "bold", color: "#475569", display: "block", marginBottom: "3px" }}>Transaction ID: *</label>
        <input
          type="text"
          value={txnId}
          onChange={(e) => setTxnId(e.target.value)}
          placeholder="e.g. TXN-ABC-123456"
          style={{ width: "100%", padding: "6px 8px", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "12px", boxSizing: "border-box" }}
        />
      </div>

      {/* Screenshot */}
      <div style={{ marginBottom: "10px" }}>
        <label style={{ fontSize: "11px", fontWeight: "bold", color: "#475569", display: "block", marginBottom: "3px" }}>Screenshot (optional):</label>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ cursor: "pointer", padding: "5px 12px", background: "#e2e8f0", borderRadius: "4px", fontSize: "11px", fontWeight: "bold", color: "#334155", border: "1px solid #cbd5e1" }}>
            Upload
            <input type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
          </label>
          <span style={{ fontSize: "11px", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "180px" }}>{fileLabel}</span>
        </div>
      </div>

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={isSubmitting}
        style={{
          width: "100%", padding: "8px", background: isSubmitting ? "#94a3b8" : "#013a63",
          color: "white", border: "none", borderRadius: "5px", fontWeight: "bold",
          fontSize: "13px", cursor: isSubmitting ? "not-allowed" : "pointer", letterSpacing: "0.5px"
        }}
      >
        {isSubmitting ? "Submitting..." : "Submit Payment"}
      </button>
    </div>
  );
};

// ─── Single Challan Copy ──────────────────────────────────────────────────────

const ChallanSlip: React.FC<{
  fee: StudentFee;
  copyType: string;
  isTop: boolean;
  bankDetails?: BankDetails[];
  paymentTransaction?: PaymentTransactionData | null;
  onSubmitPayment?: (payload: SubmitPaymentPayload) => Promise<void>;
  isSubmitting?: boolean;
}> = ({ fee, copyType, isTop, bankDetails, paymentTransaction, onSubmitPayment, isSubmitting }) => {
  const totalAmountStr = typeof fee.total_amount === "string" ? fee.total_amount : String(fee.total_amount);
  const totalAmount = parseFloat(totalAmountStr || "0");
  const isPaid = fee.status === 'paid';

  const monthName = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][fee.month - 1];
  const prevMonthName = getPreviousMonthName(fee.month);
  const prevYear = fee.month === 1 ? fee.year - 1 : fee.year;

  const details = Array.isArray(fee.fee_structure_details) ? fee.fee_structure_details : [];
  const sumOfLineItems = details.reduce((sum, item) => sum + parseFloat(item.amount || "0"), 0);
  const lateFee = parseFloat(fee.late_fee || "0");
  const otherCharges = parseFloat(fee.other_charges || "0");

  let arrears = totalAmount - sumOfLineItems - lateFee - otherCharges;
  if (arrears < 0) arrears = 0;

  const hasBanks = bankDetails && bankDetails.length > 0;

  return (
    <div style={{ padding: "8mm 15mm 4mm 15mm", boxSizing: "border-box", position: "relative" }}>
      {/* Watermark */}
      <div className="wm" style={{ position: "absolute", top: "55%", left: "50%", transform: "translate(-50%,-50%) rotate(-15deg)", fontSize: "110px", fontWeight: "800", color: "rgba(6,10,15,0.04)", whiteSpace: "nowrap", pointerEvents: "none", letterSpacing: "12px", zIndex: 0, userSelect: "none", textTransform: "uppercase" }}>
        {fee.organization_name || "AL-KHAIR"}
      </div>

      <div style={{ position: "absolute", top: "15px", right: "15mm", fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "bold", color: "#666" }}>
        {copyType}
      </div>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "15px" }}>
        <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "bold", fontFamily: "serif", letterSpacing: "1px" }}>
          {fee.organization_name || "AL-KHAIR"} <span style={{ fontSize: "14px", fontWeight: "normal" }}>(Regd.)</span>
        </h1>
        {fee.school_name && (
          <p style={{ margin: "2px 0 0 0", fontSize: "13px", fontWeight: "bold", color: "#444" }}>{fee.school_name}</p>
        )}
        <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#333" }}>{fee.school_address || ""}</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
        {/* Receipt No & Date */}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "flex-end", width: "45%" }}>
            <span style={{ fontWeight: "bold" }}>Receipt No.</span>
            <span style={{ flex: 1, borderBottom: "1px solid black", textAlign: "left", paddingLeft: "5px" }}>{fee.invoice_number}</span>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "flex-end", width: "45%" }}>
            <span style={{ fontWeight: "bold" }}>Date:</span>
            <span style={{ flex: 1, borderBottom: "1px solid black", textAlign: "left", paddingLeft: "5px" }}>
              {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}
            </span>
          </div>
        </div>

        {/* Class & GR */}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "flex-end", width: "45%" }}>
            <span style={{ fontWeight: "bold" }}>Class</span>
            <span style={{ flex: 1, borderBottom: "1px solid black", textAlign: "left", paddingLeft: "5px" }}>{fee.student_class || ""}</span>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "flex-end", width: "45%" }}>
            <span style={{ fontWeight: "bold" }}>GR #</span>
            <span style={{ flex: 1, borderBottom: "1px solid black", textAlign: "left", paddingLeft: "5px" }}>{fee.student_gr_no || fee.student_code || ""}</span>
          </div>
        </div>

        {/* Name */}
        <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
          <span style={{ fontWeight: "bold" }}>Student&apos;s Name:</span>
          <span style={{ flex: 1, borderBottom: "1px solid black", paddingLeft: "5px" }}>{fee.student_name}</span>
        </div>

        {/* Month */}
        <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
          <span style={{ fontWeight: "bold" }}>For the Month of:</span>
          <span style={{ flex: 1, borderBottom: "1px solid black", paddingLeft: "5px" }}>{monthName} {fee.year}</span>
        </div>

        {/* Payment Method */}
        <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
          <span style={{ fontWeight: "bold" }}>Payment Method:</span>
          <span style={{ flex: 1, borderBottom: "1px solid black", paddingLeft: "5px" }}>
            {fee.status === 'paid'
              ? (fee.payment_method === 'cash' ? 'Cash' : fee.payment_method === 'bank' ? 'Bank Transfer' : 'Cash / Bank')
              : 'Cash / Bank'}
          </span>
        </div>
      </div>

      {/* ── PAID STAMP (shown when fee is fully paid) ── */}
      {isPaid && (
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%) rotate(-25deg)",
          border: "4px solid #16a34a", borderRadius: "8px",
          padding: "6px 20px", color: "#16a34a", fontWeight: "900",
          fontSize: "42px", letterSpacing: "6px", opacity: 0.18,
          pointerEvents: "none", whiteSpace: "nowrap", zIndex: 1,
          fontFamily: "serif", textTransform: "uppercase"
        }}>
          PAID
        </div>
      )}

      {/* ── Bank Details (only when not paid) ── */}
      {hasBanks && !isPaid && <BankDetailsBlock banks={bankDetails!} />}

      {/* Fee Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "15px", fontSize: "13px" }}>
        <thead>
          <tr>
            <th style={{ border: "1px solid #000", padding: "6px 8px", textAlign: "left", width: "50%" }}>Fee Description</th>
            <th style={{ border: "1px solid #000", padding: "6px 8px", textAlign: "left", width: "25%" }}>Frequency</th>
            <th style={{ border: "1px solid #000", padding: "6px 8px", textAlign: "right", width: "25%" }}>Amount (Rs.)</th>
          </tr>
        </thead>
        <tbody>
          {details.map((item: any, idx: number) => (
            <tr key={idx}>
              <td style={{ border: "1px solid #000", padding: "4px 8px" }}>{item.fee_type_name}</td>
              <td style={{ border: "1px solid #000", padding: "4px 8px", textTransform: "capitalize" }}>{item.frequency || "Monthly"}</td>
              <td style={{ border: "1px solid #000", padding: "4px 8px", textAlign: "right" }}>{parseFloat(item.amount).toLocaleString()}</td>
            </tr>
          ))}
          {arrears > 0 && (
            <tr>
              <td style={{ border: "1px solid #000", padding: "4px 8px", fontStyle: "italic", color: "#555" }}>
                Arrears <span style={{ fontSize: "11px" }}>({prevMonthName} {prevYear})</span>
              </td>
              <td style={{ border: "1px solid #000", padding: "4px 8px", fontStyle: "italic", color: "#555" }}>Brought Fwd</td>
              <td style={{ border: "1px solid #000", padding: "4px 8px", textAlign: "right" }}>{arrears.toLocaleString()}</td>
            </tr>
          )}
          {lateFee > 0 && (
            <tr>
              <td style={{ border: "1px solid #000", padding: "4px 8px" }}>Late Fee</td>
              <td style={{ border: "1px solid #000", padding: "4px 8px" }}>Applied</td>
              <td style={{ border: "1px solid #000", padding: "4px 8px", textAlign: "right" }}>{lateFee.toLocaleString()}</td>
            </tr>
          )}
          {otherCharges > 0 && (
            <tr>
              <td style={{ border: "1px solid #000", padding: "4px 8px" }}>Other Charges</td>
              <td style={{ border: "1px solid #000", padding: "4px 8px" }}>Custom</td>
              <td style={{ border: "1px solid #000", padding: "4px 8px", textAlign: "right" }}>{otherCharges.toLocaleString()}</td>
            </tr>
          )}
          <tr>
            <td colSpan={2} style={{ border: "1px solid #000", padding: "6px 8px", fontWeight: "bold" }}>Total Payable</td>
            <td style={{ border: "1px solid #000", padding: "6px 8px", textAlign: "right", fontWeight: "bold" }}>{totalAmount.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      {/* Sum in words */}
      <div style={{ display: "flex", gap: "10px", alignItems: "flex-end", marginTop: "10px", fontSize: "13px" }}>
        <span style={{ fontWeight: "bold" }}>Sum of Rupees:</span>
        <span style={{ flex: 1, borderBottom: "1px solid black", fontStyle: "italic" }}>{numberToWords(totalAmount)} Rupees Only</span>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "15px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
          <span style={{ fontSize: "24px", fontWeight: "bold" }}>Rs.</span>
          <div style={{ borderBottom: "2px solid black", width: "120px", textAlign: "center", fontSize: "20px", fontWeight: "bold", paddingBottom: "2px" }}>
            {totalAmount.toLocaleString()}/-
          </div>
        </div>
        <div style={{ width: "180px", textAlign: "center" }}>
          <div style={{ borderBottom: "1px solid black", marginBottom: "6px", height: "15px" }}></div>
          <span style={{ fontWeight: "bold", fontSize: "12px" }}>
            {isTop ? "Accounts Officer" : "Teacher's Signature"}
          </span>
        </div>
      </div>

      {/* ── PAID Confirmation (both copies, when officer has recorded payment) ── */}
      {isPaid && (
        <div style={{ marginTop: "12px", borderTop: "2px solid #16a34a", paddingTop: "10px" }}>
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "6px", padding: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "22px" }}>✅</span>
                <div>
                  <div style={{ fontWeight: "bold", color: "#15803d", fontSize: "15px" }}>FEE PAID — CLEARED</div>
                  {fee.payment_date && (
                    <div style={{ fontSize: "11px", color: "#166534", marginTop: "2px" }}>
                      Date: {new Date(fee.payment_date).toLocaleDateString("en-GB")}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                {fee.receipt_number && (
                  <div style={{ fontSize: "11px", fontWeight: "bold", color: "#166534", fontFamily: "monospace" }}>
                    {fee.receipt_number}
                  </div>
                )}
                {fee.payment_method && (
                  <div style={{ fontSize: "11px", color: "#166534", marginTop: "2px", textTransform: "capitalize" }}>
                    Mode: {fee.payment_method === 'cash' ? 'Cash' : 'Bank Transfer'}
                  </div>
                )}
                {fee.received_by_name && (
                  <div style={{ fontSize: "10px", color: "#4ade80", marginTop: "2px" }}>
                    Received by: {fee.received_by_name}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Student Copy: Payment Submit Form (only when not yet paid) ── */}
      {!isTop && !isPaid && onSubmitPayment && hasBanks && (
        <PaymentSubmitForm
          fee={fee}
          banks={bankDetails!}
          paymentTransaction={paymentTransaction}
          onSubmitPayment={onSubmitPayment}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
};

// ─── Full Challan (Office Copy + Student Copy) ────────────────────────────────

export const ChallanTemplate: React.FC<ChallanTemplateProps> = ({
  fee,
  bankDetails,
  paymentTransaction,
  onSubmitPayment,
  isSubmitting,
}) => {
  return (
    <div style={{ width: "210mm", backgroundColor: "white", fontFamily: "serif" }}>
      {/* Top Half — Office Copy */}
      <div style={{ height: "148.5mm", boxSizing: "border-box" }}>
        <ChallanSlip fee={fee} copyType="OFFICE COPY" isTop={true} bankDetails={bankDetails} />
      </div>

      {/* Cut Here */}
      <div style={{ height: "0", borderTop: "1px dashed #aaa", position: "relative", display: "flex", justifyContent: "center", alignItems: "center", margin: "0 15mm" }}>
        <div style={{ position: "absolute", backgroundColor: "white", padding: "2px 10px", fontSize: "11px", color: "#aaa", letterSpacing: "2px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px" }}>
          <span>✂</span> CUT HERE <span>✂</span>
        </div>
      </div>

      {/* Bottom Half — Student Copy */}
      <div style={{ minHeight: "148.5mm", boxSizing: "border-box" }}>
        <ChallanSlip
          fee={fee}
          copyType="STUDENT COPY"
          isTop={false}
          bankDetails={bankDetails}
          paymentTransaction={paymentTransaction}
          onSubmitPayment={onSubmitPayment}
          isSubmitting={isSubmitting}
        />
      </div>
    </div>
  );
};
