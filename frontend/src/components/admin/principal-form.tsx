"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ProgressBar } from "@/components/ui/progress-bar"
import { ArrowLeft, ArrowRight, Eye } from "lucide-react"
import { PersonalInfoStep } from "./principal-form/personal-info-step"
import { ProfessionalInfoStep } from "./principal-form/professional-info-step"
import { WorkAssignmentStep } from "./principal-form/work-assignment-step"
import { useToast } from "@/hooks/use-toast"
import { createPrincipal, getAllCampuses, getAllPrincipals, checkEmailExists, checkCNICExists, getPrincipalFormOptions, apiPostFormData, API_ENDPOINTS } from "@/lib/api"
import { useRouter } from "next/navigation"
import { toast as sonnerToast } from "sonner"
import { validateFields, parseField } from "@/lib/validation/common"
import { staffContactNumberField, staffEmailField } from "@/lib/validation/schemas/_staffShared"
import { principalCreateSchema } from "@/lib/validation/schemas/principal.schema"
import { useAutoSave } from "@/hooks/useAutoSave"
import { SaveStatusIndicator } from "@/components/offline/SaveStatusIndicator"
import { DraftRecoveryDialog } from "@/components/offline/DraftRecoveryDialog"

const ADD_PRINCIPAL_DRAFT_ID = "add-principal-draft"
interface PrincipalDraft { formData: any; currentStep: number }

const steps = [
  { id: 1, title: "Personal" },
  { id: 2, title: "Professional" },
  { id: 3, title: "Work Assignment" },
]

