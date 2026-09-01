'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AlertCircle, FileText, CheckCircle2, ChevronRight, X, User, Search, ChevronDown, GraduationCap, TrendingUp, Users } from 'lucide-react';
import { toast } from "sonner";
import { getFilteredStudents, promoteStudents, apiGet, getUserCampusId } from '@/lib/api';
import { TableSkeleton, Skeleton } from '@/components/ui/skeleton';

interface Student {
    id: number;
    student_id: string;
    student_code: string;
    name: string;
    father_name: string;
    last_class_passed: string | null;
    last_class_teacher: string | null;
    current_grade: string;
    section: string;
    campus: number;
    shift: string;
}

interface ClassroomsApiResponse {
    results?: Classroom[];
    count?: number;
}

interface Classroom {
    id: number;
    grade: number;
    grade_name: string;
    section: string;
    shift: string;
    class_teacher: number | null;
    class_teacher_name: string | null;
    campus_id: number;
}

// Grade progression — key is current, value is recommended next
const NEXT_GRADE_MAP: Record<string, string> = {
    'Nursery': 'KG-I',
    'KG-I': 'KG-II',
    'KG 1': 'KG-II',
    'KG-II': 'Grade 1',
    'KG 2': 'Grade 1',
    'Grade 1': 'Grade 2',
    'Grade 2': 'Grade 3',
    'Grade 3': 'Grade 4',
    'Grade 4': 'Grade 5',
    'Grade 5': 'Grade 6',
    'Grade 6': 'Grade 7',
    'Grade 7': 'Grade 8',
    'Grade 8': 'Grade 9',
    'Grade 9': 'Grade 10',
    'Grade 10': 'Grade 11',
};

const GRADE_ORDER = [
    'Nursery', 'KG-I', 'KG 1', 'KG-II', 'KG 2',
    'Grade 1', 'Grade I', 'Grade 2', 'Grade II', 'Grade 3', 'Grade III', 'Grade 4', 'Grade IV', 'Grade 5', 'Grade V',
    'Grade 6', 'Grade VI', 'Grade 7', 'Grade VII', 'Grade 8', 'Grade VIII', 'Grade 9', 'Grade IX', 'Grade 10', 'Grade X', 'Grade 11', 'Grade XI',
];

function areGradesEquivalent(g1: string, g2: string) {
    if (!g1 || !g2) return false;
    const s1 = g1.replace(/\s+/g, ' ').trim().toLowerCase();
    const s2 = g2.replace(/\s+/g, ' ').trim().toLowerCase();
    if (s1 === s2) return true;

    // Handle Grade 1 vs Grade I etc.
    const getCanonical = (s: string) => {
        const romanMap: any = { 'i': '1', 'ii': '2', 'iii': '3', 'iv': '4', 'v': '5', 'vi': '6', 'vii': '7', 'viii': '8', 'ix': '9', 'x': '10' };
        if (s.startsWith('grade ')) {
            const val = s.replace('grade ', '').trim();
            return `grade ${romanMap[val] || val}`;
        }
        if (s.startsWith('kg ')) {
            const val = s.replace('kg ', '').trim();
            return `kg-${romanMap[val] || val}`;
        }
        if (s.startsWith('kg-')) {
            const val = s.replace('kg-', '').trim();
            return `kg-${romanMap[val] || val}`;
        }
        return s;
    };

    return getCanonical(s1) === getCanonical(s2);
}

function gradeIndex(name: string) {
    const cleanName = name.replace(/\s+/g, ' ').trim();
    const i = GRADE_ORDER.findIndex(g => g.toLowerCase() === cleanName.toLowerCase());
    return i === -1 ? 99 : i;
}

