import React from 'react';
import { Result, Student, SubjectMark } from '@/lib/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface RetestResultEntry {
    subject_name: string;
    exam_type: string;
    month?: string;
    marks_obtained: number;
    total_marks: number;
    is_absent: boolean;
    pass_status: string;
    original_result_id?: number;
}

interface ReportCardProps {
    student: Student;
    results: Result[];
    activeMonth?: string;
    className?: string;
    retestResults?: RetestResultEntry[];
}

export function ReportCard({ student, results, activeMonth, className, retestResults = [] }: ReportCardProps) {

    // Campus logo for the report card — uses the campus's uploaded photo/logo,
    // falling back to the default Newton logo when the campus hasn't set one.
    const campusLogo = (() => {
        const p = (student as any)?.campus_data?.campus_photo;
        if (!p) return "/Newton.png";
        if (p.startsWith('http://') || p.startsWith('https://')) return p;
        const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';
        return `${apiBase}${p.startsWith('/') ? '' : '/'}${p}`;
    })();

    // Helper: find approved retest — matches rawName (db key) case-insensitively
    const getRetest = (rawSubjectName: string, examType: string, month?: string) => {
        if (!retestResults?.length) return undefined;
        const needle = rawSubjectName?.toLowerCase().trim();
        return retestResults.find(rt =>
            rt.subject_name?.toLowerCase().trim() === needle &&
            rt.exam_type === examType &&
            (!month || rt.month?.toLowerCase().trim() === month?.toLowerCase().trim())
        );
    };

    // Pivot data
    const subjectsMap = new Map<string, {
        name: string;
        rawName: string; // raw subject_name key — used for retest matching
        monthly: { [key: string]: number };
        monthlyTotal: { [key: string]: number }; // per-month total marks (variable, e.g. 25 or 20)
        monthlyAbsent: { [key: string]: boolean };
        midTermObt: number;
        midTermTotal: number;
        midTermAbsent: boolean;
        finalTermObt: number;
        finalTermTotal: number;
        finalTermAbsent: boolean;
        inMid: boolean;
        inFinal: boolean;
        grade: string;
    }>();

    const getSubjectEntry = (key: string, displayName: string) => {
        if (!subjectsMap.has(key)) {
            subjectsMap.set(key, {
                name: displayName,
                rawName: key,
                monthly: {},
                monthlyTotal: {},
                monthlyAbsent: {},
                midTermObt: 0,
                midTermTotal: 0,
                midTermAbsent: false,
                finalTermObt: 0,
                finalTermTotal: 0,
                finalTermAbsent: false,
                inMid: false,
                inFinal: false,
                grade: '-'
            });
        }
        return subjectsMap.get(key)!;
    };

    // Sort results by ID descending to ensure we find the most recent ones first
    const sortedResults = [...results].sort((a, b) => b.id - a.id);
    const midTermResult = sortedResults.find(r => r.exam_type === 'midterm');
    const finalTermResult = sortedResults.find(r => r.exam_type === 'final');

    results.forEach(result => {
        result.subject_marks.forEach(mark => {
            // Use subject_name as the canonical grouping key so marks for the
            // same subject are merged even when variant differs across exam types.
            const key = mark.subject_name;
            const displayName = mark.variant || mark.subject_name;
            const entry = getSubjectEntry(key, displayName);

            if (result.exam_type === 'monthly') {
                const rawMonth = (result as any).month || 'Unknown';
                const month = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1).toLowerCase();
                entry.monthly[month] = mark.obtained_marks ?? 0;
                entry.monthlyTotal[month] = mark.total_marks || 25;
                entry.monthlyAbsent[month] = !!(mark.is_absent || (mark as any).original_status === 'absent');
            } else if (result.exam_type === 'midterm') {
                entry.midTermObt = mark.obtained_marks ?? 0;
                entry.midTermTotal = mark.total_marks;
                entry.midTermAbsent = !!(mark.is_absent || (mark as any).original_status === 'absent');
                entry.inMid = true;
            } else if (result.exam_type === 'final') {
                entry.finalTermObt = mark.obtained_marks ?? 0;
                entry.finalTermTotal = mark.total_marks;
                entry.finalTermAbsent = !!(mark.is_absent || (mark as any).original_status === 'absent');
                entry.inFinal = true;
                if (mark.grade) entry.grade = mark.grade;
            }
        });
    });

    const activeSubjects = Array.from(subjectsMap.values());
    const termFilteredSubjects = activeSubjects.filter(s => s.inMid || s.inFinal);

    // Helper for name formatting
    const formatName = (name: string) => name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    // Academic year helper: academic year runs April -> March.
    // If `academicYear` is provided (from the server `Result.academic_year`), normalize and prefer it.
    const getAcademicYear = (monthName?: string, academicYear?: string) => {
        const normalize = (ay: string | undefined | null) => {
            if (!ay) return null;
            const v = ay.trim();
            // Already full form YYYY-YYYY or YYYY/YYYY
            if (/^\d{4}[-\/]\d{4}$/.test(v)) return v.replace('/', '-');
            // Single year YYYY
            if (/^\d{4}$/.test(v)) {
                const s = parseInt(v, 10);
                return `${s}-${s + 1}`;
            }
            // Two-digit like '25' -> 2025-2026
            if (/^\d{1,2}$/.test(v)) {
                const s = 2000 + parseInt(v, 10);
                return `${s}-${s + 1}`;
            }
            // Short range like '25-26' or '25/26'
            if (/^\d{1,2}[-\/]\d{1,2}$/.test(v)) {
                const [a, b] = v.split(/[-\/]/).map(x => parseInt(x, 10));
                const sa = a < 100 ? 2000 + a : a;
                const sb = b < 100 ? 2000 + b : b;
                return `${sa}-${sb}`;
            }
            // Mixed like '2025-26' -> expand
            if (/^\d{4}[-\/]\d{1,2}$/.test(v)) {
                const [a, b] = v.split(/[-\/]/);
                const sa = parseInt(a, 10);
                let sb = parseInt(b, 10);
                if (sb < 100) sb = 2000 + sb;
                return `${sa}-${sb}`;
            }
            return v;
        };

        const normalized = normalize(academicYear);
        if (normalized) return normalized;

        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        let now = new Date();
        let monthIndex = now.getMonth();
        if (monthName) {
            const lower = monthName.toLowerCase();
            const idx = months.findIndex(m => m.toLowerCase() === lower || m.substring(0, 3).toLowerCase() === lower.substring(0, 3));
            if (idx !== -1) monthIndex = idx;
        }
        const currentYear = now.getFullYear();
        // If month is April (3) or later, academic year starts this year.
        const startYear = monthIndex >= 3 ? currentYear : currentYear - 1;
        const endYear = startYear + 1;
        return `${startYear}-${endYear}`;
    };

    // Get the result for the active month (for teacher remarks and attendance)
    const monthlyResult = activeMonth
        ? results.find(r => {
            if (r.exam_type !== 'monthly') return false;
            const rMonth = (r as any).month?.toLowerCase() || '';
            const aMonth = activeMonth.toLowerCase();
            return rMonth === aMonth || rMonth.startsWith(aMonth) || aMonth.startsWith(rMonth);
        })
        : null;

    if (activeMonth) {
        return (
            <div className="min-h-screen flex items-start justify-center pt-6 pb-6 print:flex print:print-viewport print:items-center print:justify-center print:py-0">
                <div className={`report-root relative bg-white p-8 w-full max-w-[210mm] min-h-[297mm] flex flex-col mx-auto text-black print:p-4 print:min-h-[285mm] print:max-w-none print:mx-0 print:!bg-white ${className}`}>
                    <style dangerouslySetInnerHTML={{
                        __html: `
                        @media print {
                            @page { size: A4 portrait; margin: 5mm; }
                            .print-viewport { display: block !important; padding: 0 !important; margin: 0 !important; }
                            html, body { margin: 0 !important; padding: 0 !important; background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                            .print-bg-blue { background-color: #274c77 !important; color: white !important; }
                            .print-bg-green { background-color: #f0fdf4 !important; }
                            .blurred-col { display: none !important; }
                            .report-root {
                                page-break-inside: avoid !important;
                                page-break-after: avoid !important;
                                padding: 5mm 8mm !important;
                                margin: 0 auto !important;
                                max-width: 100% !important;
                                font-size: 11px !important;
                                height: 284mm !important;
                            }
                            .report-root table { font-size: 10px !important; }
                            .report-root td, .report-root th { padding: 3px 5px !important; }
                            .report-root h1 { font-size: 16px !important; }
                            .report-root h3 { font-size: 10px !important; }
                            .report-root .text-3xl { font-size: 16px !important; }
                            .report-root .text-sm { font-size: 10px !important; }
                            .report-root .mb-8 { margin-bottom: 6px !important; }
                            .report-root .mb-6 { margin-bottom: 4px !important; }
                            .report-root .mb-10 { margin-bottom: 6px !important; }
                            .report-root .p-8 { padding: 6px !important; }
                            .report-root .p-4 { padding: 4px !important; }
                            .report-root .gap-8 { gap: 8px !important; }
                            .report-root .gap-6 { gap: 6px !important; }
                            .report-root .mt-6 { margin-top: 4px !important; }
                            .report-root .mt-2 { margin-top: 2px !important; }
                            .report-root .pb-6 { padding-bottom: 4px !important; }
                            .report-root .px-24 { padding-left: 80px !important; padding-right: 80px !important; }
                            .report-root .min-h-\\[80px\\] { min-height: 40px !important; }
                            .report-root .h-12 { height: 32px !important; }
                            .report-root .h-24, .report-root .print\\:h-20 { height: 48px !important; width: 48px !important; }
                            .report-title-pill { background-color: #274c77 !important; color: #fff !important; }
                        }
                        .report-root { page-break-inside: avoid; }
                    `}} />

                    

                    {/* Header */}
                    <div className="relative text-center border-b-2 border-[#274c77] pb-6 mb-6 px-24">
                        <div className="absolute left-0 top-0 h-24 w-24 print:h-20 print:w-20"><img src={campusLogo} alt="Logo" className="h-full w-full object-contain" /></div>
                        <div className="w-full text-center">
                            <h1 className="text-3xl font-bold text-[#274c77] uppercase tracking-wider mx-auto">
                                {student.campus_name?.toLowerCase().includes('idara al-khair')
                                    ? student.campus_name
                                    : `IDARA AL-KHAIR ${student.campus_name || ''}`}
                            </h1>

                            <div className="mt-4 inline-block bg-[#274c77] text-white px-8 py-2 rounded-full font-bold uppercase text-sm report-title-pill mx-auto">{`Monthly Progress Report ${getAcademicYear(activeMonth, monthlyResult?.academic_year)}`}</div>
                        </div>
                    </div>

                    {/* Student Info */}
                    <div className="grid grid-cols-2 gap-8 mb-8">
                        <div className="space-y-3">
                            <div className="flex items-center"><span className="font-bold w-36">Student Name:</span><span className="border-b border-[#d1d5db] flex-1 py-1">{student.name}</span></div>
                            <div className="flex items-center"><span className="font-bold w-36">Father Name:</span><span className="border-b border-[#d1d5db] flex-1 py-1">{student.father_name || (student as any).fatherName || (student as any).guardian_name || (student as any).parent_name || (student as any).father?.name || '-'}</span></div>
                            <div className="flex items-center"><span className="font-bold w-36">Teacher:</span><span className="border-b border-[#d1d5db] flex-1 py-1">{(monthlyResult as any)?.teacher?.full_name || (monthlyResult as any)?.teacher_name || '-'}</span></div>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center"><span className="font-bold w-36">Class:</span><span className="border-b border-[#d1d5db] flex-1 py-1">{student.class_name || student.section || '-'}</span></div>
                            <div className="flex items-center">
                                <span className="font-bold w-36">
                                    {((student as any).student_id || (student as any).student_code) ? "Student ID:" : "G.R No:"}
                                </span>
                                <span className="border-b border-[#d1d5db] flex-1 py-1">
                                    {(student as any).student_id || (student as any).student_code || (student as any).gr_no || '-'}
                                </span>
                            </div>
                            {(() => {
                                // Only passing students get a position shown; failed/absent never rank.
                                const pos = (monthlyResult?.pass_status === 'pass' && monthlyResult?.position)
                                    || (finalTermResult?.pass_status === 'pass' && finalTermResult?.position);
                                return pos ? <div className="flex items-center"><span className="font-bold w-36 text-[#7e22ce]">Position:</span><span className="border-b border-[#d1d5db] flex-1 font-bold text-[#7e22ce] py-1">{pos}</span></div> : null;
                            })()}
                        </div>
                    </div>

                    {/* Monthly Table */}
                    <div className="mb-10 overflow-hidden rounded-lg border border-gray-200">
                        <Table>
                            <TableHeader className="bg-[#274c77] print-bg-blue">
                                <TableRow className="border-none">
                                    <TableHead className="text-white font-bold h-12 print:text-white px-2 py-2">Subject</TableHead>
                                    <TableHead className="text-white font-bold text-center print:text-white px-2 py-2">Total</TableHead>
                                    {['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'].map(m => (
                                        <TableHead key={m} className={cn("text-white w-12 text-center font-bold text-xs whitespace-nowrap px-2 print:text-white transition-all duration-300", activeMonth !== m && "opacity-20 blur-[1px] blurred-col")}>
                                            {m.substring(0, 3)}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(() => {
                                    const months = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
                                    // A subject "participates" in a month only if it has a mark
                                    // (even 0) or an absent flag for that specific month. Subjects
                                    // without data for the month must NOT inflate the total/percentage.
                                    const monthHasData = (s: typeof activeSubjects[number], m: string) =>
                                        s.monthly[m] !== undefined || s.monthlyAbsent[m] === true;
                                    // Show only subjects that have data for the active (selected) month,
                                    // so a subject removed from this month's upload never appears or counts.
                                    const displayedSubjects = activeMonth
                                        ? activeSubjects.filter(s => monthHasData(s, activeMonth))
                                        : activeSubjects.filter(s =>
                                            Object.values(s.monthly).some(v => v > 0) ||
                                            Object.values(s.monthlyAbsent).some(v => v === true)
                                        );
                                    const getGrade = (p: number) => p >= 80 ? 'A+' : p >= 70 ? 'A' : p >= 60 ? 'B' : p >= 50 ? 'C' : p >= 40 ? 'D' : 'F';
                                    // Per-subject total marks are variable (e.g. 25 or 20).
                                    // Prefer the given month's total; fall back to any recorded total, else 25.
                                    const subjTotal = (s: typeof displayedSubjects[number], m?: string) => {
                                        if (m && s.monthlyTotal[m]) return s.monthlyTotal[m];
                                        const vals = Object.values(s.monthlyTotal).filter(v => v > 0);
                                        return vals.length ? vals[0] : 25;
                                    };

                                    return (
                                        <>
                                            {displayedSubjects.map((subject) => (
                                                <TableRow key={subject.name} className="hover:bg-[#f9fafb]/50">
                                                    <TableCell className="font-bold text-[#374151]">{formatName(subject.name)}</TableCell>
                                                    <TableCell className="text-center font-bold bg-[#f9fafb] text-[#4b5563] border-l">{subjTotal(subject, activeMonth)}</TableCell>
                                                    {months.map(m => {
                                                        const isAbsent = subject.monthlyAbsent[m];
                                                        const hasData = subject.monthly[m] !== undefined || isAbsent;
                                                        const isFail = !isAbsent && hasData && (subject.monthly[m] / (subject.monthlyTotal[m] || 25)) * 100 < 40;
                                                        const retest = hasData && !isAbsent ? getRetest(subject.rawName || subject.name, 'monthly', m) : undefined;
                                                        return (
                                                            <TableCell key={m} className={cn("text-center text-sm border-l px-1 transition-all duration-300", activeMonth === m ? "bg-[rgba(239,246,255,0.5)] font-bold" : "opacity-20 blur-[2px] blurred-col")}>
                                                                {!hasData ? '-' : isAbsent
                                                                    ? <span className="text-orange-500 font-black text-[10px]">Abs</span>
                                                                    : retest
                                                                    ? <span className="flex flex-col items-center gap-0.5">
                                                                        <span className="text-[#dc2626] line-through text-[10px]">{subject.monthly[m]}</span>
                                                                        <span className="text-[#15803d] font-bold text-xs">{retest.marks_obtained}<span className="text-[9px] font-normal ml-0.5">RT</span></span>
                                                                      </span>
                                                                    : isFail
                                                                    ? <span className="text-[#dc2626] font-bold underline decoration-[#dc2626] decoration-2">{subject.monthly[m]}</span>
                                                                    : subject.monthly[m]
                                                                }
                                                            </TableCell>
                                                        );
                                                    })}
                                                </TableRow>
                                            ))}

                                            {/* Total Marks — use retest marks when available */}
                                            <TableRow className="bg-[#f9fafb] hover:bg-[#f3f4f6] font-bold border-t-2 border-[#d1d5db]">
                                                <TableCell className="text-[#1f2937]">Total Marks</TableCell>
                                                <TableCell className="text-center text-[#274c77] border-l">{displayedSubjects.reduce((sum, s) => sum + subjTotal(s, activeMonth), 0)}</TableCell>
                                                {months.map(m => {
                                                    const allAbsent = displayedSubjects.every(s => s.monthlyAbsent[m]);
                                                    const presentSubjects = displayedSubjects.filter(s => monthHasData(s, m) && !s.monthlyAbsent[m]);
                                                    const hasAny = displayedSubjects.some(s => s.monthly[m] !== undefined || s.monthlyAbsent[m]);
                                                    // Use retest marks if available, otherwise original
                                                    const total = presentSubjects.reduce((sum, s) => {
                                                        const rt = getRetest(s.rawName || s.name, 'monthly', m);
                                                        return sum + (rt ? (rt.marks_obtained || 0) : (s.monthly[m] || 0));
                                                    }, 0);
                                                    return (
                                                        <TableCell key={m} className={cn("text-center border-l transition-all duration-300", activeMonth === m ? "bg-[rgba(219,234,254,0.5)] text-[#274c77]" : "opacity-20 blur-[2px] blurred-col")}>
                                                            {!hasAny ? '-' : allAbsent ? <span className="text-orange-500 text-[10px] font-black">Abs</span> : total}
                                                        </TableCell>
                                                    );
                                                })}
                                            </TableRow>

                                            {/* Percentage — recalculated with retest marks */}
                                            <TableRow className="bg-[rgba(240,253,244,0.3)] hover:bg-[rgba(220,252,231,0.3)] font-bold">
                                                <TableCell colSpan={2} className="text-center text-[#1f2937]">Percentage</TableCell>
                                                {months.map(m => {
                                                    const allAbsent = displayedSubjects.every(s => s.monthlyAbsent[m]);
                                                    const hasAny = displayedSubjects.some(s => s.monthly[m] !== undefined || s.monthlyAbsent[m]);
                                                    const presentSubjects = displayedSubjects.filter(s => monthHasData(s, m) && !s.monthlyAbsent[m]);
                                                    const totalObtained = presentSubjects.reduce((sum, s) => {
                                                        const rt = getRetest(s.rawName || s.name, 'monthly', m);
                                                        return sum + (rt ? (rt.marks_obtained || 0) : (s.monthly[m] || 0));
                                                    }, 0);
                                                    const totalPossible = presentSubjects.reduce((sum, s) => sum + (s.monthlyTotal[m] || 25), 0);
                                                    const percentage = totalPossible > 0 ? (totalObtained / totalPossible) * 100 : 0;
                                                    // anyFailed: check effective marks (retest overrides original)
                                                    const anyFailed = presentSubjects.some(s => {
                                                        const rt = getRetest(s.rawName || s.name, 'monthly', m);
                                                        const effectiveMark = rt ? (rt.marks_obtained || 0) : (s.monthly[m] || 0);
                                                        return s.monthly[m] !== undefined && (effectiveMark / (s.monthlyTotal[m] || 25)) * 100 < 40;
                                                    });
                                                    return (
                                                        <TableCell key={m} className={cn("text-center border-l transition-all duration-300 text-[#15803d]", activeMonth === m ? "bg-[rgba(220,252,231,0.3)]" : "opacity-20 blur-[2px] blurred-col")}>
                                                            {!hasAny ? '-' : allAbsent ? <span className="text-orange-500 text-[10px] font-black">Abs</span> : anyFailed ? <span className="text-rose-600">N/A</span> : percentage >= 0 ? percentage.toFixed(1) + '%' : '-'}
                                                        </TableCell>
                                                    );
                                                })}
                                            </TableRow>

                                            {/* Monthly Grade — recalculated with retest marks */}
                                            <TableRow className="bg-[rgba(239,246,255,0.3)] hover:bg-[rgba(219,234,254,0.3)] font-bold">
                                                <TableCell colSpan={2} className="text-center text-[#1f2937]">Monthly Grade</TableCell>
                                                {months.map(m => {
                                                    const allAbsent = displayedSubjects.every(s => s.monthlyAbsent[m]);
                                                    const hasAny = displayedSubjects.some(s => s.monthly[m] !== undefined || s.monthlyAbsent[m]);
                                                    const presentSubjects = displayedSubjects.filter(s => monthHasData(s, m) && !s.monthlyAbsent[m]);
                                                    const totalObtained = presentSubjects.reduce((sum, s) => {
                                                        const rt = getRetest(s.rawName || s.name, 'monthly', m);
                                                        return sum + (rt ? (rt.marks_obtained || 0) : (s.monthly[m] || 0));
                                                    }, 0);
                                                    const totalPossible = presentSubjects.reduce((sum, s) => sum + (s.monthlyTotal[m] || 25), 0);
                                                    const percentage = totalPossible > 0 ? (totalObtained / totalPossible) * 100 : 0;
                                                    const anyFailed = presentSubjects.some(s => {
                                                        const rt = getRetest(s.rawName || s.name, 'monthly', m);
                                                        const effectiveMark = rt ? (rt.marks_obtained || 0) : (s.monthly[m] || 0);
                                                        return s.monthly[m] !== undefined && (effectiveMark / (s.monthlyTotal[m] || 25)) * 100 < 40;
                                                    });
                                                    return (
                                                        <TableCell key={m} className={cn("text-center border-l transition-all duration-300 text-[#274c77]", activeMonth === m ? "bg-[rgba(219,234,254,0.3)]" : "opacity-20 blur-[2px] blurred-col")}>
                                                            {!hasAny ? '-' : allAbsent ? <span className="text-orange-500 text-[10px] font-black">Abs</span> : anyFailed ? <span className="text-rose-600 font-black">Fail</span> : percentage >= 0 ? getGrade(percentage) : '-'}
                                                        </TableCell>
                                                    );
                                                })}
                                            </TableRow>
                                        </>
                                    );
                                })()}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Attendance Summary and Teacher's Remarks */}
                    <div className="grid grid-cols-2 gap-6 mt-6">
                        {/* Attendance Summary */}
                        <div className="border-2 border-[#d1d5db] rounded-lg p-4">
                            <h3 className="text-sm font-bold text-[#274c77] uppercase mb-3 border-b pb-2">Attendance Summary</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-[#374151]">Total School Days:</span>
                                    <span className="font-bold">
                                        {monthlyResult && typeof (monthlyResult as any).calendar_working_days === 'number' 
                                            ? (monthlyResult as any).calendar_working_days 
                                            : (monthlyResult && typeof monthlyResult.total_attendance === 'number' ? monthlyResult.total_attendance : '-')}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-[#374151]">Attendance Taken Days:</span>
                                    <span className="font-bold">
                                        {monthlyResult && typeof monthlyResult.total_attendance === 'number' 
                                            ? monthlyResult.total_attendance 
                                            : '-'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-[#374151]">Total Days Present:</span>
                                    <span className="font-bold">
                                        {monthlyResult && typeof monthlyResult.attendance_score === 'number' 
                                            ? monthlyResult.attendance_score 
                                            : (monthlyResult && typeof monthlyResult.total_attendance === 'number' ? 0 : '-')}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-[#374151]">Total Days Absent:</span>
                                    <span className="font-bold">
                                        {monthlyResult && typeof monthlyResult.total_attendance === 'number' 
                                            ? (monthlyResult.total_attendance - (monthlyResult.attendance_score || 0)) 
                                            : '-'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-[#374151]">Percentage:</span>
                                    <span className="font-bold">
                                        {monthlyResult && typeof monthlyResult.total_attendance === 'number' && monthlyResult.total_attendance > 0 
                                            ? (((monthlyResult.attendance_score || 0) / monthlyResult.total_attendance) * 100).toFixed(1) + '%' 
                                            : '-'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Teacher's Remarks */}
                        <div className="border-2 border-[#d1d5db] rounded-lg p-4">
                            <h3 className="text-sm font-bold text-[#274c77] uppercase mb-3 border-b pb-2">Teacher's Remarks</h3>
                            <div className="text-sm text-[#4b5563] italic min-h-[80px]">
                                {monthlyResult?.teacher_remarks || 'No remarks provided.'}
                            </div>
                        </div>
                    </div>

                    {/* Signatures */}
                    <div className="grid grid-cols-4 gap-8 mt-auto pt-10 pb-6 print:gap-4 print:pb-2 max-w-[95%] mx-auto w-full">
                        <div className="text-center">
                            <div className="border-b-2 border-[#9ca3af] mb-2 h-12 flex items-center justify-center relative">
                                {monthlyResult?.teacher?.signature && (
                                    <img src={monthlyResult.teacher.signature} alt="Sign" className="max-h-11 max-w-full object-contain absolute bottom-0.5" />
                                )}
                            </div>
                            <div className="text-sm font-bold text-[#374151]">Teacher's Signature</div>
                        </div>
                        <div className="text-center">
                            <div className="border-b-2 border-[#9ca3af] mb-2 h-12 flex items-center justify-center relative">
                                {monthlyResult?.coordinator_signature && (
                                    <img src={monthlyResult.coordinator_signature} alt="Sign" className="max-h-11 max-w-full object-contain absolute bottom-0.5" />
                                )}
                            </div>
                            <div className="text-sm font-bold text-[#374151]">Coordinator's Signature</div>
                        </div>
                        <div className="text-center">
                            <div className="border-b-2 border-[#9ca3af] mb-2 h-12"></div>
                            <div className="text-sm font-bold text-[#374151]">Parent's Signature</div>
                        </div>
                        <div className="text-center">
                            <div className="border-b-2 border-[#9ca3af] mb-2 h-12 flex items-center justify-center relative">
                                {monthlyResult?.principal_signature && (
                                    <img src={monthlyResult.principal_signature} alt="Sign" className="max-h-11 max-w-full object-contain absolute bottom-0.5" />
                                )}
                            </div>
                            <div className="text-sm font-bold text-[#374151]">Principal's Signature</div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }


    // Helper to convert behaviour text value to abbreviation
    const getBehaviourAbbr = (value: string | undefined): string => {
        if (!value) return '-';
        const v = value.toString().toLowerCase().trim();
        if (v === 'excellent' || v === 'e') return 'E';
        if (v === 'good' || v === 'g') return 'G';
        if (v === 'satisfactory' || v === 's') return 'S';
        if (v === 'needs improvement' || v === 'needs improv' || v === 'ni') return 'NI';
        if (v === 'poor' || v === 'p') return 'P';
        // If it's already a single letter/abbreviation
        if (v.length <= 2) return v.toUpperCase();
        return v.charAt(0).toUpperCase();
    };

    // Canonical behaviour field names (without the `behaviour_` prefix).
    const behaviourExactNames = new Set([
        'response', 'observation', 'participation',
        'follow_rules', 'home_work', 'homework', 'personal_hygiene',
        'respect_others'
    ]);

    // A subject is a behaviour field only if its normalized name starts with
    // `behaviour_`/`behavior_` or exactly matches a canonical name. This avoids
    // loose substring matching so a real subject like "Response & Analysis" is
    // never misread as behaviour.
    const isBehaviourName = (raw: string | undefined): boolean => {
        if (!raw) return false;
        const n = raw.toLowerCase().trim().replace(/\s+/g, '_');
        if (n.startsWith('behaviour_') || n.startsWith('behavior_')) return true;
        return behaviourExactNames.has(n);
    };

    // Extract behaviour data from subject_marks
    const extractBehaviourFromResult = (result: Result | undefined) => {
        if (!result) return {};
        const behaviourData: Record<string, string> = {};

        result.subject_marks?.forEach(mark => {
            const name = mark.subject_name?.toLowerCase().replace(/\s+/g, '_') || '';

            // Check if this is a behaviour field
            if (isBehaviourName(mark.subject_name) || isBehaviourName(mark.variant)) {
                // Behaviour text is stored in grade field (e.g., "Excellent", "Good", etc.)
                let value = mark.grade || '';

                // If grade is empty, check if there's a numeric value that might indicate behaviour
                if (!value && mark.obtained_marks != null && mark.obtained_marks > 0) {
                    // Fallback to 'Good' if we have any marks but no grade text
                    value = 'Good';
                }

                // Normalize the field name to match display keys
                let fieldKey = 'Response';
                if (name.includes('observation')) fieldKey = 'Observation';
                else if (name.includes('participation')) fieldKey = 'Participation';
                else if (name.includes('follow') || name.includes('rules')) fieldKey = 'Follow Rules';
                else if (name.includes('home') || name.includes('work') || name.includes('homework')) fieldKey = 'Home Work';
                else if (name.includes('hygiene') || name.includes('personal')) fieldKey = 'Personal Hygiene';
                else if (name.includes('respect') || name.includes('others')) fieldKey = 'Respect Others';
                else if (name.includes('response')) fieldKey = 'Response';

                if (value) {
                    behaviourData[fieldKey] = value;
                }
            }
        });

        return behaviourData;
    };

    // Check if a subject name is a behaviour field
    const isBehaviourField = (name: string): boolean => isBehaviourName(name);

    // Filter out behaviour items from term subjects
    const termSubjectsFiltered = termFilteredSubjects.filter(s => !isBehaviourField(s.name));

    // Pad to minimum 11 rows for display
    const termSubjects = [...termSubjectsFiltered];
    while (termSubjects.length < 11) {
        termSubjects.push({
            name: '',
            rawName: '',
            monthly: {},
            monthlyTotal: {},
            monthlyAbsent: {},
            midTermObt: 0,
            midTermTotal: 0,
            midTermAbsent: false,
            finalTermObt: 0,
            finalTermTotal: 0,
            finalTermAbsent: false,
            inMid: false,
            inFinal: false,
            grade: ''
        });
    }

    // Get behaviour data from final term result (or mid term as fallback)
    const behaviourData = extractBehaviourFromResult(finalTermResult) || extractBehaviourFromResult(midTermResult) || {};

    // Calculate totals for actual subjects only (excluding behaviour and absent subjects)
    // Calculate totals for actual subjects only
    const midTermTotalMarks = termSubjectsFiltered.reduce((sum, s) => sum + (s.midTermTotal || 0), 0);
    const midTermObtMarks = termSubjectsFiltered.reduce((sum, s) => sum + (s.midTermObt || 0), 0);
    const finalTermTotalMarks = termSubjectsFiltered.reduce((sum, s) => sum + (s.finalTermTotal || 0), 0);
    const finalTermObtMarks = termSubjectsFiltered.reduce((sum, s) => sum + (s.finalTermObt || 0), 0);

    return (
        <div className="min-h-screen flex items-start justify-center pt-0 pb-6 print:flex print:print-viewport print:items-center print:justify-center print:py-0">
            <div className={`report-root relative bg-white p-6 w-full max-w-[210mm] min-h-[297mm] flex flex-col mx-auto text-black print:p-0 print:max-w-none print:mx-0 print:!bg-white print:min-h-[285mm] font-sans ${className}`}>
                <style dangerouslySetInnerHTML={{
                    __html: `
                @media print {
                    @page { size: A4; margin: 5mm; }
                    /* make the outer wrapper equal to page content height and center the report-root */
                    .print-viewport { height: calc(297mm - 10mm) !important; display: flex !important; align-items: center !important; justify-content: center !important; padding-top: 8mm !important; }
                    html, body { margin: 0 !important; padding: 0 !important; background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background-color: transparent !important; }
                    .report-root { page-break-inside: avoid !important; page-break-after: auto !important; height: 284mm !important; padding: 5mm 8mm !important; }
                    .report-title-pill { background-color: #274c77 !important; color: #fff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                }
                .report-root { page-break-inside: avoid; }
            `}} />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden opacity-[0.03] print:opacity-[0.05] z-0">
                    <div className="text-[80px] font-bold -rotate-45 whitespace-nowrap uppercase tracking-[10px]">Idara Al-Khair</div>
                </div>
                <SharedHeader student={student} title={`ANNUAL EXAMINATION REPORT ${getAcademicYear(undefined, finalTermResult?.academic_year || midTermResult?.academic_year)}`} isCompact={true} teacherName={(finalTermResult as any)?.teacher?.full_name || (midTermResult as any)?.teacher?.full_name || (finalTermResult as any)?.teacher_name || (midTermResult as any)?.teacher_name || ''} />

                <div className="flex flex-row border-2 border-[#274c77] border-b-0">
                    <div className="flex-1 flex flex-row">
                        <div className="flex-1 border-r-2 border-[#274c77]">
                            <div className="text-center font-bold border-b-2 border-[#274c77] bg-[#f1f5f9] uppercase text-sm h-10 flex items-center justify-center">
                                Half Yearly Examinations
                            </div>
                            <div className="grid grid-cols-[3fr_1fr_1fr] text-[10px] font-bold border-b border-[#274c77]">
                                <div className="px-3 py-1 border-r border-[#274c77] text-center">SUBJECTS</div>
                                <div className="px-3 py-1 border-r border-[#274c77] text-center leading-3">TOTAL<br />MARKS</div>
                                <div className="px-3 py-1 text-center leading-3">MARKS<br />OBT</div>
                            </div>
                            {termSubjects.map((sub, i) => {
                                const midRetest = sub.name ? getRetest(sub.rawName || sub.name, 'midterm') : undefined;
                                // Mid Term pass threshold is 33% (Final/Annual is 40%), matching backend logic
                                const midFail = !sub.midTermAbsent && (sub.midTermObt || 0) < (sub.midTermTotal || 0) * 0.33;
                                return (
                                <div key={i} className={cn("grid grid-cols-[3fr_1fr_1fr] text-xs border-b border-[#94a3b8]", i % 2 === 0 ? 'bg-[#f8fafc]' : 'bg-white')}>
                                    <div className="p-1 pl-2 border-r border-[#94a3b8] font-medium truncate">{sub.name ? formatName(sub.name) : '\u00A0'}</div>
                                    <div className="p-1 border-r border-[#94a3b8] text-center">{sub.name ? (sub.midTermTotal || '-') : ''}</div>
                                    <div className="p-1 text-center font-bold">
                                        {!sub.name ? '' : sub.midTermAbsent
                                            ? <span className="text-orange-500 font-black">Abs</span>
                                            : midRetest
                                            ? <span className="flex flex-col items-center leading-tight">
                                                <span className="text-[#dc2626] line-through text-[9px]">{sub.midTermObt}</span>
                                                <span className="text-[#15803d] text-[10px]">{midRetest.marks_obtained}<sup className="text-[7px]">RT</sup></span>
                                              </span>
                                            : <span className={midFail ? 'text-[#dc2626]' : ''}>{sub.midTermObt || '-'}</span>
                                        }
                                    </div>
                                </div>
                                );
                            })}
                            {/* Total Row with Total and Obt columns */}
                            <div className="grid grid-cols-[3fr_1fr_1fr] text-xs border-b-2 border-[#274c77] bg-[#e2e8f0] font-bold">
                                <div className="p-1 pl-2 border-r border-[#274c77]">TOTAL</div>
                                <div className="p-1 border-r border-[#274c77] text-center text-[#1e40af]">{midTermTotalMarks || 0}</div>
                                <div className="p-1 text-center text-[#1e40af]">{midTermObtMarks || 0}</div>
                            </div>
                        </div>

                        {/* Final Term Column */}
                        <div className="flex-1 border-r-2 border-[#274c77]">
                            <div className="text-center font-bold border-b-2 border-[#274c77] bg-[#f1f5f9] uppercase text-sm h-10 flex items-center justify-center">
                                Annual Examinations
                            </div>
                            <div className="grid grid-cols-[3fr_1fr_1fr] text-[10px] font-bold border-b border-[#274c77]">
                                <div className="px-3 py-1 border-r border-[#274c77] text-center">SUBJECTS</div>
                                <div className="px-3 py-1 border-r border-[#274c77] text-center leading-3">TOTAL<br />MARKS</div>
                                <div className="px-3 py-1 text-center leading-3">MARKS<br />OBT</div>
                            </div>
                            {termSubjects.map((sub, i) => {
                                const finalRetest = sub.name ? getRetest(sub.rawName || sub.name, 'final') : undefined;
                                const finalFail = !sub.finalTermAbsent && (sub.finalTermObt || 0) < (sub.finalTermTotal || 0) * 0.4;
                                return (
                                <div key={i} className={cn("grid grid-cols-[3fr_1fr_1fr] text-xs border-b border-[#94a3b8]", i % 2 === 0 ? 'bg-[#f8fafc]' : 'bg-white')}>
                                    <div className="p-1 pl-2 border-r border-[#94a3b8] font-medium truncate">{sub.name ? formatName(sub.name) : '\u00A0'}</div>
                                    <div className="p-1 border-r border-[#94a3b8] text-center">{sub.name ? (sub.finalTermTotal || '') : ''}</div>
                                    <div className="p-1 text-center font-bold">
                                        {!sub.name ? '' : sub.finalTermAbsent
                                            ? <span className="text-orange-500 font-black">Abs</span>
                                            : finalRetest
                                            ? <span className="flex flex-col items-center leading-tight">
                                                <span className="text-[#dc2626] line-through text-[9px]">{sub.finalTermObt}</span>
                                                <span className="text-[#15803d] text-[10px]">{finalRetest.marks_obtained}<sup className="text-[7px]">RT</sup></span>
                                              </span>
                                            : <span className={finalFail ? 'text-[#dc2626]' : ''}>{sub.finalTermObt || ''}</span>
                                        }
                                    </div>
                                </div>
                                );
                            })}
                            {/* Total Row with Total and Obt columns */}
                            <div className="grid grid-cols-[3fr_1fr_1fr] text-xs border-b-2 border-[#274c77] bg-[#e2e8f0] font-bold">
                                <div className="p-1 pl-2 border-r border-[#274c77]">TOTAL</div>
                                <div className="p-1 border-r border-[#274c77] text-center text-[#1e40af]">{finalTermTotalMarks || 0}</div>
                                <div className="p-1 text-center text-[#1e40af]">{finalTermObtMarks || 0}</div>
                            </div>
                        </div>
                    </div>

                    {/* Right Sidebar: Charts & Behaviour */}
                    <div className="w-40 flex flex-col border-b-2 border-[#274c77]">
                        <div className="border-b-2 border-[#274c77]">
                            <div className="text-center font-bold border-b border-[#274c77] py-1 bg-[#f1f5f9] uppercase text-sm">
                                Grade Chart
                            </div>
                            <div className="text-[9px]">
                                {[
                                    { g: 'A+', r: '80+' },
                                    { g: 'A', r: '70 - 79' },
                                    { g: 'B', r: '60 - 69' },
                                    { g: 'C', r: '50 - 59' },
                                    { g: 'D', r: '40 - 49' },
                                    { g: 'E', r: '33 - 39' },
                                    { g: 'F', r: 'Below 33' },
                                ].map((item, i) => (
                                    <div key={item.g} className="flex border-b border-[#cbd5e1] last:border-0">
                                        <div className="w-12 text-center border-r border-[#cbd5e1] font-bold bg-[#f8fafc]">{item.g}</div>
                                        <div className="flex-1 text-center">{item.r}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Behaviour */}
                        <div className="flex-1">
                            <div className="text-center font-bold border-b border-[#274c77] py-1 bg-[#f1f5f9] uppercase text-sm">
                                Behaviour
                            </div>
                            <div className="text-[12px]">
                                {['Response', 'Observation', 'Participation', 'Follow Rules', 'Home Work', 'Personal Hygiene', 'Respect Others'].map((b) => (
                                    <div key={b} className="flex border-b border-[#cbd5e1] items-center h-6">
                                        <div className="flex-1 pl-2">{b}</div>
                                        <div className="w-8 border-l border-[#cbd5e1] text-center font-bold italic text-[#1e40af]">
                                            {getBehaviourAbbr(behaviourData[b]) || (finalTermResult ? 'G' : '\u00A0')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="text-[9px] px-1 border-t border-[#274c77] pt-1 grid grid-cols-2 gap-x-1">
                                <div><span className="font-bold">E:</span> Excellent</div>
                                <div><span className="font-bold">G:</span> Good</div>
                                <div><span className="font-bold">S:</span> Satisfactory</div>
                                <div><span className="font-bold">NI:</span> Needs Improv</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Summary Section */}
                {(() => {
                    // A subject only counts as failed if it failed AND has no approved
                    // passing retest — otherwise the GRADE would stay "Fail" even after a
                    // successful retest (the original failing mark is kept for display).
                    const subjectFailed = (sm: any, examType: string) => {
                        if (sm.is_pass || sm.subject_name?.toLowerCase().includes('behaviour')) return false;
                        const rt = getRetest(sm.subject_name, examType);
                        if (rt && rt.pass_status === 'pass') return false;
                        return true;
                    };
                    const midAnyFail = midTermResult?.subject_marks?.some((sm: any) => subjectFailed(sm, 'midterm'));
                    const finalAnyFail = finalTermResult?.subject_marks?.some((sm: any) => subjectFailed(sm, 'final'));
                    return (
                <div className="border-2 border-t-0 border-[#274c77] flex flex-row">
                    {/* Mid Term Summary */}
                    <div className="flex-1 border-r-2 border-[#274c77] p-2 space-y-0.5">
                        <SummaryRow label="TOTAL" value={midTermResult?.pass_status === 'absent' ? '-' : (midTermResult?.total_marks ? `${midTermResult?.obtained_marks || 0}/${midTermResult?.total_marks}` : '-')} />
                        <SummaryRow label="PERCENTAGE" value={midTermResult?.pass_status === 'absent' ? '-' : (midTermResult?.percentage !== undefined ? midTermResult.percentage.toFixed(1) + '%' : '-')} />
                        <SummaryRow label="GRADE" value={midTermResult?.pass_status === 'absent' ? <span className="text-amber-600 font-bold">Absent</span> : (midTermResult?.result_status === 'fail' || midAnyFail) ? <span className="text-rose-600 font-bold">Fail</span> : (midTermResult?.grade === 'F' ? <span className="text-[#dc2626]">F</span> : midTermResult?.grade)} />
                        <SummaryRow label="RANK" value={(midTermResult?.pass_status === 'pass' && midTermResult?.position) ? midTermResult.position : '-'} />
                        <div className="mt-2 pt-4 border-t border-[#94a3b8] grid grid-cols-1 gap-2 text-xs">
                            <div className="flex justify-between"><span>Result:</span> <span className={cn("font-bold", (midTermResult?.result_status?.toLowerCase() === 'fail' && midTermResult?.pass_status !== 'absent') && "text-[#dc2626]")}>{midTermResult?.pass_status === 'absent' ? 'ABSENT' : midTermResult?.result_status === 'fail' ? 'FAIL' : midTermResult?.result_status?.toUpperCase()}</span></div>
                            <div className="flex justify-between"><span>School Days:</span> <span className="font-bold">{midTermResult?.total_attendance}</span></div>
                            <div className="flex justify-between"><span>Remarks:</span> <span className="font-bold border-b">{translateRemarks(midTermResult?.grade)}</span></div>
                            <div className="flex justify-between"><span>Attendance:</span> <span className="font-bold">{midTermResult?.attendance_score}</span></div>
                        </div>
                        <div className="mt-4 pt-4 grid grid-cols-3 gap-2">
                            <SignatureLine title="Coordinator" signatureUrl={midTermResult?.coordinator_signature} />
                            <SignatureLine title="Principal" signatureUrl={midTermResult?.principal_signature} />
                            <SignatureLine title="Parent" />
                        </div>
                    </div>

                    {/* Final Term Summary */}
                    <div className="flex-1 border-r-2 border-[#274c77] p-2 space-y-0.5">
                        <SummaryRow label="TOTAL" value={finalTermResult?.pass_status === 'absent' ? '-' : (finalTermResult?.total_marks ? `${finalTermResult?.obtained_marks || 0}/${finalTermResult?.total_marks}` : '-')} />
                        <SummaryRow label="PERCENTAGE" value={finalTermResult?.pass_status === 'absent' ? '-' : (finalTermResult?.percentage !== undefined ? finalTermResult.percentage.toFixed(1) + '%' : '-')} />
                        <SummaryRow label="GRADE" value={finalTermResult?.pass_status === 'absent' ? <span className="text-amber-600 font-bold">Absent</span> : (finalTermResult?.result_status === 'fail' || finalAnyFail) ? <span className="text-rose-600 font-bold">Fail</span> : (finalTermResult?.grade === 'F' ? <span className="text-[#dc2626]">F</span> : finalTermResult?.grade)} />
                        <SummaryRow label="RANK" value={(finalTermResult?.pass_status === 'pass' && finalTermResult?.position) ? finalTermResult.position : '-'} />
                        <div className="mt-2 pt-4 border-t border-[#94a3b8] grid grid-cols-1 gap-2 text-xs">
                            <div className="flex justify-between"><span>Result:</span> <span className={cn("font-bold", (finalTermResult?.result_status?.toLowerCase() === 'fail' && finalTermResult?.pass_status !== 'absent') && "text-[#dc2626]")}>{finalTermResult?.pass_status === 'absent' ? 'ABSENT' : finalTermResult?.result_status === 'fail' ? 'FAIL' : finalTermResult?.result_status?.toUpperCase()}</span></div>
                            <div className="flex justify-between"><span>School Days:</span> <span className="font-bold">{finalTermResult?.total_attendance}</span></div>
                            <div className="flex justify-between"><span>Remarks:</span> <span className="font-bold border-b">{translateRemarks(finalTermResult?.grade)}</span></div>
                            <div className="flex justify-between"><span>Attendance:</span> <span className="font-bold">{finalTermResult?.attendance_score}</span></div>
                        </div>
                        <div className="mt-4 pt-4 grid grid-cols-3 gap-2">
                            <SignatureLine title="Coordinator" signatureUrl={finalTermResult?.coordinator_signature} />
                            <SignatureLine title="Principal" signatureUrl={finalTermResult?.principal_signature} />
                            <SignatureLine title="Parent" />
                        </div>
                    </div>

                    {/* Teacher Remarks Box */}
                    <div className="w-40 p-2 flex flex-col justify-between">
                        <div>
                            <div className="font-bold text-sm text-center underline mb-2">Teacher's Remarks</div>
                            <p className="text-xs italic text-center">
                                {finalTermResult?.teacher_remarks || midTermResult?.teacher_remarks || "Satisfactory Performance."}
                            </p>
                        </div>
                        <SignatureLine title="Class Teacher" className="mt-4" signatureUrl={finalTermResult?.teacher?.signature || midTermResult?.teacher?.signature} />
                    </div>
                </div>
                    );
                })()}
            </div>
        </div>
    );
}


function SharedHeader({ student, title, isCompact = false, teacherName }: { student: Student, title: string, isCompact?: boolean, teacherName?: string }) {
    const campusLogo = (() => {
        const p = (student as any)?.campus_data?.campus_photo;
        if (!p) return "/Newton.png";
        if (p.startsWith('http://') || p.startsWith('https://')) return p;
        const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';
        return `${apiBase}${p.startsWith('/') ? '' : '/'}${p}`;
    })();
    return (
        <div className={cn("text-center border-b-2 border-[#274c77]", isCompact ? "pb-4 mb-6" : "pb-6 mb-8")}>
            <div className="relative">
                <div className={cn(isCompact ? "absolute left-0 top-0 h-20 w-20" : "absolute left-0 top-0 h-24 w-24")}><img src={campusLogo} alt="" className="h-full object-contain" /></div>
                <div className="w-full text-center">
                    <h1 className={cn("font-sans font-bold uppercase text-[#274c77] whitespace-nowrap", isCompact ? "text-2xl tracking-wide" : "text-3xl tracking-wide")}>
                        {student.campus_name?.toLowerCase().includes('idara al-khair')
                            ? student.campus_name
                            : `IDARA AL-KHAIR ${student.campus_name || ''}`}
                    </h1>
                </div>
            </div>

            <div className={cn("report-title-pill bg-[#274c77] text-white inline-block font-bold rounded-full uppercase print:bg-[#274c77] print:text-white", isCompact ? "px-16 py-1 text-sm mb-4" : "px-20 py-2 text-base mb-4")}>
                {title}
            </div>

            <div className={cn("grid grid-cols-2 text-left mx-auto font-medium", isCompact ? "gap-x-8 gap-y-3 text-xs max-w-2xl mt-3" : "gap-x-8 gap-y-4 text-sm max-w-2xl")}>
                <div className="flex items-center"><span className="w-36 font-bold">Name:</span> <span className="border-b border-[#94a3b8] flex-1 py-1">{student.name}</span></div>
                <div className="flex items-center"><span className="w-36 font-bold">Father's Name:</span> <span className="border-b border-[#94a3b8] flex-1 py-1">{student.father_name || (student as any).fatherName || (student as any).guardian_name || (student as any).parent_name || (student as any).father?.name || '-'}</span></div>
                <div className="flex items-center"><span className="w-36 font-bold">Class:</span> <span className="border-b border-[#94a3b8] flex-1 py-1">{student.class_name || student.classroom?.class_name}</span></div>
                <div className="flex items-center"><span className="w-36 font-bold">{((student as any).student_id || (student as any).student_code) ? "Student ID:" : "Roll No:"}</span> <span className="border-b border-[#94a3b8] flex-1 py-1">{(student as any).student_id || (student as any).student_code || (student as any).gr_no || '-'}</span></div>
                <div className="flex items-center"><span className="w-36 font-bold">Teacher:</span> <span className="border-b border-[#94a3b8] flex-1 py-1">{teacherName || '-'}</span></div>
            </div>
        </div>
    );
}

function SummaryRow({ label, value }: { label: string, value: any }) {
    return (
        <div className="flex items-center text-xs font-bold bg-[#f1f5f9] border border-[#cbd5e1] p-1">
            <span className="flex-1">{label}</span>
            <span className="text-[#1e40af]">{value !== undefined && value !== null ? value : '-'}</span>
        </div>
    );
}

function SignatureLine({ title, className, signatureUrl }: { title: string, className?: string, signatureUrl?: string }) {
    return (
        <div className={cn("text-center", className)}>
            <div className="h-8 border-b border-[#274c77] mb-1 flex items-center justify-center relative">
                {signatureUrl && (
                    <img src={signatureUrl} alt="Sign" className="max-h-7 max-w-full object-contain absolute bottom-0.5" />
                )}
            </div>
            <div className="text-[10px] font-bold uppercase">{title}</div>
        </div>
    );
}


function translateRemarks(grade?: string) {
    if (!grade) return '';
    if (grade === 'A+') return 'Excellent';
    if (grade === 'A') return 'Very Good';
    if (grade === 'B') return 'Good';
    if (grade === 'C') return 'Fair';
    if (grade === 'D') return 'Poor';
    if (grade === 'E') return 'Pass';
    if (grade?.toLowerCase() === 'absent' || grade?.toLowerCase() === 'abs') return 'Absent';
    if (grade?.toLowerCase() === 'fail' || grade === 'F') return 'Fail';
    return '-';
}
