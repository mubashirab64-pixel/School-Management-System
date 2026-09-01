"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Save, Loader2, GraduationCap } from "lucide-react"
import { apiPost, apiPostFormData } from "@/lib/api"
import { useState } from "react"
import { toast as sonnerToast } from "sonner"
import { parseField, emailField, optionalEmailField } from "@/lib/validation/common"

interface CampusPreviewProps {
  formData: any
  onBack: () => void
  onSaved?: () => void
}

function yesNo(val: any) {
  if (val === true || val === "true") return "Yes"
  if (val === false || val === "false") return "No"
  return "Not specified"
}

export function CampusPreview({ formData, onBack, onSaved }: CampusPreviewProps) {
  const [saving, setSaving] = useState(false)

  const isBothShift = formData.shift_available === "both"
  const isSingleShift = formData.shift_available === "morning" || formData.shift_available === "evening"
  const shiftLabel = formData.shift_available === "morning" ? "Morning" : formData.shift_available === "evening" ? "Evening" : "Both"

  const statusMap: Record<string, { label: string; variant: any }> = {
    active: { label: "Active", variant: "default" },
    inactive: { label: "Inactive", variant: "secondary" },
    pending: { label: "Pending", variant: "outline" },
    under_construction: { label: "Under Construction", variant: "outline" },
  }
  const statusInfo = statusMap[formData.status] || statusMap.active

  const handleSave = async () => {
    // Final client-side guard: never fire a request that's already known to be
    // invalid — catch and show it here instead of round-tripping to the backend.
    const emailErrors: string[] = []
    if (!parseField(emailField('Official email'), formData.official_email ?? '').isValid) {
      emailErrors.push("Official Email is required and must be a valid email address")
    }
    if (!parseField(optionalEmailField(), formData.campus_head_email ?? '').isValid) {
      emailErrors.push("Campus Head Email must be a valid email address")
    }
    if (emailErrors.length > 0) {
      sonnerToast.error("Please fix the email field(s) before saving", {
        description: emailErrors.join(" · "),
        duration: 8000,
      })
      return
    }

    setSaving(true)
    try {
      sonnerToast.loading("Saving campus...")

      const campusData: Record<string, any> = {
        campus_name: formData.campus_name || "",
        campus_code: formData.campus_code || "",
        campus_id: formData.campus_id || "",
        sub_domain: formData.sub_domain || "",
        city: formData.city || "",
        postal_code: formData.postal_code || "",
        district: formData.district || "",
        shift_available: formData.shift_available || "morning",
        status: formData.status || "active",
        registration_number: formData.registration_number || "",
        established_year: formData.established_year || null,
        address_full: formData.address_full || "",
        grades_offered: formData.grades_offered || "",
        grades_data: formData.grades_data || [],
        instruction_language: formData.instruction_language || "",
        academic_year_start_month: formData.academic_year_start_month || "",
        academic_year_end_month: formData.academic_year_end_month || "",

        total_classrooms: parseInt(formData.total_classrooms || "0") || 0,
        total_staff_rooms: parseInt(formData.total_staff_rooms || "0") || 0,
        has_computer_lab: !!formData.has_computer_lab,
        has_science_lab: !!formData.has_science_lab,
        has_biology_lab: !!formData.has_biology_lab,
        has_chemistry_lab: !!formData.has_chemistry_lab,
        has_physics_lab: !!formData.has_physics_lab,
        total_rooms: parseInt(formData.total_rooms || "0") || 0,
        power_backup: !!formData.power_backup,
        internet_available: !!formData.internet_available,
        sports_available: formData.sports_available_toggle ? (formData.sports_available || "") : "",
        canteen_facility: !!formData.canteen_facility,
        teacher_transport: !!formData.teacher_transport,
        student_transport: !!formData.student_transport,
        meal_program: !!formData.meal_program,
        library_available: !!formData.library_available,
        governing_body: formData.governing_body || "",
        campus_head_name: formData.campus_head_name || "",
        campus_head_phone: formData.campus_head_phone || "",
        campus_head_email: formData.campus_head_email || "",
        primary_phone: formData.primary_phone || "",
        secondary_phone: formData.secondary_phone || "",
        official_email: formData.official_email || "",

      }

      let savedCampus: any = null

      if (formData.campus_photo && formData.campus_photo.startsWith("data:")) {
        try {
          const photoResponse = await fetch(formData.campus_photo)
          const blob = await photoResponse.blob()
          const photoFile = new File([blob], "campus-photo.jpg", { type: blob.type })
          const fd = new FormData()
          Object.entries(campusData).forEach(([key, value]) => {
            if (Array.isArray(value) || (value !== null && typeof value === "object")) {
              fd.append(key, JSON.stringify(value))
            } else {
              fd.append(key, String(value))
            }
          })
          fd.append("campus_photo", photoFile)
          savedCampus = await apiPostFormData("/api/campus/", fd)
        } catch {
          savedCampus = await apiPost("/api/campus/", campusData)
        }
      } else {
        savedCampus = await apiPost("/api/campus/", campusData)
      }

      sonnerToast.dismiss()
      sonnerToast.success("Campus Added Successfully!", {
        description: `Campus ID: ${savedCampus?.campus_id || "N/A"} | Code: ${savedCampus?.campus_code || "N/A"}`,
        duration: 5000,
      })
      onSaved?.()
    } catch (error: any) {
      sonnerToast.dismiss()
      sonnerToast.error("Failed to save campus", {
        description: error?.message || "Please try again or contact support.",
        duration: 8000,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Campus Preview
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          </CardTitle>
          <CardDescription>Review all information before saving</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Photo */}
          {formData.campus_photo && (
            <div>
              <h3 className="font-semibold mb-2">Campus Photo</h3>
              <img src={formData.campus_photo} alt="Campus" className="w-full max-w-md h-48 object-cover rounded-lg border" />
            </div>
          )}

          {/* Basic Info */}
          <div>
            <h3 className="font-semibold mb-3">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Campus Name:</span><p className="font-medium">{formData.campus_name || "—"}</p></div>
              <div><span className="text-gray-500">Campus Code:</span><p className="font-medium">{formData.campus_code || "—"}</p></div>
              <div><span className="text-gray-500">Campus ID:</span><p className="font-medium font-mono">{formData.campus_id || "—"}</p></div>
              <div><span className="text-gray-500">Sub Domain:</span><p className="font-medium">{formData.sub_domain || "—"}</p></div>
              <div><span className="text-gray-500">City:</span><p className="font-medium">{formData.city || "—"}</p></div>
              <div><span className="text-gray-500">Postal Code:</span><p className="font-medium">{formData.postal_code || "—"}</p></div>
              <div><span className="text-gray-500">District:</span><p className="font-medium">{formData.district || "—"}</p></div>
              <div><span className="text-gray-500">Registration No:</span><p className="font-medium">{formData.registration_number || "—"}</p></div>
              <div><span className="text-gray-500">Shift:</span><p className="font-medium">{shiftLabel}</p></div>
              <div><span className="text-gray-500">Language:</span><p className="font-medium">{formData.instruction_language || "—"}</p></div>
              <div><span className="text-gray-500">Academic Year:</span><p className="font-medium">{formData.academic_year_start_month || "—"} → {formData.academic_year_end_month || "—"}</p></div>
              <div className="md:col-span-2"><span className="text-gray-500">Full Address:</span><p className="font-medium">{formData.address_full || "—"}</p></div>
            </div>
          </div>

          <Separator />



          <Separator />

          {/* Grades */}
          {formData.grades_data?.length > 0 && (
            <>
              <div>
                <h3 className="font-semibold mb-3">Grades Offered</h3>
                <div className="space-y-2">
                  {Object.entries(
                    (formData.grades_data as any[]).reduce<Record<string, any[]>>((acc, entry) => {
                      if (!acc[entry.level]) acc[entry.level] = []
                      acc[entry.level].push(entry)
                      return acc
                    }, {})
                  ).map(([level, entries]) => (
                    <div key={level} className="border rounded-lg overflow-hidden">
                      <div className="px-4 py-2 bg-blue-50 font-semibold text-sm text-blue-800 flex items-center gap-2">
                        <GraduationCap className="w-4 h-4" />{level}
                        <Badge variant="secondary">{entries.length}</Badge>
                      </div>
                      <div className="divide-y">
                        {(entries as any[]).map((e: any) => (
                          <div key={e.grade} className="px-4 py-2 text-sm flex justify-between">
                            <span>{e.grade}</span>
                            <Badge variant="outline">{e.classrooms.count} room(s){e.classrooms.names?.length > 0 ? `: ${e.classrooms.names.join(", ")}` : ""}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Rooms */}
          <div>
            <h3 className="font-semibold mb-3">Infrastructure — Rooms</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><span className="text-gray-500">Classrooms:</span><p className="font-medium">{formData.total_classrooms || 0}</p></div>
              <div><span className="text-gray-500">Staff Rooms:</span><p className="font-medium">{formData.total_staff_rooms || 0}</p></div>
              <div><span className="text-gray-500">Computer Lab:</span><p className="font-medium">{yesNo(formData.has_computer_lab)}</p></div>
              <div><span className="text-gray-500">Biology Lab:</span><p className="font-medium">{yesNo(formData.has_biology_lab)}</p></div>
              <div><span className="text-gray-500">Chemistry Lab:</span><p className="font-medium">{yesNo(formData.has_chemistry_lab)}</p></div>
              <div><span className="text-gray-500">Physics Lab:</span><p className="font-medium">{yesNo(formData.has_physics_lab)}</p></div>
              <div><span className="text-gray-500">Science Lab:</span><p className="font-medium">{yesNo(formData.has_science_lab)}</p></div>
              <div className="md:col-span-1 p-2 bg-slate-100 rounded border border-slate-200"><span className="text-gray-500">Total Rooms:</span><p className="font-semibold">{formData.total_rooms || 0}</p></div>
            </div>
          </div>



          {/* Facilities */}
          <div>
            <h3 className="font-semibold mb-3">Facilities</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div><span className="text-gray-500">Power Backup:</span><p className="font-medium">{yesNo(formData.power_backup)}</p></div>
              <div><span className="text-gray-500">Internet:</span><p className="font-medium">{yesNo(formData.internet_available)}</p></div>
              <div><span className="text-gray-500">Canteen:</span><p className="font-medium">{yesNo(formData.canteen_facility)}</p></div>
              <div><span className="text-gray-500">Library:</span><p className="font-medium">{yesNo(formData.library_available)}</p></div>
              <div><span className="text-gray-500">Teacher Transport:</span><p className="font-medium">{yesNo(formData.teacher_transport)}</p></div>
              <div><span className="text-gray-500">Student Transport:</span><p className="font-medium">{yesNo(formData.student_transport)}</p></div>
              <div><span className="text-gray-500">Meal Program:</span><p className="font-medium">{yesNo(formData.meal_program)}</p></div>
              <div className="md:col-span-2">
                <span className="text-gray-500">Sports:</span>
                <p className="font-medium">
                  {!!formData.sports_available_toggle
                    ? (formData.sports_available || "Yes (not specified)")
                    : "No"}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Contact */}
          <div>
            <h3 className="font-semibold mb-3">Campus Head & Contact</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Head Name:</span><p className="font-medium">{formData.campus_head_name || "—"}</p></div>
              <div><span className="text-gray-500">Head Phone:</span><p className="font-medium">{formData.campus_head_phone || "—"}</p></div>
              <div><span className="text-gray-500">Head Email:</span><p className="font-medium">{formData.campus_head_email || "—"}</p></div>
              <div><span className="text-gray-500">Primary Phone:</span><p className="font-medium">{formData.primary_phone || "—"}</p></div>
              <div><span className="text-gray-500">Secondary Phone:</span><p className="font-medium">{formData.secondary_phone || "—"}</p></div>
              <div><span className="text-gray-500">Official Email:</span><p className="font-medium">{formData.official_email || "—"}</p></div>
            </div>
          </div>

        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Edit
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
          ) : (
            <><Save className="w-4 h-4 mr-2" />Save Campus</>
          )}
        </Button>
      </div>
    </div>
  )
}
