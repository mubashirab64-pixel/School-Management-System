// lib/validation/apiErrors.ts
//
// Normalizes backend error responses and maps field-specific errors onto the
// matching react-hook-form input via setError. Anything left over (network
// errors, non-field errors, unrecognized shapes) is returned as a single
// banner message for <FormBanner>.
//
// Understands every backend error shape found in this codebase:
//   1. New format:    { success: false, error: { message, code, details: { field: [msg] } } }
//      (this is what lib/api.ts's ApiError carries in .details / .message)
//   2. Legacy DRF:    { field: ["msg"], non_field_errors: ["msg"], detail: "msg" }
//   3. Plain Error / network failure with no structured body at all

import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { ApiError } from '@/lib/api'

function flatten(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(flatten).join(' ')
  if (value && typeof value === 'object') return Object.values(value).map(flatten).join(' ')
  return String(value)
}

/** Best-effort extraction of a { field: message } dict from any known error shape. */
function extractFieldDict(error: unknown): Record<string, string> {
  let raw: unknown = null

  if (error instanceof ApiError) {
    if (error.details && Object.keys(error.details).length > 0) {
      raw = error.details
    } else if (typeof error.response === 'string') {
      try {
        const parsed = JSON.parse(error.response)
        raw = parsed?.error?.details ?? parsed
      } catch {
        raw = null
      }
    }
  } else if (error && typeof error === 'object' && 'details' in (error as Record<string, unknown>)) {
    raw = (error as Record<string, unknown>).details
  }

  if (!raw || typeof raw !== 'object') return {}

  const dict: Record<string, string> = {}
  for (const [field, val] of Object.entries(raw as Record<string, unknown>)) {
    if (field === 'non_field_errors' || field === 'detail' || field === 'error') continue
    dict[field] = flatten(val)
  }
  return dict
}

function extractTopLevelMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Something went wrong while saving. Please check your connection and try again.'
}

/**
 * Applies backend field errors to the form via setError and returns a
 * banner message for anything that couldn't be mapped to a specific field.
 */
export function applyApiErrorsToForm<T extends FieldValues>(
  setError: UseFormSetError<T>,
  error: unknown
): string | undefined {
  const fieldDict = extractFieldDict(error)
  const fields = Object.keys(fieldDict)

  fields.forEach((field) => {
    setError(field as Path<T>, { type: 'server', message: fieldDict[field] })
  })

  if (fields.length > 0) return undefined

  return extractTopLevelMessage(error)
}
