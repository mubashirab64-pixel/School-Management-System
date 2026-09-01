"use client"

// components/form/FormField.tsx
//
// Shared text input / textarea used by every migrated form. Wire it with
// {...register('fieldName')} and pass error={errors.fieldName} — the red
// border and error message are handled here so every form looks identical.

import * as React from "react"
import type { FieldError } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

type BaseProps = {
  label?: string
  required?: boolean
  error?: FieldError
  hint?: string
  containerClassName?: string
}

type InputFieldProps = BaseProps &
  React.ComponentProps<typeof Input> & { as?: "input" }

type TextareaFieldProps = BaseProps &
  React.ComponentProps<typeof Textarea> & { as: "textarea" }

export type FormFieldProps = InputFieldProps | TextareaFieldProps

export const FormField = React.forwardRef<HTMLInputElement | HTMLTextAreaElement, FormFieldProps>(
  function FormField({ label, required, error, hint, containerClassName, className, as = "input", id, name, ...rest }, ref) {
    const fieldId = id ?? name

    return (
      <div className={cn("space-y-1.5", containerClassName)}>
        {label && (
          <Label htmlFor={fieldId} className="font-semibold text-gray-700">
            {label} {required && "*"}
          </Label>
        )}
        {as === "textarea" ? (
          <Textarea
            id={fieldId}
            name={name}
            ref={ref as React.Ref<HTMLTextAreaElement>}
            aria-invalid={!!error}
            className={cn("border-2 rounded-2xl min-h-[100px] focus:border-blue-400", error && "border-red-500", className)}
            {...(rest as React.ComponentProps<typeof Textarea>)}
          />
        ) : (
          <Input
            id={fieldId}
            name={name}
            ref={ref as React.Ref<HTMLInputElement>}
            aria-invalid={!!error}
            className={cn("border-2 rounded-xl h-11 focus:border-blue-400", error && "border-red-500", className)}
            {...(rest as React.ComponentProps<typeof Input>)}
          />
        )}
        {error?.message && (
          <p className="text-xs text-red-500 flex items-center gap-1 font-medium">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error.message}
          </p>
        )}
        {!error?.message && hint && <p className="text-[10px] text-gray-400">{hint}</p>}
      </div>
    )
  }
)
