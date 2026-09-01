"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  GraduationCap, 
  FileText, 
  Download, 
  Trophy, 
  User, 
  Calendar,
  ClipboardList,
  RefreshCw,
  TrendingUp,
  MapPin,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Star,
  MessageSquare,
  StickyNote,
  Clock,
  CheckCircle,
  BookOpen,
  PieChart,
  Award,
  MoreVertical
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AreaChart,
  Area,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { getStudentResults, getCurrentUserProfile, getStudentRetests } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// Constants for Grade colors
const getGradeColor = (grade: string) => {
  if (!grade) return 'text-slate-400 bg-slate-50';
  if (grade === 'Absent') return 'text-amber-600 bg-amber-50 border-amber-100';
  const g = grade?.toUpperCase();
  if (g?.startsWith('A')) return 'text-emerald-600 bg-emerald-50 border-emerald-100';
  if (g?.startsWith('B')) return 'text-blue-600 bg-blue-50 border-blue-100';
  if (g?.startsWith('C')) return 'text-amber-600 bg-amber-50 border-amber-100';
  if (g?.startsWith('D')) return 'text-orange-600 bg-orange-50 border-orange-100';
  if (g === 'ABSENT' || g === 'ABS') return 'text-amber-600 bg-amber-50 border-amber-100';
  return 'text-rose-600 bg-rose-50 border-rose-100';
};

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'pass': return 'text-emerald-600 bg-emerald-50 border-emerald-100';
    case 'approved': return 'text-emerald-600 bg-emerald-50 border-emerald-100';
    case 'fail': return 'text-rose-600 bg-rose-50 border-rose-100';
    case 'absent': return 'text-amber-600 bg-amber-50 border-amber-100';
    default: return 'text-slate-600 bg-slate-50 border-slate-100';
  }
};

const TAB_COLORS = {
  indigo: { bg: 'bg-indigo-600', text: 'text-indigo-600', border: 'border-indigo-600', shadow: 'shadow-indigo-600/10', light: 'bg-indigo-50' },
  amber: { bg: 'bg-amber-600', text: 'text-amber-600', border: 'border-amber-600', shadow: 'shadow-amber-600/10', light: 'bg-amber-50' },
  emerald: { bg: 'bg-emerald-600', text: 'text-emerald-600', border: 'border-emerald-600', shadow: 'shadow-emerald-600/10', light: 'bg-emerald-50' },
  purple: { bg: 'bg-purple-600', text: 'text-purple-600', border: 'border-purple-600', shadow: 'shadow-purple-600/10', light: 'bg-purple-50' },
  blue: { bg: 'bg-blue-600', text: 'text-blue-600', border: 'border-blue-600', shadow: 'shadow-blue-600/10', light: 'bg-blue-50' },
  rose: { bg: 'bg-rose-600', text: 'text-rose-600', border: 'border-rose-600', shadow: 'shadow-rose-600/10', light: 'bg-rose-50' },
};

