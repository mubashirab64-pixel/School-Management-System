"use client";

import { useState, useEffect } from "react";
import { 
  TrendingUp, Download, Filter, Search, FileText, User, 
  Calendar, Building2, GraduationCap, ArrowUpDown, ChevronRight,
  TrendingDown, CheckCircle2, AlertCircle, Clock, Loader2, DollarSign
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { feeService } from "@/services/feeService";
import { FeeTabs } from "../components/FeeTabs";
import { toast } from "sonner";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Cell, PieChart as RechartsPie, Pie 
} from 'recharts';

export default function ReportsPage() {
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [campuses, setCampuses] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);

  // Filter State
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [campusId, setCampusId] = useState("all");
  const [gradeId, setGradeId] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: any = { month, year };
      if (campusId !== "all") params.campus_id = campusId;
      if (gradeId !== "all") params.grade_id = gradeId;

      const [data, cData] = await Promise.all([
        feeService.getCollectionReport(params),
        feeService.getCampuses()
      ]);
      setReportData(data);
      setCampuses(cData);
    } catch (e) {
      toast.error("Failed to fetch report data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [month, year, campusId, gradeId]);

  useEffect(() => {
    if (campusId !== "all") {
        feeService.getGradesByCampus(campusId).then(setGrades);
    } else {
        setGrades([]);
    }
  }, [campusId]);

  const studentList = (reportData?.student_wise_list || []).filter((s: any) => 
    s.student_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.student_code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pieData = [
    { name: 'Collected', value: reportData?.collected || 0, color: '#10b981' },
    { name: 'Pending', value: reportData?.pending || 0, color: '#f43f5e' }
  ];

  const handleDownloadDefaulterList = () => {
    const defaulters = studentList.filter((s: any) => s.status === 'unpaid');
    if (defaulters.length === 0) {
      toast.error("No defaulters found to download.");
      return;
    }
    
    let content = `DEFAULTER RISK LIST\n`;
    content += `Period: ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][month-1]} ${year}\n`;
    content += `Generated on: ${new Date().toLocaleString()}\n`;
    content += `-------------------------------------------------\n\n`;

    defaulters.forEach((s: any, idx: number) => {
      content += `${idx + 1}. ${s.student_name}\n`;
      content += `   Student ID : ${s.student_code}\n`;
      content += `   Pending Due: Rs ${s.pending.toLocaleString()}\n`;
      content += `   Status     : UNPAID\n\n`;
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `defaulters_list_${month}_${year}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Defaulter list downloaded successfully.");
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div>
        <h2 className="text-3xl font-extrabold text-[#274c77] mb-2 tracking-wide flex items-center gap-3">
          <TrendingUp className="h-8 w-8 text-[#6096ba]" />
          Financial Intelligence
        </h2>
        <p className="text-gray-600 text-lg">Analyze collection efficiency, monitor defaults, and export multi-dimensional reports.</p>
      </div>

      <FeeTabs active="reports" />

      {/* Filters */}
      <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-1.5">
                <Label className="text-xs font-black text-gray-400 uppercase">Month</Label>
                <Select value={month.toString()} onValueChange={v => setMonth(parseInt(v))}>
                    <SelectTrigger className="rounded-xl border-gray-100 bg-gray-50/50 h-10">
                        <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                        {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m, i) => (
                            <SelectItem key={i+1} value={(i+1).toString()}>{m}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-1.5">
                <Label className="text-xs font-black text-gray-400 uppercase">Year</Label>
                <Input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} className="rounded-xl border-gray-100 bg-gray-50/50 h-10" />
            </div>
            <div className="space-y-1.5">
                <Label className="text-xs font-black text-gray-400 uppercase">Campus</Label>
                <Select value={campusId} onValueChange={setCampusId}>
                    <SelectTrigger className="rounded-xl border-gray-100 bg-gray-50/50 h-10">
                        <SelectValue placeholder="All Campuses" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Campuses</SelectItem>
                        {campuses.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.campus_name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-1.5">
                <Label className="text-xs font-black text-gray-400 uppercase">Grade</Label>
                <Select value={gradeId} onValueChange={setGradeId} disabled={campusId === 'all'}>
                    <SelectTrigger className="rounded-xl border-gray-100 bg-gray-50/50 h-10">
                        <SelectValue placeholder="All Grades" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Grades</SelectItem>
                        {grades.map(g => <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex items-end">
                <Button variant="outline" className="w-full rounded-xl border-blue-200 text-[#274c77] font-bold h-10 hover:bg-blue-50" onClick={() => toast.info("Compiling CSV report...")}>
                    <Download className="w-4 h-4 mr-2" /> Export Report
                </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top KPIs Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border border-border shadow-sm bg-card p-6 relative overflow-hidden group items-center flex justify-between">
            <div>
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" /> Total Collected
                </p>
                <h3 className="text-4xl font-extrabold text-primary pt-1">Rs {reportData?.collected?.toLocaleString() || '0'}</h3>
            </div>
            <div className="bg-primary/5 px-4 py-3 rounded-xl border border-primary/10 text-center shrink-0 min-w-24">
                <span className="block text-[10px] font-bold uppercase text-primary/70 mb-0.5">Effective Yield</span>
                <span className="text-lg font-black text-primary drop-shadow-sm">
                    {reportData?.total_expected > 0 ? ((reportData.collected / reportData.total_expected) * 100).toFixed(1) : 0}%
                </span>
            </div>
        </Card>

        <Card className="border border-border shadow-sm bg-card p-6 relative overflow-hidden group items-center flex justify-between">
            <div>
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-destructive" /> Outstanding Balance
                </p>
                <h3 className="text-4xl font-extrabold text-destructive pt-1">Rs {reportData?.pending?.toLocaleString() || '0'}</h3>
            </div>
            <div className="bg-destructive/5 px-4 py-3 rounded-xl border border-destructive/10 text-center shrink-0 min-w-24">
                <span className="block text-[10px] font-bold uppercase text-destructive/70 mb-0.5">Goal</span>
                <span className="text-lg font-black text-destructive drop-shadow-sm">Rs 0</span>
            </div>
        </Card>
      </div>

      {/* Main Content Split */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* Left: Main Table */}
        <Card className="xl:col-span-8 border-none shadow-xl bg-white h-[850px] flex flex-col overflow-hidden">
            <CardHeader className="bg-slate-50/50 py-5 px-6 border-b shrink-0">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-lg font-black text-[#274c77]">Student-wise Receivables</CardTitle>
                        <CardDescription className="text-xs">Individual breakdown for the selected filters.</CardDescription>
                    </div>
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                        <Input 
                            placeholder="Find by Name/Code..." 
                            className="pl-9 rounded-xl border-gray-100 bg-white h-9 text-xs" 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0 overflow-auto flex-1">
                <Table className="relative">
                    <TableHeader className="bg-gray-50/80 sticky top-0 z-10 backdrop-blur-sm shadow-sm">
                        <TableRow>
                            <TableHead className="font-bold text-xs uppercase tracking-wider px-6">Student</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-wider px-6">Total Fee</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-wider px-6">Received</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-wider px-6 text-rose-600">Balance</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-wider px-6">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" /></TableCell></TableRow>
                        ) : studentList.map((s: any) => (
                            <TableRow key={s.student_id} className="hover:bg-slate-50/50 transition-colors">
                                <TableCell className="px-6 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 font-black text-xs">{s.student_name[0]}</div>
                                        <div>
                                            <p className="font-bold text-gray-800 text-xs">{s.student_name}</p>
                                            <p className="text-[10px] font-bold text-gray-400">ID: {s.student_code}</p>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="px-6 font-bold text-gray-700 text-xs">Rs {s.total.toLocaleString()}</TableCell>
                                <TableCell className="px-6 font-bold text-emerald-600 text-xs">Rs {s.paid.toLocaleString()}</TableCell>
                                <TableCell className="px-6 font-black text-rose-600 text-xs">Rs {s.pending.toLocaleString()}</TableCell>
                                <TableCell className="px-6">
                                    <Badge className={`rounded-md px-2 py-0 text-[9px] font-black uppercase tracking-widest ${
                                        s.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                                        s.status === 'partial' ? 'bg-amber-100 text-amber-700' :
                                        'bg-rose-100 text-rose-700'
                                    }`}>
                                        {s.status}
                                    </Badge>
                                </TableCell>
                            </TableRow>
                        ))}
                        {studentList.length === 0 && !loading && (
                            <TableRow><TableCell colSpan={5} className="text-center py-20 text-gray-400">No receivable records match your filters.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>

        {/* Right: Auxiliary Data */}
        <div className="xl:col-span-4 flex flex-col gap-6">
            <Card className="border-none shadow-xl bg-white p-6 flex flex-col items-center justify-center">
                <h3 className="text-sm font-black text-[#274c77] self-start w-full mb-2">Collection Ratio</h3>
                <div className="w-full h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <RechartsPie>
                            <Pie 
                                data={pieData} 
                                innerRadius={60} 
                                outerRadius={80} 
                                paddingAngle={5} 
                                dataKey="value"
                            >
                                {pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </RechartsPie>
                    </ResponsiveContainer>
                </div>
                <div className="flex gap-4 mt-2">
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"/> <span className="text-[10px] font-bold text-gray-400">Paid</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-rose-500"/> <span className="text-[10px] font-bold text-gray-400">Arrears</span></div>
                </div>
            </Card>

            <Card className="border-none shadow-xl bg-amber-50 relative overflow-hidden flex-1 flex flex-col">
                <div className="absolute -left-4 -top-4 opacity-5 rotate-12"><AlertCircle className="w-24 h-24" /></div>
                <CardHeader className="py-4 px-5 border-b border-amber-100 shrink-0">
                    <CardTitle className="text-amber-800 flex items-center gap-2 text-sm">Defaulter Risk Alert</CardTitle>
                    <CardDescription className="text-amber-600 text-xs">Students missing the 10th of {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][month-1]} deadline.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 flex-1 overflow-auto">
                    <div className="space-y-2">
                    {studentList.filter((s: any) => s.status === 'unpaid').slice(0, 3).map((s: any) => (
                        <div key={s.student_id} className="flex items-center justify-between p-2.5 bg-white border border-amber-100 rounded-lg">
                            <div className="flex items-center gap-2.5">
                                <Clock className="w-4 h-4 text-amber-500" />
                                <span className="text-xs font-bold text-gray-700">{s.student_name}</span>
                            </div>
                            <span className="text-[10px] font-black text-amber-600">Rs {s.pending.toLocaleString()}</span>
                        </div>
                    ))}
                    {studentList.filter((s: any) => s.status === 'unpaid').length === 0 && (
                        <p className="text-xs text-amber-600/60 p-2 text-center italic">No defaulters for this period.</p>
                    )}
                    <Button variant="link" className="text-amber-700 font-bold text-[10px] p-0 h-auto mt-2">View All ({studentList.filter((s:any) => s.status === 'unpaid').length})</Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none shadow-xl bg-blue-50 relative overflow-hidden shrink-0">
                <div className="absolute -right-4 -top-4 opacity-5 -rotate-12"><FileText className="w-24 h-24" /></div>
                <CardHeader className="py-4 px-5">
                    <CardTitle className="text-blue-800 flex items-center gap-2 text-sm">Bulk Actions</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0 flex gap-3">
                    <Button className="flex-1 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold gap-2 text-xs h-9">
                        <FileText className="w-3.5 h-3.5" /> Reminders
                    </Button>
                    <Button 
                        variant="outline" 
                        className="flex-1 border-blue-200 text-blue-700 rounded-lg font-bold text-xs h-9"
                        onClick={handleDownloadDefaulterList}
                    >
                        Download List
                    </Button>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}

function Label({ children, className }: { children: any, className?: string }) {
    return <label className={`block mb-1 text-sm ${className}`}>{children}</label>
}
