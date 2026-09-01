// lib/validation/schemas/campus.schema.ts

import * as v from 'valibot'
import { emailField, optionalEmailField, optionalPositiveIntegerField, optionalSelectField, optionalString, positiveIntegerField, requiredString, selectField } from '../common'

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

const campusBaseSchema = v.object({
  // General Information (step 1)
  campus_name: requiredString('Campus name'),
  campus_code: requiredString('Campus code'),
  campus_id: requiredString('Campus ID'),
  city: requiredString('City'),
  postal_code: requiredString('Postal code'),
  district: requiredString('District'),
  registration_number: requiredString('Registration number'),
  status: selectField('a status'),
  address_full: requiredString('Campus address'),
  shift_available: selectField('a shift'),
  campus_type: optionalSelectField(),
  established_year: optionalPositiveIntegerField('Established year'),
  governing_body: optionalString(),
  accreditation: optionalString(),
  instruction_language: optionalString(),
  academic_year_start_month: optionalString(),
  academic_year_end_month: optionalString(),
  grades_available: v.array(v.union([v.string(), v.number()])),
  campus_photo: v.optional(v.union([v.instance(File), v.string(), v.null_()])),

  // Facilities (step 2)
  total_classrooms: positiveIntegerField('Total classrooms'),
  total_staff_rooms: positiveIntegerField('Total staff rooms'),
  student_capacity: optionalPositiveIntegerField('Student capacity'),
  power_backup: v.boolean(),
  internet_available: v.boolean(),
  canteen_facility: v.boolean(),
  library_available: v.boolean(),
  student_transport: v.boolean(),
  sports_available: v.boolean(),

  // Contact & Info (step 3)
  campus_head_name: requiredString('Campus head name'),
  campus_head_email: optionalEmailField(),
  campus_head_phone: optionalString(),
  primary_phone: requiredString('Primary phone'),
  secondary_phone: optionalString(),
  official_email: emailField('Official email'),
})

export const campusCreateSchema = v.pipe(
  campusBaseSchema,
  v.forward(
    v.partialCheck(
      [['academic_year_start_month'], ['academic_year_end_month']],
      (input: { academic_year_start_month?: string; academic_year_end_month?: string }) => {
        if (!input.academic_year_start_month || !input.academic_year_end_month) return true
        const startIdx = MONTHS.indexOf(input.academic_year_start_month)
        const endIdx = MONTHS.indexOf(input.academic_year_end_month)
        if (startIdx === -1 || endIdx === -1) return true
        return endIdx >= startIdx
      },
      'Academic year end month must be after the start month.'
    ),
    ['academic_year_end_month']
  )
)

export type CampusCreateInput = v.InferInput<typeof campusCreateSchema>
export type CampusCreateOutput = v.InferOutput<typeof campusCreateSchema>

// The Edit Campus dialog (app/admin/campus/profile/page.tsx) currently has NO
// validation at all — this gives it the same rules as create, all optional
// (a field left blank on edit just means "don't change it").
export const campusEditSchema = v.object({
  campus_name: optionalString(),
  campus_code: optionalString(),
  city: optionalString(),
  postal_code: optionalString(),
  district: optionalString(),
  registration_number: optionalString(),
  status: optionalSelectField(),
  address_full: optionalString(),
  campus_head_name: optionalString(),
  campus_head_email: optionalEmailField(),
  campus_head_phone: optionalString(),
  primary_phone: optionalString(),
  secondary_phone: optionalString(),
  official_email: optionalEmailField(),
})

export type CampusEditInput = v.InferInput<typeof campusEditSchema>
