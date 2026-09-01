// lib/validation/schemas/student.schema.ts
//
// Field names match the existing `formData` keys used by studentform.tsx and
// its step components exactly (camelCase where the form already used
// camelCase, snake_case where it already used snake_case) — this schema only
// changes how those fields are validated, not what they are.

import * as v from 'valibot'
import {
  addressField,
  dobField,
  nameField,
  optionalCnicDashedField,
  optionalCnicDigitsField,
  optionalDateField,
  optionalEmailField,
  optionalNameField,
  optionalPhoneLocalPkField,
  optionalPhoneWithCountryCodeField,
  optionalPositiveIntegerField,
  optionalPositiveNumberField,
  optionalSelectField,
  optionalString,
  optionalYearField,
  phoneWithCountryCodeField,
  selectField,
} from '../common'

const studentBaseSchema = v.object({
  // Step 1 — Personal Details
  student_id: optionalString(),
  name: nameField('Student name'),
  email: optionalEmailField(),
  gender: selectField('a gender'),
  dob: dobField('Date of birth', { minAge: 3, maxAge: 25 }),
  placeOfBirth: optionalString(),
  religion: selectField('a religion'),
  motherTongue: selectField('a mother tongue'),
  student_cnic: optionalCnicDashedField(),
  nationality: optionalSelectField(),
  blood_group: optionalSelectField(),
  special_needs_disability: optionalSelectField(),

  // Step 2 — Family & Contact Details
  phoneNumber: optionalPhoneWithCountryCodeField("Student's phone number"),
  emergencyContact: phoneWithCountryCodeField('Emergency contact number'),
  emergency_relationship: optionalSelectField(),
  address: addressField('Address'),
  familyIncome: optionalPositiveNumberField('Family income'),
  houseOwned: optionalSelectField(),
  zakatStatus: optionalSelectField(),
  fatherStatus: optionalSelectField(),
  fatherName: optionalNameField(),
  fatherCNIC: optionalCnicDashedField(),
  fatherContact: optionalPhoneWithCountryCodeField('Father contact number'),
  fatherProfession: optionalString(),
  motherName: optionalNameField(),
  motherContact: optionalPhoneWithCountryCodeField('Mother contact number'),
  siblingsCount: optionalPositiveIntegerField('Siblings count'),

  // Guardian info — only truly required when fatherStatus === "dead"
  // (see the partialCheck rules forwarded onto each field below).
  guardianName: optionalNameField(),
  guardianRelation: optionalString(),
  guardianCNIC: optionalCnicDashedField(),
  guardianContact: optionalPhoneWithCountryCodeField('Guardian phone number'),
  guardianProfession: optionalString(),

  // No dedicated input renders this — kept so the payload always carries a
  // value, matching the fixed "married" default the form has always used.
  motherStatus: optionalString(),

  // Step 3 — Academic Details
  campus: selectField('a campus'),
  shift: selectField('a shift'),
  currentGrade: selectField('a grade/class'),
  section: selectField('a section'),
  admissionYear: optionalYearField('Enrollment year'),
  classroom: optionalString(),
})

function guardianFieldRequired(field: string) {
  return (input: { fatherStatus?: string } & Record<string, unknown>): boolean => {
    if (input.fatherStatus !== 'dead') return true
    const value = input[field]
    return typeof value === 'string' && value.trim().length > 0
  }
}

export const studentCreateSchema = v.pipe(
  studentBaseSchema,
  v.forward(
    v.partialCheck(
      [['fatherStatus'], ['guardianName']],
      guardianFieldRequired('guardianName'),
      'Guardian name is required when father is deceased.'
    ),
    ['guardianName']
  ),
  v.forward(
    v.partialCheck(
      [['fatherStatus'], ['guardianRelation']],
      guardianFieldRequired('guardianRelation'),
      "Guardian's relation to student is required when father is deceased."
    ),
    ['guardianRelation']
  ),
  v.forward(
    v.partialCheck(
      [['fatherStatus'], ['guardianCNIC']],
      guardianFieldRequired('guardianCNIC'),
      'Guardian CNIC is required when father is deceased.'
    ),
    ['guardianCNIC']
  ),
  v.forward(
    v.partialCheck(
      [['fatherStatus'], ['guardianContact']],
      guardianFieldRequired('guardianContact'),
      'Guardian phone number is required when father is deceased.'
    ),
    ['guardianContact']
  ),
  v.forward(
    v.partialCheck(
      [['fatherStatus'], ['guardianProfession']],
      guardianFieldRequired('guardianProfession'),
      'Guardian profession is required when father is deceased.'
    ),
    ['guardianProfession']
  )
)

export type StudentCreateInput = v.InferInput<typeof studentCreateSchema>
export type StudentCreateOutput = v.InferOutput<typeof studentCreateSchema>

// Edit form field names/format match student-edit-form.tsx's editFormData
// exactly — CNIC/phone there are plain digits (no dashes/country-code), so
// they use the Edit-form primitives, not the Add-form ones above.
export const studentEditSchema = v.object({
  name: nameField('Student name'),
  gender: optionalSelectField(),
  dob: optionalDateField(),
  place_of_birth: optionalString(),
  religion: optionalSelectField(),
  mother_tongue: optionalSelectField(),
  email: optionalEmailField(),
  phone_number: optionalPhoneLocalPkField('Student phone'),
  emergency_contact: optionalPhoneLocalPkField('Emergency contact'),
  special_needs_disability: optionalSelectField(),
  father_name: optionalNameField(),
  father_cnic: optionalCnicDigitsField(),
  father_contact: optionalPhoneLocalPkField('Father contact'),
  father_profession: optionalString(),
  father_status: optionalSelectField(),
  address: optionalString(),
  guardian_name: optionalNameField(),
  guardian_cnic: optionalCnicDigitsField(),
  guardian_contact: optionalPhoneLocalPkField('Guardian contact'),
  guardian_relation: optionalString(),
  mother_name: optionalNameField(),
  mother_contact: optionalPhoneLocalPkField('Mother contact'),
  mother_cnic: optionalCnicDigitsField(),
  mother_profession: optionalString(),
  student_cnic: optionalCnicDigitsField(),
  nationality: optionalSelectField(),
  blood_group: optionalSelectField(),
  family_income: optionalPositiveNumberField('Family income'),
  zakat_status: optionalSelectField(),
  house_owned: optionalSelectField(),
})

export type StudentEditInput = v.InferInput<typeof studentEditSchema>
