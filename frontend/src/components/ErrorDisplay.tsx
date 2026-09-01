"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, RefreshCw, ArrowLeft, LayoutDashboard, Clock, Hash } from "lucide-react";

interface ErrorDisplayProps {
  code?: string;
  message?: string;
  source?: string;
  timestamp?: string;
  errorId?: string;
  onRetry?: () => void;
}

const CODE_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  NOT_FOUND:        { bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200",  label: "404 Not Found" },
  UNAUTHORIZED:     { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200",label: "401 Unauthorized" },
  FORBIDDEN:        { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200",label: "403 Forbidden" },
  SERVER_ERROR:     { bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200",   label: "500 Server Error" },
  NETWORK_ERROR:    { bg: "bg-gray-50",   text: "text-gray-700",   border: "border-gray-200",  label: "Network Error" },
  BAD_REQUEST:      { bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200",   label: "400 Bad Request" },
  VALIDATION_ERROR: { bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200",   label: "422 Validation Error" },
};

const DEFAULT_STYLE = { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200", label: "Error" };

export function ErrorDisplay({
  code = "SERVER_ERROR",
  message = "An unexpected error occurred. Please try again.",
  source,
  timestamp,
  errorId,
  onRetry,
}: ErrorDisplayProps) {
  const router = useRouter();
  const isDev = process.env.NODE_ENV === "development";
  const style = CODE_STYLES[code] ?? DEFAULT_STYLE;

  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <div className={`w-full max-w-lg rounded-xl border ${style.border} ${style.bg} p-6 shadow-sm`}>
        {/* Badge */}
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className={`h-5 w-5 ${style.text}`} />
          <span className={`text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${style.border} ${style.text}`}>
            {style.label}
          </span>
        </div>

        {/* Message */}
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Something went wrong</h2>
        <p className="text-sm text-gray-600 mb-5">{message}</p>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 mb-5">
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          )}
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Go Back
          </button>
          <button
            onClick={() => router.push("/admin")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-[#274c77] rounded-md hover:bg-[#1a3557] transition-colors"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Dashboard
          </button>
        </div>

        {/* Dev details */}
        {isDev && (source || timestamp || errorId) && (
          <div className="border-t border-gray-200 pt-4 space-y-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Debug Info
            </p>
            {errorId && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Hash className="h-3 w-3" />
                <span>ID: {errorId}</span>
              </div>
            )}
            {timestamp && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Clock className="h-3 w-3" />
                <span>{timestamp}</span>
              </div>
            )}
            {source && (
              <div className="text-xs text-gray-500 font-mono bg-gray-100 rounded p-2 mt-1 break-all">
                {source}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
