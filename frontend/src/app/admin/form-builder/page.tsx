"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Save, ArrowLeft, Settings2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { apiPost, apiGet, API_ENDPOINTS } from "@/lib/api"
import { usePermissions } from "@/lib/permissions"
import { AccessDenied } from "@/components/AccessDenied"
import Link from "next/link"

export default function FormBuilderPage() {
    const { canManageForms } = usePermissions();

    if (!canManageForms) {
        return <AccessDenied title="Form Designer Restricted" message="You do not have permission to design or modify dynamic forms." />
    }
    const [templates, setTemplates] = useState<any[]>([])
    const [fields, setFields] = useState<any[]>([
        { name: "name", label: "Student Name", type: "text", required: true, placeholder: "Enter full name" }
    ])
    const [formName, setFormName] = useState("")
    const [targetModel, setTargetModel] = useState("students.Student")
    const [isSaving, setIsSaving] = useState(false)

    const addField = () => {
        setFields([...fields, { name: "", label: "", type: "text", required: false, placeholder: "" }])
    }

    const removeField = (index: number) => {
        setFields(fields.filter((_, i) => i !== index))
    }

    const updateField = (index: number, key: string, value: any) => {
        const newFields = [...fields]
        newFields[index][key] = value
        setFields(newFields)
    }

    useEffect(() => {
        fetchTemplates()
    }, [])

    const fetchTemplates = async () => {
        try {
            const data: any = await apiGet(API_ENDPOINTS.FORM_TEMPLATES)
            setTemplates(Array.isArray(data) ? data : data.results || [])
        } catch (error) {
            console.error("Fetch templates error:", error)
        }
    }

    const saveTemplate = async () => {
        if (!formName) {
            toast.error("Please enter a form name")
            return
        }

        setIsSaving(true)
        try {
            const payload = {
                name: formName.toLowerCase().replace(/\s+/g, '_'),
                target_model: targetModel,
                schema: { fields },
                is_active: true
            }

            await apiPost(API_ENDPOINTS.FORM_TEMPLATES, payload)
            toast.success("Form Template saved successfully!")
            fetchTemplates() // Refresh list
        } catch (error) {
            console.error("Save error:", error)
            toast.error("Failed to save form template")
        } finally {
            setIsSaving(false)
        }
    }

    const loadTemplate = (template: any) => {
        setFormName(template.name)
        setTargetModel(template.target_model)
        setFields(template.schema.fields || [])
        toast.info(`Loaded template: ${template.name}`)
    }

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/admin">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Form Designer</h1>
                    <p className="text-muted-foreground text-sm">Design dynamic forms that principals can customize.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-lg">Form Fields</h3>
                        <Button onClick={addField} size="sm" variant="outline" className="flex items-center gap-2">
                            <Plus className="h-4 w-4" /> Add Field
                        </Button>
                    </div>

                    {fields.length === 0 && (
                        <div className="border-2 border-dashed rounded-lg p-12 text-center text-muted-foreground">
                            No fields added yet. Click "Add Field" to start.
                        </div>
                    )}

                    {fields.map((field, index) => (
                        <Card key={index} className="shadow-sm border-l-4 border-l-primary">
                            <CardContent className="pt-6 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs uppercase font-bold text-muted-foreground">Field Label</Label>
                                        <Input
                                            placeholder="e.g. Student Name"
                                            value={field.label}
                                            onChange={(e) => updateField(index, "label", e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs uppercase font-bold text-muted-foreground">Field ID (Database Key)</Label>
                                        <Input
                                            placeholder="e.g. student_name"
                                            value={field.name}
                                            onChange={(e) => updateField(index, "name", e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                    <div className="space-y-2">
                                        <Label className="text-xs uppercase font-bold text-muted-foreground">Input Type</Label>
                                        <Select
                                            value={field.type}
                                            onValueChange={(v) => updateField(index, "type", v)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="text">Text Input</SelectItem>
                                                <SelectItem value="number">Number</SelectItem>
                                                <SelectItem value="date">Date Picker</SelectItem>
                                                <SelectItem value="select">Dropdown Select</SelectItem>
                                                <SelectItem value="textarea">Multi-line Text</SelectItem>
                                                <SelectItem value="campus_select">Campus Selection (Auto)</SelectItem>
                                                <SelectItem value="grade_select">Grade Selection (Auto)</SelectItem>
                                                <SelectItem value="shift_select">Shift Selection (Auto)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-xs uppercase font-bold text-muted-foreground">Placeholder</Label>
                                        <Input
                                            placeholder="Optional hint text"
                                            value={field.placeholder}
                                            onChange={(e) => updateField(index, "placeholder", e.target.value)}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-2 h-10">
                                            <input
                                                type="checkbox"
                                                id={`req-${index}`}
                                                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                checked={field.required}
                                                onChange={(e) => updateField(index, "required", e.target.checked)}
                                            />
                                            <Label htmlFor={`req-${index}`} className="text-sm font-medium">Required</Label>
                                        </div>
                                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => removeField(index)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                {field.type === "select" && (
                                    <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                                        <div className="flex justify-between items-center">
                                            <Label className="text-xs font-bold">Dropdown Options</Label>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-[10px]"
                                                onClick={() => {
                                                    const opts = field.options || []
                                                    updateField(index, "options", [...opts, { label: "", value: "" }])
                                                }}
                                            >
                                                <Plus className="h-3 w-3 mr-1" /> Add Option
                                            </Button>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {(field.options || []).map((opt: any, optIndex: number) => (
                                                <div key={optIndex} className="flex gap-2">
                                                    <Input
                                                        placeholder="Label"
                                                        className="h-8 text-xs"
                                                        value={opt.label}
                                                        onChange={(e) => {
                                                            const newOpts = [...field.options]
                                                            newOpts[optIndex].label = e.target.value
                                                            newOpts[optIndex].value = e.target.value.toLowerCase().replace(/\s+/g, '_')
                                                            updateField(index, "options", newOpts)
                                                        }}
                                                    />
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-red-400"
                                                        onClick={() => {
                                                            updateField(index, "options", field.options.filter((_: any, i: number) => i !== optIndex))
                                                        }}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ))}
                                            {(!field.options || field.options.length === 0) && (
                                                <p className="text-[10px] text-muted-foreground italic col-span-2">No options added. Dropdown will be empty.</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="space-y-6">
                    <Card className="sticky top-6">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Settings2 className="h-5 w-5" /> Settings
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Form Title</Label>
                                <Input
                                    placeholder="e.g. Admission Form"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Target Entity</Label>
                                <Select value={targetModel} onValueChange={setTargetModel}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="students.Student">Student</SelectItem>
                                        <SelectItem value="teachers.Teacher">Teacher</SelectItem>
                                        <SelectItem value="campus.Campus">Campus</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="pt-4">
                                <Button
                                    onClick={saveTemplate}
                                    className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90"
                                    disabled={isSaving}
                                >
                                    {isSaving ? "Saving..." : <><Save className="h-4 w-4" /> Save Configuration</>}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Existing Templates</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {templates.length === 0 && <p className="text-xs text-muted-foreground">No templates found.</p>}
                            {templates.map((t) => (
                                <div key={t.id} className="flex items-center justify-between p-2 border rounded hover:bg-muted cursor-pointer" onClick={() => loadTemplate(t)}>
                                    <div className="overflow-hidden">
                                        <p className="text-sm font-medium truncate">{t.name}</p>
                                        <p className="text-[10px] text-muted-foreground">{t.target_model}</p>
                                    </div>
                                    <Badge variant={t.is_active ? "default" : "secondary"}>{t.is_active ? "Active" : "Draft"}</Badge>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Preview Mode</CardTitle>
                            <CardDescription>How the field looks in the final form.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="bg-muted p-4 rounded-md space-y-4">
                                {fields.slice(0, 3).map((f, i) => (
                                    <div key={i} className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground">{f.label || "Untitled"}</Label>
                                        <div className="h-8 w-full bg-white border rounded text-[10px] px-2 flex items-center text-gray-400 italic">
                                            {f.placeholder || "Preview..."}
                                        </div>
                                    </div>
                                ))}
                                {fields.length > 3 && <p className="text-[10px] text-center text-muted-foreground">+{fields.length - 3} more fields</p>}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
