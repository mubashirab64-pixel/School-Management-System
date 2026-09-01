import React, { useState } from 'react';
import SignatureCanvas from './SignatureCanvas';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PenTool, CheckCircle2, AlertCircle, Loader2, RotateCcw } from "lucide-react";
import { apiPatch, API_ENDPOINTS, refreshUserProfile } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

const ENDPOINT_MAP = {
  teacher: `${API_ENDPOINTS.TEACHERS}signature/save/`,
  coordinator: `${API_ENDPOINTS.COORDINATORS}signature/save/`,
  principal: `${API_ENDPOINTS.PRINCIPALS}signature/save/`,
};

const TeacherSignature = ({ currentSignature, onUpdate, role = 'teacher' }) => {
  const [signature, setSignature] = useState(currentSignature || null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveSignature = async (base64Data) => {
    setIsSaving(true);
    try {
      const endpoint = ENDPOINT_MAP[role] || ENDPOINT_MAP.teacher;
      await apiPatch(endpoint, { signature: base64Data });

      // Refresh global profile cache in localStorage
      await refreshUserProfile();

      setSignature(base64Data);
      setIsEditing(false);

      toast({
        title: "Signature Saved",
        description: "Your digital signature has been updated successfully.",
      });

      if (onUpdate) onUpdate(base64Data);
    } catch (error) {
      console.error("Error saving signature:", error);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: "Could not save your signature. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border-0 shadow-xl bg-white overflow-hidden rounded-2xl">
      <CardHeader className="p-6 border-b bg-gray-50/50 flex flex-row items-center justify-between">
        <CardTitle className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <PenTool className="w-4 h-4 text-[#185FA5]" />
          </div>
          My Digital Signature
        </CardTitle>
        {!isEditing && signature && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="rounded-xl border-gray-200 text-gray-600 hover:bg-white"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-2" /> Update
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-6">
        {isEditing ? (
          <div className="space-y-4 relative">
            <p className="text-sm text-gray-500 mb-4">
              Draw your signature clearly or upload an image file of your signature (a cropped PNG with transparent background is recommended).
            </p>
            <SignatureCanvas onSave={handleSaveSignature} />
            <div className="flex justify-center mt-4">
              <Button
                variant="ghost"
                onClick={() => setIsEditing(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                Cancel
              </Button>
            </div>
            {isSaving && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex flex-col items-center justify-center z-50">
                <Loader2 className="w-8 h-8 text-[#185FA5] animate-spin mb-2" />
                <p className="text-sm font-bold text-gray-900">Saving Signature...</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center">
            {signature ? (
              <div className="space-y-6 w-full flex flex-col items-center">
                <div className="p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200 w-full flex justify-center min-h-[160px] items-center">
                  <img
                    src={signature}
                    alt="Current Signature"
                    className="max-h-32 object-contain"
                  />
                </div>
                <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-xs font-bold">Signature Verified & Active</span>
                </div>
                <p className="text-[10px] text-gray-400 text-center max-w-xs">
                  This signature will be automatically attached to all report cards you generate or approve.
                </p>
              </div>
            ) : (
              <div className="text-center py-8 space-y-4">
                <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-amber-500">
                  <AlertCircle className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">No Signature Found</h3>
                  <p className="text-sm text-gray-500 max-w-xs mx-auto">
                    You haven't set up your digital signature yet. You need this to approve report cards.
                  </p>
                </div>
                <Button
                  onClick={() => setIsEditing(true)}
                  className="bg-[#185FA5] hover:bg-[#1451a0] text-white font-bold rounded-xl px-8 shadow-lg shadow-blue-200/50"
                >
                  Create Signature Now
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TeacherSignature;
