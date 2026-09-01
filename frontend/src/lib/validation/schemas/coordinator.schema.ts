// lib/validation/schemas/coordinator.schema.ts

import * as v from 'valibot'
import {
  messages,
  optionalDateField,
  optionalPhoneLocalPkField,
  optionalPositiveNumberField,
  optionalSelectField,
  optionalString,
  optionalYearField,
  selectField,
} from '../common'
import {
  staffCampusField,
  staffCnicField,
  staffContactNumberField,
  staffDobField,
  staffEmailField,
  staffFullNameField,
  staffJoiningDateField,
  staffPermanentAddressField,
  staffShiftField,
} from './_staffShared'

const coordinatorBaseSchema = v.object({
  // Personal (step 1)
  photo: v.optional(v.union([v.instance(File), v.string(), v.null_()])),
  full_name: staffFullNameField(),
  dob: staffDobField(),
  gender: selectField('a gender'),
  contact_number: staffContactNumberField(),
  email: staffEmailField(),
  cnic: staffCnicField(),
  permanent_address: staffPermanentAddressField(),

  // Education (step 2)
  education_level: selectField('an education level'),
  institution_name: optionalString(),
  year_of_passing: optionalYearField('Year of passing'),
  total_experience_years: optionalPositiveNumberField('Total experience years'),

  // Work Assignment (step 3) — level is required only when shift !== 'both',
  // assigned_levels only when shift === 'both' (see partialCheck rules below).
  campus: staffCampusField(),
  level: optionalString(),
  assigned_levels: v.array(v.union([v.string(), v.number()])),
  shift: staffShiftField(),
  joining_date: staffJoiningDateField(),
  is_currently_active: v.boolean(),
  can_assign_class_teachers: v.boolean(),
  employee_code: optionalString(),
  biometric_id: optionalString(),
})

export const coordinatorCreateSchema = v.pipe(
  coordinatorBaseSchema,
  v.forward(
    v.partialCheck(
      [['shift'], ['level']],
      (input: { shift?: string; level?: string }) => input.shift === 'both' || !!input.level?.trim(),
      messages.required('Level')
    ),
    ['level']
  ),
  v.forward(
    v.partialCheck(
      [['shift'], ['assigned_levels']],
      (input: { shift?: string; assigned_levels?: unknown[] }) => input.shift !== 'both' || (Array.isArray(input.assigned_levels) && input.assigned_levels.length > 0),
      'At least one level is required when the shift is "Both".'
    ),
    ['assigned_levels']
  )
)

export type CoordinatorCreateInput = v.InferInput<typeof coordinatorCreateSchema>
export type CoordinatorCreateOutput = v.InferOutput<typeof coordinatorCreateSchema>

// Edit form (coordinator-edit-form.tsx) — plain-digit phone (no CNIC field
// in this dialog at all).
export const coordinatorEditSchema = v.object({
  full_name: staffFullNameField(),
  email: staffEmailField(),
  contact_number: optionalPhoneLocalPkField('Contact number'),
  dob: optionalDateField(),
  gender: optionalSelectField(),
  permanent_address: optionalString(),
  education_level: optionalSelectField(),
  institution_name: optionalString(),
  year_of_passing: optionalYearField('Year of passing'),
  total_experience_years: optionalPositiveNumberField('Total experience years'),
  joining_date: optionalDateField(),
  is_currently_active: v.boolean(),
  can_assign_class_teachers: v.boolean(),
  biometric_id: optionalString(),
})

export type CoordinatorEditInput = v.InferInput<typeof coordinatorEditSchema>
