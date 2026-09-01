"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUserRole, getCurrentUser, getPermissions } from "@/lib/permissions";
import { getFilteredTeachers, getAllCampuses, getGrades, getClassrooms, authorizedFetch, API_ENDPOINTS } from "@/lib/api";
import { DataTable, PaginationControls, ListFilters } from "@/components/shared";
import { User, GraduationCap, MapPin, Award, RefreshCcw, Search, Plus, Download, Key, Trash, Eye, Edit, MoreVertical, ChevronDown, SlidersHorizontal, Clock } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { getApiBaseUrl } from "@/lib/api";
import { TeacherEditForm } from "@/components/admin/edit-forms/teacher-edit-form";
import { toast } from "sonner";

interface Teacher {
  id: number;
  full_name: string;
  photo?: string | null;
  father_name: string;
  employee_code: string;
  email: string;
  contact_number: string;
  current_subjects: string;
  current_classes_taught: string;
  shift: string;
  is_currently_active: boolean;
  is_class_teacher: boolean;
  campus_name: string;
  coordinator_names: string[];
  classroom_name: string;
  joining_date: string;
  current_campus?: number | string;
  total_experience_years: number;
  biometric_id: string | null;
  current_role_title?: string;
  is_subject_teacher?: boolean;
  is_teacher_assistant?: boolean;
  subject_assignments?: { subject_name?: string }[];
}

interface PaginationInfo {
  count: number;
  next: string | null;
  previous: string | null;
  results: Teacher[];
}

