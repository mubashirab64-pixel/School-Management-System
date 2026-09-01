"use client";

import { useState, useEffect } from "react";
import { 
  Search, Filter, Download, ExternalLink, CreditCard, CheckCircle, 
  Clock, AlertCircle, Loader2, User, ChevronLeft, ChevronRight,
  CreditCardIcon, Wallet, Building2, Banknote, Calendar, Printer
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { feeService, StudentFee } from "@/services/feeService";
import { recordCashPayment, CashPaymentResult } from "@/lib/cashApi";
import { generateSeparateChallansPDFs } from "@/utils/bulkPdfGenerator";
import { CashPaymentSuccessModal } from "@/components/fees/CashPaymentSuccessModal";
import { CashPaymentConfirmModal, type ConfirmPaymentData } from "@/components/fees/CashPaymentConfirmModal";
import { FeeTabs } from "../components/FeeTabs";
import { toast } from "sonner";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function StudentFeeListPage() {
  const [fees, setFees] = useState<StudentFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  
  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedFee, setSelectedFee] = useState<StudentFee | null>(null);
  const [amountPaid, setAmountPaid] = useState("");
  const [method, setMethod] = useState<"cash" | "bank">("cash");
  const [bankName, setBankName] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [isZipping, setIsZipping] = useState(false);

  // Cash Payment 3-step state: idle → confirming → submitting → success
  type CashStep = 'idle' | 'confirming' | 'submitting' | 'success';
  const [cashStep, setCashStep] = useState<CashStep>('idle');
  const [confirmData, setConfirmData] = useState<ConfirmPaymentData | null>(null);
  const [cashResult, setCashResult] = useState<CashPaymentResult | null>(null);

  // Bulk Selection State
  const [selectedFeeIds, setSelectedFeeIds] = useState<number[]>([]);

  const fetchFees = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (month !== "all") params.month = month;
      if (status !== "all") params.status = status;
      if (search) params.search = search;
      
      const data = await feeService.getStudentFees(params);
      setFees(data);
      setSelectedFeeIds([]); // Reset selection when filters change
    } catch (e) {
      toast.error("Failed to load fees");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFees();
  }, [month, status]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchFees();
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'paid': return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">PAID</Badge>;
      case 'partial': return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-purple-200">PARTIAL</Badge>;
      case 'issued': return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">ISSUED</Badge>;
      case 'unpaid': return <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-rose-200">UNPAID</Badge>;
      default: return <Badge variant="secondary">{s}</Badge>;
    }
  };

  const openPaymentModal = (fee: StudentFee) => {
    setSelectedFee(fee);
    setAmountPaid(fee.remaining_amount.toString());
    setMethod("cash");
    setCashStep('idle');
    setCashResult(null);
    setConfirmData(null);
    setIsPaymentModalOpen(true);
  };

  // Helper: decode officer name from JWT (display only, no verification)
  function getOfficerName(): string {
    try {
      const token = localStorage.getItem('sis_access_token');
      if (!token) return 'Account Officer';
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.full_name || payload.name || payload.username || 'Account Officer';
    } catch {
      return 'Account Officer';
    }
  }

  // Step 1 — "Post Final Payment" clicked
  // Cash → show confirmation (NO API call yet)
  // Bank → call API directly (existing flow)
  const handleRecordPayment = async () => {
    if (!selectedFee || !amountPaid) return;

    if (method === 'cash') {
      setConfirmData({
        studentName: selectedFee.student_name,
        studentCode: selectedFee.student_code,
        amount: parseFloat(amountPaid),
        confirmedAt: new Date(),
        officerName: getOfficerName(),
      });
      setIsPaymentModalOpen(false); // Dialog band karo — focus trap hatao
      setCashStep('confirming');
      return;
    }

    // ── Bank: existing flow ──
    try {
      await feeService.recordPayment({
        student_fee: selectedFee.id,
        amount: parseFloat(amountPaid),
        method,
        bank_name: bankName,
        transaction_id: transactionId,
      });
      toast.success("Bank payment recorded successfully");
      setIsPaymentModalOpen(false);
      fetchFees();
    } catch (e) {
      toast.error("Failed to record payment");
    }
  };

  // Step 2 — "Confirm & Mark PAID" clicked → NOW call API
  const handleConfirmCash = async () => {
    if (!selectedFee || !amountPaid) return;
    setCashStep('submitting');
    try {
      const result = await recordCashPayment({
        challan_id: selectedFee.id,
        student_id: selectedFee.student,
        amount: parseFloat(amountPaid),
      });
      // Update table row to PAID — no reload
      setFees(prev =>
        prev.map(f =>
          f.id === selectedFee.id
            ? { ...f, status: 'paid', paid_amount: String(result.amount), remaining_amount: '0' }
            : f
        )
      );
      setCashResult(result);
      setIsPaymentModalOpen(false);
      setCashStep('success');
    } catch (e: any) {
      toast.error(e.message || "Payment failed. Try again.");
      setCashStep('confirming'); // stay on confirm, let officer retry
    }
  };

  // Step 2b — "Cancel" clicked → back to original modal
  const handleCancelConfirm = () => {
    setCashStep('idle');
    setConfirmData(null);
    setIsPaymentModalOpen(true); // Dialog wapas kholo
  };

  const handleDownload = async (feeId: number) => {
    // In a real app, this would trigger a status update and download
    try {
      await feeService.updateFeeStatus(feeId);
      window.open(`/admin/fees/challan/${feeId}`, '_blank');
      fetchFees();
    } catch (e) {
      toast.error("Failed to process challan");
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedFeeIds(fees.map(f => f.id));
    } else {
      setSelectedFeeIds([]);
    }
  };

  const handleToggleSelect = (feeId: number, checked: boolean) => {
    if (checked) {
      setSelectedFeeIds(prev => [...prev, feeId]);
    } else {
      setSelectedFeeIds(prev => prev.filter(id => id !== feeId));
    }
  };

  const handleBulkPrint = () => {
    if (selectedFeeIds.length === 0) return;
    const idsString = selectedFeeIds.join(',');
    window.open(`/admin/fees/challan/bulk?ids=${idsString}`, '_blank');
  };

  const handleBulkZipDownload = async () => {
    if (selectedFeeIds.length === 0) return;
    
    setIsZipping(true);
    toast.info(`Generating ZIP for ${selectedFeeIds.length} challans. This may take a moment...`, { duration: 5000 });
    
    try {
      // First, we need to fetch the full details for the selected challans
      // because the list view might not have all the deep details needed for the PDF
      const promises = selectedFeeIds.map(id => feeService.getStudentFee(id).catch(() => null));
      const results = await Promise.all(promises);
      const validFees = results.filter((f): f is StudentFee => f !== null);

      if (validFees.length === 0) {
        toast.error("Failed to load challan data for ZIP");
        return;
      }

      await generateSeparateChallansPDFs(validFees, `challans_${new Date().getTime()}.zip`);
      toast.success(`Successfully downloaded ${validFees.length} challans in a ZIP archive`);
    } catch (error) {
      console.error(error);
      toast.error("An error occurred while generating the ZIP file");
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div>
        <h2 className="text-3xl font-extrabold text-[#274c77] mb-2 tracking-wide flex items-center gap-3">
          <CreditCardIcon className="h-8 w-8 text-[#6096ba]" />
          Student Fee List
        </h2>
        <p className="text-gray-600 text-lg">Search, monitor, and manage individual student financial records.</p>
      </div>

      <FeeTabs active="students" />

      {/* Filters */}
      <Card className="border-none shadow-xl bg-white p-4">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px] space-y-1.5">
            <Label className="text-xs font-black text-gray-400 uppercase">Search Student</Label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input 
                placeholder="Name or Student Code..." 
                className="pl-10" 
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="w-[180px] space-y-1.5">
            <Label className="text-xs font-black text-gray-400 uppercase">Month</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m, i) => (
                  <SelectItem key={i+1} value={(i+1).toString()}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-[180px] space-y-1.5">
            <Label className="text-xs font-black text-gray-400 uppercase">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Status</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="issued">Issued</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="bg-[#274c77] hover:bg-[#1e3a5f] text-white">
            <Filter className="w-4 h-4 mr-2" /> Apply Filters
          </Button>
        </form>

        {/* Bulk Actions */}
        {selectedFeeIds.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex items-center justify-between animate-in slide-in-from-top-2">
             <div className="flex items-center gap-2 text-[#274c77] font-bold text-sm">
                <CheckCircle className="w-4 h-4" />
                {selectedFeeIds.length} Challans Selected
             </div>
             <div className="flex gap-2">
                <Button onClick={handleBulkZipDownload} disabled={isZipping} className="bg-purple-600 hover:bg-purple-700 text-white shadow-md">
                   {isZipping ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                   {isZipping ? 'Generating ZIP...' : 'Download ZIP'}
                </Button>
                <Button onClick={handleBulkPrint} disabled={isZipping} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md">
                   <Printer className="w-4 h-4 mr-2" /> Bulk Print
                </Button>
             </div>
          </div>
        )}
      </Card>

      <Card className="border-none shadow-2xl bg-white overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                <TableHead className="w-12 text-center">
                  <Checkbox 
                     checked={fees.length > 0 && selectedFeeIds.length === fees.length}
                     onCheckedChange={(checked) => handleSelectAll(!!checked)}
                  />
                </TableHead>
                <TableHead className="font-black text-[11px] uppercase tracking-widest text-[#274c77]">Student Detail</TableHead>
                <TableHead className="font-black text-[11px] uppercase tracking-widest text-[#274c77]">Challan #</TableHead>
                <TableHead className="font-black text-[11px] uppercase tracking-widest text-[#274c77]">Amount Due</TableHead>
                <TableHead className="font-black text-[11px] uppercase tracking-widest text-[#274c77]">Month</TableHead>
                <TableHead className="font-black text-[11px] uppercase tracking-widest text-[#274c77]">Status</TableHead>
                <TableHead className="text-right font-black text-[11px] uppercase tracking-widest text-[#274c77]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" /></TableCell></TableRow>
              ) : fees.map((fee) => (
                <TableRow key={fee.id} className={`group transition-colors ${selectedFeeIds.includes(fee.id) ? 'bg-blue-50' : 'hover:bg-blue-50/20'}`}>
                  <TableCell className="text-center">
                    <Checkbox 
                       checked={selectedFeeIds.includes(fee.id)}
                       onCheckedChange={(checked) => handleToggleSelect(fee.id, !!checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-[#274c77] font-black group-hover:bg-[#274c77] group-hover:text-white transition-all">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-black text-[#274c77] text-sm">{fee.student_name}</p>
                        <p className="text-[11px] font-bold text-slate-500 font-mono mt-0.5">{fee.student_code}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-gray-600">{fee.invoice_number}</TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <p className="font-black text-sm text-[#274c77]">Rs {parseFloat(fee.total_amount).toLocaleString()}</p>
                      {parseFloat(fee.remaining_amount) > 0 && (
                        <p className="text-[10px] text-rose-500 font-bold">Bal: Rs {parseFloat(fee.remaining_amount).toLocaleString()}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-gray-400" />
                      <span className="text-xs font-bold text-gray-600">
                        {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][fee.month-1]} {fee.year}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(fee.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                       {fee.status === 'unpaid' && (
                         <Button size="sm" className="bg-chart-1 hover:bg-chart-1/80 h-8" onClick={() => handleDownload(fee.id)}>
                            <Download className="w-3.5 h-3.5 mr-1" /> Download
                         </Button>
                       )}
                       {(fee.status === 'issued' || fee.status === 'partial') && (
                         <>
                            <Link href={`/admin/fees/challan/${fee.id}`} target="_blank">
                              <Button size="sm" variant="outline" className="h-8 border-amber-200 text-amber-700 hover:bg-amber-50">
                                <ExternalLink className="w-3.5 h-3.5 mr-1" /> View
                              </Button>
                            </Link>
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8 font-black" onClick={() => openPaymentModal(fee)}>
                               <CreditCard className="w-3.5 h-3.5 mr-1" /> PAY
                            </Button>
                         </>
                       )}
                       {fee.status === 'paid' && (
                         <Link href={`/admin/fees/challan/${fee.id}`} target="_blank">
                           <Button size="sm" variant="outline" className="h-8 bg-emerald-50 text-emerald-700 border-emerald-200">
                             <CheckCircle className="w-3.5 h-3.5 mr-1" /> Receipt
                           </Button>
                         </Link>
                       )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && fees.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-20 text-gray-400 font-medium">No records found matching filters.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Payment Modal */}
      <Dialog
        open={isPaymentModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsPaymentModalOpen(false);
            setCashStep('idle');
            setConfirmData(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-[#274c77]">Record Fee Payment</DialogTitle>
            <DialogDescription>Apply payment against student challan {selectedFee?.invoice_number}.</DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-6 py-4">
             <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                <div className="p-3 bg-white rounded-xl shadow-sm"><User className="w-6 h-6 text-[#274c77]" /></div>
                <div>
                   <p className="font-black text-[#274c77]">{selectedFee?.student_name}</p>
                   <p className="text-xs font-black text-gray-400 uppercase tracking-widest leading-none mt-1">Pending: Rs {parseFloat(selectedFee?.remaining_amount || "0").toLocaleString()}</p>
                </div>
             </div>

             <div className="grid gap-2">
                <Label className="font-bold text-gray-700">Amount to Pay (PKR)</Label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 font-bold text-gray-400">Rs</span>
                  <Input 
                    type="number" 
                    className="pl-10 text-lg font-black h-12" 
                    value={amountPaid}
                    onChange={e => setAmountPaid(e.target.value)}
                  />
                </div>
             </div>

             <div className="grid gap-2">
                <Label className="font-bold text-gray-700">Payment Mode</Label>
                <RadioGroup value={method} onValueChange={(v: any) => setMethod(v)} className="grid grid-cols-2 gap-4">
                  <div className={`cursor-pointer border rounded-2xl p-4 flex items-center gap-3 transition-all ${method === 'cash' ? 'bg-[#274c77] border-[#274c77] text-white shadow-lg' : 'hover:bg-gray-50'}`}>
                    <RadioGroupItem value="cash" id="m-cash" className="sr-only" />
                    <Label htmlFor="m-cash" className="flex items-center gap-2 cursor-pointer w-full font-bold">
                       <Wallet className="w-5 h-5" /> Cash Payment
                    </Label>
                  </div>
                  <div className={`cursor-pointer border rounded-2xl p-4 flex items-center gap-3 transition-all ${method === 'bank' ? 'bg-[#274c77] border-[#274c77] text-white shadow-lg' : 'hover:bg-gray-50'}`}>
                    <RadioGroupItem value="bank" id="m-bank" className="sr-only" />
                    <Label htmlFor="m-bank" className="flex items-center gap-2 cursor-pointer w-full font-bold">
                       <Building2 className="w-5 h-5" /> Bank Deposit
                    </Label>
                  </div>
                </RadioGroup>
             </div>

             {method === 'bank' && (
               <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                  <div className="grid gap-2">
                    <Label className="text-xs font-black text-gray-500 uppercase">Bank Name</Label>
                    <Select value={bankName} onValueChange={setBankName}>
                      <SelectTrigger><SelectValue placeholder="Select Bank" /></SelectTrigger>
                      <SelectContent>
                         <SelectItem value="HBL">HBL</SelectItem>
                         <SelectItem value="UBL">UBL</SelectItem>
                         <SelectItem value="Meezan">Meezan Bank</SelectItem>
                         <SelectItem value="MCB">MCB</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-xs font-black text-gray-500 uppercase">Transaction ID</Label>
                    <Input value={transactionId} onChange={e => setTransactionId(e.target.value)} placeholder="TXN-123..." />
                  </div>
               </div>
             )}
          </div>

          <DialogFooter>
             <Button
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg"
              disabled={!amountPaid}
              onClick={handleRecordPayment}
             >
                <Banknote className="w-5 h-5 mr-2" /> Post Final Payment
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Step 2 — Confirmation popup (UNPAID, API not called yet) */}
      {(cashStep === 'confirming' || cashStep === 'submitting') && confirmData && (
        <CashPaymentConfirmModal
          data={confirmData}
          isSubmitting={cashStep === 'submitting'}
          onConfirm={handleConfirmCash}
          onCancel={handleCancelConfirm}
        />
      )}

      {/* Step 3 — Success popup (PAID, after API returns) */}
      {cashStep === 'success' && cashResult && (
        <CashPaymentSuccessModal
          result={cashResult}
          onClose={() => {
            setCashStep('idle');
            setCashResult(null);
          }}
        />
      )}
    </div>
  );
}
