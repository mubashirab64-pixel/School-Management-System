"use client";

import React from "react";
import { ChallanTemplate, BankDetails, PaymentTransactionData, SubmitPaymentPayload } from "@/components/admin/challan-template";
import { StudentFee } from "@/services/feeService";

interface ChallanPrintViewProps {
  student: any;
  fee: any;
  allFees: any[];
  /** Active bank accounts — shown in both challan copies */
  bankDetails?: BankDetails[];
  /** Existing payment transaction for this challan (shown in Student Copy) */
  paymentTransaction?: PaymentTransactionData | null;
  /** Called when student submits payment proof */
  onSubmitPayment?: (payload: SubmitPaymentPayload) => Promise<void>;
  isSubmitting?: boolean;
}

const ChallanPrintView: React.FC<ChallanPrintViewProps> = ({
  student,
  fee,
  allFees,
  bankDetails,
  paymentTransaction,
  onSubmitPayment,
  isSubmitting,
}) => {
  if (!fee || !student) return null;

  const studentFee: StudentFee = {
    ...fee,
    student_name: student.name || fee.student_name,
    student_code: student.student_id_number || student.student_id || student.student_code || fee.student_code,
    student_class: student.class_name || student.classroom_name || (student.current_grade && student.section ? `${student.current_grade} - ${student.section}` : fee.student_class),
    student_gr_no: student.gr_no || fee.student_gr_no,
    school_name: student.campus?.campus_name || fee.school_name,
    school_address: student.campus?.address || fee.school_address,
    organization_name: fee.organization_name || "AL-KHAIR",
  };

  return (
    <div className="bg-white">
      <ChallanTemplate
        fee={studentFee}
        bankDetails={bankDetails}
        paymentTransaction={paymentTransaction}
        onSubmitPayment={onSubmitPayment}
        isSubmitting={isSubmitting}
      />

      <style jsx global>{`
        @media print {
          body { background: white !important; margin: 0; padding: 0; }
          .no-print-bg { background: white !important; padding: 0 !important; }
          .print\\:hidden { display: none !important; }
          .no-print { display: none !important; }
          #challan-print-area { padding: 0 !important; margin: 0 !important; }
        }
        @page {
          size: A4 portrait;
          margin: 0;
        }
      `}</style>
    </div>
  );
};

export default ChallanPrintView;
