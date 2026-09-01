"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Users, Search, GraduationCap, Building2, User, CalendarIcon, Download, Mail, TrendingUp, Award, Wallet, CheckCircle, ChevronDown } from "lucide-react"
import { getAllStudents, getCoordinatorClasses, getStudentById, apiPatch, apiDelete, getClassrooms, getApiBaseUrl, getFilteredStudents, getLevels } from "@/lib/api"
import { StudentEditForm } from "@/components/admin/edit-forms/student-edit-form"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { useRouter } from "next/navigation"
import { DataTable } from "@/components/shared/data-table"
import { usePermissions, getCurrentUserRole } from "@/lib/permissions"
import { ListFilters } from "@/components/shared/ListFilters"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calender"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toast } from "sonner"
import { RefreshCcw, LayoutGrid } from "lucide-react"

type StudentRow = {
  id: number
  name: string
  student_code: string
  gr_no: string
  father_name: string
  email: string
  phone: string
  enrollment_year: string
  current_grade: string
  classroom_name: string
  campus_name: string
  current_state: string
  gender: string
  shift: string
  // Extra fields carried through for the teacher-style rich row UI.
  student_id?: string
  photo?: string | null
  profile_photo?: string | null
  section?: string
  created_at?: string
  attendance_percentage?: number | null
  performance?: { percent: number; label: string; grade: string } | null
  fee_status?: string | null
  enrollment_status?: string
  is_active?: boolean
}

