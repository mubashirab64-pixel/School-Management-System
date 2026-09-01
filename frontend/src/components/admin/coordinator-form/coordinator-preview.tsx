"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Save, Loader2, User, GraduationCap, Building2, CheckCircle, Edit } from "lucide-react"
import { format } from "date-fns"

interface CoordinatorPreviewProps {
  formData: any
  onEdit: () => void
  onSubmit: () => void
  onCancel: () => void
  isEdit: boolean
  campuses?: any[]
  levels?: any[]
  isSubmitting?: boolean
}

const InfoRow = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div className="flex justify-between items-start py-1.5">
    <span className="text-gray-500 text-sm">{label}</span>
    <span className={`text-sm font-semibold text-right max-w-[60%] ${highlight ? "text-blue-700" : "text-gray-900"}`}>
      {value || "—"}
    </span>
  </div>
)

const capitalize = (val?: string) => val ? val.charAt(0).toUpperCase() + val.slice(1) : ""

export function CoordinatorPreview({
  formData,
  onEdit,
  onSubmit,
  onCancel,
  isEdit,
  campuses = [],
  levels = [],
  isSubmitting = false,
}: CoordinatorPreviewProps) {
  const campusName =
    campuses.find((c: any) => c.id === parseInt(formData.campus))?.campus_name || "—"

  let levelName = "—"
  if (formData.shift === "both") {
    const selectedIds: number[] = Array.isArray(formData.assigned_levels)
      ? formData.assigned_levels.map((x: any) => parseInt(x))
      : []
    const selectedLevels = levels.filter((l: any) => selectedIds.includes(l.id))
    if (selectedLevels.length > 0) {
      levelName = selectedLevels
        .map((l: any) => {
          const shiftLabel = (l.shift_display || l.shift || "").toString()
          return `${l.name} (${shiftLabel})`
        })
        .join(", ")
    }
  } else {
    levelName = levels.find((l: any) => l.id === parseInt(formData.level))?.name || "—"
  }

  const formatDate = (val?: string) => {
    if (!val) return "—"
    try { return format(new Date(val), "PPP") } catch { return val }
  }

  return (
    <Card className="border-2 border-[#E7ECEF] shadow-lg">
      <CardContent className="pt-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-[#274C77] flex items-center gap-2">
            <CheckCircle className="h-6 w-6 text-green-500" />
            {isEdit ? "Edit Coordinator — Preview" : "Review Coordinator Information"}
          </h3>
          <span className="text-xs bg-blue-100 text-blue-700 font-bold px-3 py-1 rounded-full">
            Final Step
          </span>
        </div>
        <p className="text-sm text-gray-500 -mt-4">Please verify all details before submission</p>

        {/* 3-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

          {/* ── Personal Info ── */}
          <div className="space-y-4">
            <h4 className="font-bold text-[#274C77] border-b border-[#E7ECEF] pb-2 flex items-center gap-2">
              <User className="h-4 w-4" /> Personal Info
            </h4>
            <div className="space-y-0 divide-y divide-gray-100">
              <InfoRow label="Full Name" value={formData.full_name} highlight />
              <InfoRow label="Date of Birth" value={formatDate(formData.dob)} />
              <InfoRow label="Gender" value={capitalize(formData.gender)} />
              <InfoRow label="Marital Status" value={capitalize(formData.marital_status)} />
              <InfoRow label="Religion" value={capitalize(formData.religion)} />
              <InfoRow label="CNIC" value={formData.cnic} />
              <InfoRow label="Contact" value={formData.contact_number} />
              <InfoRow label="Email" value={formData.email} />
              <InfoRow label="Biometric ID" value={formData.biometric_id} highlight />
              <InfoRow label="Address" value={formData.permanent_address} />
            </div>
          </div>

          {/* ── Education ── */}
          <div className="space-y-4">
            <h4 className="font-bold text-[#274C77] border-b border-[#E7ECEF] pb-2 flex items-center gap-2">
              <GraduationCap className="h-4 w-4" /> Education
            </h4>
            <div className="space-y-0 divide-y divide-gray-100">
              <InfoRow label="Education Level" value={formData.education_level} />
              <InfoRow label="Institution" value={formData.institution_name} />
              <InfoRow label="Passing Year" value={String(formData.year_of_passing || "")} />
              <InfoRow
                label="Total Experience"
                value={formData.total_experience_years ? `${formData.total_experience_years} years` : ""}
              />
            </div>
          </div>

          {/* ── Work Assignment ── */}
          <div className="space-y-4">
            <h4 className="font-bold text-[#274C77] border-b border-[#E7ECEF] pb-2 flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Work Assignment
            </h4>
            <div className="space-y-0 divide-y divide-gray-100">
              <InfoRow label="Campus" value={campusName} highlight />
              <InfoRow label="Level" value={levelName} />
              <InfoRow label="Shift" value={capitalize(formData.shift)} />
              <InfoRow label="Joining Date" value={formatDate(formData.joining_date)} />
              <InfoRow
                label="Status"
                value={
                  formData.is_currently_active === "true" || formData.is_currently_active === true
                    ? "✅ Active"
                    : "❌ Inactive"
                }
              />
              <InfoRow
                label="Can Assign Teachers"
                value={
                  formData.can_assign_class_teachers === "true" || formData.can_assign_class_teachers === true
                    ? "✅ Yes"
                    : "❌ No"
                }
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between gap-4 pt-4 border-t border-[#E7ECEF] flex-wrap">
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onEdit}
              className="flex items-center gap-2 border-2 rounded-xl h-11 px-6 font-semibold text-gray-600 hover:bg-gray-50"
              disabled={isSubmitting}
            >
              <Edit className="h-4 w-4" />
              Edit
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex items-center gap-2 border-2 rounded-xl h-11 px-6 font-semibold text-gray-600 hover:bg-gray-50"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>

          <Button
            type="button"
            onClick={onSubmit}
            className="flex items-center gap-2 bg-[#6096BA] hover:bg-[#274C77] text-white rounded-xl h-11 px-8 font-bold shadow-lg transition-all active:scale-95"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {isEdit ? "Updating..." : "Saving..."}
              </>
            ) : (
              <>
                <Save className="h-5 w-5" />
                {isEdit ? "Update Coordinator" : "Submit & Add Coordinator"}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
