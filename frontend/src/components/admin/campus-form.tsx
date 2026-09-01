"use client"

import { useState } from "react"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { GeneralInfoStep } from "./campus-form/general-info-step"
import { FacilitiesStep } from "./campus-form/facilities-step"
import { ContactStep } from "./campus-form/contact-step"
import { CampusPreview } from "./campus-form/campus-preview"
import { useToast } from "@/hooks/use-toast"
import { ProgressBar } from "@/components/ui/progress-bar"
import { validateFields, parseField, emailField, optionalEmailField } from "@/lib/validation/common"
import { campusCreateSchema } from "@/lib/validation/schemas/campus.schema"

const steps = [
  { id: 1, title: "General Information" },
  { id: 2, title: "Facilities" },
  { id: 3, title: "Contact & Info" },
]

export function CampusForm() {
  const { toast } = useToast()
  const [currentStep, setCurrentStep] = useState(1)
  const [showPreview, setShowPreview] = useState(false)
  const [formData, setFormData] = useState<any>({ shift_available: "morning" })
  const [invalidFields, setInvalidFields] = useState<string[]>([])

  const totalSteps = steps.length

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }))
    if (invalidFields.includes(field)) {
      setInvalidFields(prev => prev.filter(f => f !== field))
    }
  }

  // Per-field checks so a field can be flagged the moment the user leaves it,
  // instead of only surfacing at the final "Next"/"Save" click.
  const REQUIRED_TEXT_FIELDS = new Set([
    "campus_name", "campus_code", "campus_id", "city", "postal_code",
    "district", "registration_number", "status", "address_full",
    "campus_head_name", "primary_phone",
  ])

  const isFieldInvalid = (field: string, value: any): boolean => {
    if (field === "official_email") {
      return !parseField(emailField('Official email'), value ?? '').isValid
    }
    if (field === "campus_head_email") {
      return !parseField(optionalEmailField(), value ?? '').isValid
    }
    if (REQUIRED_TEXT_FIELDS.has(field)) {
      return !value || (typeof value === "string" && value.trim() === "")
    }
    return false
  }

  const handleBlurField = (field: string) => {
    const invalid = isFieldInvalid(field, formData[field])
    setInvalidFields(prev => {
      const withoutField = prev.filter(f => f !== field)
      return invalid ? [...withoutField, field] : withoutField
    })
  }

  const STEP_FIELDS: { [step: number]: string[] } = {
    1: [
      "campus_name", "campus_code", "campus_id", "city", "postal_code",
      "district", "registration_number", "status",
      "address_full", "shift_available", "academic_year_end_month",
    ],
    2: [
      "total_classrooms", "total_staff_rooms",
      "power_backup", "internet_available",
      "canteen_facility", "library_available", "student_transport",
    ],
    3: ["campus_head_name", "primary_phone", "official_email", "campus_head_email"],
  }

  const validateCurrentStep = (): string[] => {
    const required = STEP_FIELDS[currentStep] || []
    const { invalid } = validateFields(campusCreateSchema, formData, required)

    setInvalidFields(invalid)
    return invalid
  }

  const handleNext = () => {
    const invalid = validateCurrentStep()
    if (invalid.length > 0) {
      toast({
        title: "Please fix the highlighted fields",
        description: `${invalid.length} field(s) need attention`,
      })
      return
    }
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    } else {
      setShowPreview(true)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }

  const handleStepChange = (step: number) => {
    if (step <= currentStep) {
      setInvalidFields([])
      setCurrentStep(step)
    }
  }

  const renderCurrentStep = () => {
    if (showPreview) {
      return (
        <CampusPreview
          formData={formData}
          onBack={() => setShowPreview(false)}
          onSaved={() => {
            setShowPreview(false)
            setFormData({})
            setCurrentStep(1)
          }}
        />
      )
    }
    switch (currentStep) {
      case 1: return <GeneralInfoStep formData={formData} invalidFields={invalidFields} onInputChange={handleInputChange} onBlurField={handleBlurField} />
      case 2: return <FacilitiesStep formData={formData} invalidFields={invalidFields} onInputChange={handleInputChange} />
      case 3: return <ContactStep formData={formData} invalidFields={invalidFields} onInputChange={handleInputChange} onBlurField={handleBlurField} />
      default: return null
    }
  }

  return (
    <div className="space-y-6">
      {!showPreview && (
        <Card className="border-2">
          <CardHeader>
            <div className="w-full">
              <div className="flex items-center justify-between mb-4">
                <CardTitle className="text-lg">Add Campus</CardTitle>
              </div>
              <ProgressBar
                steps={steps}
                currentStep={currentStep}
                onStepClick={handleStepChange}
                showClickable={true}
              />
            </div>
          </CardHeader>
        </Card>
      )}

      {renderCurrentStep()}

      {!showPreview && (
        <div className="flex justify-between">
          <Button variant="outline" onClick={handlePrevious} disabled={currentStep === 1}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>
          <Button onClick={handleNext}>
            {currentStep === totalSteps ? "Preview" : "Next"}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  )
}
