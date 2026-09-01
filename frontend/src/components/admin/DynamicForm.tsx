"use client"

import React from "react"
import { useForm } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { apiGet, getAllCampuses } from "@/lib/api"
import { useEffect, useState } from "react"

export interface FormField {
    name: string
    label: string
    type: "text" | "number" | "date" | "select" | "textarea" | "campus_select" | "grade_select" | "shift_select"
    required?: boolean
    placeholder?: string
    options?: { label: string; value: string }[]
    defaultValue?: any
}

function SelectField({ field, setValue, defaultValue, error }: { field: any, setValue: any, defaultValue: any, error: boolean }) {
    const [options, setOptions] = useState<{ label: string, value: string }[]>(field.options || [])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (field.type === "campus_select") {
            setLoading(true)
            getAllCampuses().then((data: any) => {
                const list = Array.isArray(data) ? data : data.results || []
                setOptions(list.map((c: any) => ({ label: c.name || c.campus_name, value: c.id.toString() })))
            }).finally(() => setLoading(false))
        } else if (field.type === "grade_select") {
            setLoading(true)
            apiGet("/api/classes/grades/").then((data: any) => {
                const list = Array.isArray(data) ? data : data.results || []
                setOptions(list.map((g: any) => ({ label: g.name, value: g.id.toString() })))
            }).finally(() => setLoading(false))
        } else if (field.type === "shift_select") {
            setOptions([
                { label: "Morning", value: "morning" },
                { label: "Afternoon", value: "afternoon" }
            ])
        }
    }, [field.type])

    return (
        <Select
            onValueChange={(v) => setValue(field.name, v)}
            defaultValue={defaultValue?.toString()}
        >
            <SelectTrigger className={error ? "border-red-500" : ""}>
                <SelectValue placeholder={loading ? "Loading..." : (field.placeholder || `Select ${field.label}`)} />
            </SelectTrigger>
            <SelectContent>
                {options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}

export interface FormSchema {
    title?: string
    description?: string
    fields: FormField[]
}

interface DynamicFormProps {
    schema: FormSchema
    onSubmit: (data: any) => void
    isLoading?: boolean
    submitLabel?: string
    initialValues?: any
}

export function DynamicForm({ schema, onSubmit, isLoading, submitLabel = "Submit", initialValues }: DynamicFormProps) {
    const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
        defaultValues: initialValues
    })

    const handleSelectChange = (name: string, value: string) => {
        setValue(name, value)
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <Card>
                {schema.title && (
                    <CardHeader>
                        <CardTitle>{schema.title}</CardTitle>
                        {schema.description && <p className="text-sm text-gray-500">{schema.description}</p>}
                    </CardHeader>
                )}
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
                    {schema.fields.map((field) => (
                        <div key={field.name} className="space-y-2">
                            <Label htmlFor={field.name}>
                                {field.label} {field.required && <span className="text-red-500">*</span>}
                            </Label>

                            {field.type === "select" || field.type === "campus_select" || field.type === "grade_select" || field.type === "shift_select" ? (
                                <SelectField
                                    field={field}
                                    setValue={setValue}
                                    defaultValue={field.defaultValue || initialValues?.[field.name]}
                                    error={!!errors[field.name]}
                                />
                            ) : field.type === "textarea" ? (
                                <textarea
                                    id={field.name}
                                    className={`flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${errors[field.name] ? "border-red-500" : ""}`}
                                    placeholder={field.placeholder}
                                    {...register(field.name, { required: field.required })}
                                />
                            ) : (
                                <Input
                                    id={field.name}
                                    type={field.type}
                                    placeholder={field.placeholder}
                                    className={errors[field.name] ? "border-red-500" : ""}
                                    {...register(field.name, { required: field.required })}
                                />
                            )}

                            {errors[field.name] && (
                                <p className="text-xs text-red-500">{field.label} is required</p>
                            )}
                        </div>
                    ))}
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button type="submit" disabled={isLoading}>
                    {isLoading ? "Saving..." : submitLabel}
                </Button>
            </div>
        </form>
    )
}
