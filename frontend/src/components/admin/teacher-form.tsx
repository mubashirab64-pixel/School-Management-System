"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ProgressBar } from "@/components/ui/progress-bar"
import { ArrowLeft, ArrowRight, Eye } from "lucide-react"
import { PersonalInfoStep } from "./teacher-form/personal-info-step"
import { EducationStep } from "./teacher-form/education-step"
import CurrentRoleStep from "./teacher-form/current-role-step"
import { ExperienceStep } from "./teacher-form/experience-step"
import { TeacherPreview } from "./teacher-form/teacher-preview"
import { useToast } from "@/hooks/use-toast"
import { toast as sonnerToast } from "sonner"
import { getAllCampuses, getClassrooms, checkEmailExists, getStoredUserProfile, getUserCampusId, getStudentFormOptions } from "@/lib/api"
import { useFormErrorHandler } from "@/hooks/use-error-handler"
import { ErrorDisplay } from "@/components/ui/error-display"
import { getApiBaseUrl } from "@/lib/api"
import { useAutoSave } from "@/hooks/useAutoSave"
import { SaveStatusIndicator } from "@/components/offline/SaveStatusIndicator"
import { DraftRecoveryDialog } from "@/components/offline/DraftRecoveryDialog"
import { validateFields } from "@/lib/validation/common"
import { teacherCreateSchema } from "@/lib/validation/schemas/teacher.schema"

// Offline auto-save draft key (Phase 7).
const ADD_TEACHER_DRAFT_ID = "add-teacher-draft"
interface TeacherDraft { formData: any; currentStep: number }

const steps = [
  { id: 1, title: "Personal" },
  { id: 2, title: "Education" },
  { id: 3, title: "Experience" },
  { id: 4, title: "Current Role" },
]

