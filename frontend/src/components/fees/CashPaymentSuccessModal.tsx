"use client";

import { Printer, X, CheckCircle2, Banknote, User, Calendar, Clock, Hash, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CashPaymentResult } from "@/lib/cashApi";

interface Props {
  result: CashPaymentResult;
  onClose: () => void;
}

export function CashPaymentSuccessModal({ result, onClose }: Props) {
  const handlePrint = () => {
    window.open(`/admin/fees/challan/${result.challan_id}`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Green header */}
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-white font-black text-lg leading-none">Payment Recorded!</h2>
              <p className="text-emerald-100 text-xs mt-0.5 font-medium">Transaction complete</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Receipt body */}
        <div className="px-6 py-5 space-y-1">
          <Row icon={<User className="w-4 h-4 text-slate-400" />}     label="Student"  value={result.student} bold />
          <Row icon={<Banknote className="w-4 h-4 text-emerald-500" />} label="Amount"   value={`Rs. ${result.amount.toLocaleString()}`} bold green />
          <Row icon={<Banknote className="w-4 h-4 text-slate-400" />}  label="Method"   value="Cash" />
          <div className="border-t border-dashed border-slate-100 my-3" />
          <Row icon={<Calendar className="w-4 h-4 text-slate-400" />}  label="Date"     value={result.paid_date} />
          <Row icon={<Clock className="w-4 h-4 text-slate-400" />}     label="Time"     value={result.paid_time} />
          <Row icon={<UserCheck className="w-4 h-4 text-slate-400" />} label="Officer"  value={result.received_by} />
          <div className="border-t border-dashed border-slate-100 my-3" />
          <Row icon={<Hash className="w-4 h-4 text-slate-400" />}      label="Receipt"  value={result.receipt_no} mono />
        </div>

        {/* PAID stamp bar */}
        <div className="mx-6 mb-4 bg-emerald-50 border border-emerald-200 rounded-2xl py-2 text-center">
          <span className="text-emerald-700 font-black text-sm tracking-[4px] uppercase">✅ PAID</span>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <Button
            variant="outline"
            className="flex-1 rounded-xl border-slate-200 font-bold text-slate-600 hover:bg-slate-50 gap-2"
            onClick={handlePrint}
          >
            <Printer className="w-4 h-4" />
            Print Receipt
          </Button>
          <Button
            className="flex-1 rounded-xl bg-[#274c77] hover:bg-[#1e3a5f] text-white font-bold gap-2"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  bold = false,
  green = false,
  mono = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  bold?: boolean;
  green?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
      </div>
      <span
        className={[
          "text-sm",
          bold ? "font-black" : "font-semibold",
          green ? "text-emerald-600" : "text-slate-800",
          mono ? "font-mono" : "",
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}
