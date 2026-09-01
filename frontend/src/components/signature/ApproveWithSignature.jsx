import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, PenTool, AlertCircle, CheckCircle2, RotateCcw } from "lucide-react";
import SignatureCanvas from './SignatureCanvas';

const ApproveWithSignature = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Approve Result",
  description = "Please provide your digital signature to approve this result.",
  savedSignature = null,   // pre-saved profile signature
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  // If saved signature exists, default to using it; otherwise show canvas
  const [useSaved, setUseSaved] = useState(!!savedSignature);

  // Reset state when dialog opens/closes
  React.useEffect(() => {
    if (isOpen) {
      setUseSaved(!!savedSignature);
      setError(null);
    }
  }, [isOpen, savedSignature]);

  const handleApproveSaved = async () => {
    if (!savedSignature) {
      setError("No saved signature found.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm(savedSignature);
      onClose();
    } catch (err) {
      console.error("Approval error:", err);
      setError("Failed to approve. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveDrawn = async (signatureData) => {
    if (!signatureData) {
      setError("Please draw your signature before approving.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm(signatureData);
      onClose();
    } catch (err) {
      console.error("Approval error:", err);
      setError("Failed to approve. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] rounded-3xl p-0 overflow-hidden border-0 shadow-2xl">
        <div className="bg-[#185FA5] p-6 text-white relative">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <ShieldCheck className="w-24 h-24" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-2xl font-black flex items-center gap-3">
              <PenTool className="w-6 h-6" />
              {title}
            </DialogTitle>
            <DialogDescription className="text-blue-100 text-sm mt-2">
              {description}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-xs font-bold px-3 py-2 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Toggle tabs when saved signature exists */}
          {savedSignature && (
            <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl">
              <button
                onClick={() => setUseSaved(true)}
                className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  useSaved ? 'bg-white text-[#185FA5] shadow-sm' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                Use Saved Signature
              </button>
              <button
                onClick={() => setUseSaved(false)}
                className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  !useSaved ? 'bg-white text-[#185FA5] shadow-sm' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                Draw New
              </button>
            </div>
          )}

          {/* Saved signature preview */}
          {useSaved && savedSignature ? (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-[#185FA5]/30 rounded-2xl bg-blue-50/30 p-6 flex flex-col items-center gap-3">
                <img
                  src={savedSignature}
                  alt="Saved Signature"
                  className="max-h-28 object-contain"
                />
                <div className="flex items-center gap-2 text-emerald-600 text-[10px] font-black uppercase tracking-widest">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Your saved profile signature
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4 text-[#185FA5]" />
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed pt-1">
                  Your saved digital signature will be applied to this approval and permanently displayed on the report card.
                </p>
              </div>

              <div className="relative">
                <Button
                  onClick={handleApproveSaved}
                  disabled={isSubmitting}
                  className="w-full bg-[#185FA5] hover:bg-[#1451a0] text-white font-black rounded-2xl h-12 text-sm uppercase tracking-widest shadow-lg shadow-blue-200/50"
                >
                  {isSubmitting ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                  ) : (
                    <><ShieldCheck className="w-4 h-4 mr-2" /> Approve with Saved Signature</>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            /* Draw new signature canvas */
            <div className="space-y-4 relative">
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Draw or Upload Signature</p>
              <SignatureCanvas onSave={handleApproveDrawn} />
              {isSubmitting && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-50 rounded-2xl">
                  <Loader2 className="w-10 h-10 text-[#185FA5] animate-spin mb-3" />
                  <p className="text-sm font-black text-gray-900 uppercase tracking-widest">Processing...</p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="px-6 pb-6 pt-0 flex flex-row sm:justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl font-bold text-gray-500 hover:bg-gray-100"
          >
            Cancel
          </Button>
          <div className="text-[10px] text-gray-400 flex items-center italic mr-auto">
            Secure: {new Date().getTime().toString(16).toUpperCase()}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ApproveWithSignature;
