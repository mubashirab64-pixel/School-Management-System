"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Building2, Plus, Search, Edit, Trash2, Eye, Users, GraduationCap, Layers, User } from "lucide-react"
import { usePermissions } from "@/lib/permissions"
import { useRouter } from "next/navigation"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { toast } from "@/components/ui/use-toast"

interface ClassData {
  id: number
  grade: string
  section: string
  class_teacher: string
  capacity: number
  current_students: number
  code: string
}

interface GradeData {
  id: number
  name: string
  level: string
  code: string
  total_classes: number
  total_students: number
}

interface LevelData {
  id: number
  name: string
  campus: string
  coordinator: string
  code: string
  total_grades: number
  total_students: number
}

export default function CombinedListPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("classes")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const permissions = usePermissions()

  // Data states
  const [classes, setClasses] = useState<ClassData[]>([])
  const [grades, setGrades] = useState<GradeData[]>([])
  const [levels, setLevels] = useState<LevelData[]>([])

  // Edit states
  const [editClassOpen, setEditClassOpen] = useState(false)
  const [editGradeOpen, setEditGradeOpen] = useState(false)
  const [editLevelOpen, setEditLevelOpen] = useState(false)
  const [editingClass, setEditingClass] = useState<ClassData | null>(null)
  const [editingGrade, setEditingGrade] = useState<GradeData | null>(null)
  const [editingLevel, setEditingLevel] = useState<LevelData | null>(null)

  // Delete states
  const [deleteClassOpen, setDeleteClassOpen] = useState(false)
  const [deleteGradeOpen, setDeleteGradeOpen] = useState(false)
  const [deleteLevelOpen, setDeleteLevelOpen] = useState(false)
  const [deletingClass, setDeletingClass] = useState<ClassData | null>(null)
  const [deletingGrade, setDeletingGrade] = useState<GradeData | null>(null)
  const [deletingLevel, setDeletingLevel] = useState<LevelData | null>(null)

  useEffect(() => {
    // Handle URL parameters for tab selection
    const urlParams = new URLSearchParams(window.location.search)
    const tabParam = urlParams.get('tab')
    if (tabParam && ['classes', 'grades', 'levels'].includes(tabParam)) {
      setActiveTab(tabParam)
    }

    // Load data from localStorage or use mock data as fallback
    const loadData = () => {
      // Load classes from localStorage
      const savedClasses = localStorage.getItem('campus_classes')
      if (savedClasses) {
        setClasses(JSON.parse(savedClasses))
      } else {
        // Default mock data
        const mockClasses: ClassData[] = [
          {
            id: 1,
            grade: "1",
            section: "A",
            class_teacher: "Ms. Sarah Ahmed",
            capacity: 30,
            current_students: 25,
            code: "C01-PR-G01-A"
          },
          {
            id: 2,
            grade: "1",
            section: "B",
            class_teacher: "Mr. Ali Khan",
            capacity: 30,
            current_students: 28,
            code: "C01-PR-G01-B"
          },
          {
            id: 3,
            grade: "2",
            section: "A",
            class_teacher: "Ms. Fatima Ali",
            capacity: 30,
            current_students: 22,
            code: "C01-PR-G02-A"
          },
          {
            id: 4,
            grade: "5",
            section: "A",
            class_teacher: "Mr. Hassan Raza",
            capacity: 35,
            current_students: 32,
            code: "C01-PR-G05-A"
          },
          {
            id: 5,
            grade: "6",
            section: "A",
            class_teacher: "Ms. Ayesha Khan",
            capacity: 35,
            current_students: 30,
            code: "C01-SEC-G06-A"
          }
        ]
        setClasses(mockClasses)
      }

      // Load grades from localStorage
      const savedGrades = localStorage.getItem('campus_grades')
      if (savedGrades) {
        setGrades(JSON.parse(savedGrades))
      } else {
        // Default mock data
        const mockGrades: GradeData[] = [
          {
            id: 1,
            name: "Grade 1",
            level: "Primary",
            code: "C01-PR-G01",
            total_classes: 2,
            total_students: 53
          },
          {
            id: 2,
            name: "Grade 2",
            level: "Primary",
            code: "C01-PR-G02",
            total_classes: 1,
            total_students: 22
          },
          {
            id: 3,
            name: "Grade 5",
            level: "Primary",
            code: "C01-PR-G05",
            total_classes: 1,
            total_students: 32
          },
          {
            id: 4,
            name: "Grade 6",
            level: "Secondary",
            code: "C01-SEC-G06",
            total_classes: 1,
            total_students: 30
          },
          {
            id: 5,
            name: "Grade 10",
            level: "Secondary",
            code: "C01-SEC-G10",
            total_classes: 2,
            total_students: 45
          }
        ]
        setGrades(mockGrades)
      }

      // Load levels from localStorage
      const savedLevels = localStorage.getItem('campus_levels')
      if (savedLevels) {
        setLevels(JSON.parse(savedLevels))
      } else {
        // Default mock data
        const mockLevels: LevelData[] = [
          {
            id: 1,
            name: "Pre-Primary",
            campus: "Main Campus",
            coordinator: "Ms. Ayesha Khan",
            code: "C01-PRE",
            total_grades: 3,
            total_students: 85
          },
          {
            id: 2,
            name: "Primary",
            campus: "Main Campus",
            coordinator: "Mr. Ali Hassan",
            code: "C01-PRI",
            total_grades: 5,
            total_students: 150
          },
          {
            id: 3,
            name: "Secondary",
            campus: "Main Campus",
            coordinator: "Ms. Fatima Ali",
            code: "C01-SEC",
            total_grades: 7,
            total_students: 200
          },
          {
            id: 4,
            name: "Higher Secondary",
            campus: "Main Campus",
            coordinator: "Mr. Hassan Raza",
            code: "C01-HIG",
            total_grades: 2,
            total_students: 75
          }
        ]
        setLevels(mockLevels)
      }

      setLoading(false)
    }

    loadData()
  }, [])

  // Filter functions
  const filteredClasses = classes.filter(cls =>
    cls.grade.toLowerCase().includes(search.toLowerCase()) ||
    cls.section.toLowerCase().includes(search.toLowerCase()) ||
    cls.class_teacher.toLowerCase().includes(search.toLowerCase()) ||
    cls.code.toLowerCase().includes(search.toLowerCase())
  )

  const filteredGrades = grades.filter(grade =>
    grade.name.toLowerCase().includes(search.toLowerCase()) ||
    grade.level.toLowerCase().includes(search.toLowerCase()) ||
    grade.code.toLowerCase().includes(search.toLowerCase())
  )

  const filteredLevels = levels.filter(level =>
    level.name.toLowerCase().includes(search.toLowerCase()) ||
    level.campus.toLowerCase().includes(search.toLowerCase()) ||
    level.coordinator.toLowerCase().includes(search.toLowerCase()) ||
    level.code.toLowerCase().includes(search.toLowerCase())
  )

  // Helper functions
  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'pre-primary':
        return 'bg-pink-100 text-pink-800'
      case 'primary':
        return 'bg-blue-100 text-blue-800'
      case 'secondary':
        return 'bg-green-100 text-green-800'
      case 'higher secondary':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getAddButtonPath = () => {
    switch (activeTab) {
      case 'classes':
        return '/admin/campus/add-class'
      case 'grades':
        return '/admin/campus/add-grade'
      case 'levels':
        return '/admin/campus/add-level'
      default:
        return '/admin/campus/add-class'
    }
  }

  const getAddButtonText = () => {
    switch (activeTab) {
      case 'classes':
        return 'Add Class'
      case 'grades':
        return 'Add Grade'
      case 'levels':
        return 'Add Level'
      default:
        return 'Add Class'
    }
  }

  // Edit handlers
  const handleEditClass = (cls: ClassData) => {
    setEditingClass(cls)
    setEditClassOpen(true)
  }

  const handleEditGrade = (grade: GradeData) => {
    setEditingGrade(grade)
    setEditGradeOpen(true)
  }

  const handleEditLevel = (level: LevelData) => {
    setEditingLevel(level)
    setEditLevelOpen(true)
  }

  const handleSaveClass = () => {
    if (editingClass) {
      // Update class in state
      setClasses(prev => prev.map(cls =>
        cls.id === editingClass.id ? editingClass : cls
      ))
      setEditClassOpen(false)
      setEditingClass(null)
      toast({
        title: "Success",
        description: "Class updated successfully!",
      })
    }
  }

  const handleSaveGrade = () => {
    if (editingGrade) {
      // Update grade in state
      setGrades(prev => prev.map(grade =>
        grade.id === editingGrade.id ? editingGrade : grade
      ))
      setEditGradeOpen(false)
      setEditingGrade(null)
      toast({
        title: "Success",
        description: "Grade updated successfully!",
      })
    }
  }

  const handleSaveLevel = () => {
    if (editingLevel) {
      // Update level in state
      setLevels(prev => prev.map(level =>
        level.id === editingLevel.id ? editingLevel : level
      ))
      setEditLevelOpen(false)
      setEditingLevel(null)
      toast({
        title: "Success",
        description: "Level updated successfully!",
      })
    }
  }

  // Delete handlers
  const handleDeleteClass = (cls: ClassData) => {
    setDeletingClass(cls)
    setDeleteClassOpen(true)
  }

  const handleDeleteGrade = (grade: GradeData) => {
    setDeletingGrade(grade)
    setDeleteGradeOpen(true)
  }

  const handleDeleteLevel = (level: LevelData) => {
    setDeletingLevel(level)
    setDeleteLevelOpen(true)
  }

  const confirmDeleteClass = () => {
    if (deletingClass) {
      // Remove class from state
      setClasses(prev => prev.filter(cls => cls.id !== deletingClass.id))
      setDeleteClassOpen(false)
      setDeletingClass(null)
      toast({
        title: "Success",
        description: "Class deleted successfully!",
      })
    }
  }

  const confirmDeleteGrade = () => {
    if (deletingGrade) {
      // Remove grade from state
      setGrades(prev => prev.filter(grade => grade.id !== deletingGrade.id))
      setDeleteGradeOpen(false)
      setDeletingGrade(null)
      toast({
        title: "Success",
        description: "Grade deleted successfully!",
      })
    }
  }

  const confirmDeleteLevel = () => {
    if (deletingLevel) {
      // Remove level from state
      setLevels(prev => prev.filter(level => level.id !== deletingLevel.id))
      setDeleteLevelOpen(false)
      setDeletingLevel(null)
      toast({
        title: "Success",
        description: "Level deleted successfully!",
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner message="Loading data..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Campus Management</h1>
            <p className="text-gray-600">Manage classes, grades, and levels in your campus</p>
          </div>
        </div>
        {permissions.canAddCampus && (
          <Button onClick={() => router.push(getAddButtonPath())} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {getAddButtonText()}
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="classes" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Classes
          </TabsTrigger>
          <TabsTrigger value="grades" className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            Grades
          </TabsTrigger>
          <TabsTrigger value="levels" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Levels
          </TabsTrigger>
        </TabsList>

        <TabsContent value="classes">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Classes Overview</CardTitle>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search classes..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-blue-900 text-white">
                      <TableHead className="text-white font-semibold">Class</TableHead>
                      <TableHead className="text-white font-semibold">Section</TableHead>
                      <TableHead className="text-white font-semibold">Class Teacher</TableHead>
                      <TableHead className="text-white font-semibold">Capacity</TableHead>
                      <TableHead className="text-white font-semibold">Current Students</TableHead>
                      <TableHead className="text-white font-semibold">Code</TableHead>
                      <TableHead className="text-white font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClasses.map((cls, index) => (
                      <TableRow key={cls.id} className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                        <TableCell className="font-medium">Class {cls.grade}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{cls.section}</Badge>
                        </TableCell>
                        <TableCell>{cls.class_teacher}</TableCell>
                        <TableCell>{cls.capacity}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-gray-500" />
                            <span>{cls.current_students}</span>
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${(cls.current_students / cls.capacity) * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded">{cls.code}</code>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="border-blue-600 text-blue-600 hover:bg-blue-50">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" className="border-blue-600 text-blue-600 hover:bg-blue-50" onClick={() => handleEditClass(cls)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" className="border-red-600 text-red-600 hover:bg-red-50" onClick={() => handleDeleteClass(cls)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {filteredClasses.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No classes found matching your search.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grades">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Grades Overview</CardTitle>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search grades..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-blue-900 text-white">
                      <TableHead className="text-white font-semibold">Grade Name</TableHead>
                      <TableHead className="text-white font-semibold">Level</TableHead>
                      <TableHead className="text-white font-semibold">Code</TableHead>
                      <TableHead className="text-white font-semibold">Total Classes</TableHead>
                      <TableHead className="text-white font-semibold">Total Students</TableHead>
                      <TableHead className="text-white font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGrades.map((grade, index) => (
                      <TableRow key={grade.id} className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                        <TableCell className="font-medium">{grade.name}</TableCell>
                        <TableCell>
                          <Badge className={getLevelColor(grade.level)}>
                            <Layers className="h-3 w-3 mr-1" />
                            {grade.level}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded">{grade.code}</code>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{grade.total_classes}</span>
                            <span className="text-gray-500 text-sm">classes</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{grade.total_students}</span>
                            <span className="text-gray-500 text-sm">students</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="border-blue-600 text-blue-600 hover:bg-blue-50">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" className="border-blue-600 text-blue-600 hover:bg-blue-50" onClick={() => handleEditGrade(grade)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" className="border-red-600 text-red-600 hover:bg-red-50" onClick={() => handleDeleteGrade(grade)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {filteredGrades.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No grades found matching your search.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="levels">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Levels Overview</CardTitle>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search levels..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-blue-900 text-white">
                      <TableHead className="text-white font-semibold">Level Name</TableHead>
                      <TableHead className="text-white font-semibold">Campus</TableHead>
                      <TableHead className="text-white font-semibold">Coordinator</TableHead>
                      <TableHead className="text-white font-semibold">Code</TableHead>
                      <TableHead className="text-white font-semibold">Total Grades</TableHead>
                      <TableHead className="text-white font-semibold">Total Students</TableHead>
                      <TableHead className="text-white font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLevels.map((level, index) => (
                      <TableRow key={level.id} className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge className={getLevelColor(level.name)}>
                              <Layers className="h-3 w-3 mr-1" />
                              {level.name}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-gray-500" />
                            {level.campus}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-500" />
                            {level.coordinator}
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded">{level.code}</code>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{level.total_grades}</span>
                            <span className="text-gray-500 text-sm">grades</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{level.total_students}</span>
                            <span className="text-gray-500 text-sm">students</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="border-blue-600 text-blue-600 hover:bg-blue-50">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" className="border-blue-600 text-blue-600 hover:bg-blue-50" onClick={() => handleEditLevel(level)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" className="border-red-600 text-red-600 hover:bg-red-50" onClick={() => handleDeleteLevel(level)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {filteredLevels.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No levels found matching your search.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Class Dialog */}
      <Dialog open={editClassOpen} onOpenChange={setEditClassOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Class</DialogTitle>
            <DialogDescription>
              Update the class information below.
            </DialogDescription>
          </DialogHeader>
          {editingClass && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-grade">Grade</Label>
                  <Select
                    value={editingClass.grade}
                    onValueChange={(value) => setEditingClass({ ...editingClass, grade: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Grade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Grade 1">Grade 1</SelectItem>
                      <SelectItem value="Grade 2">Grade 2</SelectItem>
                      <SelectItem value="Grade 3">Grade 3</SelectItem>
                      <SelectItem value="Grade 4">Grade 4</SelectItem>
                      <SelectItem value="Grade 5">Grade 5</SelectItem>
                      <SelectItem value="Grade 6">Grade 6</SelectItem>
                      <SelectItem value="Grade 7">Grade 7</SelectItem>
                      <SelectItem value="Grade 8">Grade 8</SelectItem>
                      <SelectItem value="Grade 9">Grade 9</SelectItem>
                      <SelectItem value="Grade 10">Grade 10</SelectItem>
                      <SelectItem value="Grade 11">Grade 11</SelectItem>
                      <SelectItem value="Grade 12">Grade 12</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-section">Section</Label>
                  <Select
                    value={editingClass.section}
                    onValueChange={(value) => setEditingClass({ ...editingClass, section: value })}
                  >
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
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-teacher">Class Teacher</Label>
                  <Input
                    id="edit-teacher"
                    value={editingClass.class_teacher}
                    onChange={(e) => setEditingClass({ ...editingClass, class_teacher: e.target.value })}
                    placeholder="Enter teacher name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-capacity">Capacity</Label>
                  <Input
                    id="edit-capacity"
                    type="number"
                    value={editingClass.capacity}
                    onChange={(e) => setEditingClass({ ...editingClass, capacity: parseInt(e.target.value) || 0 })}
                    placeholder="Enter capacity"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditClassOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveClass}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Grade Dialog */}
      <Dialog open={editGradeOpen} onOpenChange={setEditGradeOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Grade</DialogTitle>
            <DialogDescription>
              Update the grade information below.
            </DialogDescription>
          </DialogHeader>
          {editingGrade && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-grade-name">Grade Name</Label>
                  <Input
                    id="edit-grade-name"
                    value={editingGrade.name}
                    onChange={(e) => setEditingGrade({ ...editingGrade, name: e.target.value })}
                    placeholder="Enter grade name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-grade-level">Level</Label>
                  <Select
                    value={editingGrade.level}
                    onValueChange={(value) => setEditingGrade({ ...editingGrade, level: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pre-Primary">Pre-Primary</SelectItem>
                      <SelectItem value="Primary">Primary</SelectItem>
                      <SelectItem value="Secondary">Secondary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditGradeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveGrade}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Level Dialog */}
      <Dialog open={editLevelOpen} onOpenChange={setEditLevelOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Level</DialogTitle>
            <DialogDescription>
              Update the level information below.
            </DialogDescription>
          </DialogHeader>
          {editingLevel && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-level-name">Level Name</Label>
                  <Select
                    value={editingLevel.name}
                    onValueChange={(value) => setEditingLevel({ ...editingLevel, name: value })}
                  >
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
                  <Label htmlFor="edit-level-campus">Campus</Label>
                  <Input
                    id="edit-level-campus"
                    value={editingLevel.campus}
                    onChange={(e) => setEditingLevel({ ...editingLevel, campus: e.target.value })}
                    placeholder="Enter campus name"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-level-coordinator">Coordinator</Label>
                <Input
                  id="edit-level-coordinator"
                  value={editingLevel.coordinator}
                  onChange={(e) => setEditingLevel({ ...editingLevel, coordinator: e.target.value })}
                  placeholder="Enter coordinator name"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLevelOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveLevel}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Class Confirmation Dialog */}
      <Dialog open={deleteClassOpen} onOpenChange={setDeleteClassOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete Class
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this class? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deletingClass && (
            <div className="py-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-medium">{deletingClass.grade} - Section {deletingClass.section}</p>
                <p className="text-sm text-gray-600">Teacher: {deletingClass.class_teacher}</p>
                <p className="text-sm text-gray-600">Capacity: {deletingClass.capacity} students</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteClassOpen(false)}>
              No, Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteClass}>
              Yes, Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Grade Confirmation Dialog */}
      <Dialog open={deleteGradeOpen} onOpenChange={setDeleteGradeOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete Grade
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this grade? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deletingGrade && (
            <div className="py-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-medium">{deletingGrade.name}</p>
                <p className="text-sm text-gray-600">Level: {deletingGrade.level}</p>
                <p className="text-sm text-gray-600">Code: {deletingGrade.code}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteGradeOpen(false)}>
              No, Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteGrade}>
              Yes, Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Level Confirmation Dialog */}
      <Dialog open={deleteLevelOpen} onOpenChange={setDeleteLevelOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete Level
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this level? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deletingLevel && (
            <div className="py-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-medium">{deletingLevel.name}</p>
                <p className="text-sm text-gray-600">Campus: {deletingLevel.campus}</p>
                <p className="text-sm text-gray-600">Coordinator: {deletingLevel.coordinator}</p>
                <p className="text-sm text-gray-600">Code: {deletingLevel.code}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteLevelOpen(false)}>
              No, Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteLevel}>
              Yes, Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