function CoordinatorStudentListContent() {
  const router = useRouter()
  const perms = usePermissions()
  const [search, setSearch] = useState("")
  const [students, setStudents] = useState<StudentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCoordinator, setIsCoordinator] = useState(false)
  const [userRole, setUserRole] = useState("")

  // Filter states
  const [selectedShift, setSelectedShift] = useState<string>("all")
  const [selectedGrade, setSelectedGrade] = useState<string>("all")
  const [selectedSection, setSelectedSection] = useState<string>("all")
  const [selectedLevel, setSelectedLevel] = useState<string>("all")
  const [selectedGender, setSelectedGender] = useState<string>("")
  const [selectedOrdering, setSelectedOrdering] = useState<string>("name")
  const [levels, setLevels] = useState<any[]>([])
  const [isClearing, setIsClearing] = useState(false)

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(25)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  // Available options from coordinator classes
  const [availableShifts, setAvailableShifts] = useState<string[]>([])
  const [availableGrades, setAvailableGrades] = useState<Array<{ name: string, shifts: string[] }>>([])
  const [availableSections, setAvailableSections] = useState<string[]>([])
  const [coordinatorClasses, setCoordinatorClasses] = useState<any[]>([])

  // Edit dialog state
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingStudent, setEditingStudent] = useState<StudentRow | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)

  // Helper function to truncate subjects/grades to max 2 items

  // Fetch coordinator classes to get available shifts, grades, and sections
  useEffect(() => {
    async function fetchCoordinatorClasses() {
      try {
        const classesData = await getCoordinatorClasses()
        const classes = Array.isArray(classesData) ? classesData : (classesData as any)?.results || []
        setCoordinatorClasses(classes)

        // Extract unique shifts
        const shifts = new Set<string>()
        classes.forEach((cls: any) => {
          if (cls.shift) {
            shifts.add(cls.shift.toLowerCase())
          }
        })
        setAvailableShifts(Array.from(shifts).sort())

        // Extract unique grades with their shifts (a grade can appear in multiple shifts)
        const gradesMap = new Map<string, Set<string>>()
        classes.forEach((cls: any) => {
          if (cls.grade) {
            const gradeName = typeof cls.grade === 'string' ? cls.grade : cls.grade.name || cls.grade
            const shift = cls.shift?.toLowerCase() || ''
            if (!gradesMap.has(gradeName)) {
              gradesMap.set(gradeName, new Set())
            }
            if (shift) {
              gradesMap.get(gradeName)!.add(shift)
            }
          }
        })
        // Convert to array format: each grade can have multiple shifts
        const grades: Array<{ name: string, shifts: string[] }> = Array.from(gradesMap.entries()).map(([name, shifts]) => ({
          name,
          shifts: Array.from(shifts)
        }))
        setAvailableGrades(grades.sort((a, b) => a.name.localeCompare(b.name)) as any)

        // Extract unique sections
        const sections = new Set<string>()
        classes.forEach((cls: any) => {
          if (cls.section) {
            sections.add(cls.section.toUpperCase())
          }
        })
        setAvailableSections(Array.from(sections).sort())
      } catch (err) {
        console.error("Error fetching coordinator classes:", err)
      }
    }
    fetchCoordinatorClasses()
  }, [])

  // Fetch students with pagination
  useEffect(() => {
    async function fetchStudents() {
      setLoading(true)
      setError(null)
      try {
        // Check if we're on client side
        if (typeof window === 'undefined') {
          setError("Please wait, loading...");
          return;
        }

        // Get user from localStorage
        const user = localStorage.getItem("sis_user");
        if (user) {
          try {
            const parsedUser = JSON.parse(user)
            const role = String(parsedUser?.role || '').toLowerCase()
            setIsCoordinator(role.includes('coord'))
            setUserRole(role)
          } catch {
            setIsCoordinator(false)
          }

          // Fetch levels once if not loaded
          if (levels.length === 0) {
            try {
              const levelResults = await getLevels();
              const seen = new Set();
              const data = Array.isArray(levelResults) ? levelResults : (levelResults as any)?.results || [];
              const uniqueLevels = data.filter((level: any) => {
                const name = (level.name || level.level_name || "").trim();
                if (!name || seen.has(name)) return false;
                seen.add(name);
                return true;
              });
              setLevels(uniqueLevels);
            } catch (err) {
              console.error("Error fetching levels:", err);
            }
          }

          // Build filter params for API
          const filterParams: any = {
            page: currentPage,
            page_size: pageSize,
            ordering: selectedOrdering
          }

          // Add search if provided
          if (search.trim()) {
            filterParams.search = search.trim()
          }

          // Add shift filter if not "all"
          if (selectedShift !== "all") {
            filterParams.shift = selectedShift
          }

          // Add grade filter if not "all"
          if (selectedGrade !== "all") {
            filterParams.current_grade = selectedGrade
          }

          // Add section filter if not "all"
          if (selectedSection !== "all") {
            filterParams.section = selectedSection
          }

          // Add Level filter
          if (selectedLevel && selectedLevel !== 'all') {
            filterParams.level = selectedLevel
          }

          // Add Gender filter
          if (selectedGender && selectedGender !== 'all') {
            filterParams.gender = selectedGender
          }

          // Fetch paginated students
          const response = await getFilteredStudents(filterParams)

          // Map student data to the expected format. Spread the raw student so
          // the rich fields (attendance, performance, fee, photo, section, …)
          // survive for the teacher-style row UI; then normalise the basics.
          const mappedStudents = (response.results || []).map((student: any) => ({
            ...student,
            id: student.id,
            name: student.name || 'Unknown',
            student_code: student.student_id || student.student_code || 'Not Assigned',
            gr_no: student.gr_no || 'Not Assigned',
            father_name: student.father_name || 'Not provided',
            email: student.email || 'Not provided',
            phone: student.contact_number || 'Not provided',
            enrollment_year: student.enrollment_year || 'Not provided',
            current_grade: student.current_grade || 'Not Assigned',
            classroom_name: student.classroom_name || 'Not Assigned',
            campus_name: student.campus_name || 'Not Assigned',
            current_state: student.current_state || 'Active',
            gender: student.gender || 'Not specified',
            shift: student.shift || 'Not specified'
          }))

          setStudents(mappedStudents)
          setTotalCount(response.count || 0)
          setTotalPages(Math.ceil((response.count || 0) / pageSize))
        } else {
          setIsCoordinator(false)
          setError("User not logged in")
        }
      } catch (err: any) {
        console.error("Error fetching students:", err)
        setError(err.message || "Failed to load students")
      } finally {
        setLoading(false)
      }
    }
    fetchStudents()
  }, [currentPage, pageSize, search, selectedShift, selectedGrade, selectedSection, selectedLevel, selectedGender, selectedOrdering, refreshTrigger])

  // Reset grade and section when shift changes
  useEffect(() => {
    if (selectedShift === "all") {
      setSelectedGrade("all")
      setSelectedSection("all")
    } else {
      setSelectedGrade("all")
      setSelectedSection("all")
    }
    setCurrentPage(1) // Reset to first page when filter changes
  }, [selectedShift])

  // Reset section when grade changes
  useEffect(() => {
    setSelectedSection("all")
    setCurrentPage(1) // Reset to first page when filter changes
  }, [selectedGrade])

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [search, selectedLevel, selectedGender, selectedOrdering])

  const handleClearFilters = () => {
    setIsClearing(true)
    setSearch("")
    setSelectedShift("all")
    setSelectedLevel("all")
    setSelectedGrade("all")
    setSelectedSection("all")
    setSelectedGender("")
    setSelectedOrdering("name")
    setCurrentPage(1)
    setTimeout(() => setIsClearing(false), 500)
  }

  const handleListFilterChange = (type: string, value?: string) => {
    if (type === 'all') {
      handleClearFilters()
    } else if (type === 'alphabetical') {
      setSelectedOrdering(selectedOrdering === 'name' ? '-name' : 'name')
    } else if (type === 'recent') {
      setSelectedOrdering('-created_at')
    } else if (type === 'gender' && value) {
      setSelectedGender(value)
    }
  }

  const exportStudentsCSV = async () => {
    try {
      toast.info('Preparing full student list for download...');
      // Fetch all pages
      const filterParams: any = {
        page: 1,
        page_size: 1000,
        ordering: selectedOrdering
      };
      if (search.trim()) filterParams.search = search.trim();
      if (selectedShift !== 'all') filterParams.shift = selectedShift;
      if (selectedGrade !== 'all') filterParams.current_grade = selectedGrade;
      if (selectedSection !== 'all') filterParams.section = selectedSection;
      if (selectedLevel && selectedLevel !== 'all') filterParams.level = selectedLevel;
      if (selectedGender && selectedGender !== 'all') filterParams.gender = selectedGender;

      const response = await getFilteredStudents(filterParams);
      const allStudents = response.results || [];

      if (!allStudents.length) {
        toast.error('No students found to export');
        return;
      }

      const headers = [
        'Student ID', 'GR No', 'Old GR No', 'Full Name', 'Gender', 'Date of Birth', 'Age',
        'Place of Birth', 'Religion', 'Mother Tongue', 'Nationality', 'Blood Group',
        'Student CNIC', 'Special Needs / Disability',
        'Email', 'Phone', 'Emergency Contact', 'Emergency Relationship',
        'Father Name', 'Father CNIC', 'Father Contact', 'Father Profession', 'Father Status',
        'Mother CNIC', 'Mother Contact', 'Mother Profession', 'Mother Status',
        'Guardian Name', 'Guardian CNIC', 'Guardian Contact', 'Guardian Profession',
        'Address', 'Family Income', 'House Owned', 'Zakat Status', 'Siblings Count',
        'Campus', 'Classroom', 'Class Teacher', 'Coordinator',
        'Current Grade', 'Section', 'Shift', 'Enrollment Year',
        'Status', 'Is Active', 'Transfer Reason', 'Termination Reason', 'Terminated On'
      ];
      const rows = [headers.join(',')];

      allStudents.forEach((s: any) => {
        rows.push([
          s.student_id || s.student_code || 'N/A',
          s.gr_no || 'N/A',
          s.old_gr_number || 'N/A',
          `"${s.full_name || s.name || 'N/A'}"`,
          s.gender || 'N/A',
          s.dob || 'N/A',
          s.age || 'N/A',
          `"${s.place_of_birth || 'N/A'}"`,
          s.religion || 'N/A',
          s.mother_tongue || 'N/A',
          s.nationality || 'N/A',
          s.blood_group || 'N/A',
          s.student_cnic || 'N/A',
          `"${s.special_needs_disability || 'N/A'}"`,
          s.email || 'N/A',
          s.phone_number || s.contact_number || 'N/A',
          s.emergency_contact || 'N/A',
          s.emergency_relationship || 'N/A',
          `"${s.father_name || 'N/A'}"`,
          s.father_cnic || 'N/A',
          s.father_contact || 'N/A',
          `"${s.father_profession || 'N/A'}"`,
          s.father_status || 'N/A',
          s.mother_cnic || 'N/A',
          s.mother_contact || 'N/A',
          `"${s.mother_profession || 'N/A'}"`,
          s.mother_status || 'N/A',
          `"${s.guardian_name || 'N/A'}"`,
          s.guardian_cnic || 'N/A',
          s.guardian_contact || 'N/A',
          `"${s.guardian_profession || 'N/A'}"`,
          `"${s.address || 'N/A'}"`,
          s.family_income || 'N/A',
          s.house_owned || 'N/A',
          s.zakat_status || 'N/A',
          s.siblings_count ?? 'N/A',
          `"${s.campus_name || 'N/A'}"`,
          `"${s.classroom_name || s.class_name || 'N/A'}"`,
          `"${s.class_teacher_name || 'N/A'}"`,
          `"${s.coordinator_name || 'N/A'}"`,
          s.current_grade || 'N/A',
          s.section || 'N/A',
          s.shift || 'N/A',
          s.enrollment_year || 'N/A',
          s.current_state || (s.is_active ? 'Active' : 'Inactive'),
          s.is_active ? 'Yes' : 'No',
          `"${s.transfer_reason || 'N/A'}"`,
          `"${s.termination_reason || 'N/A'}"`,
          s.terminated_on || 'N/A'
        ].join(','));
      });

      const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      const dateStr = new Date().toISOString().split('T')[0];
      const gradeLabel = selectedGrade !== 'all' ? `_${selectedGrade.replace(/\s+/g, '_')}` : '';
      link.setAttribute('download', `Students${gradeLabel}_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${allStudents.length} students successfully!`);
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Failed to export students');
    }
  };

  // Get filtered grades based on selected shift
  const filteredGrades = useMemo(() => {
    if (selectedShift === "all") {
      return availableGrades
    }
    return availableGrades.filter(grade =>
      grade.shifts.includes(selectedShift.toLowerCase())
    )
  }, [selectedShift, availableGrades])

  // Get filtered sections based on selected grade
  const filteredSections = useMemo(() => {
    if (selectedGrade === "all") {
      return availableSections
    }
    // Get sections for the selected grade from coordinator classes
    const sections = new Set<string>()
    coordinatorClasses.forEach((cls: any) => {
      const gradeName = typeof cls.grade === 'string' ? cls.grade : cls.grade?.name || cls.grade
      if (gradeName === selectedGrade && cls.section) {
        sections.add(cls.section.toUpperCase())
      }
    })
    return Array.from(sections).sort()
  }, [selectedGrade, coordinatorClasses])

  // No client-side filtering needed - API handles all filtering and pagination
  const filteredStudents = useMemo(() => {
    return students
  }, [students])

  // Handle edit student
  const handleEditStudent = (student: StudentRow) => {
    if (!perms.canEditStudent) {
      toast.error("Unauthorized: You do not have permission to edit student record.");
      return;
    }
    // StudentEditForm loads the full record itself on open.
    setEditingStudent(student)
    setShowEditDialog(true)
  }

  // Handle delete student
  const handleDeleteStudent = async (student: StudentRow) => {
    if (!perms.canDeleteStudent) {
      toast.error("Unauthorized: You do not have permission to delete student record.");
      return;
    }
    if (!confirm(`Are you sure you want to delete student "${student.name}"? This action cannot be undone.`)) {
      return
    }

    setIsDeleting(true)
    try {
      await apiDelete(`/api/students/${student.id}/`)
      toast.success("Student deleted successfully!")

      // Refresh current page - if current page becomes empty, go to previous page
      const filterParams: any = {
        page: currentPage,
        page_size: pageSize,
      }

      if (search.trim()) filterParams.search = search.trim()
      if (selectedShift !== "all") filterParams.shift = selectedShift
      if (selectedGrade !== "all") filterParams.current_grade = selectedGrade
      if (selectedSection !== "all") filterParams.section = selectedSection

      const response = await getFilteredStudents(filterParams)

      // If current page is empty and not on first page, go to previous page
      if (response.results.length === 0 && currentPage > 1) {
        setCurrentPage(currentPage - 1)
      } else {
        // Refresh current page data (spread raw student to keep rich fields)
        const mappedStudents = (response.results || []).map((student: any) => ({
          ...student,
          id: student.id,
          name: student.name || 'Unknown',
          student_code: student.student_id || student.student_code || 'Not Assigned',
          gr_no: student.gr_no || 'Not Assigned',
          father_name: student.father_name || 'Not provided',
          email: student.email || 'Not provided',
          phone: student.contact_number || 'Not provided',
          enrollment_year: student.enrollment_year || 'Not provided',
          current_grade: student.current_grade || 'Not Assigned',
          classroom_name: student.classroom_name || 'Not Assigned',
          campus_name: student.campus_name || 'Not Assigned',
          current_state: student.current_state || 'Active',
          gender: student.gender || 'Not specified',
          shift: student.shift || 'Not specified'
        }))
        setStudents(mappedStudents)
        setTotalCount(response.count || 0)
        setTotalPages(Math.ceil((response.count || 0) / pageSize))
      }
    } catch (error: any) {
      console.error("Error deleting student:", error)
      toast.error(error?.message || "Failed to delete student")
    } finally {
      setIsDeleting(false)
    }
  }


  const columns = [
    {
      key: 'student_info',
      label: 'Student',
      icon: <User className="h-3 w-3 sm:h-4 sm:w-4" />,
      render: (student: StudentRow) => (
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="flex-shrink-0">
            {(student.photo || student.profile_photo) ? (
              <img
                src={student.photo || student.profile_photo || ''}
                alt={student.name}
                className="h-10 w-10 sm:h-12 sm:w-12 rounded-full object-cover border-2 border-[#a3cef1]/40"
                onError={(e) => {
                  const target = e.currentTarget as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            ) : null}
            <div
              className="h-10 w-10 sm:h-12 sm:w-12 rounded-full flex items-center justify-center bg-[#6096ba] text-white font-black text-sm sm:text-base"
              style={{ display: (student.photo || student.profile_photo) ? 'none' : 'flex' }}
            >
              {student.name?.charAt(0)?.toUpperCase() || <User className="h-5 w-5 sm:h-6 sm:w-6 text-white" />}
            </div>
          </div>
          <div className="min-w-0 flex-1 cursor-pointer" onClick={(e) => { e.stopPropagation(); router.push(`/admin/students/profile?id=${student.id}`) }}>
            <div className="text-sm sm:text-base font-bold text-gray-900 leading-tight flex items-center gap-2">
              <span>{student.name}</span>
              {student.created_at && (() => {
                const createdMs = new Date(student.created_at).getTime();
                const nowMs = new Date().getTime();
                const diffMs = nowMs - createdMs;
                const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
                const isToday = createdMs >= todayStart.getTime();
                const isThisWeek = diffMs < 7 * 24 * 60 * 60 * 1000;
                if (isToday) return (
                  <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-[#28a745] text-white px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                    <span className="h-1.5 w-1.5 rounded-full bg-white inline-block"></span>
                    New Today
                  </span>
                );
                if (isThisWeek) return (
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider bg-[#28a745]/15 text-[#1a7a35] px-2 py-0.5 rounded-full border border-[#28a745]/40">
                    New
                  </span>
                );
                return null;
              })()}
            </div>
            <div className="text-[10px] sm:text-[11px] text-gray-500 font-medium italic mb-1 uppercase opacity-85">
              {student.gender === 'female' ? 'd/o' : 's/o'} {student.father_name || 'N/A'}
            </div>
            <div className="text-xs sm:text-sm text-gray-600 flex items-center space-x-1.5">
              <div className="flex-shrink-0">
                <div className="h-5 w-5 rounded bg-gray-100 flex items-center justify-center">
                  <Mail className="h-3 w-3 text-gray-600" />
                </div>
              </div>
              <span className="font-mono text-xs sm:text-sm break-all">
                {student.student_id || student.student_code || 'N/A'}
              </span>
            </div>
            {(student.enrollment_year || student.created_at) && (
              <div className="text-[10px] text-gray-400 mt-0.5 pl-0.5">
                Enrolled: {student.enrollment_year || (student.created_at ? new Date(student.created_at).getFullYear() : '')}
              </div>
            )}
          </div>
        </div>
      )
    },
    {
      key: 'classroom',
      label: 'Classroom',
      icon: <GraduationCap className="h-3 w-3 sm:h-4 sm:w-4" />,
      render: (student: StudentRow) => (
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2">
            <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5 text-[#6096ba] flex-shrink-0" />
            <span className="text-sm sm:text-base font-semibold text-gray-900">
              {student.classroom_name || 'Not Assigned'}
            </span>
          </div>
          {(student.current_grade || student.section || student.shift) && (
            <div className="flex flex-wrap items-center gap-2 pl-6">
              {student.current_grade && (
                <span className="text-[10px] font-bold uppercase tracking-widest bg-[#6096ba]/10 text-[#274c77] px-2 py-0.5 rounded-md">
                  {student.current_grade}
                </span>
              )}
              {student.section && (
                <span className="text-[10px] font-bold uppercase tracking-widest bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">
                  Sec {student.section}
                </span>
              )}
              {student.shift && (
                <span className="text-[10px] font-bold uppercase tracking-widest bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md">
                  {student.shift}
                </span>
              )}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'attendance',
      label: 'Attendance',
      icon: <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4" />,
      render: (student: StudentRow) => {
        const pct = student.attendance_percentage;
        if (pct === null || pct === undefined) {
          return <span className="text-xs text-gray-400">No data</span>;
        }
        const barColor = pct >= 90 ? 'bg-emerald-500' : pct >= 75 ? 'bg-[#2F6B8A]' : pct >= 60 ? 'bg-amber-500' : 'bg-rose-500';
        return (
          <div className="min-w-[110px]">
            <div className="text-xs font-bold text-gray-700 mb-1.5">{pct}%</div>
            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
          </div>
        );
      }
    },
    {
      key: 'performance',
      label: 'Performance',
      icon: <Award className="h-3 w-3 sm:h-4 sm:w-4" />,
      render: (student: StudentRow) => {
        const p = student.performance;
        if (!p) return <span className="text-xs text-gray-400">—</span>;
        const styles: Record<string, string> = {
          'A+': 'bg-emerald-50 text-emerald-700 border-emerald-200',
          'A':  'bg-sky-50 text-sky-700 border-sky-200',
          'B':  'bg-amber-50 text-amber-700 border-amber-200',
          'C':  'bg-rose-50 text-rose-700 border-rose-200',
        };
        const cls = styles[p.grade] || 'bg-gray-50 text-gray-600 border-gray-200';
        return (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${cls}`} title={`${p.percent}%`}>
            {p.label}
          </span>
        );
      }
    },
    {
      key: 'fee_status',
      label: 'Fee Status',
      icon: <Wallet className="h-3 w-3 sm:h-4 sm:w-4" />,
      render: (student: StudentRow) => {
        const f = student.fee_status;
        if (!f) return <span className="text-xs text-gray-400">—</span>;
        const map: Record<string, { cls: string; label: string }> = {
          paid:        { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Paid' },
          pending:     { cls: 'bg-amber-50 text-amber-700 border-amber-200',       label: 'Pending' },
          overdue:     { cls: 'bg-rose-50 text-rose-700 border-rose-200',          label: 'Overdue' },
          scholarship: { cls: 'bg-violet-50 text-violet-700 border-violet-200',    label: 'Scholarship' },
        };
        const m = map[f] || { cls: 'bg-gray-50 text-gray-600 border-gray-200', label: String(f) };
        return (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${m.cls}`}>
            {m.label}
          </span>
        );
      }
    },
    {
      key: 'status',
      label: 'Status',
      icon: <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" />,
      render: (student: StudentRow) => {
        const st: string = student.enrollment_status || (student.is_active !== false ? 'enrolled' : 'left');
        const LABEL: Record<string, string> = {
          enrolled: 'Enrolled', left: 'Left', re_enrolled: 'Re-enrolled',
          graduated: 'Graduated', transferred: 'Transferred',
        };
        const COLOR: Record<string, string> = {
          enrolled: 'bg-green-100 text-green-800 border-green-200',
          re_enrolled: 'bg-blue-100 text-blue-800 border-blue-200',
          left: 'bg-rose-100 text-rose-800 border-rose-200',
          transferred: 'bg-amber-100 text-amber-800 border-amber-200',
          graduated: 'bg-purple-100 text-purple-800 border-purple-200',
        };
        return (
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs sm:text-sm font-medium border ${COLOR[st] || 'bg-gray-100 text-gray-700 border-gray-200'}`}
          >
            {LABEL[st] || st}
          </span>
        );
      }
    },
  ]

  if (!perms.canViewStudents && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-4 text-center">
        <div className="bg-red-50 p-8 rounded-3xl border border-red-100 max-w-md shadow-sm">
          <Users className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">
            You do not have permission to view the students list. Please contact your administrator if you believe this is an error.
          </p>
          <Button 
            onClick={() => router.push('/admin/dashboard')}
            className="w-full bg-[#274c77] text-white hover:bg-[#1e3a5f]"
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Student List
          </CardTitle>
          <p className="text-sm text-gray-600">
            View and manage students from classrooms taught by your assigned teachers
          </p>
        </CardHeader>
        <CardContent>
          {/* Filters — teacher-style inline compact row */}
          <div className="flex flex-col gap-3 mb-3 sm:mb-4">
            {/* Search + Filters card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2.5 sm:p-3 md:p-4 w-full overflow-x-hidden">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                {/* Search */}
                <div className="relative w-full sm:flex-1 sm:max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="ID, GR or Name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2F6B8A]/20 focus:border-[#2F6B8A] transition-colors"
                  />
                </div>

                {/* Compact filter pills */}
                <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto">
                  {/* Shift */}
                  <div className="relative flex-1 sm:flex-none">
                    <select
                      value={selectedShift}
                      onChange={(e) => setSelectedShift(e.target.value)}
                      className="appearance-none w-full sm:w-auto h-9 pl-3 pr-8 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#2F6B8A]/20 cursor-pointer"
                    >
                      <option value="all">All Shifts</option>
                      {availableShifts.map((shift) => (
                        <option key={shift} value={shift}>{shift.charAt(0).toUpperCase() + shift.slice(1)}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  </div>

                  {/* Level */}
                  <div className="relative flex-1 sm:flex-none">
                    <select
                      value={selectedLevel}
                      onChange={(e) => setSelectedLevel(e.target.value)}
                      className="appearance-none w-full sm:w-auto h-9 pl-3 pr-8 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#2F6B8A]/20 cursor-pointer"
                    >
                      <option value="all">All Levels</option>
                      {levels.map((level: any) => {
                        const name = (level.name || level.level_name || "").trim();
                        return <option key={level.id} value={name}>{name}</option>;
                      })}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  </div>

                  {/* Grade */}
                  <div className="relative flex-1 sm:flex-none">
                    <select
                      value={selectedGrade}
                      onChange={(e) => setSelectedGrade(e.target.value)}
                      className="appearance-none w-full sm:w-auto h-9 pl-3 pr-8 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#2F6B8A]/20 cursor-pointer"
                    >
                      <option value="all">All Grades</option>
                      {filteredGrades.map((grade) => (
                        <option key={grade.name} value={grade.name}>{grade.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  </div>

                  {/* Section */}
                  <div className="relative flex-1 sm:flex-none">
                    <select
                      value={selectedSection}
                      onChange={(e) => setSelectedSection(e.target.value)}
                      className="appearance-none w-full sm:w-auto h-9 pl-3 pr-8 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#2F6B8A]/20 cursor-pointer"
                    >
                      <option value="all">All Sections</option>
                      {filteredSections.map((section) => (
                        <option key={section} value={section}>{section}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                {/* Right actions — Export (when allowed) + Clear */}
                <div className="flex items-center gap-2 sm:ml-auto">
                  {['org-admin', 'principal'].includes(userRole) && (
                    <button
                      onClick={exportStudentsCSV}
                      className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      <span>Export CSV</span>
                    </button>
                  )}
                  <button
                    onClick={handleClearFilters}
                    className="inline-flex items-center gap-1.5 h-9 px-3 text-sm font-semibold text-white bg-[#6096ba] hover:bg-[#274c77] rounded-lg transition-colors"
                  >
                    <RefreshCcw className={`h-4 w-4 transition-transform duration-500 ${isClearing ? 'rotate-[360deg]' : 'rotate-0'}`} />
                    <span>Clear</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Filters (sort + gender) */}
            <ListFilters
              onFilterChange={handleListFilterChange}
              currentOrdering={selectedOrdering}
              currentGender={selectedGender}
            />

            <div className="flex items-center justify-between mt-1">
              <div className="text-sm text-gray-500">
                Showing <span className="font-bold text-[#274c77]">{filteredStudents.length}</span> students
              </div>
              <div className="text-xs text-gray-400">
                Page {currentPage} of {totalPages || 1}
              </div>
            </div>
          </div>

          {error ? (
            <div className="text-center py-8">
              <div className="text-red-600 mb-4">
                <Users className="h-12 w-12 mx-auto mb-2" />
                <p className="font-medium">Error: {error}</p>
              </div>
              <Button onClick={() => window.location.reload()} variant="outline">
                Try Again
              </Button>
            </div>
          ) : (
            <>
              <DataTable
                isLoading={loading}
                data={filteredStudents}
                columns={columns}
                onEdit={handleEditStudent}
                onDelete={handleDeleteStudent}
                allowEdit={perms.canEditStudent}
                allowDelete={perms.canDeleteStudent}
                emptyMessage={search ? "No students match your search." : "No students found"}
              />

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-gray-200">
                  <div className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages} ({totalCount} total students)
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1 || loading}
                    >
                      Previous
                    </Button>

                    {/* Page Numbers */}
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number
                        if (totalPages <= 5) {
                          pageNum = i + 1
                        } else if (currentPage <= 3) {
                          pageNum = i + 1
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i
                        } else {
                          pageNum = currentPage - 2 + i
                        }

                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            disabled={loading}
                            className={currentPage === pageNum ? "bg-[#274c77] text-white" : ""}
                          >
                            {pageNum}
                          </Button>
                        )
                      })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages || loading}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Student Dialog */}
      <StudentEditForm
        open={showEditDialog}
        student={editingStudent}
        onOpenChange={(v) => {
          setShowEditDialog(v)
          if (!v) setEditingStudent(null)
        }}
        onSaved={() => setRefreshTrigger((n) => n + 1)}
      />
    </div>
  )
}

export default function CoordinatorStudentListPage() {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    document.title = "Student List - Coordinator | Newton AMS";
  }, [])

  if (!isClient) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Student List
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LoadingSpinner message="Loading..." />
          </CardContent>
        </Card>
      </div>
    )
  }

  return <CoordinatorStudentListContent />
}
