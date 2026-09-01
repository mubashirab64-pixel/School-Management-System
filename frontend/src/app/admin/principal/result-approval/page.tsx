"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle,
  Clock,
  XCircle,
  Eye,
  FileText,
  Search,
  Filter,
  Send,
  School,
  UserCheck,
  ChevronLeft,
  Award,
  Loader2,
  ArrowRight,
  TrendingUp
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  apiGet,
  principalApproveResult,
  principalRejectResult,
  bulkApproveResults,
  bulkRejectResults,
  getCurrentUserProfile,
  savePrincipalSignature,
  fetchStudentFullResults,
  getStudentById,
  getPrincipalRetests,
  approveRetestPrincipal,
  rejectRetestPrincipal,
  getStudentApprovedRetests,
  Result,
  Student
} from '@/lib/api';
import ApproveWithSignature from "@/components/signature/ApproveWithSignature";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ReportCard } from "@/components/admin/report-card";
import { Printer, X } from "lucide-react";
import { printReportCard } from "@/lib/print-report-card";

// Types
interface ClassStats {
  classroom_id: number;
  grade_name: string;
  section_name: string;
  display_name: string;
  pending_approval_count: number;
  total_results: number;
  pass_count: number;
  fail_count: number;
  approved_count: number;
  overall_percentage: number;
}

interface DashboardKPIs {
  total_pending: number;
  total_results: number;
  pass_rate: number;
  average_performance: number;
  fail_count: number;
}

interface PrincipalResult extends Omit<Result, 'student' | 'subject_marks'> {
  student: Student;
  teacher: {
    id: number;
    full_name: string;
    employee_code: string;
  };
  subject_marks: Array<{
    subject_name: string;
    obtained_marks: number;
    total_marks: number;
    is_pass: boolean;
  }>;
  exam_type: string;
  status: string;
  result_status: string;
  total_marks: number;
  obtained_marks: number;
  percentage: number;
  grade: string;
  created_at: string;
  month?: string;
  class_name?: string;
}

const MONTHS_ORDER = [
  'April', 'May', 'June', 'August', 'September', 'October',
  'November', 'December', 'January', 'February', 'March'
];

const DashboardSkeleton = () => (
  <div className="space-y-8 animate-pulse p-1">
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="h-32 bg-white/50 border-none shadow-sm border-l-4 border-slate-100">
          <CardHeader className="pb-2">
            <Skeleton className="h-2 w-20 mb-3 bg-slate-200" />
            <Skeleton className="h-8 w-16 bg-slate-200" />
          </CardHeader>
        </Card>
      ))}
    </div>
    <div className="h-20 bg-white/50 rounded-2xl border border-slate-100 flex items-center px-6 gap-4">
      <Skeleton className="h-8 w-32 bg-slate-100" />
      <Skeleton className="h-10 w-48 bg-slate-100 rounded-xl" />
      <Skeleton className="h-10 w-48 bg-slate-100 rounded-xl" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Card key={i} className="bg-white/50 border-none shadow-sm rounded-3xl overflow-hidden p-2">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <Skeleton className="h-7 w-32 bg-slate-200" />
                <Skeleton className="h-4 w-24 bg-slate-100 rounded-lg" />
              </div>
              <Skeleton className="h-6 w-20 bg-slate-200 rounded-full" />
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-20 bg-slate-100 rounded-2xl" />
              <Skeleton className="h-20 bg-slate-100 rounded-2xl" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-2 w-full bg-slate-100" />
              <Skeleton className="h-3 w-2/3 bg-slate-100 ml-auto" />
            </div>
          </CardContent>
          <CardFooter>
            <Skeleton className="h-12 w-full bg-slate-200 rounded-2xl" />
          </CardFooter>
        </Card>
      ))}
    </div>
  </div>
);

const DetailSkeleton = () => (
  <div className="space-y-8 animate-pulse p-1">
    <div className="h-24 bg-white/50 rounded-[2rem] border border-slate-100 flex items-center px-8 justify-between">
      <div className="flex items-center gap-6">
        <Skeleton className="h-12 w-32 bg-slate-200 rounded-2xl" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48 bg-slate-200" />
          <Skeleton className="h-3 w-32 bg-slate-100" />
        </div>
      </div>
      <Skeleton className="h-12 w-64 bg-slate-100 rounded-2xl" />
    </div>
    <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white/50">
      <div className="p-8 space-y-6">
        <Skeleton className="h-10 w-full bg-slate-200 rounded-xl" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Skeleton key={i} className="h-16 w-full bg-slate-100/50 rounded-2xl" />
          ))}
        </div>
      </div>
    </Card>
  </div>
);

