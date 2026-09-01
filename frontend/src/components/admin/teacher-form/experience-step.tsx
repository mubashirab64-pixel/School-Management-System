"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DatePicker } from "@/components/ui/date-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface ExperienceStepProps {
  formData: any
  invalidFields: string[]
  onInputChange: (field: string, value: string) => void
}

export function ExperienceStep({ formData, invalidFields, onInputChange }: ExperienceStepProps) {
  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle>Work Experience</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label htmlFor="previous_institution_name">Previous Institution Name (Optional)</Label>
            <Input 
              id="previous_institution_name" 
              value={formData.previous_institution_name || ""} 
              onChange={(e) => onInputChange("previous_institution_name", e.target.value)}
              placeholder="e.g., ABC School"
            />
          </div>
          
          <div>
            <Label htmlFor="previous_position">Previous Position (Optional)</Label>
            <Input 
              id="previous_position" 
              value={formData.previous_position || ""} 
              onChange={(e) => onInputChange("previous_position", e.target.value)}
              placeholder="e.g., Math Teacher"
            />
          </div>
          
          <div>
            <Label htmlFor="total_experience_years">Total Experience Years (Optional)</Label>
            <Input 
              id="total_experience_years" 
              type="number" 
              step="0.1"
              min="0"
              max="50"
              placeholder="e.g., 5.5"
              value={formData.total_experience_years || ""} 
              onChange={(e) => onInputChange("total_experience_years", e.target.value)} 
            />
          </div>
          
          <div>
            <DatePicker
              id="experience_from_date"
              label="Experience From Date (Optional)"
              date={formData.experience_from_date}
              onChange={(v: string) => onInputChange("experience_from_date", v)}
              disabled={(date: Date) => date > new Date()}
            />
          </div> 
          
          <div>
            <DatePicker
              id="experience_to_date"
              label="Experience To Date (Optional)"
              date={formData.experience_to_date}
              onChange={(v: string) => onInputChange("experience_to_date", v)}
              disabled={(date: Date) => date > new Date()}
            />
          </div>
          
          {/* <div className="md:col-span-2">
            <Label htmlFor="experience_subjects_classes_taught">Subjects/Classes Taught (Optional)</Label>
            <Input 
              id="experience_subjects_classes_taught" 
              value={formData.experience_subjects_classes_taught || ""} 
              onChange={(e) => onInputChange("experience_subjects_classes_taught", e.target.value)}
              placeholder="e.g., Mathematics (Grade 6-8), Physics (Grade 9-10)"
            />
          </div> */}
          
          {/* <div className="md:col-span-2">
            <Label htmlFor="previous_responsibilities">Previous Responsibilities (Optional)</Label>
            <Textarea 
              id="previous_responsibilities" 
              value={formData.previous_responsibilities || ""} 
              onChange={(e) => onInputChange("previous_responsibilities", e.target.value)}
              placeholder="Describe your previous responsibilities and achievements..."
            />
          </div> */}
        </div>
      </CardContent>
    </Card>
  )
}
