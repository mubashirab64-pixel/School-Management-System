"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Plus, Edit, Trash2, Users, UserPlus, Clock, UserX, GraduationCap, Download, MoreVertical } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import {
  getClassrooms,
  getClassroomStudents,
  createClassroom,
  updateClassroom,
  deleteClassroom,
  getGrades,
  getLevels,
  getAvailableTeachers,
  assignTeacherToClassroom,
  unassignTeacherFromClassroom,
  getUserCampusId,
  getUnassignedStudents,
  getAlumniStudents,
  bulkAssignStudentsToClassroom,
  bulkAssignClassroom,
  bulkMarkAsAlumni,
  deleteStudent
} from "@/lib/api"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"

interface ClassroomManagementProps {
  campusId?: number
}

const GRADE_SORT_ORDER = [
  'Special Class',
  'Nursery',
  'KG-I',
  'KG-II',
  'Grade I',
  'Grade-1',
  'Grade 1',
  'Grade II',
  'Grade-2',
  'Grade 2',
  'Grade III',
  'Grade-3',
  'Grade 3',
  'Grade IV',
  'Grade-4',
  'Grade 4',
  'Grade V',
  'Grade-5',
  'Grade 5',
  'Grade VI',
  'Grade-6',
  'Grade 6',
  'Grade VII',
  'Grade-7',
  'Grade 7',
  'Grade VIII',
  'Grade-8',
  'Grade 8',
  'Grade IX',
  'Grade-9',
  'Grade 9',
  'Grade X',
  'Grade-10',
  'Grade 10',
];

// Function to get grade sort index
function getGradeSortIndex(gradeName: string): number {
  const name = gradeName.trim().toLowerCase();

  // Exact matches first
  const exactMatch = GRADE_SORT_ORDER.findIndex(order =>
    name === order.toLowerCase()
  );
  if (exactMatch !== -1) return exactMatch;

  // Normalize grade name for matching (handle variations)
  const normalized = name.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();

  // Check for Special Class
  if (normalized.includes('special class') || normalized.includes('special')) {
    return 0; // Special Class index
  }

  // Check for Nursery
  if (normalized.includes('nursery')) {
    return 1; // Nursery index
  }

  // Check for KG-I / KG-1
  if (normalized.includes('kg-i') || normalized.includes('kg 1') || normalized.includes('kg1')) {
    return 2; // KG-I index
  }

  // Check for KG-II / KG-2
  if (normalized.includes('kg-ii') || normalized.includes('kg 2') || normalized.includes('kg2')) {
    return 3; // KG-II index
  }

  // Extract grade number from "Grade X" format
  const gradeMatch = normalized.match(/grade\s*([ivx\d]+)/i);
  if (gradeMatch) {
    const gradeValue = gradeMatch[1].toLowerCase();

    // Map Roman numerals to numbers
    const romanMap: Record<string, number> = {
      'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5,
      'vi': 6, 'vii': 7, 'viii': 8, 'ix': 9, 'x': 10
    };

    const gradeNum = romanMap[gradeValue] || parseInt(gradeValue) || 0;

    // Calculate index: Special Class(0), Nursery(1), KG-I(2), KG-II(3), then Grade I starts at 4
    if (gradeNum >= 1 && gradeNum <= 10) {
      return 3 + gradeNum; // Grade I = 4, Grade II = 5, etc.
    }
  }

  // Not found, return large number to sort at end
  return 999;
}

// Function to sort classrooms by grade name and section
function sortClassrooms(classrooms: any[]): any[] {
  return [...classrooms].sort((a, b) => {
    const gradeNameA = (a.grade_name || '').trim();
    const gradeNameB = (b.grade_name || '').trim();

    const indexA = getGradeSortIndex(gradeNameA);
    const indexB = getGradeSortIndex(gradeNameB);

    // Sort by grade index first
    if (indexA !== indexB) {
      return indexA - indexB;
    }

    // If same grade, sort by section (A, B, C, D, E)
    const sectionA = (a.section || '').toUpperCase();
    const sectionB = (b.section || '').toUpperCase();
    return sectionA.localeCompare(sectionB);
  });
}

