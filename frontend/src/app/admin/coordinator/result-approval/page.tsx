"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  CheckCircle,
  Clock,
  XCircle,
  Eye,
  FileText,
  Search,
  Filter,
  Send,
  Printer,
  Loader2,
  X
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getCoordinatorResults,
  approveResult,
  rejectResult,
  bulkApproveResults,
  bulkRejectResults,
  getCurrentUserProfile,
  getSubjects,
  Result,
  Student,
  fetchStudentFullResults,
  getStudentById,
  getCoordinatorRetests,
  approveRetestCoordinator,
  rejectRetestCoordinator,
  getStudentApprovedRetests,
  getCoordinatorEditRequests,
  approveResultEditRequest,
  rejectResultEditRequest,
} from '@/lib/api';
import ApproveWithSignature from "@/components/signature/ApproveWithSignature";
import { toast } from "sonner";
import { ReportCard } from "@/components/admin/report-card";
import { printReportCard } from "@/lib/print-report-card";

interface CoordinatorProfile {
  id: number;
  full_name: string;
  employee_code: string;
  level: {
    id: number;
    name: string;
  } | null;
  assigned_levels?: Array<{ id: number; name: string }>;
  campus: {
    campus_name: string;
  };
  signature?: string | null;
}

interface ResultWithDetails extends Omit<Result, 'student' | 'teacher'> {
  student: Student;
  teacher: {
    id: number;
    full_name: string;
    employee_code: string;
  };
  pass_status?: string;
  updated_at: string;
}

const MONTHS_ORDER = [
  'April', 'May', 'June', 'August', 'September', 'October',
  'November', 'December', 'January', 'February', 'March'
];

