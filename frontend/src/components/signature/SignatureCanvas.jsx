import React, { useRef, useState } from 'react';
import SignaturePad from 'react-signature-canvas';
import { Button } from "@/components/ui/button";
import { Trash2, Check, RotateCcw, Upload, Image } from "lucide-react";
import { toast } from "sonner";

const SignatureCanvas = ({ onSave, width = 500, height = 200 }) => {
  const sigPad = useRef(null);
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState('draw'); // 'draw' | 'upload'
  const [isEmpty, setIsEmpty] = useState(true);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const clear = () => {
    if (activeTab === 'draw') {
      sigPad.current.clear();
      setIsEmpty(true);
    } else {
      setUploadedImage(null);
    }
  };

  const handleEndDrawing = () => {
    setIsEmpty(sigPad.current.isEmpty());
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (file) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file (PNG, JPG, or JPEG).");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("File size must be less than 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedImage(e.target.result);
      toast.success("Signature image loaded successfully!");
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const save = () => {
    if (activeTab === 'draw') {
      if (sigPad.current.isEmpty()) {
        toast.error("Please provide a signature first.");
        return;
      }
      const signatureData = sigPad.current.getTrimmedCanvas().toDataURL('image/png');
      onSave(signatureData);
    } else {
      if (!uploadedImage) {
        toast.error("Please upload a signature image first.");
        return;
      }
      onSave(uploadedImage);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-lg mx-auto">
      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl w-full max-w-sm mb-2">
        <button
          type="button"
          onClick={() => setActiveTab('draw')}
          className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            activeTab === 'draw'
              ? 'bg-white text-[#185FA5] shadow-sm'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          Draw Signature
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('upload')}
          className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            activeTab === 'upload'
              ? 'bg-white text-[#185FA5] shadow-sm'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          Upload Image
        </button>
      </div>

      {activeTab === 'draw' ? (
        <div className="border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 overflow-hidden w-full relative group">
          <SignaturePad
            ref={sigPad}
            onEnd={handleEndDrawing}
            canvasProps={{
              width: width,
              height: height,
              className: "signature-canvas w-full h-full cursor-crosshair"
            }}
          />
          <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={clear}
              className="h-8 w-8 rounded-full bg-white/80 backdrop-blur-sm border-gray-200 text-gray-500 hover:text-red-500 hover:border-red-200"
              title="Clear signature"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          {isEmpty && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-gray-400 text-sm font-medium italic">Sign here with mouse or touch</p>
            </div>
          )}
        </div>
      ) : (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current.click()}
          className={`border-2 border-dashed rounded-xl bg-gray-50 overflow-hidden w-full h-[200px] flex flex-col items-center justify-center cursor-pointer transition-all p-4 ${
            dragActive
              ? 'border-[#185FA5] bg-blue-50/50 scale-[0.99]'
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-100/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*"
            onChange={handleFileChange}
          />
          {uploadedImage ? (
            <div className="relative w-full h-full flex items-center justify-center group/preview">
              <img
                src={uploadedImage}
                alt="Uploaded Signature"
                className="max-h-full max-w-full object-contain p-2"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                <p className="text-white text-xs font-bold bg-gray-900/80 px-3 py-1.5 rounded-full">
                  Click to Change Image
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-2 pointer-events-none">
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto text-[#185FA5]">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="text-gray-700 text-sm font-semibold">Drag & drop your signature image</p>
                <p className="text-gray-400 text-xs mt-1">Supports PNG, JPG, JPEG (Max 2MB)</p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex w-full gap-3 justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={clear}
          className="rounded-xl border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-2"
        >
          <Trash2 className="h-4 w-4" /> Clear All
        </Button>
        <Button
          type="button"
          onClick={save}
          className="bg-[#185FA5] hover:bg-[#1451a0] text-white font-bold rounded-xl px-8 flex items-center gap-2 shadow-lg shadow-blue-100"
        >
          <Check className="h-4 w-4" /> Confirm Signature
        </Button>
      </div>

      <style jsx global>{`
        .signature-canvas {
          background-color: transparent;
          touch-action: none;
        }
      `}</style>
    </div>
  );
};

export default SignatureCanvas;
