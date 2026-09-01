"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUserRole, getCurrentUser, usePermissions } from "@/lib/permissions";
import { getFilteredStudents, getAllCampuses, getLevels, getGrades, getClassrooms, getCurrentUserProfile, bulkAssignClassroom, bulkMarkAsAlumni, getStudentFormOptions } from "@/lib/api";
import { DataTable, PaginationControls, ListFilters } from "@/components/shared";
import EnrollmentStatusCard from "@/components/students/enrollment-status-card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { User, Search, RefreshCcw, Mail, GraduationCap, CheckCircle, XCircle, X, LayoutGrid, Plus, Trash2, Download, MapPin, TrendingUp, Award, Wallet, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calender";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getApiBaseUrl } from "@/lib/api";
import { StudentForm } from "@/components/admin/studentform";
import { StudentEditForm } from "@/components/admin/edit-forms/student-edit-form";
import { toast } from "sonner";

interface Student {
  id: number;
  name: string;
  student_id: string;
  student_code: string;
  gr_no: string;
  current_grade: string;
  section: string;
  shift?: string;
  current_state: string;
  cohort_year: string;
  cohort_date: string;
  cohort_start: string;
  cohort_end: string;
  cohort_outcome: string;
  gender: string;
  campus_name: string;
  classroom_name: string;
  father_name: string;
  contact_number: string;
  email: string;
  coordinator_names: string[];
  is_active?: boolean;
  photo?: string | null;
  profile_photo?: string | null;
  created_at?: string;
  enrollment_year?: number | string;
  // Computed list metrics (from backend, per-page)
  attendance_percentage?: number | null;
  performance?: { percent: number; label: string; grade: string } | null;
  fee_status?: 'paid' | 'pending' | 'overdue' | 'scholarship' | string | null;
}

interface PaginationInfo {
  count: number;
  next: string | null;
  previous: string | null;
  results: Student[];
}

