"use client";

import { useEffect, useState, use } from "react";
import { useSearchParams } from "next/navigation";
import { feeService, StudentFee } from "@/services/feeService";
import { Loader2, Printer, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ChallanTemplate } from "@/components/admin/challan-template";
import { getActiveBanks, BankAccount } from "@/lib/bankApi";

export default function BulkChallanPrintPage() {
  const searchParams = useSearchParams();
  const [fees, setFees] = useState<StudentFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBanks, setActiveBanks] = useState<BankAccount[]>([]);

  useEffect(() => {
    const idsParam = searchParams.get("ids");
    if (!idsParam) {
      setLoading(false);
      return;
    }

    const fetchFees = async () => {
      try {
        const ids = idsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        const [feesResults, banksResults] = await Promise.all([
          Promise.all(ids.map(id => feeService.getStudentFee(id).catch(e => null))),
          getActiveBanks()
        ]);
        setFees(feesResults.filter(f => f !== null) as StudentFee[]);
        setActiveBanks(banksResults);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load some challans");
      } finally {
        setLoading(false);
      }
    };
    fetchFees();
  }, [searchParams]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-blue-500" /></div>;
  if (fees.length === 0) return <div className="text-center p-20 font-bold text-gray-400">No valid challans found for bulk printing.</div>;

  const copies = ["Bank Copy", "School Copy", "Student Copy"];
  const formatAmount = (amt: string | number) => parseFloat(amt.toString()).toLocaleString();
  const printChallan = () => window.print();

  return (
    <div className="bg-gray-100 min-h-screen p-4 md:p-8 no-print-bg border-0">
      <div className="max-w-[210mm] mx-auto">
        
        {/* Actions bar */}
        <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-xl print:hidden sticky top-4 z-50 mb-6 border">
           <div className="flex items-center gap-3">
              <ScrollText className="h-6 w-6 text-[#274c77]" />
              <div>
                <p className="font-black text-[#274c77] leading-none">Bulk Print Mode</p>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">{fees.length} Challans Ready</p>
              </div>
           </div>
           <Button onClick={printChallan} className="bg-[#274c77] hover:bg-[#1e3a5f] text-white">
             <Printer className="w-4 h-4 mr-2" /> Save PDF / Print
           </Button>
        </div>

        {/* Challan Pages Loop */}
        <div className="bg-transparent shadow-none mx-auto w-full space-y-8 print:space-y-0">
          {fees.map((fee) => (
             <div key={fee.id} className="bg-white shadow-2xl p-0 print:p-0 print:shadow-none challan-wrapper mb-8">
                <ChallanTemplate 
                  fee={fee} 
                  bankDetails={activeBanks}
                />
             </div>
          ))}
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body { background: white !important; margin: 0; padding: 0; }
          .no-print-bg { background: white !important; padding: 0 !important; }
          .challan-wrapper {
             page-break-after: always; /* Each A4 will have 3 copies */
             margin-bottom: 0 !important;
             box-shadow: none !important;
          }
          .challan-copy { 
            height: 99mm; 
            width: 210mm; 
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
