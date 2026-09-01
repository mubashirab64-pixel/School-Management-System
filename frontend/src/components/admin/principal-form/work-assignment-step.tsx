"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DatePicker } from "@/components/ui/date-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface WorkAssignmentStepProps {
  formData: any
  invalidFields: string[]
  onInputChange: (field: string, value: any) => void
  campuses: any[]
  formOptions?: any
}

export function WorkAssignmentStep({ formData, invalidFields, onInputChange, campuses, formOptions }: WorkAssignmentStepProps) {
  return (
    <Card className="border-2 border-[#E7ECEF] shadow-lg bg-white">
      <CardContent className="pt-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Designation - Read Only Default */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-[#274C77]">
              Designation <span className="text-red-500">*</span>
            </Label>
            <Input
              value="Principal"
              disabled
              className="bg-gray-50 text-gray-700 border-gray-200 cursor-not-allowed h-10 font-medium"
            />
            <p className="text-[10px] text-gray-400 italic">Fixed designation for this module</p>
          </div>

          {/* Campus */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-[#274C77]">
              Campus <span className="text-red-500">*</span>
            </Label>
            <select
              value={formData.campus || ''}
              onChange={(e) => {
                const val = e.target.value
                console.log('[Campus Select] onChange value:', val, typeof val)
                onInputChange('campus', val)
              }}
              className={`h-10 w-full rounded-md border px-3 py-2 text-sm bg-white ${
                invalidFields.includes('campus')
                  ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 focus:ring-[#6096BA] focus:border-[#6096BA]'
              } outline-none transition-colors`}
            >
              <option value="">Select campus</option>
              {campuses.map((campus: any) => (
                <option key={campus.id} value={String(campus.id)}>
                  {campus.campus_name || campus.name}
                </option>
              ))}
            </select>
            {invalidFields.includes('campus') && (
              <p className="text-sm text-red-500">Please select a campus</p>
            )}
          </div>

          {/* Shift */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-[#274C77]">
              Shift <span className="text-red-500">*</span>
            </Label>
            <Select value={formData.shift || ''} onValueChange={(value) => onInputChange('shift', value)}>
              <SelectTrigger className={`h-10 ${invalidFields.includes('shift') ? 'border-red-500' : 'border-gray-300'}`}>
                <SelectValue placeholder="Select shift" />
              </SelectTrigger>
              <SelectContent>
                {(() => {
                  const defaultShifts = [
                    { value: 'morning', label: 'Morning' },
                    { value: 'afternoon', label: 'Afternoon' },
                    { value: 'both', label: 'Both' }
                  ];
                  
                  // Use formOptions if available, but ensure 'both' is included
                  let shifts = formOptions?.shift || defaultShifts;
                  if (formOptions?.shift && !formOptions.shift.some((s: any) => s.value === 'both')) {
                    shifts = [...formOptions.shift, { value: 'both', label: 'Both' }];
                  }
                  
                  return shifts.map((opt: any) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ));
                })()}
              </SelectContent>
            </Select>
          </div>

          {/* Contract Type */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-[#274C77]">
              Contract Type <span className="text-red-500">*</span>
            </Label>
            <Select 
              value={formData.contract_type || 'permanent'} 
              onValueChange={(value) => onInputChange('contract_type', value)}
            >
              <SelectTrigger className={`h-10 ${invalidFields.includes('contract_type') ? 'border-red-500' : 'border-gray-300'}`}>
                <SelectValue placeholder="Select contract type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="permanent">Permanent</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="visiting">Visiting</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Contract End Date - Conditional */}
          {formData.contract_type === 'contract' && (
            <div className="space-y-2">
              <DatePicker
                id="contract_end_date"
                label="Contract End Date"
                date={formData.contract_end_date}
                onChange={(v: string) => onInputChange('contract_end_date', v)}
                disabled={(date: Date) => date < new Date()}
              />
            </div>
          )}

          {/* Joining Date */}
          <div className="space-y-2">
            <DatePicker
              id="joining_date"
              label="Joining Date"
              required
              date={formData.joining_date}
              onChange={(v: string) => onInputChange('joining_date', v)}
              error={invalidFields.includes('joining_date')}
              disabled={(date: Date) => date > new Date()}
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-[#274C77]">
              Status <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.status || 'active'}
              onValueChange={(value) => onInputChange('status', value)}
            >
              <SelectTrigger className={`h-10 ${invalidFields.includes('status') ? 'border-red-500' : 'border-gray-300'}`}>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="on_leave">On Leave</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
