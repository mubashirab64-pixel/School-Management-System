"use client"

// components/form/FormSelect.tsx
//
// Shared dropdown used by every migrated form. Radix's Select is a
// controlled component (no native `name`/`onChange` react-hook-form can
// register() onto directly), so this wraps it with useController instead —
// pass the same `control` you get back from useAppForm().

import * as React from "react"
import { useController, type Control, type FieldError, type FieldValues, type Path } from "react-hook-form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

export interface FormSelectOption {
  value: string
  label: string
}

interface FormSelectProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>
  name: Path<TFieldValues>
  label?: string
  required?: boolean
  placeholder?: string
  options: FormSelectOption[]
  error?: FieldError
  disabled?: boolean
  className?: string
}

export function FormSelect<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  required,
  placeholder = "Select an option",
  options,
  error,
  disabled,
  className,
}: FormSelectProps<TFieldValues>) {
  const {
    field: { value, onChange, onBlur },
  } = useController({ control, name })

  return (
    <div className="space-y-1.5">
      {label && (
        <Label htmlFor={name} className="font-semibold text-gray-700">
          {label} {required && "*"}
        </Label>
      )}
      <Select value={value ?? ""} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger
          id={name}
          onBlur={onBlur}
          aria-invalid={!!error}
          className={cn("border-2 rounded-xl h-11 focus:border-blue-400 w-full", error && "border-red-500", className)}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="py-2.5">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error?.message && (
        <p className="text-xs text-red-500 flex items-center gap-1 font-medium">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error.message}
        </p>
      )}
    </div>
  )
}
