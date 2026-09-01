"use client"

import type React from "react"
import { useState } from "react"
import { useController, type Control, type FieldErrors, type UseFormRegister, type UseFormSetError } from "react-hook-form"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Upload, X, Pencil, Wand2 } from "lucide-react"
import { FormField } from "@/components/form/FormField"
import { FormSelect } from "@/components/form/FormSelect"
import { formatCnicDashed } from "@/lib/validation/common"
import { DatePicker } from "@/components/ui/date-picker"
import { checkStudentDuplicate } from "@/lib/api"
import type { StudentCreateInput } from "@/lib/validation/schemas/student.schema"

// ── Student ID Field with Auto / Manual toggle ───────────────────────────────
function StudentIdField({
  register,
  studentId,
  setValue,
}: {
  register: UseFormRegister<StudentCreateInput>
  studentId: string
  setValue: (field: "student_id", value: string) => void
}) {
  const [manual, setManual] = useState(!!studentId)

  const switchToManual = () => {
    setManual(true)
    setValue("student_id", "")
  }

  const switchToAuto = () => {
    setManual(false)
    setValue("student_id", "") // clear so backend generates
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <Label htmlFor="student_id">Student ID</Label>
        <button
          type="button"
          onClick={manual ? switchToAuto : switchToManual}
          className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
            manual
              ? "bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
              : "bg-gray-100 border-gray-300 text-gray-500 hover:bg-gray-200"
          }`}
        >
          {manual ? (
            <><Wand2 className="h-3 w-3" /> Auto-generate</>
          ) : (
            <><Pencil className="h-3 w-3" /> Enter Manually</>
          )}
        </button>
      </div>

      {manual ? (
        <FormField
          {...register("student_id")}
          placeholder="e.g. AL-M25-00042"
          className="border-2 focus:border-primary"
        />
      ) : (
        <FormField
          value=""
          readOnly
          placeholder="Auto-generated on save"
          className="bg-gray-50 text-gray-400 italic cursor-not-allowed"
        />
      )}

      <p className="text-[10px] text-gray-400 mt-1">
        {manual
          ? "You are entering a custom Student ID — make sure it is unique."
          : "The system will auto-generate a unique ID based on campus & enrollment year."}
      </p>
    </div>
  )
}
// ─────────────────────────────────────────────────────────────────────────────

interface PersonalDetailsStepProps {
  register: UseFormRegister<StudentCreateInput>
  control: Control<StudentCreateInput>
  errors: FieldErrors<StudentCreateInput>
  setError: UseFormSetError<StudentCreateInput>
  setValue: (field: "student_id", value: string) => void
  watch: (field: "student_id" | "email" | "student_cnic") => string | undefined
  uploadedImages: { [key: string]: string }
  onImageUpload: (event: React.ChangeEvent<HTMLInputElement>, imageKey: string) => void
  onRemoveImage: (imageKey: string) => void
  fileInputRef: React.RefObject<HTMLInputElement>
  formOptions?: any
}

export function PersonalDetailsStep({
  register,
  control,
  errors,
  setError,
  setValue,
  watch,
  uploadedImages,
  onImageUpload,
  onRemoveImage,
  fileInputRef,
  formOptions,
}: PersonalDetailsStepProps) {
  const dobController = useController({ control, name: "dob" })

  const cnicRegister = register("student_cnic", {
    onChange: (e) => {
      e.target.value = formatCnicDashed(e.target.value)
    },
  })
  const emailRegister = register("email")

  return (
    <Card className="border-2 bg-white">
      <CardHeader>
        <CardTitle>Personal Details</CardTitle>
        <p className="text-sm text-gray-600">Fields marked with * are required</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Student Photo Upload */}
        <div>
          <Label>Student Photo</Label>
          <div className="mt-2">
            {uploadedImages.studentPhoto ? (
              <div className="relative inline-block">
                <img
                  src={uploadedImages.studentPhoto || "/placeholder.svg"}
                  alt="Student"
                  className="w-32 h-32 object-cover rounded-lg border-2"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                  onClick={() => onRemoveImage("studentPhoto")}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors border-gray-300"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                <p className="text-sm text-gray-600">Click to upload student photo</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onImageUpload(e, "studentPhoto")}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StudentIdField register={register} studentId={watch("student_id") || ""} setValue={setValue} />

          <FormField label="Student Name" required {...register("name")} error={errors.name} placeholder="Enter full name" />

          <FormField
            label="Email address"
            type="email"
            {...emailRegister}
            error={errors.email}
            hint="Optional. Both email or Student ID can be used for login."
            placeholder="e.g. student@example.com"
            onBlur={async (e) => {
              emailRegister.onBlur(e)
              const val = e.target.value
              if (val && !errors.email) {
                const res = await checkStudentDuplicate(undefined, val)
                if (res.email_exists) {
                  setError("email", { type: "manual", message: "This email is already in use by an active student." })
                }
              }
            }}
          />

          <FormSelect
            control={control}
            name="gender"
            label="Gender"
            required
            placeholder="Select gender"
            error={errors.gender}
            options={(formOptions?.gender || []).map((o: any) => ({ value: o.value, label: o.label }))}
          />

          <div>
            <DatePicker
              id="dob"
              label="Date of Birth"
              required
              date={dobController.field.value}
              onChange={(v: string) => dobController.field.onChange(v)}
              error={!!errors.dob}
              disabled={(date: Date) => date > new Date() || date < new Date("1900-01-01")}
            />
            {errors.dob?.message && <p className="text-sm text-red-600 mt-1">{errors.dob.message}</p>}
          </div>

          <FormField label="Place of Birth" {...register("placeOfBirth")} error={errors.placeOfBirth} placeholder="Enter place of birth" />

          <FormSelect
            control={control}
            name="religion"
            label="Religion"
            required
            placeholder="Select religion"
            error={errors.religion}
            options={(formOptions?.religion || []).map((o: any) => ({ value: o.value, label: o.label }))}
          />

          <FormSelect
            control={control}
            name="motherTongue"
            label="Mother Tongue"
            required
            placeholder="Select mother tongue"
            error={errors.motherTongue}
            options={(formOptions?.mother_tongue || []).map((o: any) => ({ value: o.value, label: o.label }))}
          />

          <FormField
            label="Student B-Form / CNIC"
            error={errors.student_cnic}
            placeholder="XXXXX-XXXXXXX-X"
            maxLength={15}
            {...cnicRegister}
            onBlur={async (e) => {
              cnicRegister.onBlur(e)
              const val = e.target.value
              if (val && !errors.student_cnic) {
                const res = await checkStudentDuplicate(val, undefined)
                if (res.cnic_exists) {
                  setError("student_cnic", { type: "manual", message: "This CNIC/B-Form is already in use by an active student." })
                }
              }
            }}
          />

          <FormSelect
            control={control}
            name="nationality"
            label="Nationality"
            placeholder="Select nationality"
            options={(formOptions?.nationality || []).map((o: any) => ({ value: o.value, label: o.label }))}
          />

          <FormSelect
            control={control}
            name="blood_group"
            label="Blood Group"
            placeholder="Select blood group"
            options={(formOptions?.blood_group || []).map((o: any) => ({ value: o.value, label: o.label }))}
          />

          <FormSelect
            control={control}
            name="special_needs_disability"
            label="Special Needs / Disability"
            placeholder="Select status"
            options={(formOptions?.special_needs || []).map((o: any) => ({ value: o.value, label: o.label }))}
          />
        </div>
      </CardContent>
    </Card>
  )
}
