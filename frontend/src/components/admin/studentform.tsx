"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ProgressBar } from "@/components/ui/progress-bar"
import { ArrowLeft, ArrowRight, Eye } from "lucide-react"
import { StudentPreview } from "./student-form/student-preview"
import { PersonalDetailsStep } from "./student-form/personal-details-step"
import { ContactDetailsStep } from "./student-form/contect-details-step"
import { AcademicDetailsStep } from "./student-form/acadmic-details-step"
import { useToast } from "@/hooks/use-toast"
import { toast as sonnerToast } from "sonner"
import { getStudentFormOptions } from "@/lib/api"
import { useAutoSave } from "@/hooks/useAutoSave"
import { SaveStatusIndicator } from "@/components/offline/SaveStatusIndicator"
import { DraftRecoveryDialog } from "@/components/offline/DraftRecoveryDialog"
import { useAppForm } from "@/hooks/useAppForm"
import { applyApiErrorsToForm } from "@/lib/validation/apiErrors"
import { studentCreateSchema, type StudentCreateInput } from "@/lib/validation/schemas/student.schema"
import type { FieldPath } from "react-hook-form"

// Offline auto-save draft key (Phase 2). Single global draft for the
// "Add Student" flow — per-user scoping db.ts ke andar hota hai.
const ADD_STUDENT_DRAFT_ID = "add-student-draft"

interface StudentDraft {
  formData: StudentCreateInput
  uploadedImages: { [key: string]: string }
  currentStep: number
}

const steps = [
  { id: 1, title: "Personal Details" },
  { id: 2, title: "Contact Details" },
  { id: 3, title: "Academic Details" },
]

const DEFAULT_VALUES: StudentCreateInput = {
  student_id: "",
  name: "",
  email: "",
  gender: "",
  dob: "",
  placeOfBirth: "",
  religion: "",
  motherTongue: "",
  student_cnic: "",
  nationality: "pakistani",
  blood_group: "",
  special_needs_disability: "none",
  phoneNumber: "",
  emergencyContact: "",
  emergency_relationship: "",
  address: "",
  familyIncome: "",
  houseOwned: "",
  zakatStatus: "",
  fatherStatus: "alive",
  fatherName: "",
  fatherCNIC: "",
  fatherContact: "",
  fatherProfession: "",
  motherName: "",
  motherContact: "",
  siblingsCount: "0",
  guardianName: "",
  guardianRelation: "",
  guardianCNIC: "",
  guardianContact: "",
  guardianProfession: "",
  motherStatus: "married",
  campus: "",
  shift: "",
  currentGrade: "",
  section: "",
  admissionYear: "",
  classroom: "",
}

// Which schema fields belong to which wizard step — used to scope trigger()
// validation so "Next" on step 1 doesn't demand step 3's fields yet.
const STEP_FIELDS: Record<number, FieldPath<StudentCreateInput>[]> = {
  1: ["name", "gender", "dob", "religion", "motherTongue", "email", "student_cnic"],
  2: [
    "emergencyContact", "address", "siblingsCount", "phoneNumber", "fatherCNIC",
    "fatherContact", "motherContact", "familyIncome",
    "guardianName", "guardianRelation", "guardianCNIC", "guardianContact", "guardianProfession",
  ],
  3: ["campus", "shift", "currentGrade", "section", "admissionYear"],
}

