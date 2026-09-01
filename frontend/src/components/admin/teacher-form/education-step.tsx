"use client"

import { useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"

interface EducationStepProps {
  formData: any
  invalidFields: string[]
  onInputChange: (field: string, value: string) => void
}

export function EducationStep({ formData, invalidFields, onInputChange }: EducationStepProps) {
  const { toast } = useToast()

  const stepFields = [
    "education_level",
    "institution_name",
    "year_of_passing",
    "education_subjects",
    "education_grade",
  ]
  function isEmptyValue(val: any) {
    return val === undefined || val === null || String(val).trim() === ""
  }

  // Educational fields are optional by default.
  
  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle>Educational Qualifications</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="education_level">Education Level (Optional)</Label>
            <Input 
              id="education_level" 
              value={formData.education_level || ""} 
              onChange={(e) => onInputChange("education_level", e.target.value)}
              placeholder="e.g., Bachelor's, Master's"
            />
          </div>

          <div>
            <Label htmlFor="institution_name">Institution Name (Optional)</Label>
            <Input 
              id="institution_name" 
              value={formData.institution_name || ""} 
              onChange={(e) => onInputChange("institution_name", e.target.value)}
              placeholder="e.g., University of Karachi"
            />
          </div>

          <div>
            <Label htmlFor="year_of_passing">Year of Passing (Optional)</Label>
            <Input 
              id="year_of_passing" 
              type="number" 
              min="1950"
              max={new Date().getFullYear()}
              value={formData.year_of_passing || ""} 
              onChange={(e) => onInputChange("year_of_passing", e.target.value)}
              placeholder="e.g., 2020"
            />
          </div>

          <div>
            <Label htmlFor="education_subjects">Subjects Studied (Optional)</Label>
            <Input 
              id="education_subjects" 
              value={formData.education_subjects || ""} 
              onChange={(e) => onInputChange("education_subjects", e.target.value)}
              placeholder="e.g., Mathematics, Physics"
            />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="education_grade">Grade/GPA (Optional)</Label>
            <Input 
              id="education_grade" 
              value={formData.education_grade || ""} 
              onChange={(e) => onInputChange("education_grade", e.target.value)}
              placeholder="e.g., A+, 3.8/4.0"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
