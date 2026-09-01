"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Globe, Users, Building2, Activity, ShieldCheck, TrendingUp, BookOpen, ChevronRight, Zap } from "lucide-react"
import { KpiCard } from "./kpi-card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { useRouter } from "next/navigation"
import { useSystemMonitoring } from "@/hooks/useSystemMonitoring"
import { Button } from "../ui/button"

interface OrgStats {
    id: number
    name: string
    used_students: number
    max_students: number
    used_users: number
    is_active: boolean
}

export function SuperAdminDashboard() {
    const router = useRouter()
    const { stats: liveSystemStats, isConnected } = useSystemMonitoring()
    const [orgs, setOrgs] = useState<OrgStats[]>([])
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState({
        totalOrgs: 0,
        totalStudents: 0,
        totalUsers: 0,
        activeOrgs: 0
    })

    useEffect(() => {
        async function fetchGlobalStats() {
            try {
                const token = localStorage.getItem("sis_access_token")
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/organizations/`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
                const data = await res.json()
                const orgList = Array.isArray(data) ? data : (data.results || [])
                setOrgs(orgList)

                const totalStudents = orgList.reduce((acc: number, org: OrgStats) => acc + (org.used_students || 0), 0)
                const totalUsers = orgList.reduce((acc: number, org: OrgStats) => acc + (org.used_users || 0), 0)
                const activeOrgs = orgList.filter((org: OrgStats) => org.is_active).length

                setStats({
                    totalOrgs: orgList.length,
                    totalStudents,
                    totalUsers,
                    activeOrgs
                })
            } catch (err) {
                console.error("Failed to fetch superadmin stats:", err)
            } finally {
                setLoading(false)
            }
        }
        fetchGlobalStats()
    }, [])

    const systemHealth = () => {
        if (!isConnected) return { label: "Connecting...", color: "text-slate-400", bg: "bg-slate-400/20" }
        const allHealthy = liveSystemStats?.services && Object.values(liveSystemStats.services).every(s => s.status === 'Healthy')
        return allHealthy 
            ? { label: "Optimal", color: "text-emerald-600", bg: "bg-emerald-500/20" }
            : { label: "Degraded", color: "text-rose-600", bg: "bg-rose-500/20" }
    }

    if (loading) {
        return (
            <div className="p-6 space-y-6 animate-pulse">
                <div className="h-8 w-64 bg-gray-200 rounded mb-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-gray-100 rounded-xl" />)}
                </div>
                <div className="h-96 bg-gray-50 rounded-2xl" />
            </div>
        )
    }

    const chartData = orgs.map(org => ({
        name: org.name,
        students: org.used_students,
        users: org.used_users
    })).sort((a, b) => b.students - a.students).slice(0, 10)

    const COLORS = ['#2a4e78', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe']
    const health = systemHealth()

    return (
        <div className="p-6 space-y-6 bg-slate-50/30 min-h-screen">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight">PLATFORM MANAGEMENT</h1>
                    <p className="text-sm text-gray-500 font-medium italic">Unified global observability for school distributed systems</p>
                </div>
                {isConnected && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-emerald-100 rounded-full shadow-sm">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">Real-Time Sync Active</span>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div onClick={() => router.push('/admin/organizations')} className="cursor-pointer group">
                    <KpiCard
                        title="Total Organizations"
                        value={stats.totalOrgs}
                        icon={Globe}
                        description={`${stats.activeOrgs} active organizations`}
                        textColor="text-blue-600"
                        className="group-hover:shadow-md transition-all"
                    />
                </div>
                <div className="cursor-default">
                    <KpiCard
                        title="Platform Students"
                        value={stats.totalStudents}
                        icon={Users}
                        description="Total students across all orgs"
                        textColor="text-emerald-600"
                    />
                </div>
                <div className="cursor-default">
                    <KpiCard
                        title="Platform Users"
                        value={stats.totalUsers}
                        icon={ShieldCheck}
                        description="Total staff and admins"
                        textColor="text-purple-600"
                    />
                </div>
                <div onClick={() => router.push('/admin/monitoring')} className="cursor-pointer group">
                    <KpiCard
                        title="System Health"
                        value={health.label}
                        icon={Activity}
                        description="Real-time service inspection"
                        textColor={health.color}
                        className="group-hover:shadow-md transition-all border-l-4 border-l-indigo-500"
                    />
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 border-none shadow-sm bg-white overflow-hidden rounded-3xl">
                    <CardHeader className="border-b border-gray-50 pb-4 px-8 py-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-50 rounded-xl">
                                    <TrendingUp className="w-5 h-5 text-indigo-600" />
                                </div>
                                <div>
                                    <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-widest">Enrollment Distribution</CardTitle>
                                    <CardDescription className="text-xs font-medium text-slate-400">Comparing top 10 organizations by students</CardDescription>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase text-slate-400 hover:text-indigo-600" onClick={() => router.push('/admin/organizations')}>
                                Manage All <ChevronRight className="w-3 h-3 ml-1" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-8 px-6">
                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis 
                                        dataKey="name" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8' }}
                                        interval={0}
                                        angle={-15}
                                        textAnchor="end"
                                    />
                                    <YAxis 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fontSize: 9, fontWeight: 900, fill: '#cbd5e1' }} 
                                    />
                                    <Tooltip 
                                        cursor={{ fill: '#f8fafc' }}
                                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}
                                    />
                                    <Bar dataKey="students" radius={[6, 6, 0, 0]} barSize={40}>
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-xl bg-gradient-to-br from-[#274c77] to-[#1e3a5a] text-white overflow-hidden rounded-3xl">
                    <CardHeader className="px-8 pt-8">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-md border border-white/10">
                                <ShieldCheck className="w-5 h-5 text-indigo-200" />
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-black text-indigo-200 uppercase tracking-widest opacity-80">Platform Load</span>
                                <span className="text-lg font-black text-white leading-none">{liveSystemStats?.cpu || 0}%</span>
                            </div>
                        </div>
                        <CardTitle className="text-xl font-black tracking-tight mt-2">PLATFORM INTEGRITY</CardTitle>
                        <CardDescription className="text-indigo-200/60 text-[10px] font-bold uppercase tracking-widest">Real-time infrastructure guard</CardDescription>
                    </CardHeader>
                    <CardContent className="px-8 space-y-4 pb-8">
                        <div className="space-y-3 mt-4">
                            {[
                                { title: "API Engine", status: liveSystemStats?.services?.backend?.status === 'Healthy' ? "ACTIVE" : "ISSUE", color: liveSystemStats?.services?.backend?.status === 'Healthy' ? "text-emerald-300 bg-emerald-500/20" : "text-rose-300 bg-rose-500/20", icon: <Zap className="w-3.5 h-3.5" /> },
                                { title: "Auth Service", status: liveSystemStats?.services?.auth?.status === 'Healthy' ? "NORMAL" : "DEGRADED", color: liveSystemStats?.services?.auth?.status === 'Healthy' ? "text-sky-300 bg-sky-500/20" : "text-rose-300 bg-rose-500/20", icon: <ShieldCheck className="w-3.5 h-3.5" /> },
                                { title: "Database Sync", status: liveSystemStats?.services?.database?.status === 'Healthy' ? "SYNCED" : "RETRY", color: liveSystemStats?.services?.database?.status === 'Healthy' ? "text-indigo-200 bg-indigo-500/20" : "text-amber-300 bg-amber-500/20", icon: <Activity className="w-3.5 h-3.5" /> },
                                { title: "Storage IO", status: liveSystemStats?.services?.storage?.status === 'Healthy' ? "READ/WRITE" : "READONLY", color: liveSystemStats?.services?.storage?.status === 'Healthy' ? "text-teal-300 bg-teal-500/20" : "text-rose-300 bg-rose-500/20", icon: <Globe className="w-3.5 h-3.5" /> },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-3.5 bg-white/5 rounded-2xl border border-white/5 group hover:bg-white/10 transition-colors">
                                    <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-tight">
                                        <div className="text-indigo-300">{item.icon}</div>
                                        {item.title}
                                    </div>
                                    <span className={`text-[9px] font-black uppercase tracking-[0.1em] px-2.5 py-1 rounded-full ${item.color}`}>
                                        {item.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className="pt-6 mt-8 border-t border-white/10">
                            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-indigo-200/60 mb-2">
                                <span>Compute Threads</span>
                                <span>{liveSystemStats?.cpu || 0}%</span>
                            </div>
                            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-gradient-to-r from-indigo-400 to-sky-400 transition-all duration-1000" 
                                    style={{ width: `${liveSystemStats?.cpu || 0}%` }} 
                                />
                            </div>
                        </div>
                        <Button 
                            className="w-full mt-6 bg-white text-indigo-900 border-none hover:bg-indigo-50 font-black uppercase text-[10px] tracking-[0.2em] py-6 rounded-2xl shadow-2xl"
                            onClick={() => router.push('/admin/monitoring')}
                        >
                            Open Command Center
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
