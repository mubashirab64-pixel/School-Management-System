"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getStudentMyProfile, apiGet, getStudentBehaviourRecords, getStudentMonthlyBehaviourLatest, getStudentResults } from "@/lib/api";
import { usePermissions } from "@/lib/permissions";
import { useToast } from "@/hooks/use-toast";
import {
  User, GraduationCap, Calendar, MapPin, TrendingUp, Star, CheckCircle, AlertCircle, CheckCircle2,
  Download, CreditCard, Clock, BadgeCheck, LayoutDashboard, Receipt, BarChart3,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
} from 'recharts';
import { Skeleton } from "@/components/ui/skeleton";

// ── THEME COLORS ──────────────────────────────────────────────────
const themeColors = {
  primary: '#013a63',
  secondary: '#3b82f6',
  accent: '#60a5fa',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#adb5bd',
  light: '#8da9c4'
};

export default function StudentDashboardPage() {
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [student, setStudent] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [attendanceRaw, setAttendanceRaw] = useState<any[]>([]);
  const [donutRange, setDonutRange] = useState<number>(7);
  const [behaviourRecords, setBehaviourRecords] = useState<any[]>([]);
  const [monthlyMode, setMonthlyMode] = useState<boolean>(false);
  const [monthlyRecord, setMonthlyRecord] = useState<any | null>(null);
  const [feeStatus, setFeeStatus] = useState<'paid' | 'partial' | 'unpaid' | 'no_fee' | null>(null);
  const [feeBalance, setFeeBalance] = useState<number>(0);
  const [allFees, setAllFees] = useState<any[]>([]);
  const [resultsRaw, setResultsRaw] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    const token = typeof window !== "undefined" ? localStorage.getItem("sis_access_token") : null;
    if (!token) { router.replace("/login"); }
  }, []);

  useEffect(() => {
    if (!mounted) return;

    async function loadData() {
      try {
        setLoading(true);
        const data = await getStudentMyProfile();
        setStudent(data);

        // Fetch Attendance
        const today = new Date();
        const startDay = new Date(today);
        startDay.setDate(today.getDate() - 90); // Last 3 months
        const startStr = startDay.toISOString().slice(0, 10);
        const endStr = today.toISOString().slice(0, 10);
        
        const attendance = await apiGet(`/api/attendance/student/${data.id}/?start_date=${startStr}&end_date=${endStr}`);
        setAttendanceRaw(Array.isArray(attendance) ? attendance : []);

        // Fetch Behaviour
        const behaviour = await getStudentBehaviourRecords(data.id);
        const behaviourList = Array.isArray(behaviour) ? behaviour : [];
        setBehaviourRecords(behaviourList);

        const curMonth = today.getMonth();
        const hasCurrent = behaviourList.some((r: any) => {
          const d = new Date(r.week_end || r.created_at);
          return d.getMonth() === curMonth && d.getFullYear() === today.getFullYear();
        });

        if (!hasCurrent) {
          setMonthlyMode(true);
          try {
            const m = await getStudentMonthlyBehaviourLatest(data.id);
            setMonthlyRecord(m);
          } catch { setMonthlyRecord(null); }
        }

        // Fetch Fees
        const fees = await apiGet<any>(`/api/fees/student-fees/?student_id=${data.id}`);
        const feeList = Array.isArray(fees) ? fees : (fees?.results || []);
        setAllFees(feeList);

        const computeTotal = (f: any) => {
          const items = f.fee_structure_details?.items || [];
          const itemsSum = items.reduce((s: number, it: any) => s + Number(it.amount), 0);
          return (itemsSum > 0 ? itemsSum : Number(f.total_amount)) + Number(f.late_fee || 0) + Number(f.other_charges || 0);
        };

        const total = feeList.reduce((s: number, f: any) => s + computeTotal(f), 0);
        const paid = feeList.reduce((s: number, f: any) => s + Number(f.paid_amount), 0);
        setFeeBalance(total - paid);

        if (feeList.length === 0) setFeeStatus('no_fee');
        else if (feeList.every((f: any) => f.status === 'paid')) setFeeStatus('paid');
        else setFeeStatus(feeList.some((f: any) => Number(f.paid_amount) > 0) ? 'partial' : 'unpaid');

        // Fetch Results
        const results = await getStudentResults(data.id);
        setResultsRaw(Array.isArray(results) ? results : []);

      } catch (err) {
        console.error("Dashboard Load Error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [mounted]);

  // ── LOGIC COPIED FROM PROFILE PAGE ────────────────────────────────

  const { cwPct, donutData } = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (donutRange - 1));

    let sundays = 0;
    const workingDays: string[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === 0) sundays++;
      else workingDays.push(new Date(d).toISOString().slice(0, 10));
    }

    const dayToStatus: Record<string, string> = {};
    attendanceRaw.forEach(r => {
      const dtStr = r.attendance_date || r.date || r.created_at;
      const dt = new Date(dtStr);
      if (dt < start || dt > end) return;
      const key = dt.toISOString().slice(0, 10);
      dayToStatus[key] = String(r.status || '').toLowerCase();
    });

    let p = 0, a = 0, nr = 0, l = 0;
    workingDays.forEach(key => {
      const s = dayToStatus[key];
      if (s === 'present' || s === 'late') p++;
      else if (s === 'absent') a++;
      else if (s === 'leave') l++;
      else nr++;
    });

    const denom = Math.max(workingDays.length - l, 0);
    return {
      cwPct: denom ? Math.round((p / denom) * 100) : 0,
      donutData: [
        { name: 'Present', value: p },
        { name: 'Absent', value: a },
        { name: 'No Record', value: nr },
        { name: 'Sundays', value: sundays }
      ]
    };
  }, [attendanceRaw, donutRange]);

  const scoreToPercent = (key: string, score: number) => ({ 1: 25, 2: 50, 3: 75, 4: 100 }[score] || 0);

  const behaviourComputed = useMemo(() => {
    if (monthlyMode && monthlyRecord?.metrics) {
      const m = monthlyRecord.metrics;
      return {
        items: [
          { label: 'Punctuality', value: m.punctuality || 0 },
          { label: 'Obedience', value: m.obedience || 0 },
          { label: 'Class Behaviour', value: m.classBehaviour || 0 },
          { label: 'Participation', value: m.participation || 0 },
          { label: 'Homework', value: m.homework || 0 },
          { label: 'Respect', value: m.respect || 0 }
        ]
      };
    }
    const latest = behaviourRecords.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    if (!latest) return null;
    const m = latest.metrics || {};
    return {
      items: [
        { label: 'Punctuality', value: scoreToPercent('p', m.punctuality) },
        { label: 'Obedience', value: scoreToPercent('o', m.obedience) },
        { label: 'Class Behaviour', value: scoreToPercent('c', m.classBehaviour) },
        { label: 'Participation', value: scoreToPercent('pa', m.participation) },
        { label: 'Homework', value: scoreToPercent('h', m.homework) },
        { label: 'Respect', value: scoreToPercent('r', m.respect) }
      ]
    };
  }, [behaviourRecords, monthlyMode, monthlyRecord]);

  // Dynamic Results Logic
  const latestResult = useMemo(() => {
    if (!resultsRaw || resultsRaw.length === 0) return null;
    return [...resultsRaw].sort((a, b) => {
      // Prioritize final_term, then mid_term, then monthly
      const typeRank: Record<string, number> = { 'final_term': 3, 'mid_term': 2, 'monthly': 1 };
      const rankA = typeRank[a.exam_type] || 0;
      const rankB = typeRank[b.exam_type] || 0;
      if (rankA !== rankB) return rankB - rankA;
      return b.id - a.id;
    })[0];
  }, [resultsRaw]);

  const performanceData = useMemo(() => {
    if (!latestResult || !latestResult.subject_marks) return [];
    
    return latestResult.subject_marks.map((sm: any) => ({
      subject: sm.subject_name.length > 8 ? sm.subject_name.substring(0, 8) + '..' : sm.subject_name,
      score: Math.round(sm.obtained_marks / sm.total_marks * 100)
    }));
  }, [latestResult]);

  const profileCompletion = useMemo(() => {
    if (!student) return 0;
    const fields = [
      'name', 'father_name', 'email', 'phone', 'current_grade', 
      'section', 'shift', 'campus', 'photo', 'gender', 
      'blood_group', 'emergency_contact_number', 'parent_phone_number_2',
      'dob', 'address', 'gr_no', 'b_form_number'
    ];
    const filled = fields.filter(f => student[f] && String(student[f]).trim() !== '').length;
    return Math.round((filled / fields.length) * 100);
  }, [student]);

  const behaviourStatus = useMemo(() => {
    if (!behaviourComputed) return "Good";
    const items = behaviourComputed.items;
    const avg = items.reduce((s: number, it: any) => s + it.value, 0) / (items.length || 1);
    if (avg >= 85) return "Excellent";
    if (avg >= 70) return "Good";
    if (avg >= 50) return "Average";
    return "Needs Improvement";
  }, [behaviourComputed]);

  const permissions = usePermissions();

  if (!mounted || loading) return <SkeletonPage />;

  // Access check
  if (!permissions.canViewStudentDashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <Card className="max-w-md w-full rounded-[2rem] border-0 shadow-2xl p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-rose-100/50">
            <LayoutDashboard className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Access Restricted</h2>
            <p className="text-slate-500 text-sm font-medium leading-relaxed">
              Your dashboard access has been temporarily disabled by the administration. Please contact your coordinator for support.
            </p>
          </div>
          <Button 
            className="w-full h-12 bg-[#013a63] hover:bg-[#01497c] text-white font-bold rounded-2xl shadow-lg transition-all"
            onClick={() => router.push("/")}
          >
            Go Back
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-12">
      <div className=" mx-auto px-4 py-8 space-y-8">
        
        {/* ── HERO BANNER ─────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#013a63] via-[#01497c] to-[#014f86] p-8 text-white shadow-2xl border border-white/10">
          <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-blue-400/10 blur-2xl" />
          
          <div className="relative flex flex-col md:flex-row items-center gap-8">
            <div className="relative group">
              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl bg-white/10 backdrop-blur-md border-2 border-white/20 flex items-center justify-center overflow-hidden shadow-2xl group-hover:scale-105 transition-transform duration-500">
                {student?.photo ? (
                  <img src={student.photo} alt="Student" className="w-full h-full object-cover" />
                ) : (
                  <GraduationCap className="w-12 h-12 sm:w-16 sm:h-16 text-white/50" />
                )}
              </div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-500 rounded-2xl border-4 border-[#013a63] flex items-center justify-center shadow-lg">
                <BadgeCheck className="w-4 h-4 text-white" />
              </div>
            </div>

            <div className="flex-1 text-center md:text-left space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 backdrop-blur-sm text-[10px] uppercase tracking-widest font-bold text-blue-100">
                Student Dashboard
              </div>
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight">{student?.name}</h1>
              <div className="flex flex-wrap justify-center md:justify-start gap-3">
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-white/10 backdrop-blur-md text-xs font-bold border border-white/10">
                  <span className="text-blue-300">ID:</span> {student?.student_id}
                </div>
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-white/10 backdrop-blur-md text-xs font-bold border border-white/10">
                  <span className="text-blue-300">Class:</span> {student?.current_grade}
                </div>
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-white/10 backdrop-blur-md text-xs font-bold border border-white/10">
                  <MapPin className="w-3 h-3 text-blue-300" /> {student?.campus_name}
                </div>
              </div>
            </div>

            <div className="bg-white/5 rounded-[2rem] p-6 backdrop-blur-md border border-white/10 min-w-[200px] text-center md:text-right">
              <p className="text-blue-200 text-[10px] font-bold uppercase tracking-widest mb-1">Financial State</p>
              <h2 className="text-2xl font-black">Rs {feeBalance.toLocaleString()}</h2>
              <p className={`text-[10px] font-bold uppercase mt-1 ${feeBalance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {feeBalance > 0 ? "Outstanding Dues" : "No Balance Dues"}
              </p>
            </div>
          </div>
        </div>

        {/* ── KPI GRID ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          <KPICard title="Attendance" value={`${cwPct}%`} icon={Calendar} color="bg-blue-500" />
          <KPICard 
            title="Overall Score" 
            value={latestResult ? `${Math.round(latestResult.percentage)}%` : "N/A"} 
            icon={TrendingUp} 
            color="bg-emerald-500" 
          />
          <KPICard 
            title="Profile Status" 
            value={profileCompletion === 100 ? "Complete" : `${profileCompletion}%`} 
            icon={BadgeCheck} 
            color="bg-violet-500" 
          />
          <KPICard 
            title="Behaviour" 
            value={behaviourStatus} 
            icon={Star} 
            color="bg-amber-500" 
          />
        </div>

        {/* ── MAIN TABS (MATCHING PROFILE PAGE) ─────────────────────── */}
        <Tabs defaultValue="academics" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8 h-12 sm:h-14 bg-white border border-slate-200 p-1 rounded-2xl shadow-sm">
            <TabsTrigger value="academics" className="data-[state=active]:bg-[#013a63] data-[state=active]:text-white data-[state=active]:shadow-md rounded-xl font-bold flex gap-2">
              <TrendingUp className="w-4 h-4" /> Performance & Behaviour
            </TabsTrigger>
            <TabsTrigger value="financials" className="data-[state=active]:bg-[#013a63] data-[state=active]:text-white data-[state=active]:shadow-md rounded-xl font-bold flex gap-2">
              <CreditCard className="w-4 h-4" /> Financial Overview
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: ACADEMICS */}
          <TabsContent value="academics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Attendance Donut */}
              <Card className="rounded-3xl border-0 shadow-sm overflow-hidden bg-white">
                <CardHeader className="pb-0 border-b border-slate-50">
                  <div className="flex items-center justify-between py-2">
                    <CardTitle className="text-lg font-bold text-slate-800">Attendance Insight</CardTitle>
                    <Select value={String(donutRange)} onValueChange={(v) => setDonutRange(parseInt(v))}>
                      <SelectTrigger className="h-8 w-[130px] rounded-xl border-slate-100 bg-slate-50 text-[10px] font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">Last 7 Days</SelectItem>
                        <SelectItem value="30">Last Month</SelectItem>
                        <SelectItem value="90">Last Quarter</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent className="h-[350px] relative flex items-center justify-center p-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="65%" outerRadius="85%" stroke="#fff" strokeWidth={3}>
                        <Cell fill={themeColors.success} />
                        <Cell fill={themeColors.error} />
                        <Cell fill={themeColors.info} />
                        <Cell fill={themeColors.secondary} />
                      </Pie>
                      <Tooltip />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-4xl font-black text-slate-800">{cwPct}%</span>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Present</span>
                  </div>
                </CardContent>
              </Card>

              {/* Subject Progress */}
              <Card className="rounded-3xl border-0 shadow-sm overflow-hidden bg-white">
                <CardHeader className="pb-0 border-b border-slate-50">
                   <CardTitle className="text-lg font-bold text-slate-800 py-2">Subject Performance</CardTitle>
                </CardHeader>
                <CardContent className="h-[350px] p-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={performanceData.length > 0 ? performanceData : [{subject: 'No Data', score: 0}]} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="subject" tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                      <YAxis hide domain={[0, 100]} />
                      <Tooltip cursor={{fill: '#f8fafc'}} />
                      <Bar dataKey="score" fill="#3b82f6" radius={[8, 8, 0, 0]} barSize={24}>
                        <LabelList dataKey="score" position="top" style={{ fontSize: '10px', fontWeight: 'bold', fill: '#64748b' }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Behaviour Radar */}
            <Card className="rounded-3xl border-0 shadow-sm overflow-hidden bg-white">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                <CardTitle className="text-lg font-bold text-slate-800">Behaviour Snapshot</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {behaviourComputed ? (
                  <div className="grid grid-cols-1 lg:grid-cols-12 h-[350px]">
                    <div className="lg:col-span-5 border-r border-slate-100 p-8 flex flex-col justify-center space-y-6 overflow-y-auto hidden lg:flex">
                      {behaviourComputed.items.map((it: any) => (
                        <div key={it.label} className="space-y-2">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-slate-500 uppercase tracking-wider">{it.label}</span>
                            <span className="text-slate-800">{it.value}%</span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                            <div className="h-full bg-blue-500 rounded-full shadow-lg" style={{ width: `${it.value}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="lg:col-span-7 p-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={behaviourComputed.items} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                          <PolarGrid stroke="#f1f5f9" />
                          <PolarAngleAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} />
                          <Radar name="Student" dataKey="value" stroke={themeColors.secondary} fill={themeColors.secondary} fillOpacity={0.6} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                   <div className="py-20 text-center text-slate-400 font-medium">No behaviour data available.</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: FINANCIALS */}
          <TabsContent value="financials" className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FinanceCard title="Arrears Balance" value={`Rs ${feeBalance.toLocaleString()}`} icon={AlertCircle} color="bg-rose-500" />
                <FinanceCard title="Total Paid" value={`Rs ${(allFees.reduce((s,f)=>s+Number(f.paid_amount),0)).toLocaleString()}`} icon={CheckCircle2} color="bg-emerald-500" />
                <Card className="bg-[#013a63] text-white rounded-[2rem] p-6 shadow-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-8 -mt-8 group-hover:scale-125 transition-transform" />
                  <div className="relative z-10 flex flex-col justify-between h-full">
                    <div>
                      <h4 className="font-bold text-lg">Quick Actions</h4>
                      <p className="text-blue-100/60 text-xs">Manage your school financials</p>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button 
                        className="flex-1 bg-white text-[#013a63] hover:bg-white/90 font-bold rounded-xl h-10"
                        onClick={() => router.push('/student/pay-fees')}
                      >   
                        Pay Online
                      </Button>
                    </div>
                  </div>
                </Card>
             </div>

             <Card className="rounded-3xl border-0 shadow-sm overflow-hidden bg-white">
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 bg-white">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                        <Receipt className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-black text-slate-800 text-base leading-none">Fee History</h3>
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{allFees.length} Challan{allFees.length !== 1 ? 's' : ''} Record Found</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Column Labels — Perfectly matched to row structure */}
                  <div className="hidden sm:flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">
                    <span className="w-28 pl-4">Month</span>
                    <div className="flex-1 flex items-center justify-between pr-4">
                      <span className="w-28 text-right">Total</span>
                      <span className="w-28 text-right">Paid</span>
                      <span className="w-28 text-right">Balance</span>
                      <span className="w-28 text-center">Status</span>
                      <span className="w-28 text-center">Action</span>
                    </div>
                  </div>
                </div>

                {/* Scrollable list — max 10 rows visible */}
                <div className={allFees.length > 5 ? "overflow-y-auto max-h-[400px] scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent" : ""}>
                  {allFees.length > 0 ? (
                    [...allFees]
                      .sort((a, b) => b.year - a.year || b.month - a.month)
                      .map((f, idx) => {
                        const total = Number(f.total_amount);
                        const paid = Number(f.paid_amount);
                        const balance = total - paid;
                        const isPaid = f.status === 'paid';
                        const isPartial = !isPaid && paid > 0;
                        return (
                          <div
                            key={f.id}
                            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-slate-50/70 border-b border-slate-50 last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                          >
                            {/* Month Badge + Name (Left side) */}
                            <div className="flex items-center gap-4 sm:w-28 shrink-0">
                              <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-black shrink-0 shadow-sm ${isPaid ? 'bg-emerald-50 border border-emerald-100' : isPartial ? 'bg-amber-50 border border-amber-100' : 'bg-rose-50 border border-rose-100'}`}>
                                <span className={`text-[9px] font-bold leading-none ${isPaid ? 'text-emerald-400' : isPartial ? 'text-amber-400' : 'text-rose-400'}`}>{f.year}</span>
                                <span className={`text-sm font-black leading-tight ${isPaid ? 'text-emerald-600' : isPartial ? 'text-amber-600' : 'text-rose-600'}`}>
                                  {new Date(0, f.month - 1).toLocaleString('en-US', { month: 'short' })}
                                </span>
                              </div>
                              <div className="sm:hidden">
                                <p className="font-bold text-slate-800 text-sm">
                                  {new Date(0, f.month - 1).toLocaleString('en-US', { month: 'long' })} {f.year}
                                </p>
                                <p className="text-[10px] text-slate-400 font-semibold">Invoice #{f.invoice_number || f.id}</p>
                              </div>
                            </div>

                            {/* Desktop Columns (Flexible right side) */}
                            <div className="hidden sm:flex items-center flex-1 justify-between pr-4">
                              <div className="w-28 text-right">
                                <p className="text-sm font-black text-slate-800">Rs {total.toLocaleString()}</p>
                              </div>
                              <div className="w-28 text-right">
                                <p className="text-sm font-bold text-emerald-600">Rs {paid.toLocaleString()}</p>
                              </div>
                              <div className="w-28 text-right">
                                <p className={`text-sm font-bold ${balance > 0 ? 'text-rose-500' : 'text-slate-300'}`}>
                                  {balance > 0 ? `Rs ${balance.toLocaleString()}` : '—'}
                                </p>
                              </div>
                              
                              <div className="w-28 flex justify-center">
                                <span className={`text-[9px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full border ${
                                  isPaid
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                    : isPartial
                                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                                    : 'bg-rose-50 border-rose-200 text-rose-600'
                                }`}>
                                  {isPaid ? 'Paid' : isPartial ? 'Partial' : 'Unpaid'}
                                </span>
                              </div>

                              <div className="w-28 flex justify-center text-right">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-xl border-slate-200 font-bold text-slate-600 hover:bg-[#013a63] hover:text-white hover:border-[#013a63] h-9 px-4 transition-all text-xs gap-1.5"
                                  onClick={() => window.open(`/admin/fees/challan/${f.id}`, '_blank')}
                                >
                                  <Download className="w-3.5 h-3.5" /> Challan
                                </Button>
                              </div>
                            </div>

                            {/* Mobile Layout (fallback) */}
                            <div className="sm:hidden space-y-4">
                              <div className="flex gap-6">
                                <div>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total</p>
                                  <p className="font-black text-slate-800 text-sm">Rs {total.toLocaleString()}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Paid</p>
                                  <p className="font-bold text-emerald-600 text-sm">Rs {paid.toLocaleString()}</p>
                                </div>
                                {balance > 0 && (
                                  <div>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Due</p>
                                    <p className="font-bold text-rose-500 text-sm">Rs {balance.toLocaleString()}</p>
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-3">
                                <span className={`text-[9px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full border ${
                                  isPaid ? 'bg-emerald-50 text-emerald-700' : isPartial ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-600'
                                }`}>
                                  {isPaid ? 'Paid' : isPartial ? 'Partial' : 'Unpaid'}
                                </span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-full rounded-xl border-slate-200 font-bold text-slate-600 h-9 text-xs"
                                  onClick={() => window.open(`/admin/fees/challan/${f.id}`, '_blank')}
                                >
                                  <Download className="w-3.5 h-3.5 mr-2" /> Download
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                  ) : (
                    <div className="py-16 text-center">
                      <Receipt className="w-12 h-12 text-slate-100 mx-auto mb-3" />
                      <p className="text-slate-400 font-bold text-sm">No fee records found.</p>
                    </div>
                  )}
                </div>

                {/* Scroll hint if more than 10 */}
                {allFees.length > 5 && (
                  <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-center">
                    <p className="text-[10px] text-slate-400 font-semibold">Scroll to see all {allFees.length} records</p>
                  </div>
                )}
             </Card>
          </TabsContent>
        </Tabs>

      </div>
    </div>
  );
}

// ── HELPER COMPONENTS ─────────────────────────────────────────────

function KPICard({ title, value, icon: Icon, color }: any) {
  return (
    <Card className="border-0 shadow-lg bg-white overflow-hidden rounded-[2rem] group hover:scale-[1.02] transition-all duration-300">
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div className="space-y-4">
            <div className={`w-12 h-12 rounded-2xl ${color} flex items-center justify-center text-white shadow-lg shadow-blue-100`}>
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-slate-400 text-[10px] font-bold tracking-widest uppercase">{title}</p>
              <h3 className="text-2xl font-black text-slate-800">{value}</h3>
            </div>
          </div>
          <div className="h-2 w-12 bg-slate-100 rounded-full overflow-hidden self-end">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: '60%' }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FinanceCard({ title, value, icon: Icon, color }: any) {
  return (
    <Card className={`border-0 shadow-lg bg-white rounded-[2rem] overflow-hidden border-l-4 ${color.replace('bg-', 'border-')}`}>
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className="text-slate-400 text-[10px] font-bold tracking-widest uppercase">{title}</p>
          <h3 className="text-2xl font-black text-slate-800 mt-1">{value}</h3>
        </div>
        <div className={`w-12 h-12 rounded-2xl ${color.replace('bg-', 'bg-opacity-10 text-')} flex items-center justify-center`}>
          <Icon className="w-6 h-6" />
        </div>
      </CardContent>
    </Card>
  );
}

const dummyProgress = []; // Deprecated, using performanceData now

function SkeletonPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 animate-pulse">
      <div className="h-64 bg-slate-200 rounded-[2.5rem]" />
      <div className="grid grid-cols-4 gap-6">
        {[1,2,3,4].map(i => <div key={i} className="h-32 bg-slate-200 rounded-[2rem]" />)}
      </div>
      <div className="h-14 bg-slate-200 rounded-2xl" />
      <div className="h-96 bg-slate-200 rounded-3xl" />
    </div>
  );
}
