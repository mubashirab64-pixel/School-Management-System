// lib/validation/common.ts
//
// Shared Valibot primitives used by every entity schema (student, teacher,
// principal, coordinator, campus). Nothing in this file may reference or
// branch on the current user's role — these are pure field-shape rules.
//
// Two field "families" exist for phone/CNIC because the Add-forms and the
// Edit-forms genuinely use different input formats (not a role difference):
//   - Add forms:  country-code selector + local digits (e.g. "+92 3001234567"),
//                 dashed CNIC as you type (e.g. "42101-1234567-1")
//   - Edit forms: plain local input (e.g. "03001234567"), raw 13-digit CNIC
// Both share the same underlying digit-count rules and message wording.

import * as v from 'valibot'

// ---------------------------------------------------------------------------
// Regex constants
// ---------------------------------------------------------------------------

// Domain part must be made of valid labels (each starting/ending with an
// alphanumeric) — a plain [^\s@]+\.[^\s@]+ wrongly accepts "user@.example.com".
const EMAIL_REGEX = /^[^\s@]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/
const NAME_REGEX = /^[a-zA-Z\s.\-']+$/
const CNIC_DASHED_REGEX = /^\d{5}-\d{7}-\d$/

// ---------------------------------------------------------------------------
// Centralized error messages — every message here must be specific and
// actionable, never a generic "Invalid" / "Bad Request".
// ---------------------------------------------------------------------------

export const messages = {
  required: (label: string) => `${label} is required.`,
  invalidEmail: 'Please enter a valid email address.',
  invalidName: 'Name can only contain letters, spaces, dots, hyphens, and apostrophes.',
  nameTooShort: 'Name must be at least 2 characters.',
  nameTooLong: 'Name must be less than 200 characters.',
  invalidCnicDashed: 'CNIC must follow the format XXXXX-XXXXXXX-X (e.g. 42101-1234567-1).',
  invalidCnicDigits: 'CNIC must be exactly 13 digits.',
  invalidPhonePk: (label: string) => `${label} must be exactly 10 digits after the +92 country code (e.g. +92 3XXXXXXXXX).`,
  invalidPhoneIntl: (label: string) => `${label} must be between 7 and 15 digits.`,
  invalidPhoneLocalPk: (label: string) => `${label} must be a valid Pakistani number — 11 digits starting with 03 (e.g. 03121234567).`,
  invalidDate: 'Please enter a valid date.',
  dateInFuture: (label: string) => `${label} cannot be in the future.`,
  tooYoung: (label: string, minAge: number) => `${label} indicates an age below the minimum of ${minAge} years.`,
  tooOld: (label: string, maxAge: number) => `${label} indicates an age above the maximum of ${maxAge} years.`,
  selectRequired: (label: string) => `Please select ${label}.`,
  addressTooShort: 'Address must be at least 10 characters.',
  addressTooLong: 'Address must be less than 500 characters.',
  invalidNumber: (label: string) => `${label} must be a valid number.`,
  negativeNumber: (label: string) => `${label} must be a positive number.`,
  invalidInteger: (label: string) => `${label} must be a valid whole number.`,
  invalidYear: (label: string) => `${label} must be a valid year.`,
  yearOutOfRange: (label: string, min: number, max: number) => `${label} must be between ${min} and ${max}.`,
}

// ---------------------------------------------------------------------------
// Small UI-adjacent helpers shared with input onChange handlers
// ---------------------------------------------------------------------------

// Strips whitespace (incl. non-breaking/zero-width) and any non-ASCII characters
// (e.g. pasted homoglyphs) that look fine visually but fail backend email validation
// while being invisible in the input box.
export const sanitizeEmail = (value: string) => value.replace(/[^\x21-\x7E]/g, '')

// Auto-inserts CNIC dashes as the user types: 12345-1234567-1
export function formatCnicDashed(value: string): string {
  const clean = value.replace(/\D/g, '')
  if (clean.length > 5 && clean.length <= 12) return `${clean.slice(0, 5)}-${clean.slice(5)}`
  if (clean.length > 12) return `${clean.slice(0, 5)}-${clean.slice(5, 12)}-${clean.slice(12, 13)}`
  return clean
}

// ---------------------------------------------------------------------------
// Date / age helpers
// ---------------------------------------------------------------------------

function parseDateOrNull(value: string): Date | null {
  if (!value) return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

function calcAge(birthDate: Date): number {
  const today = new Date()
  const age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  return monthDiff < 0 ? age - 1 : age
}

// ---------------------------------------------------------------------------
// Phone helpers (country-code format, used by Add forms)
// ---------------------------------------------------------------------------

function parsePhoneWithCode(value: string): { countryCode: string; digits: string } {
  const trimmed = value.trim()
  const parts = trimmed.split(/\s+/)
  const countryCode = parts[0] || ''
  const localPart = parts.length > 1 ? parts.slice(1).join('') : (trimmed.startsWith('+') ? '' : trimmed)
  return { countryCode, digits: localPart.replace(/\D/g, '') }
}

function isValidPhoneWithCode(value: string): boolean {
  if (!value) return true // presence is enforced separately (minLength), not here
  const { countryCode, digits } = parsePhoneWithCode(value)
  if (!digits) return false
  if (countryCode === '+92') return digits.length === 10
  return digits.length >= 7 && digits.length <= 15
}

function phoneWithCodeMessage(fieldLabel: string) {
  return (issue: { input?: unknown }) => {
    const { countryCode } = parsePhoneWithCode(String(issue.input ?? ''))
    return countryCode === '+92' ? messages.invalidPhonePk(fieldLabel) : messages.invalidPhoneIntl(fieldLabel)
  }
}

// ---------------------------------------------------------------------------
// Phone helpers (plain local-PK format, used by Edit forms)
// ---------------------------------------------------------------------------

function isValidPhoneLocalPk(digits: string): boolean {
  if (!digits) return true
  return (digits.length === 11 && digits.startsWith('03')) || (digits.length === 12 && digits.startsWith('923'))
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** Required free-text field, e.g. campus_name, city, district. */
export function requiredString(fieldLabel: string) {
  return v.pipe(v.string(), v.trim(), v.minLength(1, messages.required(fieldLabel)))
}

/** Required free-text field with explicit length bounds. */
export function requiredStringBounded(fieldLabel: string, min: number, max: number) {
  return v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1, messages.required(fieldLabel)),
    v.minLength(min, `${fieldLabel} must be at least ${min} characters.`),
    v.maxLength(max, `${fieldLabel} must be less than ${max} characters.`)
  )
}

/** Optional free-text field — no format constraint, just trimmed. */
export function optionalString() {
  return v.pipe(v.string(), v.trim())
}

/** Person's full name — letters/spaces/dots/hyphens/apostrophes, 2-200 chars. */
export function nameField(fieldLabel = 'Name') {
  return v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1, messages.required(fieldLabel)),
    v.minLength(2, messages.nameTooShort),
    v.maxLength(200, messages.nameTooLong),
    v.regex(NAME_REGEX, messages.invalidName)
  )
}

