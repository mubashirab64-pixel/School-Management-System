import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const EDUCATION_LEVELS = [
  'Matric',
  'Intermediate',
  'Bachelor',
  'Master',
  'MPhil',
  'PhD',
  'Other'
];

interface ProfessionalInfoStepProps {
  formData: any
  invalidFields: string[]
  onInputChange: (field: string, value: any) => void
  formOptions?: any
}

export function ProfessionalInfoStep({ formData, invalidFields, onInputChange, formOptions }: ProfessionalInfoStepProps) {
  const educationOptions = (formOptions?.education_level && formOptions.education_level.length > 0)
    ? formOptions.education_level.map((opt: any) => opt.label)
    : EDUCATION_LEVELS;

  return (
    <Card className="border-2 border-[#E7ECEF] shadow-lg bg-white">
      <CardContent className="pt-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Education Level */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-[#274C77]">
              Education Level <span className="text-red-500">*</span>
            </Label>
            <Select 
              value={formData.education_level || ''} 
              onValueChange={(value) => onInputChange('education_level', value)}
            >
              <SelectTrigger className={`${invalidFields.includes('education_level') ? 'border-red-500' : 'border-gray-300'}`}>
                <SelectValue placeholder="Select education level" />
              </SelectTrigger>
              <SelectContent>
                {educationOptions.map((level: string) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Degree/Qualification Title */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-[#274C77]">
              Degree/Qualification Title <span className="text-red-500">*</span>
            </Label>
            <Input
              value={formData.degree_title || ''}
              onChange={(e) => onInputChange('degree_title', e.target.value)}
              placeholder="e.g. M.Ed, MA English"
              className={`${invalidFields.includes('degree_title') ? 'border-red-500' : 'border-gray-300'}`}
            />
          </div>

          {/* Institution Name */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-[#274C77]">
              Institution Name <span className="text-red-500">*</span>
            </Label>
            <Input
              value={formData.institution_name || ''}
              onChange={(e) => onInputChange('institution_name', e.target.value)}
              placeholder="Name of the institution"
              className={`${invalidFields.includes('institution_name') ? 'border-red-500' : 'border-gray-300'}`}
            />
          </div>

          {/* Year of Passing */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-[#274C77]">
              Year of Passing <span className="text-red-500">*</span>
            </Label>
            <Input
              type="number"
              value={formData.year_of_passing || ''}
              onChange={(e) => onInputChange('year_of_passing', e.target.value)}
              placeholder="e.g., 2020"
              min="1950"
              max={new Date().getFullYear()}
              className={`${invalidFields.includes('year_of_passing') ? 'border-red-500' : 'border-gray-300'}`}
            />
          </div>

          {/* Total Experience Years */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-[#274C77]">
              Total Experience (Years) <span className="text-red-500">*</span>
            </Label>
            <Input
              type="number"
              value={formData.total_experience_years || ''}
              onChange={(e) => onInputChange('total_experience_years', e.target.value)}
              placeholder="e.g., 10"
              min="0"
              max="50"
              className={`${invalidFields.includes('total_experience_years') ? 'border-red-500' : 'border-gray-300'}`}
            />
          </div>

          {/* Specialization */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-[#274C77]">Specialization/Subject</Label>
            <Input
              value={formData.specialization || ''}
              onChange={(e) => onInputChange('specialization', e.target.value)}
              placeholder="e.g. Mathematics, Administration"
              className="border-gray-300"
            />
          </div>

          {/* Previous Organization */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-[#274C77]">Previous Organization</Label>
            <Input
              value={formData.previous_organization || ''}
              onChange={(e) => onInputChange('previous_organization', e.target.value)}
              placeholder="Last school/company name"
              className="border-gray-300"
            />
          </div>

          {/* Previous Designation */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-[#274C77]">Previous Designation</Label>
            <Input
              value={formData.previous_designation || ''}
              onChange={(e) => onInputChange('previous_designation', e.target.value)}
              placeholder="e.g. Vice Principal, Coordinator"
              className="border-gray-300"
            />
          </div>

          {/* Teaching License */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-[#274C77]">Teaching License / Reg No.</Label>
            <Input
              value={formData.license_number || ''}
              onChange={(e) => onInputChange('license_number', e.target.value)}
              placeholder="Enter license or registration number"
              className="border-gray-300"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