export default function TeacherListPage() {
  const router = useRouter();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    current_campus: "",
    shift: "",
    is_currently_active: "true",
    is_class_teacher: "",
    current_subjects: "",
    grade: "",
    gender: "",
    current_role_title: "",
    ordering: "sort_order"
  });

  // User role and campus info
  const [userRole, setUserRole] = useState<string>("");
  const [userCampus, setUserCampus] = useState<string>("");
  const [userCampusId, setUserCampusId] = useState<number | null>(null);
  const [campuses, setCampuses] = useState<any[]>([]);



  // Principal-specific: Campus shift and grades
  const [campusShift, setCampusShift] = useState<string>(""); // 'morning', 'afternoon', or 'both'
  const [allGrades, setAllGrades] = useState<any[]>([]);
  const [filteredGrades, setFilteredGrades] = useState<any[]>([]);

  // Edit functionality
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  // Grade options for the filter, derived from the campus's classrooms (reliable source)
  const [filterGradeOptions, setFilterGradeOptions] = useState<{ id: any; name: string }[]>([]);


  // Confirmation Dialog States
  const [confirmConfig, setConfirmConfig] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    actionLabel: string;
    variant: "default" | "destructive";
  }>({
    open: false,
    title: "",
    description: "",
    onConfirm: () => { },
    actionLabel: "Confirm",
    variant: "default",
  });



  // Debounced search
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    initializeUserData();
  }, []);

  // Build the Grade filter options from the campus's classrooms — the most reliable
  // source (the same grades shown in the Class column), independent of the grade-shift cross-filter.
  useEffect(() => {
    if (userRole !== 'principal') return;
    let cancelled = false;
    getClassrooms(undefined, undefined, userCampusId ?? undefined)
      .then((data: any) => {
        const list = Array.isArray(data) ? data : data?.results || [];
        const seen = new Set<string>();
        const grades: { id: any; name: string }[] = [];
        list.forEach((c: any) => {
          const gid = c.grade?.id ?? c.grade ?? c.grade_id;
          const gname = c.grade?.name ?? c.grade_name ?? (typeof c.grade === 'string' ? c.grade : '');
          const key = (gname || '').toLowerCase().trim();
          if (gid && gname && !seen.has(key)) {
            seen.add(key);
            grades.push({ id: gid, name: gname });
          }
        });
        if (!cancelled && grades.length) setFilterGradeOptions(grades);
      })
      .catch(() => { });
    return () => { cancelled = true; };
  }, [userRole, userCampusId]);

  useEffect(() => {
    fetchTeachers();
  }, [currentPage, pageSize, filters, searchQuery]);

  // Filter grades based on selected shift (for principal)
  useEffect(() => {
    if (userRole !== 'principal') return;

    const selectedShift = filters.shift;

    if (!selectedShift || selectedShift === 'both') {
      setFilteredGrades(allGrades);
      return;
    }

    // Fetch grades for this shift from backend (two sources combined):
    // 1. Grades whose level.shift matches (direct backend filter)
    // 2. Grades used in classrooms of this shift (catches data inconsistencies)
    const campusId = userCampusId ?? undefined;

    Promise.all([
      getGrades(undefined, campusId, selectedShift).catch(() => []),
      getClassrooms(undefined, undefined, campusId, selectedShift).catch(() => [])
    ]).then(([gradesData, classroomsData]) => {
      // Grade IDs from direct backend fetch
      const directGrades: any[] = Array.isArray(gradesData)
        ? gradesData
        : (gradesData as any)?.results || [];

      const directGradeIds = new Set(directGrades.map((g: any) => g.id).filter(Boolean));

      // Grade IDs from classroom-based fetch
      const classrooms: any[] = Array.isArray(classroomsData)
        ? classroomsData
        : (classroomsData as any)?.results || [];

      const classroomGradeIds = new Set(
        classrooms.map((c: any) => c.grade?.id || c.grade || c.grade_id).filter(Boolean)
      );

      // Combine both sources: show grade if found in either
      const combinedIds = new Set([...directGradeIds, ...classroomGradeIds]);

      // If allGrades already loaded, filter from it (preserves consistent objects)
      // Otherwise fall back to directGrades from API
      const pool = allGrades.length > 0 ? allGrades : directGrades;

      const filtered = pool.filter((g: any) => {
        const gradeShift = (g.shift || '').toLowerCase();
        return combinedIds.has(g.id) || gradeShift === selectedShift || gradeShift === 'both';
      });

      // De-duplicate by name
      const seen = new Set<string>();
      const deduped = filtered.filter((g: any) => {
        const name = (g.name || '').toLowerCase().trim();
        if (!name || seen.has(name)) return false;
        seen.add(name);
        return true;
      });

      setFilteredGrades(deduped);

      // Reset grade selection if it no longer exists in filtered list
      if (filters.grade) {
        const stillExists = deduped.some((g: any) => g.id.toString() === filters.grade);
        if (!stillExists) {
          setFilters((prev: any) => ({ ...prev, grade: "" }));
        }
      }
    });
  }, [filters.shift, allGrades, userRole, userCampusId]);


  const initializeUserData = async () => {
    const role = getCurrentUserRole();
    setUserRole(role);

    // Fetch Fresh User Profile & Campuses
    try {
      const [profileRes, campusesData] = await Promise.all([
        authorizedFetch(API_ENDPOINTS.CURRENT_USER_PROFILE),
        getAllCampuses()
      ]);

      const campusList = Array.isArray(campusesData) ? campusesData : [];
      setCampuses(campusList);

      let userProfile = null;
      if (profileRes.ok) {
        userProfile = await profileRes.json();
        const existingData = getCurrentUser() || {};
        const mergedData = { ...existingData, ...userProfile };
        localStorage.setItem('sis_user', JSON.stringify(mergedData));
      } else {
        // Fallback to local storage
        userProfile = getCurrentUser();
      }

      // Process User Campus
      if (userProfile?.campus) {
        const cData = userProfile.campus;

        // Extract ID and Name - handle both object and ID-only cases
        const cId = typeof cData === 'object' ? cData.id : cData;
        // Try to find name in object, or look it up in campusList
        let cName = typeof cData === 'object' ? (cData.campus_name || cData.name) : '';

        if (!cName && cId) {
          const matched = campusList.find((c: any) => c.id == cId);
          if (matched) cName = matched.campus_name || matched.name;
        }

        if (cId) setUserCampusId(cId);
        if (cName) setUserCampus(cName);

        // Principal Logic
        if (role === 'principal' && cId) {
          // Find full object in campus list to get shift_available
          // Relaxed match: ID comparison
          const principalCampusObj = campusList.find((c: any) => c.id == cId);

          // Get Shift Availability
          // Default to 'morning' if not found or blank
          let shiftAvail = 'morning';
          if (principalCampusObj && principalCampusObj.shift_available) {
            shiftAvail = principalCampusObj.shift_available;
          } else if (typeof cData === 'object' && cData.shift_available) {
            shiftAvail = cData.shift_available;
          }

          setCampusShift(shiftAvail);

          // Auto-set filters
          setFilters(prev => ({
            ...prev,
            current_campus: cId.toString(),
            shift: (shiftAvail === 'morning' || shiftAvail === 'afternoon') ? shiftAvail : prev.shift
          }));

          // Fetch ALL Grades for this campus (don't restrict by shift here so they're available for filtering)
          try {
            const gradesData = await getGrades(undefined, cId);
            const gradesList = Array.isArray(gradesData) ? gradesData : (gradesData as any)?.results || [];

            setAllGrades(gradesList);
            setFilteredGrades(gradesList); // Initially show all for campus
          } catch (err) {
            console.error("Error fetching grades", err);
          }
        }
      }

    } catch (error) {
      console.error('Error initializing data:', error);
    }
  };


  const handleQuickFilter = (type: string, value?: string) => {
    switch (type) {
      case 'all':
        setFilters(prev => ({
          ...prev,
          ordering: 'sort_order',
          is_currently_active: '',
          shift: '',
          grade: '',
          gender: '',
          current_role_title: '',
          current_campus: userCampusId ? String(userCampusId) : ""
        }));
        setSearchQuery("");
        break;
      case 'alphabetical':
        setFilters(prev => ({ ...prev, ordering: prev.ordering === 'full_name' ? '-full_name' : 'full_name' }));
        break;
      case 'recent':
        setFilters(prev => ({ ...prev, ordering: '-joining_date' }));
        break;
      case 'gender':
        setFilters(prev => ({ ...prev, gender: value === 'all' ? '' : value || '' }));
        break;
    }
    setCurrentPage(1);
  };

  const fetchTeachers = async () => {
    setLoading(true);
    setError(null);

    try {
      const params: any = {
        page: currentPage,
        page_size: pageSize,
        search: searchQuery || undefined,
        current_campus: filters.current_campus ? parseInt(filters.current_campus) : undefined,
        shift: filters.shift || undefined,
        is_currently_active: filters.is_currently_active ? filters.is_currently_active === 'true' : undefined,
        current_subjects: filters.current_subjects || undefined,
        grade: filters.grade || undefined,
        gender: filters.gender || undefined,
        ordering: filters.ordering
      };

      // Map role filter to boolean flags
      if (filters.current_role_title === "Class Teacher") {
        params.is_class_teacher = true;
      } else if (filters.current_role_title === "Subject Teacher") {
        params.is_subject_teacher = true;
      } else if (filters.current_role_title === "Class + Subject") {
        params.is_class_teacher = true;
        params.is_subject_teacher = true;
      } else if (filters.current_role_title === "Assistant Teacher") {
        params.is_teacher_assistant = true;
      }

      // Checkbox filter for class teachers (overrides or combines)
      if (filters.is_class_teacher === 'true') {
        params.is_class_teacher = true;
      }

      const response: PaginationInfo = await getFilteredTeachers(params);

      setTeachers(response.results || []);
      setTotalCount(response.count || 0);
      setTotalPages(Math.ceil((response.count || 0) / pageSize));

    } catch (err: any) {
      console.error("Error fetching teachers:", err);
      setError(err.message || "Failed to load teachers");
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
      fetchTeachers();
      return;
    }

    // Set new timeout for debounced search
    const timeout = setTimeout(() => {
      fetchTeachers();
    }, 500);

    setSearchTimeout(timeout);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'shift') {
        next.grade = "";
      }
      return next;
    });
    setCurrentPage(1);
  };

  const clearFilters = () => {
    // For principal, keep their campus fixed
    if (userRole === 'principal' && userCampusId) {
      setFilters({
        current_campus: userCampusId.toString(),
        shift: campusShift === 'both' ? "" : campusShift,
        is_currently_active: "",
        is_class_teacher: "",
        current_subjects: "",
        grade: "",
        gender: "",
        current_role_title: "",
        ordering: "sort_order"
      });
    } else {
      setFilters({
        current_campus: "",
        shift: "",
        is_currently_active: "",
        is_class_teacher: "",
        current_subjects: "",
        grade: "",
        gender: "",
        current_role_title: "",
        ordering: "sort_order"
      });
    }

    setSearchQuery("");
    setCurrentPage(1);
  };


  const handleClearFiltersClick = () => {
    setIsClearing(true);
    try {
      clearFilters();
    } finally {
      setTimeout(() => setIsClearing(false), 700);
    }
  };

  const exportTeachersCSV = async () => {
    try {
      toast.info('Preparing full teachers list for download...');

      const params = {
        page: 1,
        page_size: 1000,
        search: searchQuery || undefined,
        current_campus: filters.current_campus ? parseInt(filters.current_campus) : undefined,
        shift: filters.shift || undefined,
        is_currently_active: filters.is_currently_active ? filters.is_currently_active === 'true' : undefined,
        is_class_teacher: filters.is_class_teacher ? filters.is_class_teacher === 'true' : undefined,
        current_subjects: filters.current_subjects || undefined,
        grade: filters.grade || undefined,
        gender: filters.gender || undefined,
        current_role_title: filters.current_role_title || undefined,
        ordering: filters.ordering
      };

      const response: PaginationInfo = await getFilteredTeachers(params);
      const allTeachers = response.results || [];

      if (!allTeachers.length) {
        toast.error('No teachers found to export');
        return;
      }

      const headers = [
        'Employee Code', 'Biometric ID', 'Full Name', 'Father Name', 'Gender', 'Date of Birth',
        'Contact Number', 'Email', 'CNIC', 'Marital Status',
        'Current Address', 'Permanent Address',
        'Education Level', 'Institution Name', 'Passing Year', 'Education Subjects', 'Education Grade',
        'Previous Institution', 'Previous Position', 'Experience From', 'Experience To', 'Total Exp Years',
        'Joining Date', 'Current Campus', 'Current Role', 'Shift', 'Assigned Classrooms', 'Coordinators',
        'Subjects Taught', 'Classes Taught', 'Extra Responsibilities', 'Role Start Date', 'Status'
      ];

      const rows = [headers.join(',')];

      allTeachers.forEach((t: any) => {
        rows.push([
          t.employee_code || 'N/A',
          t.biometric_id || 'N/A',
          `"${t.full_name || t.name || 'N/A'}"`,
          `"${t.father_name || 'N/A'}"`,
          t.gender || 'N/A',
          t.dob || 'N/A',
          `"${t.contact_number || 'N/A'}"`,
          t.email || 'N/A',
          t.cnic || 'N/A',
          t.marital_status || 'N/A',
          `"${t.current_address || 'N/A'}"`,
          `"${t.permanent_address || 'N/A'}"`,
          `"${t.education_level || 'N/A'}"`,
          `"${t.institution_name || 'N/A'}"`,
          t.year_of_passing || 'N/A',
          `"${t.education_subjects || 'N/A'}"`,
          t.education_grade || 'N/A',
          `"${t.previous_institution_name || 'N/A'}"`,
          `"${t.previous_position || 'N/A'}"`,
          t.experience_from_date || 'N/A',
          t.experience_to_date || 'N/A',
          t.total_experience_years || 'N/A',
          t.joining_date || 'N/A',
          `"${t.campus_name || t.current_campus_name || 'N/A'}"`,
          `"${t.current_role_title || 'N/A'}"`,
          t.shift ? t.shift.charAt(0).toUpperCase() + t.shift.slice(1) : 'N/A',
          `"${t.assigned_classrooms_display || t.assigned_classroom_names || 'N/A'}"`,
          `"${t.coordinator_names || 'N/A'}"`,
          `"${t.current_subjects || 'N/A'}"`,
          `"${t.current_classes_taught || 'N/A'}"`,
          `"${t.current_extra_responsibilities || 'N/A'}"`,
          t.role_start_date || 'N/A',
          t.is_currently_active ? 'Active' : 'Inactive'
        ].join(','));
      });

      const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      const dateStr = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `Teachers_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Downloaded ${allTeachers.length} teachers successfully!`);
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Failed to export teachers');
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
  const handleEdit = (teacher: Teacher) => {
    // TeacherEditForm loads the full record itself on open.
    setEditingTeacher(teacher);
    setShowEditDialog(true);
  };

  // Delete handler
  const handleDelete = async (teacher: Teacher) => {
    setConfirmConfig({
      open: true,
      title: "Confirm Deletion",
      description: `Are you sure you want to permanently delete ${teacher.full_name}? This action cannot be undone.`,
      actionLabel: "Delete User",
      variant: "destructive",
      onConfirm: async () => {
        try {
          const base = getApiBaseUrl();
          const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
          const res = await fetch(`${cleanBase}/api/teachers/${teacher.id}/`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('sis_access_token')}`,
            },
          });
          if (res.ok || res.status === 204) {
            toast.success('Teacher deleted successfully.');
            fetchTeachers();
          } else {
            const msg = await res.text();
            toast.error(`Failed to delete: ${res.status} ${msg}`);
          }
        } catch (err) {
          console.error('Delete teacher error:', err);
          toast.error('Error deleting teacher');
        }
      }
    });
  };

  // Toggle Active Status handler
  const handleToggleStatus = async (teacher: Teacher) => {
    const newStatus = !teacher.is_currently_active;
    try {
      const base = getApiBaseUrl();
      const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
      const res = await fetch(`${cleanBase}/api/teachers/${teacher.id}/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sis_access_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_currently_active: newStatus }),
      });

      if (res.ok) {
        toast.success(`Teacher ${teacher.full_name} successfully ${newStatus ? 'activated' : 'deactivated'}.`);
        fetchTeachers();
      } else {
        const msg = await res.text();
        toast.error(`Failed to update status: ${res.status} ${msg}`);
      }
    } catch (err) {
      console.error('Toggle status error:', err);
      toast.error('Error updating teacher status');
    }
  };

  // Columns definition for DataTable
  const columns = [
    {
      key: 'teacher_info',
      label: 'Teacher',
      icon: <User className="h-3 w-3 sm:h-4 sm:w-4" />,
      render: (teacher: Teacher) => (
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="flex-shrink-0">
            {teacher.photo ? (
              <img
                src={teacher.photo}
                alt={teacher.full_name}
                className="h-8 w-8 sm:h-10 sm:w-10 rounded-full object-cover border-2 border-[#a3cef1]/40"
                onError={(e) => {
                  const t = e.currentTarget as HTMLImageElement;
                  t.style.display = 'none';
                  const fb = t.nextElementSibling as HTMLElement;
                  if (fb) fb.style.display = 'flex';
                }}
              />
            ) : null}
            <div
              className="h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center bg-[#6096ba]"
              style={{ display: teacher.photo ? 'none' : 'flex' }}
            >
              <User className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs sm:text-sm font-semibold text-gray-900 flex items-center space-x-1 sm:space-x-2">
              <span className="truncate">{teacher.full_name}</span>
              {teacher.is_class_teacher && (
                <Award className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-500 flex-shrink-0" />
              )}
            </div>
            <div className="text-xs text-gray-500 flex items-center space-x-1">
              <span className="truncate max-w-[100px] sm:max-w-[150px]">
                {teacher.employee_code || 'N/A'}
              </span>
            </div>
          </div>
        </div>
      )
    },
    {
      key: 'classroom',
      label: 'Class',
      icon: <GraduationCap className="h-3 w-3 sm:h-4 sm:w-4" />,
      render: (teacher: Teacher) => (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center space-x-1 sm:space-x-2">
            <GraduationCap className="h-3 w-3 sm:h-4 sm:w-4 text-[#6096ba] flex-shrink-0" />
            <span className={cn(
              "text-xs sm:text-sm font-bold",
              teacher.classroom_name ? "text-gray-900" : "text-gray-400 italic font-normal"
            )}>
              {teacher.classroom_name || "No Classroom"}
            </span>
          </div>
          {teacher.shift && (
            <span className="inline-flex items-center gap-1 w-fit text-[10px] font-bold uppercase tracking-widest bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md">
              <Clock className="h-3 w-3" />
              {teacher.shift}
            </span>
          )}
        </div>
      )
    },
    {
      key: 'role',
      label: 'Role',
      icon: <Award className="h-3 w-3 sm:h-4 sm:w-4" />,
      render: (teacher: Teacher) => {
        const role = (teacher.current_role_title || (teacher.is_class_teacher ? 'Class Teacher' : '')).trim();
        if (!role) return <span className="text-xs text-gray-400 italic">—</span>;
        const lower = role.toLowerCase();
        let cls = 'bg-gray-100 text-gray-600';
        if (lower.includes('assistant')) cls = 'bg-amber-50 text-amber-700';
        else if (lower.includes('class') && lower.includes('subject')) cls = 'bg-purple-50 text-purple-700';
        else if (lower.includes('class')) cls = 'bg-[#6096ba]/10 text-[#274c77]';
        else if (lower.includes('subject')) cls = 'bg-indigo-50 text-indigo-700';
        return (
          <span className={cn("inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full", cls)}>
            {role}
          </span>
        );
      }
    },
    ...(userRole === 'org-admin' ? [{
      key: 'campus',
      label: 'Campus',
      icon: <MapPin className="h-3 w-3 sm:h-4 sm:w-4" />,
      render: (teacher: Teacher) => (
        <div className="flex items-center space-x-1 sm:space-x-2">
          <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-[#6096ba]" />
          <div className="min-w-0 flex-1">
            <div className="text-xs sm:text-sm font-bold text-gray-900 truncate">
              {teacher.campus_name || 'N/A'}
            </div>
            {teacher.coordinator_names && teacher.coordinator_names.length > 0 && (
              <div className="text-xs text-gray-600 truncate">
                Coord: {teacher.coordinator_names[0]}
              </div>
            )}
          </div>
        </div>
      )
    }] : []),
    {
      key: 'status',
      label: 'Status',
      icon: <div className="h-3 w-3 sm:h-4 sm:w-4 rounded-full bg-green-500"></div>,
      render: (teacher: Teacher) => {
        const canEdit = getPermissions(userRole).canEditTeacher;
        return (
          <div className="flex flex-col items-start gap-1.5">
            <span className={`inline-flex items-center px-2 sm:px-3 py-1 text-xs font-semibold rounded-full ${teacher.is_currently_active
              ? 'bg-green-100 text-green-800 border border-green-200'
              : 'bg-red-100 text-red-800 border border-red-200'
              }`}>
              <div className={`h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full mr-1 sm:mr-2 ${teacher.is_currently_active ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
              <span className="hidden sm:inline">{teacher.is_currently_active ? 'Active' : 'Inactive'}</span>
              <span className="sm:hidden">{teacher.is_currently_active ? 'A' : 'I'}</span>
            </span>
          </div>
        );
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      icon: <MoreVertical className="h-4 w-4" />,
      render: (teacher: Teacher) => {
        const canEdit = getPermissions(userRole).canEditTeacher;
        const canDelete = getPermissions(userRole).canDeleteTeacher;
        const canView = getPermissions(userRole).canViewTeachers;

        return (
          <div className="flex items-center justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {canView && (
                  <DropdownMenuItem onClick={() => router.push(`/admin/teachers/profile?id=${teacher.id}`)}>
                    <Eye className="mr-2 h-4 w-4 text-blue-600" />
                    <span>View Profile</span>
                  </DropdownMenuItem>
                )}
                {canEdit && (
                  <>
                    <DropdownMenuItem onClick={() => handleEdit(teacher)}>
                      <Edit className="mr-2 h-4 w-4 text-green-600" />
                      <span>Edit Profile</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleToggleStatus(teacher)}>
                      <RefreshCcw className={cn("mr-2 h-4 w-4", teacher.is_currently_active ? "text-orange-600" : "text-green-600")} />
                      <span>{teacher.is_currently_active ? 'Deactivate User' : 'Activate User'}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toast.info("Reset password functionality coming soon")}>
                      <Key className="mr-2 h-4 w-4 text-slate-600" />
                      <span>Reset Password</span>
                    </DropdownMenuItem>
                  </>
                )}
                {canDelete && (
                  <DropdownMenuItem onClick={() => handleDelete(teacher)} className="text-red-600">
                    <Trash className="mr-2 h-4 w-4" />
                    <span>Delete User</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      }
    }
  ];

  // Remove the full-screen loading spinner to allow the skeleton to show inside the DataTable

  return (
    <div className="w-full max-w-full overflow-hidden">
      <div className="mb-3 sm:mb-4 flex flex-row items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 sm:mb-2" style={{ color: '#274c77' }}>
            Teachers List
          </h1>
          {loading ? (
            <div className="h-4 w-48 bg-gray-200 animate-pulse rounded mt-2"></div>
          ) : (
            <p className="text-sm sm:text-base text-gray-600">
              Showing {teachers.length} of {totalCount} teachers
            </p>
          )}
        </div>
        <div className="flex-shrink-0">
          {getPermissions(userRole).canAddTeacher && (
            <Button
              onClick={() => router.push('/admin/teachers/add')}
              className="flex items-center gap-2 font-semibold shadow-sm hover:shadow-md transition-all duration-200 whitespace-nowrap"
              style={{ backgroundColor: '#274c77', color: 'white' }}
            >
              <Plus className="h-4 w-4" /> <span className="hidden xs:inline">Add New Teacher</span><span className="xs:hidden">Add</span>
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
                placeholder="Search by name, code..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full h-9 pl-9 pr-3 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2F6B8A]/20 focus:border-[#2F6B8A] transition-colors"
              />
            </div>
            {/* Filter Options icon — mobile only (non-principal: campus lives in advanced) */}
            {userRole !== 'principal' && (
              <button
                onClick={() => setShowAdvanced(v => !v)}
                title="Filter Options"
                className={`sm:hidden h-9 w-9 flex-shrink-0 flex items-center justify-center rounded-lg border transition-colors ${showAdvanced ? 'bg-[#2F6B8A]/10 text-[#274c77] border-[#2F6B8A]/30' : 'text-gray-600 bg-white border-gray-200'}`}
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Pills group — on mobile each stretches to share the row */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Grade (principal only) */}
            {userRole === 'principal' && (
              <div className="relative flex-1 sm:flex-none">
                <select
                  value={filters.grade}
                  onChange={(e) => handleFilterChange('grade', e.target.value)}
                  className="appearance-none w-full sm:w-auto h-9 pl-3 pr-8 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#2F6B8A]/20 cursor-pointer"
                >
                  <option value="">Grade</option>
                  {(() => {
                    // Prefer classroom-derived grades; fall back to the shift-filtered / all campus grades
                    const pool = filterGradeOptions.length > 0
                      ? filterGradeOptions
                      : (filteredGrades.length > 0 ? filteredGrades : allGrades);
                    const seen = new Set<string>();
                    return pool
                      .filter((g: any) => {
                        const n = (g.name || '').toLowerCase().trim();
                        if (!n || seen.has(n)) return false;
                        seen.add(n);
                        return true;
                      })
                      .map((grade: any) => (
                        <option key={grade.id} value={grade.id}>{grade.name}</option>
                      ));
                  })()}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            )}

            {/* Shift */}
            {userRole === 'principal' && (campusShift === 'morning' || campusShift === 'afternoon') ? (
              <div className="relative flex-1 sm:flex-none">
                <select
                  value={campusShift}
                  disabled
                  className="appearance-none w-full sm:w-auto h-9 pl-3 pr-8 text-sm rounded-lg border border-gray-200 bg-gray-100 text-gray-500 font-medium cursor-not-allowed"
                >
                  <option value={campusShift}>
                    {campusShift ? campusShift.charAt(0).toUpperCase() + campusShift.slice(1) : 'Shift'}
                  </option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300 pointer-events-none" />
              </div>
            ) : (
              <div className="relative flex-1 sm:flex-none">
                <select
                  value={filters.shift}
                  onChange={(e) => handleFilterChange('shift', e.target.value)}
                  className="appearance-none w-full sm:w-auto h-9 pl-3 pr-8 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#2F6B8A]/20 cursor-pointer"
                >
                  <option value="">Shift</option>
                  {(() => {
                    const campus = campuses.find(c => String(c.id ?? c.campus_id) === String(filters.current_campus));
                    const shiftAvailable = campus?.shift_available || 'both';
                    if (shiftAvailable === 'morning') return <option value="morning">Morning</option>;
                    if (shiftAvailable === 'afternoon') return <option value="afternoon">Afternoon</option>;
                    return (
                      <>
                        <option value="morning">Morning</option>
                        <option value="afternoon">Afternoon</option>
                        <option value="both">Both</option>
                      </>
                    );
                  })()}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            )}

            {/* Role */}
            <div className="relative flex-1 sm:flex-none">
              <select
                value={filters.current_role_title || ''}
                onChange={(e) => handleFilterChange('current_role_title', e.target.value)}
                className="appearance-none w-full sm:w-auto h-9 pl-3 pr-8 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#2F6B8A]/20 cursor-pointer"
              >
                <option value="">Role</option>
                <option value="Class Teacher">Class Teacher</option>
                <option value="Subject Teacher">Subject Teacher</option>
                <option value="Class + Subject">Class + Subject</option>
                <option value="Assistant Teacher">Assistant Teacher</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Gender */}
            <div className="relative flex-1 sm:flex-none">
              <select
                value={filters.gender}
                onChange={(e) => handleFilterChange('gender', e.target.value)}
                className="appearance-none w-full sm:w-auto h-9 pl-3 pr-8 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#2F6B8A]/20 cursor-pointer"
              >
                <option value="">Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Status */}
            <div className="relative flex-1 sm:flex-none">
              <select
                value={filters.is_currently_active}
                onChange={(e) => handleFilterChange('is_currently_active', e.target.value)}
                className="appearance-none w-full sm:w-auto h-9 pl-3 pr-8 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#2F6B8A]/20 cursor-pointer"
              >
                <option value="">All Status</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Right-side actions — Export/Filter Options/Clear on desktop */}
          <div className="flex items-center gap-2 sm:ml-auto">
            {['org-admin', 'principal'].includes(userRole) && (
              <button
                onClick={exportTeachersCSV}
                className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Download className="h-4 w-4" />
                <span>Export CSV</span>
              </button>
            )}

            {userRole !== 'principal' && (
              <button
                onClick={() => setShowAdvanced(v => !v)}
                className={`hidden sm:inline-flex items-center gap-1.5 h-9 px-3 text-sm font-semibold rounded-lg border transition-colors ${showAdvanced ? 'bg-[#2F6B8A]/10 text-[#274c77] border-[#2F6B8A]/30' : 'text-gray-600 bg-white border-gray-200 hover:bg-gray-50'}`}
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span>Filter Options</span>
              </button>
            )}

            <button
              onClick={handleClearFiltersClick}
              className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 text-sm font-semibold text-white bg-[#6096ba] hover:bg-[#274c77] rounded-lg transition-colors"
            >
              <RefreshCcw className={`h-4 w-4 transition-transform duration-500 ${isClearing ? 'rotate-[360deg]' : 'rotate-0'}`} />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Advanced filter options (collapsible) — Campus for non-principal */}
        {showAdvanced && userRole !== 'principal' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3 pt-3 border-t border-gray-100">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Campus</label>
              <select
                value={filters.current_campus}
                onChange={(e) => {
                  const val = e.target.value;
                  handleFilterChange('current_campus', val);
                  const campus = campuses.find(c => String(c.id ?? c.campus_id) === String(val));
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
          </div>
        )}
      </div>

      {/* Active filter chips */}
      {(() => {
        const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
        const chips: { key: string; label: string; onClear: () => void }[] = [];
        if (searchQuery) chips.push({ key: 'search', label: `"${searchQuery}"`, onClear: () => handleSearchChange('') });
        if (filters.grade && userRole === 'principal') {
          const g = [...filterGradeOptions, ...filteredGrades, ...allGrades].find((x: any) => String(x.id) === String(filters.grade));
          chips.push({ key: 'grade', label: g?.name || 'Grade', onClear: () => handleFilterChange('grade', '') });
        }
        if (filters.shift) chips.push({ key: 'shift', label: cap(filters.shift), onClear: () => handleFilterChange('shift', '') });
        if (filters.current_role_title) chips.push({ key: 'role', label: filters.current_role_title, onClear: () => handleFilterChange('current_role_title', '') });
        if (filters.gender) chips.push({ key: 'gender', label: cap(filters.gender), onClear: () => handleFilterChange('gender', '') });
        if (filters.is_currently_active) chips.push({ key: 'status', label: filters.is_currently_active === 'true' ? 'Active' : 'Inactive', onClear: () => handleFilterChange('is_currently_active', '') });
        if (filters.current_campus && userRole !== 'principal') {
          const c = campuses.find((x: any) => String(x.id) === String(filters.current_campus));
          chips.push({ key: 'campus', label: c?.campus_name || c?.name || 'Campus', onClear: () => handleFilterChange('current_campus', '') });
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
        showGender={false}
      />

      {/* Teachers Table - USING REUSABLE COMPONENT */}
      <DataTable
        data={teachers}
        columns={columns}
        isLoading={loading}
        emptyMessage="No teachers found"
        // RBAC handled inside columns for better UI control
        allowView={false}
        allowEdit={false}
        allowDelete={false}
      />

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

      {/* Edit Teacher Dialog */}
      <TeacherEditForm
        open={showEditDialog}
        teacher={editingTeacher as any}
        campuses={campuses}
        onOpenChange={(v) => {
          setShowEditDialog(v);
          if (!v) setEditingTeacher(null);
        }}
        onSaved={() => { fetchTeachers(); }}
      />

      {/* Confirmation Alert Dialog */}
      <AlertDialog
        open={confirmConfig.open}
        onOpenChange={(open) => setConfirmConfig((prev: any) => ({ ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmConfig.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmConfig.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmConfig.onConfirm}
              className={confirmConfig.variant === "destructive" ? "bg-red-600 hover:bg-red-700" : "bg-[#274c77] hover:bg-[#1a365d]"}
            >
              {confirmConfig.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}