"use client";

import { useState } from "react";
import { DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { feeService } from "@/services/feeService";
import { FeeTabs } from "../components/FeeTabs";

export default function PaymentsPage() {
  const [payStudent, setPayStudent] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payLoading, setPayLoading] = useState(false);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <FeeTabs active="payments" />

      <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-emerald-700">Process Payments (FIFO)</CardTitle>
            <CardDescription>Accept bulk or individual amounts. The engine auto-distributes to oldest unpaid months.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-8 items-start">
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="relative">
                      <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center z-10 relative shadow-inner">
                          <DollarSign className="w-12 h-12 text-emerald-600" />
                      </div>
                      <div className="absolute inset-0 bg-emerald-50 rounded-full animate-ping opacity-75"></div>
                  </div>
                  <h3 className="text-2xl font-black text-gray-800 mt-6">FIFO Allocation Ready</h3>
                  <p className="text-gray-500 mt-2 max-w-sm">Payments automatically clear oldest arrears.</p>
              </div>

              <form className="flex-1 space-y-4 max-w-md bg-white p-6 rounded-xl border border-emerald-100 shadow-sm" onSubmit={(e) => {
                  e.preventDefault();
                  setPayLoading(true);
                  feeService.recordPayment({
                    student_fee: Number(payStudent),
                    amount: Number(payAmount),
                    method: payMethod as 'cash' | 'bank'
                  }).then(res => {
                    alert(res.message || "Payment processed successfully");
                    setPayAmount("");
                  }).catch(err => {
                    alert((err as any).message || "Error processing payment");
                  }).finally(() => setPayLoading(false));
              }}>
                  <div>
                    <label className="text-sm font-medium">Student ID</label>
                    <input required type="number" className="w-full p-2 border rounded-md mt-1 outline-emerald-500" value={payStudent} onChange={e => setPayStudent(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Amount Received (Rs)</label>
                    <input required type="number" step="0.01" className="w-full p-2 border rounded-md mt-1 outline-emerald-500" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Payment Method</label>
                    <select className="w-full p-2 border rounded-md mt-1 outline-emerald-500" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                      <option value="cash">Cash</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="online">Online</option>
                      <option value="cheque">Cheque</option>
                    </select>
                  </div>
                  <Button disabled={payLoading} type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white mt-4">
                    {payLoading ? "Processing..." : "Process Payment"}
                  </Button>
              </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}