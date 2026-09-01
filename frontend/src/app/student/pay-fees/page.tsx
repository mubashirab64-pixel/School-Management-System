"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getStudentMyProfile, apiGet } from "@/lib/api";
import {
  getActiveBanks, submitPayment, getPaymentStatus,
  type BankAccount, type PaymentTransaction,
} from "@/lib/bankApi";
import { useToast } from "@/hooks/use-toast";
import {
  Receipt, Download, CreditCard, Banknote,
  CheckCircle2, AlertCircle, History, ArrowRight,
  ShieldCheck, Smartphone, Landmark, Building2,
  Upload, Loader2, Clock, XCircle, RefreshCw,
  ChevronRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Types ────────────────────────────────────────────────────────────────────
type PayMethod = "card" | "wallet" | "bank";
type RightView = "methods" | "bank-form" | "bank-pending" | "bank-approved" | "bank-rejected";

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PayFeesPage() {
  const { toast } = useToast();

  // Data
  const [profile, setProfile] = useState<any>(null);
  const [allFees, setAllFees] = useState<any[]>([]);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);

  // Per-challan payment transaction map: challanId → PaymentTransaction
  const [txnMap, setTxnMap] = useState<Record<number, PaymentTransaction>>({});

  // UI state
  const [activeTab, setActiveTab] = useState<"pay" | "history">("pay");
  const [selectedMethod, setSelectedMethod] = useState<PayMethod>("bank");
  const [rightView, setRightView] = useState<RightView>("methods");

  // Active challan for payment
  const [activeChallanId, setActiveChallanId] = useState<number | null>(null);

  // Bank form inputs
  const [selectedBankId, setSelectedBankId] = useState<number>(0);
  const [txnId, setTxnId] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [fileName, setFileName] = useState("No file chosen");
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const studentData = await getStudentMyProfile();
      setProfile(studentData);

      const [feesData, banksData] = await Promise.all([
        apiGet<any>(`/api/fees/student-fees/?student_id=${studentData.id}`),
        getActiveBanks(),
      ]);

      const feeList: any[] = Array.isArray(feesData)
        ? feesData
        : feesData?.results || [];
      setAllFees(feeList);
      setBanks(banksData);

      // Set default selected bank
      if (banksData.length > 0) setSelectedBankId(banksData[0].id);

      // Fetch payment status for each unpaid fee
      await fetchAllTxnStatuses(feeList);
    } catch (err) {
      console.error("Pay Fees Error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Fetch payment transaction status for every fee in list
  async function fetchAllTxnStatuses(feeList: any[]) {
    const entries = await Promise.all(
      feeList.map(async (f) => {
        try {
          const txn = await getPaymentStatus(f.id);
          return txn ? [f.id, txn] as [number, PaymentTransaction] : null;
        } catch {
          return null;
        }
      })
    );
    const map: Record<number, PaymentTransaction> = {};
    entries.forEach((e) => { if (e) map[e[0]] = e[1]; });
    setTxnMap(map);
  }

  // Refresh status of active challan
  async function refreshTxnStatus(challanId: number) {
    setRefreshing(true);
    try {
      const txn = await getPaymentStatus(challanId);
      if (txn) {
        setTxnMap((prev) => ({ ...prev, [challanId]: txn }));
        if (txn.status === "approved") setRightView("bank-approved");
        else if (txn.status === "rejected") setRightView("bank-rejected");
        else setRightView("bank-pending");
      }
    } catch { }
    setRefreshing(false);
  }

  // ── Computed values ───────────────────────────────────────────────────────
  const { balance, latestFee, paidTotal } = useMemo(() => {
    const computeTotal = (f: any) => {
      const items = f.fee_structure_details?.items || [];
      const itemsSum = items.reduce((s: number, it: any) => s + Number(it.amount), 0);
      return (itemsSum > 0 ? itemsSum : Number(f.total_amount))
        + Number(f.late_fee || 0)
        + Number(f.other_charges || 0);
    };
    const total = allFees.reduce((s, f) => s + computeTotal(f), 0);
    const paid = allFees.reduce((s, f) => s + Number(f.paid_amount), 0);
    const sorted = [...allFees].sort((a, b) => b.month - a.month || b.year - a.year);
    return {
      balance: total - paid,
      latestFee: sorted.find((f) => f.status !== "paid") || sorted[0],
      paidTotal: paid,
    };
  }, [allFees]);

  // Active txn (for current challan in right panel)
  const activeTxn = activeChallanId ? txnMap[activeChallanId] : null;

  // ── Proceed to Pay ────────────────────────────────────────────────────────
  function handleProceed() {
    if (!latestFee) return;
    if (selectedMethod !== "bank") {
      toast({ title: "Coming soon", description: "Only Bank Transfer is available at the moment." });
      return;
    }
    if (banks.length === 0) {
      toast({ title: "No bank accounts", description: "Contact administration for bank details.", variant: "destructive" });
      return;
    }

    const challanId = latestFee.id;
    setActiveChallanId(challanId);

    const existing = txnMap[challanId];
    if (existing?.status === "pending") { setRightView("bank-pending"); return; }
    if (existing?.status === "approved") { setRightView("bank-approved"); return; }
    if (existing?.status === "rejected") { setRightView("bank-rejected"); return; }

    setRightView("bank-form");
    setTxnId("");
    setScreenshot(null);
    setFileName("No file chosen");
  }

  // ── Submit payment ────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!activeChallanId) return;
    if (!txnId.trim()) { toast({ title: "Enter Transaction ID", variant: "destructive" }); return; }
    if (!selectedBankId) { toast({ title: "Select a bank", variant: "destructive" }); return; }

    setSubmitting(true);
    try {
      const txn = await submitPayment({
        challan_id: activeChallanId,
        bank_account_id: selectedBankId,
        transaction_id: txnId.trim(),
        amount: latestFee?.total_amount ?? balance,
        screenshot,
      });
      setTxnMap((prev) => ({ ...prev, [activeChallanId]: txn }));
      setRightView("bank-pending");
      toast({ title: "Payment Submitted!", description: "Awaiting officer verification." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <SkeletonLoader />;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className=" mx-auto space-y-8 pb-20 px-4">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-200">
              <Banknote className="w-6 h-6 text-white" />
            </div>
            Pay Fees & Dues
          </h1>
          <p className="text-slate-500 mt-1 font-medium italic">
            Securely manage and clear your school educational dues.
          </p>
        </div>
        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-100">
          <button
            onClick={() => setActiveTab("pay")}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "pay" ? "bg-[#013a63] text-white shadow-md" : "text-slate-400 hover:text-slate-600"}`}
          >
            Payment Portal
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "history" ? "bg-[#013a63] text-white shadow-md" : "text-slate-400 hover:text-slate-600"}`}
          >
            History
          </button>
        </div>
      </div>

      {activeTab === "pay" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* ── LEFT: Summary ─────────────────────────────────────── */}
          <div className="lg:col-span-7 space-y-6">

            {/* Balance Card */}
            <Card className="border-0 shadow-2xl bg-gradient-to-br from-[#013a63] to-[#1e3a5f] text-white rounded-[2.5rem] overflow-hidden relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/10 rounded-full -ml-24 -mb-24 blur-2xl" />
              <CardContent className="p-8 sm:p-10 relative z-10">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-blue-200 text-xs font-black uppercase tracking-widest">Outstanding Balance</p>
                    <h2 className="text-4xl sm:text-5xl font-black">Rs {balance.toLocaleString()}</h2>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md p-4 rounded-3xl border border-white/20">
                    <CheckCircle2 className={`w-8 h-8 ${balance === 0 ? "text-emerald-400" : "text-blue-300"}`} />
                  </div>
                </div>
                <div className="mt-8 flex flex-wrap gap-4">
                  <div className="px-5 py-2.5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 text-xs font-bold">
                    <span className="text-blue-300 mr-2">Status:</span>
                    {balance > 0
                      ? (activeTxn?.status === "pending" ? "Pending Verification" : "Pending Payment")
                      : "All Clear"}
                  </div>
                  <div className="px-5 py-2.5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 text-xs font-bold">
                    <span className="text-blue-300 mr-2">Paid so far:</span>
                    Rs {paidTotal.toLocaleString()}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bill Breakdown */}
            <Card className="rounded-[2.5rem] border-0 shadow-sm bg-white overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8">
                <CardTitle className="text-xl font-black text-slate-800 flex items-center gap-3">
                  <Receipt className="w-6 h-6 text-blue-600" />
                  Bill Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                {latestFee ? (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center bg-blue-50/50 p-6 rounded-3xl border border-blue-100/50">
                      <div>
                        <h3 className="font-black text-slate-800 text-lg">Current Month Challan</h3>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">
                          {new Date(0, latestFee.month - 1).toLocaleString("en-US", { month: "long" })} {latestFee.year}
                        </p>
                      </div>
                      {/* Dynamic status badge */}
                      <ChallanStatusBadge fee={latestFee} txn={txnMap[latestFee.id]} />
                    </div>

                    <div className="space-y-4 px-2">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</span>
                      </div>
                      {(Array.isArray(latestFee.fee_structure_details)
                        ? latestFee.fee_structure_details
                        : latestFee.fee_structure_details?.items || []
                      ).map((it: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center py-1 group">
                          <span className="text-slate-500 font-bold group-hover:text-slate-800 transition-colors uppercase text-[10px] tracking-widest">
                            {it.fee_type_name || it.name || "Tuition Fee"}
                          </span>
                          <span className="text-slate-800 font-black">Rs {Number(it.amount).toLocaleString()}</span>
                        </div>
                      ))}
                      {(Number(latestFee.late_fee) > 0 || Number(latestFee.other_charges) > 0) && (
                        <div className="pt-4 border-t border-slate-50 space-y-4">
                          {Number(latestFee.late_fee) > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-rose-400 font-bold uppercase text-[10px] tracking-widest">Late Fee Fine</span>
                              <span className="text-rose-600 font-black">Rs {Number(latestFee.late_fee).toLocaleString()}</span>
                            </div>
                          )}
                          {Number(latestFee.other_charges) > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Misc. Charges</span>
                              <span className="text-slate-800 font-black">Rs {Number(latestFee.other_charges).toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
                      <div>
                        <span className="text-sm font-bold text-slate-400 uppercase tracking-widest block mb-1">Total Payable</span>
                        <span className="text-4xl font-black text-[#013a63]">
                          Rs {Number(latestFee.total_amount).toLocaleString()}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        className="rounded-2xl h-12 border-slate-200 font-bold text-[#013a63] hover:bg-slate-50 px-6 gap-2 shrink-0 border-2"
                        onClick={() => window.open(`/admin/fees/challan/${latestFee.id}`, '_blank')}
                      >
                        <Download className="w-4 h-4" /> Download Challan
                      </Button>
                    </div>

                    {/* Rejection reason */}
                    {txnMap[latestFee.id]?.status === "rejected" && (
                      <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3">
                        <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-black text-rose-700 uppercase tracking-wider">Payment Rejected</p>
                          <p className="text-xs text-rose-600 mt-1">
                            {txnMap[latestFee.id]?.reject_reason || "Contact administration for details."}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <CheckCircle2 className="w-16 h-16 text-emerald-200 mx-auto mb-4" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest">No outstanding dues</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── RIGHT PANEL ───────────────────────────────────────── */}
          <div className="lg:col-span-5">
            <div className="sticky top-10">
              {balance > 0 && (
                <>
                  {/* VIEW: Payment Method Selection */}
                  {rightView === "methods" && (
                    <Card className="rounded-[2.5rem] border-0 shadow-xl bg-white overflow-hidden">
                      <div className="p-8 border-b border-slate-50">
                        <h3 className="text-xl font-black text-slate-800">Select Payment Method</h3>
                        <p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-wider">Secure Checkout</p>
                      </div>
                      <div className="p-8 space-y-4">
                        <PaymentMethodBtn id="card" title="Credit / Debit Card" desc="Visa, Mastercard, PayPak" icon={CreditCard} selected={selectedMethod === "card"} onClick={() => setSelectedMethod("card")} />
                        <PaymentMethodBtn id="wallet" title="Mobile Wallet" desc="EasyPaisa, JazzCash" icon={Smartphone} selected={selectedMethod === "wallet"} onClick={() => setSelectedMethod("wallet")} />
                        <PaymentMethodBtn id="bank" title="Bank Transfer" desc="Transfer & submit proof" icon={Landmark} selected={selectedMethod === "bank"} onClick={() => setSelectedMethod("bank")} />
                        <div className="pt-8">
                          <Button
                            disabled={balance <= 0}
                            className="w-full h-16 rounded-[2rem] bg-[#013a63] hover:bg-[#01497c] text-white font-black text-lg shadow-2xl shadow-blue-200 group transition-all"
                            onClick={handleProceed}
                          >
                            Proceed to Pay
                            <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                          </Button>
                          <div className="mt-6 flex items-center justify-center gap-2 text-slate-400">
                            <ShieldCheck className="w-4 h-4" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">SSL Encrypted Secure Payment</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* VIEW: Bank Transfer Form */}
                  {rightView === "bank-form" && (
                    <Card className="rounded-[2.5rem] border-0 shadow-xl bg-white overflow-hidden">
                      <div className="p-7 border-b border-slate-50 flex items-center justify-between">
                        <div>
                          <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-blue-600" /> Bank Transfer
                          </h3>
                          <p className="text-slate-400 text-xs font-bold mt-0.5">Transfer then submit your proof below</p>
                        </div>
                        <button onClick={() => setRightView("methods")} className="text-slate-300 hover:text-slate-500 text-2xl font-bold leading-none">×</button>
                      </div>

                      <div className="p-7 space-y-5">
                        {/* Bank selector */}
                        {banks.length > 1 && (
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Select Bank</label>
                            <div className="space-y-2">
                              {banks.map((b) => (
                                <button
                                  key={b.id}
                                  onClick={() => setSelectedBankId(b.id)}
                                  className={`w-full p-3 rounded-2xl border-2 text-left transition-all ${selectedBankId === b.id ? "border-[#013a63] bg-blue-50/30" : "border-slate-100 hover:border-slate-200"}`}
                                >
                                  <span className={`text-sm font-bold ${selectedBankId === b.id ? "text-[#013a63]" : "text-slate-500"}`}>{b.bank_name}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Bank Details */}
                        {banks.filter((b) => b.id === selectedBankId).map((b) => (
                          <div key={b.id} className="bg-gradient-to-br from-blue-50 to-indigo-50/50 border border-blue-100 rounded-3xl p-5 space-y-3">
                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-3">Transfer to this account:</p>
                            <BankDetailRow label="Bank Name" value={b.bank_name} />
                            <BankDetailRow label="Account Title" value={b.account_title} />
                            <BankDetailRow label="Account No" value={b.account_number} mono />
                            {b.iban && <BankDetailRow label="IBAN" value={b.iban} mono />}
                            <div className="pt-3 mt-3 border-t border-blue-100">
                              <BankDetailRow label="Amount to Pay" value={`Rs. ${Number(latestFee?.total_amount || balance).toLocaleString()}`} highlight />
                            </div>
                          </div>
                        ))}

                        {/* Form */}
                        <div className="border-t border-slate-50 pt-5 space-y-4">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">After Transfer, fill below:</p>

                          <div>
                            <label className="text-[11px] font-bold text-slate-500 block mb-1.5">Transaction ID *</label>
                            <input
                              type="text"
                              value={txnId}
                              onChange={(e) => setTxnId(e.target.value)}
                              placeholder="e.g. TXN-ABC-123456"
                              className="w-full border-2 border-slate-100 focus:border-[#013a63] rounded-2xl px-4 py-3 text-sm font-mono outline-none transition-colors"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-bold text-slate-500 block mb-1.5">Screenshot (optional)</label>
                            <label className="flex items-center gap-3 cursor-pointer p-3 border-2 border-dashed border-slate-200 hover:border-[#013a63] rounded-2xl transition-colors group">
                              <div className="p-2 bg-slate-100 group-hover:bg-blue-50 rounded-xl transition-colors">
                                <Upload className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                              </div>
                              <span className="text-xs text-slate-400 font-semibold truncate flex-1">{fileName}</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0] ?? null;
                                  setScreenshot(f);
                                  setFileName(f ? f.name : "No file chosen");
                                }}
                              />
                            </label>
                          </div>

                          <Button
                            onClick={handleSubmit}
                            disabled={submitting || !txnId.trim()}
                            className="w-full h-14 rounded-[1.5rem] bg-[#013a63] hover:bg-[#01497c] text-white font-black text-base shadow-lg shadow-blue-100 transition-all disabled:opacity-50"
                          >
                            {submitting
                              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</>
                              : <><CheckCircle2 className="w-4 h-4 mr-2" /> Submit Payment</>}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* VIEW: Pending Verification */}
                  {rightView === "bank-pending" && (
                    <Card className="rounded-[2.5rem] border-0 shadow-xl bg-white overflow-hidden">
                      <div className="p-10 flex flex-col items-center text-center space-y-6">
                        <div className="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center shadow-lg shadow-amber-100">
                          <Clock className="w-12 h-12 text-amber-500" />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-2xl font-black text-slate-800">Payment Submitted!</h3>
                          <p className="text-slate-500 font-medium">Your payment proof has been received and is awaiting officer verification.</p>
                        </div>
                        <div className="bg-amber-50 border border-amber-100 rounded-3xl p-5 w-full text-left space-y-2">
                          <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Submission Details</p>
                          {activeTxn && (
                            <>
                              <p className="text-sm text-slate-600">TXN ID: <span className="font-mono font-bold text-slate-800">{activeTxn.transaction_id}</span></p>
                              <p className="text-sm text-slate-600">Amount: <span className="font-bold text-slate-800">Rs {Number(activeTxn.amount).toLocaleString()}</span></p>
                              <p className="text-sm text-slate-600">Submitted: <span className="font-bold text-slate-800">{new Date(activeTxn.submitted_at).toLocaleDateString("en-GB")}</span></p>
                            </>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          className="w-full rounded-2xl h-12 gap-2 border-slate-200"
                          onClick={() => activeChallanId && refreshTxnStatus(activeChallanId)}
                          disabled={refreshing}
                        >
                          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                          Check Status
                        </Button>
                        <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">
                          You will see updates here once the officer reviews your payment.
                        </p>
                      </div>
                    </Card>
                  )}

                  {/* VIEW: Approved */}
                  {rightView === "bank-approved" && (
                    <Card className="rounded-[2.5rem] border-0 shadow-xl bg-white overflow-hidden">
                      <div className="p-10 flex flex-col items-center text-center space-y-6">
                        <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center shadow-lg shadow-emerald-100">
                          <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-2xl font-black text-slate-800">Payment Verified!</h3>
                          <p className="text-slate-500 font-medium">Your payment has been approved. Your fee challan is now marked as PAID.</p>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-5 w-full text-left space-y-2">
                          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Verification Details</p>
                          {activeTxn && (
                            <>
                              <p className="text-sm text-slate-600">Verified By: <span className="font-bold text-slate-800">{activeTxn.verified_by_name || "Officer"}</span></p>
                              {activeTxn.verified_at && (
                                <p className="text-sm text-slate-600">Date: <span className="font-bold text-slate-800">{new Date(activeTxn.verified_at).toLocaleDateString("en-GB")}</span></p>
                              )}
                            </>
                          )}
                        </div>
                        <Button
                          className="w-full rounded-2xl h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2"
                          onClick={() => setActiveTab("history")}
                        >
                          <Download className="w-4 h-4" /> View Receipt in History
                        </Button>
                      </div>
                    </Card>
                  )}

                  {/* VIEW: Rejected */}
                  {rightView === "bank-rejected" && (
                    <Card className="rounded-[2.5rem] border-0 shadow-xl bg-white overflow-hidden">
                      <div className="p-10 flex flex-col items-center text-center space-y-6">
                        <div className="w-24 h-24 bg-rose-50 rounded-full flex items-center justify-center shadow-lg shadow-rose-100">
                          <XCircle className="w-12 h-12 text-rose-500" />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-2xl font-black text-slate-800">Payment Rejected</h3>
                          <p className="text-slate-500 font-medium">Your payment submission was rejected. Please review the reason and resubmit.</p>
                        </div>
                        {activeTxn?.reject_reason && (
                          <div className="bg-rose-50 border border-rose-100 rounded-3xl p-5 w-full text-left">
                            <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-2">Rejection Reason</p>
                            <p className="text-sm text-rose-700 font-medium">{activeTxn.reject_reason}</p>
                          </div>
                        )}
                        <Button
                          className="w-full rounded-2xl h-12 bg-[#013a63] hover:bg-[#01497c] text-white font-bold gap-2"
                          onClick={() => {
                            setTxnId("");
                            setScreenshot(null);
                            setFileName("No file chosen");
                            setRightView("bank-form");
                          }}
                        >
                          <RefreshCw className="w-4 h-4 mr-2" /> Resubmit Payment
                        </Button>
                      </div>
                    </Card>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ── HISTORY TAB ──────────────────────────────────────────── */
        <Card className="rounded-[2.5rem] border-0 shadow-sm bg-white overflow-hidden">
          <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <History className="w-6 h-6 text-blue-600" />
              <h3 className="text-xl font-black text-slate-800">Payment Transaction History</h3>
            </div>
          </div>
          <div className="divide-y divide-slate-50">
            {allFees.length > 0 ? (
              [...allFees]
                .sort((a, b) => b.year - a.year || b.month - a.month)
                .map((f) => {
                  const txn = txnMap[f.id];
                  return (
                    <div key={f.id} className="p-8 flex flex-col sm:flex-row items-center justify-between gap-6 hover:bg-slate-50/30 transition-all border-b border-slate-50 last:border-0">
                      <div className="flex items-center gap-6 w-full sm:w-auto">
                        <div className={`w-16 h-16 rounded-[1.5rem] shadow-sm flex flex-col items-center justify-center font-black shrink-0 border ${f.status === 'paid' ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-100'}`}>
                          <span className={`text-[10px] font-bold ${f.status === 'paid' ? 'text-emerald-400' : 'text-slate-400'}`}>{f.year}</span>
                          <span className={`text-xl font-black uppercase tracking-tighter ${f.status === 'paid' ? 'text-emerald-600' : 'text-slate-800'}`}>
                            {new Date(0, f.month - 1).toLocaleString("en-US", { month: "short" })}
                          </span>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-black text-slate-800 text-lg leading-tight">
                            {new Date(0, f.month - 1).toLocaleString("en-US", { month: "long" })} Fee Challan
                          </h4>
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <HistoryStatusBadge fee={f} txn={txn} />
                            <span className="text-xs text-slate-300 font-bold select-none">•</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Invoice #{f.invoice_number || f.id}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-12 text-center flex-1 justify-center sm:justify-start px-4">
                        <div className="space-y-1">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Net Amount</p>
                          <p className="text-sm font-black text-slate-800">Rs {Number(f.total_amount).toLocaleString()}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Paid</p>
                          <p className="text-sm font-black text-emerald-600">Rs {Number(f.paid_amount).toLocaleString()}</p>
                        </div>
                        {Number(f.total_amount) - Number(f.paid_amount) > 0 && (
                          <div className="space-y-1">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Balance</p>
                            <p className="text-sm font-black text-rose-500">Rs {(Number(f.total_amount) - Number(f.paid_amount)).toLocaleString()}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <Button
                          variant="ghost"
                          className="flex-1 sm:flex-none h-14 px-8 rounded-2xl font-black text-blue-600 hover:bg-blue-50 border-2 border-transparent hover:border-blue-100 transition-all flex gap-3 items-center group shadow-sm hover:shadow-md"
                          onClick={() => window.open(`/admin/fees/challan/${f.id}`, '_blank')}
                        >
                          <Download className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
                          {f.status === "paid" ? "Download Receipt" : "Download Challan"}
                        </Button>
                      </div>
                    </div>
                  );
                })
            ) : (
              <div className="py-24 text-center">
                <Receipt className="w-16 h-16 text-slate-100 mx-auto mb-4" />
                <p className="text-slate-400 font-bold uppercase tracking-widest">No previous payments found</p>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PaymentMethodBtn({ title, desc, icon: Icon, selected, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`w-full p-6 rounded-[2rem] border-2 text-left transition-all flex items-center gap-5 ${selected ? "border-[#013a63] bg-blue-50/30" : "border-slate-50 hover:border-slate-100"}`}
    >
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${selected ? "bg-[#013a63] text-white" : "bg-slate-50 text-slate-400"}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-1">
        <h4 className={`font-black tracking-tight ${selected ? "text-slate-800" : "text-slate-400"}`}>{title}</h4>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{desc}</p>
      </div>
      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${selected ? "border-[#013a63] bg-[#013a63]" : "border-slate-100"}`}>
        {selected && <div className="w-2 h-2 rounded-full bg-white" />}
      </div>
    </button>
  );
}

function BankDetailRow({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center gap-4">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider shrink-0">{label}:</span>
      <span className={`text-right font-bold break-all ${mono ? "font-mono text-xs" : "text-sm"} ${highlight ? "text-[#013a63] text-base font-black" : "text-slate-700"}`}>
        {value}
      </span>
    </div>
  );
}

function ChallanStatusBadge({ fee, txn }: { fee: any; txn?: PaymentTransaction }) {
  if (txn?.status === "pending") {
    return (
      <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-500 text-white shadow-lg shadow-amber-100 flex items-center gap-1">
        <Clock className="w-3 h-3" /> Pending Verification
      </span>
    );
  }
  if (txn?.status === "approved" || fee.status === "paid") {
    return (
      <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500 text-white shadow-lg shadow-emerald-100 flex items-center gap-1">
        <CheckCircle2 className="w-3 h-3" /> Paid
      </span>
    );
  }
  if (txn?.status === "rejected") {
    return (
      <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-rose-500 text-white shadow-lg shadow-rose-100 flex items-center gap-1">
        <XCircle className="w-3 h-3" /> Rejected
      </span>
    );
  }
  return (
    <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-rose-500 text-white shadow-lg shadow-rose-100">
      Unpaid
    </span>
  );
}

function HistoryStatusBadge({ fee, txn }: { fee: any; txn?: PaymentTransaction }) {
  if (txn?.status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-amber-100 text-amber-700 border border-amber-200">
        <Clock className="w-3 h-3" /> Pending Verification
      </span>
    );
  }
  if (fee.status === "paid" || txn?.status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="w-3 h-3" /> Paid
      </span>
    );
  }
  if (txn?.status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-rose-100 text-rose-700 border border-rose-200">
        <XCircle className="w-3 h-3" /> Rejected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 border border-slate-200">
      <AlertCircle className="w-3 h-3" /> Unpaid
    </span>
  );
}

function SkeletonLoader() {
  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 px-4 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="space-y-4">
          <Skeleton className="h-10 w-64 bg-slate-200 rounded-xl" />
          <Skeleton className="h-4 w-96 bg-slate-100 rounded-lg" />
        </div>
        <Skeleton className="h-12 w-48 bg-slate-100 rounded-xl" />
      </div>
      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-7 space-y-6">
          <Skeleton className="h-64 w-full bg-slate-200 rounded-[2.5rem]" />
          <Skeleton className="h-96 w-full bg-slate-100 rounded-[2.5rem]" />
        </div>
        <div className="col-span-12 lg:col-span-5">
          <Skeleton className="h-[600px] w-full bg-slate-200 rounded-[2.5rem]" />
        </div>
      </div>
    </div>
  );
}
