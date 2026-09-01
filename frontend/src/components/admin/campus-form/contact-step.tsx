"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { Separator } from "@/components/ui/separator"
import { sanitizeEmail } from "@/lib/validation/common"

interface ContactStepProps {
  formData: any
  invalidFields: string[]
  onInputChange: (field: string, value: any) => void
  onBlurField?: (field: string) => void
}

export function ContactStep({ formData, invalidFields, onInputChange, onBlurField }: ContactStepProps) {
  const f = (field: string) => invalidFields.includes(field)
  const err = (field: string, msg: string) => f(field) && <p className="text-sm text-red-600 mt-1">{msg}</p>

  const inputClass = (field: string) =>
    `h-11 bg-white border-slate-200 transition-all focus:border-[#6096BA] focus:ring-[#6096BA]/20 ${
      f(field) ? "border-red-500" : ""
    }`

  return (
    <Card className="border-none shadow-xl bg-white/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-2xl font-bold bg-gradient-to-r from-[#274C77] to-[#6096BA] bg-clip-text text-transparent">
          Contact & Campus Head Information
        </CardTitle>
        <p className="text-slate-500 text-sm">Provide details of the key personnel and communication channels</p>
      </CardHeader>
      <CardContent className="space-y-10 pt-6">

        {/* Campus Head */}
        <div className="space-y-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#274C77]">Campus Head Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <Label htmlFor="campus_head_name" className="text-xs font-bold uppercase tracking-wider text-slate-500">Campus Head Name *</Label>
              <Input
                id="campus_head_name"
                value={formData.campus_head_name || ""}
                onChange={e => onInputChange("campus_head_name", e.target.value)}
                onBlur={() => onBlurField?.("campus_head_name")}
                className={inputClass("campus_head_name")}
                placeholder="e.g. Dr. Ali Khan"
              />
              {err("campus_head_name", "Campus head name is required")}
            </div>

            <div className="space-y-2">
              <Label htmlFor="campus_head_phone" className="text-xs font-bold uppercase tracking-wider text-slate-500">Campus Head Phone</Label>
              <Input
                id="campus_head_phone"
                value={formData.campus_head_phone || ""}
                onChange={e => onInputChange("campus_head_phone", e.target.value)}
                className={inputClass("campus_head_phone")}
                placeholder="e.g. 03001234567"
              />
              {err("campus_head_phone", "Invalid phone format")}
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="campus_head_email" className="text-xs font-bold uppercase tracking-wider text-slate-500">Campus Head Email</Label>
              <Input
                id="campus_head_email"
                type="email"
                value={formData.campus_head_email || ""}
                onChange={e => onInputChange("campus_head_email", sanitizeEmail(e.target.value))}
                onBlur={() => onBlurField?.("campus_head_email")}
                className={inputClass("campus_head_email")}
                placeholder="e.g. head@campus.com"
              />
              {err("campus_head_email", "Invalid email address")}
            </div>
          </div>
        </div>

        <Separator className="bg-slate-200 h-0.5" />

        {/* Campus Contact */}
        <div className="space-y-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#274C77]">Campus Contact Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <Label htmlFor="primary_phone" className="text-xs font-bold uppercase tracking-wider text-slate-500">Campus Primary Phone *</Label>
              <Input
                id="primary_phone"
                value={formData.primary_phone || ""}
                onChange={e => onInputChange("primary_phone", e.target.value)}
                onBlur={() => onBlurField?.("primary_phone")}
                className={inputClass("primary_phone")}
                placeholder="e.g. 021-12345678"
              />
              {err("primary_phone", "Primary phone is required")}
            </div>

            <div className="space-y-2">
              <Label htmlFor="secondary_phone" className="text-xs font-bold uppercase tracking-wider text-slate-500">Campus Secondary Phone</Label>
              <Input
                id="secondary_phone"
                value={formData.secondary_phone || ""}
                onChange={e => onInputChange("secondary_phone", e.target.value)}
                className={inputClass("secondary_phone")}
                placeholder="e.g. 021-87654321"
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="official_email" className="text-xs font-bold uppercase tracking-wider text-slate-500">Campus Official Email *</Label>
              <Input
                id="official_email"
                type="email"
                value={formData.official_email || ""}
                onChange={e => onInputChange("official_email", sanitizeEmail(e.target.value))}
                onBlur={() => onBlurField?.("official_email")}
                className={inputClass("official_email")}
                placeholder="e.g. info@campus.com"
              />
              {err("official_email", "Official email is required")}
            </div>
          </div>
        </div>

      </CardContent>
    </Card>
  )
}
