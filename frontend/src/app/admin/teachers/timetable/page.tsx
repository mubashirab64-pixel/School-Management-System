"use client";
import React, { useState, useEffect } from "react";
import { getTeacherTimetable, getStoredUserProfile, getShiftTimings, refreshUserProfile } from "@/lib/api";
import { AlertCircle, CalendarDays, Clock } from "lucide-react";

// --- Types ---
interface PeriodAssignment {
    id: string
    day: string
    timeSlot: string
    grade: string
    section: string
    subject: string
    teacherId: number
    teacherName: string
}

const WEEK_DAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
];

// Remove hardcoded TIME_SLOTS

const TeacherTimetablePage = () => {
    const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
    const [selectedDay, setSelectedDay] = useState<string>(
        WEEK_DAYS.includes(todayName) ? todayName : WEEK_DAYS[0]
    );
    const [assignments, setAssignments] = useState<PeriodAssignment[]>([]);
    const [teacherName, setTeacherName] = useState<string>("Loading...");
    const [userProfile, setUserProfile] = useState<any>(null);
    const [timeSlots, setTimeSlots] = useState<{ id: number; start_time: string; end_time: string; name?: string; is_break?: boolean; days?: string[] }[]>([]);

    // In a real app, we would get the logged-in teacher's ID from context/auth
    // For this demo, we'll try to find the first teacher who has assignments, or just show all for debug
    // or better, let's just show assignments for a specific teacher ID if we knew it.
    // Since we don't have a teacher login flow active here (we are in admin view), 
    // we might want to show a selector OR just show assignments for "Teacher 1" as a demo.
    // However, the user request implies this page is for the teacher to view *their* timetable.
    // Let's assume we can get the teacher ID from localStorage if set, or just filter for *any* assignment to show *something*.

    useEffect(() => {
        const fetchTimetableAndSlots = async () => {
            // Fetch fresh profile to ensure teacher_id is present
            let profile = getStoredUserProfile();
            try {
                const fresh = await refreshUserProfile();
                if (fresh) profile = fresh;
            } catch (err) {
                console.error("Failed to refresh profile", err);
            }
            
            setUserProfile(profile);
            const teacherId = profile?.teacher_id || profile?.id || profile?.pk;
            console.log('TeacherTimetablePage: detected teacherId', teacherId, 'from profile', profile);

            if (!teacherId) {
                setTeacherName("No Data Found");
                setAssignments([]);
                return;
            }
            setTeacherName(profile?.full_name || profile?.name || profile?.username || "Teacher");
            try {
                // Fetch time slots from backend using teacher's shift if available
                let campusId: number | undefined = undefined;
                if (profile?.campus && typeof profile.campus === 'object') {
                    campusId = profile.campus.id;
                } else if (typeof profile?.campus === 'number') {
                    campusId = profile.campus;
                } else {
                    campusId = parseInt(localStorage.getItem('sis_campus_id') || '1');
                }

                const teacherShift = profile?.shift || 'morning';
                const slots = await getShiftTimings(campusId || 1, teacherShift);
                
                // Filter slots to only show 'teacher' type slots and sort them
                const filteredSlots = (slots || []).filter((s: any) => 
                    (s.timetable_type || 'class') === 'teacher'
                );
                filteredSlots.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
                
                setTimeSlots(filteredSlots);

                const periods = await getTeacherTimetable({ teacher: teacherId });
                console.log('TeacherTimetablePage: periods from API', periods);
                // Map API response to PeriodAssignment[]
                const formatSlot = (start: string, end: string) => {
                    // Remove seconds, keep HH:MM
                    const s = start.split(":").slice(0, 2).join(":");
                    const e = end.split(":").slice(0, 2).join(":");
                    return `${s} - ${e}`;
                };
                const mapped = (periods || []).map((p: {
                    id?: number | string;
                    day: string;
                    start_time: string;
                    end_time: string;
                    grade?: string;
                    classroom?: { grade: string; section: string };
                    section?: string;
                    subject_name?: string;
                    subject?: { name: string };
                    teacher?: number;
                }) => ({
                    id: p.id?.toString() || "",
                    day: p.day?.charAt(0).toUpperCase() + p.day?.slice(1) || "",
                    timeSlot: formatSlot(p.start_time, p.end_time),
                    grade: p.grade || p.classroom?.grade || "",
                    section: p.section || p.classroom?.section || "",
                    subject: p.subject_name || p.subject?.name || "",
                    teacherId: p.teacher || teacherId,
                    teacherName: profile?.full_name || "",
                }));
                console.log('TeacherTimetablePage: mapped assignments', mapped);
                mapped.forEach((a: PeriodAssignment, i: number) => {
                    console.log(`Assignment[${i}]: day='${a.day}', timeSlot='${a.timeSlot}', subject='${a.subject}', grade='${a.grade}', section='${a.section}'`);
                });
                setAssignments(mapped);
            } catch (err) {
                console.error('Error fetching timetable:', err);
                setAssignments([]);
                setTimeSlots([]);
            }
        };
        fetchTimetableAndSlots();
    }, []);

    const getPeriodForSlot = (start: string, end: string) => {
        // Robust matching: ignore case, trim spaces
        const slotStr = `${start.split(":").slice(0, 2).join(":")} - ${end.split(":").slice(0, 2).join(":")}`;
        return assignments.find(a =>
            a.day.trim().toLowerCase() === selectedDay.trim().toLowerCase() &&
            a.timeSlot.replace(/\s+/g, '').toLowerCase() === slotStr.replace(/\s+/g, '').toLowerCase()
        );
    };

    const formatDisplayTime = (start: string, end: string) => {
        const sArr = start.split(":");
        const eArr = end.split(":");
        let sHour = parseInt(sArr[0], 10);
        let eHour = parseInt(eArr[0], 10);
        const sMin = sArr[1];
        const eMin = eArr[1];
        const sAmpm = sHour >= 12 ? 'PM' : 'AM';
        const eAmpm = eHour >= 12 ? 'PM' : 'AM';
        sHour = sHour % 12 || 12;
        eHour = eHour % 12 || 12;
        return `${sHour.toString().padStart(2, '0')}:${sMin} ${sAmpm} - ${eHour.toString().padStart(2, '0')}:${eMin} ${eAmpm}`;
    };

    // isBreakTime was unused - removed

    return (
        <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
            {/* Professional Compact Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-4">
                    <div className="bg-[#6096ba]/10 p-3 rounded-xl">
                        <CalendarDays className="h-6 w-6 text-[#6096ba]" />
                    </div>
                    <div>
                        <h2 className="text-[#274c77] font-extrabold text-2xl tracking-tight">My Schedule</h2>
                        <p className="text-slate-400 text-sm font-medium">Weekly class timetable</p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#274c77] to-[#6096ba] flex items-center justify-center text-white font-bold shadow-md">
                            {teacherName.charAt(0)}
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Teacher</p>
                            <p className="text-[#274c77] font-bold text-sm">{teacherName}</p>
                        </div>
                    </div>
                    <div className="h-10 w-px bg-slate-100 hidden sm:block" />
                    <div className="hidden sm:block">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Shift</p>
                        <p className="text-[#6096ba] font-bold text-sm capitalize">{userProfile?.shift || 'Morning'}</p>
                    </div>
                </div>
            </div>

            {/* Day Selector Tabs - Sleek Version */}
            <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex gap-1 overflow-x-auto hide-scrollbar">
                {WEEK_DAYS.map((day) => (
                    <button
                        key={day}
                        className={`px-6 py-2.5 rounded-xl font-bold transition-all duration-200 text-sm flex-1 min-w-[100px]
                        ${selectedDay === day
                                ? 'bg-[#6096ba] text-white shadow-md'
                                : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
                        onClick={() => setSelectedDay(day)}
                    >
                        {day}
                    </button>
                ))}
            </div>

            {/* Timetable Grid */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                    <h3 className="text-[#274c77] font-bold flex items-center gap-2">
                        <Clock className="h-4 w-4 text-[#6096ba]" />
                        {selectedDay} Schedule
                    </h3>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {timeSlots.length} Slots Found
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-white border-b border-slate-100">
                                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Time Slot</th>
                                <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Subject & Grade</th>
                                <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Location</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {timeSlots.map((slot, idx) => {
                                const isBreak = slot.is_break;
                                const period = getPeriodForSlot(slot.start_time, slot.end_time);
                                const displayTime = formatDisplayTime(slot.start_time, slot.end_time);

                                if (isBreak) {
                                    return (
                                        <tr key={idx} className="bg-orange-50/20">
                                            <td className="px-6 py-5 text-orange-600 font-bold text-xs">
                                                {displayTime}
                                            </td>
                                            <td colSpan={2} className="px-6 py-5 text-center">
                                                <span className="text-orange-700 font-extrabold uppercase tracking-[0.2em] text-[10px] italic">
                                                    — Rest Break —
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                }

                                return (
                                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-6 text-[#274c77] text-sm font-bold">
                                            {displayTime}
                                        </td>
                                        <td className="px-6 py-6 text-center">
                                            {period ? (
                                                <div className="inline-flex flex-col items-center">
                                                    <span className="font-extrabold text-[#274c77] text-base group-hover:text-[#6096ba] transition-colors">{period.subject}</span>
                                                    <span className="text-[#6096ba] font-bold text-[10px] mt-1 border border-[#6096ba]/20 px-2 py-0.5 rounded-full bg-[#6096ba]/5">
                                                        {period.grade} - {period.section}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-300 text-[11px] font-bold uppercase tracking-wider italic">Free Period</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-6 text-right">
                                            {period ? (
                                                <span className="text-slate-400 text-[10px] font-bold uppercase">Main Campus</span>
                                            ) : "-"}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Footer Notes */}
                <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] font-bold text-slate-400">
                    <AlertCircle className="h-3 w-3" />
                    <span>School closes at {selectedDay === "Friday" ? "12:30 PM" : "01:30 PM"}</span>
                </div>
            </div>
        </div>
    );
};

export default TeacherTimetablePage;
