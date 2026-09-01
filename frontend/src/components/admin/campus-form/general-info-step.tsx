"use client"

import { useCallback, useRef, useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { GradeWizard, GradeEntry } from "./grade-wizard"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { RefreshCw } from "lucide-react"

interface GeneralInfoStepProps {
  formData: any
  invalidFields: string[]
  onInputChange: (field: string, value: any) => void
  onBlurField?: (field: string) => void
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]

const CAMPUS_OPTIONS = [
  { name: "Campus 1", code: "C01" },
  { name: "Campus 2", code: "C02" },
  { name: "Campus 3", code: "C03" },
  { name: "Campus 4", code: "C04" },
  { name: "Campus 5", code: "C05" },
  { name: "Campus 6", code: "C06" },
  { name: "Campus 7", code: "C07" },
]

// Derive a campus code from any name: "Campus 8" → "C08", "Campus 12" → "C12",
// "North Campus" → "NOR" (first letters when there's no number).
function deriveCampusCode(name: string): string {
  const trimmed = (name || "").trim()
  if (!trimmed) return ""
  const num = trimmed.match(/\d+/)?.[0]
  if (num) return `C${num.padStart(2, "0")}`
  const letters = trimmed.replace(/[^a-zA-Z]/g, "")
  return letters ? letters.slice(0, 3).toUpperCase() : ""
}

function generateCampusId(formData: any): string {
  const city = (formData.city || "CMP").slice(0, 3).toUpperCase()
  const year = formData.established_year ? String(formData.established_year).slice(-2) : String(new Date().getFullYear()).slice(-2)
  const postal = (formData.postal_code || "00000").slice(-5)
  const code = formData.campus_code || "C01"
  return `${city}-${year}-${postal}-${code}`
}

export function GeneralInfoStep({ formData, invalidFields, onInputChange, onBlurField }: GeneralInfoStepProps) {
  const shiftAvailable = formData.shift_available || "morning"
  const isBothShift = shiftAvailable === "both"
  const isSingleShift = shiftAvailable === "morning" || shiftAvailable === "afternoon"

  const [campusIdMode, setCampusIdMode] = useState<"auto" | "manual">("auto")

  // Auto-generate campus_id when in auto mode
  useEffect(() => {
    if (campusIdMode === "auto") {
      const generated = generateCampusId(formData)
      onInputChange("campus_id", generated)
    }
  }, [campusIdMode, formData.city, formData.established_year, formData.postal_code, formData.campus_code])



  const f = (field: string) => invalidFields.includes(field)
  const cls = (field: string, base = "") => `${base} ${f(field) ? "border-red-500" : ""}`.trim()
  const err = (field: string, msg: string) => f(field) && <p className="text-sm text-red-600 mt-1">{msg}</p>

  const shiftLabel = shiftAvailable === "morning" ? "Morning" : shiftAvailable === "afternoon" ? "Afternoon" : "Both"

  return (
    <Card className="border-none shadow-xl bg-white/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-2xl font-bold bg-gradient-to-r from-[#274C77] to-[#6096BA] bg-clip-text text-transparent">
          Campus Information
        </CardTitle>
        <p className="text-slate-500 text-sm">Enter the fundamental details of your campus</p>
      </CardHeader>
      <CardContent className="space-y-10 pt-6">

        {/* Campus Photo */}
        <div className="space-y-3">
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Campus Photo (Optional)</Label>
          <UploadArea existing={formData.campus_photo} onFile={(dataUrl) => onInputChange("campus_photo", dataUrl || "")} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* Campus Name */}
          <div className="space-y-2">
            <Label htmlFor="campus_name" className="text-xs font-bold uppercase tracking-wider text-slate-500">Campus Name *</Label>
            <input
              id="campus_name"
              list="campus-name-options"
              value={formData.campus_name || ""}
              onChange={e => {
                const val = e.target.value
                const selected = CAMPUS_OPTIONS.find(o => o.name === val)
                onInputChange("campus_name", val)
                onInputChange("campus_code", selected ? selected.code : deriveCampusCode(val))
              }}
              placeholder="Type or pick a campus name"
              autoComplete="off"
              className={`h-11 w-full border bg-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6096BA]/20 transition-all ${f("campus_name") ? "border-red-500" : "border-slate-200"}`}
            />
            <datalist id="campus-name-options">
              {CAMPUS_OPTIONS.map(o => <option key={o.name} value={o.name} />)}
            </datalist>
            {err("campus_name", "Campus name is required")}
          </div>

          {/* Campus Code */}
          <div className="space-y-2">
            <Label htmlFor="campus_code" className="text-xs font-bold uppercase tracking-wider text-slate-500">Campus Code *</Label>
            <input
              id="campus_code"
              list="campus-code-options"
              value={formData.campus_code || ""}
              onChange={e => {
                const val = e.target.value
                const selected = CAMPUS_OPTIONS.find(o => o.code === val)
                onInputChange("campus_code", val)
                if (selected) onInputChange("campus_name", selected.name)
              }}
              placeholder="Type or pick a code (e.g. C08)"
              autoComplete="off"
              className={`h-11 w-full border bg-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6096BA]/20 transition-all ${f("campus_code") ? "border-red-500" : "border-slate-200"}`}
            />
            <datalist id="campus-code-options">
              {CAMPUS_OPTIONS.map(o => <option key={o.code} value={o.code} />)}
            </datalist>
            {err("campus_code", "Campus code is required")}
          </div>

          {/* Campus ID — auto or manual */}
          <div className="md:col-span-2 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <Label htmlFor="campus_id" className="text-xs font-bold uppercase tracking-wider text-slate-500">Campus ID *</Label>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold uppercase text-slate-400">Generation Mode:</span>
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setCampusIdMode("auto")}
                    className={`text-[10px] px-3 py-1 rounded-md font-bold transition-all ${campusIdMode === "auto" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    AUTO
                  </button>
                  <button
                    type="button"
                    onClick={() => setCampusIdMode("manual")}
                    className={`text-[10px] px-3 py-1 rounded-md font-bold transition-all ${campusIdMode === "manual" ? "bg-white text-orange-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    MANUAL
                  </button>
                </div>
                {campusIdMode === "auto" && (
                  <button type="button" onClick={() => onInputChange("campus_id", generateCampusId(formData))} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-blue-500" title="Regenerate">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            <Input
              id="campus_id"
              value={formData.campus_id || ""}
              onChange={e => { if (campusIdMode === "manual") onInputChange("campus_id", e.target.value) }}
              readOnly={campusIdMode === "auto"}
              className={`${cls("campus_id", "h-11")} ${campusIdMode === "auto" ? "bg-slate-50/50 text-slate-500 font-mono italic" : "bg-white"}`}
              placeholder="e.g. KHI-25-75080-C001"
            />
            <p className="text-[10px] text-slate-400 italic font-medium">
              {campusIdMode === "auto" ? "💡 Calculated from: City + Year + Postal + Code" : "⚠️ Manual entry mode is active"}
            </p>
            {err("campus_id", "Campus ID is required")}
          </div>

          <Separator className="md:col-span-2 opacity-50" />

          {/* Location Group */}
          <div className="space-y-2">
            <Label htmlFor="city" className="text-xs font-bold uppercase tracking-wider text-slate-500">City *</Label>
            <Input id="city" value={formData.city || ""} onChange={e => onInputChange("city", e.target.value)} onBlur={() => onBlurField?.("city")} className={cls("city", "h-11 bg-white")} placeholder="e.g. Karachi" />
            {err("city", "City is required")}
          </div>

          <div className="space-y-2">
            <Label htmlFor="postal_code" className="text-xs font-bold uppercase tracking-wider text-slate-500">Postal Code *</Label>
            <Input id="postal_code" value={formData.postal_code || ""} onChange={e => onInputChange("postal_code", e.target.value)} onBlur={() => onBlurField?.("postal_code")} className={cls("postal_code", "h-11 bg-white")} placeholder="e.g. 75080" />
            {err("postal_code", "Postal code is required")}
          </div>

          <div className="space-y-2">
            <Label htmlFor="district" className="text-xs font-bold uppercase tracking-wider text-slate-500">District *</Label>
            <Input id="district" value={formData.district || ""} onChange={e => onInputChange("district", e.target.value)} onBlur={() => onBlurField?.("district")} className={cls("district", "h-11 bg-white")} placeholder="e.g. East" />
            {err("district", "District is required")}
          </div>

          <div className="space-y-2">
            <Label htmlFor="registration_number" className="text-xs font-bold uppercase tracking-wider text-slate-500">Registration *</Label>
            <Input id="registration_number" value={formData.registration_number || ""} onChange={e => onInputChange("registration_number", e.target.value)} onBlur={() => onBlurField?.("registration_number")} className={cls("registration_number", "h-11 bg-white")} placeholder="e.g. REG-2024-001" />
            {err("registration_number", "Registration number is required")}
          </div>

          <Separator className="md:col-span-2 opacity-50" />

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status" className="text-xs font-bold uppercase tracking-wider text-slate-500">Status *</Label>
            <select id="status" value={formData.status || ""} onChange={e => onInputChange("status", e.target.value)} className={`h-11 w-full border border-slate-200 bg-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6096BA]/20 transition-all ${f("status") ? "border-red-500" : ""}`}>
              <option value="">Select Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
              <option value="under_construction">Under Construction</option>
            </select>
            {err("status", "Status is required")}
          </div>

          <Separator className="md:col-span-2 opacity-50" />

          {/* Academic Info */}
          <div className="space-y-2">
            <Label htmlFor="instruction_language" className="text-xs font-bold uppercase tracking-wider text-slate-500">Language</Label>
            <select id="instruction_language" value={formData.instruction_language || ""} onChange={e => onInputChange("instruction_language", e.target.value)} className="h-11 w-full border border-slate-200 bg-white rounded-md px-3 py-2 text-sm">
              <option value="">Select Language</option>
              <option value="Urdu">Urdu</option>
              <option value="English">English</option>
              <option value="Both">Both</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Academic Year Cycle</Label>
            <div className="grid grid-cols-2 gap-2">
              <select id="academic_year_start_month" value={formData.academic_year_start_month || ""} onChange={e => onInputChange("academic_year_start_month", e.target.value)} className="h-11 w-full border border-slate-200 bg-white rounded-md px-3 py-2 text-xs">
                <option value="">Start</option>
                {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <select id="academic_year_end_month" value={formData.academic_year_end_month || ""} onChange={e => onInputChange("academic_year_end_month", e.target.value)} className={`h-11 w-full border border-slate-200 bg-white rounded-md px-3 py-2 text-xs ${f("academic_year_end_month") ? "border-red-500" : ""}`}>
                <option value="">End</option>
                {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            {err("academic_year_end_month", "Invalid range")}
          </div>

          {/* Full Address */}
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="address_full" className="text-xs font-bold uppercase tracking-wider text-slate-500">Campus Full Address *</Label>
            <Textarea id="address_full" value={formData.address_full || ""} onChange={e => onInputChange("address_full", e.target.value)} onBlur={() => onBlurField?.("address_full")} className={`min-h-[100px] bg-white border-slate-200 p-3 leading-relaxed ${f("address_full") ? "border-red-500" : ""}`} placeholder="Complete address of the campus" />
            {err("address_full", "Address is required")}
          </div>

        </div>

        <Separator className="bg-slate-200 h-0.5" />

        {/* Shift Selection */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#274C77]">Operation Shifts</h3>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 px-3 py-1 font-bold">
              {shiftLabel} SHIFT
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="shift_available" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Available Shift *</Label>
              <select id="shift_available" value={shiftAvailable} onChange={e => onInputChange("shift_available", e.target.value)} className={`h-11 w-full border border-slate-200 bg-white rounded-md px-3 py-2 text-sm ${f("shift_available") ? "border-red-500" : ""}`}>
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
                <option value="both">Both</option>
              </select>
              {err("shift_available", "Shift selection is required")}
            </div>
          </div>
        </div>

        <Separator className="bg-slate-200 h-0.5" />

        {/* Grades Section — Wizard */}
        <div className="space-y-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#274C77]">Grades & Level Details</h3>
          
          {shiftAvailable === "both" ? (
            <div className="space-y-6">
              <div className="bg-blue-50/30 p-5 rounded-xl border border-blue-100 shadow-inner space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">🌞</span>
                  <h4 className="font-bold text-[#274C77] uppercase tracking-wider">Morning Shift Configurations</h4>
                </div>
                <GradeWizard
                  shiftType="morning"
                  shiftLabel="Morning Shift"
                  grades={(formData.grades_data || []).filter((g: any) => g.shift === "morning")}
                  onChange={(newMorningGrades: GradeEntry[]) => {
                     const eveningGrades = (formData.grades_data || []).filter((g: any) => g.shift === "evening")
                     onInputChange("grades_data", [...eveningGrades, ...newMorningGrades])
                  }}
                />
              </div>

              <div className="bg-indigo-50/50 p-5 rounded-xl border border-indigo-100 shadow-inner space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">🌙</span>
                  <h4 className="font-bold text-indigo-900 uppercase tracking-wider">Evening Shift Configurations</h4>
                </div>
                <GradeWizard
                  shiftType="evening"
                  shiftLabel="Evening Shift"
                  grades={(formData.grades_data || []).filter((g: any) => g.shift === "evening")}
                  onChange={(newEveningGrades: GradeEntry[]) => {
                     const morningGrades = (formData.grades_data || []).filter((g: any) => g.shift === "morning")
                     onInputChange("grades_data", [...morningGrades, ...newEveningGrades])
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="bg-slate-50/50 p-5 rounded-xl border border-slate-100 shadow-inner">
              <GradeWizard
                shiftType={shiftAvailable}
                shiftLabel={`${shiftAvailable === "evening" ? "Evening" : "Morning"} Shift`}
                grades={formData.grades_data || []}
                onChange={(grades: GradeEntry[]) => {
                  const tagged = grades.map(g => ({ ...g, shift: shiftAvailable }))
                  onInputChange("grades_data", tagged)
                }}
              />
            </div>
          )}
        </div>

      </CardContent>
    </Card>
  )
}

     

function UploadArea({ existing, onFile }: { existing?: string | null; onFile: (dataUrl: string | null) => void }) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const openFilePicker = useCallback(() => inputRef.current?.click(), [])
  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return onFile(null)
    const reader = new FileReader()
    reader.onload = () => onFile(String(reader.result || null))
    reader.readAsDataURL(file)
  }, [onFile])
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => onFile(String(reader.result || null))
    reader.readAsDataURL(file)
  }, [onFile])

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/gif" className="hidden" onChange={onInputChange} />
      <div
        onClick={openFilePicker}
        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        role="button" tabIndex={0}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") openFilePicker() }}
        className={`w-full rounded-md border-2 border-dashed p-6 text-center cursor-pointer ${isDragging ? "border-sky-500 bg-sky-50" : "border-gray-200 bg-white"}`}
      >
        {existing ? (
          <div className="flex items-center justify-center gap-4">
            <img src={existing} alt="preview" className="h-28 w-auto rounded-md border" />
            <div className="text-left">
              <p className="font-medium">Change campus photo</p>
              <p className="text-sm text-muted-foreground">Click or drop a file to replace</p>
            </div>
          </div>
        ) : (
          <div>
            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V8a2 2 0 012-2h6a2 2 0 012 2v8m-6-4l-3 3m6-3l3 3" />
            </svg>
            <p className="mt-2 font-medium">Upload campus photo</p>
            <p className="mt-1 text-sm text-gray-500">PNG, JPG or GIF. Click or drag & drop.</p>
          </div>
        )}
      </div>
      {existing && (
        <div className="mt-2">
          <button type="button" className="px-3 py-1 rounded bg-red-50 text-red-700 border text-sm" onClick={() => onFile(null)}>Remove</button>
        </div>
      )}
    </div>
  )
}