/** Optional person's name (e.g. father/husband name on a staff form). */
export function optionalNameField() {
  return v.pipe(
    v.string(),
    v.trim(),
    v.check((val) => val === '' || val.length >= 2, messages.nameTooShort),
    v.check((val) => val === '' || val.length <= 200, messages.nameTooLong),
    v.check((val) => val === '' || NAME_REGEX.test(val), messages.invalidName)
  )
}

/** Required email address, sanitized (invisible/non-ASCII pasted chars stripped). */
export function emailField(fieldLabel = 'Email') {
  return v.pipe(
    v.string(),
    v.trim(),
    v.transform(sanitizeEmail),
    v.minLength(1, messages.required(fieldLabel)),
    v.regex(EMAIL_REGEX, messages.invalidEmail)
  )
}

/** Optional email address — same sanitization, format only checked if non-empty. */
export function optionalEmailField() {
  return v.pipe(
    v.string(),
    v.trim(),
    v.transform(sanitizeEmail),
    v.check((val) => val === '' || EMAIL_REGEX.test(val), messages.invalidEmail)
  )
}

/** Required CNIC in dashed format (XXXXX-XXXXXXX-X) — used by Add forms. */
export function cnicDashedField(fieldLabel = 'CNIC') {
  return v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1, messages.required(fieldLabel)),
    v.regex(CNIC_DASHED_REGEX, messages.invalidCnicDashed)
  )
}

