"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Eye, ArrowLeft, Save } from "lucide-react"
import { apiPost, apiGet, apiPostFormData, getAllCampuses } from "@/lib/api"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"

interface StudentPreviewProps {
  formData: any
  uploadedImages: { [key: string]: string }
  onBack: () => void
  onSaved?: (student: any) => void
  onError?: (error: string) => void
  /** Raw thrown error — lets the parent map field-specific errors back onto the form via setError. */
  onApiError?: (error: unknown) => void
}

export function StudentPreview({ formData, uploadedImages, onBack, onSaved, onError, onApiError }: StudentPreviewProps) {
  const [saving, setSaving] = useState(false)
  const [campuses, setCampuses] = useState<any[]>([])
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    getAllCampuses()
      .then((data: any) => {
        const list = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : []
        setCampuses(list)
      })
      .catch((err) => {
        console.error("Failed to fetch campuses:", err)
        toast.error("Failed to load campus list")
      })
  }, [])

  const normalizeGender = (value: string | undefined): 'male' | 'female' | null => {
    const v = (value || '').toString().trim().toLowerCase()
    if (v === 'male' || v === 'm') return 'male'
    if (v === 'female' || v === 'f') return 'female'
    return null
  }

  const normalizeShift = (value: string | undefined): string | null => {
    const v = (value || '').toString().trim().toLowerCase()
    if (!v) return null
    if (v === 'morning' || v === 'm') return 'morning'
    if (v === 'afternoon' || v === 'a') return 'afternoon'
    return null
  }

  const buildPayload = () => {
    const payload: any = {
      name: formData.name || "",
      gender: normalizeGender(formData.gender),
      dob: formData.dob || null,
      place_of_birth: formData.placeOfBirth || null,
      religion: formData.religion || null,
      mother_tongue: formData.motherTongue || null,
      student_cnic: formData.student_cnic || null,
      nationality: formData.nationality || null,
      blood_group: formData.blood_group || null,
      special_needs_disability: formData.special_needs_disability || null,
      email: formData.email || null,
      country_code: formData.countryCode || null,
      phone_number: formData.phoneNumber || null,
      emergency_contact: formData.emergencyContact || null,
      emergency_relationship: formData.emergency_relationship || null,
      address: formData.address || null,
      family_income: formData.familyIncome ? parseFloat(formData.familyIncome) : null,
      house_owned: formData.houseOwned || null,
      zakat_status: formData.zakatStatus || null,
      student_id: formData.student_id ? String(formData.student_id) : null,
      campus: formData.campus ? Number(formData.campus) : null,
      current_grade: formData.currentGrade || null,
      section: formData.section || null,
      shift: normalizeShift(formData.shift),
      enrollment_year: formData.admissionYear ? Number(formData.admissionYear) : null,
      siblings_count: formData.siblingsCount ? Number(formData.siblingsCount) : null,
      father_status: formData.fatherStatus || null,
      gr_no: formData.grNumber || null,
      classroom: formData.classroom ? Number(formData.classroom) : null,
      father_name: formData.fatherName || null,
      father_contact: formData.fatherContact || null,
      father_cnic: formData.fatherCNIC || null,
      father_profession: formData.fatherProfession || null,
      mother_name: formData.motherName || null,
      mother_contact: formData.motherContact || null,
      mother_cnic: formData.motherCNIC || null,
      mother_status: formData.motherStatus || null,
      mother_profession: formData.motherProfession || null,
      guardian_name: formData.guardianName || null,
      guardian_cnic: formData.guardianCNIC || null,
      guardian_profession: formData.guardianProfession || null,
      guardian_contact: formData.guardianContact || null,
      is_draft: true,
    }

    const knownFields = [
      'name', 'gender', 'dob', 'placeOfBirth', 'religion', 'motherTongue', 'student_cnic', 'nationality',
      'blood_group', 'special_needs_disability', 'countryCode', 'phoneNumber',
      'emergencyContact', 'emergency_relationship', 'address', 'familyIncome',
      'campus', 'currentGrade', 'section', 'admissionYear',
      'shift', 'classroom',
      'siblingsCount', 'fatherStatus', 'siblingInAlkhair', 'fatherName',
      'fatherContact', 'fatherCNIC', 'fatherProfession', 'motherName',
      'motherContact', 'motherCNIC', 'motherStatus', 'motherProfession',
      'guardianName', 'guardianCNIC', 'guardianProfession', 'guardianRelation', 'guardianContact', 'student_id', 'grNumber', 'email',
      'houseOwned', 'zakatStatus'
    ]

    const dynamicData: any = {}
    Object.keys(formData).forEach(key => {
      if (!knownFields.includes(key) && formData[key] !== undefined && formData[key] !== "") {
        dynamicData[key] = formData[key]
      }
    })

    if (Object.keys(dynamicData).length > 0) {
      payload.dynamic_data = dynamicData
    }

    Object.keys(payload).forEach(key => {
      if (payload[key] === null || payload[key] === undefined || payload[key] === "") {
        delete payload[key]
      }
    })

    return payload
  }

  const handleSave = async () => {
    setSaving(true)
    setSubmitError(null)
    try {
      const payload = buildPayload()
      let savedResult: any

      if (uploadedImages.studentPhoto) {
        const base64Data = uploadedImages.studentPhoto.split(',')[1]
        const byteCharacters = atob(base64Data)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        const file = new File([byteArray], 'student_photo.jpg', { type: 'image/jpeg' })

        const formData = new FormData()
        formData.append('photo', file)
        Object.keys(payload).forEach(key => {
          if (payload[key] !== null && payload[key] !== undefined) {
            formData.append(key, payload[key])
          }
        })
        savedResult = await apiPostFormData("/api/students/", formData)
        await new Promise((res) => setTimeout(res, 2000))
      } else {
        const apiPromise = apiPost("/api/students/", payload)
        const delay = new Promise((res) => setTimeout(res, 2000))
        const [apiResult] = await Promise.all([apiPromise, delay])
        savedResult = apiResult
      }
      onSaved?.(savedResult)
    } catch (err: any) {
      console.warn("Student save failed:", err)
      onApiError?.(err)
      const msg: string = err?.message || "An unexpected error occurred while saving."
      let friendly = msg
      try {
        if (err?.response) {
          const data = JSON.parse(err.response)
          if (data && typeof data === 'object') {
            const entries = Object.entries(data as Record<string, any>)
            if (entries.length > 0) {
              const [field, value] = entries[0]
              const first = Array.isArray(value) ? value[0] : String(value)
              friendly = `${first}`
            }
          }
        }
      } catch { }

      if (friendly.toLowerCase().includes('no classroom is available')) {
        const combo = `${formData.currentGrade || 'Grade'}-${formData.section || ''} ${formData.shift || ''}`.trim()
        const uiMsg = `No classroom found for ${combo} in the selected campus. Please create the classroom first, then try again.`
        setSubmitError(uiMsg)
        onError?.(uiMsg)
        toast.error("Classroom not available", { description: uiMsg, duration: 7000 })
      } else {
        setSubmitError(friendly)
        onError?.(friendly)
        toast.error("Failed to save student", { description: friendly, duration: 6000 })
      }
    } finally {
      setSaving(false)
    }
  }

  const hasValue = (v: any) => v !== undefined && v !== null && String(v).trim() !== ""

  return (
    <div className="space-y-6">
      <Card className="border-2 border-[#E7ECEF] shadow-lg bg-white overflow-hidden">
        <CardContent className="pt-8 pb-8 px-8 space-y-8">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-[#274C77] flex items-center gap-2">
                <Eye className="h-6 w-6" />
                Review Student Information
              </h2>
              <p className="text-sm text-slate-500 italic">Verify all details before finalizing admission</p>
            </div>
            {submitError && (
              <Badge variant="destructive" className="animate-pulse">Action Required</Badge>
            )}
          </div>

          {submitError && (
            <div className="rounded-xl border-2 border-red-100 bg-red-50/50 p-4 text-red-700 flex items-start gap-3">
              <div className="bg-red-100 p-1 rounded-full text-red-600 mt-0.5">✕</div>
              <div>
                <div className="font-bold text-sm">Submission Error</div>
                <div className="text-xs mt-1 leading-relaxed">{submitError}</div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {/* Step 1: Personal Details */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-[#274C77] text-white font-bold text-sm shadow-md shadow-[#274C77]/20">1</div>
                <h3 className="font-bold text-lg text-[#274C77]">Personal Information</h3>
              </div>
              
              <div className="space-y-3 pl-11">
                {[
                  { label: "Full Name", value: formData.name },
                  { label: "Gender", value: formData.gender },
                  { label: "Date of Birth", value: formData.dob },
                  { label: "Birth Place", value: formData.placeOfBirth },
                  { label: "Religion", value: formData.religion },
                  { label: "Mother Tongue", value: formData.motherTongue },
                  { label: "B-Form / CNIC", value: formData.student_cnic },
                  { label: "Nationality", value: formData.nationality },
                  { label: "Blood Group", value: formData.blood_group },
                  { label: "Special Needs", value: formData.special_needs_disability },
                  { label: "Email Address", value: formData.email },
                ].map((f) => hasValue(f.value) && (
                  <div key={f.label} className="grid grid-cols-5 gap-2 text-sm">
                    <span className="col-span-2 text-slate-500">{f.label}:</span>
                    <span className="col-span-3 font-semibold text-slate-800 break-words">{f.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 2: Family & Contact */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-[#6096BA] text-white font-bold text-sm shadow-md shadow-[#6096BA]/20">2</div>
                <h3 className="font-bold text-lg text-[#274C77]">Family & Contact</h3>
              </div>
              
              <div className="space-y-6 pl-11">
                <div className="space-y-3">
                  {[
                    { label: "Student Phone", value: formData.phoneNumber },
                    { label: "Emergency", value: `${formData.emergencyContact} (${formData.emergency_relationship || 'Contact'})` },
                    { label: "Address", value: formData.address },
                    { label: "Monthly Income", value: formData.familyIncome ? `PKR ${formData.familyIncome}` : null },
                    { label: "House Owned", value: formData.houseOwned?.toUpperCase() },
                    { label: "Zakat Status", value: formData.zakatStatus?.replace('_', ' ').toUpperCase() },
                  ].map((f) => hasValue(f.value) && (
                    <div key={f.label} className="grid grid-cols-5 gap-2 text-sm">
                      <span className="col-span-2 text-slate-500">{f.label}:</span>
                      <span className="col-span-3 font-semibold text-slate-800 break-words">{f.value}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-slate-100 flex flex-col gap-3">
                   <p className="text-[10px] font-bold text-[#6096BA] uppercase tracking-wider">Parent/Guardian Info</p>
                   <div className="space-y-3">
                    {hasValue(formData.fatherName) && (
                      <div className="text-sm">
                        <p className="font-bold text-slate-800">Father: {formData.fatherName}</p>
                        <p className="text-xs text-slate-500">{formData.fatherStatus} • {formData.fatherProfession || 'Professional'}</p>
                      </div>
                    )}
                    {hasValue(formData.motherName) && (
                      <div className="text-sm">
                        <p className="font-bold text-slate-800">Mother: {formData.motherName}</p>
                        <p className="text-xs text-slate-500">{formData.motherStatus} • {formData.motherProfession || 'Professional'}</p>
                      </div>
                    )}
                    {hasValue(formData.guardianName) && (
                      <div className="text-sm bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <p className="font-bold text-[#274C77]">Guardian: {formData.guardianName}</p>
                        <p className="text-xs text-slate-500">Relation: {formData.guardianRelation}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <span>Siblings in School:</span>
                      <Badge variant="secondary" className="bg-[#E7ECEF] text-[#274C77] border-0">{formData.siblingsCount || 0}</Badge>
                    </div>
                   </div>
                </div>
              </div>
            </div>

            {/* Step 3: Academic Details */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-800 text-white font-bold text-sm shadow-md shadow-slate-800/20">3</div>
                <h3 className="font-bold text-lg text-[#274C77]">Academic Details</h3>
              </div>
              
              <div className="space-y-5 pl-11">
                <div className="space-y-3">
                  {[
                    { label: "Campus", value: campuses.find(c => c.id === parseInt(formData.campus))?.campus_name || `Campus ID: ${formData.campus}` },
                    { label: "Grade", value: formData.currentGrade },
                    { label: "Section", value: formData.section },
                    { label: "Shift", value: formData.shift?.toUpperCase() },
                    { label: "Admission Year", value: formData.admissionYear },
                    { label: "Student ID", value: formData.student_id },
                    { label: "GR Number", value: formData.grNumber },
                  ].map((f) => hasValue(f.value) && (
                    <div key={f.label} className="grid grid-cols-5 gap-2 text-sm">
                      <span className="col-span-2 text-slate-500">{f.label}:</span>
                      <span className="col-span-3 font-semibold text-slate-800 break-words">{f.value}</span>
                    </div>
                  ))}
                </div>

                <div className="p-4 rounded-2xl bg-[#E7ECEF]/50 border-2 border-dashed border-[#6096BA]/20">
                  <p className="text-[10px] font-bold text-[#274C77] uppercase mb-2">Classroom Assignment</p>
                  <p className="text-sm font-semibold text-[#274C77]">
                    {formData.classroom ? "Manual Assignment Selected" : "System Auto-Assignment"}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 italic">
                    Class teacher and classroom will be linked automatically upon submission.
                  </p>
                </div>

                {/* Extra Information */}
                {(() => {
                  const knownFields = [
                    'name', 'gender', 'dob', 'placeOfBirth', 'religion', 'motherTongue', 'student_cnic', 'nationality',
                    'blood_group', 'special_needs_disability', 'countryCode', 'phoneNumber',
                    'emergencyContact', 'emergency_relationship', 'address', 'familyIncome', 'campus', 'currentGrade', 'section', 'admissionYear',
                    'shift', 'siblingsCount', 'fatherStatus', 'siblingInAlkhair', 'fatherName',
                    'fatherContact', 'fatherCNIC', 'fatherProfession', 'motherName',
                    'motherContact', 'motherCNIC', 'motherStatus', 'motherProfession',
                    'guardianName', 'guardianCNIC', 'guardianProfession', 'guardianRelation', 'guardianContact',
                    'grNumber', 'assignedClassroom', 'classTeacher', 'student_id', 'classroom', 'email', 'houseOwned', 'zakatStatus'
                  ]
                  const extraKeys = Object.keys(formData).filter(key => !knownFields.includes(key) && hasValue(formData[key]))
                  
                  if (extraKeys.length > 0) {
                    return (
                      <div className="space-y-2 pt-4 border-t border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Additional Meta Data</p>
                        {extraKeys.map((key) => (
                          <div key={key} className="flex justify-between items-center text-xs">
                            <span className="text-slate-400 capitalize">{key.replace(/_/g, ' ')}:</span>
                            <span className="font-bold text-[#274C77]">{formData[key]}</span>
                          </div>
                        ))}
                      </div>
                    )
                  }
                  return null
                })()}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-10 border-t border-slate-100">
            <Button
              onClick={onBack}
              disabled={saving}
              variant="ghost" 
              className="flex items-center gap-2 px-6 h-12 font-bold rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all"
            >
              <ArrowLeft className="h-5 w-5" />
              Go Back & Edit
            </Button>
            
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-8 h-12 bg-[#274C77] hover:bg-[#1d3a5a] text-white font-bold rounded-xl shadow-lg shadow-[#274C77]/20 transition-all active:scale-95"
            >
              <Save className="h-5 w-5" />
              {saving ? "Processing..." : "Confirm & Save Student"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
