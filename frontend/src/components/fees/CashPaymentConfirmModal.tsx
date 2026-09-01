"use client";

import { ShieldCheck, X, Banknote, User, Calendar, Clock, UserCheck, Loader2, CheckCircle2, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ConfirmPaymentData {
  studentName: string;
  studentCode: string;
  amount: number;
  confirmedAt: Date;
  officerName: string;
}

interface Props {
  data: ConfirmPaymentData;
  isSubmitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CashPaymentConfirmModal({ data, isSubmitting, onConfirm, onCancel }: Props) {
  const dateStr = data.confirmedAt.toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
  const timeStr = data.confirmedAt.toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Blue header */}
        <div className="bg-gradient-to-r from-[#274c77] to-[#1e3a5f] px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-white font-black text-lg leading-none">Confirm Payment</h2>
              <p className="text-blue-200 text-xs mt-0.5 font-medium">Review before recording</p>
            </div>
          </div>
          {!isSubmitting && (
            <button onClick={onCancel} className="text-white/60 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Details */}
        <div className="px-6 py-5 space-y-1">
          <Row icon={<User className="w-4 h-4 text-slate-400" />}      label="Student"    value={data.studentName} bold />
          <Row icon={<Hash className="w-4 h-4 text-slate-400" />}      label="Student ID" value={data.studentCode} mono />
          <Row icon={<Banknote className="w-4 h-4 text-slate-400" />}  label="Amount"     value={`Rs. ${data.amount.toLocaleString()}`} bold />
          <Row icon={<Banknote className="w-4 h-4 text-slate-400" />}  label="Method"  value="Cash" />
          <div className="border-t border-dashed border-slate-100 my-3" />
          <Row icon={<Calendar className="w-4 h-4 text-slate-400" />}  label="Date"    value={dateStr} />
          <Row icon={<Clock className="w-4 h-4 text-slate-400" />}     label="Time"    value={timeStr} />
          <Row icon={<UserCheck className="w-4 h-4 text-slate-400" />} label="Officer" value={data.officerName} />
        </div>

        {/* Status badge */}
        <div className="mx-6 mb-4 bg-rose-50 border border-rose-200 rounded-2xl py-2 text-center">
          <span className="text-rose-600 font-black text-sm tracking-[2px] uppercase">
            Not Recorded Yet — Status: UNPAID
          </span>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <Button
            variant="outline"
            className="flex-1 rounded-xl font-bold text-slate-600"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2"
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
              : <><CheckCircle2 className="w-4 h-4" /> Confirm & Mark PAID</>
            }
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({
  icon, label, value, bold = false, mono = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  bold?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
      </div>
      <span className={`text-sm text-slate-800 ${bold ? "font-black" : "font-semibold"} ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}