export default function ClassroomManagement({ campusId }: ClassroomManagementProps) {
  const [classrooms, setClassrooms] = useState<any[]>([])
  const [studentCounts, setStudentCounts] = useState<{ [key: string]: number }>({})
  const [grades, setGrades] = useState<any[]>([])
  const [levels, setLevels] = useState<any[]>([])
  const [availableTeachers, setAvailableTeachers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isTeacherDialogOpen, setIsTeacherDialogOpen] = useState(false)
  const [editingClassroom, setEditingClassroom] = useState<any>(null)
  const [selectedClassroom, setSelectedClassroom] = useState<any>(null)
  const [formData, setFormData] = useState({
    level: '',
    grade: '',
    section: 'A',
    capacity: '30',
    shift: 'morning'
  })
  const [selectedTeacher, setSelectedTeacher] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedGrade, setSelectedGrade] = useState<string>('all')
  const [selectedShift, setSelectedShift] = useState<string>('all')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [selectedClassrooms, setSelectedClassrooms] = useState<Set<number>>(new Set())
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false)
  const [unassignedStudents, setUnassignedStudents] = useState<any[]>([])
  const [selectedStudents, setSelectedStudents] = useState<Set<number>>(new Set())
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
  const [selectedClassroomForAssign, setSelectedClassroomForAssign] = useState<string>('')
  const [showUnassignedSection, setShowUnassignedSection] = useState(false)
  const [alumniStudents, setAlumniStudents] = useState<any[]>([])
  const [showAlumniSection, setShowAlumniSection] = useState(false)
  // Filters inside "without classroom" modal
  const [unassignedFilterLevel, setUnassignedFilterLevel] = useState<string>('all')
  const [unassignedFilterGrade, setUnassignedFilterGrade] = useState<string>('all')
  // Filters inside alumni modal
  const [alumniFilterLevel, setAlumniFilterLevel] = useState<string>('all')
  const [alumniFilterGrade, setAlumniFilterGrade] = useState<string>('all')
  const [isViewStudentsDialogOpen, setIsViewStudentsDialogOpen] = useState(false)
  const [selectedClassroomForView, setSelectedClassroomForView] = useState<any>(null)
  const [classroomStudents, setClassroomStudents] = useState<any[]>([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [notificationSeen, setNotificationSeen] = useState(true)
  const [prevUnassignedCount, setPrevUnassignedCount] = useState(0)

  // Initialization for notification state from localStorage
  useEffect(() => {
    const savedCount = localStorage.getItem('lastSeenUnassignedCount')
    if (savedCount !== null) {
      setPrevUnassignedCount(parseInt(savedCount))
    }
  }, [])

  // Get campus ID from localStorage if not provided
  const userCampusId = campusId || getUserCampusId()

  useEffect(() => {
    fetchData()
    fetchUnassignedStudents()
    fetchAlumniStudents()
  }, [userCampusId, selectedGrade, selectedShift])

  async function fetchAlumniStudents() {
    try {
      const students = await getAlumniStudents(userCampusId || undefined)
      setAlumniStudents(students)
    } catch (error) {
      console.error('Failed to fetch alumni students:', error)
      setAlumniStudents([])
    }
  }

  async function fetchUnassignedStudents() {
    try {
      const students = await getUnassignedStudents(userCampusId || undefined)
      setUnassignedStudents(students)

      const savedCount = parseInt(localStorage.getItem('lastSeenUnassignedCount') || '0')

      // If current count is greater than what we last "saw"/acknowledged, show badge
      if (students.length > savedCount) {
        setNotificationSeen(false)
      } else {
        setNotificationSeen(true)
      }
    } catch (error) {
      console.error('Failed to fetch unassigned students:', error)
      setUnassignedStudents([])
    }
  }

  async function fetchData() {
    setLoading(true)
    try {
      const gradeId = selectedGrade !== 'all' ? parseInt(selectedGrade) : undefined
      // Filter classrooms by shift if selected
      const shift = selectedShift !== 'all' ? selectedShift : undefined

      const [classroomsData, gradesData, levelsData, teachersData] = await Promise.all([
        getClassrooms(
          gradeId,
          undefined,
          userCampusId || undefined,
          shift
        ),
        getGrades(undefined, userCampusId || undefined),
        getLevels(userCampusId || undefined),
        getAvailableTeachers(userCampusId || undefined)
      ])
      // Handle paginated responses
      const classroomsArray = (classroomsData as any)?.results || (Array.isArray(classroomsData) ? classroomsData : [])
      const gradesArray = (gradesData as any)?.results || (Array.isArray(gradesData) ? gradesData : [])
      const levelsArray = (levelsData as any)?.results || (Array.isArray(levelsData) ? levelsData : [])
      const teachersArray = (teachersData as any)?.results || (Array.isArray(teachersData) ? teachersData : [])

      // Sort classrooms by grade name and section
      const sortedClassrooms = sortClassrooms(classroomsArray)

      setClassrooms(sortedClassrooms)
      // Fetch student counts for each classroom
      const counts: { [key: string]: number } = {}
      await Promise.all(
        classroomsArray.map(async (c: any) => {
          try {
            // API responses vary: some return { results: [...] }, some return { students: [...] },
            // or a numeric total_students. Treat the response as `any` to avoid TS errors and
            // handle the different shapes.
            const res: any = await getClassroomStudents(c.id)

            // API may return several shapes:
            // - an array of student objects => res is Array
            // - { results: [...] } (paginated)
            // - { students: [...] }
            // - { total_students: number }
            // Normalize these and store the numeric count.
            const key = String(c.id)
            if (Array.isArray(res)) {
              counts[key] = res.length
            } else if (Array.isArray(res?.results)) {
              counts[key] = res.results.length
            } else if (Array.isArray(res?.students)) {
              counts[key] = res.students.length
            } else {
              counts[key] = Number(res?.total_students) || 0
            }
          } catch (e) {
            counts[String(c.id)] = 0
          }
        })
      )
      setStudentCounts(counts)
      setGrades(gradesArray)
      setLevels(levelsArray)
      setAvailableTeachers(teachersArray)
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleCreate() {
    setEditingClassroom(null)
    const defaultLevelId = levels.length > 0 ? levels[0].id.toString() : ''
    const defaultShift = levels.length > 0 ? (levels[0].shift || 'morning') : 'morning'
    const firstGradeForLevel = defaultLevelId ? grades.find((g: any) => String(g.level) === defaultLevelId) : undefined
    setFormData({
      level: defaultLevelId,
      grade: firstGradeForLevel ? firstGradeForLevel.id.toString() : '',
      section: 'A',
      capacity: '30',
      shift: defaultShift
    })
    setIsDialogOpen(true)
  }

  function handleEdit(classroom: any) {
    setEditingClassroom(classroom)
    const gradeObj = grades.find((g: any) => String(g.id) === String(classroom.grade))
    const levelId = gradeObj ? String(gradeObj.level) : ''
    setFormData({
      level: levelId,
      grade: classroom.grade.toString(),
      section: classroom.section,
      capacity: classroom.capacity.toString(),
      shift: classroom.shift || 'morning'
    })
    setIsDialogOpen(true)
  }

  async function handleSave() {
    // Block edits if a teacher is assigned to this classroom
    if (editingClassroom && (editingClassroom.class_teacher || editingClassroom.class_teacher_name)) {
      toast.warning('Please unassign the current class teacher before updating this classroom.')
      return
    }

    if (!formData.level || !formData.grade || !formData.section) {
      toast.error('Please select level, grade and section')
      return
    }

    setSaving(true)
    try {
      const data = {
        grade: parseInt(formData.grade),
        section: formData.section,
        capacity: parseInt(formData.capacity),
        shift: formData.shift
      }

      if (editingClassroom) {
        await updateClassroom(editingClassroom.id, data)
      } else {
        await createClassroom(data)
      }

      setIsDialogOpen(false)
      fetchData()
    } catch (error: any) {
      console.error('Failed to save classroom:', error)
      const errorMessage = error?.message || 'Failed to save classroom. Please try again.'
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(classroom: any) {
    if (!confirm(`Are you sure you want to delete ${classroom.grade_name} - ${classroom.section}?`)) {
      return
    }

    try {
      await deleteClassroom(classroom.id)
      // Small delay to ensure database updates are complete
      await new Promise(resolve => setTimeout(resolve, 800))
      // Refresh both data and unassigned students count
      await Promise.all([
        fetchData(),
        fetchUnassignedStudents()
      ])
      setSelectedClassrooms(new Set())
      // Force another refresh after a short delay to ensure count is updated
      setTimeout(() => {
        fetchUnassignedStudents()
      }, 1500)
    } catch (error: any) {
      console.error('Failed to delete classroom:', error)
      const errorMessage = error?.message || 'Failed to delete classroom. It may have assigned students.'
      toast.error(errorMessage)
    }
  }

  function handleSelectClassroom(classroomId: number, checked: boolean) {
    const newSelected = new Set(selectedClassrooms)
    if (checked) {
      newSelected.add(classroomId)
    } else {
      newSelected.delete(classroomId)
    }
    setSelectedClassrooms(newSelected)
  }

  function handleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedClassrooms(new Set(classrooms.map(c => c.id)))
    } else {
      setSelectedClassrooms(new Set())
    }
  }

  async function handleBulkDelete() {
    if (selectedClassrooms.size === 0) {
      toast.error('Please select at least one classroom to delete')
      return
    }

    const selectedNames = classrooms
      .filter(c => selectedClassrooms.has(c.id))
      .map(c => `${c.grade_name} - ${c.section}`)
      .join(', ')

    if (!confirm(`Are you sure you want to delete ${selectedClassrooms.size} classroom(s)?\n\n${selectedNames}`)) {
      return
    }

    setSaving(true)
    const errors: string[] = []
    const successCount = { count: 0 }

    try {
      // Delete classrooms in parallel
      await Promise.all(
        Array.from(selectedClassrooms).map(async (id) => {
          try {
            await deleteClassroom(id)
            successCount.count++
          } catch (error: any) {
            const classroom = classrooms.find(c => c.id === id)
            const name = classroom ? `${classroom.grade_name} - ${classroom.section}` : `Classroom ${id}`
            errors.push(`${name}: ${error?.message || 'Failed to delete'}`)
          }
        })
      )

      if (errors.length > 0) {
        toast.error(`Deleted ${successCount.count} classroom(s) successfully.`, {
          description: `Failed to delete:\n${errors.join('\n')}`
        })
      } else {
        toast.success(`Successfully deleted ${successCount.count} classroom(s)`)
      }

      setSelectedClassrooms(new Set())
      setIsBulkDeleteDialogOpen(false)
      // Small delay to ensure database updates are complete
      await new Promise(resolve => setTimeout(resolve, 800))
      // Refresh both data and unassigned students count
      await Promise.all([
        fetchData(),
        fetchUnassignedStudents()
      ])
      // Force another refresh after a short delay to ensure count is updated
      setTimeout(() => {
        fetchUnassignedStudents()
      }, 1500)
    } catch (error: any) {
      console.error('Bulk delete error:', error)
      toast.error('An error occurred during bulk delete')
    } finally {
      setSaving(false)
    }
  }

  // Helper: get grade names that belong to a level
  function getGradeNamesForLevel(levelId: string): string[] {
    return grades
      .filter((g: any) => {
        const gLevel = g.level_id ?? g.level?.id ?? g.level
        return String(gLevel) === levelId
      })
      .map((g: any) => g.name)
  }

  // Helper: filter a student list by level+grade selects
  function applyModalFilters(students: any[], filterLevel: string, filterGrade: string) {
    let result = students
    if (filterLevel !== 'all') {
      const gradeNamesInLevel = getGradeNamesForLevel(filterLevel)
      result = result.filter((s: any) =>
        gradeNamesInLevel.some(gn => gn?.toLowerCase() === (s.current_grade || '').toLowerCase())
      )
    }
    if (filterGrade !== 'all') {
      // filterGrade is grade name
      result = result.filter((s: any) =>
        (s.current_grade || '').toLowerCase() === filterGrade.toLowerCase()
      )
    }
    return result
  }

  // Grades filtered by selected level (for the grade dropdown inside modals)
  function getGradesForLevel(levelId: string) {
    if (levelId === 'all') return grades
    return grades.filter((g: any) => {
      const gLevel = g.level_id ?? g.level?.id ?? g.level
      return String(gLevel) === levelId
    })
  }

  function handleSelectStudent(studentId: number, checked: boolean) {
    const newSelected = new Set(selectedStudents)
    if (checked) {
      newSelected.add(studentId)
    } else {
      newSelected.delete(studentId)
    }
    setSelectedStudents(newSelected)
  }

  function handleSelectAllStudents(checked: boolean, filteredList?: any[]) {
    if (checked) {
      const list = filteredList ?? unassignedStudents
      setSelectedStudents(new Set(list.map((s: any) => s.id)))
    } else {
      setSelectedStudents(new Set())
    }
  }

  async function handleBulkDeleteStudents() {
    if (selectedStudents.size === 0) {
      toast.error('Please select at least one student to delete')
      return
    }

    const confirmMessage = `Are you sure you want to delete ${selectedStudents.size} selected student(s)? This action cannot be undone.`
    if (!confirm(confirmMessage)) {
      return
    }

    setSaving(true)
    const errors: string[] = []
    let successCount = 0

    try {
      const studentIds = Array.from(selectedStudents)

      await Promise.all(
        studentIds.map(async (studentId) => {
          try {
            const studentObj = unassignedStudents.find(s => s.id === studentId)
            const name = studentObj ? studentObj.name : `Student ${studentId}`
            await deleteStudent(studentId)
            successCount++
          } catch (err: any) {
            const studentObj = unassignedStudents.find(s => s.id === studentId)
            const name = studentObj ? studentObj.name : `Student ${studentId}`
            errors.push(`${name}: ${err.message || 'Error'}`)
          }
        })
      )

      if (errors.length > 0) {
        toast.error(`Deleted ${successCount} student(s).`, {
          description: `Failed to delete:\n${errors.join('\n')}`
        })
      } else {
        toast.success(`Successfully deleted ${successCount} student(s)`)
      }

      setSelectedStudents(new Set())
      
      // Refresh both unassigned students and classroom data
      await Promise.all([
        fetchUnassignedStudents(),
        fetchAlumniStudents(),
        fetchData()
      ])
    } catch (error: any) {
      console.error('Bulk delete error:', error)
      toast.error('An error occurred during bulk deletion')
    } finally {
      setSaving(false)
    }
  }

  async function handleBulkAssignStudents() {
    if (selectedStudents.size === 0) {
      toast.error('Please select at least one student to assign')
      return
    }

    if (!selectedClassroomForAssign) {
      toast.error('Please select a classroom')
      return
    }

    const classroomId = parseInt(selectedClassroomForAssign)
    if (isNaN(classroomId)) {
      toast.error('Invalid classroom selected')
      return
    }

    setSaving(true)
    const errors: string[] = []
    const successCount = { count: 0 }

    try {
      const results = await bulkAssignStudentsToClassroom(
        Array.from(selectedStudents),
        classroomId
      )

      results.forEach((result: any) => {
        if (result.error) {
          const student = unassignedStudents.find(s => s.id === result.id)
          const name = student ? student.name : `Student ${result.id}`
          errors.push(`${name}: ${result.error}`)
        } else {
          // Check if result has classroom field to confirm update
          if (result.classroom || result.classroom_data) {
            successCount.count++
          } else {
            // Still count as success if no error
            successCount.count++
          }
        }
      })

      if (errors.length > 0) {
        toast.error(`Assigned ${successCount.count} student(s) successfully.`, {
          description: `Failed to assign:\n${errors.join('\n')}`
        })
      } else {
        toast.success(`Successfully assigned ${successCount.count} student(s) to classroom`)
      }

      setSelectedStudents(new Set())
      setIsAssignDialogOpen(false)
      setSelectedClassroomForAssign('')
      // Close the main unassigned students modal as well
      setShowUnassignedSection(false)
      // Longer delay to ensure database transaction is committed and all signals are finished
      await new Promise(resolve => setTimeout(resolve, 2500))
      // Refresh both unassigned students and classroom data
      await Promise.all([
        fetchUnassignedStudents(),
        fetchAlumniStudents(),
        fetchData()
      ])
      // Force another refresh after a longer delay to ensure count is updated
      setTimeout(() => {
        fetchUnassignedStudents()
        fetchAlumniStudents()
      }, 3000)
    } catch (error: any) {
      console.error('Bulk assign error:', error)
      toast.error('An error occurred during bulk assignment')
    } finally {
      setSaving(false)
    }
  }

  async function handleAssignTeacher(classroom: any) {
    setSelectedClassroom(classroom)
    setSelectedTeacher(classroom.class_teacher?.toString() || '')
    // Load filtered teachers from backend by shift
    try {
      const shift = (classroom.shift || '').toString()
      const teachersData = await getAvailableTeachers(userCampusId || undefined, shift)
      const teachersArray = (teachersData as any)?.results || (Array.isArray(teachersData) ? teachersData : [])
      setAvailableTeachers(teachersArray)
    } catch (e) {
      console.error('Failed to load available teachers by shift', e)
    }
    setIsTeacherDialogOpen(true)
  }

  async function handleSaveTeacherAssignment() {
    if (!selectedTeacher || !selectedClassroom) {
      toast.error('Please select a teacher')
      return
    }

    setSaving(true)
    try {
      await assignTeacherToClassroom(selectedClassroom.id, parseInt(selectedTeacher))

      // Close modal
      setIsTeacherDialogOpen(false)

      // Show success message
      const teacherName = availableTeachers.find(t => t.id === parseInt(selectedTeacher))?.full_name || 'Teacher'
      const classroomName = `${selectedClassroom.grade_name}-${selectedClassroom.section}`
      toast.success(`${teacherName} assigned to ${classroomName} successfully!`)

      // Auto-refresh classroom list
      await fetchData()
      // Reset available teachers to full list after refresh
      try {
        const teachersData = await getAvailableTeachers(userCampusId || undefined)
        const teachersArray = (teachersData as any)?.results || (Array.isArray(teachersData) ? teachersData : [])
        setAvailableTeachers(teachersArray)
      } catch { }

    } catch (error: any) {
      const rawMessage: string = error?.message || ''

      let errorMessage: string
      if (rawMessage.includes('duplicate key') || rawMessage.includes('unique constraint') || rawMessage.includes('already exists')) {
        errorMessage = 'This classroom already has a teacher assigned. Please unassign the current teacher first before assigning a new one.'
      } else {
        errorMessage = rawMessage || 'Failed to assign teacher. Please try again.'
      }

      if (error?.status !== 400) {
        console.error('Failed to assign teacher:', error)
      } else {
        console.warn('Teacher assignment validation:', rawMessage)
      }

      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  async function handleViewStudents(classroom: any) {
    setSelectedClassroomForView(classroom)
    setIsViewStudentsDialogOpen(true)
    setLoadingStudents(true)
    setClassroomStudents([])
    try {
      const res: any = await getClassroomStudents(classroom.id)
      const studentsArray = res?.results || res?.students || (Array.isArray(res) ? res : [])
      setClassroomStudents(studentsArray)
    } catch (e) {
      console.error('Failed to fetch classroom students:', e)
    } finally {
      setLoadingStudents(false)
    }
  }

  function handleExportUnassignedCSV(students: any[]) {
    if (students.length === 0) return
    const headers = ['Name', 'Father Name', 'Student ID', 'Grade', 'Section', 'Shift']
    const rows = students.map((s: any) => [
      s.name || '',
      s.father_name || '',
      s.student_id || s.id || '',
      s.current_grade || '',
      s.section || '',
      s.shift ? s.shift.charAt(0).toUpperCase() + s.shift.slice(1) : '',
    ])
    const csv = [headers, ...rows].map(r => r.map((v: string) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'students_without_classrooms.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleRemoveFromClassroom(studentId: number) {
    if (!confirm('Move this student to "Without Classroom" status? They will be removed from this roster.')) return
    try {
      await bulkAssignClassroom([studentId], null)
      // Remove from local state immediately for instant UI feedback
      setClassroomStudents(prev => prev.filter(s => s.id !== studentId))
      // Refresh classroom counts and unassigned badge
      fetchData()
      fetchUnassignedStudents()
    } catch (e) {
      console.error('Failed to remove student from classroom:', e)
      toast.error('Failed to remove student. Please try again.')
    }
  }

  async function handleMarkAsAlumni(studentId: number) {
    if (!confirm('Mark this student as Alumni? They will be removed from this roster and marked as Inactive.')) return
    try {
      await bulkMarkAsAlumni([studentId])
      // Remove from local state immediately for instant UI feedback
      setClassroomStudents(prev => prev.filter(s => s.id !== studentId))
      // Refresh classroom counts, alumni counts and unassigned badge
      fetchData()
      fetchAlumniStudents()
      fetchUnassignedStudents()
    } catch (e) {
      console.error('Failed to mark student as alumni:', e)
      toast.error('Failed to mark student as Alumni. Please try again.')
    }
  }
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex gap-4">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-48" />
          </div>
        </div>
        <div className="border rounded-lg p-4 space-y-4">
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4 items-center">
              <Skeleton className="h-6 w-1/5" />
              <Skeleton className="h-6 w-1/5" />
              <Skeleton className="h-6 w-1/5" />
              <Skeleton className="h-6 w-1/5" />
              <Skeleton className="h-6 w-1/5" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start sm:items-center gap-3 flex-col sm:flex-row">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold" style={{ color: '#274c77' }}>Manage Classrooms</h2>
          <p className="text-xs sm:text-sm text-gray-600">
            Create classrooms and assign teachers
          </p>
        </div>
        <Button
          onClick={handleCreate}
          className="w-full sm:w-auto flex items-center justify-center gap-2"
          style={{ backgroundColor: '#274b77ff', color: 'white' }}
        >
          <Plus className="h-4 w-4" />
          Create Classroom
        </Button>
      </div>

      {/* Mobile collapse toggle */}
      <div className="sm:hidden">
        <Button variant="outline" onClick={() => setMobileOpen(!mobileOpen)} className="w-full">
          {mobileOpen ? 'Hide List' : 'Show List'}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:gap-4 bg-gray-50 p-3 sm:p-4 rounded-lg">
        {/* First Row: Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          {/* Shift Filter */}
          <div className="flex items-center gap-2 flex-1 sm:flex-initial">
            <Label className="font-semibold text-sm whitespace-nowrap">Shift:</Label>
            <Select value={selectedShift} onValueChange={setSelectedShift}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Shifts</SelectItem>
                <SelectItem value="morning">Morning</SelectItem>
                <SelectItem value="afternoon">Afternoon</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Grade Filter */}
          <div className="flex items-center gap-2 flex-1 sm:flex-initial">
            <Label className="font-semibold text-sm whitespace-nowrap">Grade:</Label>

            <Select value={selectedGrade} onValueChange={setSelectedGrade}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grades</SelectItem>
                {grades
                  .filter(grade => {
                    if (selectedShift === 'all') return true;
                    // Find the level for this grade
                    const level = levels.find(l => String(l.id) === String(grade.level));
                    // Only show grades whose level matches the selected shift
                    return level?.shift === selectedShift;
                  })
                  .map((grade) => (
                    <SelectItem key={grade.id} value={grade.id.toString()}>
                      {grade.name} ({classrooms.filter(c => String(c.grade) === String(grade.id)).length})
                    </SelectItem>
                  ))
                }
              </SelectContent>
            </Select>
          </div>

          {/* Total Count and Bulk Delete */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap" style={{ backgroundColor: '#E3F2FD', color: '#274c77' }}>
              Total Classrooms: {classrooms.length}
            </span>
            <span className="px-3 py-1 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap" style={{ backgroundColor: '#E8F5E9', color: '#2E7D32' }}>
              Total Assigned Students: {classrooms.reduce((acc, c) => {
                const key = String(c.id)
                const countFromMap = studentCounts[key]
                const countFromClassroomArray = Array.isArray(c.students) ? c.students.length : undefined
                const countFromClassroomTotal = typeof c.total_students === 'number' ? c.total_students : undefined
                const countFromPossibleField = c.student_count ?? c.students_count ?? undefined
                const finalCount = countFromMap ?? countFromClassroomArray ?? countFromClassroomTotal ?? countFromPossibleField ?? 0
                return acc + finalCount
              }, 0)}
            </span>
            {selectedClassrooms.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsBulkDeleteDialogOpen(true)}
                className="gap-2 whitespace-nowrap"
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">Delete Selected</span>
                <span className="sm:hidden">Delete</span>
                <span>({selectedClassrooms.size})</span>
              </Button>
            )}
          </div>
        </div>

        {/* Second Row: Messages and Unassigned Button */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {grades.length === 0 && (
            <p className="text-xs sm:text-sm text-amber-600">
              No grades found. Create a grade first to add classrooms.
            </p>
          )}

          <div className={`flex flex-col sm:flex-row gap-2 ${grades.length === 0 ? "w-full sm:w-auto" : "w-full sm:ml-auto"}`}>
            {/* Unassigned Students Button */}
            <div className="relative inline-flex w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => {
                  setShowUnassignedSection(true)
                  setNotificationSeen(true)
                  localStorage.setItem('lastSeenUnassignedCount', unassignedStudents.length.toString())
                }}
                disabled={unassignedStudents.length === 0}
                className={`w-full sm:w-auto transition-all duration-200 ${unassignedStudents.length > 0
                  ? 'border-amber-400 text-amber-800 hover:bg-amber-100 bg-amber-50 shadow-md shadow-amber-100 font-semibold'
                  : 'border-gray-200 text-gray-400 bg-gray-50'
                  }`}
              >
                <Users className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">See Students without Classrooms</span>
                <span className="sm:hidden">Unassigned Students</span>
              </Button>
              {unassignedStudents.length > 0 && !notificationSeen && (
                <span className="absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white shadow-lg ring-2 ring-white">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping"></span>
                  <span className="relative">{unassignedStudents.length}</span>
                </span>
              )}
            </div>

            {/* Alumni Students Button */}
            <div className="relative inline-flex w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAlumniSection(true)
                  fetchAlumniStudents()
                }}
                disabled={alumniStudents.length === 0}
                className={`w-full sm:w-auto transition-all duration-200 ${alumniStudents.length > 0
                  ? 'border-purple-400 text-purple-800 hover:bg-purple-100 bg-purple-50 shadow-md shadow-purple-100 font-semibold'
                  : 'border-gray-200 text-gray-400 bg-gray-50'
                  }`}
              >
                <GraduationCap className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">See Alumni Students</span>
                <span className="sm:hidden">Alumni</span>
                {alumniStudents.length > 0 && (
                  <span className="ml-2 bg-purple-600 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                    {alumniStudents.length}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {classrooms.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">
            {selectedGrade !== 'all'
              ? 'No classrooms found for this grade'
              : 'No classrooms found for your campus'}
          </p>
          {grades.length > 0 && (
            <Button onClick={handleCreate} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Classroom
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className={(mobileOpen ? 'grid' : 'hidden') + ' sm:hidden grid-cols-1 gap-3'}>
            {classrooms.map((classroom) => (
              <div key={classroom.id} className="rounded-lg border p-4 shadow-sm bg-white">
                <div className="flex items-start justify-between gap-2">
                  <Checkbox
                    checked={selectedClassrooms.has(classroom.id)}
                    onCheckedChange={(checked) => handleSelectClassroom(classroom.id, checked as boolean)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="text-base font-semibold">{classroom.grade_name} - {classroom.section}</div>

                  </div>
                  <span className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">{classroom.code}</span>
                </div>
                <div className="mt-2 text-xs text-gray-700">
                  {classroom.class_teacher_name ? (
                    <div>Teacher: <span className="font-medium">{classroom.class_teacher_name}</span> ({classroom.class_teacher_code})</div>
                  ) : (
                    <div className="text-gray-500">Teacher: Not Assigned</div>
                  )}
                  {classroom.assigned_by_name && (
                    <div className="text-[10px] text-gray-500 mt-1">By {classroom.assigned_by_name}{classroom.assigned_at ? ` on ${new Date(classroom.assigned_at).toLocaleDateString()}` : ''}</div>
                  )}
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleAssignTeacher(classroom)} title="Assign Teacher">
                    <UserPlus className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleEdit(classroom)} className="text-gray-700 hover:text-gray-900">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(classroom)} className="text-red-600 hover:text-red-800">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto -mx-4 sm:mx-0">
            <Table className="min-w-[880px]">
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-50 border-b border-gray-100">
                  <TableHead className="text-gray-500 font-semibold text-xs uppercase tracking-wider w-12">
                    <Checkbox
                      checked={classrooms.length > 0 && selectedClassrooms.size === classrooms.length}
                      onCheckedChange={handleSelectAll}
                      className="border-white"
                    />
                  </TableHead>
                  <TableHead className="text-gray-500 font-semibold text-xs uppercase tracking-wider">Classroom</TableHead>
                  <TableHead className="text-gray-500 font-semibold text-xs uppercase tracking-wider">Grade</TableHead>
                  <TableHead className="text-gray-500 font-semibold text-xs uppercase tracking-wider">Section</TableHead>
                  <TableHead className="text-gray-500 font-semibold text-xs uppercase tracking-wider">Shift</TableHead>
                  <TableHead className="text-gray-500 font-semibold text-xs uppercase tracking-wider">Students</TableHead>
                  <TableHead className="text-gray-500 font-semibold text-xs uppercase tracking-wider">Class Teacher</TableHead>
                  <TableHead className="text-gray-500 font-semibold text-xs uppercase tracking-wider">Assigned By</TableHead>
                  <TableHead className="text-right text-gray-500 font-semibold text-xs uppercase tracking-wider">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classrooms.map((classroom) => (
                  <TableRow key={classroom.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedClassrooms.has(classroom.id)}
                        onCheckedChange={(checked) => handleSelectClassroom(classroom.id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {classroom.grade_name} - {classroom.section}
                    </TableCell>
                    <TableCell>{classroom.grade_name}</TableCell>
                    <TableCell>{classroom.section}</TableCell>
                    <TableCell>
                      {classroom.shift ? (classroom.shift.charAt(0).toUpperCase() + classroom.shift.slice(1)) : '-'}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const key = String(classroom.id)
                        // Prefer the fetched count map, fall back to classroom fields commonly used by API
                        const countFromMap = studentCounts[key]
                        const countFromClassroomArray = Array.isArray(classroom.students) ? classroom.students.length : undefined
                        const countFromClassroomTotal = typeof classroom.total_students === 'number' ? classroom.total_students : undefined
                        const countFromPossibleField = classroom.student_count ?? classroom.students_count ?? undefined
                        const finalCount = countFromMap ?? countFromClassroomArray ?? countFromClassroomTotal ?? countFromPossibleField
                        return finalCount !== undefined ? `${finalCount} students` : <span className="text-gray-400">-</span>
                      })()}
                    </TableCell>
                    <TableCell>
                      {classroom.class_teacher_name ? (
                        <div>
                          <div className="text-sm sm:font-medium">{classroom.class_teacher_name}</div>
                          <div className="text-[10px] sm:text-xs text-gray-500">
                            {classroom.class_teacher_code}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">Not Assigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {classroom.assigned_by_name ? (
                        <div>
                          <div className="text-xs sm:text-sm">{classroom.assigned_by_name}</div>
                          {classroom.assigned_at && (
                            <div className="text-[10px] sm:text-xs text-gray-500 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(classroom.assigned_at).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewStudents(classroom)} className="text-blue-600 cursor-pointer">
                            <Users className="h-4 w-4 mr-2" /> View Students
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAssignTeacher(classroom)} className="cursor-pointer">
                            <UserPlus className="h-4 w-4 mr-2" /> Assign Teacher
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(classroom)} className="cursor-pointer">
                            <Edit className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDelete(classroom)} className="text-red-600 cursor-pointer">
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Create/Edit Classroom Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md md:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingClassroom ? 'Edit Classroom' : 'Create New Classroom'}
            </DialogTitle>
            <DialogDescription>
              {editingClassroom
                ? 'Update the classroom information. Code cannot be changed.'
                : 'Enter the classroom details. Code will be generated automatically.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {editingClassroom?.class_teacher && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                <p className="text-sm text-amber-800">
                  A teacher is currently assigned to this classroom. Please unassign the teacher before making changes.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="level">Level *</Label>
              {levels.length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                  <p className="text-sm text-amber-800">
                    No levels available. Please create a level first.
                  </p>
                </div>
              ) : (
                <Select
                  value={formData.level}
                  onValueChange={(value) => {
                    const firstGrade = grades.find((g: any) => String(g.level) === value)
                    const levelObj = levels.find((l: any) => String(l.id) === String(value))
                    const levelShift = levelObj?.shift || 'morning'
                    setFormData({
                      ...formData,
                      level: value,
                      grade: firstGrade ? firstGrade.id.toString() : '',
                      shift: levelShift
                    })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a level" />
                  </SelectTrigger>
                  <SelectContent>
                    {levels.map((level) => (
                      <SelectItem key={level.id} value={level.id.toString()}>
                        {level.name} ({String(level.shift || '').replace(/\b\w/g, (c: string) => c.toUpperCase())})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="grade">Grade *</Label>
              {grades.length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                  <p className="text-sm text-amber-800">
                    No grades available. Please create a grade first.
                  </p>
                </div>
              ) : (
                <Select
                  value={formData.grade}
                  onValueChange={(value) => setFormData({ ...formData, grade: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a grade" />
                  </SelectTrigger>
                  <SelectContent>
                    {grades
                      .filter((g: any) => !formData.level || String(g.level) === String(formData.level))
                      .map((grade) => (
                        <SelectItem key={grade.id} value={grade.id.toString()}>
                          {grade.name} ({grade.level_name})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="section">Section *</Label>
              <Select
                value={formData.section}
                onValueChange={(value) => setFormData({ ...formData, section: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['A', 'B', 'C', 'D', 'E'].map((section) => (
                    <SelectItem key={section} value={section}>
                      Section {section}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="shift">Shift</Label>
              <Select
                value={formData.shift}
                onValueChange={(value) => setFormData({ ...formData, shift: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    const levelObj = levels.find((l: any) => String(l.id) === String(formData.level))
                    const levelShift = (levelObj?.shift || '').toString()
                    if (levelShift === 'afternoon') {
                      return (<>
                        <SelectItem value="afternoon">Afternoon</SelectItem>
                      </>)
                    }
                    if (levelShift === 'morning') {
                      return (<>
                        <SelectItem value="morning">Morning</SelectItem>
                      </>)
                    }
                    // fallback when no level selected
                    return (<>
                      <SelectItem value="morning">Morning</SelectItem>
                      <SelectItem value="afternoon">Afternoon</SelectItem>
                    </>)
                  })()}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="capacity">Capacity *</Label>
              <Input
                id="capacity"
                type="number"
                min="1"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
              />
            </div>

            {editingClassroom && (
              <div className="space-y-2">
                <Label>Classroom Code</Label>
                <Input
                  value={editingClassroom.code}
                  disabled
                  className="bg-gray-100"
                />
                <p className="text-xs text-gray-500">
                  System-generated code cannot be modified
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={saving}
              className="text-gray-700 hover:text-gray-900"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || grades.length === 0}
              style={{ backgroundColor: '#2196F3', color: 'white' }}
            >
              {saving ? 'Saving...' : editingClassroom ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Teacher Dialog */}
      <Dialog open={isTeacherDialogOpen} onOpenChange={setIsTeacherDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Class Teacher</DialogTitle>
            <DialogDescription>
              Assign a teacher to {selectedClassroom?.grade_name} - {selectedClassroom?.section}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedClassroom?.class_teacher_name && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800 font-medium">Current Teacher:</p>
                <p className="text-sm">{selectedClassroom.class_teacher_name}</p>
                <p className="text-xs text-gray-600">{selectedClassroom.class_teacher_code}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="teacher">Select Teacher *</Label>
              {availableTeachers.length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                  <p className="text-sm text-amber-800">
                    No available teachers. All teachers are already assigned.
                  </p>
                </div>
              ) : (
                <Select
                  value={selectedTeacher}
                  onValueChange={setSelectedTeacher}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTeachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id.toString()}>
                        {teacher.full_name} ({teacher.employee_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {selectedClassroom?.class_teacher && (
                <div className="flex justify-between items-center pt-2">
                  <div className="text-xs text-gray-600">
                    Currently assigned: {selectedClassroom.class_teacher_name || 'Unknown'}
                  </div>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      if (!confirm('Unassign current class teacher from this classroom?')) return
                      setSaving(true)
                      try {
                        await unassignTeacherFromClassroom(selectedClassroom.id)
                        setIsTeacherDialogOpen(false)
                        await fetchData()
                      } catch (e: any) {
                        toast.error(e?.message || 'Failed to unassign teacher')
                      } finally {
                        setSaving(false)
                      }
                    }}
                  >
                    Unassign
                  </Button>
                </div>
              )}
            </div>

            {selectedClassroom?.assigned_by_name && (
              <div className="p-3 bg-gray-50 rounded-md">
                <p className="text-xs text-gray-600">Last Assignment:</p>
                <p className="text-sm">By: {selectedClassroom.assigned_by_name}</p>
                {selectedClassroom.assigned_at && (
                  <p className="text-xs text-gray-500">
                    On: {new Date(selectedClassroom.assigned_at).toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsTeacherDialogOpen(false)}
              disabled={saving}
              className="text-gray-700 hover:text-gray-900"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveTeacherAssignment}
              disabled={saving || !selectedTeacher || availableTeachers.length === 0}
              style={{ backgroundColor: '#2196F3', color: 'white' }}
            >
              {saving ? 'Assigning...' : 'Assign Teacher'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Multiple Classrooms</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedClassrooms.size} selected classroom(s)? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-60 overflow-y-auto py-4">
            <ul className="list-disc list-inside space-y-1 text-sm">
              {classrooms
                .filter(c => selectedClassrooms.has(c.id))
                .map(c => (
                  <li key={c.id}>
                    {c.grade_name} - {c.section} ({c.code})
                  </li>
                ))}
            </ul>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsBulkDeleteDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={saving}
            >
              {saving ? 'Deleting...' : `Delete ${selectedClassrooms.size} Classroom(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unassigned Students Modal */}
      <Dialog open={showUnassignedSection} onOpenChange={(open) => {
        setShowUnassignedSection(open)
        if (open) {
          fetchUnassignedStudents()
          setUnassignedFilterLevel('all')
          setUnassignedFilterGrade('all')
        } else {
          setTimeout(() => { fetchUnassignedStudents() }, 300)
        }
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl md:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Students without Classrooms ({unassignedStudents.length})</DialogTitle>
            <DialogDescription>
              Select students and assign them to a classroom. Students without classroom assignment are listed below.
            </DialogDescription>
          </DialogHeader>

          {/* Level + Grade Filters */}
          <div className="flex flex-col sm:flex-row gap-2 pb-3 border-b">
            <div className="flex-1">
              <Select
                value={unassignedFilterLevel}
                onValueChange={(v) => {
                  setUnassignedFilterLevel(v)
                  setUnassignedFilterGrade('all')
                }}
              >
                <SelectTrigger className="h-9 text-xs sm:text-sm">
                  <SelectValue placeholder="All Levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  {levels.map((l: any) => (
                    <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Select
                value={unassignedFilterGrade}
                onValueChange={setUnassignedFilterGrade}
              >
                <SelectTrigger className="h-9 text-xs sm:text-sm">
                  <SelectValue placeholder="All Grades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Grades</SelectItem>
                  {getGradesForLevel(unassignedFilterLevel).map((g: any) => (
                    <SelectItem key={g.id} value={g.name}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(unassignedFilterLevel !== 'all' || unassignedFilterGrade !== 'all') && (
              <button
                onClick={() => { setUnassignedFilterLevel('all'); setUnassignedFilterGrade('all') }}
                className="text-xs text-gray-500 hover:text-red-500 underline self-center whitespace-nowrap"
              >
                Clear filters
              </button>
            )}
          </div>

          {(() => {
            const filtered = applyModalFilters(unassignedStudents, unassignedFilterLevel, unassignedFilterGrade)
            return (
              <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 pb-2 border-b">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={filtered.length > 0 && filtered.every((s: any) => selectedStudents.has(s.id))}
                      onCheckedChange={(checked) => handleSelectAllStudents(checked as boolean, filtered)}
                    />
                    <span className="text-xs sm:text-sm text-gray-700">
                      Select All
                      {filtered.length !== unassignedStudents.length && (
                        <span className="ml-1 text-gray-400">({filtered.length} shown)</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    {selectedStudents.size > 0 && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleBulkDeleteStudents}
                          disabled={saving}
                          className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto flex items-center gap-1.5"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete Selected ({selectedStudents.size})
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => { setShowUnassignedSection(false); setIsAssignDialogOpen(true) }}
                          className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto"
                        >
                          Assign Selected ({selectedStudents.size})
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0">
                  {filtered.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 text-sm">No students match the selected filters.</div>
                  ) : (
                    <>
                      {/* Mobile Cards */}
                      <div className="sm:hidden space-y-2">
                        {filtered.map((student: any) => (
                          <div key={student.id} className="rounded-lg border border-gray-200 p-3 bg-white">
                            <div className="flex items-start gap-2">
                              <Checkbox
                                checked={selectedStudents.has(student.id)}
                                onCheckedChange={(checked) => handleSelectStudent(student.id, checked as boolean)}
                                className="mt-1"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">{student.name || '—'}</div>
                                {student.father_name && (
                                  <div className="text-xs text-gray-500 mt-0.5 truncate">S/O {student.father_name}</div>
                                )}
                                <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                                  <div>ID: {student.student_id || student.id}</div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span>Grade: {student.current_grade || '—'}</span>
                                    <span>•</span>
                                    <span>Sec: {student.section || '—'}</span>
                                    <span>•</span>
                                    <span className="capitalize">{student.shift || '—'}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Desktop Table */}
                      <div className="hidden sm:block overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12"></TableHead>
                              <TableHead className="text-xs sm:text-sm">Name</TableHead>
                              <TableHead className="text-xs sm:text-sm">Father Name</TableHead>
                              <TableHead className="text-xs sm:text-sm">Student ID</TableHead>
                              <TableHead className="text-xs sm:text-sm">Grade</TableHead>
                              <TableHead className="text-xs sm:text-sm">Section</TableHead>
                              <TableHead className="text-xs sm:text-sm">Shift</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filtered.map((student: any) => (
                              <TableRow key={student.id}>
                                <TableCell>
                                  <Checkbox
                                    checked={selectedStudents.has(student.id)}
                                    onCheckedChange={(checked) => handleSelectStudent(student.id, checked as boolean)}
                                  />
                                </TableCell>
                                <TableCell className="font-medium text-xs sm:text-sm truncate max-w-[150px]">{student.name || '—'}</TableCell>
                                <TableCell className="text-xs sm:text-sm">{student.father_name || '—'}</TableCell>
                                <TableCell className="text-xs sm:text-sm">{student.student_id || student.id}</TableCell>
                                <TableCell className="text-xs sm:text-sm">{student.current_grade || '—'}</TableCell>
                                <TableCell className="text-xs sm:text-sm">{student.section || '—'}</TableCell>
                                <TableCell className="text-xs sm:text-sm capitalize">{student.shift || '—'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          })()}

          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const filtered = applyModalFilters(unassignedStudents, unassignedFilterLevel, unassignedFilterGrade)
                handleExportUnassignedCSV(filtered)
              }}
              className="flex items-center gap-2 text-green-700 border-green-300 hover:bg-green-50"
            >
              <Download className="w-4 h-4" />
              Export CSV ({applyModalFilters(unassignedStudents, unassignedFilterLevel, unassignedFilterGrade).length})
            </Button>
            <Button variant="outline" onClick={() => setShowUnassignedSection(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alumni Students Modal */}
      <Dialog open={showAlumniSection} onOpenChange={(open) => {
        setShowAlumniSection(open)
        if (open) {
          fetchAlumniStudents()
          setAlumniFilterLevel('all')
          setAlumniFilterGrade('all')
        }
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl md:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-purple-700">
              <GraduationCap className="h-5 w-5" />
              Alumni Students ({alumniStudents.length})
            </DialogTitle>
            <DialogDescription>
              Students who have been marked as Alumni. They are no longer assigned to any classroom.
            </DialogDescription>
          </DialogHeader>

          {/* Level + Grade Filters */}
          <div className="flex flex-col sm:flex-row gap-2 pb-3 border-b">
            <div className="flex-1">
              <Select
                value={alumniFilterLevel}
                onValueChange={(v) => {
                  setAlumniFilterLevel(v)
                  setAlumniFilterGrade('all')
                }}
              >
                <SelectTrigger className="h-9 text-xs sm:text-sm">
                  <SelectValue placeholder="All Levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  {levels.map((l: any) => (
                    <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Select
                value={alumniFilterGrade}
                onValueChange={setAlumniFilterGrade}
              >
                <SelectTrigger className="h-9 text-xs sm:text-sm">
                  <SelectValue placeholder="All Grades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Grades</SelectItem>
                  {getGradesForLevel(alumniFilterLevel).map((g: any) => (
                    <SelectItem key={g.id} value={g.name}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(alumniFilterLevel !== 'all' || alumniFilterGrade !== 'all') && (
              <button
                onClick={() => { setAlumniFilterLevel('all'); setAlumniFilterGrade('all') }}
                className="text-xs text-gray-500 hover:text-red-500 underline self-center whitespace-nowrap"
              >
                Clear filters
              </button>
            )}
          </div>

          {(() => {
            const filtered = applyModalFilters(alumniStudents, alumniFilterLevel, alumniFilterGrade)
            return (
              <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 py-2 border-b">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={filtered.length > 0 && filtered.every((s: any) => selectedStudents.has(s.id))}
                      onCheckedChange={(checked) => handleSelectAllStudents(checked as boolean, filtered)}
                    />
                    <span className="text-xs sm:text-sm text-gray-700">
                      Select All
                      {filtered.length !== alumniStudents.length && (
                        <span className="ml-1 text-gray-400">({filtered.length} shown)</span>
                      )}
                    </span>
                  </div>
                  {selectedStudents.size > 0 && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => { setShowAlumniSection(false); setIsAssignDialogOpen(true) }}
                      className="bg-purple-600 hover:bg-purple-700 text-white w-full sm:w-auto gap-2"
                    >
                      <UserPlus className="h-4 w-4" />
                      Assign Selected ({selectedStudents.size})
                    </Button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto min-h-0">
                  {alumniStudents.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <GraduationCap className="h-10 w-10 mx-auto mb-3 opacity-40" />
                      <p className="text-sm">No alumni students found.</p>
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 text-sm">No students match the selected filters.</div>
                  ) : (
                    <>
                      {/* Mobile Cards */}
                      <div className="sm:hidden space-y-2">
                        {filtered.map((student: any) => (
                          <div key={student.id} className="rounded-lg border border-purple-100 p-3 bg-purple-50">
                            <div className="flex items-start gap-2">
                              <Checkbox
                                checked={selectedStudents.has(student.id)}
                                onCheckedChange={(checked) => handleSelectStudent(student.id, checked as boolean)}
                                className="mt-1"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">{student.name || '—'}</div>
                                {student.father_name && (
                                  <div className="text-xs text-gray-500 mt-0.5 truncate">S/O {student.father_name}</div>
                                )}
                                <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                                  <div>ID: {student.student_id || student.id}</div>
                                  <div>Grade: {student.current_grade || '—'} • Sec: {student.section || '—'} • <span className="capitalize">{student.shift || '—'}</span></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Desktop Table */}
                      <div className="hidden sm:block overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12"></TableHead>
                              <TableHead className="text-xs sm:text-sm">Name</TableHead>
                              <TableHead className="text-xs sm:text-sm">Father Name</TableHead>
                              <TableHead className="text-xs sm:text-sm">Student ID</TableHead>
                              <TableHead className="text-xs sm:text-sm">Grade</TableHead>
                              <TableHead className="text-xs sm:text-sm">Section</TableHead>
                              <TableHead className="text-xs sm:text-sm">Shift</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filtered.map((student: any) => (
                              <TableRow key={student.id} className="bg-purple-50/40">
                                <TableCell>
                                  <Checkbox
                                    checked={selectedStudents.has(student.id)}
                                    onCheckedChange={(checked) => handleSelectStudent(student.id, checked as boolean)}
                                  />
                                </TableCell>
                                <TableCell className="font-medium text-xs sm:text-sm">{student.name || '—'}</TableCell>
                                <TableCell className="text-xs sm:text-sm">{student.father_name || '—'}</TableCell>
                                <TableCell className="text-xs sm:text-sm">{student.student_id || student.id}</TableCell>
                                <TableCell className="text-xs sm:text-sm">
                                  <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                                    <GraduationCap className="h-3 w-3" />
                                    {student.current_grade || 'Alumni'}
                                  </span>
                                </TableCell>
                                <TableCell className="text-xs sm:text-sm">{student.section || '—'}</TableCell>
                                <TableCell className="text-xs sm:text-sm capitalize">{student.shift || '—'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAlumniSection(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Assign Students Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Students to Classroom</DialogTitle>
            <DialogDescription>
              Select a classroom to assign {selectedStudents.size} selected student(s) to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="classroom-select">Classroom</Label>
              <Select value={selectedClassroomForAssign} onValueChange={setSelectedClassroomForAssign}>
                <SelectTrigger id="classroom-select" className="mt-1">
                  <SelectValue placeholder="Select a classroom" />
                </SelectTrigger>
                <SelectContent>
                  {classrooms.map((classroom) => (
                    <SelectItem key={classroom.id} value={classroom.id.toString()}>
                      {classroom.grade_name} - {classroom.section} ({classroom.shift ? classroom.shift.charAt(0).toUpperCase() + classroom.shift.slice(1) : ''})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="max-h-40 overflow-y-auto border rounded p-2 bg-gray-50">
              <p className="text-xs font-semibold mb-2">Selected Students ({selectedStudents.size}):</p>
              <ul className="text-xs space-y-1">
                {[...unassignedStudents, ...alumniStudents]
                  .filter(s => selectedStudents.has(s.id))
                  .map(s => (
                    <li key={s.id} className="text-gray-700">
                      • {s.name} ({(s as any).current_grade || 'N/A'})
                    </li>
                  ))}
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAssignDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkAssignStudents}
              disabled={saving || !selectedClassroomForAssign}
              style={{ backgroundColor: '#2196F3', color: 'white' }}
            >
              {saving ? 'Assigning...' : `Assign ${selectedStudents.size} Student(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Students Dialog */}
      <Dialog open={isViewStudentsDialogOpen} onOpenChange={setIsViewStudentsDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-0 rounded-3xl border-none shadow-2xl">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="text-xl font-bold flex items-center gap-2" style={{ color: '#274c77' }}>
              <Users className="h-6 w-6" />
              {selectedClassroomForView?.grade_name} - {selectedClassroomForView?.section}
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              Total {classroomStudents.length} Students assigned to this classroom
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {loadingStudents ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <div className="h-8 w-8 border-4 border-blue-100 border-t-blue-500 rounded-full animate-spin"></div>
                <p className="text-sm text-gray-400 animate-pulse">Loading roster...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gray-50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="text-xs uppercase font-bold text-gray-600">Student Name</TableHead>
                      <TableHead className="text-xs uppercase font-bold text-gray-600">ID / Code</TableHead>
                      <TableHead className="text-xs uppercase font-bold text-gray-600">Father Name</TableHead>
                      <TableHead className="text-xs uppercase font-bold text-gray-600 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classroomStudents.map((s) => (
                      <TableRow key={s.id} className="hover:bg-blue-50/30 transition-colors group">
                        <TableCell className="font-semibold text-gray-800">{s.name}</TableCell>
                        <TableCell>
                          <div className="text-sm font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded w-fit capitalize">
                            {s.student_id || s.student_code || s.id}
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-500 text-sm">{s.father_name || '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleRemoveFromClassroom(s.id)}
                              title="Move to Without Classroom"
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-1 rounded-lg"
                            >
                              <UserX className="h-3 w-3" />
                              Remove
                            </button>
                            <button
                              onClick={() => handleMarkAsAlumni(s.id)}
                              title="Mark as Alumni"
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-600 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2 py-1 rounded-lg"
                            >
                              <GraduationCap className="h-3 w-3" />
                              Alumni
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 bg-gray-50 rounded-b-3xl">
            <Button
              variant="default"
              onClick={() => setIsViewStudentsDialogOpen(false)}
              className="rounded-xl px-10 font-bold h-11"
              style={{ backgroundColor: '#274c77' }}
            >
              Close Roster
            </Button>
          </DialogFooter>
        </DialogContent>
          </Dialog>
    </div>
  )
}