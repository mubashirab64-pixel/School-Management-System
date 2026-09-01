// lib/validation/schemas/principal.schema.ts

import * as v from 'valibot'
import {
  optionalCnicDigitsField,
  optionalDateField,
  optionalPhoneLocalPkField,
  optionalPhoneWithCountryCodeField,
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
  staffFatherNameField,
  staffFullNameField,
  staffJoiningDateField,
  staffPermanentAddressField,
  staffShiftField,
} from './_staffShared'

export const principalCreateSchema = v.object({
  // Personal (step 1)
  photo: v.optional(v.union([v.instance(File), v.string(), v.null_()])),
  full_name: staffFullNameField(),
  father_name: staffFatherNameField(),
  dob: staffDobField(),
  gender: selectField('a gender'),
  cnic: staffCnicField(),
  nationality: optionalString(),
  religion: optionalSelectField(),
  contact_number: staffContactNumberField(),
  emergency_contact: optionalPhoneWithCountryCodeField('Emergency contact'),
  email: staffEmailField(),
  permanent_address: staffPermanentAddressField(),
  marital_status: optionalSelectField(),
  biometric_id: optionalString(),

  // Professional (step 2)
  education_level: selectField('an education level'),
  degree_title: optionalString(),
  institution_name: optionalString(),
  year_of_passing: optionalYearField('Year of passing'),
  total_experience_years: optionalPositiveNumberField('Total experience years'),
  specialization: optionalString(),
  previous_organization: optionalString(),
  previous_designation: optionalString(),
  license_number: optionalString(),

  // Work Assignment (step 3)
  employee_code: optionalString(),
  is_manual_id: v.boolean(),
  designation: optionalSelectField(),
  campus: staffCampusField(),
  shift: staffShiftField(),
  contract_type: selectField('a contract type'),
  contract_end_date: optionalDateField(),
  joining_date: staffJoiningDateField(),
  status: selectField('a status'),
  is_currently_active: v.boolean(),
})

export type PrincipalCreateInput = v.InferInput<typeof principalCreateSchema>
export type PrincipalCreateOutput = v.InferOutput<typeof principalCreateSchema>

// Edit form (principal-edit-form.tsx) — plain-digit CNIC/phone.
export const principalEditSchema = v.object({
  full_name: staffFullNameField(),
  email: staffEmailField(),
  contact_number: optionalPhoneLocalPkField('Contact number'),
  cnic: optionalCnicDigitsField(),
  dob: optionalDateField(),
  gender: optionalSelectField(),
  permanent_address: optionalString(),
  education_level: optionalSelectField(),
  institution_name: optionalString(),
  year_of_passing: optionalYearField('Year of passing'),
  total_experience_years: optionalPositiveNumberField('Total experience years'),
  campus: optionalSelectField(),
  shift: optionalSelectField(),
  joining_date: optionalDateField(),
  is_currently_active: v.boolean(),
  biometric_id: optionalString(),
})

export type PrincipalEditInput = v.InferInput<typeof principalEditSchema>