export default function StudentResultsPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [allResults, setAllResults] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'monthly' | 'midterm' | 'final' | 'retest'>('monthly');
  const [retests, setRetests] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("2024-2025");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [profileData, resultsData, retestData] = await Promise.all([
        getCurrentUserProfile(),
        getStudentResults() as Promise<any[]>,
        getStudentRetests() as Promise<any[]>
      ]);
      setProfile(profileData);
      setAllResults(resultsData);
      setRetests(Array.isArray(retestData) ? retestData : []);
      
      if (resultsData.length > 0) {
        setSelectedYear(resultsData[0].overall.academic_year);
      }
    } catch (error) {
      console.error("Failed to fetch student data:", error);
      toast.error("Failed to load results. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    allResults.forEach(r => {
      if (r.overall?.academic_year) {
        years.add(r.overall.academic_year);
      }
    });
    // Ensure the current selected year is at least available
    if (selectedYear) years.add(selectedYear);
    // If absolutely nothing, add a fallback
    if (years.size === 0) years.add("2024-2025");
    
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [allResults, selectedYear]);

  const monthlyResults = useMemo(() => 
    allResults.filter(r => r.overall.exam_type === 'monthly' && r.overall.academic_year === selectedYear),
  [allResults, selectedYear]);

  const midTermResults = useMemo(() => 
    allResults.find(r => r.overall.exam_type === 'midterm' && r.overall.academic_year === selectedYear),
  [allResults, selectedYear]);

  const finalTermResults = useMemo(() => 
    allResults.find(r => r.overall.exam_type === 'final' && r.overall.academic_year === selectedYear),
  [allResults, selectedYear]);

  const chartData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return monthlyResults
      .sort((a, b) => {
        const m1 = months.indexOf(a.overall.month?.slice(0, 3));
        const m2 = months.indexOf(b.overall.month?.slice(0, 3));
        return m1 - m2;
      })
      .map(r => ({
        name: r.overall.month?.slice(0, 3),
        percentage: parseFloat(r.overall.percentage) || 0
      }));
  }, [monthlyResults]);

  const activeResult = useMemo(() => {
    if (activeTab === 'monthly') {
      if (selectedMonth === 'all') return monthlyResults[0];
      return monthlyResults.find(r => r.overall.month === selectedMonth);
    }
    if (activeTab === 'midterm') return midTermResults;
    return finalTermResults;
  }, [activeTab, monthlyResults, midTermResults, finalTermResults, selectedMonth]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-8 space-y-8">
        {/* Profile Header Skeleton */}
        <Card className="rounded-[2rem] border-none shadow-sm bg-white overflow-hidden p-8">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <Skeleton className="w-32 h-32 rounded-[2rem]" />
            <div className="flex-1 space-y-4 w-full">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-64 rounded-xl" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
              <div className="flex flex-wrap gap-6">
                <Skeleton className="h-6 w-40 rounded-lg" />
                <Skeleton className="h-6 w-48 rounded-lg" />
              </div>
            </div>
            <Skeleton className="h-14 w-full md:w-60 rounded-2xl shrink-0" />
          </div>
        </Card>

        {/* Tab Selection Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-[2.2rem]" />
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 space-y-8 min-w-0">
            {/* Stats Grid Skeleton */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-36 rounded-[2rem]" />
              ))}
            </div>

            {/* Content Area Skeleton */}
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <Skeleton className="h-9 w-64 rounded-xl" />
                <Skeleton className="h-11 w-48 rounded-xl" />
              </div>
              
              <Card className="rounded-[2.2rem] border-none shadow-sm bg-white overflow-hidden">
                <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                  <div className="flex gap-4">
                    <Skeleton className="w-10 h-10 rounded-xl" />
                    <Skeleton className="h-8 w-48 rounded-lg" />
                  </div>
                  <Skeleton className="h-6 w-32 rounded-full" />
                </div>
                <div className="p-8 space-y-6">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center justify-between gap-8">
                      <div className="flex items-center gap-4 flex-1">
                        <Skeleton className="w-10 h-10 rounded-xl" />
                        <Skeleton className="h-6 w-40 rounded-lg" />
                      </div>
                      <Skeleton className="h-10 w-24 rounded-lg" />
                      <Skeleton className="h-4 w-32 rounded-full flex-1 hidden md:block" />
                      <Skeleton className="h-8 w-16 rounded-lg" />
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          {/* Sidebar Skeleton */}
          <div className="w-full lg:w-80 space-y-8">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="rounded-[2.5rem] border-none shadow-sm bg-white p-8 space-y-6">
                <div className="flex gap-4">
                  <Skeleton className="w-10 h-10 rounded-xl" />
                  <Skeleton className="h-6 w-32 rounded-lg" />
                </div>
                <div className="space-y-4">
                  <Skeleton className="h-20 w-full rounded-2xl" />
                  <Skeleton className="h-12 w-full rounded-2xl" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-12">
      <div className="mb-8">
        <Card className="rounded-[2rem] border-none shadow-sm bg-white overflow-hidden">
          <CardContent className="p-0">
            <div className="flex flex-col md:flex-row items-center p-8 gap-8">
              <div className="relative">
                <div className="w-32 h-32 rounded-[2rem] bg-indigo-50 flex items-center justify-center border-4 border-white shadow-xl overflow-hidden">
                  {profile?.profile_image ? (
                    <img src={profile.profile_image} alt="Student" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-5xl font-bold text-indigo-600 select-none">
                      {(profile?.name || 'S').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center border-4 border-white shadow-lg text-white">
                  <Star className="w-5 h-5 fill-current" />
                </div>
              </div>

              <div className="flex-1 text-center md:text-left space-y-3">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                  <h1 className="text-3xl font-black text-slate-900 tracking-tight">{profile?.full_name || profile?.name}</h1>
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-100 hover:bg-emerald-500/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                    Active Student
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-y-2 gap-x-6 text-slate-500 font-bold text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                      <GraduationCap className="w-4 h-4" />
                    </div>
                    <span>{profile?.classroom?.class_name || "N/A"} • Section {profile?.classroom?.section || "N/A"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span>ID: {profile?.student_id || profile?.student_code || "N/A"}</span>
                      {profile?.gr_no && <span className="text-slate-300 font-normal">|</span>}
                      {profile?.gr_no && <span>GR: {profile.gr_no}</span>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 min-w-[240px]">
                <div className="relative group">
                  <div className="absolute -top-2 left-3 bg-white px-1 text-[10px] font-black text-slate-400 uppercase tracking-widest z-10">Academic Session</div>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="h-14 rounded-2xl border-slate-100 bg-slate-50 font-bold text-slate-700 shadow-none focus:ring-indigo-500">
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-indigo-600" />
                        <SelectValue placeholder="Select Session" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-slate-100 shadow-2xl">
                      {availableYears.map(year => (
                        <SelectItem key={year} value={year} className="font-bold py-3">
                          {year.replace('-', ' - ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { id: 'monthly', title: 'Monthly Test', desc: 'Quick performance check', icon: ClipboardList, color: 'indigo' as const },
          { id: 'midterm', title: 'Mid Term', desc: 'Detailed evaluation', icon: PieChart, color: 'amber' as const },
          { id: 'final', title: 'Final Term', desc: 'Final result & promotion', icon: Trophy, color: 'emerald' as const },
          { id: 'retest', title: 'Re-Tests', desc: `${retests.length} scheduled`, icon: RefreshCw, color: 'indigo' as const }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "relative flex items-center p-6 rounded-[2.2rem] border-2 transition-all duration-500 group overflow-hidden",
              activeTab === tab.id 
                ? `bg-white ${TAB_COLORS[tab.color].border} shadow-xl ${TAB_COLORS[tab.color].shadow}` 
                : "bg-white/50 border-transparent hover:bg-white hover:border-slate-200"
            )}
          >
            <div className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500",
              activeTab === tab.id 
                ? `${TAB_COLORS[tab.color].bg} text-white rotate-12 scale-110` 
                : "bg-slate-100 text-slate-400 group-hover:rotate-6"
            )}>
              <tab.icon className="w-7 h-7" />
            </div>
            <div className="ml-5 text-left">
              <h3 className={cn(
                "text-lg font-black tracking-tight transition-colors",
                activeTab === tab.id ? "text-slate-900" : "text-slate-400"
              )}>{tab.title}</h3>
              <p className="text-slate-400 text-xs font-bold">{tab.desc}</p>
            </div>
            {activeTab === tab.id && (
              <motion.div 
                layoutId="activeTabIndicator"
                className={cn("absolute bottom-0 left-10 right-10 h-1 rounded-t-full", TAB_COLORS[tab.color].bg)}
              />
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 space-y-8 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab + selectedMonth}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="space-y-8"
            >
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  {activeTab === 'monthly' && (
                    <>
                      <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                        <SelectTrigger className="h-11 px-4 rounded-xl border-none bg-white shadow-sm font-bold text-slate-700 min-w-[120px]">
                          <SelectValue placeholder="Month" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-none shadow-2xl">
                          <SelectItem value="all">All Months</SelectItem>
                          {Array.from(new Set(monthlyResults.map(r => r.overall.month))).map(m => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <h2 className="text-2xl font-black text-slate-900 ml-2">
                        {selectedMonth === 'all' ? 'Overall Performance' : `${selectedMonth} Results`}
                      </h2>
                    </>
                  )}
                  {activeTab === 'midterm' && <h2 className="text-2xl font-black text-slate-900">Mid-Term Performance Analysis</h2>}
                  {activeTab === 'final' && <h2 className="text-2xl font-black text-slate-900">Annual Academic Standing</h2>}
                  {activeTab === 'retest' && <h2 className="text-2xl font-black text-slate-900">My Re-Tests</h2>}
                </div>
                
                <Button className="bg-white  text-indigo-600 border-none shadow-sm rounded-xl px-6 h-11 font-black gap-2 transition-all active:scale-95">
                  <Download className="w-4 h-4" />
                  Download Marksheet
                </Button>
              </div>

              {activeResult ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {[
                      { label: 'Total Marks', value: (activeResult?.overall?.status === 'absent') ? 'N/A' : `${activeResult?.overall?.obtained_marks || 0} / ${activeResult?.overall?.total_marks || 0}`, icon: ClipboardList, color: 'indigo' as const },
                      { label: 'Percentage', value: (activeResult?.overall?.status === 'absent') ? 'N/A' : `${activeResult?.overall?.percentage || 0}%`, icon: TrendingUp, color: 'purple' as const },
                      { label: 'Grade', value: activeResult?.overall?.status === 'absent' ? 'Absent' : activeResult?.overall?.status === 'fail' ? 'Fail' : (activeResult?.overall?.grade || 'N/A'), icon: Award, color: activeResult?.overall?.status === 'absent' ? 'amber' : activeResult?.overall?.status === 'fail' ? 'rose' : 'emerald' as const },
                      { label: 'Status', value: (activeResult?.overall?.status || 'N/A').toUpperCase(), icon: CheckCircle2, color: activeResult?.overall?.status === 'absent' ? 'amber' : activeResult?.overall?.status === 'fail' ? 'rose' : 'blue' as const },
                      { label: 'Class Rank', value: (activeResult?.overall?.status === 'absent' || activeResult?.overall?.status === 'fail') ? 'N/A' : (activeResult?.overall?.position || 'N/A'), icon: BarChart3, color: 'indigo' as const, hideOnMobile: true }
                    ].map((stat, i) => (
                      <Card key={i} className={cn("rounded-[2rem] border-none shadow-sm hover:shadow-md transition-all group overflow-hidden backdrop-blur-sm bg-white/80", stat.hideOnMobile && "hidden lg:block")}>
                        <CardContent className="p-6">
                          <div className="flex flex-col items-center text-center space-y-3">
                            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110", TAB_COLORS[stat.color as keyof typeof TAB_COLORS].light, TAB_COLORS[stat.color as keyof typeof TAB_COLORS].text)}>
                              <stat.icon className="w-6 h-6" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                              <p className={cn("text-xl font-black tracking-tight", stat.label === 'Status' ? getStatusColor(stat.value) : "text-slate-900")}>
                                {stat.value}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <Card className="lg:col-span-2 rounded-[2.2rem] border-none shadow-sm bg-white overflow-hidden">
                      <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                            <BookOpen className="w-5 h-5" />
                          </div>
                          <h3 className="text-xl font-black text-slate-900 tracking-tight">Subject Wise Marks</h3>
                        </div>
                        <Badge variant="outline" className="rounded-full px-4 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400 border-slate-100">
                          {activeResult?.subject_marks?.length || 0} Subjects Total
                        </Badge>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50/50">
                              <th className="px-8 py-4 text-left font-black text-slate-400 text-[10px] uppercase tracking-widest">Subject</th>
                              <th className="px-8 py-4 text-center font-black text-slate-400 text-[10px] uppercase tracking-widest">Score</th>
                              <th className="px-8 py-4 text-center font-black text-slate-400 text-[10px] uppercase tracking-widest">Progress</th>
                              <th className="px-8 py-4 text-center font-black text-slate-400 text-[10px] uppercase tracking-widest">Grade</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {(activeResult?.subject_marks || []).map((sub: any, idx: number) => {
                              const percentage = (sub.obtained_marks / sub.total_marks) * 100;
                              const isAbsent = sub.is_absent || activeResult.is_absent || sub.grade === 'Absent' || sub.grade === 'ABS';
                              
                              return (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                                  <td className="px-8 py-5">
                                    <div className="flex items-center gap-3">
                                      <div className={cn(
                                        "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold",
                                        isAbsent ? "bg-amber-100 text-amber-600" :
                                        percentage >= 80 ? "bg-emerald-100 text-emerald-600" :
                                        percentage >= 60 ? "bg-blue-100 text-blue-600" : "bg-rose-100 text-rose-600"
                                      )}>
                                        {sub.subject_name.charAt(0)}
                                      </div>
                                      <span className="font-bold text-slate-800">{sub.subject_name}</span>
                                    </div>
                                  </td>
                                  <td className="px-8 py-5 text-center">
                                    <div className="inline-flex items-center justify-center bg-slate-100 rounded-lg px-3 py-1.5 font-mono font-bold text-slate-700">
                                      {isAbsent ? (
                                        <span className="text-amber-600">ABSENT</span>
                                      ) : (
                                        <>{sub.obtained_marks} <span className="text-slate-400 mx-1">/</span> {sub.total_marks}</>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-8 py-5 min-w-[160px]">
                                    <div className="flex flex-col gap-1.5">
                                      <div className="flex justify-between text-[10px] font-bold text-slate-400">
                                        <span>{isAbsent ? '0%' : `${Math.round(percentage)}%`}</span>
                                        <span>MAX 100</span>
                                      </div>
                                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <motion.div 
                                          initial={{ width: 0 }}
                                          animate={{ width: isAbsent ? 0 : `${percentage}%` }}
                                          transition={{ duration: 1, delay: 0.2 }}
                                          className={cn(
                                            "h-full rounded-full",
                                            isAbsent ? "bg-amber-500" :
                                            percentage >= 80 ? "bg-emerald-500" :
                                            percentage >= 60 ? "bg-blue-500" : "bg-rose-500"
                                          )}
                                        />
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-8 py-5 text-center">
                                    <Badge className={cn("rounded-lg px-3 py-1 font-bold shadow-none", isAbsent ? "text-amber-600 bg-amber-50 border-amber-100" : getGradeColor(sub.grade))}>
                                      {isAbsent ? "ABS" : (sub.grade || "N/A")}
                                    </Badge>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </Card>

                    <div className="space-y-8">
                      <Card className="rounded-[2.2rem] border-none shadow-sm bg-white overflow-hidden p-8">
                        <div className="flex items-center justify-between mb-8">
                          <h3 className="text-xl font-black text-slate-900 tracking-tight">Performance Trend</h3>
                          <div className="flex items-center gap-1 text-emerald-600 font-bold text-xs">
                             <TrendingUp className="w-3 h-3" /> +12%
                          </div>
                        </div>
                        <div className="h-48 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                              <defs>
                                <linearGradient id="colorPct" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <Tooltip 
                                contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                                cursor={{ stroke: '#4f46e5', strokeWidth: 2, strokeDasharray: '5 5' }}
                              />
                              <Area 
                                type="monotone" 
                                dataKey="percentage" 
                                stroke="#4f46e5" 
                                strokeWidth={4} 
                                fillOpacity={1} 
                                fill="url(#colorPct)" 
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex justify-between mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">
                           {chartData.map((d, i) => <span key={i}>{d.name}</span>)}
                        </div>
                      </Card>

                      {(activeResult?.overall?.status !== 'absent' && activeResult?.overall?.status !== 'fail') && (
                        <Card className="rounded-[2.2rem] border-none shadow-sm bg-indigo-600 text-white p-8 overflow-hidden relative">
                           <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                           <div className="relative z-10 space-y-6">
                              <div className="flex items-center gap-4">
                                 <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                                    <Trophy className="w-6 h-6" />
                                 </div>
                                 <div>
                                    <p className="text-indigo-100 text-xs font-bold uppercase tracking-widest">Current Class Rank</p>
                                    <h4 className="text-2xl font-black">{activeResult?.overall?.position || 'Not Assigned'}</h4>
                                 </div>
                              </div>
                              <div className="space-y-4">
                                 <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                                    <p className="text-indigo-100 text-[10px] font-black uppercase tracking-widest mb-1">Teacher's Remarks</p>
                                    <p className="text-sm text-white font-medium leading-relaxed italic">
                                       "{activeResult?.overall?.teacher_remarks || "No remarks provided for this academic period."}"
                                     </p>
                                 </div>
                                  <Button variant="outline" className="w-full rounded-xl border-white/30 bg-white/10 hover:bg-white/20 text-white font-bold h-11 border-2">
                                     View Detailed Analytics
                                  </Button>
                              </div>
                           </div>
                        </Card>
                      )}
                    </div>
                  </div>

                  {activeTab === 'monthly' && selectedMonth === 'all' && (
                    <div className="space-y-6">
                      <h3 className="text-xl font-black text-slate-900 tracking-tight">Recent Monthly Tests</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {monthlyResults.slice(0, 3).map((r, i) => (
                          <Card key={i} className="rounded-[2.2rem] border-none shadow-sm bg-white overflow-hidden hover:scale-[1.02] transition-transform cursor-pointer">
                            <CardContent className="p-8 space-y-4">
                               <div className="flex justify-between items-start">
                                  <div className="space-y-1">
                                     <h4 className="font-black text-slate-800">{r.overall.month} Monthly Test</h4>
                                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{r.overall.academic_year}</p>
                                  </div>
                                  <Badge className={cn("rounded-lg shadow-none", getStatusColor(r.overall.status))}>
                                     {r.overall.status}
                                  </Badge>
                               </div>
                                 <div className="flex items-end justify-between pt-4">
                                  <div className="space-y-1">
                                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Score</p>
                                     <p className="text-2xl font-black text-slate-900">{(r.overall.status === 'absent' || r.overall.status === 'fail') ? 'N/A' : r.overall.obtained_marks}<span className="text-sm text-slate-400">/{(r.overall.status === 'absent' || r.overall.status === 'fail') ? 'N/A' : r.overall.total_marks}</span></p>
                                  </div>
                                  <div className="text-right">
                                     <p className="text-3xl font-black text-indigo-600">{(r.overall.status === 'absent' || r.overall.status === 'fail') ? 'N/A' : `${r.overall.percentage}%`}</p>
                                  </div>
                               </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}                  {(activeResult?.overall?.status !== 'absent' && activeResult?.overall?.status !== 'fail') && (activeTab === 'midterm' || activeTab === 'final') && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <Card className="rounded-[2.2rem] border-none shadow-sm bg-white p-8 space-y-6">
                          <h3 className="text-lg font-black text-slate-900 flex items-center gap-3">
                             <CheckCircle className="w-5 h-5 text-emerald-500" />
                             Strong Areas
                          </h3>
                          <div className="space-y-4">
                             {(activeResult?.subject_marks || []).slice(0, 3).map((s: any, i: number) => (
                               <div key={i} className="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                                  <span className="font-bold text-emerald-700">{s.subject_name}</span>
                                  <span className="font-black text-emerald-600">{s.grade}</span>
                                </div>
                             ))}
                          </div>
                       </Card>
                       <Card className="rounded-[2.2rem] border-none shadow-sm bg-white p-8 space-y-6">
                          <h3 className="text-lg font-black text-slate-900 flex items-center gap-3">
                             <AlertCircle className="w-5 h-5 text-amber-500" />
                             Areas for Improvement
                          </h3>
                          <div className="space-y-4">
                             {(activeResult?.subject_marks || []).slice(-2).map((s: any, i: number) => (
                               <div key={i} className="flex items-center justify-between p-4 bg-amber-50 rounded-2xl border border-amber-100">
                                  <span className="font-bold text-amber-700">{s.subject_name}</span>
                                  <span className="font-black text-amber-600">{s.grade}</span>
                                </div>
                             ))}
                          </div>
                       </Card>
                    </div>
                  )}
                </>
              ) : (
                <Card className="rounded-[2.5rem] border-none shadow-sm bg-white p-20 text-center space-y-4">
                  <div className="w-24 h-24 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto">
                    <AlertCircle className="w-10 h-10 text-slate-300" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">No Results Found</h3>
                    <p className="text-slate-500 font-medium max-w-sm mx-auto">
                      We couldn't find any results for this academic period. Please check back later or contact your class teacher.
                    </p>
                  </div>
                </Card>
              )}
            {/* Re-Tests View */}
            {activeTab === 'retest' && (
              <Card className="rounded-[2rem] border-none shadow-sm bg-white overflow-hidden">
                <CardContent className="p-6">
                  {retests.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                      <RefreshCw className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p className="font-bold">No re-tests scheduled.</p>
                      <p className="text-sm mt-1">If you failed or were absent in any subject, your teacher will schedule a re-test.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {retests.map((rt: any, idx: number) => (
                        <div key={idx} className="border border-slate-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-md transition-all">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-black text-slate-800">{rt.subject}</span>
                              <Badge className={rt.reason === 'absent' ? 'bg-amber-100 text-amber-800 text-[10px]' : 'bg-rose-100 text-rose-800 text-[10px]'}>{rt.reason}</Badge>
                              <Badge className="bg-slate-100 text-slate-600 text-[10px] capitalize">{rt.exam_type === 'midterm' ? 'Mid Term' : rt.exam_type === 'final' ? 'Final' : `Monthly (${rt.month})`}</Badge>
                            </div>
                            {rt.scheduled_date && (
                              <p className="text-sm text-slate-500"><span className="font-bold">Date:</span> {rt.scheduled_date}{rt.scheduled_time ? ` at ${rt.scheduled_time}` : ''}</p>
                            )}
                            {rt.venue && <p className="text-sm text-slate-500"><span className="font-bold">Venue:</span> {rt.venue}</p>}
                          </div>
                          <div className="text-right flex flex-col items-end gap-1">
                            {rt.status === 'approved' ? (
                              <>
                                <Badge className={rt.pass_status === 'pass' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>{rt.pass_status?.toUpperCase()}</Badge>
                                <span className="text-sm font-bold text-slate-600">{rt.is_absent ? 'Absent' : `${rt.marks_obtained ?? '—'}/${rt.total_marks}`}</span>
                              </>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-700">{rt.status?.replace(/_/g, ' ').toUpperCase()}</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="w-full lg:w-80 space-y-8">
          <Card className="rounded-[2.5rem] border-none shadow-sm bg-white overflow-hidden group">
            <CardContent className="p-8">
               <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 transition-transform group-hover:scale-110">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">Teacher's Remark</h3>
               </div>
               
               <div className="space-y-6 relative">
                  <div className="absolute left-0 top-0 h-full w-1 bg-indigo-100 rounded-full" />
                  <div className="pl-6 space-y-4">
                    <div className="relative">
                       <MoreVertical className="absolute -left-7 top-1 w-3 h-3 text-indigo-400" />
                       <p className="text-slate-600 text-sm leading-relaxed font-medium italic">
                          "{activeResult?.overall?.teacher_remarks || "No remarks provided for this session."}"
                       </p>
                    </div>
                    <div className="flex items-center gap-3 pt-2">
                       <div className="w-10 h-10 rounded-full bg-slate-100 border-2 border-white shadow-sm overflow-hidden">
                          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${activeResult?.overall?.teacher_name || 'Teacher'}`} alt="Teacher" />
                       </div>
                       <div>
                          <p className="text-xs font-black text-slate-900">{activeResult?.overall?.teacher_name || "Class Teacher"}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{activeResult?.overall?.organization_name || "IAK School System"}</p>
                       </div>
                    </div>
                  </div>
               </div>
            </CardContent>
          </Card>

          <Card className="rounded-[2.5rem] border-none shadow-sm bg-white overflow-hidden">
            <CardContent className="p-8 space-y-6">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                    <StickyNote className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">Quick Notes</h3>
               </div>
               
               <div className="space-y-4">
                  {[
                    { text: 'Keep practicing Mathematics.', icon: Award, color: 'indigo' },
                    { text: 'Read English daily.', icon: BookOpen, color: 'amber' },
                    { text: 'Good improvement in Science.', icon: CheckCircle, color: 'emerald' }
                  ].map((note, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-sm transition-all group">
                       <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white transition-transform group-hover:rotate-12", `bg-${note.color}-500`)}>
                          <note.icon className="w-4 h-4" />
                       </div>
                       <p className="text-xs font-bold text-slate-600">{note.text}</p>
                    </div>
                  ))}
               </div>
            </CardContent>
          </Card>

          <Card className="rounded-[2.5rem] border-none shadow-sm bg-white overflow-hidden">
            <CardContent className="p-8 space-y-6">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600">
                    <Clock className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">Status Timeline</h3>
               </div>
               
               <div className="space-y-6 ml-2">
                  <div className="relative flex gap-4">
                     <div className="absolute left-[9px] top-4 bottom-0 w-0.5 bg-slate-100" />
                     <div className="w-5 h-5 rounded-full bg-emerald-500 border-4 border-emerald-100 relative z-10 shrink-0" />
                     <div className="space-y-1">
                        <p className="text-xs font-black text-slate-800">Teacher Submitted</p>
                        <p className="text-[10px] font-bold text-slate-400">Completed</p>
                     </div>
                  </div>
                  <div className="relative flex gap-4">
                     <div className="absolute left-[9px] top-4 bottom-0 w-0.5 bg-slate-100" />
                     <div className={cn("w-5 h-5 rounded-full border-4 relative z-10 shrink-0", activeResult?.overall?.status === 'approved' ? "bg-emerald-500 border-emerald-100" : "bg-slate-200 border-slate-100")} />
                     <div className="space-y-1">
                        <p className={cn("text-xs font-black", activeResult?.overall?.status === 'approved' ? "text-slate-800" : "text-slate-400")}>Coordinator Verified</p>
                        <p className="text-[10px] font-bold text-slate-400">{activeResult?.overall?.status === 'approved' ? 'Verified' : 'In Progress'}</p>
                     </div>
                  </div>
                  <div className="relative flex gap-4">
                     <div className={cn("w-5 h-5 rounded-full border-4 relative z-10 shrink-0", activeResult?.overall?.status === 'approved' ? "bg-emerald-500 border-emerald-100" : "bg-slate-200 border-slate-100")} />
                     <div className="space-y-1">
                        <p className={cn("text-xs font-black", activeResult?.overall?.status === 'approved' ? "text-slate-800" : "text-slate-400")}>Principal Released</p>
                        <p className="text-[10px] font-bold text-slate-400">{activeResult?.overall?.status === 'approved' ? 'Released' : 'Pending'}</p>
                     </div>
                  </div>
               </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
