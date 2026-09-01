"use client"

import { useState, useEffect, useMemo, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import StudentBehaviourModal from "@/components/behaviour/student-behaviour-modal"
import EnrollmentStatusCard from "@/components/students/enrollment-status-card"
import { AcademicYearJourney } from "@/components/students/academic-year-journey"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import StudentAttendanceCalendar from "@/components/attendance/student-attendance-calendar"
import { getStudentById, apiGet, createBehaviourRecord, getStudentBehaviourRecords, getStudentMonthlyBehaviourLatest, getStudentResults } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { toast as sonnerToast } from "sonner"
import { getCurrentUserRole } from '@/lib/permissions'
// import { maskId } from "@/lib/utils"
import ChallanPrintView from "@/components/fees/ChallanPrintView"
import {
  ArrowLeft, User, GraduationCap, Users, Calendar, MapPin, Award,
  TrendingUp, Star, CheckCircle, AlertCircle, Plus, CheckCircle2,
  Download, CreditCard, ChevronRight, Check
} from "lucide-react"
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
  AreaChart,
  Area,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis
} from 'recharts'
import { Skeleton } from "@/components/ui/skeleton"


function StudentProfileSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 pb-6 md:pb-8 overflow-x-hidden no-print no-print-bg">
      <div className="max-w-7xl mx-auto px-2 sm:px-3 md:px-4 py-3 sm:py-4 md:py-6 w-full no-print">
        {/* Header Skeleton */}
        <div className="rounded-lg sm:rounded-xl shadow-lg p-3 sm:p-4 md:p-6 mb-4 sm:mb-5 md:mb-6 border bg-white animate-pulse">
           <div className="flex flex-col md:flex-row items-start md:items-center md:space-x-5 gap-3 sm:gap-4">
              <Skeleton className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-slate-200" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-8 w-48 sm:w-64 bg-slate-200" />
                <Skeleton className="h-4 w-32 bg-slate-200" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-20 rounded-full bg-slate-200" />
                  <Skeleton className="h-6 w-20 rounded-full bg-slate-200" />
                  <Skeleton className="h-6 w-24 rounded-full bg-slate-200" />
                </div>
              </div>
           </div>
        </div>

        {/* KPI Cards Skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-6 mb-6 md:mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-0 shadow-lg bg-white overflow-hidden">
              <CardContent className="p-3 sm:p-6">
                <div className="space-y-3">
                  <Skeleton className="h-4 w-2/3 bg-slate-100" />
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-8 w-1/2 bg-slate-200" />
                    <Skeleton className="h-8 w-8 rounded-lg bg-slate-100" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Info Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6 mb-6 md:mb-8 items-stretch">
          <Card className="h-[360px] lg:h-[420px] bg-white border shadow-sm">
            <Skeleton className="w-full h-full bg-slate-100" />
          </Card>
          <Card className="bg-white border shadow-sm md:col-span-1 lg:col-span-2 h-auto md:h-[360px] lg:h-[420px]">
            <CardHeader className="border-b pb-4">
               <Skeleton className="h-8 w-48 bg-slate-100" />
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
                <div className="flex gap-2">
                  <Skeleton className="h-10 flex-1 rounded-md bg-slate-100" />
                  <Skeleton className="h-10 flex-1 rounded-md bg-slate-50" />
                  <Skeleton className="h-10 flex-1 rounded-md bg-slate-50" />
                </div>
                <div className="grid grid-cols-2 gap-8 mt-4">
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((j) => (
                      <div key={j} className="flex justify-between items-center border-b pb-2">
                         <Skeleton className="h-3 w-20 bg-slate-50" />
                         <Skeleton className="h-4 w-32 bg-slate-100" />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((j) => (
                      <div key={j} className="flex justify-between items-center border-b pb-2">
                         <Skeleton className="h-3 w-20 bg-slate-50" />
                         <Skeleton className="h-4 w-32 bg-slate-100" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Charts Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
           <Card className="h-[380px] bg-white">
              <CardHeader><Skeleton className="h-7 w-32 bg-slate-100" /></CardHeader>
              <CardContent className="flex flex-col items-center justify-center h-[280px]">
                 <Skeleton className="h-48 w-48 rounded-full border-8 border-slate-50 bg-transparent relative flex items-center justify-center">
                    <div className="space-y-2 flex flex-col items-center">
                       <Skeleton className="h-10 w-16 bg-slate-100" />
                       <Skeleton className="h-3 w-12 bg-slate-50" />
                    </div>
                 </Skeleton>
              </CardContent>
           </Card>
           <Card className="h-[380px] bg-white">
              <CardHeader><Skeleton className="h-7 w-32 bg-slate-100" /></CardHeader>
              <CardContent className="p-6 h-[280px] flex items-end gap-3">
                  {[40, 70, 45, 90, 60, 80, 55, 75].map((h, k) => (
                    <Skeleton key={k} className="flex-1 bg-slate-100 rounded-t-lg" style={{ height: `${h}%` }} />
                  ))}
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  )
}

const themeColors = {
  primary: '#013a63',      //
  secondary: '#3b82f6',    //
  accent: '#60a5fa',       // 
  success: '#10b981',      // 
  warning: '#f59e0b',      // 
  error: '#ef4444',        //
  info: '#adb5bd',         // 
  skyblue: '#61a5c2',      // 
  pink: '#ec4899',         // 
  gray: '#6b7280',         //
  dark: '#1f2937',         //
  light: '#8da9c4'         //
}

// Helper functions for data generation
const generatePerformanceData = (student: any, results: any[]) => {
  if (!results || results.length === 0) {
    return [
      { subject: 'Urdu', grade: 0, total: 100, classAvg: 0, color: themeColors.primary },
      { subject: 'English', grade: 0, total: 100, classAvg: 0, color: themeColors.secondary },
      { subject: 'Math', grade: 0, total: 100, classAvg: 0, color: themeColors.success },
      { subject: 'Science', grade: 0, total: 100, classAvg: 0, color: themeColors.warning },
      { subject: 'Islamiat', grade: 0, total: 100, classAvg: 0, color: themeColors.skyblue },
    ]
  }

  // Sort by exam type priority and then by ID desc
  const sorted = [...results].sort((a, b) => {
    const typeRank: Record<string, number> = { 'final_term': 3, 'mid_term': 2, 'monthly': 1 };
    const rankA = typeRank[a.exam_type] || 0;
    const rankB = typeRank[b.exam_type] || 0;
    if (rankA !== rankB) return rankB - rankA;
    return (b.id || 0) - (a.id || 0);
  });

  const latestResult = sorted[0];
  const subjectMarks = latestResult.subject_marks || latestResult.subjects || [];

  return subjectMarks.map((mark: any) => ({
    subject: mark.subject_name ? (mark.subject_name.charAt(0).toUpperCase() + mark.subject_name.slice(1).replace(/_/g, ' ')) : 'Unknown',
    grade: Math.round(mark.obtained_marks || 0),
    total: Math.round(mark.total_marks || 100),
    color: themeColors.primary,
    classAvg: Math.round(mark.class_average || 0)
  }));
}

const generateAttendanceData = (attendanceRecords: any[]) => {
  if (!attendanceRecords || attendanceRecords.length === 0) {
    return [
      { month: 'Jan', present: 22, absent: 3, total: 25, percentage: 88 },
      { month: 'Feb', present: 20, absent: 2, total: 22, percentage: 91 },
      { month: 'Mar', present: 24, absent: 1, total: 25, percentage: 96 },
      { month: 'Apr', present: 23, absent: 2, total: 25, percentage: 92 },
      { month: 'May', present: 21, absent: 4, total: 25, percentage: 84 },
      { month: 'Jun', present: 24, absent: 1, total: 25, percentage: 96 },
    ]
  }

  const monthlyData: { [key: string]: { present: number, absent: number, total: number } } = {}

  attendanceRecords.forEach(record => {
    const month = new Date(record.attendance?.date || record.date).toLocaleDateString('en-US', { month: 'short' })
    if (!monthlyData[month]) {
      monthlyData[month] = { present: 0, absent: 0, total: 0 }
    }

    if (record.status === 'present') {
      monthlyData[month].present++
    } else if (record.status === 'absent') {
      monthlyData[month].absent++
    }
    monthlyData[month].total++
  })

  return Object.entries(monthlyData).map(([month, data]) => ({
    month,
    present: data.present,
    absent: data.absent,
    total: data.total,
    percentage: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0
  }))
}



// ─── Inline Payment Submit Card ─────────────────────────────────────────────
function PaymentSubmitCard({ challanId, banks, txn, isSubmitting, onSubmit }: {
  challanId: number;
  banks: any[];
  txn: any;
  isSubmitting: boolean;
  onSubmit: (payload: { transactionId: string; bankAccountId: number; screenshot: File | null }) => void;
}) {
  const [txnId, setTxnId] = useState("")
  const [selectedBank, setSelectedBank] = useState<number>(banks[0]?.id ?? 0)
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const [fileName, setFileName] = useState("No file chosen")

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    setScreenshot(f)
    setFileName(f ? f.name : "No file chosen")
  }

  return (
    <div className="mt-3 space-y-3">
      {banks.length > 1 && (
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Select Bank</label>
          <select
            value={selectedBank}
            onChange={e => setSelectedBank(Number(e.target.value))}
            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white"
          >
            {banks.map((b: any) => (
              <option key={b.id} value={b.id}>{b.bank_name} — {b.account_title}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Transaction ID *</label>
        <input
          type="text"
          value={txnId}
          onChange={e => setTxnId(e.target.value)}
          placeholder="e.g. TXN-ABC-123456"
          className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white placeholder:text-slate-300"
        />
      </div>
      <div>
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Screenshot (optional)</label>
        <div className="flex items-center gap-2">
          <label className="cursor-pointer text-[10px] font-bold px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200 transition-colors">
            Upload
            <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
          </label>
          <span className="text-[10px] text-slate-400 truncate max-w-[200px]">{fileName}</span>
        </div>
      </div>
      <button
        onClick={() => {
          if (!txnId.trim()) { sonnerToast.error("Transaction ID is required"); return }
          onSubmit({ transactionId: txnId, bankAccountId: selectedBank, screenshot })
        }}
        disabled={isSubmitting}
        className="w-full py-2.5 rounded-xl text-xs font-bold bg-[#013a63] text-white hover:bg-[#024a7a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? "Submitting..." : "Submit Payment Proof"}
      </button>
    </div>
  )
}

function StudentProfileContent() {
  const { toast } = useToast()
  const [mounted, setMounted] = useState(false)
  const [student, setStudent] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [weeklyAttendance, setWeeklyAttendance] = useState<Array<{ key: string, start: string, end: string, label: string, present: number, absent: number, late: number, excused: number, total: number }>>([])
  const [attendanceRaw, setAttendanceRaw] = useState<any[]>([])
  const [donutRange, setDonutRange] = useState<number>(7)
  const [behaviourOpen, setBehaviourOpen] = useState<boolean>(false)
  const [behaviourRecords, setBehaviourRecords] = useState<any[]>([])
  const [behaviourRange, setBehaviourRange] = useState<'latest' | 7 | 15 | 30>('latest')
  const [behaviourDelta, setBehaviourDelta] = useState<number | null>(null)
  const [monthlyMode, setMonthlyMode] = useState<boolean>(false)
  const [monthlyRecord, setMonthlyRecord] = useState<any | null>(null)
  const [feeStatus, setFeeStatus] = useState<'paid' | 'partial' | 'unpaid' | 'no_fee' | null>(null)
  const [feeBalance, setFeeBalance] = useState<number>(0)
  const [allFees, setAllFees] = useState<any[]>([])
  const [feeLoading, setFeeLoading] = useState(true)
  const [activePrintFee, setActivePrintFee] = useState<any | null>(null)
  // Bank & payment transaction state
  const [activeBanks, setActiveBanks] = useState<any[]>([])
  const [paymentTransactions, setPaymentTransactions] = useState<Record<number, any>>({}) // challan_id → latest txn
  const [submittingChallanId, setSubmittingChallanId] = useState<number | null>(null)
  const [resultsRaw, setResultsRaw] = useState<any[]>([])
  const [userRole, setUserRole] = useState<string>('admin')
  const [selectedImprovement, setSelectedImprovement] = useState<string | null>(null)

  const router = useRouter()
  const params = useSearchParams()
  const studentId = params?.get("id") || ""


  // ── HOOKS CONSOLIDATED AT TOP (Rules of Hooks) ────────────────────

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') { setUserRole(getCurrentUserRole() || 'admin') }
  }, [])

  useEffect(() => {
    if (!mounted || !studentId) return
    const fetchStudentData = async () => {
      try {
        setLoading(true); setError(null)
        const studentData = await getStudentById(studentId)
        if (studentData) {
          setStudent(studentData)
          try {
            const res = await getStudentResults(studentId)
            setResultsRaw(Array.isArray(res) ? res : [])
          } catch { setResultsRaw([]) }
        } else { setError('Student not found') }
      } catch { setError('Failed to load student data') } finally { setLoading(false) }
    }
    fetchStudentData()
  }, [mounted, studentId])

  useEffect(() => {
    if (!studentId) return;
    const fetchBehaviour = async () => {
      try {
        const list = await getStudentBehaviourRecords(studentId)
        setBehaviourRecords(Array.isArray(list) ? list : [])
        const now = new Date(); const curMonth = now.getMonth()
        const hasCurrent = (Array.isArray(list) ? list : []).some((r: any) => {
          const d = new Date(r.week_end || r.weekEnd || r.created_at)
          return d.getMonth() === curMonth && d.getFullYear() === now.getFullYear()
        })
        if (!hasCurrent) {
          setMonthlyMode(true)
          try { const m = await getStudentMonthlyBehaviourLatest(studentId); setMonthlyRecord(m) } catch { setMonthlyRecord(null) }
        } else { setMonthlyMode(false); setMonthlyRecord(null) }
      } catch { setBehaviourRecords([]) }
    }
    fetchBehaviour()
  }, [studentId])

  useEffect(() => {
    if (!studentId) return
    setFeeLoading(true)
    apiGet<any>(`/api/fees/student-fees/?student_id=${studentId}`)
      .then((d: any) => {
        const list = Array.isArray(d) ? d : (d?.results || [])
        setAllFees(list)
        const computeTotal = (f: any) => {
          const items = f.fee_structure_details?.items || []
          const itemsSum = items.reduce((s: number, it: any) => s + Number(it.amount), 0)
          return (itemsSum > 0 ? itemsSum : Number(f.total_amount)) + Number(f.late_fee || 0) + Number(f.other_charges || 0)
        }
        const total = list.reduce((s: number, f: any) => s + computeTotal(f), 0)
        const paid = list.reduce((s: number, f: any) => s + Number(f.paid_amount), 0)
        setFeeBalance(total - paid)
        if (list.length === 0) setFeeStatus('no_fee')
        else if (list.every((f: any) => f.status === 'paid')) setFeeStatus('paid')
        else setFeeStatus(list.some((f: any) => Number(f.paid_amount) > 0) ? 'partial' : 'unpaid')
        setFeeLoading(false)
      })
      .catch(() => { setFeeStatus(null); setFeeLoading(false) })
  }, [studentId])

  useEffect(() => {
    apiGet<any>('/api/fees/banks/active/').then((d: any) => setActiveBanks(Array.isArray(d) ? d : (d?.results || []))).catch(() => setActiveBanks([]))
  }, [])

  useEffect(() => {
    if (allFees.length === 0) return
    allFees.forEach((f: any) => {
      apiGet<any>(`/api/fees/payment-transactions/by-challan/?challan_id=${f.id}`)
        .then((d: any) => {
          const list = Array.isArray(d) ? d : (d?.results || [])
          if (list.length > 0) setPaymentTransactions(prev => ({ ...prev, [f.id]: list[0] }))
        }).catch(() => {})
    })
  }, [allFees])

  useEffect(() => {
    const fetchAttendance = async () => {
      if (!student) return
      try {
        const today = new Date(); const start = new Date(today); start.setDate(today.getDate() - 7 * 12)
        const path = `/api/attendance/student/${student.id}/?start_date=${start.toISOString().slice(0, 10)}&end_date=${today.toISOString().slice(0, 10)}`
        const records: any[] = await apiGet(path)
        setAttendanceRaw(records)
        const getWeekStart = (d: Date) => {
          const date = new Date(d); const day = date.getDay() === 0 ? 7 : date.getDay()
          const diff = date.getDate() - day + 1; const s = new Date(date.getFullYear(), date.getMonth(), diff); return s
        }
        const map: Record<string, any> = {}
        for (const r of records) {
          const rawdt = (r as any)?.attendance_date || (r as any)?.date || (r as any)?.created_at
          const ws = getWeekStart(new Date(rawdt)); const key = ws.toISOString().slice(0, 10)
          if (!map[key]) map[key] = { start: ws, present: 0, total: 0 }
          if (String(r.status).toLowerCase() === 'present') map[key].present++
          map[key].total++
        }
        setWeeklyAttendance(Object.keys(map).sort().map(k => ({
          key: k, label: map[k].start.toLocaleString('en-US', { month: 'short', day: '2-digit' }),
          present: map[k].present, absent: map[k].total - map[k].present, total: map[k].total
        })) as any)
      } catch {}
    }
    fetchAttendance()
  }, [student])

  const performanceData = useMemo(() => generatePerformanceData(student, resultsRaw), [student, resultsRaw])
  const subjectProgressData = useMemo(() => performanceData.map((pd: any) => ({ subject: pd.subject, student: pd.grade, classAvg: pd.classAvg || 0 })), [performanceData])
  const attendanceData = useMemo(() => weeklyAttendance.map(w => ({ ...w, percentage: w.total ? Math.round((w.present / w.total) * 100) : 0 })), [weeklyAttendance])
  const sparkData = useMemo(() => weeklyAttendance.slice(-8).map(w => ({ value: w.total ? Math.round((w.present / w.total) * 100) : 0 })), [weeklyAttendance])

  const behaviourComputed = useMemo(() => {
    const activeRec = (monthlyMode && monthlyRecord?.metrics) ? monthlyRecord : [...behaviourRecords].sort((a,b)=>new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
    if (!activeRec) return null
    const m = activeRec.metrics || {}; const scoreToPct = (s: number) => ({ 1: 25, 2: 50, 3: 75, 4: 100 }[s] || 0)
    return { items: [
      { label: 'Punctuality', value: monthlyMode ? m.punctuality : scoreToPct(m.punctuality) },
      { label: 'Obedience', value: monthlyMode ? m.obedience : scoreToPct(m.obedience) },
      { label: 'Class Behaviour', value: monthlyMode ? m.classBehaviour : scoreToPct(m.classBehaviour) },
      { label: 'Participation', value: monthlyMode ? m.participation : scoreToPct(m.participation) },
      { label: 'Homework', value: monthlyMode ? m.homework : scoreToPct(m.homework) },
      { label: 'Respect', value: monthlyMode ? m.respect : scoreToPct(m.respect) }
    ]}
  }, [behaviourRecords, monthlyMode, monthlyRecord])

  const behaviourImprovements = useMemo(() => {
    if (!behaviourComputed) return []
    return behaviourComputed.items
      .filter((it: any) => it.value < 70)
      .map((it: any) => ({
        key: it.label, label: it.label, value: it.value,
        severity: (it.value < 40 ? 'critical' : 'warning') as 'critical' | 'warning',
        message: it.value < 40 ? `Immediate attention required in ${it.label.toLowerCase()}.` : `Improvement needed in ${it.label.toLowerCase()}.`
      }))
  }, [behaviourComputed])

  const selectedImp = useMemo(() => behaviourImprovements.find(i => i.key === selectedImprovement) || behaviourImprovements[0], [behaviourImprovements, selectedImprovement])

  const { cwPct, donutData } = useMemo(() => {
    const p = attendanceRaw.filter(r => r.status === 'present').length, a = attendanceRaw.filter(r => r.status === 'absent').length
    return { cwPct: (p+a) ? Math.round((p/(p+a))*100) : 0, donutData: [{ name: 'Present', value: p }, { name: 'Absent', value: a }] }
  }, [attendanceRaw])

  if (!studentId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">No Student Selected</h2>
            <Button onClick={() => router.back()} className="w-full"><ArrowLeft className="w-4 h-4 mr-2" />Go Back</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!mounted || loading) return <StudentProfileSkeleton />





  // Submit payment proof for a challan
  async function handleSubmitPayment(challanId: number, payload: { transactionId: string; bankAccountId: number; screenshot: File | null }) {
    setSubmittingChallanId(challanId)
    try {
      const formData = new FormData()
      formData.append('challan_id', String(challanId))
      formData.append('bank_account_id', String(payload.bankAccountId))
      formData.append('transaction_id', payload.transactionId)
      formData.append('amount', String(allFees.find(f => f.id === challanId)?.total_amount ?? 0))
      if (payload.screenshot) formData.append('screenshot', payload.screenshot)

      const token = typeof window !== 'undefined' ? localStorage.getItem('sis_access_token') : null
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/fees/payment-transactions/submit/`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || 'Submission failed')
      }
      const txn = await res.json()
      setPaymentTransactions(prev => ({ ...prev, [challanId]: txn }))
      toast({ title: 'Payment submitted!', description: 'Your payment proof is pending verification.' })
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Could not submit payment.', variant: 'destructive' })
    } finally {
      setSubmittingChallanId(null)
    }
  }

  // Helpers for behaviour metrics → percent
  function scoreToPercent(key: string, score: number, eventsLen: number): number {
    const base: Record<number, number> = { 1: 25, 2: 50, 3: 75, 4: 100 }
    if (key === 'participation') {
      if (eventsLen > 0) return 100
      if (score === 4) return 90
    }
    return base[score] || 0
  }

  function computeLatestMetrics(records: any[]) {
    if (!records || records.length === 0) return null
    // latest by week_start
    const latest = records.reduce((acc, cur) => {
      const d1 = new Date(acc.week_start || acc.weekStart || acc.created_at)
      const d2 = new Date(cur.week_start || cur.weekStart || cur.created_at)
      return d2 > d1 ? cur : acc
    }, records[0])
    const m = latest?.metrics || {}
    const evsLen = Array.isArray(latest?.events) ? latest.events.length : 0
    const items = [
      { label: 'Punctuality', key: 'punctuality', value: scoreToPercent('punctuality', m.punctuality || 0, evsLen) },
      { label: 'Obedience', key: 'obedience', value: scoreToPercent('obedience', m.obedience || 0, evsLen) },
      { label: 'Class Behaviour', key: 'classBehaviour', value: scoreToPercent('classBehaviour', m.classBehaviour || 0, evsLen) },
      { label: 'Event Participation', key: 'participation', value: scoreToPercent('participation', m.participation || 0, evsLen) },
      { label: 'Homework', key: 'homework', value: scoreToPercent('homework', m.homework || 0, evsLen) },
      { label: 'Respect', key: 'respect', value: scoreToPercent('respect', m.respect || 0, evsLen) },
    ]
    return { items }
  }

  function computeWindowMetrics(records: any[], days: number) {
    if (!records || records.length === 0) return null
    const today = new Date()
    const start = new Date(today)
    start.setDate(today.getDate() - (days - 1))
    const end = today
    const inRange = records.filter(r => {
      const we = new Date(r.week_end || r.weekEnd || r.created_at)
      return we >= start && we <= end
    })
    if (inRange.length === 0) return null
    const sums: Record<string, number> = { punctuality: 0, obedience: 0, classBehaviour: 0, participation: 0, homework: 0, respect: 0 }
    inRange.forEach(r => {
      const m = r.metrics || {}
      const evsLen = Array.isArray(r.events) ? r.events.length : 0
      sums.punctuality += scoreToPercent('punctuality', m.punctuality || 0, evsLen)
      sums.obedience += scoreToPercent('obedience', m.obedience || 0, evsLen)
      sums.classBehaviour += scoreToPercent('classBehaviour', m.classBehaviour || 0, evsLen)
      sums.participation += scoreToPercent('participation', m.participation || 0, evsLen)
      sums.homework += scoreToPercent('homework', m.homework || 0, evsLen)
      sums.respect += scoreToPercent('respect', m.respect || 0, evsLen)
    })
    const count = inRange.length
    const items = [
      { label: 'Punctuality', key: 'punctuality', value: Math.round(sums.punctuality / count) },
      { label: 'Obedience', key: 'obedience', value: Math.round(sums.obedience / count) },
      { label: 'Class Behaviour', key: 'classBehaviour', value: Math.round(sums.classBehaviour / count) },
      { label: 'Event Participation', key: 'participation', value: Math.round(sums.participation / count) },
      { label: 'Homework', key: 'homework', value: Math.round(sums.homework / count) },
      { label: 'Respect', key: 'respect', value: Math.round(sums.respect / count) },
    ]

    // previous window delta (overall)
    const prevEnd = new Date(start)
    prevEnd.setDate(start.getDate() - 1)
    const prevStart = new Date(prevEnd)
    prevStart.setDate(prevEnd.getDate() - (days - 1))
    const prevRange = records.filter(r => {
      const we = new Date(r.week_end || r.weekEnd || r.created_at)
      return we >= prevStart && we <= prevEnd
    })
    if (prevRange.length > 0) {
      const sumsPrev: Record<string, number> = { punctuality: 0, obedience: 0, classBehaviour: 0, participation: 0, homework: 0, respect: 0 }
      prevRange.forEach(r => {
        const m = r.metrics || {}
        const evsLen = Array.isArray(r.events) ? r.events.length : 0
        sumsPrev.punctuality += scoreToPercent('punctuality', m.punctuality || 0, evsLen)
        sumsPrev.obedience += scoreToPercent('obedience', m.obedience || 0, evsLen)
        sumsPrev.classBehaviour += scoreToPercent('classBehaviour', m.classBehaviour || 0, evsLen)
        sumsPrev.participation += scoreToPercent('participation', m.participation || 0, evsLen)
        sumsPrev.homework += scoreToPercent('homework', m.homework || 0, evsLen)
        sumsPrev.respect += scoreToPercent('respect', m.respect || 0, evsLen)
      })
      const cAvg = items.reduce((s, it) => s + it.value, 0) / items.length
      const pAvg = (sumsPrev.punctuality + sumsPrev.obedience + sumsPrev.classBehaviour + sumsPrev.participation + sumsPrev.homework + sumsPrev.respect) / (prevRange.length * 6)
      setBehaviourDelta(Math.round(cAvg - pAvg))
    } else {
      setBehaviourDelta(null)
    }

    return { items }
  }



  // Tooltip for attendance chart
  const AttendanceTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const present = payload.find((p: any) => p.dataKey === 'present')?.value || 0
      const absent = payload.find((p: any) => p.dataKey === 'absent')?.value || 0
      const total = present + absent
      const pct = total ? Math.round((present / total) * 100) : 0
      return (
        <div className="rounded-lg border bg-white/95 shadow p-3 text-sm">
          <div className="font-semibold mb-1">{label}</div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1 text-emerald-600"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>Present: {present}</span>
            <span className="inline-flex items-center gap-1 text-rose-600"><span className="w-2 h-2 rounded-full bg-rose-500"></span>Absent: {absent}</span>
            <span className="text-slate-600 ml-2">{pct}%</span>
          </div>
        </div>
      )
    }
    return null
  }
  // Tooltip for Donut
  const DonutTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0]
      const name = item?.name || ''
      const value = item?.value || 0
      const total = donutData?.reduce((s, d) => s + (d?.value || 0), 0) || 0
      const pct = total ? Math.round((value / total) * 100) : 0
      const color = name === 'Present' ? '#22c55e' : (name === 'Absent' ? '#ef4444' : (name === 'No Record' ? '#cbd5e1' : '#1d4ed8'))
      return (
        <div className="rounded-lg border bg-white shadow-lg p-2 text-xs z-[9999]" style={{ position: 'relative', zIndex: 9999 }}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="font-medium text-slate-700">{name === 'Sundays' ? 'Sunday (Holiday)' : name}</span>
            <span className="ml-2 text-slate-600">{value} ({pct}%)</span>
          </div>
        </div>
      )
    }
    return null
  }

  // Calculate metrics
  const overallScore = Math.round(performanceData.reduce((sum: number, item: any) => sum + item.grade, 0) / performanceData.length) || 0
  const attendanceRate = Math.round(attendanceData.reduce((sum: number, item: any) => sum + item.percentage, 0) / attendanceData.length) || 0
  const detailsCompleteness = student ? (() => {
    const classTeacher = (student as any)?.classroom?.class_teacher?.full_name
      || (student as any)?.class_teacher?.full_name
      || (student as any)?.classroom?.class_teacher_name
      || (student as any)?.class_teacher_name
      || ''

    const campusName = (student as any)?.campus_name || (student as any)?.campus?.campus_name || ''

    const values = [
      // Personal
      (student as any)?.name,
      (student as any)?.gender,
      (student as any)?.dob,
      (student as any)?.religion,
      (student as any)?.mother_tongue,
      (student as any)?.place_of_birth,
      (student as any)?.zakat_status,
      // Academic
      (student as any)?.student_id,
      (student as any)?.current_grade,
      (student as any)?.section,
      classTeacher,
      campusName,
      (student as any)?.shift,
      (student as any)?.enrollment_year,
      (student as any)?.gr_no,
      // Contact
      (student as any)?.father_name,
      (student as any)?.father_contact,
      (student as any)?.father_cnic,
      (student as any)?.father_profession,
      (student as any)?.mother_name,
      (student as any)?.mother_contact,
      (student as any)?.mother_status,
      (student as any)?.address,
    ]

    const filled = values.filter(v => v !== null && v !== undefined && String(v).toString().trim() !== '')
    return Math.round((filled.length / values.length) * 100)
  })() : 0

  const getPerformanceStatus = (score: number) => {
    if (score >= 90) return { text: 'Excellent', color: themeColors.success, icon: Star }
    if (score >= 80) return { text: 'Very Good', color: themeColors.info, icon: CheckCircle }
    if (score >= 70) return { text: 'Good', color: themeColors.warning, icon: TrendingUp }
    return { text: 'Needs Improvement', color: themeColors.error, icon: AlertCircle }
  }

  const getBehaviourQuote = (score: number) => {
    if (score >= 90) return 'Outstanding consistency — keep it up!'
    if (score >= 80) return 'Very good progress — aim for excellence.'
    if (score >= 70) return 'Good — small improvements will make it great.'
    return 'Focus this week — you can turn this around.'
  }

  const getBehaviourWord = (score: number) => {
    if (score >= 90) return 'Excellent'
    if (score >= 80) return 'Great'
    if (score >= 70) return 'Good'
    return 'Improve'
  }

  const performanceStatus = getPerformanceStatus(overallScore)
  const behaviourAvg: number = (() => {
    const items = behaviourComputed?.items || []
    if (!items.length) return 0
    return Math.round(items.reduce((s: number, it: any) => s + (it.value || 0), 0) / items.length)
  })()
  const behaviourStatus = getPerformanceStatus(behaviourAvg)
  const profileStatusAvg = Math.round(((cwPct || 0) + (behaviourAvg || 0) + (detailsCompleteness || 0)) / 3)
  const overallCombined = Math.round(((cwPct || 0) + (profileStatusAvg || 0) + (behaviourAvg || 0)) / 3)

  // Student photo and initials
  const studentPhoto: string | undefined = (student as any)?.profile_image || (student as any)?.photo || (student as any)?.image || (student as any)?.student_photo
  const studentInitials = ((student?.name || 'Student') as string)
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')

  // Derived details
  const age = (() => {
    const dobStr = (student as any)?.dob
    if (!dobStr) return '—'
    const dob = new Date(dobStr)
    if (isNaN(dob.getTime())) return '—'
    const diff = Date.now() - dob.getTime()
    const ageDate = new Date(diff)
    return Math.abs(ageDate.getUTCFullYear() - 1970)
  })()




  return (
    <div className="min-h-screen bg-gray-50 pb-6 md:pb-8 overflow-x-hidden no-print-bg">
      <div className="max-w-7xl mx-auto px-2 sm:px-3 md:px-4 py-3 sm:py-4 md:py-6 w-full no-print">
        {/* Header (themed) */}
        <div className="rounded-lg sm:rounded-xl shadow-lg p-3 sm:p-4 md:p-6 mb-4 sm:mb-5 md:mb-6 border" style={{ backgroundColor: themeColors.primary, borderColor: themeColors.primary }}>
          <div className="flex flex-col md:flex-row items-start md:items-center md:space-x-5 gap-3 sm:gap-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: themeColors.skyblue }}>
              <User className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <div className="text-white min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold break-words">{student?.name || 'Student Profile'}</h1>
              <p className="text-white/80 text-xs sm:text-sm md:text-base">Student ID: {(student as any)?.student_id || studentId}</p>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2">
                <span className="inline-flex items-center px-2 sm:px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap" style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.25)' }}>
                  <GraduationCap className="w-3 h-3 mr-1 flex-shrink-0" />
                  {student?.current_grade || 'N/A'}
                </span>
                <span className="inline-flex items-center px-2 sm:px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap" style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.25)' }}>
                  <Users className="w-3 h-3 mr-1 flex-shrink-0" />
                  Sec {student?.section || 'N/A'}
                </span>
                <span className="inline-flex items-center px-2 sm:px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap truncate" style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.25)' }}>
                  <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
                  {student?.campus_name || student?.campus?.campus_name || 'N/A'}
                </span>
                {/* Fee Status Badge */}
                {feeStatus && (
                  <span className={`inline-flex items-center px-2 sm:px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap shadow-sm ${feeStatus === 'paid' ? 'bg-emerald-500 text-white' :
                      feeStatus === 'partial' ? 'bg-amber-400 text-white' :
                        feeStatus === 'unpaid' ? 'bg-rose-500 text-white ring-1 ring-rose-300' :
                          'bg-slate-200 text-slate-700'
                    }`}>
                    {feeStatus === 'paid' ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        <span>Paid</span>
                      </>
                    ) : feeStatus === 'partial' ? (
                      <>
                        <AlertCircle className="w-3.5 h-3.5 mr-1" />
                        <span>Arrears: {feeBalance.toLocaleString()}</span>
                      </>
                    ) : feeStatus === 'unpaid' ? (
                      <>
                        <AlertCircle className="w-3.5 h-3.5 mr-1" />
                        <span>Balance: {feeBalance.toLocaleString()}</span>
                      </>
                    ) : (
                      'No Fee Record'
                    )}
                  </span>
                )}
              </div>
            </div>
            {overallCombined < 70 && (
              <div className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 rounded-md border w-full md:w-auto text-left md:text-right" style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.25)' }}>
                Overall score is below 70%. Please focus on This Student.
              </div>
            )}

          </div>
        </div>

        {/* KPI Cards Only */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-6 mb-6 md:mb-8">
          <Card className="text-white border-0 shadow-lg" style={{ backgroundColor: themeColors.primary }}>
            <CardContent className="p-2.5 sm:p-3 md:p-6">
              <div className="flex flex-col items-start gap-1 sm:gap-2">
                <p className="text-blue-100 text-xs md:text-sm font-medium">Overall Score</p>
                <div className="flex items-center justify-between w-full gap-2">
                  <p className="text-xl sm:text-2xl md:text-3xl font-bold">{overallCombined}%</p>
                  <Award className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-blue-200 flex-shrink-0" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="text-white border-0 shadow-lg" style={{ backgroundColor: themeColors.info }}>
            <CardContent className="p-2.5 sm:p-3 md:p-6">
              <div className="flex flex-col items-start gap-1 sm:gap-2">
                <p className="text-xs md:text-sm font-medium">Attendance</p>
                <div className="flex items-center justify-between w-full gap-2">
                  <p className="text-xl sm:text-2xl md:text-3xl font-bold">{cwPct}%</p>
                  <Calendar className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 flex-shrink-0" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="text-white border-0 shadow-lg" style={{ backgroundColor: themeColors.skyblue }}>
            <CardContent className="p-2.5 sm:p-3 md:p-6">
              <div className="flex flex-col items-start gap-1 sm:gap-2">
                <p className="text-purple-100 text-xs md:text-sm font-medium">Profile Status</p>
                <div className="flex items-center justify-between w-full gap-2">
                  <p className="text-xl sm:text-2xl md:text-3xl font-bold">{profileStatusAvg}%</p>
                  <User className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-purple-200 flex-shrink-0" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="text-white border-0 shadow-lg" style={{ backgroundColor: themeColors.light }}>
            <CardContent className="p-2.5 sm:p-3 md:p-6">
              <div>
                <p className="text-xs md:text-sm font-medium">Performance / Behaviour</p>
                <div className="mt-1 flex items-baseline gap-1 sm:gap-2">
                  <span className="text-xl sm:text-2xl md:text-3xl font-extrabold leading-none">{behaviourAvg}%</span>
                  <span className="text-xs md:text-sm font-semibold">{getBehaviourWord(behaviourAvg)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>






        {/* Responsive two-card section: first normal, second double width */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6 mb-6 md:mb-8 items-stretch">
          {/* First card - same width/height */}
          <Card className="overflow-hidden bg-white border shadow-sm h-auto md:h-[360px] lg:h-[420px]">
            {studentPhoto ? (
              <img
                src={studentPhoto}
                alt={student?.name || 'Student'}
                className="w-full h-48 md:h-full object-cover block"
              />
            ) : (
              <div className="w-full h-48 md:h-full flex items-center justify-center text-4xl md:text-6xl font-bold text-white" style={{ backgroundColor: '#61a5c2' }}>
                {studentInitials}
              </div>
            )}
          </Card>

          {/* Second card - double width with Tabs (Personal | Academic | Contact) */}
          <Card className="bg-white border shadow-sm md:col-span-1 lg:col-span-2 h-auto md:h-[360px] lg:h-[420px]">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 sm:pb-3 md:pb-4">
              <CardTitle className="text-lg sm:text-xl md:text-2xl text-[#013a63]">Student Information</CardTitle>
              {userRole === 'teacher' && (
                <Button onClick={() => setBehaviourOpen(true)} className="h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm text-white transition-all duration-150 ease-in-out transform hover:shadow-lg active:scale-95 active:shadow-md w-full sm:w-auto" style={{ backgroundColor: themeColors.primary }}>
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /> <span className="hidden sm:inline">Add Behaviour</span><span className="sm:hidden">Add</span>
                </Button>
              )}
            </CardHeader>
            <CardContent className="h-auto md:h-[calc(100%-3.5rem)] flex flex-col min-h-0 overflow-hidden">
              <Tabs defaultValue="personal" className="w-full h-full flex flex-col min-h-0">
                <TabsList className="grid w-full grid-cols-3 text-xs sm:text-sm">
                  <TabsTrigger value="personal" className="text-xs sm:text-sm">Personal</TabsTrigger>
                  <TabsTrigger value="academic" className="text-xs sm:text-sm">Academic</TabsTrigger>
                  <TabsTrigger value="contact" className="text-xs sm:text-sm">Contact</TabsTrigger>
                </TabsList>

                <TabsContent value="personal" className="flex-1 mt-2 sm:mt-3 md:mt-4 min-h-0 overflow-y-auto pr-0 sm:pr-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 md:gap-4 content-start">
                    <div className="w-full rounded-lg border bg-white divide-y text-sm">
                      <div className="grid grid-cols-3 gap-2 p-2 sm:p-3">
                        <p className="text-xs text-gray-500">Full Name</p>
                        <div className="col-span-2 font-medium text-gray-800 text-xs sm:text-sm truncate">{student?.name || '—'}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 p-2 sm:p-3">
                        <p className="text-xs text-gray-500">Gender</p>
                        <div className="col-span-2 text-gray-800 text-xs sm:text-sm">{student?.gender || '—'}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 p-2 sm:p-3">
                        <p className="text-xs text-gray-500">DOB</p>
                        <div className="col-span-2 text-gray-800 text-xs sm:text-sm">{student?.dob || '—'}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 p-2 sm:p-3">
                        <p className="text-xs text-gray-500">Age</p>
                        <div className="col-span-2 text-gray-800 text-xs sm:text-sm">{age}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 p-2 sm:p-3">
                        <p className="text-xs text-gray-500">Student Email</p>
                        <div className="col-span-2 text-gray-800 text-xs sm:text-sm lowercase">
                          {student?.email || '—'}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 p-2 sm:p-3">
                        <p className="text-xs text-gray-500">B-Form / CNIC</p>
                        <div className="col-span-2 text-gray-800 text-xs sm:text-sm truncate">{(student as any)?.student_cnic || '—'}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 p-2 sm:p-3">
                        <p className="text-xs text-gray-500">Blood Group</p>
                        <div className="col-span-2 text-gray-800 text-xs sm:text-sm">{(student as any)?.blood_group || '—'}</div>
                      </div>
                    </div>
                    <div className="w-full rounded-lg border bg-white divide-y text-sm">
                      <div className="grid grid-cols-3 gap-2 p-2 sm:p-3">
                        <p className="text-xs text-gray-500">Religion</p>
                        <div className="col-span-2 text-gray-800 text-xs sm:text-sm">{student?.religion || '—'}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 p-2 sm:p-3">
                        <p className="text-xs text-gray-500">Mother Tongue</p>
                        <div className="col-span-2 text-gray-800 text-xs sm:text-sm">{student?.mother_tongue || '—'}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 p-2 sm:p-3">
                        <p className="text-xs text-gray-500">Place of Birth</p>
                        <div className="col-span-2 text-gray-800 text-xs sm:text-sm truncate">{(student as any)?.place_of_birth || '—'}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 p-2 sm:p-3">
                        <p className="text-xs text-gray-500">Special Needs / Disability</p>
                        <div className="col-span-2 text-gray-800 text-xs sm:text-sm capitalize">{(student as any)?.special_needs_disability || '—'}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 p-2 sm:p-3">
                        <p className="text-xs text-gray-500">Family Income</p>
                        <div className="col-span-2 text-gray-800 text-xs sm:text-sm">{(student as any)?.family_income ? `PKR ${(student as any).family_income}` : '—'}</div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="academic" className="flex-1 mt-2 sm:mt-3 md:mt-4 min-h-0 overflow-y-auto pr-0 sm:pr-1">
                  {student && (
                    <div className="mb-3 sm:mb-4">
                      <EnrollmentStatusCard student={student} onUpdated={setStudent} />
                    </div>
                  )}
                  {student && (
                    <div className="mb-3 sm:mb-4">
                      <AcademicYearJourney
                        enrollmentYear={(student as any)?.enrollment_year}
                        currentGrade={student?.current_grade}
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 md:gap-4 content-start">
                    <div className="w-full rounded-lg border bg-white divide-y text-sm">
                      <div className="grid grid-cols-3 gap-2 p-2 sm:p-3">
                        <p className="text-xs text-gray-500">Student ID</p>
                        <div className="col-span-2 font-medium text-gray-800 text-xs sm:text-sm truncate">{studentId || '—'}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 p-2 sm:p-3">
                        <p className="text-xs text-gray-500">Current Grade</p>
                        <div className="col-span-2 text-gray-800 text-xs sm:text-sm">{(student as any)?.current_grade || '—'}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 p-2 sm:p-3">
                        <p className="text-xs text-gray-500">Section</p>
                        <div className="col-span-2 text-gray-800 text-xs sm:text-sm">{student?.section || '—'}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 p-2 sm:p-3">
                        <p className="text-xs text-gray-500">Class Teacher</p>
                        <div className="col-span-2 text-gray-800 text-xs sm:text-sm truncate">{
                          (student as any)?.classroom?.class_teacher?.full_name
                          || (student as any)?.class_teacher?.full_name
                          || (student as any)?.classroom?.class_teacher_name
                          || (student as any)?.class_teacher_name
                          || '—'
                        }</div>
                      </div>
                    </div>
                    <div className="w-full rounded-lg border bg-white divide-y text-sm">
                      <div className="grid grid-cols-3 gap-2 p-2 sm:p-3">
                        <p className="text-xs text-gray-500">Campus</p>
                        <div className="col-span-2 text-gray-800 text-xs sm:text-sm truncate">{student?.campus_name || student?.campus?.campus_name || '—'}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 p-2 sm:p-3">
                        <p className="text-xs text-gray-500">Shift</p>
                        <div className="col-span-2 text-gray-800 text-xs sm:text-sm capitalize">{(student as any)?.shift || '—'}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 p-2 sm:p-3">
                        <p className="text-xs text-gray-500">Enrollment Year</p>
                        <div className="col-span-2 text-gray-800 text-xs sm:text-sm">{(student as any)?.enrollment_year || '—'}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 p-2 sm:p-3">
                        <p className="text-xs text-gray-500">GR No</p>
                        <div className="col-span-2 text-gray-800 text-xs sm:text-sm">{student?.gr_no || '—'}</div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="contact" className="flex-1 mt-2 sm:mt-3 md:mt-4 min-h-0 overflow-y-auto pr-0 sm:pr-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 md:gap-4 content-start">
                    <div className="w-full rounded-lg border bg-white divide-y text-sm">
                      <div className="grid grid-cols-3 gap-2 p-2 sm:p-3">
                        <p className="text-xs text-gray-500">Father Name</p>
                        <div className="col-span-2 text-gray-800 text-xs sm:text-sm truncate">{student?.father_name || '—'}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 p-2 sm:p-3">
                        <p className="text-xs text-gray-500">Father Contact</p>
                        <div className="col-span-2 text-gray-800 text-xs sm:text-sm">{student?.father_contact || '—'}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 p-2 sm:p-3">
                        <p className="text-xs text-gray-500">Father CNIC</p>
                        <div className="col-span-2 text-gray-800 text-xs sm:text-sm truncate">{(student as any)?.father_cnic || '—'}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 p-2 sm:p-3">
                        <p className="text-xs text-gray-500">Father Profession</p>
                        <div className="col-span-2 text-gray-800 text-xs sm:text-sm truncate">{(student as any)?.father_profession || '—'}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 p-2 sm:p-3">
                        <p className="text-xs text-gray-500">Guardian Info</p>
                        <div className="col-span-2 text-gray-800 text-xs sm:text-sm truncate">
                          {student?.guardian_name ? `${student.guardian_name} (${student.guardian_relation || 'Guardian'})` : '—'}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 p-2 sm:p-3">
                        <p className="text-xs text-gray-500">Guardian Contact</p>
                        <div className="col-span-2 text-gray-800 text-xs sm:text-sm truncate">{(student as any)?.guardian_contact || '—'}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 p-2 sm:p-3">
                        <p className="text-xs text-gray-500">Guardian CNIC</p>
                        <div className="col-span-2 text-gray-800 text-xs sm:text-sm truncate">{(student as any)?.guardian_cnic || '—'}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 p-2 sm:p-3">
                        <p className="text-xs text-gray-500">Guardian Profession</p>
                        <div className="col-span-2 text-gray-800 text-xs sm:text-sm truncate">{(student as any)?.guardian_profession || '—'}</div>
                      </div>
                    </div>
                    <div className="w-full rounded-lg border bg-white divide-y text-sm">
                      <div className="grid grid-cols-3 gap-2 p-2 sm:p-3">
                        <p className="text-xs text-gray-500">Mother Name</p>
                        <div className="col-span-2 text-gray-800 text-xs sm:text-sm truncate">{(student as any)?.mother_name || '—'}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 p-2 sm:p-3">
                        <p className="text-xs text-gray-500">Mother Contact</p>
                        <div className="col-span-2 text-gray-800 text-xs sm:text-sm">{(student as any)?.mother_contact || '—'}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 p-2 sm:p-3">
                        <p className="text-xs text-gray-500">Address</p>
                        <div className="col-span-2 text-gray-800 text-xs sm:text-sm truncate">{(student as any)?.address || '—'}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 p-2 sm:p-3">
                        <p className="text-xs text-gray-500">Emergency Contact</p>
                        <div className="col-span-2 text-gray-800 text-xs sm:text-sm">{(student as any)?.emergency_contact || '—'}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 p-2 sm:p-3">
                        <p className="text-xs text-gray-500">Student Phone</p>
                        <div className="col-span-2 text-gray-800 text-xs sm:text-sm">{(student as any)?.phone_number || '—'}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 p-2 sm:p-3">
                        <p className="text-xs text-gray-500">Nationality</p>
                        <div className="col-span-2 text-gray-800 text-xs sm:text-sm capitalize">{(student as any)?.nationality || '—'}</div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* ──────── MAIN CONTENT TABS ──────── */}
        <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <Tabs defaultValue="academics" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8 h-12 sm:h-14 bg-white/50 backdrop-blur-sm border border-slate-200 p-1 rounded-2xl shadow-sm">
              <TabsTrigger 
                value="academics" 
                className="data-[state=active]:bg-[#013a63] data-[state=active]:text-white data-[state=active]:shadow-md rounded-xl font-bold text-xs sm:text-sm transition-all duration-300"
              >
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Performance & Behaviour
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="financials" 
                className="data-[state=active]:bg-[#013a63] data-[state=active]:text-white data-[state=active]:shadow-md rounded-xl font-bold text-xs sm:text-sm transition-all duration-300"
              >
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Financial Overview
                </div>
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: ACADEMICS & BEHAVIOUR */}
            <TabsContent value="academics" className="space-y-6 focus-visible:ring-0">
              {/* Month-by-month attendance calendar. Real per-day data straight
                  from the register, coloured the same as the review roll. */}
              {studentId && (
                <div>
                  <h3 className="mb-2 text-lg font-bold text-[#013a63] sm:text-xl">
                    Attendance Calendar
                  </h3>
                  <StudentAttendanceCalendar studentId={Number(studentId)} />
                </div>
              )}

              {/* Donut + Subject Progress */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-stretch">
                <Card className="bg-white border shadow-sm h-auto md:h-[380px] lg:h-[420px] overflow-visible rounded-2xl">
                  <CardHeader className="pb-2 sm:pb-3 md:pb-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
                      <CardTitle className="text-lg sm:text-xl font-bold text-[#013a63]">Attendance Insights</CardTitle>
                      <div className="flex flex-col items-start sm:items-end gap-1 sm:gap-2 w-full sm:w-auto">
                        <Select value={String(donutRange)} onValueChange={(v) => setDonutRange(parseInt(v))}>
                          <SelectTrigger className="h-7 sm:h-8 text-xs sm:text-sm rounded-lg border bg-white focus:ring-sky-500 w-full sm:w-[140px]">
                            <SelectValue placeholder="Last 7 days" />
                          </SelectTrigger>
                          <SelectContent className="text-xs sm:text-sm">
                            <SelectItem value="7">Last 7 days</SelectItem>
                            <SelectItem value="15">Last 15 days</SelectItem>
                            <SelectItem value="30">Last 30 days</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="h-64 md:h-[calc(100%-4.5rem)] pb-4 relative">
                    <div className="h-full w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="55%" outerRadius="75%" stroke="#fff" strokeWidth={2}>
                            <Cell fill="#22c55e" />
                            <Cell fill="#ef4444" />
                            <Cell fill="#cbd5e1" />
                            <Cell fill="#3b82f6" />
                          </Pie>
                          <Tooltip content={<DonutTooltip />} />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <div className="text-3xl font-black text-[#013a63]">{cwPct}%</div>
                        <div className="text-[10px] uppercase tracking-tighter text-slate-400 font-bold">Present</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white border shadow-sm h-auto md:h-[380px] lg:h-[420px] rounded-2xl">
                  <CardHeader className="pb-2 sm:pb-3 md:pb-4">
                    <CardTitle className="text-lg sm:text-xl font-bold text-[#013a63]">Subject Progress</CardTitle>
                  </CardHeader>
                  <CardContent className="h-64 md:h-[calc(100%-3.5rem)] overflow-hidden">
                    <div className="h-full overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                      <div style={{ minWidth: subjectProgressData.length > 5 ? `${subjectProgressData.length * 80}px` : '100%', height: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={subjectProgressData} margin={{ top: 20, right: 30, left: -20, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis 
                              dataKey="subject" 
                              tick={{fontSize: 10, fontWeight: 600, fill: '#64748b'}} 
                              axisLine={false} 
                              tickLine={false}
                              dy={10}
                            />
                            <YAxis hide domain={[0, 100]} />
                            <Tooltip 
                              cursor={{fill: '#f1f5f9'}}
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            />
                            <Bar dataKey="student" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={32}>
                               <LabelList dataKey="student" position="top" style={{ fontSize: '10px', fontWeight: 'bold', fill: '#1e40af' }} offset={10} />
                            </Bar>
                            <Bar dataKey="classAvg" name="Class Avg" fill="#e2e8f0" radius={[6, 6, 0, 0]} barSize={24} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Behaviour Snapshot */}
              <Card className="bg-white border shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-slate-50 bg-slate-50/30">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg sm:text-xl font-bold text-[#013a63]">Behavioural Analysis</CardTitle>
                    {selectedImp && (
                      <div className={`text-[10px] sm:text-xs px-3 py-1.5 rounded-full font-bold border ${selectedImp.severity === 'critical' ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-amber-50 border-amber-100 text-amber-700'}`}>
                        {selectedImp.message}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {behaviourComputed ? (
                    <div className="grid grid-cols-1 lg:grid-cols-10 gap-0">
                      <div className="lg:col-span-3 border-r border-slate-100 p-2 divide-y divide-slate-50">
                         {behaviourComputed.items.slice(0, 10).map((it: any) => (
                            <div key={it.label} className="flex items-center justify-between p-3 hover:bg-slate-50 transition-colors">
                               <span className="text-xs font-semibold text-slate-600">{it.label}</span>
                               <span className={`text-xs font-bold ${it.value > 80 ? 'text-emerald-600' : it.value > 60 ? 'text-amber-600' : 'text-rose-600'}`}>{it.value}%</span>
                            </div>
                         ))}
                      </div>
                      <div className="lg:col-span-7 h-[350px] sm:h-[400px] flex items-center justify-center p-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart data={behaviourComputed.items.map((it: any) => ({ metric: it.label, value: it.value }))}>
                            <PolarGrid stroke="#e2e8f0" />
                            <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                            <Radar name="Score" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.5} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ) : (
                    <div className="py-20 text-center text-slate-400 font-medium">No recorded behaviour data.</div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 2: FINANCIAL OVERVIEW */}
            <TabsContent value="financials" className="space-y-6 animate-in fade-in duration-500 focus-visible:ring-0">
               {/* Summary Cards */}
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                 <Card className="border-0 shadow-lg relative overflow-hidden bg-white rounded-2xl group transition-all hover:shadow-xl border-l-4 border-rose-500">
                   <CardContent className="p-6">
                     <div className="flex justify-between items-start">
                       <div>
                         <p className="text-slate-400 text-[10px] font-bold tracking-widest uppercase">Arrears Balance</p>
                         <h3 className="text-2xl sm:text-3xl font-black text-slate-800 mt-1">Rs {feeBalance.toLocaleString()}</h3>
                       </div>
                       <div className="bg-rose-50 p-3 rounded-xl text-rose-500">
                         <AlertCircle className="w-6 h-6" />
                       </div>
                     </div>
                     <div className="mt-4 inline-flex items-center text-[10px] font-black bg-rose-50 text-rose-600 px-3 py-1 rounded-md uppercase tracking-wider">
                       Action Required
                     </div>
                   </CardContent>
                 </Card>

                 <Card className="border-0 shadow-lg relative overflow-hidden bg-white rounded-2xl group transition-all hover:shadow-xl border-l-4 border-emerald-500">
                   <CardContent className="p-6">
                     <div className="flex justify-between items-start">
                       <div>
                         <p className="text-slate-400 text-[10px] font-bold tracking-widest uppercase">Total Paid</p>
                         <h3 className="text-2xl sm:text-3xl font-black text-slate-800 mt-1">
                           Rs {(allFees.reduce((s, f) => s + Number(f.paid_amount), 0)).toLocaleString()}
                         </h3>
                       </div>
                       <div className="bg-emerald-50 p-3 rounded-xl text-emerald-500">
                         <CheckCircle2 className="w-6 h-6" />
                       </div>
                     </div>
                     <div className="mt-4 inline-flex items-center text-[10px] font-black bg-emerald-50 text-emerald-600 px-3 py-1 rounded-md uppercase tracking-wider">
                       History Clear
                     </div>
                   </CardContent>
                 </Card>

                 <Card className="border-0 shadow-lg bg-[#013a63] rounded-2xl text-white sm:col-span-2 lg:col-span-1 overflow-hidden relative">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                   <CardContent className="p-6 relative z-10 flex flex-col h-full justify-between min-h-[150px]">
                     <div>
                       <h3 className="text-lg font-bold">Quick Actions</h3>
                       <p className="text-blue-100/70 text-xs mt-1">Download statements or pay online.</p>
                     </div>
                     <div className="flex gap-2">
                       <Button className="bg-white text-[#013a63] hover:bg-white/90 font-bold rounded-xl flex-1 h-11" onClick={() => toast({ title: "Opening Gateway..." })}>
                         Pay Now
                       </Button>
                       <Button variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20 rounded-xl px-0 w-12 h-11" onClick={() => toast({ title: "Downloading..." })}>
                         <Download className="w-5 h-5" />
                       </Button>
                     </div>
                   </CardContent>
                 </Card>
               </div>

               {/* Fee List */}
               <Card className="border shadow-lg rounded-3xl overflow-hidden bg-white">
                 <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-600 rounded-xl shadow-blue-200 shadow-lg">
                        <CreditCard className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="font-bold text-slate-800 text-lg">Detailed Fee History</h3>
                    </div>
                    {feeStatus && (
                      <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        feeStatus === 'paid' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-100' :
                        'bg-rose-500 text-white shadow-md shadow-rose-100'
                      }`}>
                        {feeStatus}
                      </span>
                    )}
                 </div>
                 <div className="divide-y divide-slate-50 max-h-[700px] overflow-y-auto no-scrollbar">
                    {allFees.length > 0 ? (
                      allFees.sort((a,b) => b.month - a.month).map(f => {
                         const monthName = new Date(0, f.month - 1).toLocaleString('en-US', { month: 'short' });
                         const txn = paymentTransactions[f.id] ?? null;
                         const txnStatus = txn?.status ?? null;
                         return (
                           <div key={f.id} className="p-5 flex flex-col gap-4 hover:bg-slate-50/50 transition-colors">
                              {/* Top row: month info + amounts + print button */}
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                 <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex flex-col items-center justify-center font-bold text-slate-400 leading-none">
                                       <span className="text-[10px] uppercase">{f.year}</span>
                                       <span className="text-slate-700">{monthName}</span>
                                    </div>
                                    <div>
                                       <h4 className="font-bold text-slate-800">{monthName} {f.year} Challan</h4>
                                       <div className="flex items-center gap-2 mt-1 flex-wrap">
                                          <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase ${
                                             f.status === 'paid' ? 'border-emerald-200 text-emerald-600 bg-emerald-50' : 'border-rose-200 text-rose-600 bg-rose-50'
                                          }`}>
                                             {f.status}
                                          </span>
                                          {txnStatus === 'pending' && (
                                            <span className="text-[9px] font-black px-2 py-0.5 rounded border uppercase border-amber-200 text-amber-600 bg-amber-50">
                                              Verification Pending
                                            </span>
                                          )}
                                          {txnStatus === 'approved' && (
                                            <span className="text-[9px] font-black px-2 py-0.5 rounded border uppercase border-emerald-200 text-emerald-600 bg-emerald-50">
                                              ✓ Verified
                                            </span>
                                          )}
                                          {txnStatus === 'rejected' && (
                                            <span className="text-[9px] font-black px-2 py-0.5 rounded border uppercase border-red-200 text-red-600 bg-red-50">
                                              ✗ Rejected
                                            </span>
                                          )}
                                       </div>
                                    </div>
                                 </div>
                                 <div className="flex items-center gap-6 text-sm">
                                    <div className="text-center sm:text-left">
                                       <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Total</p>
                                       <p className="font-black text-slate-800">Rs {Number(f.total_amount).toLocaleString()}</p>
                                    </div>
                                    <div className="text-center sm:text-left">
                                       <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Paid</p>
                                       <p className="font-bold text-emerald-600">Rs {Number(f.paid_amount).toLocaleString()}</p>
                                    </div>
                                    <Button variant="ghost" className="rounded-xl font-bold text-blue-600 hover:bg-blue-50 border border-blue-100 h-10" onClick={() => { setActivePrintFee(f); setTimeout(() => window.print(), 100); }}>
                                       <Download className="w-4 h-4 mr-2" />
                                       Print
                                    </Button>
                                 </div>
                              </div>

                              {/* Bank Details (if banks available & fee not paid) */}
                              {activeBanks.length > 0 && f.status !== 'paid' && (
                                <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-700 mb-3">Bank Transfer Details</p>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {activeBanks.map((b: any) => (
                                      <div key={b.id} className="bg-white rounded-lg border border-blue-100 p-3 text-xs space-y-1">
                                        <p className="font-bold text-slate-700">{b.bank_name}</p>
                                        <p className="text-slate-500">Title: <span className="text-slate-700 font-semibold">{b.account_title}</span></p>
                                        <p className="text-slate-500">Acc No: <span className="text-slate-700 font-semibold font-mono">{b.account_number}</span></p>
                                        {b.iban && <p className="text-slate-500">IBAN: <span className="text-slate-700 font-semibold font-mono break-all">{b.iban}</span></p>}
                                      </div>
                                    ))}
                                  </div>
                                  {/* Payment submission area (only if unpaid/partial and not already pending/approved) */}
                                  {txnStatus !== 'approved' && txnStatus !== 'pending' && (
                                    <PaymentSubmitCard
                                      challanId={f.id}
                                      banks={activeBanks}
                                      txn={txn}
                                      isSubmitting={submittingChallanId === f.id}
                                      onSubmit={(payload) => handleSubmitPayment(f.id, payload)}
                                    />
                                  )}
                                  {txnStatus === 'pending' && (
                                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-center">
                                      <p className="text-xs font-bold text-amber-700">🕐 Payment proof submitted — awaiting officer verification</p>
                                      <p className="text-[10px] text-amber-600 mt-1">TXN ID: {txn?.transaction_id}</p>
                                    </div>
                                  )}
                                  {txnStatus === 'approved' && (
                                    <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
                                      <p className="text-xs font-bold text-emerald-700">✅ Payment verified by {txn?.verified_by_name || 'Officer'}</p>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Rejection resubmit */}
                              {txnStatus === 'rejected' && activeBanks.length > 0 && (
                                <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
                                  <p className="text-xs font-bold text-red-700 mb-1">❌ Payment Rejected</p>
                                  <p className="text-[10px] text-red-600 mb-3">Reason: {txn?.reject_reason || 'See officer for details'}</p>
                                  <PaymentSubmitCard
                                    challanId={f.id}
                                    banks={activeBanks}
                                    txn={null}
                                    isSubmitting={submittingChallanId === f.id}
                                    onSubmit={(payload) => handleSubmitPayment(f.id, payload)}
                                  />
                                </div>
                              )}
                           </div>
                         )
                      })
                    ) : (
                      <div className="py-16 text-center text-slate-400 font-medium">No financial records found.</div>
                    )}
                 </div>
               </Card>
            </TabsContent>
          </Tabs>
        </div>

      </div>

      {/* ──────── HIDDEN PRINT AREA ──────── */}
      {activePrintFee && (
        <div className="print-only">
           <ChallanPrintView
             student={student}
             fee={activePrintFee}
             allFees={allFees}
             bankDetails={activeBanks}
             paymentTransaction={paymentTransactions[activePrintFee.id] ?? null}
           />
        </div>
      )}
      {/* Behaviour Modal */}
      <StudentBehaviourModal
        open={behaviourOpen}
        onOpenChange={setBehaviourOpen}
        studentId={studentId}
        studentName={student?.name}
        studentCode={(student as any)?.student_id}
        onSubmit={async (data) => {
          try {
            await createBehaviourRecord({
              student: Number(studentId),
              week_start: data.weekStart,
              week_end: data.weekEnd,
              metrics: data.metrics as any,
              notes: data.notes,
              events: data.events as any
            });
            toast({ title: "Success", description: "Behaviour record saved successfully" });
            
            // Refresh records
            const list = await getStudentBehaviourRecords(studentId);
            setBehaviourRecords(Array.isArray(list) ? list : []);
            
            // Re-sync monthly mode state if needed
            const now = new Date();
            const curMonth = now.getMonth();
            const hasCurrent = (Array.isArray(list) ? list : []).some((r: any) => {
              const d = new Date(r.week_end || r.weekEnd || r.created_at);
              return d.getMonth() === curMonth && d.getFullYear() === now.getFullYear();
            });
            if (hasCurrent) {
              setMonthlyMode(false);
              setMonthlyRecord(null);
            }
          } catch (err: any) {
            toast({ 
              title: "Error", 
              description: err.message || "Failed to save behaviour record", 
              variant: "destructive" 
            });
          }
        }}
      />
    </div>
  )
}

export default function StudentProfilePage() {
  return (
    <Suspense fallback={<StudentProfileSkeleton />}>
      <StudentProfileContent />
    </Suspense>
  )
}