export default function ResultApprovalPage() {
  const [coordinatorProfile, setCoordinatorProfile] = useState<CoordinatorProfile | null>(null);
  const [results, setResults] = useState<ResultWithDetails[]>([]);
  const [filteredResults, setFilteredResults] = useState<ResultWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  // Grades derived from the coordinator's own result data
  const [availableGrades, setAvailableGrades] = useState<string[]>([]);
  const [selectedResults, setSelectedResults] = useState<number[]>([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkAction, setBulkAction] = useState<"approve" | "reject">("approve");
  const [bulkComments, setBulkComments] = useState("");
  const [processing, setProcessing] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedResultView, setSelectedResultView] = useState<Result | null>(null);
  const [reportCardData, setReportCardData] = useState<{ student: Student; results: Result[]; retestResults?: any[] } | null>(null);
  const [fetchingReportCard, setFetchingReportCard] = useState(false);
  const [activeTab, setActiveTab] = useState("monthly_test");
  const [activeMonthTab, setActiveMonthTab] = useState(MONTHS_ORDER[0]);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [resultToApprove, setResultToApprove] = useState<number | null>(null);
  const [isBulkApprove, setIsBulkApprove] = useState(false);
  const [selectedLevelId, setSelectedLevelId] = useState<number | 'all'>('all');
  const [showRetestTab, setShowRetestTab] = useState(false);
  const [retests, setRetests] = useState<any[]>([]);
  const [rejectRetestId, setRejectRetestId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [retestProcessing, setRetestProcessing] = useState(false);
  // Approved retests for students currently in view — used to overlay retest
  // marks on the results table (subject cells + total/percentage/grade) so the
  // preview matches the report card after edits and approved retests.
  const [approvedRetests, setApprovedRetests] = useState<any[]>([]);
  // Edit-request workflow
  const [showEditRequestsTab, setShowEditRequestsTab] = useState(false);
  const [editRequests, setEditRequests] = useState<any[]>([]);
  const [rejectEditRequestId, setRejectEditRequestId] = useState<number | null>(null);
  const [editRequestRejectReason, setEditRequestRejectReason] = useState('');
  const [editRequestProcessing, setEditRequestProcessing] = useState(false);

  useEffect(() => {
    document.title = "Result Approval - Coordinator | Newton AMS";
    fetchData();
    fetchRetests();
    fetchEditRequests();
  }, []);

  // Derive unique grade names from results, filtered by selected level
  useEffect(() => {
    // When a specific level is selected, only show grades from that level's results
    const baseResults = selectedLevelId === 'all'
      ? results
      : results.filter(r => (r.student as any)?.level?.id === selectedLevelId);

    const gradeNames = Array.from(
      new Set(
        baseResults
          .map(r => (r.student as any)?.grade_name || (r.student as any)?.class_name?.split(' -')[0]?.trim() || "")
          .filter(Boolean)
      )
    ).sort();
    setAvailableGrades(gradeNames);
    // Reset grade filter if current value no longer exists in new options
    if (gradeFilter !== 'all' && !gradeNames.includes(gradeFilter)) {
      setGradeFilter('all');
    }
  }, [results, selectedLevelId]);

  useEffect(() => {
    filterResults();
  }, [results, searchTerm, statusFilter, gradeFilter, activeTab, activeMonthTab, selectedLevelId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log(' Starting fetchData...');

      // API connectivity will be tested through authenticated calls

      // Check if user is logged in
      const token = localStorage.getItem('sis_access_token');
      console.log(' Token check:', token ? 'Token exists' : 'No token');

      if (!token) {
        console.error(' No authentication token found');
        toast.error('Please log in again');
        // Clear all auth data
        localStorage.removeItem('sis_access_token');
        localStorage.removeItem('sis_refresh_token');
        // Redirect to login
        window.location.href = '/login';
        return;
      }

      // Get coordinator profile
      console.log(' Fetching coordinator profile...');
      try {
        const profile = await getCurrentUserProfile();
        console.log(' Profile received:', profile);

        // Check if user is coordinator
        if ((profile as any).role !== 'coordinator') {
          console.error(' User is not a coordinator');
          toast.error('Access denied. Coordinator access required.');
          window.location.href = '/login';
          return;
        }

        setCoordinatorProfile(profile as CoordinatorProfile);
      } catch (profileError: any) {
        console.error(' Error fetching profile:', profileError);
        if (profileError?.status === 401) {
          toast.error('Session expired. Please log in again.');
          localStorage.clear();
          window.location.href = '/login';
          return;
        }
        throw profileError;
      }

      // Fetch all results assigned to coordinator
      console.log(' Fetching coordinator results...');
      try {
        const resultsData = await getCoordinatorResults();
        console.log(' Coordinator results data from API:', resultsData);
        console.log(' Results data type:', typeof resultsData);
        console.log(' Is array?', Array.isArray(resultsData));
        console.log(' Results length:', Array.isArray(resultsData) ? resultsData.length : 0);
        console.log(' First result:', Array.isArray(resultsData) ? resultsData[0] : 'Not array');
        console.log(' All results statuses:', Array.isArray(resultsData) ? resultsData.map((r: any) => ({ id: r.id, status: r.status, student: r.student?.name })) : 'Not array');

        // Ensure results is always an array
        const safeResults = Array.isArray(resultsData) ? resultsData : [];
        console.log(' Safe results set:', safeResults.length);
        setResults(safeResults as ResultWithDetails[]);

        if (safeResults.length === 0) {
          console.log(' No results found for this coordinator');
          toast.info('No results found. Teachers need to forward results to you first.');
        } else {
          console.log(' Successfully loaded results for coordinator');
          toast.success(`Loaded ${safeResults.length} results successfully!`);
        }
      } catch (resultsError: any) {
        console.error(' Error fetching results:', resultsError);
        console.error(' Error status:', resultsError?.status);
        console.error(' Error message:', resultsError?.message);
        console.error(' Full error:', resultsError);

        if (resultsError?.status === 401) {
          console.log(' Authentication error - redirecting to login');
          toast.error('Session expired. Please log in again.');
          localStorage.clear();
          window.location.href = '/login';
          return;
        }

        // Show more specific error message
        const errorMessage = resultsError?.message || resultsError?.response?.data?.error || 'Failed to load results. Please try again.';
        toast.error(`Error: ${errorMessage}`);
        setResults([]);
      }

    } catch (error: any) {
      console.error(' Error fetching data:', error);
      console.error(' Error details:', error?.message);
      console.error(' Error stack:', error?.stack);
      toast.error('Failed to load data');
      // Set empty array on error
      setResults([]);
    } finally {
      setLoading(false);
      console.log('✅ fetchData completed');
    }
  };

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
        // Inject calculated rank (same logic as list view) since backend position may not be set yet
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
        const resultsWithRank = studentResults.map((r: Result) =>
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

  const filterResults = () => {
    // Ensure results is always an array
    const safeResults = Array.isArray(results) ? results : [];
    let filtered = [...safeResults];

    // Level filter
    if (selectedLevelId !== 'all') {
      filtered = filtered.filter(result => result.student?.level?.id === selectedLevelId);
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(result =>
        result.student?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        result.student?.student_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        result.teacher?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Grade filter — match by grade_name or class_name prefix
    if (gradeFilter !== "all") {
      filtered = filtered.filter(result => {
        const gradeName = (result.student as any)?.grade_name || "";
        const className = result.student?.class_name || "";
        // Direct match on grade_name field (most reliable)
        if (gradeName === gradeFilter) return true;
        // Fallback: class_name starts with the grade name (e.g. "Grade I - A" starts with "Grade I")
        if (className.startsWith(gradeFilter)) return true;
        return false;
      });
    }

    // Exam Type Tab Filter — backend values: 'monthly', 'midterm', 'final'
    const tabToExamType: Record<string, string> = {
      monthly_test: 'monthly',
      mid_term: 'midterm',
      final_term: 'final',
    };
    const examTypeValue = tabToExamType[activeTab];
    if (examTypeValue) {
      filtered = filtered.filter(result => result.exam_type === examTypeValue);
      if (examTypeValue === 'monthly' && activeMonthTab) {
        filtered = filtered.filter(result => result.month === activeMonthTab);
      }
    }

    setFilteredResults(filtered);
  };

  const fetchRetests = async () => {
    const data = await getCoordinatorRetests();
    setRetests(Array.isArray(data) ? data : []);
  };

  // Load approved retests for the students currently in view (tagged with student_id).
  useEffect(() => {
    const ids = Array.from(new Set(filteredResults.map((r: any) => r.student?.id).filter(Boolean)));
    if (!ids.length) { setApprovedRetests([]); return; }
    let alive = true;
    Promise.all(ids.map((id: any) =>
      getStudentApprovedRetests(id)
        .then((list: any) => (Array.isArray(list) ? list : []).map((rt: any) => ({ ...rt, student_id: id })))
        .catch(() => [])
    )).then((lists) => { if (alive) setApprovedRetests(lists.flat()); });
    return () => { alive = false; };
  }, [filteredResults]);

  // Recompute Obtained/Percentage/Grade/Pass live from subject_marks (with an
  // approved-retest overlay per subject) — mirrors the teacher table & report card
  // so edits and retests always reflect here. `retestBySubject` drives the cells.
  const getEffectiveResult = (result: any) => {
    if (result.is_absent || result.pass_status === 'absent') return null;
    // Mid Term passes at 33% (with an E grade for 33-39%); Final/Monthly at 40%.
    const isMid = result.exam_type === 'midterm';
    const passPct = isMid ? 33 : 40;
    const rts = approvedRetests.filter((rt: any) =>
      rt.student_id === result.student?.id &&
      rt.exam_type === result.exam_type &&
      (result.exam_type !== 'monthly' || rt.month?.toLowerCase() === (result as any).month?.toLowerCase())
    );
    const subjects = (result.subject_marks || []).filter(
      (sm: any) => !sm.subject_name?.toLowerCase().includes('behaviour')
    );
    if (!subjects.length) return null;
    let obtained = 0, totalPossible = 0, anyFail = false, hasRetest = false;
    const retestBySubject: Record<string, number> = {};
    for (const sm of subjects) {
      const rt = rts.find((r: any) => r.subject_name?.toLowerCase().trim() === sm.subject_name?.toLowerCase().trim());
      if (rt) { hasRetest = true; retestBySubject[sm.subject_name] = rt.marks_obtained || 0; }
      const eff = rt ? (rt.marks_obtained || 0) : (sm.obtained_marks || 0);
      const subTotal = (sm.total_marks || 25);
      obtained += eff;
      totalPossible += subTotal;
      if ((eff / subTotal) * 100 < passPct) anyFail = true;
    }
    const pct = totalPossible > 0 ? (obtained / totalPossible) * 100 : 0;
    const gradeMap = (p: number) => p >= 80 ? 'A+' : p >= 70 ? 'A' : p >= 60 ? 'B' : p >= 50 ? 'C' : p >= 40 ? 'D' : (isMid && p >= 33 ? 'E' : 'F');
    return { obtained, percentage: pct, grade: anyFail ? 'F' : gradeMap(pct), isPassing: !anyFail, hasRetest, retestBySubject };
  };

  const handleApproveRetest = async (id: number) => {
    try {
      setRetestProcessing(true);
      await approveRetestCoordinator(id);
      toast.success('Re-test approved!');
      fetchRetests();
    } catch (e: any) { toast.error(e?.message || 'Failed'); }
    finally { setRetestProcessing(false); }
  };

  const handleRejectRetest = async () => {
    if (!rejectRetestId || !rejectReason.trim()) return;
    try {
      setRetestProcessing(true);
      await rejectRetestCoordinator(rejectRetestId, rejectReason);
      toast.success('Re-test returned to teacher.');
      setRejectRetestId(null); setRejectReason('');
      fetchRetests();
    } catch (e: any) { toast.error(e?.message || 'Failed'); }
    finally { setRetestProcessing(false); }
  };

  const fetchEditRequests = async () => {
    const data = await getCoordinatorEditRequests();
    setEditRequests(Array.isArray(data) ? data : []);
  };

  const handleApproveEditRequest = async (id: number) => {
    try {
      setEditRequestProcessing(true);
      await approveResultEditRequest(id);
      toast.success('Edit approved — result re-opened for the teacher.');
      fetchEditRequests();
      fetchData();
    } catch (e: any) { toast.error(e?.response?.data?.error || e?.message || 'Failed'); }
    finally { setEditRequestProcessing(false); }
  };

  const handleRejectEditRequest = async () => {
    if (!rejectEditRequestId || !editRequestRejectReason.trim()) return;
    try {
      setEditRequestProcessing(true);
      await rejectResultEditRequest(rejectEditRequestId, editRequestRejectReason);
      toast.success('Edit request rejected.');
      setRejectEditRequestId(null); setEditRequestRejectReason('');
      fetchEditRequests();
    } catch (e: any) { toast.error(e?.response?.data?.error || e?.message || 'Failed'); }
    finally { setEditRequestProcessing(false); }
  };

  const executeApproval = async (resultId: number, signature: string) => {
    try {
      setProcessing(true);
      await approveResult(resultId, { 
        status: 'approved', 
        coordinator_comments: '',
        signature: signature
      });
      toast.success('Result approved with signature!');
      await fetchData();
    } catch (error) {
      console.error('Error approving result:', error);
      toast.error('Failed to approve result');
      throw error; // Re-throw for modal error handling
    } finally {
      setProcessing(false);
    }
  };

  const handleApprove = async (resultId: number) => {
    const savedSig = (coordinatorProfile as any)?.signature;
    if (savedSig) {
      await executeApproval(resultId, savedSig);
    } else {
      setResultToApprove(resultId);
      setIsBulkApprove(false);
      setShowApproveModal(true);
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
      await rejectResult(resultId, { status: 'rejected', coordinator_comments: 'Please review and resubmit' });
      toast.success('Result rejected successfully!');
      await fetchData();
    } catch (error) {
      console.error('Error rejecting result:', error);
      toast.error('Failed to reject result');
    } finally {
      setProcessing(false);
    }
  };

  const handleSelectResult = (resultId: number) => {
    setSelectedResults(prev =>
      prev.includes(resultId)
        ? prev.filter(id => id !== resultId)
        : [...prev, resultId]
    );
  };

  const handleSelectAll = () => {
    // Only select items that are actionable (not approved or rejected)
    const actionableResults = filteredResults.filter(r =>
      ['pending', 'submitted', 'pending_coordinator'].includes(r.status)
    );

    if (selectedResults.length === actionableResults.length && actionableResults.length > 0) {
      setSelectedResults([]);
    } else {
      setSelectedResults(actionableResults.map(r => r.id));
    }
  };

  const handleBulkAction = async () => {
    if (selectedResults.length === 0) {
      toast.error('Please select results to process');
      return;
    }

    if (bulkAction === "reject") {
      try {
        setProcessing(true);
        await bulkRejectResults(selectedResults, bulkComments);
        toast.success(`Rejected ${selectedResults.length} results successfully!`);
        setShowBulkModal(false);
        setSelectedResults([]);
        setBulkComments("");
        await fetchData();
      } catch (error) {
        console.error('Error processing bulk rejection:', error);
        toast.error('Failed to process bulk rejection');
      } finally {
        setProcessing(false);
      }
    } else {
      const savedSig = (coordinatorProfile as any)?.signature;
      if (savedSig) {
        try {
          setProcessing(true);
          await bulkApproveResults(selectedResults, bulkComments, savedSig);
          toast.success(`Approved ${selectedResults.length} results with saved signature!`);
          setShowBulkModal(false);
          setSelectedResults([]);
          setBulkComments("");
          await fetchData();
        } catch (error) {
          console.error('Error processing bulk approval:', error);
          toast.error('Failed to process bulk approval');
        } finally {
          setProcessing(false);
        }
      } else {
        // For bulk approve, close the bulk modal and show signature modal
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
      toast.success(`Approved ${selectedResults.length} results with signature!`);
      
      setShowApproveModal(false);
      setShowBulkModal(false);
      setSelectedResults([]);
      setBulkComments("");
      await fetchData();
    } catch (error) {
       console.error('Error processing bulk approval:', error);
       toast.error('Failed to process bulk approval');
       throw error;
    } finally {
      setProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'submitted': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-orange-100 text-orange-800';
      case 'pending_coordinator': return 'bg-orange-100 text-orange-800 border border-orange-200';
      case 'pending_principal': return 'bg-indigo-100 text-indigo-800 border border-indigo-200';
      case 'under_review': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A+': return 'bg-green-100 text-green-800';
      case 'A': return 'bg-blue-100 text-blue-800';
      case 'B': return 'bg-yellow-100 text-yellow-800';
      case 'C': return 'bg-orange-100 text-orange-800';
      case 'D': return 'bg-red-100 text-red-800';
      case 'F': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-96 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-4">
            <div className="h-8 w-40 bg-gray-200 rounded-full animate-pulse" />
            <div className="h-8 w-32 bg-gray-200 rounded-full animate-pulse" />
          </div>
        </div>

        {/* Summary Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
                  <div className="ml-4 space-y-2 flex-1">
                    <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                    <div className="h-6 w-12 bg-gray-200 rounded animate-pulse" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters Skeleton */}
        <Card>
          <CardHeader>
            <div className="h-6 w-40 bg-gray-200 rounded animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 bg-gray-200 rounded animate-pulse" />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Results Table Skeleton */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
              <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                  <div className="h-4 w-4 bg-gray-200 rounded animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
                    <div className="h-3 w-3/4 bg-gray-200 rounded animate-pulse" />
                  </div>
                  <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
                  <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 md:p-8 bg-gray-50/30 min-h-screen">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#274c77] tracking-tight">Result Approval</h1>
          <p className="text-gray-500 mt-1">Manage and approve student results efficiently.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {(() => {
            const levels = coordinatorProfile?.assigned_levels?.length
              ? coordinatorProfile.assigned_levels
              : coordinatorProfile?.level ? [coordinatorProfile.level] : [];
            if (levels.length > 1) {
              return (
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => setSelectedLevelId('all')} className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${selectedLevelId === 'all' ? 'bg-[#274c77] text-white border-[#274c77]' : 'bg-white text-[#274c77] border-[#a3cef1] hover:bg-[#a3cef1]/20'}`}>All Levels</button>
                  {levels.map(l => (
                    <button key={l.id} onClick={() => setSelectedLevelId(l.id)} className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${selectedLevelId === l.id ? 'bg-[#274c77] text-white border-[#274c77]' : 'bg-white text-[#274c77] border-[#a3cef1] hover:bg-[#a3cef1]/20'}`}>{l.name}</button>
                  ))}
                </div>
              );
            }
            return <Badge className="bg-[#a3cef1]/30 text-[#274c77] border border-[#a3cef1] px-4 py-2 text-sm">Level: {levels[0]?.name || '...'}</Badge>;
          })()}
          <p className="text-sm font-medium text-gray-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card><CardContent className="p-6"><div className="flex items-center"><Clock className="h-8 w-8 text-orange-600" /><div className="ml-4"><p className="text-sm font-medium text-gray-600">Pending Review</p><p className="text-2xl font-bold text-orange-600">{filteredResults.filter(r => ['pending', 'pending_coordinator'].includes(r.status)).length}</p></div></div></CardContent></Card>
        <Card><CardContent className="p-6"><div className="flex items-center"><Send className="h-8 w-8 text-blue-600" /><div className="ml-4"><p className="text-sm font-medium text-gray-600">Submitted</p><p className="text-2xl font-bold text-blue-600">{filteredResults.filter(r => r.status === 'submitted').length}</p></div></div></CardContent></Card>
        <Card><CardContent className="p-6"><div className="flex items-center"><CheckCircle className="h-8 w-8 text-green-600" /><div className="ml-4"><p className="text-sm font-medium text-gray-600">Approved</p><p className="text-2xl font-bold text-green-600">{filteredResults.filter(r => r.status === 'approved').length}</p></div></div></CardContent></Card>
        <Card><CardContent className="p-6"><div className="flex items-center"><FileText className="h-8 w-8 text-[#274c77]" /><div className="ml-4"><p className="text-sm font-medium text-gray-600">Total Results</p><p className="text-2xl font-bold text-[#274c77]">{filteredResults.length}</p></div></div></CardContent></Card>
      </div>

      {/* Exam Tabs */}
      <div className="flex flex-wrap gap-2 bg-white/50 p-1.5 rounded-2xl border border-[#a3cef1]/30">
        {[{value:'monthly_test',label:'Monthly Test'},{value:'mid_term',label:'Mid Term'},{value:'final_term',label:'Final Term'}].map(t => (
          <Button key={t.value} variant={!showRetestTab && !showEditRequestsTab && activeTab === t.value ? 'default' : 'ghost'} size="sm"
            onClick={() => { setActiveTab(t.value); setShowRetestTab(false); setShowEditRequestsTab(false); }}
            className={cn('rounded-xl transition-all font-bold px-6 py-5', !showRetestTab && !showEditRequestsTab && activeTab === t.value ? 'bg-[#274c77] text-white shadow-lg scale-105' : 'text-[#6096ba] hover:bg-[#a3cef1]/20 hover:text-[#274c77]')}
          >{t.label}</Button>
        ))}
        <Button variant={showRetestTab ? 'default' : 'ghost'} size="sm"
          onClick={() => { setShowRetestTab(true); setShowEditRequestsTab(false); fetchRetests(); }}
          className={cn('rounded-xl transition-all font-bold px-6 py-5', showRetestTab ? 'bg-amber-600 text-white shadow-lg scale-105' : 'text-amber-600 hover:bg-amber-50')}>
          Re-Tests {retests.length > 0 && <span className="ml-1.5 bg-white/30 text-xs rounded-full px-1.5 py-0.5">{retests.length}</span>}
        </Button>
        <Button variant={showEditRequestsTab ? 'default' : 'ghost'} size="sm"
          onClick={() => { setShowEditRequestsTab(true); setShowRetestTab(false); fetchEditRequests(); }}
          className={cn('rounded-xl transition-all font-bold px-6 py-5', showEditRequestsTab ? 'bg-purple-600 text-white shadow-lg scale-105' : 'text-purple-600 hover:bg-purple-50')}>
          Edit Requests {editRequests.length > 0 && <span className="ml-1.5 bg-white/30 text-xs rounded-full px-1.5 py-0.5">{editRequests.length}</span>}
        </Button>
      </div>

      {/* Month Sub-Tabs */}
      {activeTab === 'monthly_test' && !showRetestTab && !showEditRequestsTab && (
        <div className="flex flex-wrap gap-2 bg-gray-50 p-2 rounded-xl border border-gray-200">
          {MONTHS_ORDER.map(m => (
            <Button key={m} variant={activeMonthTab === m ? 'default' : 'ghost'} size="sm"
              onClick={() => setActiveMonthTab(m)}
              className={cn('rounded-lg transition-all', activeMonthTab === m ? 'bg-[#6096ba] text-white shadow-md' : 'text-gray-600 hover:bg-white hover:shadow-sm')}
            >{m}</Button>
          ))}
        </div>
      )}

      {/* Re-Tests Panel */}
      {showRetestTab && (
        <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-amber-700 flex items-center gap-2">
                  <FileText className="h-5 w-5" /> Re-Tests Pending Approval
                </CardTitle>
                <CardDescription>Monthly re-tests awaiting your approval</CardDescription>
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
                      <th className="py-3 px-4 font-semibold border-b border-r border-amber-100">Month</th>
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
                        <td className="border-b border-r py-3 px-4 text-sm">{rt.month || '—'}</td>
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

      {/* Edit Requests Panel */}
      {showEditRequestsTab && (
        <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-purple-700 flex items-center gap-2">
                  <FileText className="h-5 w-5" /> Result Edit Requests
                </CardTitle>
                <CardDescription>Teachers requesting permission to edit an approved result. Approving re-opens the result for the teacher to edit &amp; re-submit.</CardDescription>
              </div>
              <span className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{editRequests.length} pending</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {editRequests.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <CheckCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-semibold">No pending edit requests.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                    <tr>
                      <th className="text-left py-3 px-4">Student</th>
                      <th className="text-left py-3 px-4">Teacher</th>
                      <th className="text-left py-3 px-4">Exam</th>
                      <th className="text-left py-3 px-4">Reason</th>
                      <th className="text-center py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editRequests.map((er, idx) => (
                      <tr key={er.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}>
                        <td className="py-3 px-4">
                          <div className="font-bold text-[#274c77]">{er.student_name}</div>
                          <div className="text-[10px] text-gray-400 font-mono">{er.student_code}</div>
                        </td>
                        <td className="py-3 px-4 text-gray-600">{er.teacher_name}</td>
                        <td className="py-3 px-4 text-gray-600 capitalize">{er.exam_type}{er.month ? ` (${er.month})` : ''}</td>
                        <td className="py-3 px-4 text-gray-700 max-w-xs"><span className="line-clamp-2">{er.reason}</span></td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2 justify-center">
                            <button onClick={() => handleApproveEditRequest(er.id)} disabled={editRequestProcessing}
                              className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold disabled:opacity-50">
                              Approve
                            </button>
                            <button onClick={() => { setRejectEditRequestId(er.id); setEditRequestRejectReason(''); }}
                              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold">
                              Reject
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

      {/* Reject Edit Request Modal */}
      {rejectEditRequestId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
          <Card className="w-full max-w-sm shadow-2xl border-0 animate-in zoom-in-95 duration-200">
            <CardHeader><CardTitle className="text-rose-700">Reject Edit Request</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <label className="text-sm font-semibold text-gray-600 block">Reason for rejection</label>
              <textarea value={editRequestRejectReason} onChange={e => setEditRequestRejectReason(e.target.value)} rows={3}
                placeholder="Explain why this edit request is being rejected..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none" />
            </CardContent>
            <CardContent className="pt-0 flex gap-2">
              <Button variant="ghost" onClick={() => setRejectEditRequestId(null)} className="flex-1">Cancel</Button>
              <Button onClick={handleRejectEditRequest} disabled={editRequestProcessing || !editRequestRejectReason.trim()}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white">
                {editRequestProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Reject
              </Button>
            </CardContent>
          </Card>
        </div>
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

      {/* Results Card */}
      {!showRetestTab && !showEditRequestsTab && <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
        <CardHeader>
          <div className="flex justify-between items-center flex-wrap gap-3">
            <div>
              <CardTitle className="text-[#274c77] flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {activeTab === 'monthly_test' ? 'Monthly Test Results' : activeTab === 'mid_term' ? 'Mid Term Results' : 'Final Term Results'}
                {activeTab === 'monthly_test' && <span className="text-[#6096ba]">({activeMonthTab})</span>}
              </CardTitle>
              <CardDescription>List of all results waiting for approval or processed.</CardDescription>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input placeholder="Search students..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 bg-white h-9 text-sm" />
              </div>
              <Select value={gradeFilter} onValueChange={setGradeFilter}>
                <SelectTrigger className="w-[140px] bg-white h-9 text-sm">
                  <Filter className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
                  <SelectValue placeholder="All Grades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Grades</SelectItem>
                  {availableGrades.map(g => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedResults.length > 0 && (
                <Button onClick={() => setShowBulkModal(true)} className="bg-[#274c77] hover:bg-[#1e3a5f] text-white h-9 text-sm animate-in fade-in duration-200">
                  Bulk Action ({selectedResults.length})
                </Button>
              )}
              <div className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{filteredResults.length} results</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredResults.length === 0 ? (
            <div className="text-center py-16 bg-gray-50/50">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-500 mb-1">No results found</h3>
              <p className="text-gray-400 text-sm">Teachers need to submit &amp; forward results first.</p>
            </div>
          ) : (
            <div className="relative overflow-x-auto border-t border-gray-100 custom-scrollbar pb-2">
              {(() => {
                const allSubjects = Array.from(new Set(filteredResults.flatMap(r => r.subject_marks?.map((sm: any) => sm.subject_name) || [])))
                  .filter(s => !s.toLowerCase().includes('behaviour')).sort();
                const passingSorted = [...filteredResults].filter(r => r.result_status === 'pass').sort((a, b) => (b.percentage || 0) - (a.percentage || 0));
                const rankLabels = ['1st', '2nd', '3rd', '4th', '5th'];
                const rankColors = [
                  'bg-yellow-50 text-yellow-700 border-yellow-100',
                  'bg-slate-50 text-slate-700 border-slate-100',
                  'bg-orange-50 text-orange-700 border-orange-100',
                  'bg-blue-50 text-blue-600 border-blue-100',
                  'bg-gray-50 text-gray-600 border-gray-100',
                ];
                const isAllCompleted = filteredResults.every(r => !['draft','submitted'].includes(r.status));
                return (
                  <table className="w-full text-center border-separate border-spacing-0 min-w-[900px]">
                    <thead>
                      <tr className="bg-[#a3cef1] text-[#274c77]">
                        <th className="sticky left-0 z-40 bg-[#a3cef1] py-4 px-4 font-bold whitespace-nowrap border-b border-r border-[#8ab8de] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-left min-w-[180px]">Student</th>
                        <th className="py-4 px-3 border-b border-r font-bold whitespace-nowrap min-w-[50px]">
                          <div className="flex flex-col items-center gap-1">
                            <input type="checkbox"
                              checked={selectedResults.length === filteredResults.filter(r => !['approved','rejected','pending_principal'].includes(r.status)).length && filteredResults.filter(r => !['approved','rejected','pending_principal'].includes(r.status)).length > 0}
                              onChange={handleSelectAll}
                              className="h-4 w-4 rounded border-[#274c77]/30 text-[#274c77]"
                            />
                          </div>
                        </th>
                        {allSubjects.map(s => (
                          <th key={s} className="py-4 px-3 border-b border-r font-semibold whitespace-nowrap min-w-[100px] text-sm">{s.replace(/_/g,' ')}</th>
                        ))}
                        <th className="py-4 px-4 border-b border-r font-semibold whitespace-nowrap">Total</th>
                        <th className="py-4 px-4 border-b border-r font-semibold whitespace-nowrap">%</th>
                        <th className="py-4 px-4 border-b border-r font-semibold whitespace-nowrap">Grade</th>
                        <th className="py-4 px-4 border-b border-r font-semibold whitespace-nowrap">Rank</th>
                        <th className="py-4 px-4 border-b border-r font-semibold whitespace-nowrap">Result</th>
                        <th className="py-4 px-4 border-b border-r font-semibold whitespace-nowrap">Status</th>
                        <th className="py-4 px-4 border-b font-semibold whitespace-nowrap">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredResults.map(result => {
                        const isAbsent = result.pass_status === 'absent';
                        const rankIdx = passingSorted.findIndex(r => r.id === result.id);
                        const eff = getEffectiveResult(result);
                        const effObtained = eff ? eff.obtained : result.obtained_marks;
                        const effPct = eff ? eff.percentage : (result.percentage ?? 0);
                        const effGrade = eff ? eff.grade : null;
                        return (
                          <tr key={result.id} className="hover:bg-gray-50/80 transition-colors group cursor-pointer"
                            onClick={e => { if ((e.target as HTMLElement).closest('.no-click')) return; handleViewReportCard(result as any); }}>
                            {/* Student */}
                            <td className="sticky left-0 z-30 bg-white group-hover:bg-gray-50 py-4 px-4 border-b border-r border-gray-100 text-left shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                              <div className="flex flex-col">
                                <span className="font-bold text-[#274c77] text-sm">{result.student.name}</span>
                                <span className="text-[10px] text-gray-400 font-mono">{result.student.student_code}</span>
                                <span className="text-[10px] text-gray-400">{(result.student as any).class_name || ''}</span>
                              </div>
                            </td>
                            {/* Checkbox */}
                            <td className="border-b border-r py-4 px-3 no-click">
                              {['approved','rejected','pending_principal'].includes(result.status) ? (
                                <CheckCircle className="h-4 w-4 text-emerald-400 opacity-40 mx-auto" />
                              ) : (
                                <input type="checkbox"
                                  checked={selectedResults.includes(result.id)}
                                  onChange={() => handleSelectResult(result.id)}
                                  onClick={e => e.stopPropagation()}
                                  className="h-4 w-4 rounded border-gray-300 text-[#274c77] focus:ring-[#274c77] mx-auto block"
                                />
                              )}
                            </td>
                            {/* Subject marks */}
                            {allSubjects.map(subject => {
                              const mark = result.subject_marks?.find((sm: any) => sm.subject_name === subject);
                              const total = mark ? Number(mark.total_marks) + (Number(mark.practical_total) || 0) : null;
                              // Overlay an approved retest mark on this subject if there is one.
                              const rtMark = eff?.retestBySubject?.[subject];
                              const usedRetest = rtMark !== undefined;
                              const baseObtained = mark ? Number(mark.obtained_marks) + (Number(mark.practical_obtained) || 0) : null;
                              const obtained = usedRetest ? rtMark : baseObtained;
                              const passed = usedRetest
                                ? ((rtMark / (Number(mark?.total_marks) || 25)) * 100 >= 40)
                                : mark?.is_pass;
                              return (
                                <td key={subject} className="border-b border-r py-4 px-3">
                                  {!mark ? <span className="text-gray-300 text-xs">—</span> : (mark.is_absent && !usedRetest) ? (
                                    <div className="flex flex-col items-center"><span className="text-amber-500 font-black text-xs">ABS</span><span className="text-[10px] text-gray-300">/{total}</span></div>
                                  ) : (
                                    <div className="flex flex-col items-center">
                                      <span className={cn('font-bold text-sm', usedRetest ? 'text-emerald-600' : passed ? 'text-gray-800' : 'text-rose-600')}>
                                        {obtained}{usedRetest && <span className="text-[9px] font-normal ml-0.5">RT</span>}
                                      </span>
                                      <span className="text-[10px] text-gray-400">/{total}</span>
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                            {/* Total */}
                            <td className="border-b border-r py-4 px-4 font-bold text-[#274c77]">
                              {isAbsent ? <span className="text-amber-500 text-sm">ABS</span> : (
                                <>{effObtained}{eff?.hasRetest && <span className="text-[9px] text-emerald-600 font-normal ml-0.5">RT</span>}</>
                              )}
                              <span className="text-gray-400 text-xs block font-normal">/{result.total_marks}</span>
                            </td>
                            {/* % */}
                            <td className="border-b border-r py-4 px-4 bg-[#f0f7ff]/30">
                              <span className={cn('font-bold text-sm', isAbsent ? 'text-gray-400' : (eff ? eff.isPassing : effPct >= 50) ? 'text-[#274c77]' : 'text-rose-600')}>
                                {isAbsent ? 'N/A' : (eff && !eff.isPassing) ? 'N/A' : `${effPct.toFixed(1)}%`}
                              </span>
                            </td>
                            {/* Grade */}
                            <td className="border-b border-r py-4 px-4">
                              {isAbsent ? (
                                <span className="text-gray-400 text-xs">N/A</span>
                              ) : (eff && !eff.isPassing) ? (
                                <span className="px-2 py-1 rounded-lg text-xs font-black bg-rose-50 text-rose-700">Fail</span>
                              ) : (
                                <span className={cn('px-2 py-1 rounded-lg text-xs font-black',
                                  effPct >= 80 ? 'bg-emerald-50 text-emerald-700' :
                                  effPct >= 70 ? 'bg-blue-50 text-blue-700' :
                                  effPct >= 60 ? 'bg-yellow-50 text-yellow-700' :
                                  effPct >= 50 ? 'bg-orange-50 text-orange-700' :
                                  effPct >= 40 ? 'bg-red-50 text-red-700' :
                                  'bg-gray-50 text-gray-700'
                                )}>
                                  {effGrade || (effPct >= 80 ? 'A+' : effPct >= 70 ? 'A' : effPct >= 60 ? 'B' : effPct >= 50 ? 'C' : effPct >= 40 ? 'D' : 'F')}
                                </span>
                              )}
                            </td>
                            {/* Rank */}
                            <td className="border-b border-r py-4 px-4">
                              {isAllCompleted && result.result_status === 'pass' && rankIdx >= 0 && rankIdx < 5 ? (
                                <Badge className={cn('shadow-sm font-bold border', rankColors[rankIdx])}>{rankLabels[rankIdx]}</Badge>
                              ) : (
                                <span className="text-gray-400 text-xs font-bold">N/A</span>
                              )}
                            </td>
                            {/* Result */}
                            <td className="border-b border-r py-4 px-4">
                              {isAbsent ? (
                                <Badge className="bg-amber-100 text-amber-800 border-amber-200"><Clock className="h-3 w-3 mr-1"/>ABSENT</Badge>
                              ) : result.result_status === 'pass' ? (
                                <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle className="h-3 w-3 mr-1"/>PASS</Badge>
                              ) : (
                                <Badge className="bg-red-100 text-red-800 border-red-200"><XCircle className="h-3 w-3 mr-1"/>FAIL</Badge>
                              )}
                            </td>
                            {/* Status */}
                            <td className="border-b border-r py-4 px-4">
                              <Badge className={cn('shadow-none border-none', getStatusColor(result.status))}>
                                {result.status.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
                              </Badge>
                            </td>
                            {/* Actions */}
                            <td className="border-b py-4 px-4 no-click">
                              <div className="flex items-center justify-center gap-1">
                                {(['pending','submitted','pending_coordinator'].includes(result.status)) && (
                                  <>
                                    <button onClick={() => handleApprove(result.id)} title="Approve"
                                      className="h-9 w-9 rounded-lg border border-gray-200 bg-white text-green-600 hover:bg-green-50 hover:border-green-300 flex items-center justify-center transition-all shadow-sm">
                                      <CheckCircle className="h-4 w-4" />
                                    </button>
                                    <button onClick={() => handleReject(result.id)} title="Reject"
                                      className="h-9 w-9 rounded-lg border border-gray-200 bg-white text-red-500 hover:bg-red-50 hover:border-red-300 flex items-center justify-center transition-all shadow-sm">
                                      <XCircle className="h-4 w-4" />
                                    </button>
                                  </>
                                )}
                                <button onClick={() => handleViewReportCard(result as any)} title="View Report Card"
                                  className="h-9 w-9 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-[#6096ba] hover:text-white hover:border-[#6096ba] flex items-center justify-center transition-all shadow-sm">
                                  <Eye className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>}
      {/* View Modal - Student Report Card */}
      {
        showViewModal && selectedResultView && (
          <div id="report-card-print-root" className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200 overflow-y-auto print:p-0 print:overflow-visible print:block print:relative print:z-0 print:!bg-white print:inset-auto print:backdrop-filter-none">
            <Card className="w-full max-w-[215mm] max-h-[95vh] overflow-hidden flex flex-col shadow-2xl border-0 rounded-2xl print:shadow-none print:max-w-full print:max-h-full print:overflow-visible print:rounded-none">
              {/* Modal Header */}
              <div className="bg-white px-8 py-5 border-b flex justify-between items-center sticky top-0 z-10 print:hidden shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2 rounded-xl">
                    <FileText className="h-6 w-6 text-[#274c77]" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[#274c77] leading-none">Student Report Card</h2>
                    <p className="text-slate-400 text-xs mt-1.5 uppercase tracking-widest font-black">Academic Review Portal</p>
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
                      activeMonth={activeTab === 'monthly_test' ? activeMonthTab : undefined}
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

                  {(['pending', 'submitted', 'pending_coordinator'].includes(selectedResultView.status)) && (
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

      {/* Bulk Action Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <Card className="w-full max-w-md shadow-2xl border-0 animate-in zoom-in-95 duration-200">
            <CardHeader>
              <CardTitle>Bulk Action</CardTitle>
              <CardDescription>Process {selectedResults.length} selected results</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button variant={bulkAction === 'approve' ? 'default' : 'outline'} onClick={() => setBulkAction('approve')} className={cn('flex-1', bulkAction === 'approve' && 'bg-green-600 hover:bg-green-700')}>
                  <CheckCircle className="h-4 w-4 mr-2" /> Approve
                </Button>
                <Button variant={bulkAction === 'reject' ? 'destructive' : 'outline'} onClick={() => setBulkAction('reject')} className="flex-1">
                  <XCircle className="h-4 w-4 mr-2" /> Reject
                </Button>
              </div>
            </CardContent>
            <CardContent className="pt-0 flex gap-2">
              <Button variant="ghost" onClick={() => setShowBulkModal(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleBulkAction} disabled={processing}
                className={cn('flex-1 text-white', bulkAction === 'approve' ? 'bg-[#6096ba] hover:bg-[#274c77]' : 'bg-red-600 hover:bg-red-700')}>
                {processing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{bulkAction === 'approve' ? 'Approving...' : 'Rejecting...'}</> : bulkAction === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
      {/* Signature Modal */}
      <ApproveWithSignature
        isOpen={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        onConfirm={isBulkApprove ? confirmBulkApprove : confirmApprove}
        title={isBulkApprove ? `Bulk Approve ${selectedResults.length} Results` : "Approve Result Card"}
        description={isBulkApprove ? "Providing your signature will approve all selected results." : "Please sign to confirm your approval of this student's result."}
        savedSignature={(coordinatorProfile as any)?.signature || null}
      />
    </div>
  )
}