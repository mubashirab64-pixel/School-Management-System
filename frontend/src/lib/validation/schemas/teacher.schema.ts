// lib/validation/schemas/teacher.schema.ts

import * as v from 'valibot'
import {
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
  selectField,
} from '../common'
import {
  staffBiometricIdField,
  staffCampusField,
  staffCnicField,
  staffContactNumberField,
  staffCurrentAddressField,
  staffDobField,
  staffEmailField,
  staffFatherNameField,
  staffFullNameField,
  staffJoiningDateField,
  staffShiftField,
} from './_staffShared'

// Fields the "Current Role" step manages (classroom/subject/coordinator
// pickers) are complex composite widgets, not simple text/select inputs —
// they're declared here as loose pass-through types so the whole form state
// stays in one Valibot-validated object, but their values aren't format-
// checked (there's nothing to format-check; they're id arrays/booleans).
export const teacherCreateSchema = v.object({
  // Personal (step 1)
  teacher_id: optionalString(),
  full_name: staffFullNameField(),
  father_name: staffFatherNameField(),
  dob: staffDobField(),
  gender: selectField('a gender'),
  contact_number: staffContactNumberField(),
  email: staffEmailField(),
  current_address: staffCurrentAddressField(),
  cnic: staffCnicField(),
  marital_status: selectField('a marital status'),
  biometric_id: staffBiometricIdField(),
  permanent_address: optionalString(),

  // Education (step 2) — all optional
  education_level: optionalSelectField(),
  institution_name: optionalString(),
  year_of_passing: optionalYearField('Year of passing'),
  education_subjects: optionalString(),
  education_grade: optionalString(),

  // Experience (step 3) — all optional
  previous_institution_name: optionalString(),
  previous_position: optionalString(),
  experience_from_date: optionalDateField(),
  experience_to_date: optionalDateField(),
  experience_subjects_classes_taught: optionalString(),
  previous_responsibilities: optionalString(),
  total_experience_years: optionalPositiveNumberField('Total experience years'),

  // Current Role (step 4)
  current_campus: staffCampusField(),
  joining_date: staffJoiningDateField(),
  shift: staffShiftField(),
  current_subjects: optionalString(),
  current_classes_taught: optionalString(),
  current_extra_responsibilities: optionalString(),
  current_role_title: optionalString(),

  // System / role-assignment fields — booleans and id arrays, no format rules
  is_currently_active: v.boolean(),
  is_class_teacher: v.boolean(),
  is_subject_teacher: v.boolean(),
  is_teacher_assistant: v.boolean(),
  class_teacher_level: optionalString(),
  class_teacher_grade: optionalString(),
  class_teacher_section: optionalString(),
  assigned_classroom: optionalString(),
  assigned_classrooms: v.array(v.number()),
  subject_teacher_assignments: v.array(v.object({ classroom_id: v.string(), subject_id: v.string() })),
  assigned_coordinators: v.array(v.number()),
})

export type TeacherCreateInput = v.InferInput<typeof teacherCreateSchema>
export type TeacherCreateOutput = v.InferOutput<typeof teacherCreateSchema>

// Edit form (teacher-edit-form.tsx) — plain-digit CNIC/phone, no country-code
// selector, matching what that dialog's inputs actually collect.
export const teacherEditSchema = v.object({
  full_name: optionalNameField(),
  father_name: optionalNameField(),
  email: optionalEmailField(),
  contact_number: optionalPhoneLocalPkField('Contact number'),
  dob: optionalDateField(),
  gender: optionalSelectField(),
  cnic: optionalCnicDigitsField(),
  biometric_id: optionalString(),
  permanent_address: optionalString(),
  education_level: optionalSelectField(),
  institution_name: optionalString(),
  year_of_passing: optionalYearField('Year of passing'),
  total_experience_years: optionalPositiveNumberField('Total experience years'),
  current_campus: optionalSelectField(),
  joining_date: optionalDateField(),
  shift: optionalSelectField(),
  current_subjects: optionalString(),
  current_classes_taught: optionalString(),
  current_extra_responsibilities: optionalString(),
  current_role_title: optionalString(),
  is_currently_active: v.boolean(),
})

export type TeacherEditInput = v.InferInput<typeof teacherEditSchema>