export function PrincipalForm() {
  const { toast } = useToast()
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [showPreview, setShowPreview] = useState(false)
  const [campuses, setCampuses] = useState<any[]>([])
  const [formData, setFormData] = useState<any>({
    // Personal Information
    photo: null,
    full_name: '',
    father_name: '',
    dob: '',
    gender: '',
    cnic: '',
    nationality: 'Pakistani',
    religion: '',
    contact_number: '',
    emergency_contact: '',
    email: '',
    permanent_address: '',
    marital_status: '',
    biometric_id: '',


    // Professional Information
    education_level: '',
    degree_title: '',
    institution_name: '',
    year_of_passing: String(new Date().getFullYear()),
    total_experience_years: '0',
    specialization: '',
    previous_organization: '',
    previous_designation: '',
    license_number: '',

    // Work Assignment
    employee_code: '',
    is_manual_id: false,
    designation: 'principal',
    campus: '',
    shift: 'morning',
    contract_type: 'permanent',
    contract_end_date: '',
    joining_date: '',
    status: 'active',
    is_currently_active: true,
  })

  const [formOptions, setFormOptions] = useState<any>(null)

  // Offline auto-save (Phase 7).
  const { status: saveStatus, lastSavedAt, clearDraft } = useAutoSave<PrincipalDraft>(
    ADD_PRINCIPAL_DRAFT_ID,
    { formData, currentStep }
  )
  const restoreDraft = (draft: PrincipalDraft) => {
    if (draft.formData) setFormData(draft.formData)
    if (draft.currentStep) setCurrentStep(draft.currentStep)
  }
  const [invalidFields, setInvalidFields] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    // Fetch campuses on mount
    getAllCampuses().then((data) => {
      setCampuses(Array.isArray(data) ? data : [])
    })
    // Fetch dynamic options
    getPrincipalFormOptions().then((data) => {
      setFormOptions(data)
    })
  }, [])

  const totalSteps = steps.length

  const handleInputChange = (field: string, value: any) => {
    if (field === 'campus') {
      console.log('[PrincipalForm] campus change:', { value, type: typeof value, currentInvalidFields: invalidFields })
    }
    setFormData((prev: any) => ({
      ...prev,
      [field]: value
    }))
    if (invalidFields.includes(field)) {
      setInvalidFields((prev) => prev.filter((f) => f !== field))
    }
  }

  const REQUIRED_FIELDS_BY_STEP: { [step: number]: string[] } = {
    1: ['full_name', 'father_name', 'dob', 'gender', 'contact_number', 'email', 'cnic', 'permanent_address'],
    2: ['education_level', 'degree_title', 'institution_name', 'year_of_passing', 'total_experience_years'],
    3: ['designation', 'campus', 'shift', 'contract_type', 'joining_date', 'status'],
  }

  // Per-field check so format errors (email/phone) surface the moment a field
  // is left, instead of only at the final "Next"/"Preview" click.
  const isFieldInvalid = (field: string, value: any): boolean => {
    const isEmpty = value == null || value === '' || (typeof value === 'string' && value.trim() === '')
    const isRequired = REQUIRED_FIELDS_BY_STEP[currentStep]?.includes(field)

    if (isRequired && isEmpty) return true
    if (field === 'email' && !isEmpty) return !parseField(staffEmailField(), value).isValid
    if (field === 'contact_number' && !isEmpty) return !parseField(staffContactNumberField(), value).isValid
    return false
  }

  const handleBlurField = (field: string) => {
    const invalid = isFieldInvalid(field, formData[field])
    setInvalidFields(prev => {
      const withoutField = prev.filter(f => f !== field)
      return invalid ? [...withoutField, field] : withoutField
    })
  }

  const validateCurrentStep = () => {
    const required = REQUIRED_FIELDS_BY_STEP[currentStep] || []
    console.log('[PrincipalForm] validateCurrentStep:', {
      step: currentStep,
      required,
      campusValue: formData.campus,
      campusType: typeof formData.campus,
      allFormData: { ...formData }
    })
    const { invalid, messages } = validateFields(principalCreateSchema, formData, required)
    console.log('[PrincipalForm] validation result:', { invalid, messages })

    setInvalidFields(invalid)

    if (invalid.length > 0) {
      toast({
        title: messages[invalid[0]] || "Please fill required fields",
        description: `Please check: ${invalid.map(f => f.replace('_', ' ')).join(", ")}`,
        variant: "destructive"
      })
    }

    return invalid.length === 0
  }

  const checkDuplicateEmail = async (email: string) => {
    // Global check across all users
    return await checkEmailExists(email)
  }

  const handleNext = async () => {
    if (!validateCurrentStep()) {
      return
    }

    // Check for duplicates on step 1
    if (currentStep === 1) {
      if (formData.email) {
        const isDuplicateEmail = await checkEmailExists(formData.email)
        if (isDuplicateEmail) {
          toast({
            title: "Email already exists",
            description: "This email is already registered. Please use a different one.",
            variant: "destructive"
          })
          setInvalidFields(prev => [...prev, 'email'])
          return
        }
      }

      if (formData.cnic) {
        const isDuplicateCNIC = await checkCNICExists(formData.cnic)
        if (isDuplicateCNIC) {
          toast({
            title: "CNIC already exists",
            description: "This CNIC is already registered. Please use a different one.",
            variant: "destructive"
          })
          setInvalidFields(prev => [...prev, 'cnic'])
          return
        }
      }
    }

    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    } else {
      handlePreview()
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
      setShowPreview(false)
    }
  }

  const handlePreview = () => {
    setShowPreview(true)
  }

  const handleSubmit = async () => {
    if (!validateCurrentStep()) {
      return
    }

    setIsSubmitting(true)
    try {
      // Prepare data for API using FormData for file upload
      const formDataObj = new FormData()

      Object.keys(formData).forEach(key => {
        if (formData[key] !== null && formData[key] !== undefined && formData[key] !== '') {
          if (key === 'photo' && formData[key] instanceof File) {
            formDataObj.append('photo', formData[key])
          } else {
            formDataObj.append(key, formData[key])
          }
        }
      })

      const response: any = await apiPostFormData(API_ENDPOINTS.PRINCIPALS, formDataObj)

      // Show success toast
      sonnerToast.success("✅ Principal Added Successfully!", {
        description: (
          <div className="space-y-1">
            <p className="font-semibold">Principal: {response.full_name || formData.full_name}</p>
            <p>Employee Code: {response.employee_code || 'N/A'}</p>
          </div>
        ),
        duration: 5000,
      })

      // Principal server pe save ho gaya — local draft hata do.
      clearDraft()
      // Redirect after short delay
      setTimeout(() => {
        router.push('/admin/principals/list')
      }, 1000)
    } catch (error: any) {
      let errorMessage = 'Failed to create principal'

      // Handle validation errors (shift field takes priority)
      if (error?.data?.shift) {
        errorMessage = error.data.shift
      } else if (error?.data?.campus) {
        errorMessage = error.data.campus
      } else if (error?.data?.non_field_errors) {
        errorMessage = error.data.non_field_errors[0]
      } else if (error?.message) {
        errorMessage = error.message
      }

      sonnerToast.error('Failed to create principal', {
        description: errorMessage,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <PersonalInfoStep formData={formData} invalidFields={invalidFields} onInputChange={handleInputChange} onBlurField={handleBlurField} formOptions={formOptions} />
      case 2:
        return <ProfessionalInfoStep formData={formData} invalidFields={invalidFields} onInputChange={handleInputChange} formOptions={formOptions} />
      case 3:
        return <WorkAssignmentStep formData={formData} invalidFields={invalidFields} onInputChange={handleInputChange} campuses={campuses} formOptions={formOptions} />
      default:
        return null
    }
  }

  const renderPreview = () => {
    return (
      <Card className="border-2 border-[#E7ECEF] shadow-lg">
        <CardContent className="pt-6 space-y-6">
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-[#274C77]">Review Principal Information</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-4">
                <h4 className="font-bold text-[#274C77] border-b pb-1">Personal Info</h4>
                <div className="space-y-1 text-sm">
                  <p><strong>Name:</strong> {formData.full_name}</p>
                  <p><strong>Father:</strong> {formData.father_name}</p>
                  <p><strong>DOB:</strong> {formData.dob}</p>
                  <p><strong>Gender:</strong> {formData.gender}</p>
                  <p><strong>CNIC:</strong> {formData.cnic}</p>
                  <p><strong>Email:</strong> {formData.email}</p>
                  <p><strong>Contact:</strong> {formData.contact_number}</p>
                  <p><strong>Biometric ID:</strong> {formData.biometric_id || '—'}</p>

                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-[#274C77] border-b pb-1">Professional</h4>
                <div className="space-y-1 text-sm">
                  <p><strong>Level:</strong> {formData.education_level}</p>
                  <p><strong>Degree:</strong> {formData.degree_title}</p>
                  <p><strong>Institution:</strong> {formData.institution_name}</p>
                  <p><strong>Experience:</strong> {formData.total_experience_years} years</p>
                  <p><strong>Specialization:</strong> {formData.specialization}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-[#274C77] border-b pb-1">Work Assignment</h4>
                <div className="space-y-1 text-sm">
                  <p><strong>Designation:</strong> {formData.designation}</p>
                  <p><strong>Campus:</strong> {campuses.find(c => String(c.id) === String(formData.campus))?.campus_name || formData.campus}</p>
                  <p><strong>Shift:</strong> {formData.shift}</p>
                  <p><strong>Contract:</strong> {formData.contract_type}</p>
                  <p><strong>Join Date:</strong> {formData.joining_date}</p>
                  <p><strong>Status:</strong> {formData.status}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Offline: mount par saved draft mila to restore prompt (Phase 7). */}
      <DraftRecoveryDialog<PrincipalDraft>
        formId={ADD_PRINCIPAL_DRAFT_ID}
        onRestore={restoreDraft}
      />

      {/* Progress Bar Card */}
      <Card className="border-2 border-[#E7ECEF] shadow-lg bg-white overflow-hidden">
        <CardContent className="pt-0 pb-0 px-10">
          <div className="px-0 mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#274C77]">Add Principal</h2>
            <SaveStatusIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
          </div>
          <ProgressBar
            steps={steps}
            currentStep={currentStep}
          />
        </CardContent>
      </Card>

      {/* Form Content */}
      {showPreview ? renderPreview() : renderStep()}

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentStep === 1 && !showPreview}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>

        <div className="flex gap-2">
          {showPreview ? (
            <>
              <Button
                variant="outline"
                onClick={() => setShowPreview(false)}
                disabled={isSubmitting}
              >
                Edit
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-[#6096BA] hover:bg-[#274C77]"
              >
                {isSubmitting ? 'Creating...' : 'Create Principal'}
              </Button>
            </>
          ) : (
            <Button
              onClick={handleNext}
              disabled={isSubmitting}
              className="bg-[#6096BA] hover:bg-[#274C77]"
            >
              {currentStep === totalSteps ? (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

