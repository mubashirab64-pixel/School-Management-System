"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Save, Loader2, User, GraduationCap, Briefcase, Building2, CheckCircle, ShieldCheck } from "lucide-react"
import { useEffect, useState } from "react"
import { API_ENDPOINTS, apiPost, getAllCampuses, getClassrooms } from "@/lib/api"
import { toast } from "sonner"
import { getApiBaseUrl } from "@/lib/api"

interface TeacherPreviewProps {
  formData: any
  onBack: () => void
  onSubmit?: () => void
}

export function TeacherPreview({ formData, onBack, onSubmit }: TeacherPreviewProps) {
  const [saving, setSaving] = useState(false)
  const [campuses, setCampuses] = useState<any[]>([])
  const [assignedDetails, setAssignedDetails] = useState<any[]>([])

  useEffect(() => {
    getAllCampuses()
      .then((data: any) => {
        const list = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : []
        setCampuses(list)
      })
      .catch(() => setCampuses([]))
  }, [])

  // Load details for all assigned classrooms
  useEffect(() => {
    const loadAssigned = async () => {
      try {
        const ids = Array.isArray(formData.assigned_classrooms) ? formData.assigned_classrooms : []
        if (ids.length === 0) { setAssignedDetails([]); return }
        const results: any[] = []
        for (const id of ids) {
          try {
            const base = getApiBaseUrl()
            const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base
            const response = await fetch(`${cleanBase}/api/classrooms/${id}/`, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('sis_access_token')}`
              }
            })
            if (!response.ok) continue
            const detail = await response.json()
            results.push(detail)
          } catch (_) { }
        }
        setAssignedDetails(results)
      } catch (_) { setAssignedDetails([]) }
    }
    if (Array.isArray(formData.assigned_classrooms) && formData.assigned_classrooms.length > 0) loadAssigned()
    else setAssignedDetails([])
  }, [formData.assigned_classrooms])

  const getCampusName = (val: string) => {
    if (!val) return "N/A"
    const campus = campuses.find((c: any) => String(c.id ?? c.campus_id) === String(val))
    return campus ? (campus.campus_name || campus.name || `Campus ${val}`) : `Campus ${val}`
  }

  const handleSave = async () => {
    if (onSubmit) {
      setSaving(true)
      try {
        await onSubmit()
      } catch (error) {
        console.error("Save failed:", error)
      } finally {
        setSaving(false)
      }
      return
    }

    setSaving(true)
    try {
      const missing: string[] = []
      if (!formData.full_name) missing.push("Full name")
      if (!formData.dob) missing.push("Date of Birth")
      if (!formData.gender) missing.push("Gender")
      if (!formData.contact_number) missing.push("Contact number")
      if (!formData.email) missing.push("Email")
      if (!formData.current_address) missing.push("Current address")
      if (!formData.cnic) missing.push("CNIC")
      if (!formData.current_campus) missing.push("Current campus")
      if (!formData.joining_date) missing.push("Joining date")
      if (!formData.shift) missing.push("Shift")
      if (missing.length > 0) {
        toast.error("Please fill required fields", { description: missing.join(", ") })
        return
      }

      // Resolve campus ID
      let resolvedCampusId: number | null = null
      try {
        const campusInput = formData.current_campus
        const numFromInput = Number(String(campusInput).match(/\d+/)?.[0] || campusInput)
        let match = campuses.find((c: any) => Number(c.id ?? c.campus_id) === numFromInput)
        resolvedCampusId = match ? Number(match.id ?? match.campus_id) : (Number.isFinite(numFromInput) ? numFromInput : null)
      } catch {
        resolvedCampusId = formData.current_campus ? parseInt(formData.current_campus) : null
      }

      // Resolve assigned classroom
      let resolvedAssignedClassroom: number | null = formData.assigned_classroom ? parseInt(formData.assigned_classroom) : null
      try {
        if (!resolvedAssignedClassroom && formData.class_teacher_grade && formData.class_teacher_section) {
          const data: any = await getClassrooms(formData.class_teacher_grade)
          const list = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : []
          const match = list.find((c: any) => c.section === formData.class_teacher_section)
          if (match) resolvedAssignedClassroom = match.id
        }
      } catch { }

      const payload: any = {
        ...formData,
        current_campus: resolvedCampusId,
        year_of_passing: formData.year_of_passing ? parseInt(formData.year_of_passing) : null,
        total_experience_years: formData.total_experience_years ? parseFloat(formData.total_experience_years) : null,
        is_currently_active: Boolean(formData.is_currently_active),
        is_class_teacher: Boolean(formData.is_class_teacher),
        is_teacher_assistant: Boolean(formData.is_teacher_assistant),
        assigned_classroom: resolvedAssignedClassroom,
        assigned_classrooms: Array.isArray(formData.assigned_classrooms) ? formData.assigned_classrooms.map((x: any) => Number(x)) : [],
        assigned_coordinators: Array.isArray(formData.assigned_coordinators) ? formData.assigned_coordinators.map((x: any) => Number(x)) : [],
        dob: formData.dob && typeof formData.dob === 'string' && formData.dob.trim() !== '' ? formData.dob : null,
        joining_date: formData.joining_date && typeof formData.joining_date === 'string' && formData.joining_date.trim() !== '' ? formData.joining_date : null,
        experience_from_date: formData.experience_from_date && typeof formData.experience_from_date === 'string' && formData.experience_from_date.trim() !== '' ? formData.experience_from_date : null,
        experience_to_date: formData.experience_to_date && typeof formData.experience_to_date === 'string' && formData.experience_to_date.trim() !== '' ? formData.experience_to_date : null,
      }

      // Strip null/empty
      Object.keys(payload).forEach((k) => {
        const v = payload[k]
        if (v === null || v === undefined || v === "") {
          if (k !== 'assigned_classroom') delete payload[k]
        }
      })

      const base = getApiBaseUrl()
      const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Request timeout")), 15000))
      const response = await Promise.race([
        fetch(`${cleanBase}/api/teachers/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('sis_access_token')}`
          },
          body: JSON.stringify(payload)
        }).then(async (r) => {
          if (!r.ok) throw new Error(await r.text())
          return r.json()
        }),
        timeout
      ]) as any

      const teacherName = response?.full_name || formData.full_name || "Teacher"
      const employeeCode = response?.employee_code || "Pending"

      toast.success("Teacher Added Successfully!", {
        description: `${teacherName} (${employeeCode}) has been added to the system.`
      })
      onBack()
    } catch (err: any) {
      console.error("Failed to save teacher", err)
      let description = err?.message || "Unexpected error"
      try {
        const parsed = JSON.parse(err?.message || '{}')
        if (typeof parsed === 'object') {
          description = Object.entries(parsed).map(([k, v]) => `${k}: ${(Array.isArray(v) ? v.join(' | ') : String(v))}`).join("; ")
        }
      } catch (_) { }
      toast.error("Failed to save teacher", { description })
    } finally {
      setSaving(false)
    }
  }

  // Helper: info row
  const InfoRow = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
    <div className="flex justify-between items-start py-1.5">
      <span className="text-gray-500 text-sm">{label}</span>
      <span className={`text-sm font-semibold text-right max-w-[60%] ${highlight ? "text-blue-700" : "text-gray-900"}`}>
        {value || "—"}
      </span>
    </div>
  )

  return (
    <Card className="border-2 border-[#E7ECEF] shadow-lg">
      <CardContent className="pt-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-[#274C77] flex items-center gap-2">
            <CheckCircle className="h-6 w-6 text-green-500" />
            Review Teacher Information
          </h3>
          <span className="text-xs bg-blue-100 text-blue-700 font-bold px-3 py-1 rounded-full">
            Final Step
          </span>
        </div>
        <p className="text-sm text-gray-500 -mt-4">Please verify all details before submission</p>

        {/* 4-column grid — one per form step */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

          {/* ──── Column 1: Personal Info ──── */}
          <div className="space-y-4">
            <h4 className="font-bold text-[#274C77] border-b border-[#E7ECEF] pb-2 flex items-center gap-2">
              <User className="h-4 w-4" /> Personal Info
            </h4>
            <div className="space-y-0 divide-y divide-gray-100">
              <InfoRow label="Full Name" value={formData.full_name} highlight />
              <InfoRow label="Father/Husband" value={formData.father_name} />
              <InfoRow label="Date of Birth" value={formData.dob} />
              <InfoRow label="Gender" value={formData.gender ? formData.gender.charAt(0).toUpperCase() + formData.gender.slice(1) : ""} />
              <InfoRow label="CNIC" value={formData.cnic} />
              <InfoRow label="Contact" value={formData.contact_number} />
              <InfoRow label="Email" value={formData.email} />
              <InfoRow label="Biometric ID" value={formData.biometric_id} highlight />
              <InfoRow label="Marital Status" value={formData.marital_status ? formData.marital_status.charAt(0).toUpperCase() + formData.marital_status.slice(1) : ""} />
              <InfoRow label="Address" value={formData.current_address} />
              {formData.permanent_address && <InfoRow label="Permanent" value={formData.permanent_address} />}
            </div>
          </div>

          {/* ──── Column 2: Education ──── */}
          <div className="space-y-4">
            <h4 className="font-bold text-[#274C77] border-b border-[#E7ECEF] pb-2 flex items-center gap-2">
              <GraduationCap className="h-4 w-4" /> Education
            </h4>
            <div className="space-y-0 divide-y divide-gray-100">
              <InfoRow label="Level" value={formData.education_level} />
              <InfoRow label="Institution" value={formData.institution_name} />
              <InfoRow label="Passing Year" value={String(formData.year_of_passing || "")} />
              <InfoRow label="Subjects" value={formData.education_subjects} />
              <InfoRow label="Grade / GPA" value={formData.education_grade} />
            </div>
          </div>

          {/* ──── Column 3: Experience ──── */}
          <div className="space-y-4">
            <h4 className="font-bold text-[#274C77] border-b border-[#E7ECEF] pb-2 flex items-center gap-2">
              <Briefcase className="h-4 w-4" /> Experience
            </h4>
            <div className="space-y-0 divide-y divide-gray-100">
              <InfoRow label="Institution" value={formData.previous_institution_name} />
              <InfoRow label="Position" value={formData.previous_position} />
              <InfoRow label="From" value={formData.experience_from_date} />
              <InfoRow label="To" value={formData.experience_to_date} />
              <InfoRow label="Total Years" value={formData.total_experience_years ? `${formData.total_experience_years} years` : ""} />
            </div>
          </div>

          {/* ──── Column 3: Current Role & Assignment ──── */}
          <div className="space-y-4">
            <h4 className="font-bold text-[#274C77] border-b border-[#E7ECEF] pb-2 flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Current Role
            </h4>
            <div className="space-y-0 divide-y divide-gray-100">
              <InfoRow label="Campus" value={getCampusName(formData.current_campus)} highlight />
              <InfoRow label="Joining Date" value={formData.joining_date} />
              <InfoRow label="Shift" value={formData.shift ? formData.shift.charAt(0).toUpperCase() + formData.shift.slice(1) : ""} />
              <InfoRow label="Employment" value={formData.is_currently_active ? "✅ Active" : "❌ Inactive"} />
              <InfoRow label="Class Teacher" value={formData.is_class_teacher ? "✅ Yes" : "❌ No"} />
              <InfoRow label="Assistant Teacher" value={formData.is_teacher_assistant ? "✅ Yes" : "❌ No"} />
              {formData.current_role_title && <InfoRow label="Designation" value={formData.current_role_title} />}
              {formData.current_subjects && <InfoRow label="Subjects" value={formData.current_subjects} />}
              {formData.current_classes_taught && <InfoRow label="Classes" value={formData.current_classes_taught} />}
              {formData.current_extra_responsibilities && <InfoRow label="Extra Duties" value={formData.current_extra_responsibilities} />}
            </div>

            {/* Assigned Classrooms */}
            {formData.is_class_teacher && (
              <div className="mt-3">
                <h4 className="font-bold text-[#274C77] border-b border-[#E7ECEF] pb-2 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" /> Assigned Classrooms
                </h4>
                {Array.isArray(formData.assigned_classrooms) && formData.assigned_classrooms.length > 0 ? (
                  <div className="space-y-1 mt-2">
                    {formData.assigned_classrooms.map((cid: any, idx: number) => {
                      const c = assignedDetails.find((x: any) => String(x?.id) === String(cid))
                      const label = c
                        ? `${c?.grade_name || c?.grade} – ${c?.section} (${c?.shift})`
                        : `Classroom #${cid}`
                      return (
                        <div key={idx} className="text-sm bg-blue-50 text-blue-800 px-3 py-1.5 rounded-lg font-medium">
                          • {label}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic mt-2">No classrooms assigned</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between gap-4 pt-4 border-t border-[#E7ECEF]">
          <Button
            onClick={onBack}
            variant="outline"
            className="flex items-center gap-2 border-2 rounded-xl h-11 px-6 font-semibold text-gray-600 hover:bg-gray-50"
            disabled={saving}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Edit
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1 max-w-xs items-center gap-2 bg-[#6096BA] hover:bg-[#274C77] text-white rounded-xl h-11 font-bold shadow-lg transition-all active:scale-95"
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Save className="h-5 w-5" />
                Submit & Finalize Teacher
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
