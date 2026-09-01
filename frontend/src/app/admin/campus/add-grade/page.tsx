"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { GraduationCap, Plus, Save, Eye } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"

export default function AddGradePage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    name: "", // CharField, unique=True
    level: "" // ForeignKey to Level
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
      const newGrade = {
        id: Date.now(), // Simple ID generation
        name: formData.name,
        level: formData.level,
        code: `GR-${Date.now().toString().slice(-3)}`,
        total_classes: Math.floor(Math.random() * 5) + 1, // Random class count
        total_students: Math.floor(Math.random() * 50) + 10 // Random student count
      }

      // Get existing grades from localStorage
      const existingGrades = JSON.parse(localStorage.getItem('campus_grades') || '[]')
      
      // Add new grade
      const updatedGrades = [...existingGrades, newGrade]
      
      // Save to localStorage
      localStorage.setItem('campus_grades', JSON.stringify(updatedGrades))
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      toast({
        title: "Success",
        description: "Grade added successfully!",
      })
      
      // Reset form
      setFormData({
        name: "",
        level: ""
      })

      // Redirect to list page
      router.push('/admin/campus/classes-grades-levels?tab=grades')
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add grade. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <GraduationCap className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Add Grade</h1>
          <p className="text-gray-600">Create a new grade for your campus</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Grade Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">Grade Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="e.g., Grade 1, Grade 2, KG-1"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="level">Level *</Label>
                <Select value={formData.level} onValueChange={(value) => handleInputChange("level", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Pre-Primary</SelectItem>
                    <SelectItem value="2">Primary</SelectItem>
                    <SelectItem value="3">Secondary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={loading} className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                {loading ? "Adding..." : "Add Grade"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push("/admin/campus/classes-grades-levels?tab=grades")} className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Preview Grades
              </Button>
              <Button type="button" variant="outline" onClick={() => setFormData({
                name: "",
                level: ""
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