/** Optional CNIC in dashed format. */
export function optionalCnicDashedField() {
  return v.pipe(
    v.string(),
    v.trim(),
    v.check((val) => val === '' || CNIC_DASHED_REGEX.test(val), messages.invalidCnicDashed)
  )
}

/** Optional CNIC as raw 13 digits (no dashes) — used by Edit forms. */
export function optionalCnicDigitsField() {
  return v.pipe(
    v.string(),
    v.transform((val) => val.replace(/\D/g, '')),
    v.check((val) => val === '' || val.length === 13, messages.invalidCnicDigits)
  )
}

/** Required phone with a country-code prefix, e.g. "+92 3001234567" — used by Add forms. */
export function phoneWithCountryCodeField(fieldLabel = 'Phone number') {
  return v.pipe(
    v.string(),
    v.minLength(1, messages.required(fieldLabel)),
    v.check(isValidPhoneWithCode, phoneWithCodeMessage(fieldLabel))
  )
}

/** Optional phone with a country-code prefix. */
export function optionalPhoneWithCountryCodeField(fieldLabel = 'Phone number') {
  return v.pipe(v.string(), v.check(isValidPhoneWithCode, phoneWithCodeMessage(fieldLabel)))
}

/** Optional plain local Pakistani phone, e.g. "03001234567" — used by Edit forms. */
export function optionalPhoneLocalPkField(fieldLabel = 'Phone number') {
  return v.pipe(
    v.string(),
    v.transform((val) => val.replace(/\D/g, '')),
    v.check(isValidPhoneLocalPk, messages.invalidPhoneLocalPk(fieldLabel))
  )
}

/** Required date of birth, optionally bounded by min/max age in years. */
export function dobField(fieldLabel: string, opts: { minAge?: number; maxAge?: number } = {}) {
  return v.pipe(
    v.string(),
    v.minLength(1, messages.required(fieldLabel)),
    v.check((val) => parseDateOrNull(val) !== null, messages.invalidDate),
    v.check((val) => {
      const d = parseDateOrNull(val)
      return !d || d <= new Date()
    }, messages.dateInFuture(fieldLabel)),
    v.check((val) => {
      const d = parseDateOrNull(val)
      if (!d || opts.minAge === undefined) return true
      return calcAge(d) >= opts.minAge
    }, messages.tooYoung(fieldLabel, opts.minAge ?? 0)),
    v.check((val) => {
      const d = parseDateOrNull(val)
      if (!d || opts.maxAge === undefined) return true
      return calcAge(d) <= opts.maxAge
    }, messages.tooOld(fieldLabel, opts.maxAge ?? 0))
  )
}

/** Required date field with no age semantics (joining_date, established_year, etc). */
export function requiredDateField(fieldLabel: string) {
  return v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1, messages.required(fieldLabel)),
    v.check((val) => parseDateOrNull(val) !== null, messages.invalidDate)
  )
}

/** Optional date field — format only checked if non-empty. */
export function optionalDateField() {
  return v.pipe(v.string(), v.check((val) => val === '' || parseDateOrNull(val) !== null, messages.invalidDate))
}

/** Required select/dropdown value (gender, shift, campus id, etc). */
export function selectField(fieldLabel: string) {
  return v.pipe(v.string(), v.trim(), v.minLength(1, messages.selectRequired(fieldLabel)))
}

/** Optional select/dropdown value. */
export function optionalSelectField() {
  return v.pipe(v.string(), v.trim())
}

/** Required free-text address, 10-500 characters. */
export function addressField(fieldLabel = 'Address') {
  return v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1, messages.required(fieldLabel)),
    v.minLength(10, messages.addressTooShort),
    v.maxLength(500, messages.addressTooLong)
  )
}

