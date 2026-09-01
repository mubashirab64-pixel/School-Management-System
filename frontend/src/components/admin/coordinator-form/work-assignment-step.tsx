"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { DatePicker } from "@/components/ui/date-picker"

interface WorkAssignmentStepProps {
  formData: any
  onInputChange: (field: string, value: string) => void
  invalidFields: string[]
  campuses: any[]
  levels: any[]
  onShiftChange?: (shift: string) => void
  formOptions?: any
}

export function WorkAssignmentStep({ formData, onInputChange, invalidFields, campuses, levels, onShiftChange, formOptions }: WorkAssignmentStepProps) {
  const handleCheckboxChange = (field: string, checked: boolean) => {
    onInputChange(field, checked.toString());
  };

  const handleShiftChange = (value: string) => {
    onInputChange('shift', value);
    if (onShiftChange) {
      onShiftChange(value);
    }
  };

  return (
    <Card className="border-2 shadow-sm rounded-3xl overflow-hidden bg-white">
      <CardHeader className="bg-gray-50/50 border-b">
        <CardTitle className="text-xl font-bold text-blue-900 flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white text-base">3</span>
            Work Assignment
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="campus" className="font-semibold text-gray-700">Campus *</Label>
            <Select 
              value={formData.campus?.toString() || ''} 
              onValueChange={(value) => onInputChange('campus', value)}
            >
              <SelectTrigger className={`border-2 rounded-xl h-11 focus:border-blue-400 ${
                invalidFields.includes('campus') ? 'border-red-500' : ''
              }`}>
                <SelectValue placeholder="Select campus" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {campuses.map((campus) => (
                  <SelectItem key={campus.id} value={campus.id.toString()} className="py-2.5">
                    {campus.campus_name} ({campus.campus_code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {invalidFields.includes('campus') && (
              <p className="text-xs text-red-500 mt-1">Campus is required</p>
            )}
          </div>

          <div>
            <Label htmlFor="shift" className="font-semibold text-gray-700">Shift *</Label>
            <Select 
              value={formData.shift || ''} 
              onValueChange={handleShiftChange}
            >
              <SelectTrigger className={`border-2 rounded-xl h-11 focus:border-blue-400 ${
                invalidFields.includes('shift') ? 'border-red-500' : ''
              }`}>
                <SelectValue placeholder="Select shift" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {(formOptions?.shift || [
                  { value: 'morning', label: 'Morning' },
                  { value: 'afternoon', label: 'Afternoon' },
                  { value: 'both', label: 'Both' }
                ]).map((opt: any) => (
                  <SelectItem key={opt.value} value={opt.value} className="py-2.5">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {invalidFields.includes('shift') && (
              <p className="text-xs text-red-500 mt-1">Shift is required</p>
            )}
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="level" className="font-semibold text-gray-700">Level *</Label>
            {formData.shift === 'both' ? (
              <div className={`rounded-2xl border-2 transition-all duration-200 overflow-hidden ${
                invalidFields.includes('assigned_levels') ? 'border-red-500 bg-red-50/30' : 'border-gray-200 bg-gray-50/30'
              }`}>
                <div className="max-h-52 overflow-auto p-3 space-y-2">
                  {levels.map((level) => {
                    const isChecked = Array.isArray(formData.assigned_levels) && formData.assigned_levels.includes(level.id)
                    const label = `${level.name} • ${(level.shift_display || (level.shift || '').toString()).toString()}${level.code ? ` • ${level.code}` : ''}`
                    return (
                      <div key={level.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-white transition-colors border border-transparent hover:border-gray-100">
                        <Checkbox
                          id={`level-${level.id}`}
                          checked={!!isChecked}
                          onCheckedChange={(checked) => {
                            const current: number[] = Array.isArray(formData.assigned_levels) ? formData.assigned_levels : []
                            if (checked) {
                              const updated = current.includes(level.id) ? current : [...current, level.id]
                              onInputChange('assigned_levels', updated as any)
                            } else {
                              const updated = current.filter((id) => id !== level.id)
                              onInputChange('assigned_levels', updated as any)
                            }
                          }}
                          className="h-5 w-5 rounded-md"
                        />
                        <Label htmlFor={`level-${level.id}`} className="text-sm font-medium cursor-pointer flex-1">
                          {label}
                        </Label>
                      </div>
                    )
                  })}
                </div>
                {invalidFields.includes('assigned_levels') && (
                  <p className="text-xs text-red-500 p-2 bg-red-50 border-t border-red-100 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Select at least one level for both shifts
                  </p>
                )}
              </div>
            ) : (
              <>
                <Select 
                  value={formData.level?.toString() || ''} 
                  onValueChange={(value) => onInputChange('level', value)}
                  disabled={!formData.campus}
                >
                  <SelectTrigger className={`border-2 rounded-xl h-11 focus:border-blue-400 ${
                    invalidFields.includes('level') ? 'border-red-500' : ''
                  }`}>
                    <SelectValue placeholder={formData.campus ? "Select level" : "Select campus first"} />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {levels.map((level) => (
                      <SelectItem key={level.id} value={level.id.toString()} className="py-2.5">
                        {`${level.name} • ${(level.shift_display || (level.shift || '').toString()).toString()}${level.code ? ` • ${level.code}` : ''}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {invalidFields.includes('level') && (
                  <p className="text-xs text-red-500 mt-1">Level is required</p>
                )}
              </>
            )}
          </div>

          <div>
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
        </div>

        {/* Checkboxes Wrapper */}
        <div className="bg-gray-50/50 p-4 rounded-2xl border-2 border-dashed border-gray-200 mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center space-x-3 p-2">
            <Checkbox
              id="is_currently_active"
              checked={formData.is_currently_active === 'true' || formData.is_currently_active === true}
              onCheckedChange={(checked) => handleCheckboxChange('is_currently_active', !!checked)}
              className="h-5 w-5 rounded-md"
            />
            <Label htmlFor="is_currently_active" className="font-semibold text-gray-700 cursor-pointer">
              Currently Active
            </Label>
          </div>

          <div className="flex items-center space-x-3 p-2">
            <Checkbox
              id="can_assign_class_teachers"
              checked={formData.can_assign_class_teachers === 'true' || formData.can_assign_class_teachers === true}
              onCheckedChange={(checked) => handleCheckboxChange('can_assign_class_teachers', !!checked)}
              className="h-5 w-5 rounded-md"
            />
            <Label htmlFor="can_assign_class_teachers" className="font-semibold text-gray-700 cursor-pointer">
              Can Assign Class Teachers
            </Label>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
