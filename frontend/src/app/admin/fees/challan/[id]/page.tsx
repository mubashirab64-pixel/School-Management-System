"use client";

import { useEffect, useState, use } from "react";
import { feeService, StudentFee } from "@/services/feeService";
import { Loader2, Printer, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ChallanTemplate } from "@/components/admin/challan-template";
import { getActiveBanks, getPaymentStatus, BankAccount, PaymentTransaction } from "@/lib/bankApi";

export default function ChallanViewPage({ params }: { params: Promise<{ id: string }> }) {
   const { id } = use(params);
   const [fee, setFee] = useState<StudentFee | null>(null);
   const [loading, setLoading] = useState(true);
   const [activeBanks, setActiveBanks] = useState<BankAccount[]>([]);
   const [txn, setTxn] = useState<PaymentTransaction | null>(null);

   useEffect(() => {
      const fetch = async () => {
         try {
            const [feeData, banksData, txnData] = await Promise.all([
               feeService.getStudentFee(parseInt(id)),
               getActiveBanks(),
               getPaymentStatus(parseInt(id))
            ]);
            setFee(feeData);
            setActiveBanks(banksData);
            setTxn(txnData);
         } catch (e) {
            console.error(e);
            toast.error("Failed to load challan data");
         } finally {
            setLoading(false);
         }
      };
      fetch();
   }, [id]);

   if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-blue-500" /></div>;
   if (!fee) return <div className="text-center p-20 font-bold text-gray-400">Challan not found.</div>;

   const printChallan = () => {
      window.print();
   };

   return (
      <div className="bg-gray-100 min-h-screen p-4 md:p-8 no-print-bg">
         <div className="max-w-[210mm] mx-auto space-y-6">

            {/* Actions bar (hidden on print) */}
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-xl print:hidden sticky top-4 z-50">
               <div className="flex items-center gap-3">
                  <ScrollText className="h-6 w-6 text-[#274c77]" />
                  <div>
                     <p className="font-black text-[#274c77] leading-none">Fee Recovery System</p>
                     <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Challan #{fee.invoice_number}</p>
                  </div>
               </div>
               <div className="flex gap-2">
                  <Button onClick={printChallan} className="bg-[#274c77] hover:bg-[#1e3a5f] text-white">
                     <Printer className="w-4 h-4 mr-2" /> Print / Download PDF
                  </Button>
               </div>
            </div>

            {/* Challan Page Holder */}
            <div className="bg-white shadow-2xl p-0 print:p-0 print:shadow-none mx-auto w-full challan-wrapper">
               <ChallanTemplate 
                  fee={fee} 
                  bankDetails={activeBanks}
                  paymentTransaction={txn}
                />
            </div>
         </div>

         <style jsx global>{`
        @media print {
          body { background: white !important; margin: 0; padding: 0; }
          .no-print-bg { background: white !important; padding: 0 !important; }
          .challan-copy { 
            height: 99mm; 
            width: 210mm; 
            page-break-after: always; 
            border-bottom: 1px dashed #999 !important;
            box-sizing: border-box;
            background: white !important;
          }
          .challan-copy:last-child { border-bottom: none !important; }
          .print\\:hidden { display: none !important; }
        }
        @page {
          size: A4 portrait;
          margin: 0;
        }
      `}</style>
      </div>
   );
}
