"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

interface FacilitiesStepProps {
  formData: any
  invalidFields: string[]
  onInputChange: (field: string, value: any) => void
}

function YesNoSelect({ id, value, onChange, invalid, required }: { id: string; value: any; onChange: (v: any) => void; invalid?: boolean; required?: boolean }) {
  const displayValue = value === true ? "true" : value === false ? "false" : ""
  return (
    <select
      id={id}
      value={displayValue}
      onChange={e => {
        if (e.target.value === "true") onChange(true)
        else if (e.target.value === "false") onChange(false)
        else onChange("")
      }}
      className={`w-full border rounded px-3 py-2 ${invalid ? "border-red-500" : ""}`}
    >
      <option value="">Select</option>
      <option value="true">Yes</option>
      <option value="false">No</option>
    </select>
  )
}

export function FacilitiesStep({ formData, invalidFields, onInputChange }: FacilitiesStepProps) {
  const f = (field: string) => invalidFields.includes(field)
  const err = (field: string, msg: string) => f(field) && <p className="text-sm text-red-600 mt-1">{msg}</p>

  const sportsYes = !!formData.sports_available_toggle

  // Auto-calculate total rooms
  useEffect(() => {
    const total =
      (parseInt(formData.total_classrooms) || 0) +
      (parseInt(formData.total_staff_rooms) || 0)
    onInputChange("total_rooms", total.toString())
  }, [formData.total_classrooms, formData.total_staff_rooms])

  const inputClass = (field: string) =>
    `h-11 bg-white border-slate-200 transition-all focus:border-[#6096BA] focus:ring-[#6096BA]/20 ${
      f(field) ? "border-red-500" : ""
    }`

  return (
    <Card className="border-none shadow-xl bg-white/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-2xl font-bold bg-gradient-to-r from-[#274C77] to-[#6096BA] bg-clip-text text-transparent">
          Facilities & Infrastructure
        </CardTitle>
        <p className="text-slate-500 text-sm">Specify the physical resources and amenities provided at this campus</p>
      </CardHeader>
      <CardContent className="space-y-10 pt-6">
        
        {/* Main Numeric Fields */}
        <div className="space-y-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#274C77]">Rooms & Spaces</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <Label htmlFor="total_classrooms" className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Classrooms *</Label>
              <Input id="total_classrooms" type="number" value={formData.total_classrooms || ""} onChange={e => onInputChange("total_classrooms", e.target.value)} className={inputClass("total_classrooms")} placeholder="e.g. 20" />
              {err("total_classrooms", "Total classrooms is required")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="total_staff_rooms" className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Staff Rooms *</Label>
              <Input id="total_staff_rooms" type="number" value={formData.total_staff_rooms || ""} onChange={e => onInputChange("total_staff_rooms", e.target.value)} className={inputClass("total_staff_rooms")} placeholder="e.g. 5" />
              {err("total_staff_rooms", "Total staff rooms is required")}
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <Label htmlFor="total_rooms" className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Rooms</Label>
              <p className="text-[10px] text-slate-400 font-medium">Automatically calculated from classrooms and staff rooms</p>
            </div>
            <Input id="total_rooms" type="number" value={formData.total_rooms || ""} readOnly className="bg-white font-bold text-2xl border-none shadow-sm text-center sm:text-right h-14 w-full sm:w-32 text-slate-800" />
          </div>
        </div>

        <Separator className="bg-slate-200 h-0.5" />

        {/* All yes/no toggles grouped together */}
        <div className="space-y-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#274C77]">Campus Amenities & Labs</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-8">
            
            <div className="space-y-2">
              <Label htmlFor="has_biology_lab" className="text-xs font-bold uppercase tracking-wider text-slate-500">Biology Lab</Label>
              <YesNoSelect id="has_biology_lab" value={formData.has_biology_lab || ""} onChange={v => onInputChange("has_biology_lab", v)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="has_chemistry_lab" className="text-xs font-bold uppercase tracking-wider text-slate-500">Chemistry Lab</Label>
              <YesNoSelect id="has_chemistry_lab" value={formData.has_chemistry_lab || ""} onChange={v => onInputChange("has_chemistry_lab", v)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="has_computer_lab" className="text-xs font-bold uppercase tracking-wider text-slate-500">Computer Lab</Label>
              <YesNoSelect id="has_computer_lab" value={formData.has_computer_lab || ""} onChange={v => onInputChange("has_computer_lab", v)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="has_physics_lab" className="text-xs font-bold uppercase tracking-wider text-slate-500">Physics Lab</Label>
              <YesNoSelect id="has_physics_lab" value={formData.has_physics_lab || ""} onChange={v => onInputChange("has_physics_lab", v)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="has_science_lab" className="text-xs font-bold uppercase tracking-wider text-slate-500">Science Lab</Label>
              <YesNoSelect id="has_science_lab" value={formData.has_science_lab || ""} onChange={v => onInputChange("has_science_lab", v)} />
            </div>

            <div className="col-span-full py-2">
              <div className="w-full h-px bg-slate-100"></div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="power_backup" className="text-xs font-bold uppercase tracking-wider text-slate-500">Power Backup *</Label>
              <YesNoSelect id="power_backup" value={formData.power_backup || ""} onChange={v => onInputChange("power_backup", v)} invalid={f("power_backup")} />
              {err("power_backup", "This field is required")}
            </div>

            <div className="space-y-2">
              <Label htmlFor="internet_available" className="text-xs font-bold uppercase tracking-wider text-slate-500">Internet *</Label>
              <YesNoSelect id="internet_available" value={formData.internet_available || ""} onChange={v => onInputChange("internet_available", v)} invalid={f("internet_available")} />
              {err("internet_available", "This field is required")}
            </div>

            <div className="space-y-2">
              <Label htmlFor="canteen_facility" className="text-xs font-bold uppercase tracking-wider text-slate-500">Canteen *</Label>
              <YesNoSelect id="canteen_facility" value={formData.canteen_facility || ""} onChange={v => onInputChange("canteen_facility", v)} invalid={f("canteen_facility")} />
              {err("canteen_facility", "This field is required")}
            </div>

            <div className="space-y-2">
              <Label htmlFor="library_available" className="text-xs font-bold uppercase tracking-wider text-slate-500">Library *</Label>
              <YesNoSelect id="library_available" value={formData.library_available || ""} onChange={v => onInputChange("library_available", v)} invalid={f("library_available")} />
              {err("library_available", "This field is required")}
            </div>

            <div className="col-span-full py-2">
              <div className="w-full h-px bg-slate-100"></div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="teacher_transport" className="text-xs font-bold uppercase tracking-wider text-slate-500">Teacher Transport</Label>
              <YesNoSelect id="teacher_transport" value={formData.teacher_transport || ""} onChange={v => onInputChange("teacher_transport", v)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="student_transport" className="text-xs font-bold uppercase tracking-wider text-slate-500">Student Transport *</Label>
              <YesNoSelect id="student_transport" value={formData.student_transport || ""} onChange={v => onInputChange("student_transport", v)} invalid={f("student_transport")} />
              {err("student_transport", "This field is required")}
            </div>

            <div className="space-y-2">
              <Label htmlFor="meal_program" className="text-xs font-bold uppercase tracking-wider text-slate-500">Meal Program</Label>
              <YesNoSelect id="meal_program" value={formData.meal_program || ""} onChange={v => onInputChange("meal_program", v)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sports_available_toggle" className="text-xs font-bold uppercase tracking-wider text-slate-500">Sports Available</Label>
              <YesNoSelect id="sports_available_toggle" value={formData.sports_available_toggle || ""} onChange={v => {
                onInputChange("sports_available_toggle", v)
                if (!v) onInputChange("sports_available", "")
              }} />
            </div>

          </div>
        </div>

        {sportsYes && (
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 animate-in fade-in slide-in-from-top-4 space-y-2">
            <Label htmlFor="sports_available" className="text-xs font-bold uppercase tracking-wider text-slate-500">List Sports (Comma separated)</Label>
            <Input id="sports_available" value={formData.sports_available || ""} onChange={e => onInputChange("sports_available", e.target.value)} className="h-11 bg-white border-slate-200" placeholder="e.g. Cricket, Football, Basketball" />
          </div>
        )}

      </CardContent>
    </Card>
  )
}