export default function StudentListPage() {
  const router = useRouter();
  const perms = usePermissions();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  // Bulk Actions
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [targetClassroom, setTargetClassroom] = useState<number | null | 'alumni' | undefined>(undefined);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filters, setFilters] = useState({
    campus: "",
    current_grade: "",
    section: "",
    current_state: "",
    cohort_year: "",
    cohort_date: "",
    cohort_start: "",
    cohort_end: "",
    cohort_outcome: "",
    gender: "",
    shift: "",
    classroom: "",
    is_new_admission: "",
    ordering: "name",
    start_date: "",
    end_date: ""
  });

  // User role and campus info
  const [userRole, setUserRole] = useState<string>("");
  const [userCampus, setUserCampus] = useState<string>("");
  const [userCampusId, setUserCampusId] = useState<number | null>(null);
  const [campuses, setCampuses] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [teacherShifts, setTeacherShifts] = useState<string[]>([]);
  const [showShiftFilter, setShowShiftFilter] = useState(true);
  const [teacherSections, setTeacherSections] = useState<string[]>([]);
  const [showSectionFilter, setShowSectionFilter] = useState(true);
  const [teacherGrades, setTeacherGrades] = useState<string[]>([]);
  const [showGradeFilter, setShowGradeFilter] = useState(true);
  const [teacherGradeSectionMap, setTeacherGradeSectionMap] = useState<Record<string, string[]>>({});

  // Edit functionality
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  // Student whose enrollment status is being changed (opens the status modal).
  const [statusStudent, setStatusStudent] = useState<Student | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [formOptions, setFormOptions] = useState<any>(null);

  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  const handleBulkUpdate = async () => {
    if (selectedStudents.length === 0 || targetClassroom === undefined) return;

    setIsProcessingBulk(true);
    try {
      if (targetClassroom === 'alumni') {
        await bulkMarkAsAlumni(selectedStudents);
      } else {
        await bulkAssignClassroom(selectedStudents, targetClassroom);
      }
      setShowBulkDialog(false);
      setSelectedStudents([]);
      setTargetClassroom(undefined);
      // Small delay to allow database processing
      await new Promise(resolve => setTimeout(resolve, 1500));
      fetchStudents();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to move students');
    } finally {
      setIsProcessingBulk(false);
    }
  };

  useEffect(() => {
    initializeUserData();
    fetchFormOptions();
  }, []);

  const fetchFormOptions = async () => {
    try {
      const options = await getStudentFormOptions();
      if (options) setFormOptions(options);
    } catch (err) {
      console.error("Failed to fetch form options:", err);
    }
  };

  // Fetch grades when campus or shift changes
  useEffect(() => {
    fetchGrades();
  }, [filters.campus, filters.shift]);

  // When shift cleared, also clear selected grade

  useEffect(() => {
    fetchClassrooms();
  }, [filters.campus, userCampusId]);

  useEffect(() => {
    fetchStudents();
  }, [currentPage, pageSize, filters, searchQuery]);

  const fetchClassrooms = async () => {
    try {
      const role = userRole || getCurrentUserRole();
      // For teachers, classrooms are set from their profile in initializeUserData
      // to ensure they only see their assigned classrooms.
      if (role === 'teacher' && !filters.campus) return;

      const campusId = filters.campus ? parseInt(filters.campus) : (userCampusId || undefined);
      const data: any = await getClassrooms(undefined, undefined, campusId);
      const rooms = Array.isArray(data) ? data : (data?.results || []);
      setClassrooms(rooms);
    } catch (error) {
      console.error('Error fetching classrooms:', error);
    }
  };

  const initializeUserData = async () => {
    const role = getCurrentUserRole();
    setUserRole(role);

    // Get user campus info
    const user = getCurrentUser() as any;
    if (user?.campus?.campus_name) {
      setUserCampus(user.campus.campus_name);
    }
    if (user?.campus?.id) {
      setUserCampusId(user.campus.id);
    }

    // For teachers, fetch their profile and classrooms to determine shifts
    if (role === 'teacher') {
      try {
        // Teachers never see the Shift filter
        setShowShiftFilter(false);

        const profile: any = await getCurrentUserProfile();
        if (profile) {
          // Get teacher's campus ID
          const teacherCampusId = profile.campus?.id || profile.campus_id || user?.campus?.id;
          if (teacherCampusId) {
            setUserCampusId(teacherCampusId);
            // Campus filter is hidden for teachers, so no need to pre-fill
          }

          // Get teacher's assigned classrooms from profile
          // Handle both assigned_classrooms (array) and assigned_classroom (single object)
          let classroomsList: any[] = [];

          if (profile.assigned_classrooms && Array.isArray(profile.assigned_classrooms) && profile.assigned_classrooms.length > 0) {
            classroomsList = profile.assigned_classrooms;
          } else if (profile.assigned_classroom) {
            // Fallback to singular assigned_classroom if assigned_classrooms is empty
            classroomsList = [profile.assigned_classroom];
          } else if (profile.classrooms && Array.isArray(profile.classrooms)) {
            classroomsList = profile.classrooms;
          }



          if (classroomsList.length > 0) {
            // Get unique shifts, sections, and grades from teacher's classrooms
            const shifts = new Set<string>();
            const sections = new Set<string>();
            const grades = new Set<string>();
            const gradeSectionMap: Record<string, Set<string>> = {};

            classroomsList.forEach((classroom: any) => {

              if (classroom.shift) {
                shifts.add(classroom.shift.toLowerCase());
              }
              if (classroom.section) {
                sections.add(classroom.section.toUpperCase());
              }
              // Backend returns grade as string in 'grade' field
              let gradeLabel: string | null = null;
              if (classroom.grade) {
                if (typeof classroom.grade === 'string') {
                  gradeLabel = classroom.grade;
                } else if (classroom.grade?.name) {
                  gradeLabel = classroom.grade.name;
                }
              } else if (classroom.grade_name) {
                gradeLabel = classroom.grade_name;
              }

              if (gradeLabel) {
                grades.add(gradeLabel);
                const key = gradeLabel.toString();
                const sectionLabel = classroom.section ? classroom.section.toUpperCase() : '';
                if (sectionLabel) {
                  if (!gradeSectionMap[key]) {
                    gradeSectionMap[key] = new Set<string>();
                  }
                  gradeSectionMap[key].add(sectionLabel);
                }
              }
            });

            const shiftsArray = Array.from(shifts);
            const sectionsArray = Array.from(sections);
            const gradesArray = Array.from(grades);



            setTeacherShifts(shiftsArray);
            setTeacherSections(sectionsArray);
            setTeacherGrades(gradesArray);
            // Convert grade→sections map to plain arrays for easier use in filters
            const mapObj: Record<string, string[]> = {};
            Object.entries(gradeSectionMap).forEach(([gradeKey, sectionSet]) => {
              mapObj[gradeKey] = Array.from(sectionSet as Set<string>);
            });
            setTeacherGradeSectionMap(mapObj);
            setClassrooms(classroomsList); // Set assigned classrooms for the filter dropdown

            // Auto-fill grade filter if teacher has only one grade
            const newFilters: any = {};

            // Section filter logic - DON'T auto-filter by section
            // A classroom can have students from multiple sections, so we shouldn't auto-filter
            // This ensures teachers see all students in their assigned classrooms
            setShowSectionFilter(true);
            // Don't set section filter automatically - let teachers see all sections in their classrooms

            // Grade filter logic
            if (gradesArray.length === 1) {
              newFilters.current_grade = gradesArray[0];
              setShowGradeFilter(false);

            } else {
              setShowGradeFilter(true);
            }

            // Apply all filters at once
            if (Object.keys(newFilters).length > 0) {

              setFilters(prev => ({ ...prev, ...newFilters }));
            }
          } else {
            // Fallback: Get all classrooms from campus if teacher classrooms not in profile
            if (teacherCampusId) {
              const allClassrooms: any = await getClassrooms(undefined, undefined, teacherCampusId);
              const allClassroomsList = Array.isArray(allClassrooms)
                ? allClassrooms
                : Array.isArray(allClassrooms?.results)
                  ? allClassrooms.results
                  : [];

              // Get unique shifts from all classrooms
              const shifts = new Set<string>();
              allClassroomsList.forEach((classroom: any) => {
                if (classroom.shift) {
                  shifts.add(classroom.shift.toLowerCase());
                }
              });

              const shiftsArray = Array.from(shifts);
              setTeacherShifts(shiftsArray);
              setClassrooms(allClassroomsList); // Set fallback classrooms

              // For teachers we don't expose shift filter; don't auto-set or show it
              setShowShiftFilter(false);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching teacher profile:', error);
      }
    }

    // Fetch campuses for filter dropdown
    try {
      const campusesData = await getAllCampuses();
      setCampuses(Array.isArray(campusesData) ? campusesData : []);
    } catch (error) {
      console.error('Error fetching campuses:', error);
    }
  };

  const fetchGrades = async () => {
    try {
      const campusId = filters.campus ? parseInt(filters.campus) : undefined;
      const gradesData: any = await getGrades(undefined, campusId, filters.shift || undefined);
      const gradesArray: any[] = gradesData?.results || (Array.isArray(gradesData) ? gradesData : []);

      let filtered: any[] = gradesArray;
      
      // 1. If shift filter is active, strictly filter grades by their own shift field
      if (filters.shift) {
        const selectedShift = filters.shift.toLowerCase();
        
        // Use classrooms to identify which grade IDs are actually used in this shift
        const classroomsData: any = await getClassrooms(undefined, undefined, campusId, filters.shift);
        const classrooms: any[] = Array.isArray(classroomsData)
          ? classroomsData
          : Array.isArray(classroomsData?.results)
            ? classroomsData.results
            : [];
            
        const gradeIdsInShift = new Set(
          classrooms.map((c: any) => c.grade?.id || c.grade || c.grade_id).filter(Boolean)
        );

        filtered = gradesArray.filter((g: any) => {
          const gradeShift = (g.shift || '').toLowerCase();
          // Grade must either match the shift directly OR be used in a classroom of that shift
          // If grade appears in a classroom of this shift, include it regardless of grade's own shift field
          return gradeIdsInShift.has(g.id) || gradeShift === selectedShift || gradeShift === 'both';
        });
      }

      // 2. De-duplicate by name AND shift to avoid repeated entries
      const seen = new Set<string>();
      const deduped = filtered.filter((g: any) => {
        const name = (g.name || '').toString().trim();
        const shift = (g.shift || '').toString().trim().toLowerCase();
        const key = `${name.toLowerCase()}|${shift}`;
        
        if (!name) return false;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // 3. Format display names and filter out incorrect shifts if shift filter is active
      const displayGrades = deduped.map(g => {
        return {
          ...g,
          displayName: (g.name || '').toString()
        };
      });

      setGrades(displayGrades);
    } catch (error) {
      console.error('Error fetching grades:', error);
      setGrades([]);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = {
        page: currentPage,
        page_size: pageSize,
        search: searchQuery || undefined,
        // Send campus filter if present - backend handles role-based restriction
        campus: filters.campus ? parseInt(filters.campus) : undefined,
        // Send grade to backend - backend now handles normalization
        current_grade: filters.current_grade || undefined,
        section: filters.section || undefined,
        current_state: filters.current_state || undefined,
        cohort_start: filters.cohort_start || undefined,
        cohort_end: filters.cohort_end || undefined,
        cohort_outcome: filters.cohort_outcome || undefined,
        gender: filters.gender || undefined,
        shift: filters.shift || undefined,
        classroom: filters.classroom === 'none' ? 'none' : (filters.classroom ? parseInt(filters.classroom) : undefined),
        is_new_admission: filters.is_new_admission || undefined,
        ordering: filters.ordering,
        start_date: filters.start_date || undefined,
        end_date: filters.end_date || undefined
      };

      const response = await getFilteredStudents(params) as unknown as PaginationInfo;
      // Fallback: if backend ignores page_size and returns more, slice locally
      let pageResults = (response.results || []);
      if (Array.isArray(pageResults) && pageResults.length > pageSize) {
        pageResults = pageResults.slice(0, pageSize);
      }
      // Client-side normalization for grade names (Grade 1, Grade I, Grade-1 etc.)
      const normalizeGradeName = (value: string | null | undefined): string => {
        if (!value) return '';
        const s = value.toString().trim().toLowerCase();
        // extract number or roman
        // map roman numerals up to 12
        const romanMap: Record<string, string> = {
          'i': '1', 'ii': '2', 'iii': '3', 'iv': '4', 'v': '5', 'vi': '6', 'vii': '7', 'viii': '8', 'ix': '9', 'x': '10', 'xi': '11', 'xii': '12'
        };
        const cleaned = s.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
        // try to find digits
        const digitMatch = cleaned.match(/\b(\d{1,2})\b/);
        let num = digitMatch ? digitMatch[1] : '';
        if (!num) {
          // try roman tokens
          const tokens = cleaned.split(' ');
          for (const t of tokens) {
            if (romanMap[t]) { num = romanMap[t]; break; }
          }
        }
        if (!num) return cleaned; // fallback
        return `grade ${num}`; // canonical form
      };

     
      // override the backend's sorting criteria.
      const results = [...pageResults];

      // Grade filtering is now done on backend, so no need for client-side filtering

      setStudents(results);
      // Use backend count since all filtering is done server-side now
      const countBase = response.count || results.length || 0;
      setTotalCount(countBase);
      const computedTotalPages = Math.ceil(countBase / pageSize) || 1;
      setTotalPages(computedTotalPages);
      if (currentPage > computedTotalPages) {
        setCurrentPage(computedTotalPages);
        return; // trigger refetch with clamped page
      }

    } catch (err: any) {
      // Handle invalid page gracefully by stepping back one page (or to 1)
      if (err?.status === 404 || /invalid page/i.test(err?.message || '')) {
        setCurrentPage(prev => Math.max(1, prev - 1));
        return;
      }
      console.error("Error fetching students:", err);
      setError(err.message || "Failed to load students");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1); // Reset to first page when searching

    // Clear existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // If search is empty, fetch immediately without debounce
    if (value.trim() === '') {
      fetchStudents();
      return;
    }

    // Set new timeout for debounced search
    const timeout = setTimeout(() => {
      fetchStudents();
    }, 500);

    setSearchTimeout(timeout);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value };

      // Reset dependent filters when shift changes
      if (key === 'shift') {
        next.current_grade = "";
        next.section = "";
        next.classroom = "";
      }

      // Handle New Admissions period presets
      if (key === 'is_new_admission') {
        const now = new Date();
        const formatDate = (d: Date) => {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };

        if (value === 'today') {
          next.start_date = formatDate(now);
          next.end_date = formatDate(now);
        } else if (value === 'week') {
          const start = new Date(now);
          start.setDate(now.getDate() - 7);
          next.start_date = formatDate(start);
          next.end_date = formatDate(now);
        } else if (value === 'month') {
          const start = new Date(now);
          start.setMonth(now.getMonth() - 1);
          next.start_date = formatDate(start);
          next.end_date = formatDate(now);
        } else if (value === 'year') {
          const start = new Date(now);
          start.setFullYear(now.getFullYear() - 1);
          next.start_date = formatDate(start);
          next.end_date = formatDate(now);
        } else if (value === 'custom') {
          // Keep existing dates or reset if none
        } else if (value === '') {
          next.start_date = '';
          next.end_date = '';
        }
      }

      // For teachers: when grade changes, auto-select a matching section (if we know one)
      if (userRole === 'teacher' && key === 'current_grade' && value) {
        const sectionsForGrade = teacherGradeSectionMap[value] || [];
        if (sectionsForGrade.length > 0) {
          next.section = sectionsForGrade[0];
        }
      }

      return next;
    });
    setCurrentPage(1); // Reset to first page when filtering
  };

  const handleQuickFilter = (type: string, value?: string) => {
    switch (type) {
      case 'all':
        setFilters(prev => ({ 
          ...prev, 
          ordering: 'name', 
          gender: '',
          shift: '',
          current_grade: '',
          section: '',
          is_new_admission: '',
          campus: userCampusId ? String(userCampusId) : ""
        }));
        setSearchQuery("");
        break;
      case 'alphabetical':
        // Toggle: name -> -name -> name
        setFilters(prev => ({ 
          ...prev, 
          ordering: prev.ordering === 'name' ? '-name' : 'name' 
        }));
        break;
      case 'recent':
        setFilters(prev => ({ ...prev, ordering: '-id' }));
        break;
      case 'gender':
        setFilters(prev => ({ ...prev, gender: value === 'all' ? '' : value || '' }));
        break;
    }
    setCurrentPage(1);
  };

  const exportStudentsCSV = async () => {
    try {
      toast.info('Preparing full student list for download...');
      // Fetch all pages
      const params: any = {
        page: 1,
        page_size: 1000,
        search: searchQuery || undefined,
        campus: filters.campus ? parseInt(filters.campus) : undefined,
        current_grade: filters.current_grade || undefined,
        section: filters.section || undefined,
        current_state: filters.current_state || undefined,
        cohort_start: filters.cohort_start || undefined,
        cohort_end: filters.cohort_end || undefined,
        cohort_outcome: filters.cohort_outcome || undefined,
        gender: filters.gender || undefined,
        shift: filters.shift || undefined,
        is_new_admission: filters.is_new_admission || undefined,
        ordering: filters.ordering
      };

      const response = await getFilteredStudents(params) as unknown as PaginationInfo;
      const allStudents = response.results || [];

      if (!allStudents.length) {
        toast.error('No students found to export');
        return;
      }

      // Columns match the bulk upload template exactly so exported CSV can be re-imported
      const headers = [
        'name', 'gender', 'dob', 'grade', 'section', 'shift', 'admission_year',
        'student_id', 'classroom', 'campus',
        'religion', 'mother_tongue', 'emergency_contact', 'address', 'siblings_count',
        'email', 'phone_number',
        'father_name', 'father_contact',
        'mother_name', 'mother_contact',
        'guardian_name', 'guardian_contact',
        'blood_group', 'student_cnic', 'nationality', 'place_of_birth',
        'father_cnic', 'mother_cnic', 'guardian_cnic', 'emergency_relationship'
      ];
      const rows = [headers.join(',')];

      const esc = (v: any) => {
        if (v === null || v === undefined || v === '') return '';
        const str = String(v);
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"` : str;
      };

      allStudents.forEach((s: any) => {
        rows.push([
          esc(s.full_name || s.name),
          esc(s.gender),
          esc(s.dob),
          esc(s.current_grade),
          esc(s.section),
          esc(s.shift),
          esc(s.enrollment_year),
          esc(s.student_id || s.student_code),
          esc(s.classroom_name || s.class_name),
          esc(s.campus_name),
          esc(s.religion),
          esc(s.mother_tongue),
          esc(s.emergency_contact),
          esc(s.address),
          esc(s.siblings_count ?? ''),
          esc(s.email),
          esc(s.phone_number || s.contact_number),
          esc(s.father_name),
          esc(s.father_contact),
          esc(s.mother_name),
          esc(s.mother_contact),
          esc(s.guardian_name),
          esc(s.guardian_contact),
          esc(s.blood_group),
          esc(s.student_cnic),
          esc(s.nationality),
          esc(s.place_of_birth),
          esc(s.father_cnic),
          esc(s.mother_cnic),
          esc(s.guardian_cnic),
          esc(s.emergency_relationship || s.guardian_relation),
        ].join(','));
      });

      const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      const dateStr = new Date().toISOString().split('T')[0];
      const gradeLabel = filters.current_grade ? `_${filters.current_grade.replace(/\s+/g, '_')}` : '';
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

  const clearFilters = () => {
    setFilters({
      campus: userCampusId ? String(userCampusId) : "",
      current_grade: "",
      section: "",
      current_state: "",
      cohort_year: "",
      cohort_date: "",
      cohort_start: "",
      cohort_end: "",
      cohort_outcome: "",
      gender: "",
      shift: "",
      classroom: "",
      is_new_admission: "",
      ordering: "name",
      start_date: "",
      end_date: ""
    });
    setSearchQuery("");
    setCurrentPage(1);
  };

  const handleClearFiltersClick = () => {
    setIsClearing(true);
    try {
      clearFilters();
    } finally {
      // brief rotation cycle
      setTimeout(() => setIsClearing(false), 700);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  // Edit handlers
  const handleEdit = (student: Student) => {
    // StudentEditForm loads the full record itself when it opens.
    setEditingStudent(student);
    setShowEditDialog(true);
  };

  const handleDelete = async (student: Student) => {
    const confirm = window.confirm(`Are you sure you want to delete ${student.name}?`);
    if (!confirm) return;
    try {
      const base = getApiBaseUrl();
      const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
      const response = await fetch(`${cleanBase}/api/students/${student.id}/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sis_access_token')}`,
        },
      });
      if (response.ok || response.status === 204) {
        toast.success(`Student ${student.name} deleted successfully.`);
        fetchStudents();
      } else {
        const text = await response.text();
        toast.error(`Error deleting student: ${response.status} - ${text}`);
      }
    } catch (error) {
      console.error('Delete student error:', error);
      toast.error('Failed to delete student. Please try again.');
    }
  };

  // Define table columns
  const columns = [
    {
      key: 'student_info',
      label: 'Student',
      icon: <User className="h-3 w-3 sm:h-4 sm:w-4" />,
      render: (student: Student) => (
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
                Enrolled: {student.enrollment_year || new Date(student.created_at!).getFullYear()}
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
      render: (student: Student) => (
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
      render: (student: Student) => {
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
      render: (student: Student) => {
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
      render: (student: Student) => {
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
    ...(userRole === 'org-admin' ? [{
      key: 'campus',
      label: 'Campus',
      icon: <MapPin className="h-3 w-3 sm:h-4 sm:w-4" />,
      render: (student: Student) => (
        <div className="flex items-center space-x-1 sm:space-x-2">
          <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-[#6096ba]" />
          <div className="min-w-0 flex-1">
            <div className="text-xs sm:text-sm font-bold text-gray-900 truncate">
              {student.campus_name || 'N/A'}
            </div>
          </div>
        </div>
      )
    }] : []),
    {
      key: 'status',
      label: 'Status',
      icon: <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" />,
      render: (student: any) => {
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
          <button
            type="button"
            onClick={() => setStatusStudent(student)}
            title="Click to change enrollment status"
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs sm:text-sm font-medium border hover:brightness-95 transition ${COLOR[st] || 'bg-gray-100 text-gray-700 border-gray-200'}`}
          >
            {LABEL[st] || st}
            <span className="text-[10px] opacity-60">▾</span>
          </button>
        );
      }
    }
  ];



  if (!perms.canViewStudents && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60rem] p-4 text-center">
        <div className="bg-red-50 p-8 rounded-3xl border border-red-100 max-w-md shadow-sm">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
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
    <div className="p-2 sm:p-3 md:p-4 w-full max-w-full overflow-x-hidden">
      <div className="mb-3 sm:mb-4 flex flex-row justify-between items-center gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold mb-1 sm:mb-2" style={{ color: '#274c77' }}>
            Students List
          </h1>
          {loading ? (
            <div className="h-4 w-48 bg-gray-200 animate-pulse rounded mt-2"></div>
          ) : (
            <p className="text-xs sm:text-sm md:text-base text-gray-600">
              Showing {students.length} of {totalCount} students
            </p>
          )}
        </div>
        <div className="flex-shrink-0">
          {perms.canAddStudent && (
            <Button
              onClick={() => router.push('/admin/students/add')}
              className="flex items-center gap-2 font-semibold shadow-sm hover:shadow-md transition-all duration-200 whitespace-nowrap"
              style={{ backgroundColor: '#274c77', color: 'white' }}
            >
              <Plus className="h-4 w-4" /> <span className="hidden xs:inline">Add Student</span><span className="xs:hidden">Add</span>
            </Button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2.5 sm:p-3 md:p-4 mb-3 w-full overflow-x-hidden">
        {/* Inline filter row — mobile: search+icon row, then pills row; desktop: single row */}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {/* Search (+ mobile-only Filter Options icon) */}
          <div className="flex items-center gap-2 w-full sm:w-auto sm:flex-1 sm:max-w-sm">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search Student"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full h-9 pl-9 pr-3 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2F6B8A]/20 focus:border-[#2F6B8A] transition-colors"
              />
            </div>
            {/* Filter Options icon — mobile only */}
            <button
              onClick={() => setShowAdvanced(v => !v)}
              title="Filter Options"
              className={`sm:hidden h-9 w-9 flex-shrink-0 flex items-center justify-center rounded-lg border transition-colors ${showAdvanced ? 'bg-[#2F6B8A]/10 text-[#274c77] border-[#2F6B8A]/30' : 'text-gray-600 bg-white border-gray-200'}`}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>

          {/* Pills group — on mobile each stretches to share the row */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Grade */}
            {showGradeFilter && (
              <div className="relative flex-1 sm:flex-none">
                <select
                  value={filters.current_grade}
                  onChange={(e) => handleFilterChange('current_grade', e.target.value)}
                  className="appearance-none w-full sm:w-auto h-9 pl-3 pr-8 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#2F6B8A]/20 cursor-pointer"
                >
                  <option value="">Grade</option>
                  {userRole === 'teacher' && teacherGrades.length > 0 ? (
                    teacherGrades.map((grade: string) => (
                      <option key={grade} value={grade}>{grade}</option>
                    ))
                  ) : (
                    grades.map((g: any) => (
                      <option key={`${g.id}-${g.shift}`} value={g.name}>{g.displayName || g.name}</option>
                    ))
                  )}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            )}

            {/* Section */}
            {showSectionFilter && (
              <div className="relative flex-1 sm:flex-none">
                <select
                  value={filters.section}
                  onChange={(e) => handleFilterChange('section', e.target.value)}
                  className="appearance-none w-full sm:w-auto h-9 pl-3 pr-8 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#2F6B8A]/20 cursor-pointer"
                >
                  <option value="">
                    {userRole === 'teacher' && filters.current_grade && teacherGradeSectionMap[filters.current_grade]?.length === 1
                      ? teacherGradeSectionMap[filters.current_grade][0]
                      : 'Section'}
                  </option>
                  {userRole === 'teacher' && teacherSections.length > 0 ? (
                    teacherSections.map((section: string) => (
                      <option key={section} value={section}>{section}</option>
                    ))
                  ) : (
                    (() => {
                      let filteredRooms = classrooms;
                      if (filters.shift) {
                        filteredRooms = filteredRooms.filter(r => (r.shift || '').toLowerCase() === filters.shift.toLowerCase());
                      }
                      if (filters.current_grade) {
                        filteredRooms = filteredRooms.filter(r => {
                          const gName = typeof r.grade === 'string' ? r.grade : r.grade?.name || r.grade_name || '';
                          return gName.toLowerCase() === filters.current_grade.toLowerCase();
                        });
                      }
                      const dynamicSections = Array.from(new Set(filteredRooms.map(r => r.section).filter(Boolean))).sort();

                      if (dynamicSections.length > 0) {
                        return dynamicSections.map(s => <option key={s} value={s}>{s}</option>);
                      }

                      return formOptions?.section?.map((opt: any) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      )) || (
                        <>
                          <option value="A">A</option>
                          <option value="B">B</option>
                          <option value="C">C</option>
                          <option value="D">D</option>
                        </>
                      );
                    })()
                  )}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            )}

            {/* Gender */}
            <div className="relative flex-1 sm:flex-none">
              <select
                value={filters.gender}
                onChange={(e) => handleFilterChange('gender', e.target.value)}
                className="appearance-none w-full sm:w-auto h-9 pl-3 pr-8 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#2F6B8A]/20 cursor-pointer"
              >
                <option value="">Gender</option>
                {formOptions?.gender?.map((opt: any) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                )) || (
                  <>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </>
                )}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Status */}
            <div className="relative flex-1 sm:flex-none">
              <select
                value={filters.current_state}
                onChange={(e) => handleFilterChange('current_state', e.target.value)}
                className="appearance-none w-full sm:w-auto h-9 pl-3 pr-8 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#2F6B8A]/20 cursor-pointer"
              >
                <option value="">Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Retention cohort window — Start (cohort as-of) → End (retention reference) */}
            <div className="flex items-end gap-2" title="Cohort = students enrolled as of the Start date. Retained/Left is measured as of the End date.">
              <div className="flex flex-col">
                <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400 pl-1 mb-0.5">Cohort Start</span>
                <input
                  type="date"
                  value={filters.cohort_start}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => handleFilterChange('cohort_start', e.target.value)}
                  aria-label="Cohort start"
                  className="h-9 pl-2 pr-1 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#2F6B8A]/20 cursor-pointer"
                />
              </div>
              <span className="text-gray-400 text-xs pb-2.5">→</span>
              <div className="flex flex-col">
                <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400 pl-1 mb-0.5">End (as of)</span>
                <input
                  type="date"
                  value={filters.cohort_end}
                  min={filters.cohort_start || undefined}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => handleFilterChange('cohort_end', e.target.value)}
                  aria-label="Cohort end"
                  className="h-9 pl-2 pr-1 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#2F6B8A]/20 cursor-pointer"
                />
              </div>
            </div>


            {/* Shift */}
            {showShiftFilter && userRole !== 'teacher' && (
              <div className="relative flex-1 sm:flex-none">
                <select
                  value={filters.shift}
                  onChange={(e) => handleFilterChange('shift', e.target.value)}
                  className="appearance-none w-full sm:w-auto h-9 pl-3 pr-8 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#2F6B8A]/20 cursor-pointer"
                >
                  <option value="">Shift</option>
                  {(() => {
                    const campus = campuses.find(c => String(c.id) === String(filters.campus));
                    const shiftAvailable = campus?.shift_available || 'both';

                    const options = formOptions?.shift || [
                      { value: 'morning', label: 'Morning' },
                      { value: 'afternoon', label: 'Afternoon' }
                    ];

                    if (shiftAvailable === 'both') {
                      return options.map((opt: any) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ));
                    } else {
                      return options.filter((opt: any) => opt.value === shiftAvailable).map((opt: any) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ));
                    }
                  })()}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            )}
          </div>

          {/* Right-side actions — Transfer always (when selected); Export/Filter Options/Clear on desktop */}
          <div className="flex items-center gap-2 sm:ml-auto">
            {perms.canEditStudent && selectedStudents.length > 0 && (
              <button
                onClick={() => setShowBulkDialog(true)}
                className="inline-flex items-center gap-1.5 h-9 px-3 text-sm font-semibold text-white bg-[#e67e22] hover:bg-[#d35400] rounded-lg transition-colors"
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">Transfer</span>
                <span>({selectedStudents.length})</span>
              </button>
            )}

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
              onClick={() => setShowAdvanced(v => !v)}
              className={`hidden sm:inline-flex items-center gap-1.5 h-9 px-3 text-sm font-semibold rounded-lg border transition-colors ${showAdvanced ? 'bg-[#2F6B8A]/10 text-[#274c77] border-[#2F6B8A]/30' : 'text-gray-600 bg-white border-gray-200 hover:bg-gray-50'}`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>Filter Options</span>
            </button>

            <button
              onClick={handleClearFiltersClick}
              className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 text-sm font-semibold text-white bg-[#6096ba] hover:bg-[#274c77] rounded-lg transition-colors"
            >
              <RefreshCcw className={`h-4 w-4 transition-transform duration-500 ${isClearing ? 'rotate-[360deg]' : 'rotate-0'}`} />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Advanced filter options (collapsible) */}
        {showAdvanced && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3 pt-3 border-t border-gray-100">
            {/* Campus Filter - Only show for superadmin */}
            {['superadmin', 'org_admin'].includes(userRole) && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Campus</label>
                <select
                  value={filters.campus}
                  onChange={(e) => {
                    const val = e.target.value;
                    handleFilterChange('campus', val);

                    const campus = campuses.find(c => String(c.id) === String(val));
                    const shiftAvailable = campus?.shift_available || 'both';

                    if (shiftAvailable !== 'both' && filters.shift && filters.shift !== shiftAvailable) {
                      handleFilterChange('shift', "");
                    }
                  }}
                  className="w-full h-9 px-3 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2F6B8A]/20"
                >
                  <option value="">All Campuses</option>
                  {campuses.map((campus) => (
                    <option key={campus.id} value={campus.id}>
                      {campus.campus_name || campus.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Classroom Filter */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Classroom</label>
              <select
                value={filters.classroom}
                onChange={(e) => handleFilterChange('classroom', e.target.value)}
                className="w-full h-9 px-3 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2F6B8A]/20"
              >
                <option value="">All Classrooms</option>
                <option value="none">No Classroom (Unassigned)</option>
                {classrooms.map((room: any) => (
                  <option key={room.id} value={room.id}>
                    {room.grade_name || (typeof room.grade === 'string' ? room.grade : room.grade?.name)} - {room.section} ({room.shift})
                  </option>
                ))}
              </select>
            </div>

            {/* New Admissions Filter */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">New Admissions</label>
              <select
                value={filters.is_new_admission}
                onChange={(e) => handleFilterChange('is_new_admission', e.target.value)}
                className="w-full h-9 px-3 text-sm bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2F6B8A]/20"
                style={{ borderColor: filters.is_new_admission ? '#28a745' : undefined }}
              >
                <option value="">All Students</option>
                {(() => {
                  const now = new Date();
                  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

                  const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);
                  const monthStart = new Date(now); monthStart.setMonth(now.getMonth() - 1);
                  const yearStart = new Date(now); yearStart.setFullYear(now.getFullYear() - 1);

                  return (
                    <>
                      <option value="today">New Today ({fmt(now)})</option>
                      <option value="week">New This Week ({fmt(weekStart)} - {fmt(now)})</option>
                      <option value="month">New This Month ({fmt(monthStart)} - {fmt(now)})</option>
                      <option value="year">New This Year ({fmt(yearStart)} - {fmt(now)})</option>
                    </>
                  );
                })()}
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {/* Date Range Filters - ONLY shown when custom is selected */}
            {filters.is_new_admission === 'custom' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Admission From</label>
                  <input
                    type="date"
                    value={filters.start_date}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(e) => handleFilterChange('start_date', e.target.value)}
                    className="w-full h-9 px-3 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2F6B8A]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Admission To</label>
                  <input
                    type="date"
                    value={filters.end_date}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(e) => handleFilterChange('end_date', e.target.value)}
                    className="w-full h-9 px-3 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2F6B8A]/20"
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Active filter chips */}
      {(() => {
        const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
        const chips: { key: string; label: string; onClear: () => void }[] = [];
        if (searchQuery) chips.push({ key: 'search', label: `"${searchQuery}"`, onClear: () => handleSearchChange('') });
        if (filters.current_grade) chips.push({ key: 'grade', label: filters.current_grade, onClear: () => handleFilterChange('current_grade', '') });
        if (filters.section) chips.push({ key: 'section', label: `Sec ${filters.section}`, onClear: () => handleFilterChange('section', '') });
        if (filters.shift) chips.push({ key: 'shift', label: cap(filters.shift), onClear: () => handleFilterChange('shift', '') });
        if (filters.gender) chips.push({ key: 'gender', label: cap(filters.gender), onClear: () => handleFilterChange('gender', '') });
        if (filters.cohort_start) chips.push({ key: 'cohort', label: `Cohort ${filters.cohort_start}${filters.cohort_end ? ` → ${filters.cohort_end}` : ''}`, onClear: () => { handleFilterChange('cohort_start', ''); handleFilterChange('cohort_end', ''); } });
        if (filters.current_state) chips.push({ key: 'state', label: cap(filters.current_state), onClear: () => handleFilterChange('current_state', '') });
        if (filters.classroom) {
          const room = classrooms.find((r: any) => String(r.id) === String(filters.classroom));
          const lbl = filters.classroom === 'none'
            ? 'No Classroom'
            : room ? `${room.grade_name || (typeof room.grade === 'string' ? room.grade : room.grade?.name)} - ${room.section}` : 'Classroom';
          chips.push({ key: 'classroom', label: lbl, onClear: () => handleFilterChange('classroom', '') });
        }
        if (filters.is_new_admission) {
          const m: Record<string, string> = { today: 'New Today', week: 'New This Week', month: 'New This Month', year: 'New This Year', custom: 'Custom Range' };
          chips.push({ key: 'newadm', label: m[filters.is_new_admission] || 'New', onClear: () => handleFilterChange('is_new_admission', '') });
        }
        if (filters.campus && ['superadmin', 'org_admin'].includes(userRole)) {
          const c = campuses.find((x: any) => String(x.id) === String(filters.campus));
          chips.push({ key: 'campus', label: c?.campus_name || c?.name || 'Campus', onClear: () => handleFilterChange('campus', '') });
        }
        if (chips.length === 0) return null;
        return (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Filters:</span>
            {chips.map(chip => (
              <span key={chip.key} className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full text-xs font-semibold bg-[#2F6B8A]/10 text-[#274c77] border border-[#2F6B8A]/20">
                {chip.label}
                <button onClick={chip.onClear} className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-[#2F6B8A]/25 transition-colors" title="Remove filter">
                  <span className="text-sm leading-none">×</span>
                </button>
              </span>
            ))}
            <button onClick={handleClearFiltersClick} className="text-[11px] font-semibold text-gray-400 hover:text-rose-500 underline underline-offset-2 ml-1 transition-colors">
              Clear all
            </button>
          </div>
        );
      })()}

      {/* Quick Filters (sort only — gender lives in the inline filter row) */}
      <ListFilters
        onFilterChange={handleQuickFilter}
        currentOrdering={filters.ordering}
        currentGender={filters.gender}
        genderOptions={formOptions?.gender}
        showGender={false}
      />

      {/* New Admissions Summary Bar */}
      {filters.is_new_admission && !loading && (
        <div className="flex items-center gap-3 px-4 py-2.5 mb-3 rounded-lg bg-[#28a745]/10 border border-[#28a745]/30">
          <span className="h-2.5 w-2.5 rounded-full bg-[#28a745] animate-pulse flex-shrink-0" />
          <span className="text-sm font-semibold text-[#1a7a35]">
            {totalCount} new admission{totalCount !== 1 ? 's' : ''} —&nbsp;
            {filters.is_new_admission === 'today' && 'today'}
            {filters.is_new_admission === 'week' && 'this week'}
            {filters.is_new_admission === 'month' && 'this month'}
            {filters.is_new_admission === 'year' && 'this year'}
            {filters.is_new_admission === 'custom' && 'custom range'}
          </span>
        </div>
      )}

      {/* Students Table - USING REUSABLE COMPONENT */}
      <DataTable
        data={students}
        columns={columns}
        onEdit={(student) => handleEdit(student)}
        onDelete={(student) => handleDelete(student)}
        isLoading={loading}
        emptyMessage="No students found"
        allowEdit={perms.canEditStudent}
        allowDelete={perms.canDeleteStudent}
        selectedIds={selectedStudents}
        onSelectionChange={setSelectedStudents}
      />

      {/* Change Enrollment Status (Left / Re-enroll / etc.) — opens from the Status column */}
      {statusStudent && (
        <div
          className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setStatusStudent(null)}
        >
          <div className="relative w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            {/* Close — anchored to the card's top-right corner */}
            <button
              aria-label="Close"
              onClick={() => setStatusStudent(null)}
              className="absolute -top-3 -right-3 z-10 h-9 w-9 rounded-full bg-white shadow-lg ring-1 ring-black/5 flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <EnrollmentStatusCard
              student={statusStudent}
              className="shadow-2xl ring-1 ring-black/5"
              onUpdated={(u: any) => {
                setStatusStudent(u);
                setStudents((prev) => prev.map((s: any) => (s.id === u.id ? { ...s, ...u } : s)));
              }}
            />
          </div>
        </div>
      )}

      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />



      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-sm text-red-600">{error}</div>
        </div>
      )}

      {/* Edit Student Dialog */}
      <StudentEditForm
        open={showEditDialog}
        student={editingStudent}
        formOptions={formOptions}
        campuses={campuses}
        onOpenChange={(v) => {
          setShowEditDialog(v);
          if (!v) setEditingStudent(null);
        }}
        onSaved={() => { fetchStudents(); }}
      />

      {/* Add Student Dialog - REMOVED, now uses dedicated page */}

      {/* Bulk Assign Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent className="w-[95vw] sm:max-w-md rounded-3xl p-6 shadow-2xl border-none">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2" style={{ color: '#274c77' }}>
               <div className="h-8 w-8 rounded-full flex items-center justify-center bg-[#e67e22] text-white">
                  <LayoutGrid className="h-5 w-5" />
               </div>
               Bulk Class Assignment
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 text-sm text-orange-800">
               <p className="font-medium mb-1">Transferring {selectedStudents.length} Students</p>
               <p className="opacity-80">This action will update the grade, section, and shift of all selected students based on the target classroom.</p>
            </div>
            
            <div className="space-y-2">
              
              <Label htmlFor="bulk-classroom" className="text-gray-700 font-semibold ml-1">Select Target Classroom</Label>
              <Select
                value={targetClassroom === 'alumni' ? 'alumni' : (targetClassroom ? String(targetClassroom) : (targetClassroom === null ? 'none' : ''))}
                onValueChange={(value) => setTargetClassroom(value === 'none' ? null : value === 'alumni' ? 'alumni' : parseInt(value))}
              >
                <SelectTrigger id="bulk-classroom" className="h-12 rounded-xl border-[#a3cef1] focus:ring-[#6096ba]">
                  <SelectValue placeholder="Search/Select destination classroom..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl overflow-hidden shadow-xl max-h-[300px]">
                  <SelectItem value="none" className="py-3 font-semibold text-red-600 hover:bg-red-50 transition-colors">
                    Remove Classroom (No Classroom)
                  </SelectItem>
                  <SelectItem value="alumni" className="py-3 font-semibold text-purple-700 hover:bg-purple-50 transition-colors">
                    Alumni
                  </SelectItem>
                  {classrooms.map((classroom: any) => (
                    <SelectItem key={classroom.id} value={String(classroom.id)} className="py-3 hover:bg-blue-50 transition-colors">
                      {classroom.grade?.name || classroom.grade_name || 'N/A'} - {classroom.section || 'N/A'} ({classroom.shift || 'N/A'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row justify-end gap-3 mt-2">
            <Button 
                variant="ghost" 
                onClick={() => {
                  setShowBulkDialog(false);
                  setTargetClassroom(undefined);
                }}
                className="rounded-xl h-11 text-gray-500 hover:bg-gray-100"
            >
                Cancel
            </Button>
            <Button 
              onClick={handleBulkUpdate} 
              disabled={isProcessingBulk || (targetClassroom === undefined)}
              className="rounded-xl h-11 px-8 font-bold shadow-lg shadow-blue-100 transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ backgroundColor: '#6096ba' }}
            >
              {isProcessingBulk ? (
                  <div className="flex items-center gap-2">
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Processing...
                  </div>
              ) : 'Start Batch Update'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}