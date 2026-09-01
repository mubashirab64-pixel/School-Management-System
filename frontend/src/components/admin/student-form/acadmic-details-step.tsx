"use client"

import { useState, useEffect } from "react"
import type { Control, FieldErrors, UseFormRegister, UseFormSetValue, UseFormWatch } from "react-hook-form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useController } from "react-hook-form"
import { FormField } from "@/components/form/FormField"
import { getAllCampuses, apiGet, API_ENDPOINTS } from "@/lib/api"
import { Building2 } from "lucide-react"
import { getCurrentUser, getCurrentUserRole } from "@/lib/permissions"
import type { StudentCreateInput } from "@/lib/validation/schemas/student.schema"

interface AcademicDetailsStepProps {
  register: UseFormRegister<StudentCreateInput>
  control: Control<StudentCreateInput>
  errors: FieldErrors<StudentCreateInput>
  watch: UseFormWatch<StudentCreateInput>
  setValue: UseFormSetValue<StudentCreateInput>
  formOptions?: any
}

export function AcademicDetailsStep({ register, control, errors, watch, setValue, formOptions }: AcademicDetailsStepProps) {
  const [campuses, setCampuses] = useState<any[]>([])
  const [grades, setGrades] = useState<any[]>([])
  const [classrooms, setClassrooms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [classroomLoading, setClassroomLoading] = useState(false)

  const campus = watch("campus")
  const shift = watch("shift")
  const currentGrade = watch("currentGrade")
  const section = watch("section")

  const { field: classroomField } = useController({ control, name: "classroom" })

  useEffect(() => {
    loadCampuses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reload grades when shift changes
  useEffect(() => {
    if (shift && campus) {
      loadGrades(campus, shift)
      setValue("currentGrade", "")
      setValue("classroom", "")
      setClassrooms([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shift])

  // Load classrooms when campus + grade + section + shift are all set
  useEffect(() => {
    if (campus && currentGrade && section && shift) {
      loadClassrooms(campus, currentGrade, section, shift)
    } else {
      setClassrooms([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campus, currentGrade, section, shift])

  const loadCampuses = async () => {
    try {
      setLoading(true)
      const user = getCurrentUser()
      const userRole = getCurrentUserRole()

      const allCampuses = await getAllCampuses()

      if (userRole === 'principal' && user?.campus_id) {
        const principalCampus = allCampuses.filter((c: any) => String(c.id) === String(user.campus_id))
        setCampuses(principalCampus.length ? principalCampus : allCampuses)

        const campusId = String(user.campus_id)
        setValue("campus", campusId)

        const campusObj = principalCampus[0]
        const shiftAvailable = campusObj?.shift_available || 'both'
        if (shiftAvailable !== 'both') {
          setValue("shift", shiftAvailable)
          await loadGrades(campusId, shiftAvailable)
        } else {
          await loadGrades(campusId, shift || '')
        }
      } else {
        setCampuses(allCampuses)
        if (!campus) {
          await loadGrades("")
        }
      }
    } catch (error) {
      console.error('Error loading campuses:', error)
      setCampuses([])
    } finally {
      setLoading(false)
    }
  }

  const loadGrades = async (campusId: string, shiftValue?: string) => {
    try {
      let endpoint = campusId ? `${API_ENDPOINTS.GRADES}?campus_id=${campusId}` : `${API_ENDPOINTS.GRADES}`
      if (shiftValue) {
        endpoint += campusId ? `&shift=${shiftValue}` : `?shift=${shiftValue}`
      }
      const data = await apiGet(endpoint)
      const list = Array.isArray(data) ? data : (Array.isArray((data as any)?.results) ? (data as any).results : [])
      setGrades(list)
    } catch (e) {
      console.error('Failed to load grades:', e)
      setGrades([])
    }
  }

  const loadClassrooms = async (campusId: string, gradeName: string, sectionValue: string, shiftValue: string) => {
    try {
      setClassroomLoading(true)
      const endpoint = `${API_ENDPOINTS.CLASSROOMS}?campus_id=${campusId}&shift=${shiftValue}`
      const data = await apiGet(endpoint)
      const list: any[] = Array.isArray(data) ? data : (Array.isArray((data as any)?.results) ? (data as any).results : [])
      const filtered = list.filter((cr: any) => {
        const crGrade = (cr.grade_name || cr.grade?.name || '').toLowerCase()
        const crSection = (cr.section || '').toLowerCase()
        return crGrade.includes(gradeName.toLowerCase()) && crSection === sectionValue.toLowerCase()
      })
      setClassrooms(filtered.length ? filtered : list)
    } catch (e) {
      console.error('Failed to load classrooms:', e)
      setClassrooms([])
    } finally {
      setClassroomLoading(false)
    }
  }

  const getFieldError = (message?: string) => message

  return (
    <Card className="border-2 bg-white">
      <CardHeader>
        <CardTitle>Academic Details</CardTitle>
        <p className="text-sm text-gray-600">Fields marked with * are required</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="campus">Select Campus *</Label>
            <Select
              value={campus || ""}
              onValueChange={(v) => {
                setValue("campus", v, { shouldValidate: true })
                loadGrades(v, shift)

                const campusObj = campuses.find(c => String(c.id) === String(v));
                const shiftAvailable = campusObj?.shift_available || 'both';

                if (shiftAvailable !== 'both' && shift && shift !== shiftAvailable) {
                  setValue("shift", shiftAvailable)
                }
              }}
            >
              <SelectTrigger className={`border-2 focus:border-primary ${errors.campus ? "border-red-500" : ""}`}>
                <SelectValue placeholder={loading ? "Loading campuses..." : "Select campus"} />
              </SelectTrigger>
              <SelectContent>
                {(campuses || []).map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.campus_name || c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {getFieldError(errors.campus?.message) && (
              <p className="text-sm text-red-600 mt-1">{errors.campus?.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="shift">Shift *</Label>
            <Select value={shift || ""} onValueChange={(v) => setValue("shift", v, { shouldValidate: true })}>
              <SelectTrigger className={`border-2 focus:border-primary ${errors.shift ? "border-red-500" : ""}`}>
                <SelectValue placeholder="Select shift" />
              </SelectTrigger>
              <SelectContent>
                {(() => {
                  const campusObj = campuses.find(c => String(c.id) === String(campus));
                  const shiftAvailable = campusObj?.shift_available || 'both';

                  const options = formOptions?.shift || [
                    { value: 'morning', label: 'Morning' },
                    { value: 'afternoon', label: 'Afternoon' }
                  ];

                  if (shiftAvailable === 'both') {
                    return options.map((opt: any) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ));
                  } else {
                    const filtered = options.filter((opt: any) => opt.value === shiftAvailable);
                    return filtered.map((opt: any) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ));
                  }
                })()}
              </SelectContent>
            </Select>
            {errors.shift?.message && (
              <p className="text-sm text-red-600 mt-1">{errors.shift.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="currentGrade">Current Grade/Class *</Label>
            <Select value={currentGrade || ""} onValueChange={(v) => setValue("currentGrade", v, { shouldValidate: true })}>
              <SelectTrigger className={`border-2 focus:border-primary ${errors.currentGrade ? "border-red-500" : ""}`}>
                <SelectValue placeholder="Select grade/class" />
              </SelectTrigger>
              <SelectContent>
                {grades.map((g) => (
                  <SelectItem key={g.id} value={g.name}>
                    {g.name} • {g.level_shift ? g.level_shift.charAt(0).toUpperCase() + g.level_shift.slice(1) : 'N/A'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.currentGrade?.message && (
              <p className="text-sm text-red-600 mt-1">{errors.currentGrade.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="section">Section *</Label>
            <Select value={section || ""} onValueChange={(v) => setValue("section", v, { shouldValidate: true })}>
              <SelectTrigger className={`border-2 focus:border-primary ${errors.section ? "border-red-500" : ""}`}>
                <SelectValue placeholder="Select section" />
              </SelectTrigger>
              <SelectContent>
                {formOptions?.section && (
                  formOptions.section.map((opt: any) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {errors.section?.message && (
              <p className="text-sm text-red-600 mt-1">{errors.section.message}</p>
            )}
          </div>

          <FormField
            label="Enrollment Year"
            required
            type="number"
            min="2000"
            max={new Date().getFullYear()}
            {...register("admissionYear")}
            error={errors.admissionYear}
            placeholder={`e.g., ${new Date().getFullYear()}`}
          />

          {/* Classroom dropdown — auto-loads once campus/grade/section/shift are set */}
          <div className="md:col-span-2">
            <Label htmlFor="classroom" className="flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              Classroom
              {classrooms.length > 0 && (
                <span className="ml-1 text-[10px] text-green-600 font-normal">({classrooms.length} available)</span>
              )}
            </Label>
            <Select
              value={classroomField.value || ""}
              onValueChange={(v) => classroomField.onChange(v)}
              disabled={classroomLoading || classrooms.length === 0}
            >
              <SelectTrigger className="border-2 focus:border-primary">
                <SelectValue
                  placeholder={
                    classroomLoading
                      ? "Loading classrooms..."
                      : !campus || !currentGrade || !section || !shift
                      ? "Select campus, grade, section & shift first"
                      : classrooms.length === 0
                      ? "No classroom found — create one first"
                      : "Select classroom"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {classrooms.map((cr: any) => (
                  <SelectItem key={cr.id} value={cr.id.toString()}>
                    {cr.grade_name || cr.grade?.name || 'Unknown'} - {cr.section}
                    {cr.shift ? ` (${cr.shift.charAt(0).toUpperCase() + cr.shift.slice(1)})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground mt-1">
              If you skip this, the system will auto-assign the classroom based on campus / grade / section / shift.
            </p>
          </div>

        </div>
      </CardContent>
    </Card>
  )
}
