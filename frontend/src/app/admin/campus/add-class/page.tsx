"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Building2, Plus, Save, Eye } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"

export default function AddClassPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    grade: "", // ForeignKey to Grade
    section: "", // CharField with choices: A, B, C, D, E
    shift: "morning", // CharField with choices: morning, afternoon, both
    class_teacher: "none", // OneToOneField to Teacher (optional)
    capacity: 30 // PositiveIntegerField, default=30
  })

  const [loading, setLoading] = useState(false)

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Generate unique ID and code
      const newClass = {
        id: Date.now(), // Simple ID generation
        grade: formData.grade,
        section: formData.section,
        shift: formData.shift,
        class_teacher: formData.class_teacher === "none" ? "No Teacher Assigned" : 
          formData.class_teacher === "1" ? "Ms. Sarah Ahmed" :
          formData.class_teacher === "2" ? "Mr. Ali Hassan" :
          formData.class_teacher === "3" ? "Ms. Fatima Khan" :
          formData.class_teacher,
        capacity: formData.capacity,
        code: `${formData.grade}-${formData.section}`,
        total_students: Math.floor(Math.random() * 30) + 1 // Random student count
      }

      // Get existing classes from localStorage
      const existingClasses = JSON.parse(localStorage.getItem('campus_classes') || '[]')
      
      // Add new class
      const updatedClasses = [...existingClasses, newClass]
      
      // Save to localStorage
      localStorage.setItem('campus_classes', JSON.stringify(updatedClasses))
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      toast({
        title: "Success",
        description: "Class added successfully!",
      })
      
      // Reset form
      setFormData({
        grade: "",
        section: "",
        shift: "morning",
        class_teacher: "none",
        capacity: 30
      })

      // Redirect to list page
      router.push('/admin/campus/classes-grades-levels?tab=classes')
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add class. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Building2 className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Add Class</h1>
          <p className="text-gray-600">Create a new class for your campus</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Class Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="grade">Grade *</Label>
                <Select value={formData.grade} onValueChange={(value) => handleInputChange("grade", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Grade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Grade 1</SelectItem>
                    <SelectItem value="2">Grade 2</SelectItem>
                    <SelectItem value="3">Grade 3</SelectItem>
                    <SelectItem value="4">Grade 4</SelectItem>
                    <SelectItem value="5">Grade 5</SelectItem>
                    <SelectItem value="6">Grade 6</SelectItem>
                    <SelectItem value="7">Grade 7</SelectItem>
                    <SelectItem value="8">Grade 8</SelectItem>
                    <SelectItem value="9">Grade 9</SelectItem>
                    <SelectItem value="10">Grade 10</SelectItem>
                    <SelectItem value="11">Grade 11</SelectItem>
                    <SelectItem value="12">Grade 12</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="section">Section *</Label>
                <Select value={formData.section} onValueChange={(value) => handleInputChange("section", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Section" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">A</SelectItem>
                    <SelectItem value="B">B</SelectItem>
                    <SelectItem value="C">C</SelectItem>
                    <SelectItem value="D">D</SelectItem>
                    <SelectItem value="E">E</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="shift">Shift *</Label>
                <Select value={formData.shift} onValueChange={(value) => handleInputChange("shift", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Shift" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning</SelectItem>
                    <SelectItem value="afternoon">Afternoon</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="class_teacher">Class Teacher</Label>
                <Select value={formData.class_teacher} onValueChange={(value) => handleInputChange("class_teacher", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Class Teacher (Optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Teacher Assigned</SelectItem>
                    <SelectItem value="1">Teacher 1</SelectItem>
                    <SelectItem value="2">Teacher 2</SelectItem>
                    <SelectItem value="3">Teacher 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity *</Label>
                <Input
                  id="capacity"
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => handleInputChange("capacity", e.target.value)}
                  placeholder="e.g., 30"
                  min="1"
                  required
                />
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={loading} className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                {loading ? "Adding..." : "Add Class"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push("/admin/campus/classes-grades-levels?tab=classes")} className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Preview Classes
              </Button>
              <Button type="button" variant="outline" onClick={() => setFormData({
                grade: "",
                section: "",
                shift: "morning",
                class_teacher: "none",
                capacity: 30
              })}>
                Reset
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