export default function PrincipalResultApprovalPage() {
  const [viewMode, setViewMode] = useState<'dashboard' | 'detail'>('dashboard');
  const [stats, setStats] = useState<ClassStats[]>([]);
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [selectedClass, setSelectedClass] = useState<ClassStats | null>(null);

  const [results, setResults] = useState<PrincipalResult[]>([]);
  const [filteredResults, setFilteredResults] = useState<PrincipalResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Dashboard Filters
  const [gradeFilter, setGradeFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");

  const [selectedResults, setSelectedResults] = useState<number[]>([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkAction, setBulkAction] = useState<"approve" | "reject">("approve");
  const [bulkComments, setBulkComments] = useState("");
  const [processing, setProcessing] = useState(false);

  const [selectedResultView, setSelectedResultView] = useState<Result | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [reportCardData, setReportCardData] = useState<{ student: Student; results: Result[]; retestResults?: any[] } | null>(null);
  const [fetchingReportCard, setFetchingReportCard] = useState(false);

  const [activeTab, setActiveTab] = useState("midterm"); // Principals only approve Mid Term and Final Term
  const [activeMonthTab, setActiveMonthTab] = useState(MONTHS_ORDER[0]);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [resultToApprove, setResultToApprove] = useState<number | null>(null);
  const [isBulkApprove, setIsBulkApprove] = useState(false);
  const [principalProfile, setPrincipalProfile] = useState<any>(null);
  const [showRetestTab, setShowRetestTab] = useState(false);
  const [retests, setRetests] = useState<any[]>([]);
  const [rejectRetestId, setRejectRetestId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [retestProcessing, setRetestProcessing] = useState(false);

  useEffect(() => {
    getCurrentUserProfile().then(p => { if (p) setPrincipalProfile(p); }).catch(() => {});
    fetchPrincipalRetests();
  }, []);

  const fetchPrincipalRetests = async () => {
    const data = await getPrincipalRetests();
    setRetests(Array.isArray(data) ? data : []);
  };

  const handleApproveRetest = async (id: number) => {
    try {
      setRetestProcessing(true);
      await approveRetestPrincipal(id);
      toast.success('Re-test approved!');
      fetchPrincipalRetests();
    } catch (e: any) { toast.error(e?.message || 'Failed'); }
    finally { setRetestProcessing(false); }
  };

  const handleRejectRetest = async () => {
    if (!rejectRetestId || !rejectReason.trim()) return;
    try {
      setRetestProcessing(true);
      await rejectRetestPrincipal(rejectRetestId, rejectReason);
      toast.success('Re-test returned to teacher.');
      setRejectRetestId(null); setRejectReason('');
      fetchPrincipalRetests();
    } catch (e: any) { toast.error(e?.message || 'Failed'); }
    finally { setRetestProcessing(false); }
  };

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      let url = `/api/result/principal/stats/?exam_type=${activeTab}`;
      if (activeTab === 'monthly') url += `&month=${activeMonthTab}`;

      const data = await apiGet<{ classes_stats?: ClassStats[]; kpis?: DashboardKPIs }>(url);
      if (data && data.classes_stats) {
        setStats(data.classes_stats || []);
        setKpis(data.kpis || null);
      } else if (Array.isArray(data)) {
        setStats(data);
        setKpis(null);
      } else {
        setStats([]);
        setKpis(null);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
      toast.error("Failed to load dashboard stats");
    } finally {
      setLoading(false);
    }
  }, [activeTab, activeMonthTab]);

  const fetchClassResults = useCallback(async (classroomId: number) => {
    try {
      setLoading(true);
      // Construct URL with filters
      let url = `/api/result/?student__classroom=${classroomId}&exam_type=${activeTab}`;
      if (activeTab === 'monthly' && activeMonthTab) {
        url += `&month=${activeMonthTab}`;
      }
      const response = await apiGet<{ results?: PrincipalResult[] } | PrincipalResult[]>(url);

      let safeResults: PrincipalResult[] = [];
      if (Array.isArray(response)) {
        safeResults = response;
      } else if (response && 'results' in response && Array.isArray(response.results)) {
        safeResults = response.results;
      }

      setResults(safeResults);
      setFilteredResults(safeResults);
    } catch (error) {
      console.error("Error fetching class results:", error);
      toast.error("Failed to load class results");
    } finally {
      setLoading(false);
    }
  }, [activeTab, activeMonthTab]);

  const handleViewReportCard = async (result: Result) => {
    try {
      setFetchingReportCard(true);
      setShowViewModal(true);
      setSelectedResultView(result);

      const studentId = result.student.id;

      // Fetch all results for this student
      const [studentResults, completeStudent] = await Promise.all([
        fetchStudentFullResults(studentId),
        getStudentById(studentId)
      ]);

      if (completeStudent) {
        // Inject calculated rank since backend position may not be set yet
        const rankLabels = ['1st', '2nd', '3rd', '4th', '5th'];
        const rankByExamType: Record<string, string> = {};
        for (const et of ['midterm', 'final']) {
          const allForType = results.filter(r => r.exam_type === et);
          const passingSorted = [...allForType]
            .filter(r => r.result_status === 'pass' || r.grade !== 'F')
            .sort((a, b) => (b.percentage || 0) - (a.percentage || 0));
          const sr = allForType.find(r => r.student?.id === studentId);
          if (sr) {
            const idx = passingSorted.findIndex(r => r.id === sr.id);
            if (sr.result_status === 'pass' && idx >= 0 && idx < 5) {
              rankByExamType[et] = rankLabels[idx];
            }
          }
        }
        const resultsWithRank = (studentResults as Result[]).map(r =>
          !r.position && rankByExamType[r.exam_type] ? { ...r, position: rankByExamType[r.exam_type] } : r
        );
        const retestResults = await getStudentApprovedRetests(studentId).catch(() => []);
        setReportCardData({ student: completeStudent, results: resultsWithRank, retestResults: retestResults as any[] });
      } else {
        toast.error("Student details not found");
      }
    } catch (error) {
      console.error('Error fetching student report card:', error);
      toast.error("Failed to load student details");
    } finally {
      setFetchingReportCard(false);
    }
  };

  const filterResults = useCallback(() => {
    let filtered = [...results];
    if (searchTerm) {
      filtered = filtered.filter(r =>
        r.student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.student.student_code?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    setFilteredResults(filtered);
  }, [results, searchTerm]);

  useEffect(() => {
    document.title = "Principal Result Approval - Dashboard | Newton AMS";
    if (viewMode === 'dashboard') {
      fetchStats();
    } else if (viewMode === 'detail' && selectedClass) {
      fetchClassResults(selectedClass.classroom_id);
    }
  }, [viewMode, activeTab, activeMonthTab, fetchStats, fetchClassResults, selectedClass]);

  useEffect(() => {
    if (viewMode === 'detail') {
      filterResults();
    }
  }, [viewMode, filterResults]);

  const getFilteredStats = () => {
    return stats.filter(cls => {
      const matchGrade = gradeFilter === 'all' || cls.grade_name === gradeFilter;
      const matchSection = sectionFilter === 'all' || cls.section_name === sectionFilter;
      return matchGrade && matchSection;
    });
  };

  const getGradeOptions = () => {
    const grades = Array.from(new Set(stats.map(s => s.grade_name))).sort();
    return grades;
  };

  const getSectionOptions = () => {
    const sections = Array.from(new Set(stats.map(s => s.section_name))).sort();
    return sections;
  };

  const getPerformanceColor = (percentage: number) => {
    if (percentage >= 80) return "text-emerald-600";
    if (percentage >= 60) return "text-[#6096ba]";
    if (percentage >= 40) return "text-amber-600";
    return "text-rose-600";
  };

  const getPerformanceBg = (percentage: number) => {
    if (percentage >= 80) return "bg-emerald-500";
    if (percentage >= 60) return "bg-[#6096ba]";
    if (percentage >= 40) return "bg-amber-500";
    return "bg-rose-500";
  };

  // fetchClassResults and filterResults were moved up and wrapped in useCallback


  const handleClassClick = (cls: ClassStats) => {
    setSelectedClass(cls);
    setViewMode('detail');
    fetchClassResults(cls.classroom_id);
  };

  const handleBackToDashboard = () => {
    setSelectedClass(null);
    setViewMode('dashboard');
    setSelectedResults([]);
  };

  // Approval Handlers (Reuse logic)
  const executeApproval = async (resultId: number, signature: string) => {
    try {
      setProcessing(true);
      await principalApproveResult(resultId, {
        status: 'approved',
        principal_comments: 'Approved by Principal',
        signature: signature
      });
      // Save to profile if this is a newly drawn signature
      await saveSignatureToProfile(signature);
      toast.success('Result approved with signature!');
      if (selectedClass) fetchClassResults(selectedClass.classroom_id);
    } catch (err) {
      console.error("Approval error:", err);
      toast.error('Approval failed');
      throw err;
    } finally {
      setProcessing(false);
    }
  };

  const handleApprove = async (resultId: number) => {
    const savedSig = principalProfile?.signature;
    if (savedSig) {
      await executeApproval(resultId, savedSig);
    } else {
      setResultToApprove(resultId);
      setIsBulkApprove(false);
      setShowApproveModal(true);
    }
  };

  // Helper: save newly drawn signature to principal's backend profile
  const saveSignatureToProfile = async (signature: string) => {
    // Only save if principal doesn't have one yet
    if (principalProfile?.signature) return;
    try {
      await savePrincipalSignature(signature);
      // Update local state so modal shows saved signature next time
      setPrincipalProfile((prev: any) => ({ ...prev, signature }));
      toast.success('Signature saved to your profile for future approvals!');
    } catch (err) {
      // Silent fail – approval still succeeds even if save fails
      console.warn('Could not save signature to profile:', err);
    }
  };

  const confirmApprove = async (signature: string) => {
    if (!resultToApprove) return;
    await executeApproval(resultToApprove, signature);
    setShowApproveModal(false);
  };

  const handleReject = async (resultId: number) => {
    try {
      setProcessing(true);
      await principalRejectResult(resultId, { status: 'rejected', principal_comments: 'Rejected' });
      toast.success('Result rejected');
      if (selectedClass) fetchClassResults(selectedClass.classroom_id);
    } catch (err) {
      toast.error('Rejection failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleSelectAll = () => {
    const pendingResults = filteredResults.filter(r => r.status === 'pending_principal');
    if (selectedResults.length === pendingResults.length && pendingResults.length > 0) {
      setSelectedResults([]);
    } else {
      setSelectedResults(pendingResults.map(r => r.id));
    }
  };

  const handleBulkAction = async () => {
    if (selectedResults.length === 0) return;
    
    if (bulkAction === 'reject') {
        try {
          setProcessing(true);
          await bulkRejectResults(selectedResults, bulkComments);
          toast.success(`Rejected ${selectedResults.length} results.`);
          setShowBulkModal(false);
          setSelectedResults([]);
          setBulkComments("");
          if (selectedClass) fetchClassResults(selectedClass.classroom_id);
        } catch (err) {
          toast.error('Bulk rejection failed');
        } finally {
          setProcessing(false);
        }
    } else {
        const savedSig = principalProfile?.signature;
        if (savedSig) {
          try {
            setProcessing(true);
            await bulkApproveResults(selectedResults, bulkComments, savedSig);
            // Save to profile if this is a newly drawn signature (redundant but safe)
            await saveSignatureToProfile(savedSig);
            toast.success(`Approved ${selectedResults.length} results with saved signature.`);
            setShowBulkModal(false);
            setSelectedResults([]);
            setBulkComments("");
            if (selectedClass) fetchClassResults(selectedClass.classroom_id);
          } catch (err) {
            console.error("Bulk approval error:", err);
            toast.error('Bulk approval failed');
          } finally {
            setProcessing(false);
          }
        } else {
          setShowBulkModal(false);
          setIsBulkApprove(true);
          setShowApproveModal(true);
        }
    }
  };

  const confirmBulkApprove = async (signature: string) => {
    try {
      setProcessing(true);
      await bulkApproveResults(selectedResults, bulkComments, signature);
      // Save to profile if this is a newly drawn signature
      await saveSignatureToProfile(signature);
      toast.success(`Approved ${selectedResults.length} results with signature.`);

      setShowApproveModal(false);
      setShowBulkModal(false);
      setSelectedResults([]);
      setBulkComments("");
      if (selectedClass) fetchClassResults(selectedClass.classroom_id);
    } catch (err) {
      console.error("Bulk approval error:", err);
      toast.error('Bulk approval failed');
      throw err;
    } finally {
      setProcessing(false);
    }
  };

  // -- Render Helpers --

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8 bg-slate-50/50 min-h-screen">
      <style jsx global>{`
        ::-webkit-scrollbar {
          display: none;
        }
        * {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-[#6096ba] rounded-lg shadow-lg shadow-blue-100">
              <School className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Principal Approval</h1>
          </div>
          <p className="text-slate-500 max-w-2xl">
            {viewMode === 'dashboard' ? "Campus performance overview and pending approvals." : `Reviewing results for ${selectedClass?.display_name}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Context Info */}
          <Badge variant="outline" className="px-3 py-1 bg-white border-slate-200 text-slate-600">
            {activeTab.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Tabs for Exam Type */}
      <Tabs defaultValue="midterm" value={activeTab} onValueChange={(v) => { setActiveTab(v); setViewMode('dashboard'); setShowRetestTab(false); }} className="space-y-6">
        <div className="flex justify-center md:justify-start gap-2 flex-wrap">
          <TabsList className="bg-white border text-slate-600">
            <TabsTrigger value="midterm">Mid Term</TabsTrigger>
            <TabsTrigger value="final">Final Term</TabsTrigger>
          </TabsList>
          <Button variant={showRetestTab ? 'default' : 'outline'} size="sm"
            onClick={() => setShowRetestTab(!showRetestTab)}
            className={cn('h-10 font-bold', showRetestTab ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600' : 'text-amber-600 border-amber-300 hover:bg-amber-50')}>
            Re-Tests {retests.length > 0 && <span className="ml-1.5 bg-amber-100 text-amber-800 text-xs rounded-full px-1.5 py-0.5">{retests.length}</span>}
          </Button>
        </div>

        {/* Re-Tests Panel */}
        {showRetestTab && (
          <Card className="border-none shadow-xl bg-white/80">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-amber-700 flex items-center gap-2"><FileText className="h-5 w-5" /> Re-Tests Pending Approval</CardTitle>
                  <CardDescription>Mid Term &amp; Final Term re-tests awaiting your approval</CardDescription>
                </div>
                <span className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{retests.length} pending</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {retests.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <CheckCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="font-semibold">No pending re-tests.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-center border-separate border-spacing-0 min-w-[800px]">
                    <thead>
                      <tr className="bg-amber-50 text-amber-800">
                        <th className="sticky left-0 bg-amber-50 py-3 px-4 font-bold text-left border-b border-r border-amber-100 min-w-[160px]">Student</th>
                        <th className="py-3 px-4 font-semibold border-b border-r border-amber-100">Subject</th>
                        <th className="py-3 px-4 font-semibold border-b border-r border-amber-100">Exam</th>
                        <th className="py-3 px-4 font-semibold border-b border-r border-amber-100">Reason</th>
                        <th className="py-3 px-4 font-semibold border-b border-r border-amber-100">Date</th>
                        <th className="py-3 px-4 font-semibold border-b border-r border-amber-100">Marks</th>
                        <th className="py-3 px-4 font-semibold border-b border-r border-amber-100">Result</th>
                        <th className="py-3 px-4 font-semibold border-b border-amber-100">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {retests.map((rt, idx) => (
                        <tr key={rt.retest_result_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}>
                          <td className="sticky left-0 bg-white py-3 px-4 border-b border-r text-left">
                            <div className="font-bold text-[#274c77] text-sm">{rt.student_name}</div>
                            <div className="text-[10px] text-gray-400 font-mono">{rt.student_code}</div>
                            <div className="text-[10px] text-gray-400">{rt.class_name}</div>
                          </td>
                          <td className="border-b border-r py-3 px-4 text-sm font-medium">{rt.subject_name}</td>
                          <td className="border-b border-r py-3 px-4 text-sm capitalize">{rt.exam_type === 'midterm' ? 'Mid Term' : 'Final'}</td>
                          <td className="border-b border-r py-3 px-4">
                            <Badge className={rt.reason === 'absent' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}>{rt.reason}</Badge>
                          </td>
                          <td className="border-b border-r py-3 px-4 text-sm text-gray-500">{rt.scheduled_date || '—'}</td>
                          <td className="border-b border-r py-3 px-4 text-sm font-bold">
                            {rt.is_absent ? <span className="text-amber-600">Absent</span> : `${rt.marks_obtained ?? '—'}/${rt.total_marks}`}
                          </td>
                          <td className="border-b border-r py-3 px-4">
                            <Badge className={rt.pass_status === 'pass' ? 'bg-green-100 text-green-800' : rt.pass_status === 'absent' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}>
                              {rt.pass_status?.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="border-b py-3 px-4">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => handleApproveRetest(rt.retest_result_id)} disabled={retestProcessing}
                                className="h-8 px-3 rounded-lg bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 text-xs font-bold flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" /> Approve
                              </button>
                              <button onClick={() => { setRejectRetestId(rt.retest_result_id); setRejectReason(''); }}
                                className="h-8 px-3 rounded-lg bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 text-xs font-bold flex items-center gap-1">
                                <XCircle className="h-3 w-3" /> Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Reject Retest Modal */}
        {rejectRetestId && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
            <Card className="w-full max-w-sm shadow-2xl border-0 animate-in zoom-in-95 duration-200">
              <CardHeader><CardTitle className="text-rose-700">Reject Re-Test</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <label className="text-sm font-semibold text-gray-600 block">Reason for rejection</label>
                <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3}
                  placeholder="Explain why this re-test result is being rejected..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none" />
              </CardContent>
              <CardContent className="pt-0 flex gap-2">
                <Button variant="ghost" onClick={() => setRejectRetestId(null)} className="flex-1">Cancel</Button>
                <Button onClick={handleRejectRetest} disabled={retestProcessing || !rejectReason.trim()}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white">
                  {retestProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Reject
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        <TabsContent value={activeTab} className="mt-0">
          {viewMode === 'dashboard' ? (
            /* DASHBOARD VIEW */
            loading ? <DashboardSkeleton /> : (
              <div className="space-y-8 animate-in fade-in duration-500">
                {/* KPI Section */}
                {kpis && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card className="bg-white border-none shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden group border-l-4 border-blue-400">
                      <CardHeader className="pb-2">
                        <CardDescription className="text-slate-500 font-bold uppercase text-[9px] tracking-widest">Pending Approvals</CardDescription>
                        <CardTitle className="text-3xl font-black text-[#6096ba]">{kpis.total_pending}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-1.5 text-xs text-[#274c77] font-semibold bg-blue-50 w-fit px-2 py-1 rounded-lg">
                          <Clock className="h-3 w-3" />
                          <span>Action Required</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-white border-none shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden group border-l-4 border-emerald-500">
                      <CardHeader className="pb-2">
                        <CardDescription className="text-slate-500 font-bold uppercase text-[9px] tracking-widest">Pass Rate</CardDescription>
                        <CardTitle className="text-3xl font-black text-emerald-600">{kpis.pass_rate}%</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${kpis.pass_rate}%` }} />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-white border-none shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden group border-l-4 border-amber-500">
                      <CardHeader className="pb-2">
                        <CardDescription className="text-slate-500 font-bold uppercase text-[9px] tracking-widest">Avg. Performance</CardDescription>
                        <CardTitle className="text-3xl font-black text-amber-600">{kpis.average_performance}%</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-1.5 text-xs text-amber-500 font-semibold bg-amber-50 w-fit px-2 py-1 rounded-lg">
                          <TrendingUp className="h-3 w-3" />
                          <span>Campus Avg</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-white border-none shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden group border-l-4 border-rose-500">
                      <CardHeader className="pb-2">
                        <CardDescription className="text-slate-500 font-bold uppercase text-[9px] tracking-widest">Failures</CardDescription>
                        <CardTitle className="text-3xl font-black text-rose-600">{kpis.fail_count}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-1.5 text-xs text-rose-500 font-semibold bg-rose-50 w-fit px-2 py-1 rounded-lg">
                          <XCircle className="h-3 w-3" />
                          <span>Needs Review</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Filters Row */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white/80 backdrop-blur-sm p-4 rounded-2xl border shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-slate-100 rounded-lg">
                      <Filter className="h-4 w-4 text-slate-500" />
                    </div>
                    <span className="text-sm font-bold text-slate-700">Quick Filters</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <Select value={gradeFilter} onValueChange={setGradeFilter}>
                      <SelectTrigger className="w-[140px] bg-slate-50/50 border-slate-200 rounded-xl">
                        <SelectValue placeholder="Grade" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Grades</SelectItem>
                        {getGradeOptions().map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                      </SelectContent>
                    </Select>

                    <Select value={sectionFilter} onValueChange={setSectionFilter}>
                      <SelectTrigger className="w-[140px] bg-slate-50/50 border-slate-200 rounded-xl">
                        <SelectValue placeholder="Section" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sections</SelectItem>
                        {getSectionOptions().map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>

                    <div className="relative flex-1 md:w-72">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Search class or section..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 bg-slate-50/50 border-slate-200 rounded-xl focus-visible:ring-blue-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Classes Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {getFilteredStats().length > 0 ? getFilteredStats().map((cls) => (
                    <Card
                      key={cls.classroom_id}
                      className="group hover:shadow-2xl transition-all duration-500 cursor-pointer border-none bg-white rounded-3xl overflow-hidden relative"
                      onClick={() => handleClassClick(cls)}
                    >
                      {/* Decorative background element - Subtler */}
                      <div className={cn(
                        "absolute -top-12 -right-12 w-32 h-32 rounded-full blur-[80px] opacity-[0.03] group-hover:opacity-10 transition-opacity",
                        getPerformanceBg(cls.overall_percentage)
                      )} />

                      <CardHeader className="pb-3 relative z-10">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1.5">
                            <CardTitle className="text-2xl font-black text-slate-800 tracking-tight group-hover:text-[#6096ba] transition-colors">
                              {cls.grade_name}
                            </CardTitle>
                            <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 font-bold px-3">
                              Section {cls.section_name}
                            </Badge>
                          </div>

                          {cls.pending_approval_count > 0 ? (
                            <Badge className="bg-[#6096ba] text-white animate-pulse border-none shadow-lg shadow-blue-100 px-4 py-1.5 rounded-full font-bold text-[10px]">
                              {cls.pending_approval_count} PENDING
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-500 text-white border-none shadow-lg shadow-emerald-100 px-4 py-1.5 rounded-full font-bold text-[10px] flex items-center gap-1.5">
                              <CheckCircle className="h-3.5 w-3.5" />
                              APPROVED ({cls.approved_count})
                            </Badge>
                          )}
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-6 pt-2 relative z-10">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-emerald-50/30 p-4 rounded-2xl border border-emerald-100/50">
                            <span className="text-[10px] text-emerald-600/70 uppercase font-black tracking-widest block mb-1">Passed</span>
                            <span className="text-2xl font-black text-emerald-600 flex items-center gap-2">
                              {cls.pass_count}
                            </span>
                          </div>
                          <div className="bg-rose-50/30 p-4 rounded-2xl border border-rose-100/50">
                            <span className="text-[10px] text-rose-600/70 uppercase font-black tracking-widest block mb-1">Failed</span>
                            <span className="text-2xl font-black text-rose-600 flex items-center gap-2">
                              {cls.fail_count}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2.5">
                          <div className="flex justify-between items-end text-xs mb-1">
                            <span className="font-bold text-slate-400 uppercase tracking-widest">Performance</span>
                            <span className={cn("text-lg font-black", getPerformanceColor(cls.overall_percentage))}>
                              {cls.overall_percentage}%
                            </span>
                          </div>
                          <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner p-0.5">
                            <div
                              className={cn("h-full rounded-full transition-all duration-1000 shadow-sm", getPerformanceBg(cls.overall_percentage))}
                              style={{ width: `${cls.overall_percentage}%` }}
                            />
                          </div>
                        </div>
                      </CardContent>

                      <CardFooter className="pt-2 pb-6 relative z-10">
                        <Button className={cn(
                          "w-full text-white rounded-2xl shadow-xl border-none group-hover:scale-[1.02] active:scale-95 transition-all h-12 font-bold",
                          cls.pending_approval_count > 0
                            ? "bg-[#6096ba] hover:bg-[#274c77]"
                            : "bg-emerald-500 hover:bg-emerald-600"
                        )}>
                          {cls.pending_approval_count > 0 ? (
                            <>Review Results <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" /></>
                          ) : (
                            <>View Approved <Eye className="h-4 w-4 ml-2" /></>
                          )}
                        </Button>
                      </CardFooter>
                    </Card>
                  )) : (
                    <div className="col-span-full flex flex-col items-center justify-center py-24 text-slate-400 bg-white/50 backdrop-blur rounded-[3rem] border border-dashed border-slate-200">
                      <div className="p-6 bg-slate-50 rounded-full mb-6">
                        <Search className="h-12 w-12 text-slate-300" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-700 mb-2">No matching results</h3>
                      <p className="text-slate-500 mb-8 max-w-sm text-center">We couldn't find any classes matching your current filter criteria.</p>
                      <Button
                        variant="outline"
                        onClick={() => { setGradeFilter('all'); setSectionFilter('all'); setSearchTerm(''); }}
                        className="rounded-2xl border-slate-200 hover:bg-slate-50 font-bold px-8 shadow-sm"
                      >
                        Reset All Filters
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )
          ) : (
            /* DETAIL VIEW */
            loading ? <DetailSkeleton /> : (
              <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
                {/* Context & Actions Bar */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-6 rounded-[2rem] border shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-[#6096ba]" />

                  <div className="flex items-center gap-6">
                    <Button
                      variant="outline"
                      onClick={handleBackToDashboard}
                      className="group gap-2 border-slate-200 text-slate-600 hover:bg-slate-50 rounded-2xl h-12 px-6"
                    >
                      <ChevronLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                      <span className="font-bold">Dashboard</span>
                    </Button>

                    <div className="h-10 w-px bg-slate-100 hidden lg:block" />

                    <div>
                      <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none mb-1">
                        {selectedClass?.grade_name} <span className="text-[#6096ba]">Sheet</span>
                      </h2>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                          Section {selectedClass?.section_name} • {results.length} Students
                        </p>
                        {results.filter(r => r.status === 'pending_principal').length > 0 && (
                          <Badge className="bg-blue-50 text-[#274c77] hover:bg-blue-100 border-none text-[9px] font-black tracking-widest px-2 py-0">
                            {results.filter(r => r.status === 'pending_principal').length} PENDING
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                      <Input
                        placeholder="Search student or roll no..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-10 w-full bg-slate-50 border-none rounded-2xl h-12 font-medium focus-visible:ring-blue-400"
                      />
                    </div>

                    {selectedResults.length > 0 && (
                      <Button
                        onClick={() => setShowBulkModal(true)}
                        className="w-full sm:w-auto bg-[#6096ba] hover:bg-[#274c77] text-white rounded-2xl h-12 px-8 font-black shadow-lg shadow-blue-100 animate-in zoom-in duration-300"
                      >
                        Approve Selected ({selectedResults.length})
                      </Button>
                    )}
                  </div>
                </div>

                {/* Results Table */}
                <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50/80 backdrop-blur-sm border-b">
                        <TableRow className="hover:bg-transparent border-none">
                          <TableHead className="w-[60px] text-center sticky left-0 bg-slate-50 z-20">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleSelectAll}
                              className="h-8 w-8 p-0 rounded-xl hover:bg-indigo-50"
                            >
                              <div className={cn(
                                "h-5 w-5 border-2 rounded-lg transition-all duration-300",
                                selectedResults.length > 0 && selectedResults.length === filteredResults.filter(r => r.status === 'pending_principal').length
                                  ? 'bg-[#6096ba] border-[#6096ba] scale-110'
                                  : 'border-slate-300'
                              )} />
                            </Button>
                          </TableHead>
                          <TableHead className="min-w-[180px] sticky left-[60px] bg-slate-50 z-20 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Student Info</span>
                          </TableHead>

                          {/* Subject Headers */}
                          {Array.from(new Set(results.flatMap(r => r.subject_marks?.map(sm => sm.subject_name) || [])))
                            .filter(subject => !subject.toLowerCase().includes('behaviour'))
                            .sort().map(subject => (
                              <TableHead key={subject} className="text-center min-w-[110px] py-6">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block leading-tight">
                                  {subject.replace(/_/g, ' ')}
                                </span>
                              </TableHead>
                            ))}

                          <TableHead className="text-center bg-blue-50/30">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#6096ba]">Total</span>
                          </TableHead>
                          <TableHead className="text-center">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">%</span>
                          </TableHead>
                          <TableHead className="text-center">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Grade</span>
                          </TableHead>
                          <TableHead className="text-center">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</span>
                          </TableHead>
                          <TableHead className="text-center sticky right-0 bg-slate-50 z-20 shadow-[-4px_0_10px_-4px_rgba(0,0,0,0.05)]">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Actions</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredResults.length > 0 ? (
                          (() => {
                            const allSubjects = Array.from(new Set(results.flatMap(r => r.subject_marks?.map(sm => sm.subject_name) || [])))
                              .filter(subject => !subject.toLowerCase().includes('behaviour'))
                              .sort();
                            return filteredResults.map((result) => (
                              <TableRow key={result.id} className="hover:bg-blue-50/20 transition-colors border-slate-50">
                                <TableCell className="text-center sticky left-0 bg-white group-hover:bg-slate-50 z-10 transition-colors">
                                  {result.status === 'pending_principal' ? (
                                    <input
                                      type="checkbox"
                                      checked={selectedResults.includes(result.id)}
                                      onChange={() => {
                                        if (selectedResults.includes(result.id)) {
                                          setSelectedResults(selectedResults.filter(id => id !== result.id));
                                        } else {
                                          setSelectedResults([...selectedResults, result.id]);
                                        }
                                      }}
                                      className="h-5 w-5 rounded-lg border-2 border-slate-200 accent-[#6096ba] cursor-pointer transition-all hover:scale-110"
                                    />
                                  ) : (
                                    <div className="flex justify-center">
                                      <div className="w-5 h-5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center">
                                        <CheckCircle className="h-3 w-3 text-emerald-400 opacity-40" />
                                      </div>
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="sticky left-[60px] bg-white group-hover:bg-slate-50 z-10 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)] transition-colors">
                                  <div className="space-y-0.5">
                                    <div className="font-black text-slate-800 tracking-tight">{result.student.name}</div>
                                    <div className="text-[10px] text-[#6096ba] font-black tracking-widest uppercase opacity-70">
                                      {result.student.student_code}
                                    </div>
                                  </div>
                                </TableCell>

                                {allSubjects.map(subject => {
                                  const mark = result.subject_marks?.find(sm => sm.subject_name === subject);
                                  return (
                                    <TableCell key={subject} className="text-center">
                                      {mark ? (
                                        <div className="flex flex-col items-center">
                                          <span className={cn(
                                            "text-base font-black",
                                            mark.is_pass === false ? "text-rose-600" : "text-slate-700"
                                          )}>
                                            {mark.obtained_marks}
                                          </span>
                                          <span className="text-[9px] text-slate-400 font-bold tracking-widest">
                                            OF {mark.total_marks}
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-slate-200 font-black text-lg">-</span>
                                      )}
                                    </TableCell>
                                  );
                                })}

                                <TableCell className="text-center bg-blue-50/20">
                                  <div className="flex flex-col items-center">
                                    <span className="text-base font-black text-[#274c77]">{result.obtained_marks}</span>
                                    <span className="text-[9px] text-blue-400 font-bold tracking-widest">
                                      / {result.total_marks}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  <span className={cn(
                                    "font-black text-sm px-2 py-1 rounded-lg bg-slate-50",
                                    result.percentage >= 40 ? "text-slate-700" : "text-rose-600"
                                  )}>
                                    {result.percentage.toFixed(1)}%
                                  </span>
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className={cn(
                                    "inline-flex items-center justify-center w-8 h-8 rounded-full font-black text-xs border-2 shadow-sm",
                                    result.grade === 'F' || result.percentage < 40
                                      ? "border-rose-100 text-rose-600 bg-rose-50"
                                      : "border-emerald-100 text-emerald-600 bg-emerald-50"
                                  )}>
                                    {result.grade}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  {result.result_status === 'pass' ? (
                                    <Badge className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border-none px-3 py-1 font-black text-[9px] tracking-widest rounded-full uppercase">
                                      PASS
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border-none px-3 py-1 font-black text-[9px] tracking-widest rounded-full uppercase">
                                      FAIL
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-center sticky right-0 bg-white group-hover:bg-slate-50 z-10 shadow-[-4px_0_10px_-4px_rgba(0,0,0,0.05)] transition-colors">
                                  <div className="flex items-center justify-center gap-2 px-2">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-9 w-9 p-0 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-[#6096ba] transition-all active:scale-90"
                                      onClick={() => handleViewReportCard(result as any)}
                                      title="View Full Report"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>

                                    {result.status === 'pending_principal' && (
                                      <>
                                        <Button
                                          size="sm"
                                          className="h-9 w-9 p-0 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-100 transition-all hover:scale-110 active:scale-90"
                                          onClick={() => handleApprove(result.id)}
                                          title="Approve"
                                        >
                                          <CheckCircle className="h-4 w-4 text-white" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-9 w-9 p-0 rounded-xl hover:bg-rose-100 text-rose-500 transition-all hover:scale-110 active:scale-90"
                                          onClick={() => handleReject(result.id)}
                                          title="Reject"
                                        >
                                          <XCircle className="h-4 w-4" />
                                        </Button>
                                      </>
                                    )}

                                    {result.status === 'approved' && (
                                      <Badge variant="outline" className="h-9 border-emerald-200 text-emerald-600 bg-emerald-50 font-bold text-[10px] px-2 rounded-xl">
                                        APPROVED
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          })()
                        ) : (
                          <TableRow>
                            <TableCell colSpan={100} className="text-center py-24 bg-slate-50/20">
                              <div className="flex flex-col items-center gap-4 text-slate-400">
                                <div className="p-5 bg-white rounded-full shadow-sm animate-pulse">
                                  <FileText className="h-10 w-10 opacity-20 text-[#6096ba]" />
                                </div>
                                <p className="font-bold tracking-tight">No results found for this class in selected term.</p>
                                <Button variant="outline" onClick={handleBackToDashboard} className="rounded-xl border-slate-200">
                                  Return to Dashboard
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </div>
            ))}
        </TabsContent>
      </Tabs>

      {/* Bulk Action Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <Card className="w-full max-w-md shadow-2xl border-0">
            <CardHeader>
              <CardTitle>Bulk Approval</CardTitle>
              <CardDescription>Approving {selectedResults.length} results for Class {selectedClass?.display_name}</CardDescription>
            </CardHeader>
            <CardFooter className="justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowBulkModal(false)}>Cancel</Button>
              <Button onClick={handleBulkAction} className="bg-[#6096ba] hover:bg-[#274c77] min-w-[140px]" disabled={processing}>
                {processing ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Approving...</span>
                  </div>
                ) : (
                  "Confirm Approval"
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* View Modal - Student Report Card */}
      {
        showViewModal && selectedResultView && (
          <div id="report-card-print-root" className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[120] p-4 animate-in fade-in duration-200 overflow-y-auto print:p-0 print:overflow-visible print:block print:relative print:z-0 print:!bg-white print:inset-auto print:backdrop-filter-none">
            <Card className="w-full max-w-[215mm] max-h-[95vh] overflow-hidden flex flex-col shadow-2xl border-0 rounded-2xl print:shadow-none print:max-w-full print:max-h-full print:overflow-visible print:rounded-none">
              {/* Modal Header */}
              <div className="bg-white px-8 py-5 border-b flex justify-between items-center sticky top-0 z-10 print:hidden shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2 rounded-xl">
                    <FileText className="h-6 w-6 text-[#274c77]" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[#274c77] leading-none">Student Report Card</h2>
                    <p className="text-slate-400 text-xs mt-1.5 uppercase tracking-widest font-black">Principal Approval Portal</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => printReportCard()}
                    variant="outline"
                    className="flex items-center gap-2 h-10 px-4 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    <Printer className="h-4 w-4" /> Print
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setShowViewModal(false);
                      setReportCardData(null);
                    }}
                    className="rounded-xl h-10 w-10 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                  >
                    <X className="h-6 w-6" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-0 bg-slate-50/30 print:overflow-visible print:p-0">
                {fetchingReportCard ? (
                  <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <Loader2 className="h-10 w-10 text-[#274c77] animate-spin" />
                    <p className="text-slate-500 font-bold animate-pulse">Fetching complete result history...</p>
                  </div>
                ) : reportCardData ? (
                  <div className="p-8 print:p-0">
                    <ReportCard
                      student={reportCardData.student}
                      results={reportCardData.results}
                      activeMonth={activeTab === 'monthly' ? activeMonthTab : undefined}
                      retestResults={reportCardData.retestResults}
                      className="print:shadow-none print:border-0"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                    <FileText className="h-12 w-12 mb-3 opacity-20" />
                    <p>No report card data found.</p>
                  </div>
                )}
              </div>

              {/* Modal Footer - Actions for Approval (Hidden in Print) */}
              {!fetchingReportCard && selectedResultView && (
                <div className="bg-white p-5 border-t flex justify-end gap-3 shrink-0 print:hidden shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)]">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => {
                      setShowViewModal(false);
                      setReportCardData(null);
                    }}
                    className="text-slate-500 font-bold h-12 px-8 rounded-xl border-slate-200"
                  >
                    Close
                  </Button>

                  {(['pending', 'submitted', 'pending_principal'].includes(selectedResultView.status)) && (
                    <>
                      <Button
                        variant="destructive"
                        size="lg"
                        onClick={() => {
                          setShowViewModal(false);
                          handleReject(selectedResultView.id);
                        }}
                        className="h-12 px-8 rounded-xl font-bold shadow-lg shadow-rose-200"
                      >
                        <XCircle className="h-5 w-5 mr-2" /> Reject Result
                      </Button>
                      <Button
                        size="lg"
                        onClick={() => {
                          setShowViewModal(false);
                          handleApprove(selectedResultView.id);
                        }}
                        className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white h-12 px-8 rounded-xl font-bold shadow-lg shadow-emerald-200"
                      >
                        <CheckCircle className="h-5 w-5 mr-2" /> Approve Result
                      </Button>
                    </>
                  )}
                </div>
              )}
            </Card>
          </div>
        )
      }

      {/* Signature Modal */}
      <ApproveWithSignature
        isOpen={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        onConfirm={isBulkApprove ? confirmBulkApprove : confirmApprove}
        title={isBulkApprove ? `Bulk Approve ${selectedResults.length} Results` : "Final Result Approval"}
        description={isBulkApprove ? "Providing your signature will approve all selected results for the final report card." : "Please sign to confirm your final approval of this student's report card."}
        savedSignature={principalProfile?.signature || null}
      />
    </div>
  );
}