function PromotionModal({
    selectedStudents,
    allStudents,
    currentGrade,
    allClassrooms,
    classroomsLoading,
    promoting,
    onConfirm,
    onClose,
}: {
    selectedStudents: number[];
    allStudents: Student[];
    currentGrade: string;
    allClassrooms: Classroom[];
    classroomsLoading: boolean;
    promoting: boolean;
    onConfirm: (classroomId: number) => void;
    onClose: () => void;
}) {
    const [expandedGrade, setExpandedGrade] = useState<string | null>(null);
    const [selectedClassroom, setSelectedClassroom] = useState<number | null>(null);
    const [selectedLabel, setSelectedLabel] = useState<string>('');

    // Recommended next grade lookup
    const recommendedGrade = useMemo(() => {
        // Try exact match first
        if (NEXT_GRADE_MAP[currentGrade]) return NEXT_GRADE_MAP[currentGrade];
        // Try finding equivalent grade in map keys
        const equivalentKey = Object.keys(NEXT_GRADE_MAP).find(k => areGradesEquivalent(k, currentGrade));
        return equivalentKey ? NEXT_GRADE_MAP[equivalentKey] : '';
    }, [currentGrade]);

    // Group classrooms by grade name, sorted by grade order
    const gradeGroups = useMemo(() => {
        const map: Record<string, Classroom[]> = {};
        const userCampusId = getUserCampusId();

        allClassrooms.forEach(c => {
            const g = c.grade_name;
            if (!g) return;

            // STRICT CAMPUS FILTER 
            const roomCampusId = c.campus_id;
            if (userCampusId && Number(roomCampusId) !== Number(userCampusId)) return;

            // PROMOTION FILTER: Show ONLY future grades
            // This hides previous grades AND current grade (KG-II)
            const currentIdx = gradeIndex(currentGrade);
            const thisIdx = gradeIndex(g);

            if (thisIdx <= currentIdx) return; // SKIP previous and current grades

            if (!map[g]) map[g] = [];
            map[g].push(c);
        });

        return Object.entries(map).sort(([a], [b]) => {
            const aIsRec = areGradesEquivalent(a, recommendedGrade);
            const bIsRec = areGradesEquivalent(b, recommendedGrade);
            if (aIsRec && !bIsRec) return -1;
            if (!aIsRec && bIsRec) return 1;
            return gradeIndex(a) - gradeIndex(b);
        });
    }, [allClassrooms, recommendedGrade, currentGrade]);

    const handleGradeClick = (gradeName: string) => {
        setExpandedGrade(prev => prev === gradeName ? null : gradeName);
        // reset classroom selection when switching grade
        setSelectedClassroom(null);
        setSelectedLabel('');
    };

    const handleClassroomSelect = (classroom: Classroom) => {
        setSelectedClassroom(classroom.id);
        setSelectedLabel(`${classroom.grade_name} — Section ${classroom.section}`);
    };

    const selectedStudentNames = allStudents.filter(s => selectedStudents.includes(s.id));

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">

                {/* Modal Header */}
                <div className="bg-[#274c77] text-white px-6 py-5 rounded-t-2xl flex-shrink-0">
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-xl font-bold">Promote Students</h2>
                            <p className="text-[#a3cef1] mt-0.5 text-sm">
                                Moving <strong className="text-white">{selectedStudents.length}</strong> student(s) from{' '}
                                <strong className="text-white">{currentGrade}{selectedStudentNames[0]?.section ? ` — ${selectedStudentNames[0].section}` : ''}</strong>
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors mt-0.5 flex-shrink-0"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Selected students chips */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                        {selectedStudentNames.slice(0, 6).map(s => (
                            <span key={s.id} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/15 text-white text-xs font-medium">
                                {s.name}
                            </span>
                        ))}
                        {selectedStudentNames.length > 6 && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/10 text-[#a3cef1] text-xs">
                                +{selectedStudentNames.length - 6} more
                            </span>
                        )}
                    </div>
                </div>

                {/* Selected target indicator */}
                {selectedLabel && (
                    <div className="flex-shrink-0 px-5 pt-4">
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-[#a3cef1]/15 border border-[#a3cef1]/40 rounded-xl text-sm text-[#274c77] font-semibold">
                            <svg className="w-4 h-4 text-[#6096ba] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Target: <span className="text-[#274c77]">{selectedLabel}</span>
                        </div>
                    </div>
                )}

                {/* Grade List — scrollable */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                        Select Target Grade & Section
                    </p>

                    {classroomsLoading && (
                        <div className="text-center py-10">
                            <div className="relative w-10 h-10 mx-auto mb-3">
                                <div className="w-10 h-10 rounded-full border-4 border-[#a3cef1]" />
                                <div className="w-10 h-10 rounded-full border-4 border-t-[#274c77] animate-spin absolute inset-0" />
                            </div>
                            <p className="text-[#274c77] font-medium text-sm">Loading classrooms...</p>
                        </div>
                    )}

                    {!classroomsLoading && gradeGroups.length === 0 && (
                        <div className="text-center py-10 text-gray-400">
                            <p className="font-medium">No classrooms found in database.</p>
                            <p className="text-sm mt-1">Please check if classrooms exist in Admin panel.</p>
                        </div>
                    )}

                    {gradeGroups.map(([gradeName, classrooms]) => {
                        const isRecommended = areGradesEquivalent(gradeName, recommendedGrade);
                        const isExpanded = expandedGrade === gradeName;
                        const hasSelectedInThis = classrooms.some(c => c.id === selectedClassroom);

                        // Sort sections alphabetically
                        const sortedClassrooms = [...classrooms].sort((a, b) => a.section.localeCompare(b.section));

                        return (
                            <div key={gradeName} className={`rounded-xl border-2 overflow-hidden transition-all duration-200 ${hasSelectedInThis
                                ? 'border-[#274c77]'
                                : isExpanded
                                    ? 'border-[#6096ba]/40'
                                    : 'border-gray-100 hover:border-[#a3cef1]/60'
                                }`}>
                                {/* Grade Row */}
                                <button
                                    onClick={() => handleGradeClick(gradeName)}
                                    className={`w-full flex items-center justify-between px-4 py-3 transition-all ${hasSelectedInThis
                                        ? 'bg-[#274c77] text-white'
                                        : isExpanded
                                            ? 'bg-[#a3cef1]/15 text-[#274c77]'
                                            : 'bg-white text-gray-700 hover:bg-gray-50'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        {/* Grade icon */}
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${hasSelectedInThis
                                            ? 'bg-white/20 text-white'
                                            : isRecommended
                                                ? 'bg-[#274c77] text-white'
                                                : 'bg-gray-100 text-gray-500'
                                            }`}>
                                            {gradeIndex(gradeName) + 1}
                                        </div>

                                        <div className="text-left">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-sm">{gradeName}</span>
                                                {isRecommended && (
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${hasSelectedInThis
                                                        ? 'bg-white/20 text-white'
                                                        : 'bg-[#274c77] text-white'
                                                        }`}>
                                                        ⭐ Recommended
                                                    </span>
                                                )}
                                            </div>
                                            <div className={`text-xs mt-0.5 ${hasSelectedInThis ? 'text-white/70' : 'text-gray-400'}`}>
                                                {sortedClassrooms.length} section{sortedClassrooms.length !== 1 ? 's' : ''} available
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {hasSelectedInThis && (
                                            <span className="text-xs text-white/80 font-medium">
                                                Section {classrooms.find(c => c.id === selectedClassroom)?.section}
                                            </span>
                                        )}
                                        <svg
                                            className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''} ${hasSelectedInThis ? 'text-white' : 'text-gray-400'
                                                }`}
                                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </button>

                                {/* Sections Dropdown */}
                                {isExpanded && (
                                    <div className="border-t border-gray-100 bg-gray-50">
                                        {sortedClassrooms.map(classroom => {
                                            const isSelected = selectedClassroom === classroom.id;
                                            return (
                                                <button
                                                    key={classroom.id}
                                                    onClick={() => handleClassroomSelect(classroom)}
                                                    className={`w-full flex items-center justify-between px-5 py-3 transition-all hover:bg-[#a3cef1]/15 border-b border-gray-100 last:border-b-0 ${isSelected ? 'bg-[#a3cef1]/20' : ''
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center font-bold text-sm transition-all ${isSelected
                                                            ? 'bg-[#274c77] border-[#274c77] text-white'
                                                            : 'bg-white border-gray-200 text-gray-500'
                                                            }`}>
                                                            {classroom.section}
                                                        </div>
                                                        <div className="text-left">
                                                            <div className="text-sm font-semibold text-[#274c77]">
                                                                Section {classroom.section}
                                                            </div>
                                                            <div className="text-xs text-gray-400 flex items-center gap-2">
                                                                <span>👨‍🏫 {classroom.class_teacher_name || 'No teacher'}</span>
                                                                <span>•</span>
                                                                <span>⏰ {classroom.shift}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {isSelected && (
                                                        <div className="w-5 h-5 rounded-full bg-[#274c77] flex items-center justify-center flex-shrink-0">
                                                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Footer Buttons */}
                <div className="flex gap-3 px-5 pb-5 pt-3 flex-shrink-0 border-t border-gray-100">
                    <button
                        onClick={onClose}
                        disabled={promoting}
                        className="flex-1 px-6 py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => selectedClassroom && onConfirm(selectedClassroom)}
                        disabled={!selectedClassroom || promoting}
                        className={`flex-1 px-6 py-3 rounded-xl font-semibold text-white transition-all ${!selectedClassroom || promoting
                            ? 'bg-gray-300 cursor-not-allowed'
                            : 'bg-[#274c77] hover:bg-[#1e3a5f] shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]'
                            }`}
                    >
                        {promoting ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Promoting...
                            </span>
                        ) : selectedClassroom ? (
                            `✓ Confirm Promotion (${selectedStudents.length} students)`
                        ) : (
                            'Select a Section to Continue'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function PromotionManagementPage() {
    const [students, setStudents] = useState<Student[]>([]);
    const [allClassrooms, setAllClassrooms] = useState<Classroom[]>([]);
    const [classroomsLoading, setClassroomsLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [promoting, setPromoting] = useState(false);
    const [activeGradeTab, setActiveGradeTab] = useState<string>('');
    const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeSection, setActiveSection] = useState('E');
    const [showPromotionModal, setShowPromotionModal] = useState(false);

    useEffect(() => { fetchStudents(); }, [activeSection]);

    useEffect(() => {
        const grades = getUniqueGrades();
        if (grades.length > 0 && !activeGradeTab) setActiveGradeTab(grades[0]);
    }, [students]);

    useEffect(() => {
        setSelectedStudents([]);
        setSearchQuery('');
    }, [activeGradeTab]);

    const fetchStudents = async () => {
        try {
            setLoading(true);
            const campusId = getUserCampusId();
            console.log('Fetching students for Promotion page. Filtering by campusId:', campusId, 'section:', activeSection);

            // Filter by selected section AND campus if available
            const filterParams: any = { section: activeSection, page_size: 500 };
            if (campusId) filterParams.campus = campusId;

            const studentsRes = await getFilteredStudents(filterParams);
            setStudents(studentsRes.results as Student[]);
        } catch (error) {
            console.error('Error fetching students:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchClassrooms = async (): Promise<Classroom[]> => {
        try {
            setClassroomsLoading(true);
            const allClassroomsList: Classroom[] = [];

            // Get campus ID from profile or fall back to students on page
            const campusId = getUserCampusId() || (students.length > 0 ? students[0].campus : null);
            console.log('Context Campus ID for filtering:', campusId);

            // Backend expects 'campus_id' as query parameter
            let path: string | null = `/api/classrooms/?page_size=100${campusId ? `&campus_id=${campusId}` : ''}`;

            while (path) {
                console.log('Fetching classrooms from path:', path);
                const data: any = await apiGet(path);
                console.log('Classrooms API data chunk:', data);

                if (Array.isArray(data)) {
                    const filtered = campusId
                        ? data.filter((c: any) => c.campus_id === campusId)
                        : data;
                    allClassroomsList.push(...filtered);
                    break;
                } else if (data && data.results && Array.isArray(data.results)) {
                    // Safety check: ensure we only add classrooms for the current campus
                    const filtered = campusId
                        ? data.results.filter((c: any) => c.campus_id === campusId)
                        : data.results;

                    allClassroomsList.push(...filtered);
                    console.log(`Added ${filtered.length} matching classrooms. Current total for this campus: ${allClassroomsList.length}`);

                    if (data.next) {
                        try {
                            const url = new URL(data.next);
                            path = url.pathname + url.search;
                        } catch {
                            path = data.next.startsWith('/') ? data.next : null;
                        }
                    } else {
                        path = null;
                    }
                } else {
                    console.warn('Unexpected data format from classrooms API:', data);
                    break;
                }
            }

            console.log('Final classrooms count for this campus:', allClassroomsList.length);
            setAllClassrooms(allClassroomsList);
            return allClassroomsList;
        } catch (error) {
            console.error('Error fetching classrooms:', error);
            return [];
        } finally {
            setClassroomsLoading(false);
        }
    };

    const getUniqueGrades = (): string[] => {
        const grades = new Set<string>();
        students.forEach(s => { if (s.current_grade) grades.add(s.current_grade); });
        return Array.from(grades).sort((a, b) => gradeIndex(a) - gradeIndex(b));
    };

    const filteredStudents = useMemo(() => {
        let list = students;
        if (activeGradeTab) list = list.filter(s => s.current_grade === activeGradeTab);
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(s =>
                s.name.toLowerCase().includes(q) ||
                s.student_id?.toLowerCase().includes(q) ||
                s.student_code?.toLowerCase().includes(q) ||
                s.father_name?.toLowerCase().includes(q)
            );
        }
        return list;
    }, [students, activeGradeTab, searchQuery]);

    const handleSelectAll = () => {
        setSelectedStudents(
            selectedStudents.length === filteredStudents.length
                ? []
                : filteredStudents.map(s => s.id)
        );
    };

    const handleSelectStudent = (id: number) => {
        setSelectedStudents(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const openPromotionModal = async () => {
        if (selectedStudents.length === 0) return;
        // Reset and set loading before opening modal to avoid "No classrooms" flash
        setAllClassrooms([]);
        setClassroomsLoading(true);
        setShowPromotionModal(true);
        await fetchClassrooms();
    };

    const handlePromote = async (classroomId: number) => {
        const toastId = toast.loading(`Promoting ${selectedStudents.length} student(s)...`);
        try {
            setPromoting(true);
            const response = await promoteStudents({
                student_ids: selectedStudents,
                target_classroom_id: classroomId,
            });
            toast.success(response.message || 'Students promoted successfully!', { id: toastId });
            setShowPromotionModal(false);
            setSelectedStudents([]);
            fetchStudents();
        } catch (error: any) {
            toast.error(error.message || 'Failed to promote students.', { id: toastId });
        } finally {
            setPromoting(false);
        }
    };

    const grades = getUniqueGrades();



    return (
        <div className="space-y-5 w-full max-w-full overflow-x-hidden">

            {/* Header */}
            <div className="flex flex-row items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold" style={{ color: '#274c77' }}>
                        Student Promotion Management
                    </h1>
                    <p className="text-gray-600 text-sm sm:text-base mt-1">
                        Manage students in Section {activeSection} and promote them to the next grade
                    </p>
                </div>
                <div className="flex items-center gap-2.5 flex-shrink-0">
                    {/* Section filter */}
                    <div className="relative">
                        <select
                            value={activeSection}
                            onChange={(e) => setActiveSection(e.target.value)}
                            className="appearance-none h-11 pl-3 pr-9 text-sm font-semibold rounded-xl border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2F6B8A]/20 cursor-pointer shadow-sm"
                        >
                            {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(s => (
                                <option key={s} value={s}>Section {s}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>
                    {/* Stat card */}
                    <div className="flex items-center gap-2.5 bg-white rounded-xl border border-gray-100 shadow-sm px-4 h-11">
                        <TrendingUp className="h-4 w-4 text-[#6096ba]" />
                        {loading ? (
                            <div className="h-5 w-8 bg-gray-200 animate-pulse rounded" />
                        ) : (
                            <span className="text-xl font-black text-[#274c77] leading-none">{students.length}</span>
                        )}
                        <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide leading-tight">Ready for<br />Promotion</span>
                    </div>
                </div>
            </div>

            {grades.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-16 text-center">
                    <div className="w-20 h-20 rounded-full bg-[#a3cef1]/20 flex items-center justify-center mx-auto mb-4">
                        <GraduationCap className="w-10 h-10 text-[#6096ba]" />
                    </div>
                    <h3 className="text-xl font-bold text-[#274c77] mb-2">No Students in Section {activeSection}</h3>
                    <p className="text-gray-400">Students will appear here after they are assigned to Section {activeSection} or passed their exams.</p>
                </div>
            ) : (
                <>
                    {/* Grade Tabs */}
                    <div className="flex flex-wrap gap-2">
                        {grades.map(grade => {
                            const count = students.filter(s => s.current_grade === grade).length;
                            const isActive = activeGradeTab === grade;
                            return (
                                <button
                                    key={grade}
                                    onClick={() => setActiveGradeTab(grade)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm border transition-all duration-200 ${isActive
                                        ? 'bg-[#274c77] text-white border-[#274c77] shadow-sm'
                                        : 'bg-white text-gray-600 border-gray-200 hover:border-[#6096ba]/50 hover:text-[#274c77]'
                                        }`}
                                >
                                    {grade}
                                    {loading ? (
                                        <Skeleton className="h-4 w-6 rounded-full" />
                                    ) : (
                                        <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                                            }`}>
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Active Grade Panel */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden w-full max-w-full">

                        {/* Panel Toolbar (light) */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 border-b border-gray-100">
                            <div className="min-w-0">
                                <h3 className="text-base sm:text-lg font-bold text-[#274c77] truncate">
                                    {activeGradeTab} — Section {activeSection}
                                </h3>
                                {loading ? (
                                    <Skeleton className="h-4 w-44 mt-0.5" />
                                ) : (
                                    <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
                                        {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''} ready for promotion
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Search */}
                                <div className="relative flex-1 sm:flex-none">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    <input
                                        type="text"
                                        placeholder="Search students..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="w-full sm:w-56 h-9 pl-9 pr-3 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2F6B8A]/20 focus:border-[#2F6B8A] transition-colors"
                                    />
                                </div>
                                {/* Promote Button */}
                                <button
                                    onClick={openPromotionModal}
                                    disabled={selectedStudents.length === 0}
                                    className={`flex items-center gap-2 h-9 px-4 rounded-lg font-semibold text-sm whitespace-nowrap transition-all ${selectedStudents.length > 0
                                        ? 'bg-[#274c77] text-white hover:bg-[#1e3a5f] shadow-sm'
                                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        }`}
                                >
                                    <TrendingUp className="w-4 h-4" />
                                    <span className="hidden xs:inline">Promote</span> ({selectedStudents.length})
                                </button>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto w-full">
                            {loading ? (
                                <div className="p-6">
                                    <TableSkeleton rows={10} />
                                </div>
                            ) : (
                                <table className="w-full border-separate border-spacing-0">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-100">
                                            <th className="px-5 py-3 text-left">
                                                <input
                                                    type="checkbox"
                                                    checked={filteredStudents.length > 0 && selectedStudents.length === filteredStudents.length}
                                                    onChange={handleSelectAll}
                                                    className="w-4 h-4 rounded border-gray-300 text-[#274c77] focus:ring-[#6096ba]"
                                                />
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Student</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Father Name</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Previous Class</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Previous Teacher</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Current (Staging)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredStudents.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="px-5 py-16 text-center text-gray-400">
                                                    <Users className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                                                    <p className="font-medium text-[#274c77]">No students found</p>
                                                    <p className="text-sm">No {activeGradeTab} students in Section {activeSection} yet</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredStudents.map((student, index) => {
                                                const isSelected = selectedStudents.includes(student.id);
                                                return (
                                                    <tr
                                                        key={student.id}
                                                        onClick={() => handleSelectStudent(student.id)}
                                                        className={`cursor-pointer transition-colors border-b border-gray-50 hover:bg-gray-50/70 ${isSelected ? 'bg-[#f4f7ff]' : ''}`}
                                                    >
                                                        <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => handleSelectStudent(student.id)}
                                                                className="w-4 h-4 rounded border-gray-300 text-[#274c77] focus:ring-[#6096ba]"
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-400 font-mono">{index + 1}</td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-9 h-9 rounded-full bg-[#6096ba] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                                                    {student.name.charAt(0).toUpperCase()}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="font-semibold text-gray-900 text-sm truncate">{student.name}</div>
                                                                    <div className="text-xs text-gray-400 font-mono">{student.student_code || student.student_id}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-600">{student.father_name || '—'}</td>
                                                        <td className="px-4 py-3">
                                                            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-gray-100 text-gray-600 text-xs font-semibold">
                                                                {student.last_class_passed || 'N/A'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-600">{student.last_class_teacher || '—'}</td>
                                                        <td className="px-4 py-3">
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#6096ba]/10 text-[#274c77] text-xs font-bold">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-[#6096ba]" />
                                                                {student.current_grade} — {student.section || activeSection}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Table Footer */}
                        {filteredStudents.length > 0 && (
                            <div className="px-4 sm:px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                                <span className="text-xs text-gray-500">
                                    {selectedStudents.length > 0
                                        ? `${selectedStudents.length} of ${filteredStudents.length} selected`
                                        : `${filteredStudents.length} students in ${activeGradeTab} — Section ${activeSection}`
                                    }
                                </span>
                                {selectedStudents.length > 0 && (
                                    <button
                                        onClick={() => setSelectedStudents([])}
                                        className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                                    >
                                        Clear Selection
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Promotion Modal */}
            {showPromotionModal && (
                <PromotionModal
                    selectedStudents={selectedStudents}
                    allStudents={students}
                    currentGrade={activeGradeTab}
                    allClassrooms={allClassrooms}
                    classroomsLoading={classroomsLoading}
                    promoting={promoting}
                    onConfirm={handlePromote}
                    onClose={() => setShowPromotionModal(false)}
                />
            )}
        </div>
    );
}
