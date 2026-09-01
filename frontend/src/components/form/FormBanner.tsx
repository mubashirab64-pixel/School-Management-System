"use client"

// components/form/FormBanner.tsx
//
// Form-level error banner. Shown when applyApiErrorsToForm() returns a
// message that couldn't be mapped to a specific field (network failure,
// server error, non-field validation error).

import { AlertCircle, X } from "lucide-react"

interface FormBannerProps {
  message?: string
  onDismiss?: () => void
}

export function FormBanner({ message, onDismiss }: FormBannerProps) {
  if (!message) return null

  return (
    <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3">
      <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
      <p className="text-sm text-red-800 font-medium flex-1">{message}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-red-400 hover:text-red-600 shrink-0"
          aria-label="Dismiss error"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
