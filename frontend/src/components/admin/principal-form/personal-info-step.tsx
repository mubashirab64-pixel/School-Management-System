"use client"

import { useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DatePicker } from "@/components/ui/date-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle, Upload, X, Pencil, Wand2 } from "lucide-react"
import { formatCnicDashed, parseField } from "@/lib/validation/common"
import { staffContactNumberField } from "@/lib/validation/schemas/_staffShared"
import { getCountries, getCountryCallingCode } from "libphonenumber-js"

interface PersonalInfoStepProps {
  formData: any
  invalidFields: string[]
  onInputChange: (field: string, value: any) => void
  onBlurField?: (field: string) => void
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

// ── Employee ID Field with Auto / Manual toggle ───────────────────────────────
function EmployeeIdField({ formData, onInputChange }: { formData: any; onInputChange: (f: string, v: any) => void }) {
  const manual = formData.is_manual_id || false

  const switchToManual = () => {
    onInputChange("is_manual_id", true)
  }

  const switchToAuto = () => {
    onInputChange("is_manual_id", false)
    onInputChange("employee_code", "") // clear so backend generates
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <Label htmlFor="employee_code" className="text-sm font-semibold text-[#274C77]">Principal ID / Employee ID</Label>
        <button
          type="button"
          onClick={manual ? switchToAuto : switchToManual}
          className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
            manual
              ? "bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
              : "bg-gray-100 border-gray-300 text-gray-500 hover:bg-gray-200"
          }`}
        >
          {manual ? (
            <><Wand2 className="h-3 w-3" /> Auto-generate</>
          ) : (
            <><Pencil className="h-3 w-3" /> Enter Manually</>
          )}
        </button>
      </div>

      {manual ? (
        <Input
          id="employee_code"
          value={formData.employee_code || ""}
          onChange={(e) => onInputChange("employee_code", e.target.value)}
          placeholder="e.g. EMP-25-001"
          className="border-gray-300 focus:border-[#274C77] h-10"
        />
      ) : (
        <div className="relative">
          <Input
            id="employee_code"
            value={formData.employee_code || ""}
            readOnly
            placeholder="Auto-generated on save"
            className="bg-gray-50 text-gray-400 italic cursor-not-allowed border-gray-200 h-10"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
             <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Auto</span>
          </div>
        </div>
      )}
    </div>
  )
}

const PhoneInputWithCode = ({
  id,
  label,
  value,
  required = false,
  error,
  onChange,
  onBlur
}: {
  id: string,
  label: string,
  value: string,
  required?: boolean,
  error?: string,
  onChange: (val: string) => void,
  onBlur?: () => void
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
      <Label htmlFor={id} className="text-sm font-semibold text-[#274C77]">{label} {required && "*"}</Label>
      <div className="flex gap-2">
        <Select value={currentCode} onValueChange={handleCodeChange}>
          <SelectTrigger className={`w-[100px] border-gray-300 rounded-md h-10 ${isInvalid ? "border-red-500" : ""}`}>
            <SelectValue>{currentCode}</SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-md">
            {countryCodesList.map((c: any) => (
              <SelectItem key={`${c.iso}-${c.value}`} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          id={id}
          value={currentNum}
          onChange={(e) => handleNumChange(e.target.value)}
          onBlur={onBlur}
          className={`flex-1 border-gray-300 rounded-md h-10 ${isInvalid ? "border-red-500" : ""}`}
          placeholder="3XX-XXXXXXX"
          maxLength={15}
        />
      </div>
      {isInvalid && <p className="text-xs text-red-600 mt-1">{displayError}</p>}
    </div>
  )
}

export function PersonalInfoStep({ formData, invalidFields, onInputChange, onBlurField, formOptions }: PersonalInfoStepProps) {
  const handleCNICChange = (value: string) => {
    onInputChange('cnic', formatCnicDashed(value))
  }

  return (
    <Card className="border-2 border-[#E7ECEF] shadow-lg bg-white">
      <CardContent className="pt-6 space-y-6">
        {/* Profile Photo Row - True Full Width centered zone */}
        <div className="flex flex-col items-center justify-center space-y-3 mb-8 pb-8 border-b border-gray-100">
           <Label className="text-sm font-semibold text-[#274C77] self-start mb-1 px-1">Profile Photo (Optional)</Label>
           <div 
             className="w-full h-52 rounded-2xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center overflow-hidden bg-gray-50/50 relative group cursor-pointer hover:border-[#274C77] hover:bg-gray-50 transition-all shadow-sm"
             onClick={() => document.getElementById('photo-upload')?.click()}
           >
              {formData.photo ? (
                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                  <img src={typeof formData.photo === 'string' ? formData.photo : URL.createObjectURL(formData.photo)} alt="Preview" className="h-full w-auto object-contain shadow-md" />
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                     <div className="bg-white text-[#274C77] px-4 py-2 rounded-xl text-sm font-bold shadow-lg">Change Photo</div>
                  </div>
                </div>
              ) : (
                <div className="text-gray-400 flex flex-col items-center text-center p-6">
                  <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm mb-3 border border-gray-100 group-hover:scale-110 transition-transform">
                    <span className="text-2xl text-[#274C77]">+</span>
                  </div>
                  <p className="text-sm font-bold text-[#274C77]">Upload Principal Photo</p>
                  <p className="text-xs mt-1 text-gray-500">PNG, JPG or GIF. Click or drag & drop.</p>
                </div>
              )}
           </div>
           <input 
             id="photo-upload" 
             type="file" 
             className="hidden" 
             accept="image/*" 
             onChange={(e) => {
               const file = e.target.files?.[0]
               if (file) onInputChange('photo', file)
             }}
           />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Full Name */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-[#274C77]">
              Full Name <span className="text-red-500">*</span>
            </Label>
            <Input
              value={formData.full_name || ''}
              onChange={(e) => onInputChange('full_name', e.target.value)}
              onBlur={() => onBlurField?.('full_name')}
              placeholder="Enter full name"
              className={`h-10 ${invalidFields.includes('full_name') ? 'border-red-500' : 'border-gray-300'}`}
            />
          </div>

          {/* Employee ID (Moved here) */}
          <EmployeeIdField formData={formData} onInputChange={onInputChange} />

          {/* Biometric ID */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-violet-700">
              Biometric ID
            </Label>
            <Input
              value={formData.biometric_id || ''}
              onChange={(e) => onInputChange('biometric_id', e.target.value)}
              placeholder="Machine User ID (Optional)"
              className="h-10 border-gray-300 focus:border-violet-400"
            />
          </div>

          {/* Father's Name */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-[#274C77]">
              Father's Name <span className="text-red-500">*</span>
            </Label>
            <Input
              value={formData.father_name || ''}
              onChange={(e) => onInputChange('father_name', e.target.value)}
              onBlur={() => onBlurField?.('father_name')}
              placeholder="Enter father's name"
              className={`h-10 ${invalidFields.includes('father_name') ? 'border-red-500' : 'border-gray-300'}`}
            />
          </div>

          {/* Date of Birth */}
          <div className="space-y-2">
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* CNIC */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-[#274C77]">
              CNIC <span className="text-red-500">*</span>
            </Label>
            <Input
              value={formData.cnic || ''}
              onChange={(e) => onInputChange('cnic', formatCnicDashed(e.target.value))}
              onBlur={() => onBlurField?.('cnic')}
              placeholder="42101-1234567-1"
              maxLength={15}
              className={`h-10 ${invalidFields.includes('cnic') ? 'border-red-500' : 'border-gray-300'}`}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold text-[#274C77]">Email Address <span className="text-red-500">*</span></Label>
            <Input
              type="email"
              value={formData.email || ''}
              onChange={(e) => onInputChange('email', e.target.value)}
              onBlur={() => onBlurField?.('email')}
              placeholder="email@example.com"
              className={`h-10 ${invalidFields.includes('email') ? 'border-red-500' : 'border-gray-300'}`}
            />
          </div>

          <PhoneInputWithCode
            id="contact_number"
            label="Contact Number"
            required
            value={formData.contact_number || ""}
            error={invalidFields.includes('contact_number') ? 'Contact number is required' : ''}
            onChange={(v: string) => onInputChange("contact_number", v)}
            onBlur={() => onBlurField?.('contact_number')}
          />

          <PhoneInputWithCode
            id="emergency_contact"
            label="Emergency Contact"
            value={formData.emergency_contact || ""}
            onChange={(v: string) => onInputChange("emergency_contact", v)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-[#274C77]">Nationality</Label>
            <Input
              value={formData.nationality || 'Pakistani'}
              onChange={(e) => onInputChange('nationality', e.target.value)}
              placeholder="e.g. Pakistani"
              className="border-gray-300 h-10"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-[#274C77]">Religion</Label>
              <Select value={formData.religion || ''} onValueChange={(value) => onInputChange('religion', value)}>
                <SelectTrigger className="border-gray-300 h-10">
                  <SelectValue placeholder="Select religion" />
                </SelectTrigger>
                <SelectContent>
                  {(formOptions?.religion || [
                    { value: 'islam', label: 'Islam' },
                    { value: 'christianity', label: 'Christianity' },
                    { value: 'hinduism', label: 'Hinduism' },
                    { value: 'other', label: 'Other' }
                  ]).map((opt: any) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-[#274C77]">
                Gender <span className="text-red-500">*</span>
              </Label>
              <Select value={formData.gender || ''} onValueChange={(value) => onInputChange('gender', value)}>
                <SelectTrigger className={`h-10 ${invalidFields.includes('gender') ? 'border-red-500' : 'border-gray-300'}`}>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  {(formOptions?.gender || [
                    { value: 'male', label: 'Male' },
                    { value: 'female', label: 'Female' },
                    { value: 'other', label: 'Other' }
                  ]).map((opt: any) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Permanent Address */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-[#274C77]">
            Permanent Address <span className="text-red-500">*</span>
          </Label>
          <Textarea
            value={formData.permanent_address || ''}
            onChange={(e) => onInputChange('permanent_address', e.target.value)}
            onBlur={() => onBlurField?.('permanent_address')}
            placeholder="Enter complete permanent address"
            rows={2}
            className={`${invalidFields.includes('permanent_address') ? 'border-red-500' : 'border-gray-300'}`}
          />
        </div>
      </CardContent>
    </Card>
  )
}
