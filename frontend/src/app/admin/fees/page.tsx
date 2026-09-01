"use client";

import { useState, useEffect } from "react";
import {
  Banknote, Receipt, CheckCircle2, TrendingUp, Calendar, Loader2,
  ArrowUpRight, Users, LayoutDashboard, Clock, DollarSign, Wallet,
  Building2, ShieldCheck, Search, Activity, History, ArrowRight, Download
} from "lucide-react";
import { getPendingPayments, getRecentTransactions, PaymentTransaction } from "@/lib/bankApi";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { feeService } from "@/services/feeService";
import { Input } from "@/components/ui/input";
import { FeeTabs } from "./components/FeeTabs";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import { usePermissions } from "@/lib/permissions";
import { AccessDenied } from "@/components/AccessDenied";
import Link from "next/link";

export default function FeesDashboard() {
  const { canManageFees } = usePermissions();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRestricted, setIsRestricted] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [recentActivity, setRecentActivity] = useState<PaymentTransaction[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [dateRange, setDateRange] = useState({ 
    from: { month: new Date().getMonth() + 1, year: new Date().getFullYear() },
    to: { month: new Date().getMonth() + 1, year: new Date().getFullYear() }
  });
  const [tempRange, setTempRange] = useState({ ...dateRange });

  useEffect(() => {
    if (!canManageFees) return;

    const fetchStats = async () => {
      setLoading(true);
      try {
        const [statsData, pendingResult, recentResult] = await Promise.all([
          feeService.getCollectionReport({
            month_from: dateRange.from.month,
            year_from: dateRange.from.year,
            month_to: dateRange.to.month,
            year_to: dateRange.to.year
          }),
          getPendingPayments().catch(() => [] as any[]),
          getRecentTransactions(8).catch(() => [] as any[])
        ]);
        setStats(statsData);
        setPendingCount(pendingResult.length);
        setRecentActivity(recentResult);
        setIsRestricted(false);
      } catch (e: any) {
        console.error(e);
        if (e.status === 403 || e.message?.includes('permission')) {
          setIsRestricted(true);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [dateRange, canManageFees]);

  // Handle Quick Search
  useEffect(() => {
    if (searchQuery.length < 3) {
      setSearchResults([]);
      return;
    }
    const delay = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await feeService.searchStudents({ q: searchQuery });
        setSearchResults(results.slice(0, 5));
      } catch (e) {
        console.error(e);
      } finally {
        setIsSearching(false);
      }
    }, 500);
    return () => clearTimeout(delay);
  }, [searchQuery]);

  if (!canManageFees || isRestricted) {
    return (
      <AccessDenied 
        title="Finance Access Restricted" 
        message="You do not have the required permissions to view the financial dashboard. Please contact your administrator for access."
      />
    );
  }

  const chartData = stats?.trend_data || [
    { name: 'Jan', collected: 0, expected: 0 },
    { name: 'Feb', collected: 0, expected: 0 },
    { name: 'Mar', collected: 0, expected: 0 },
    { name: 'Apr', collected: 0, expected: 0 },
    { name: 'May', collected: 0, expected: 0 },
    { name: 'Jun', collected: 0, expected: 0 },
  ];

  const exportToCSV = () => {
    if (!chartData || chartData.length === 0) return;
    const headers = ["Month,Expected Amount,Collected Amount"];
    const rows = chartData.map((row: any) => `${row.name},${row.expected || 0},${row.collected || 0}`);
    const csvContent = "data:text/csv;charset=utf-8," + headers.concat(rows).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `revenue_trend_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-3xl font-extrabold text-[#274c77] mb-2 tracking-wide flex items-center gap-3">
            <LayoutDashboard className="h-8 w-8 text-[#6096ba]" />
            Financial Dashboard
          </h2>
          <p className="text-gray-600 text-lg">Real-time overview of school revenue and fee collection performance.</p>
        </div>

        <div className="flex flex-col md:flex-row items-end gap-4 w-full md:w-auto shrink-0 animate-in slide-in-from-right-4 duration-500">
           <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap md:flex-nowrap items-center gap-6">
              <div className="flex flex-col gap-2">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">From Period</label>
                 <div className="flex gap-2">
                    <select 
                       value={tempRange.from.month}
                       onChange={e => setTempRange(prev => ({ ...prev, from: { ...prev.from, month: parseInt(e.target.value) } }))}
                       className="h-10 rounded-xl border-2 border-gray-50 bg-gray-50 px-3 py-1 text-sm font-bold text-[#274c77] focus:ring-2 focus:ring-[#6096ba] focus:bg-white outline-none transition-all"
                    >
                       {Array.from({ length: 12 }, (_, i) => (
                          <option key={i+1} value={i+1}>{new Date(2000, i).toLocaleString('default', { month: 'short' })}</option>
                       ))}
                    </select>
                    <select 
                       value={tempRange.from.year}
                       onChange={e => setTempRange(prev => ({ ...prev, from: { ...prev.from, year: parseInt(e.target.value) } }))}
                       className="h-10 rounded-xl border-2 border-gray-50 bg-gray-50 px-3 py-1 text-sm font-bold text-[#274c77] focus:ring-2 focus:ring-[#6096ba] focus:bg-white outline-none transition-all"
                    >
                       {Array.from({ length: 10 }, (_, i) => {
                          const y = new Date().getFullYear() - 5 + i;
                          return <option key={y} value={y}>{y}</option>
                       })}
                    </select>
                 </div>
              </div>

              <div className="h-10 w-px bg-gray-100 self-end mb-1 md:block hidden" />

              <div className="flex flex-col gap-2">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">To Period</label>
                 <div className="flex gap-2">
                    <select 
                       value={tempRange.to.month}
                       onChange={e => setTempRange(prev => ({ ...prev, to: { ...prev.to, month: parseInt(e.target.value) } }))}
                       className="h-10 rounded-xl border-2 border-gray-50 bg-gray-50 px-3 py-1 text-sm font-bold text-[#274c77] focus:ring-2 focus:ring-[#6096ba] focus:bg-white outline-none transition-all"
                    >
                       {Array.from({ length: 12 }, (_, i) => (
                          <option key={i+1} value={i+1}>{new Date(2000, i).toLocaleString('default', { month: 'short' })}</option>
                       ))}
                    </select>
                    <select 
                       value={tempRange.to.year}
                       onChange={e => setTempRange(prev => ({ ...prev, to: { ...prev.to, year: parseInt(e.target.value) } }))}
                       className="h-10 rounded-xl border-2 border-gray-50 bg-gray-50 px-3 py-1 text-sm font-bold text-[#274c77] focus:ring-2 focus:ring-[#6096ba] focus:bg-white outline-none transition-all"
                    >
                       {Array.from({ length: 10 }, (_, i) => {
                          const y = new Date().getFullYear() - 5 + i;
                          return <option key={y} value={y}>{y}</option>
                       })}
                    </select>
                 </div>
              </div>
              
              <Button 
                onClick={() => setDateRange({ ...tempRange })}
                className="bg-[#274c77] hover:bg-[#1e3a5f] text-white font-bold rounded-xl h-10 px-6 self-end mb-0.5 shadow-md hover:shadow-lg transition-all flex items-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                Apply Filter
              </Button>
           </div>
        </div>
      </div>

      <FeeTabs active="overview" />

      {/* Primary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-none shadow-xl bg-gradient-to-br from-[#274c77] to-[#1e3a5f] text-white overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
             <TrendingUp className="w-20 h-20" />
          </div>
          <CardContent className="p-6 relative z-10">
            <p className="text-xs font-black text-blue-200 uppercase tracking-widest mb-1">Total Fee (Billed)</p>
            <h3 className="text-3xl font-black">Rs {stats?.total_expected?.toLocaleString() || '0'}</h3>
            <div className="mt-4 flex items-center gap-1 text-[10px] font-bold text-blue-200 bg-white/10 w-fit px-2 py-1 rounded-full">
               <ArrowUpRight className="w-3 h-3" /> +12% from last month
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-white border-l-4 border-l-emerald-500 overflow-hidden group">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
               <div>
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Fee Received</p>
                  <h3 className="text-3xl font-black text-emerald-600">Rs {stats?.collected?.toLocaleString() || '0'}</h3>
                  <p className="text-[10px] text-gray-400 font-bold mt-2">Efficiency: <span className="text-emerald-500">{stats?.total_expected > 0 ? ((stats.collected / stats.total_expected) * 100).toFixed(1) : 0}%</span></p>
               </div>
               <div className="p-3 bg-emerald-50 rounded-2xl group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 group-hover:text-white" />
               </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-white border-l-4 border-l-rose-500 overflow-hidden group">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
               <div>
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Remaining Balance</p>
                  <h3 className="text-3xl font-black text-rose-600">Rs {stats?.pending?.toLocaleString() || '0'}</h3>
                  <p className="text-[10px] text-gray-400 font-bold mt-2">Recovery Needed: <span className="text-rose-500">{stats?.total_expected > 0 ? ((stats.pending / stats.total_expected) * 100).toFixed(1) : 0}%</span></p>
               </div>
               <div className="p-3 bg-rose-50 rounded-2xl group-hover:bg-rose-500 group-hover:text-white transition-colors">
                  <TrendingUp className="w-6 h-6 text-rose-500 group-hover:text-white" />
               </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-white border-l-4 border-l-amber-500 overflow-hidden group">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
               <div>
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Collection Rate</p>
                  <h3 className="text-3xl font-black text-amber-600">{stats?.total_expected > 0 ? ((stats.collected / stats.total_expected) * 100).toFixed(0) : 0}%</h3>
                  <p className="text-[10px] text-gray-400 font-bold mt-2">Target: <span className="text-amber-500">100%</span></p>
               </div>
               <div className="p-3 bg-amber-50 rounded-2xl group-hover:bg-amber-500 group-hover:text-white transition-colors">
                  <Users className="w-6 h-6 text-amber-500 group-hover:text-white" />
               </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 1: Chart + Quick Search & Quick Access */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <Card className="lg:col-span-8 border-none shadow-xl bg-white p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
             <div>
                <CardTitle className="text-[#274c77]">Revenue Trend</CardTitle>
                <CardDescription>Monthly comparison of expected vs collected fees of last 6 months and forward 6 months.</CardDescription>
             </div>
             <div className="flex items-center gap-6">
                <div className="flex gap-4">
                   <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#274c77]" />
                      <span className="text-xs font-bold text-gray-500">Expected</span>
                   </div>
                   <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-400" />
                      <span className="text-xs font-bold text-gray-500">Collected</span>
                   </div>
                </div>
                <Button 
                   onClick={exportToCSV}
                   variant="outline" 
                   size="sm" 
                   className="h-8 text-xs font-bold text-[#274c77] border-gray-200 hover:bg-gray-50 flex items-center gap-2"
                >
                   <Download className="w-3 h-3" />
                   Export CSV
                </Button>
             </div>
          </div>
          <div className="flex-1 w-full min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorExpected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#274c77" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#274c77" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 11, fontWeight: 'bold', fill: '#999'}} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fontWeight: 'bold', fill: '#999'}} width={45} />
                <Tooltip
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Area type="monotone" dataKey="expected" stroke="#274c77" strokeWidth={2} fillOpacity={1} fill="url(#colorExpected)" />
                <Area type="monotone" dataKey="collected" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorCollected)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="lg:col-span-4 flex flex-col gap-6">
           {/* Quick Search Card */}
           <Card className="border-none shadow-xl bg-white overflow-hidden">
              <CardHeader className="bg-[#274c77] text-white p-4">
                 <CardTitle className="text-sm flex items-center gap-2">
                    <Search className="w-4 h-4" /> Quick Payment Search
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                 <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Student Name or ID..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-10 h-10 rounded-xl"
                    />
                    {isSearching && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-gray-400" />}
                 </div>

                 {searchResults.length > 0 && (
                   <div className="space-y-2 animate-in slide-in-from-top-2">
                     {searchResults.map(s => (
                       <Link
                        key={s.id}
                        href={`/admin/fees/students?search=${s.student_code || s.name}`}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all group"
                       >
                         <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black group-hover:bg-[#274c77] group-hover:text-white">
                               {s.name?.charAt(0)}
                            </div>
                            <div>
                               <p className="text-xs font-bold text-slate-700">{s.name}</p>
                               <p className="text-[9px] text-slate-400 uppercase">{s.student_code || s.gr_no}</p>
                            </div>
                         </div>
                         <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-[#274c77] group-hover:translate-x-1 transition-all" />
                       </Link>
                     ))}
                   </div>
                 )}
                 {searchQuery.length > 2 && searchResults.length === 0 && !isSearching && (
                   <div className="text-center py-4 text-[11px] text-slate-400 font-medium">No results found</div>
                 )}
              </CardContent>
           </Card>

           <Card className="border-none shadow-xl bg-white overflow-hidden">
              <CardHeader className="bg-indigo-50/50">
                 <CardTitle className="text-[#274c77] text-lg">Quick Access</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                 <Link href="/admin/fees/pending-payments" className="block p-3 border rounded-xl hover:bg-rose-50 transition-colors group relative overflow-hidden">
                    {pendingCount > 0 && (
                      <div className="absolute top-0 right-0 bg-rose-500 text-white text-[9px] font-black px-3 py-1 rounded-bl-lg shadow-sm animate-pulse">
                         {pendingCount} NEW
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className="p-2 bg-rose-100 rounded-lg text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-colors"><ShieldCheck className="w-4 h-4" /></div>
                          <span className="text-sm font-bold text-gray-700">Verify Payments</span>
                       </div>
                       <ArrowUpRight className="w-4 h-4 text-gray-300" />
                    </div>
                 </Link>
                 <Link href="/admin/fees/students" className="block p-3 border rounded-xl hover:bg-emerald-50 transition-colors group">
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors"><Wallet className="w-4 h-4" /></div>
                          <span className="text-sm font-bold text-gray-700">Record Payments</span>
                       </div>
                       <ArrowUpRight className="w-4 h-4 text-gray-300" />
                    </div>
                 </Link>
                 <Link href="/admin/fees/generate" className="block p-3 border rounded-xl hover:bg-blue-50 transition-colors group">
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors"><Calendar className="w-4 h-4" /></div>
                          <span className="text-sm font-bold text-gray-700">Generate Batch Fees</span>
                       </div>
                       <ArrowUpRight className="w-4 h-4 text-gray-300" />
                    </div>
                 </Link>
                 <Link href="/admin/fees/bank-accounts" className="block p-3 border rounded-xl hover:bg-violet-50 transition-colors group">
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className="p-2 bg-violet-100 rounded-lg text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition-colors"><Building2 className="w-4 h-4" /></div>
                          <span className="text-sm font-bold text-gray-700">Bank Accounts</span>
                       </div>
                       <ArrowUpRight className="w-4 h-4 text-gray-300" />
                    </div>
                 </Link>
              </CardContent>
           </Card>
        </div>
      </div>

      {/* Row 2: Recent Activity + Late Fee card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Activity Feed */}
        <Card className="border-none shadow-xl bg-white overflow-hidden">
           <CardHeader className="p-4 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                 <Activity className="w-4 h-4 text-slate-400" /> Recent Activity
              </CardTitle>
              <Link href="/admin/fees/pending-payments" className="text-[10px] font-bold text-[#274c77] hover:underline">View All</Link>
           </CardHeader>
           <CardContent className="p-0">
              <div className="divide-y max-h-[300px] overflow-y-auto no-scrollbar">
                 {recentActivity.length === 0 ? (
                   <div className="p-8 text-center text-slate-400 text-xs italic">No recent transactions</div>
                 ) : recentActivity.map((txn) => (
                   <div key={txn.id} className="p-3 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start justify-between">
                         <div className="flex gap-2">
                            <div className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                              txn.status === 'approved' ? 'bg-emerald-500' :
                              txn.status === 'rejected' ? 'bg-rose-500' : 'bg-amber-500 animate-pulse'
                            }`} />
                            <div className="space-y-1">
                               <p className="text-[11px] font-bold text-slate-700 leading-tight">{txn.student_name}</p>
                               <p className="text-[10px] text-slate-400 font-medium">Rs {parseFloat(txn.amount).toLocaleString()} — {txn.status.toUpperCase()}</p>
                            </div>
                         </div>
                         <span className="text-[9px] text-slate-300 font-bold uppercase shrink-0">
                            {new Date(txn.submitted_at).toLocaleDateString("en-GB", { day: '2-digit', month: 'short' })}
                         </span>
                      </div>
                   </div>
                 ))}
              </div>
           </CardContent>
        </Card>

        {/* Late Fee Deadline */}
        <Card className="border-none shadow-xl bg-[#274c77] text-white p-6 relative overflow-hidden">
           <div className="absolute -right-4 -bottom-4 opacity-10"><Clock className="w-32 h-32" /></div>
           <p className="text-xs font-black text-blue-200 uppercase tracking-widest mb-4">Upcoming Deadline</p>
           <h4 className="text-lg font-bold mb-2">Late Fee Applied In</h4>
           <div className="flex items-center gap-2">
              <div className="bg-white/10 px-3 py-2 rounded-xl text-2xl font-black">04</div>
              <span className="text-xs font-bold text-blue-200">DAYS</span>
           </div>
           <p className="text-[10px] text-blue-300 mt-4 leading-relaxed italic">The late fee engine is scheduled to run on the 10th of this month at 12:00 AM.</p>
        </Card>
      </div>
    </div>
  );
}
