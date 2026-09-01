"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle,CheckCircle,Pencil } from "lucide-react"
import { useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { formatCnicDashed, parseField } from "@/lib/validation/common"
import { staffContactNumberField } from "@/lib/validation/schemas/_staffShared"
import { DatePicker } from "@/components/ui/date-picker"
import { getCountries, getCountryCallingCode } from "libphonenumber-js"
import { Loader2 } from "lucide-react"
import { checkEmailExists } from "@/lib/api"

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

import { Checkbox } from "@/components/ui/checkbox"

interface PersonalInfoStepProps {
  formData: any
  onInputChange: (field: string, value: string) => void
  invalidFields: string[]
  duplicateErrors: {[key: string]: string}
  isAutoGenerateId: boolean
  setIsAutoGenerateId: (val: boolean) => void
  onBlurCheck?: (field: string, value: string) => void
  formOptions?: any
}

const countryCodesList = (() => {
  try {
    const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
    return getCountries()
      .map(country => ({
        label: `${country} (+${getCountryCallingCode(country)})`,
        value: `+${getCountryCallingCode(country)}`,
        iso: country
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  } catch (e) {
    return [{ label: "PK (+92)", value: "+92", iso: "PK" }];
  }
})();

const PhoneInputWithCode = ({ 
  id, 
  label, 
  value, 
  required = false, 
  error,
  onChange 
}: { 
  id: string, 
  label: string, 
  value: string, 
  required?: boolean,
  error?: string,
  onChange: (val: string) => void 
}) => {
  const parts = (value || "").split(" ")
  const currentCode = parts.length > 1 ? parts[0] : "+92"
  const currentNum = parts.length > 1 ? parts[1] : (value || "").replace(/^\+\d+\s?/, "")

  const handleCodeChange = (code: string) => {
    onChange(`${code} ${currentNum}`)
  }

  const handleNumChange = (num: string) => {
    let cleanNum = num.replace(/\D/g, '')
    if (cleanNum.startsWith('0')) {
      cleanNum = cleanNum.substring(1)
    }
    cleanNum = cleanNum.slice(0, 15)
    onChange(`${currentCode} ${cleanNum}`)
  }

  const validationResult = value ? parseField(staffContactNumberField(), value) : null;
  const isInvalid = error || (validationResult && !validationResult.isValid);
  const displayError = (validationResult && !validationResult.isValid) ? validationResult.message : error;

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="font-semibold text-gray-700">{label} {required && "*"}</Label>
      <div className="flex gap-2">
        <Select value={currentCode} onValueChange={handleCodeChange}>
          <SelectTrigger className={`w-[110px] border-2 rounded-xl h-11 ${isInvalid ? "border-red-500" : ""}`}>
            <SelectValue>{currentCode}</SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {countryCodesList.map((c: any) => (
              <SelectItem key={`${c.iso}-${c.value}`} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          id={id}
          value={currentNum}
          onChange={(e) => handleNumChange(e.target.value)}
          className={`flex-1 border-2 rounded-xl h-11 focus:border-blue-400 ${isInvalid ? "border-red-500" : ""}`}
          placeholder="3XX-XXXXXXX"
          maxLength={15}
        />
      </div>
      {isInvalid && <p className="text-xs text-red-600 mt-1">{displayError}</p>}
    </div>
  )
}

export function PersonalInfoStep({ 
  formData, 
  onInputChange, 
  invalidFields, 
  duplicateErrors = {},
  isAutoGenerateId,
  setIsAutoGenerateId,
  onBlurCheck,
  formOptions
}: PersonalInfoStepProps) {
  const handleBlur = (field: string) => {
    if (onBlurCheck && formData[field]) {
      onBlurCheck(field, formData[field]);
    }
  };

  const genderOptions = (formOptions?.gender?.length > 0) ? formOptions.gender : GENDER_OPTIONS;

  return (
    <Card className="border-2 shadow-sm rounded-3xl overflow-hidden bg-white">
      <CardHeader className="bg-gray-50/50 border-b">
        <CardTitle className="text-xl font-bold text-blue-900 flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white text-base">1</span>
            Personal Information
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Employee ID Field */}
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-1.5">
              <Label htmlFor="employee_code" className="font-semibold text-gray-700">Coordinator ID</Label>
              <button
                type="button"
                onClick={() => setIsAutoGenerateId?.(!isAutoGenerateId)}
                className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full border transition-all duration-200 shadow-sm ${
                  isAutoGenerateId
                    ? "bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
                    : "bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100"
                }`}
              >
                {isAutoGenerateId ? (
                  <><CheckCircle className="h-3.5 w-3.5" /> Auto-generate ON</>
                ) : (
                  <><Pencil className="h-3.5 w-3.5" /> Enter ID Manually</>
                )}
              </button>
            </div>
            <Input
              id="employee_code"
              value={isAutoGenerateId ? 'AUTO-GENERATED' : (formData.employee_code || '')}
              onChange={(e) => onInputChange('employee_code', e.target.value)}
              disabled={isAutoGenerateId}
              placeholder={isAutoGenerateId ? 'Backend will generate ID' : 'Enter custom ID'}
              className={`border-2 rounded-xl h-11 focus:border-blue-400 ${
                isAutoGenerateId ? 'bg-gray-50 text-gray-400 font-mono italic border-dashed' : ''
              } ${
                !isAutoGenerateId && invalidFields.includes('employee_code') ? 'border-red-500' : ''
              }`}
            />
          </div>

          <div>
            <Label htmlFor="biometric_id" className="font-semibold text-violet-700 flex items-center gap-2 mb-1.5">
              <span className="h-5 w-5 bg-violet-600 rounded text-white flex items-center justify-center text-[10px]">ZK</span>
              Biometric ID (Optional)
            </Label>
            <Input
              id="biometric_id"
              value={formData.biometric_id || ""}
              onChange={(e) => onInputChange("biometric_id", e.target.value)}
              placeholder="Machine User ID"
              className="border-2 rounded-xl h-11 focus:border-violet-400"
            />
          </div>

          <div>
            <Label htmlFor="full_name" className="font-semibold text-gray-700">Full Name *</Label>
            <Input
              id="full_name"
              value={formData.full_name || ''}
              onChange={(e) => onInputChange('full_name', e.target.value)}
              placeholder="Enter full name"
              className={`border-2 rounded-xl h-11 focus:border-blue-400 ${
                invalidFields.includes('full_name') ? 'border-red-500' : ''
              }`}
            />
            {invalidFields.includes('full_name') && (
              <p className="text-xs text-red-500 mt-1">Full name is required</p>
            )}
          </div>

          <div>
            <DatePicker
              id="dob"
              label="Date of Birth"
              required
              date={formData.dob}
              onChange={(v: string) => onInputChange('dob', v)}
              error={invalidFields.includes('dob')}
              disabled={(date: Date) => date > new Date() || date < new Date('1900-01-01')}
            />
          </div>

          <div>
            <Label htmlFor="gender" className="font-semibold text-gray-700">Gender *</Label>
            <Select 
              value={formData.gender || ''} 
              onValueChange={(value) => onInputChange('gender', value)}
            >
              <SelectTrigger className={`border-2 rounded-xl h-11 focus:border-blue-400 ${
                invalidFields.includes('gender') ? 'border-red-500' : ''
              }`}>
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {genderOptions.map((option: any) => (
                  <SelectItem key={option.value} value={option.value} className="py-2.5">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {invalidFields.includes('gender') && (
              <p className="text-xs text-red-500 mt-1">Gender is required</p>
            )}
          </div>

          <div>
            <Label htmlFor="marital_status" className="font-semibold text-gray-700">Marital Status</Label>
            <Select 
              value={formData.marital_status || ''} 
              onValueChange={(value) => onInputChange('marital_status', value)}
            >
              <SelectTrigger className="border-2 rounded-xl h-11 focus:border-blue-400">
                <SelectValue placeholder="Select marital status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {(formOptions?.marital_status?.length > 0 ? formOptions.marital_status : [
                  { value: 'single', label: 'Single' },
                  { value: 'married', label: 'Married' },
                  { value: 'divorced', label: 'Divorced' },
                  { value: 'widowed', label: 'Widowed' }
                ]).map((option: any) => (
                  <SelectItem key={option.value} value={option.value} className="py-2.5">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="religion" className="font-semibold text-gray-700">Religion</Label>
            <Select 
              value={formData.religion || ''} 
              onValueChange={(value) => onInputChange('religion', value)}
            >
              <SelectTrigger className="border-2 rounded-xl h-11 focus:border-blue-400">
                <SelectValue placeholder="Select religion" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {(formOptions?.religion?.length > 0 ? formOptions.religion : [
                  { value: 'islam', label: 'Islam' },
                  { value: 'christianity', label: 'Christianity' },
                  { value: 'hinduism', label: 'Hinduism' },
                  { value: 'sikhism', label: 'Sikhism' },
                  { value: 'other', label: 'Other' }
                ]).map((option: any) => (
                  <SelectItem key={option.value} value={option.value} className="py-2.5">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <PhoneInputWithCode
            id="contact_number"
            label="Contact Number"
            required
            value={formData.contact_number || ""}
            error={invalidFields.includes('contact_number') ? 'Contact number is required' : ''}
            onChange={(v: string) => onInputChange("contact_number", v)}
          />

          <div>
            <Label htmlFor="email" className="font-semibold text-gray-700">Email Address *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email || ''}
              onChange={(e) => onInputChange('email', e.target.value)}
              onBlur={() => handleBlur('email')}
              placeholder="coordinator@school.com"
              className={`border-2 rounded-xl h-11 focus:border-blue-400 ${
                invalidFields.includes('email') || duplicateErrors.email ? 'border-red-500' : ''
              }`}
            />
            {invalidFields.includes('email') && (
              <p className="text-xs text-red-500 mt-1">Email is required</p>
            )}
            {duplicateErrors.email && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1 font-bold">
                <AlertCircle className="h-3.5 w-3.5" />
                {duplicateErrors.email}
              </p>
            )}
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="cnic" className="font-semibold text-gray-700">CNIC *</Label>
            <Input
              id="cnic"
              value={formData.cnic || ''}
              onChange={(e) => onInputChange('cnic', formatCnicDashed(e.target.value))}
              onBlur={() => handleBlur('cnic')}
              placeholder="12345-1234567-1"
              maxLength={15}
              className={`border-2 rounded-xl h-11 focus:border-blue-400 ${
                invalidFields.includes('cnic') || duplicateErrors.cnic ? 'border-red-500' : ''
              }`}
            />
            {invalidFields.includes('cnic') && (
              <p className="text-xs text-red-500 mt-1">CNIC is required</p>
            )}
            {duplicateErrors.cnic && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1 font-bold">
                <AlertCircle className="h-3.5 w-3.5" />
                {duplicateErrors.cnic}
              </p>
            )}
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="permanent_address" className="font-semibold text-gray-700">Permanent Address *</Label>
            <Textarea
              id="permanent_address"
              value={formData.permanent_address || ''}
              onChange={(e) => onInputChange('permanent_address', e.target.value)}
              placeholder="Enter complete address"
              className={`border-2 rounded-2xl min-h-[100px] focus:border-blue-400 resize-none ${
                invalidFields.includes('permanent_address') ? 'border-red-500' : ''
              }`}
            />
            {invalidFields.includes('permanent_address') && (
              <p className="text-xs text-red-500 mt-1">Address is required</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
