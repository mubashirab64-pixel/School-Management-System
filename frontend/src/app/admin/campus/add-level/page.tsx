"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Layers, Plus, Save, Eye } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"

export default function AddLevelPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    name: "", // CharField, unique=True
    campus: "", // ForeignKey to Campus
    shift: "morning", // CharField with choices: morning, afternoon, both
    coordinator: "none" // OneToOneField to Coordinator (optional)
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
      const newLevel = {
        id: Date.now(), // Simple ID generation
        name: formData.name,
        campus: formData.campus,
        shift: formData.shift,
        coordinator: formData.coordinator === "none" ? "No Coordinator Assigned" : formData.coordinator,
        code: `LV-${Date.now().toString().slice(-3)}`,
        total_grades: Math.floor(Math.random() * 8) + 2, // Random grade count
        total_students: Math.floor(Math.random() * 200) + 50 // Random student count
      }

      // Get existing levels from localStorage
      const existingLevels = JSON.parse(localStorage.getItem('campus_levels') || '[]')
      
      // Add new level
      const updatedLevels = [...existingLevels, newLevel]
      
      // Save to localStorage
      localStorage.setItem('campus_levels', JSON.stringify(updatedLevels))
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      toast({
        title: "Success",
        description: "Level added successfully!",
      })
      
      // Reset form
      setFormData({
        name: "",
        campus: "",
        shift: "morning",
        coordinator: "none"
      })

      // Redirect to list page
      router.push('/admin/campus/classes-grades-levels?tab=levels')
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add level. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Layers className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Add Level</h1>
          <p className="text-gray-600">Create a new educational level for your campus</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Level Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">Level Name *</Label>
                <Select value={formData.name} onValueChange={(value) => handleInputChange("name", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pre-Primary">Pre-Primary</SelectItem>
                    <SelectItem value="Primary">Primary</SelectItem>
                    <SelectItem value="Secondary">Secondary</SelectItem>
                    <SelectItem value="Higher Secondary">Higher Secondary</SelectItem>
                    <SelectItem value="Intermediate">Intermediate</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="campus">Campus *</Label>
                <Select value={formData.campus} onValueChange={(value) => handleInputChange("campus", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Campus" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Campus 1</SelectItem>
                    <SelectItem value="2">Campus 2</SelectItem>
                    <SelectItem value="3">Campus 3</SelectItem>
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
                <Label htmlFor="coordinator">Coordinator</Label>
                <Select value={formData.coordinator} onValueChange={(value) => handleInputChange("coordinator", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Coordinator (Optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Coordinator Assigned</SelectItem>
                    <SelectItem value="1">Coordinator 1</SelectItem>
                    <SelectItem value="2">Coordinator 2</SelectItem>
                    <SelectItem value="3">Coordinator 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={loading} className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                {loading ? "Adding..." : "Add Level"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push("/admin/campus/classes-grades-levels?tab=levels")} className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Preview Levels
              </Button>
              <Button type="button" variant="outline" onClick={() => setFormData({
                name: "",
                campus: "",
                shift: "morning",
                coordinator: "none"
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
