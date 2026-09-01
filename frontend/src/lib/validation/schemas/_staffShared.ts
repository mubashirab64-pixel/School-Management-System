// lib/validation/schemas/_staffShared.ts
//
// Fields shared verbatim across Teacher / Principal / Coordinator add-forms
// (all three use the same "+92 3XXXXXXXXX" country-code phone input and the
// same dashed CNIC input). Factored out once here so none of the three
// entity schemas re-declare the same rule.

import {
  addressField,
  cnicDashedField,
  dobField,
  emailField,
  nameField,
  optionalString,
  phoneWithCountryCodeField,
  requiredDateField,
  selectField,
} from '../common'

export const staffFullNameField = () => nameField('Full name')
export const staffFatherNameField = () => nameField("Father's name")
export const staffDobField = () => dobField('Date of birth', { minAge: 18 })
export const staffGenderField = () => selectField('a gender')
export const staffEmailField = () => emailField('Email')
export const staffCnicField = () => cnicDashedField('CNIC')
export const staffContactNumberField = () => phoneWithCountryCodeField('Contact number')
export const staffPermanentAddressField = () => addressField('Permanent address')
export const staffCurrentAddressField = () => addressField('Current address')
export const staffEducationLevelField = () => selectField('an education level')
export const staffInstitutionNameField = () => optionalString()
export const staffCampusField = () => selectField('a campus')
export const staffShiftField = () => selectField('a shift')
export const staffJoiningDateField = () => requiredDateField('Joining date')
export const staffBiometricIdField = () => optionalString()