/** Optional free-text address — no length constraint. */
export function optionalAddressField() {
  return v.pipe(v.string(), v.trim())
}

/** Optional positive decimal number typed as a string (e.g. family income). */
export function optionalPositiveNumberField(fieldLabel: string) {
  return v.pipe(
    v.string(),
    v.trim(),
    v.check((val) => val === '' || !isNaN(parseFloat(val)), messages.invalidNumber(fieldLabel)),
    v.check((val) => val === '' || parseFloat(val) >= 0, messages.negativeNumber(fieldLabel))
  )
}

/** Optional positive whole number typed as a string (e.g. siblings count). */
export function optionalPositiveIntegerField(fieldLabel: string) {
  return v.pipe(
    v.string(),
    v.trim(),
    v.check((val) => val === '' || !isNaN(parseInt(val, 10)), messages.invalidInteger(fieldLabel)),
    v.check((val) => val === '' || parseInt(val, 10) >= 0, messages.negativeNumber(fieldLabel))
  )
}

/** Required positive whole number typed as a string (e.g. total classrooms). */
export function positiveIntegerField(fieldLabel: string) {
  return v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1, messages.required(fieldLabel)),
    v.check((val) => !isNaN(parseInt(val, 10)), messages.invalidInteger(fieldLabel)),
    v.check((val) => parseInt(val, 10) >= 0, messages.negativeNumber(fieldLabel))
  )
}

/** Optional year field bounded to [2000, currentYear + 5] (e.g. admission year). */
export function optionalYearField(fieldLabel: string) {
  const currentYear = new Date().getFullYear()
  const max = currentYear + 5
  return v.pipe(
    v.string(),
    v.trim(),
    v.check((val) => val === '' || !isNaN(parseInt(val, 10)), messages.invalidYear(fieldLabel)),
    v.check((val) => val === '' || (parseInt(val, 10) >= 2000 && parseInt(val, 10) <= max), messages.yearOutOfRange(fieldLabel, 2000, max))
  )
}

/** Password field — not used by the current 10 entity forms, kept for forms that add auth. */
export function passwordField(fieldLabel = 'Password', minLength = 6) {
  return v.pipe(v.string(), v.minLength(minLength, `${fieldLabel} must be at least ${minLength} characters.`))
}

// ---------------------------------------------------------------------------
// Single-field adapter — lets forms still on plain useState (not yet on
// useAppForm) call a shared primitive with the same {isValid, message} shape
// their old per-field validator classes returned, so call sites barely change.
// ---------------------------------------------------------------------------

export interface ValidationResult {
  isValid: boolean
  message?: string
}

export function parseField(schema: v.GenericSchema<any, any, any>, value: unknown): ValidationResult {
  const result = v.safeParse(schema, value)
  if (result.success) return { isValid: true }
  return { isValid: false, message: result.issues[0]?.message }
}

// ---------------------------------------------------------------------------
// Whole-object validation for forms still on plain useState — runs the full
// object schema, then reports back only the fields the caller asked about
// (e.g. the current wizard step), so "Next" on step 1 doesn't block on step
// 3's still-empty fields. This is what keeps validation RULES centralized in
// the schema even for forms that haven't been converted to useAppForm yet.
// ---------------------------------------------------------------------------

export function validateFields(
  schema: v.GenericSchema<any, any, any>,
  data: unknown,
  fieldsToCheck: string[]
): { invalid: string[]; messages: Record<string, string> } {
  const result = v.safeParse(schema, data)
  if (result.success) return { invalid: [], messages: {} }

  const invalid: string[] = []
  const messages: Record<string, string> = {}
  for (const issue of result.issues) {
    const field = issue.path?.[0]?.key as string | undefined
    if (!field || !fieldsToCheck.includes(field)) continue
    if (!invalid.includes(field)) invalid.push(field)
    if (!messages[field]) messages[field] = issue.message ?? 'Invalid value.'
  }
  return { invalid, messages }
}