export function StudentForm({ onSuccess }: { onSuccess?: () => void } = {}) {
  const { toast } = useToast()
  const [currentStep, setCurrentStep] = useState(1)
  const [showPreview, setShowPreview] = useState(false)
  const [uploadedImages, setUploadedImages] = useState<{ [key: string]: string }>({})
  const [submitError, setSubmitError] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null) as React.RefObject<HTMLInputElement>
  const [formOptions, setFormOptions] = useState<any>(null)

  const form = useAppForm<StudentCreateInput>({ schema: studentCreateSchema, defaultValues: DEFAULT_VALUES })
  const { register, control, watch, setValue, getValues, trigger, setError, handleSubmit, reset, formState: { errors } } = form

  useEffect(() => {
    const fetchOptions = async () => {
      const options = await getStudentFormOptions()
      if (options) {
        setFormOptions(options)
      }
    }
    fetchOptions()
  }, [])

  const totalSteps = steps.length
  const watchedValues = watch()

  // ── Offline auto-save (Phase 2) ──────────────────────────────────────
  const { status: saveStatus, lastSavedAt, clearDraft } = useAutoSave<StudentDraft>(
    ADD_STUDENT_DRAFT_ID,
    { formData: watchedValues, uploadedImages, currentStep }
  )

  const restoreDraft = (draft: StudentDraft) => {
    if (draft.formData) reset(draft.formData)
    if (draft.uploadedImages) setUploadedImages(draft.uploadedImages)
    if (draft.currentStep) setCurrentStep(draft.currentStep)
  }

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>, imageKey: string) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        setUploadedImages((prev) => ({ ...prev, [imageKey]: result }))
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = (imageKey: string) => {
    setUploadedImages((prev) => {
      const newImages = { ...prev }
      delete newImages[imageKey]
      return newImages
    })
  }

  const handleNext = async () => {
    const fieldsForStep = STEP_FIELDS[currentStep] || []
    const valid = await trigger(fieldsForStep)

    if (!valid) {
      toast({
        title: "Please fix the errors before proceeding",
        description: "Check the highlighted fields for details.",
        variant: "destructive"
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
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleStepChange = async (step: number) => {
    if (step > currentStep) {
      const fieldsForStep = STEP_FIELDS[currentStep] || []
      const valid = await trigger(fieldsForStep)
      if (!valid) {
        toast({
          title: "Please fix the errors before proceeding",
          description: "Check the highlighted fields for details.",
        })
        return
      }
    }
    setCurrentStep(step)
  }

  const resetForm = () => {
    reset(DEFAULT_VALUES)
    setUploadedImages({})
    setCurrentStep(1)
    setSubmitError('')
  }

  const renderCurrentStep = () => {
    if (showPreview) {
      return (
        <StudentPreview
          formData={getValues()}
          uploadedImages={uploadedImages}
          onBack={() => setShowPreview(false)}
          onError={(error) => setSubmitError(error)}
          onApiError={(rawError) => {
            const banner = applyApiErrorsToForm(setError, rawError)
            if (banner) setSubmitError(banner)
          }}
          onSaved={(studentData) => {
            clearDraft()
            setShowPreview(false)
            const values = getValues()
            resetForm()

            const studentName = studentData?.name || values.name || "Student"
            const studentId = studentData?.student_id || "N/A"
            const grade = studentData?.grade_name || values.currentGrade || "N/A"

            sonnerToast.success("✅ Student Added Successfully!", {
              description: (
                <div className="space-y-1">
                  <p className="font-semibold">Student: {studentName}</p>
                  <p>Student ID: {studentId}</p>
                  <p>Grade: {grade}</p>
                </div>
              ),
              duration: 5000,
            })
            if (onSuccess) onSuccess()
          }}
        />
      )
    }

    switch (currentStep) {
      case 1:
        return (
          <PersonalDetailsStep
            register={register}
            control={control}
            errors={errors}
            setError={setError}
            setValue={setValue}
            watch={watch}
            uploadedImages={uploadedImages}
            onImageUpload={handleImageUpload}
            onRemoveImage={removeImage}
            fileInputRef={fileInputRef}
            formOptions={formOptions}
          />
        )
      case 2:
        return (
          <ContactDetailsStep
            register={register}
            control={control}
            errors={errors}
            formOptions={formOptions}
            fatherStatus={watch("fatherStatus")}
          />
        )
      case 3:
        return (
          <AcademicDetailsStep
            register={register}
            control={control}
            errors={errors}
            watch={watch}
            setValue={setValue}
            formOptions={formOptions}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <DraftRecoveryDialog<StudentDraft>
        formId={ADD_STUDENT_DRAFT_ID}
        onRestore={restoreDraft}
      />

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
                  <div className="text-sm text-muted-foreground">Add Student</div>
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

      <div className="mt-6">
        {renderCurrentStep()}
      </div>

      {!showPreview && (
        <div className="flex justify-between items-center bg-white p-4 rounded-2xl border-2 border-dashed border-slate-200 mt-6 shadow-sm">
          <Button
            onClick={handlePrevious}
            disabled={currentStep === 1}
            variant="ghost"
            className={`flex items-center gap-2 px-6 h-12 font-bold rounded-xl transition-all ${
              currentStep === 1 ? "opacity-30 cursor-not-allowed" : "hover:bg-white hover:shadow-md text-gray-600"
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
