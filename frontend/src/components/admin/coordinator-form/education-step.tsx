"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

const EDUCATION_LEVELS = [
  'Matric',
  'Intermediate',
  'Bachelor',
  'Master',
  'MPhil',
  'PhD',
  'Other'
];

interface EducationStepProps {
  formData: any
  onInputChange: (field: string, value: string) => void
  invalidFields: string[]
  formOptions?: any
}

export function EducationStep({ formData, onInputChange, invalidFields, formOptions }: EducationStepProps) {
  const educationOptions = (formOptions?.education_level && formOptions.education_level.length > 0)
    ? formOptions.education_level.map((opt: any) => opt.label)
    : EDUCATION_LEVELS;

  return (
    <Card className="border-2 shadow-sm rounded-3xl overflow-hidden bg-white">
      <CardHeader className="bg-gray-50/50 border-b">
        <CardTitle className="text-xl font-bold text-blue-900 flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white text-base">2</span>
            Education Details
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="education_level" className="font-semibold text-gray-700">Education Level *</Label>
            <Select 
              value={formData.education_level || ''} 
              onValueChange={(value) => onInputChange('education_level', value)}
            >
              <SelectTrigger className={`border-2 rounded-xl h-11 focus:border-blue-400 ${
                invalidFields.includes('education_level') ? 'border-red-500' : ''
              }`}>
                <SelectValue placeholder="Select education level" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {educationOptions.map((level: string) => (
                  <SelectItem key={level} value={level} className="py-2.5">
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {invalidFields.includes('education_level') && (
              <p className="text-xs text-red-500 mt-1">Education level is required</p>
            )}
          </div>

          <div>
            <Label htmlFor="institution_name" className="font-semibold text-gray-700">Institution Name *</Label>
            <Input
              id="institution_name"
              value={formData.institution_name || ''}
              onChange={(e) => onInputChange('institution_name', e.target.value)}
              placeholder="University/College name"
              className={`border-2 rounded-xl h-11 focus:border-blue-400 ${
                invalidFields.includes('institution_name') ? 'border-red-500' : ''
              }`}
            />
            {invalidFields.includes('institution_name') && (
              <p className="text-xs text-red-500 mt-1">Institution name is required</p>
            )}
          </div>

          <div>
            <Label htmlFor="year_of_passing" className="font-semibold text-gray-700">Year of Passing *</Label>
            <Input
              id="year_of_passing"
              type="number"
              value={formData.year_of_passing || ''}
              onChange={(e) => onInputChange('year_of_passing', e.target.value)}
              placeholder="2020"
              min="1950"
              max={new Date().getFullYear()}
              className={`border-2 rounded-xl h-11 focus:border-blue-400 ${
                invalidFields.includes('year_of_passing') ? 'border-red-500' : ''
              }`}
            />
            {invalidFields.includes('year_of_passing') && (
              <p className="text-xs text-red-500 mt-1">Year of passing is required</p>
            )}
          </div>

          <div>
            <Label htmlFor="total_experience_years" className="font-semibold text-gray-700">Total Experience (Years) *</Label>
            <Input
              id="total_experience_years"
              type="number"
              value={formData.total_experience_years || ''}
              onChange={(e) => onInputChange('total_experience_years', e.target.value)}
              placeholder="5"
              min="0"
              className={`border-2 rounded-xl h-11 focus:border-blue-400 ${
                invalidFields.includes('total_experience_years') ? 'border-red-500' : ''
              }`}
            />
            {invalidFields.includes('total_experience_years') && (
              <p className="text-xs text-red-500 mt-1">Experience years is required</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