export function TeacherForm() {
  const { toast } = useToast()
  const [currentStep, setCurrentStep] = useState(1)
  const [showPreview, setShowPreview] = useState(false)
  const [currentUserCampusId, setCurrentUserCampusId] = useState<number | null>(null)
  const [formData, setFormData] = useState<any>({
    // Personal Information (8 fields - 6 required, 2 optional)
    teacher_id: '',
    full_name: '',
    father_name: '',
    dob: '',
    gender: '',
    contact_number: '',
    email: '',
    current_address: '',
    cnic: '',
    marital_status: '',
    biometric_id: '',

    // Optional Personal Information
    permanent_address: '',

    // Education Information (5 optional fields)
    education_level: '',
    institution_name: '',
    year_of_passing: new Date().getFullYear(),
    education_subjects: '',
    education_grade: '',

    // Experience Information (7 optional fields)
    previous_institution_name: '',
    previous_position: '',
    experience_from_date: '',
    experience_to_date: '',
    experience_subjects_classes_taught: '',
    previous_responsibilities: '',
    total_experience_years: 0,

    // Current Role Information (5 fields - 3 required, 2 optional)
    // NOTE: actual default for principals will be set from logged-in user's campus
    current_campus: '',
    joining_date: '',
    shift: 'morning',
    current_subjects: '',
    current_classes_taught: '',
    current_extra_responsibilities: '',

    // System fields
    is_currently_active: true,

    // Class teacher fields
    is_class_teacher: false,
    is_subject_teacher: false,
    class_teacher_level: '',
    class_teacher_grade: '',
    class_teacher_section: '',
    assigned_classroom: '',
    assigned_classrooms: [],
    subject_teacher_assignments: [], // [{classroom_id, subject_id}]

    // Coordinator assignment (for non-class teachers)
    assigned_coordinators: [],

    // Teacher assistant flag
    is_teacher_assistant: false,
  })
  const [invalidFields, setInvalidFields] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [generalError, setGeneralError] = useState<string>('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [isValidating, setIsValidating] = useState<Record<string, boolean>>({})
  const [submitError, setSubmitError] = useState<string>('')
  const [formOptions, setFormOptions] = useState<any>(null)

  // Offline auto-save (Phase 7): poora form snapshot debounce ke baad IndexedDB.
  const { status: saveStatus, lastSavedAt, clearDraft } = useAutoSave<TeacherDraft>(
    ADD_TEACHER_DRAFT_ID,
    { formData, currentStep }
  )
  const restoreDraft = (draft: TeacherDraft) => {
    if (draft.formData) setFormData(draft.formData)
    if (draft.currentStep) setCurrentStep(draft.currentStep)
  }

  // Use form error handler
  useFormErrorHandler({
    onGeneralError: (message) => {
      setGeneralError(message)
    }
  })

  const totalSteps = steps.length
  const [isInitialized, setIsInitialized] = useState(false)

  // Initialize current campus and fetch form options
  useEffect(() => {
    if (isInitialized) return

    // 1. Initialize current campus
    try {
      const storedCampusId = getUserCampusId()
      const profile = getStoredUserProfile() as any
      const fallbackCampusId =
        storedCampusId ??
        profile?.campus_id ??
        (profile?.campus !== null && typeof profile?.campus === "object" ? profile.campus.id : profile?.campus) ??
        null

      if (fallbackCampusId) {
        setCurrentUserCampusId(Number(fallbackCampusId))
        setFormData((prev: any) => ({
          ...prev,
          current_campus: String(fallbackCampusId),
        }))
      }
    } catch (err) {
      console.error("Failed to infer campus:", err)
    }

    // 2. Fetch form options
    getStudentFormOptions()
      .then(setFormOptions)
      .catch(console.error)
      .finally(() => setIsInitialized(true))
  }, [isInitialized])

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }))
    if (invalidFields.includes(field)) {
      setInvalidFields((prev) => prev.filter((f) => f !== field))
    }
    // Clear field error when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  const STEP_FIELDS: { [step: number]: string[] } = {
    1: ["full_name", "dob", "gender", "contact_number", "email", "current_address", "cnic", "marital_status"],
    2: [], // All education fields are optional
    3: [], // All experience fields are optional
    4: ["current_campus", "joining_date", "shift"],
  }

  const validateCurrentStep = () => {
    const required = STEP_FIELDS[currentStep] || []
    const { invalid, messages } = validateFields(teacherCreateSchema, formData, required)
    // assigned_classrooms is required for class teachers but lives outside the
    // per-step required list (it's conditionally required, not step-scoped).
    if (currentStep === 4 && formData.is_class_teacher && (!Array.isArray(formData.assigned_classrooms) || formData.assigned_classrooms.length === 0)) {
      invalid.push("assigned_classrooms")
      messages.assigned_classrooms = "At least one classroom is required for class teachers."
    }

    setInvalidFields(invalid)
    setFieldErrors((prev) => ({ ...prev, ...messages }))
    return invalid
  }

  const handleNext = async () => {
    const invalid = validateCurrentStep()
    if (invalid.length > 0) {
      toast({
        title: "Please fill required fields",
        description: `Missing: ${invalid.join(", ")}`,
        variant: "destructive"
      })
      return
    }

    // Additional validation for step 1 (personal info)
    if (currentStep === 1) {
      // Check if validation is still in progress
      const isValidationInProgress = Object.values(isValidating).some(validating => validating)
      if (isValidationInProgress) {
        toast({
          title: "Please wait",
          description: "Validation is in progress. Please wait a moment.",
          variant: "destructive"
        })
        return
      }

      // Check for real-time validation errors
      const hasErrors = Object.values(fieldErrors).some(error => error !== '')
      if (hasErrors) {
        toast({
          title: "Please fix validation errors",
          description: "Please correct the highlighted fields before proceeding.",
          variant: "destructive"
        })
        return
      }

      // Check for uniqueness/validation errors specifically
      if (fieldErrors.email || fieldErrors.cnic || fieldErrors.contact_number) {
        toast({
          title: "Duplicate or Invalid Information",
          description: "Please resolve the highlighted uniqueness errors (Email, CNIC, or Phone).",
          variant: "destructive"
        })
        return
      }

      // Additional synchronous validation for required fields
      if (!formData.email || !formData.cnic) {
        toast({
          title: "Required fields missing",
          description: "Please fill in email and CNIC fields.",
          variant: "destructive"
        })
        return
      }

      // Validation is comprehensively handled by fieldErrors and required fields checks natively.
    }

    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    } else {
      setShowPreview(true)
    }
  }

  const handleSubmit = async () => {
    if (isSubmitting) return;

    // Check for validation errors before submission
    const hasErrors = Object.values(fieldErrors).some(error => error !== '')
    if (hasErrors) {
      toast({
        title: "Please fix validation errors",
        description: "Please correct the highlighted fields before submitting.",
        variant: "destructive"
      })
      return
    }

    // Check for uniqueness errors specifically
    if (fieldErrors.email || fieldErrors.cnic) {
      toast({
        title: "Duplicate Information",
        description: "Email or CNIC already exists. Please use different values.",
        variant: "destructive"
      })
      return
    }

    setIsSubmitting(true)
    setSubmitError('') // Clear any previous errors
    try {
      // Resolve assigned classroom just-in-time if needed
      let resolvedAssignedClassroom: number | null = formData.assigned_classroom ? parseInt(formData.assigned_classroom) : null
      try {
        if (!resolvedAssignedClassroom && formData.class_teacher_level && formData.class_teacher_grade && formData.class_teacher_section) {
          const data: any = await getClassrooms(formData.class_teacher_grade)
          const list = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : []
          const match = list.find((c: any) => (c.grade === parseInt(formData.class_teacher_grade) || c.grade === formData.class_teacher_grade) && c.section === formData.class_teacher_section)
          if (match) resolvedAssignedClassroom = match.id
        }
      } catch { }

      // Resolve campus id (principal often has campus code like "6" vs backend pk like 64)
      let resolvedCampusId: number | null = null;
      try {
        const campusInput = formData.current_campus;
        const campusesRes: any = await getAllCampuses();
        const campuses = Array.isArray(campusesRes?.results) ? campusesRes.results : (Array.isArray(campusesRes) ? campusesRes : []);
        const numFromInput = Number(String(campusInput).match(/\d+/)?.[0] || campusInput);
        // Prefer exact id match
        let match = campuses.find((c: any) => Number(c.id ?? c.campus_id) === numFromInput);
        if (!match) {
          // Try by campus_name containing the number
          match = campuses.find((c: any) => String(c.campus_name || c.name || '').toLowerCase().includes(String(numFromInput)));
        }
        resolvedCampusId = match ? Number(match.id ?? match.campus_id) : (Number.isFinite(numFromInput) ? numFromInput : null);
      } catch {
        resolvedCampusId = formData.current_campus ? parseInt(formData.current_campus) : null;
      }

      const submitData: any = {
        ...formData,
        current_campus: resolvedCampusId,
        year_of_passing: formData.year_of_passing ? parseInt(formData.year_of_passing) : null,
        total_experience_years: formData.total_experience_years ? parseFloat(formData.total_experience_years) : null,
        is_currently_active: Boolean(formData.is_currently_active),
        is_class_teacher: Boolean(formData.is_class_teacher),
        is_subject_teacher: Boolean(formData.is_subject_teacher),
        is_teacher_assistant: Boolean(formData.is_teacher_assistant),
        assigned_classroom: resolvedAssignedClassroom,
        assigned_classrooms: Array.isArray(formData.assigned_classrooms) ? formData.assigned_classrooms.map((x: any) => Number(x)) : [],
        subject_teacher_assignments: Array.isArray(formData.subject_teacher_assignments) ? formData.subject_teacher_assignments : [],
        assigned_coordinators: Array.isArray(formData.assigned_coordinators) ? formData.assigned_coordinators.map((x: any) => Number(x)) : [],
        dob: formData.dob && typeof formData.dob === 'string' && formData.dob.trim() !== '' ? formData.dob : null,
        joining_date: formData.joining_date && typeof formData.joining_date === 'string' && formData.joining_date.trim() !== '' ? formData.joining_date : null,
        experience_from_date: formData.experience_from_date && typeof formData.experience_from_date === 'string' && formData.experience_from_date.trim() !== '' ? formData.experience_from_date : null,
        experience_to_date: formData.experience_to_date && typeof formData.experience_to_date === 'string' && formData.experience_to_date.trim() !== '' ? formData.experience_to_date : null,
      }

      console.log('Submitting teacher data:', submitData)

      const base = getApiBaseUrl()
      const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base
      const response = await fetch(`${cleanBase}/api/teachers/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sis_access_token')}`
        },
        body: JSON.stringify(submitData)
      })

      if (response.ok) {
        const result = await response.json()
        // Success toast with teacher name, employee code, and classroom(s)
        const teacherName = result?.full_name || formData.full_name || "Teacher"
        const employeeCode = result?.employee_code || "Pending"
        const assignedList = Array.isArray(result?.assigned_classrooms) ? result.assigned_classrooms : []
        const classroomName = assignedList.length > 0
          ? `${assignedList.length} classroom${assignedList.length > 1 ? 's' : ''}`
          : (result?.classroom_name || (formData.class_teacher_section ? `Grade ${formData.class_teacher_grade} - ${formData.class_teacher_section}` : "N/A"))

        // Teacher server pe save ho gaya — local draft hata do.
        clearDraft()
        // Reset form to initial state
        setFormData({
          full_name: '',
          dob: '',
          gender: '',
          contact_number: '',
          email: '',
          current_address: '',
          cnic: '',
          marital_status: '',
          biometric_id: '',

          permanent_address: '',

          education_level: '',
          institution_name: '',
          year_of_passing: new Date().getFullYear(),
          education_subjects: '',
          education_grade: '',

          // Experience Information (7 optional fields)
          previous_institution_name: '',
          previous_position: '',
          experience_from_date: '',
          experience_to_date: '',
          experience_subjects_classes_taught: '',
          previous_responsibilities: '',
          total_experience_years: 0,

          // Current Role Information (5 fields - 3 required, 2 optional)
          current_campus: '6', // Default to Campus 6 for principal
          joining_date: '',
          shift: 'morning',
          current_subjects: '',
          current_classes_taught: '',
          current_extra_responsibilities: '',

          // System fields
          is_currently_active: true
        })

        // Reset to first step and close preview
        setCurrentStep(1)
        setShowPreview(false)
        setInvalidFields([])
        setFieldErrors({})
        setIsValidating({})

        // Show success popup modal
        setSubmitError('') // Clear any errors
        sonnerToast.success("✅ Teacher Added Successfully!", {
          description: (
            <div className="space-y-1">
              <p className="font-semibold">Teacher: {teacherName}</p>
              <p>Employee Code: {employeeCode}</p>
              {formData.is_class_teacher && classroomName && (
                <p>Classroom: {classroomName}</p>
              )}
            </div>
          ),
          duration: 5000,
        })
      } else {
        const errorData = await response.json();

        // Handle specific error cases with user-friendly messages
        let errorMessage = 'Failed to create teacher. Please try again.';

        if (errorData.email && Array.isArray(errorData.email) && errorData.email[0].includes('already exists')) {
          errorMessage = 'This email is already registered. Please use a different email address.';
        } else if (errorData.cnic && Array.isArray(errorData.cnic) && errorData.cnic[0].includes('already exists')) {
          errorMessage = 'This CNIC is already registered. Please check your CNIC number.';
        } else if (errorData.assigned_classroom && Array.isArray(errorData.assigned_classroom)) {
          // Unique constraint from backend: one teacher per classroom
          errorMessage = 'This classroom is already assigned to another class teacher. Please choose a different section.';
        } else if (errorData.email && Array.isArray(errorData.email)) {
          errorMessage = `Email error: ${errorData.email[0]}`;
        } else if (errorData.cnic && Array.isArray(errorData.cnic)) {
          errorMessage = `CNIC error: ${errorData.cnic[0]}`;
        } else if (errorData.experience_from_date && Array.isArray(errorData.experience_from_date)) {
          errorMessage = errorData.experience_from_date[0];
        } else if (errorData.experience_to_date && Array.isArray(errorData.experience_to_date)) {
          errorMessage = errorData.experience_to_date[0];
        } else if (errorData.non_field_errors) {
          errorMessage = Array.isArray(errorData.non_field_errors)
            ? errorData.non_field_errors.join(', ')
            : errorData.non_field_errors;
        } else if (typeof errorData === 'object') {
          // Handle field-specific errors
          const fieldErrors = Object.values(errorData);
          if (fieldErrors.length > 0) {
            const firstError = Array.isArray(fieldErrors[0]) ? fieldErrors[0][0] : fieldErrors[0];
            errorMessage = firstError;
          }
        }

        // Show error in UI card
        setSubmitError(errorMessage)
        sonnerToast.error("Failed to save teacher", { description: errorMessage })
      }
    } catch (error) {
      console.error('Error submitting teacher:', error)
      const networkError = "Network error. Please check your connection and try again."
      setSubmitError(networkError)
      toast({
        title: "Error",
        description: networkError,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleStepChange = (step: number) => {
    if (step > currentStep) {
      // Agar forward jump kar raha hai to pehle validate karo
      const invalid = validateCurrentStep()
      if (invalid.length > 0) {
        toast({
          title: "Please fill required fields",
          description: invalid.join(", "),
        })
        return
      }
    }
    setInvalidFields([])
    setCurrentStep(step)
  }

  const renderCurrentStep = () => {
    if (showPreview) {
      return <TeacherPreview formData={formData} onBack={() => setShowPreview(false)} onSubmit={handleSubmit} />
    }

    switch (currentStep) {
      case 1:
        return <PersonalInfoStep formData={formData} invalidFields={invalidFields} onInputChange={handleInputChange} fieldErrors={fieldErrors} setFieldErrors={setFieldErrors} isValidating={isValidating} setIsValidating={setIsValidating} formOptions={formOptions} />
      case 2:
        return <EducationStep formData={formData} invalidFields={invalidFields} onInputChange={handleInputChange} />
      case 3:
        return <ExperienceStep formData={formData} invalidFields={invalidFields} onInputChange={handleInputChange} />
      case 4:
        return <CurrentRoleStep formData={formData} invalidFields={invalidFields} onInputChange={handleInputChange} formOptions={formOptions} />
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Offline: mount par saved draft mila to restore prompt (Phase 7). */}
      <DraftRecoveryDialog<TeacherDraft>
        formId={ADD_TEACHER_DRAFT_ID}
        onRestore={restoreDraft}
      />

      {/* Error Popup Modal */}
      {submitError && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="border-red-500 bg-white shadow-2xl max-w-md w-full mx-4">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-red-600 text-xl">⚠</span>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-red-800 text-lg">Error</h3>
                  <p className="text-red-700 text-sm mt-1">{submitError}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSubmitError('')}
                  className="text-red-600 hover:text-red-800 hover:bg-red-100"
                >
                  ✕
                </Button>
              </div>
              <div className="mt-4 flex justify-end">
                <Button
                  onClick={() => setSubmitError('')}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  OK
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}


      {!showPreview && (
        <Card className="border-2 bg-white">
          <CardHeader>
            <div className="w-full">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Progress</CardTitle>
                  <CardDescription className="text-sm">
                    Step {currentStep} of {totalSteps}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <SaveStatusIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
                  <div className="text-sm text-muted-foreground">Add Teacher</div>
                </div>
              </div>
              <div className="mt-4">
                <ProgressBar
                  steps={steps}
                  currentStep={currentStep}
                  onStepClick={handleStepChange}
                  showClickable={true}
                />
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      {renderCurrentStep()}

      {/* Error Display */}
      {generalError && (
        <div className="mt-4">
          <ErrorDisplay
            error={{ title: "Error", message: generalError, type: "error" }}
            variant="compact"
            onDismiss={() => setGeneralError('')}
          />
        </div>
      )}

      {!showPreview && (
        <div className="flex justify-between items-center bg-white p-4 rounded-2xl border-2 border-dashed border-slate-200 mt-6 shadow-sm">
          <Button
            onClick={handlePrevious}
            disabled={currentStep === 1}
            variant="ghost"
            className={`flex items-center gap-2 px-6 h-12 font-bold rounded-xl transition-all ${currentStep === 1 ? "opacity-30 cursor-not-allowed" : "hover:bg-white hover:shadow-md text-gray-600"
              }`}
          >
            <ArrowLeft className="h-5 w-5" />
            Previous Step
          </Button>

          <Button
            onClick={handleNext}
            className="flex items-center gap-2 px-8 h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-95"
          >
            {currentStep === totalSteps ? (
              <>
                <Eye className="h-5 w-5" />
                Review & Preview
              </>
            ) : (
              <>
                Next Step
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
