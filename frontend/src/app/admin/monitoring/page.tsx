"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Activity, Server, Database, Shield, Globe, Cpu, MoreVertical, TrendingUp, Zap, Clock, Activity as ActivityIcon, Box, Terminal, X, Trash2, Filter } from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts'

import { useSystemMonitoring } from "@/hooks/useSystemMonitoring"

export default function MonitoringPage() {
    const { stats, history, logs, isConnected } = useSystemMonitoring()
    const [selectedService, setSelectedService] = useState<string | null>(null)
    const [logFilter, setLogFilter] = useState<string>("")

    // Map stats to services
    const services = useMemo(() => stats ? [
        { id: 'frontend', name: "Frontend Server", ...stats.services.frontend, icon: <Server className="w-4 h-4 text-sky-500" /> },
        { id: 'backend', name: "Backend API", ...stats.services.backend, icon: <Globe className="w-4 h-4 text-indigo-500" /> },
        { id: 'database', name: "Database Cluster", ...stats.services.database, icon: <Database className="w-4 h-4 text-emerald-500" /> },
        { id: 'redis', name: "Redis Cache", ...stats.services.redis, icon: <Activity className="w-4 h-4 text-sky-600" /> },
        { id: 'storage', name: "File Storage", ...stats.services.storage, icon: <Cpu className="w-4 h-4 text-teal-500" /> },
    ] : [], [stats])

    const filteredLogs = useMemo(() => {
        let result = logs
        if (selectedService) {
            result = result.filter(log => log.service === selectedService)
        }
        if (logFilter) {
            result = result.filter(log => 
                log.path?.toLowerCase().includes(logFilter.toLowerCase()) ||
                log.method?.toLowerCase().includes(logFilter.toLowerCase())
            )
        }
        return result
    }, [logs, selectedService, logFilter])

    // Gauge Data
    const cpuGauge = [{ name: 'CPU', value: stats?.cpu || 0, fill: '#6366f1' }]
    const memGauge = [{ name: 'Memory', value: stats?.memory || 0, fill: '#0ea5e9' }]

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white border border-gray-100 p-3 rounded-xl shadow-xl">
                    <p className="text-[10px] text-gray-400 font-black mb-2 uppercase tracking-[0.2em]">{label}</p>
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center gap-2 mb-1">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-xs text-gray-500 font-bold tracking-tight">{entry.name}:</span>
                            <span className="text-xs text-gray-900 font-black">{entry.value}%</span>
                        </div>
                    ))}
                </div>
            )
        }
        return null
    }

    // KPI Summary Data
    const activeServices = services.filter(s => s.status === 'Healthy').length
    const totalServices = services.length
    const alertsCount = services.filter(s => s.status !== 'Healthy').length
    const systemUptime = stats?.services?.backend?.uptime || '...'
    
    const kpis = [
        { label: 'Active Services', value: activeServices, total: totalServices, color: 'text-emerald-600', icon: <Box className="w-4 h-4" /> },
        { label: 'API Latency', value: stats?.services?.backend?.latency || '...', color: 'text-sky-600', icon: <Clock className="w-4 h-4" /> },
        { label: 'Backend Uptime', value: systemUptime, color: 'text-indigo-600', icon: <ActivityIcon className="w-4 h-4" /> },
        { label: 'System Alerts', value: alertsCount, color: 'text-rose-600', icon: <Zap className="w-4 h-4" /> },
    ]

    return (
        <div className="p-6 space-y-6 bg-slate-50/50 min-h-screen text-gray-900">
            {/* Top KPI Summary Bar (Dynamic) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {kpis.map((kpi, i) => (
                    <Card key={i} className="bg-white border-none shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-all">
                        <CardContent className="p-5 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{kpi.label}</p>
                                <h4 className={`text-xl font-black ${kpi.color} tracking-tighter`}>
                                    {kpi.value}{kpi.total ? <span className="text-gray-300 text-sm ml-1 font-medium">/ {kpi.total}</span> : ''}
                                </h4>
                            </div>
                            <div className={`p-2.5 rounded-xl bg-slate-50 ${kpi.color} border border-slate-100 shadow-inner`}>
                                {kpi.icon}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Main Observability Dashboard (Light Mode) */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                {/* Left: Gauges Section */}
                <Card className="bg-white border-none shadow-sm rounded-3xl md:col-span-1">
                    <CardHeader className="pb-0 pt-6 px-7">
                        <CardTitle className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Real-Time Capacity</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4 h-[280px] items-center px-6">
                        <div className="h-full flex flex-col items-center justify-center relative">
                            <ResponsiveContainer width="100%" height={180}>
                                <RadialBarChart cx="50%" cy="50%" innerRadius="75%" outerRadius="110%" barSize={12} data={cpuGauge} startAngle={225} endAngle={-45}>
                                    <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                                    <RadialBar background={{ fill: '#f8fafc' }} dataKey="value" cornerRadius={6} />
                                </RadialBarChart>
                            </ResponsiveContainer>
                            <div className="absolute top-[50%] flex flex-col items-center">
                                <span className="text-3xl font-black text-slate-900 tracking-tighter">{Math.round(stats?.cpu || 0)}%</span>
                                <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">CPU LOAD</span>
                            </div>
                        </div>

                        <div className="h-full flex flex-col items-center justify-center relative">
                            <ResponsiveContainer width="100%" height={180}>
                                <RadialBarChart cx="50%" cy="50%" innerRadius="75%" outerRadius="110%" barSize={12} data={memGauge} startAngle={225} endAngle={-45}>
                                    <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                                    <RadialBar background={{ fill: '#f8fafc' }} dataKey="value" cornerRadius={6} />
                                </RadialBarChart>
                            </ResponsiveContainer>
                            <div className="absolute top-[50%] flex flex-col items-center">
                                <span className="text-3xl font-black text-slate-900 tracking-tighter">{Math.round(stats?.memory || 0)}%</span>
                                <span className="text-[9px] font-black text-sky-500 uppercase tracking-widest">RAM USAGE</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Right: Trend Chart Section */}
                <Card className="bg-white border-none shadow-sm rounded-3xl xl:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between border-b border-slate-50 mb-4 px-8 py-6">
                        <div>
                            <CardTitle className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Usage Over Time</CardTitle>
                            <CardDescription className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Live Performance Stream</CardDescription>
                        </div>
                        <div className="px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">Live Stream</span>
                        </div>
                    </CardHeader>
                    <CardContent className="h-[280px] px-6">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={history}>
                                <defs>
                                    <linearGradient id="glowCpuLight" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="glowMemLight" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="timestamp" hide />
                                <YAxis domain={[0, 100]} tick={{fontSize: 9, fontWeight: 900, fill: '#cbd5e1'}} axisLine={false} tickLine={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Area type="monotone" dataKey="cpu" name="CPU" stroke="#6366f1" strokeWidth={4} fill="url(#glowCpuLight)" animationDuration={300} />
                                <Area type="monotone" dataKey="memory" name="Memory" stroke="#0ea5e9" strokeWidth={4} fill="url(#glowMemLight)" animationDuration={300} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Bottom Service Grid (Light Clean Aesthetic) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {services.map((service, i) => (
                    <Card 
                        key={i} 
                        onClick={() => setSelectedService(selectedService === service.id ? null : service.id)}
                        className={`bg-white border-2 border-transparent shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-all group cursor-pointer ${
                            selectedService === service.id ? 'border-indigo-500 bg-indigo-50/10' : ''
                        }`}
                    >
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 shadow-sm group-hover:bg-white transition-colors">
                                    {service.icon}
                                </div>
                                <h3 className="text-[13px] font-black text-slate-800 leading-none">{service.name}</h3>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Latency</span>
                                    <span className="text-xs font-black text-slate-700 tracking-tighter">{service.latency}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Uptime</span>
                                    <span className="text-xs font-black text-slate-500 tracking-tighter">{service.uptime}</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <div className={`w-2 h-2 rounded-full ${service.status === 'Healthy' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                    <span className={`text-[10px] font-black uppercase tracking-tighter ${service.status === 'Healthy' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {service.status === 'Healthy' ? 'Operational' : 'Issues'}
                                    </span>
                                </div>
                                <Terminal className={`w-3 h-3 text-slate-300 transition-colors ${selectedService === service.id ? 'text-indigo-500' : ''}`} />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Real-time Logs Console */}
            <Card className="bg-slate-900 border-none shadow-2xl rounded-3xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                <CardHeader className="flex flex-row items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-lg">
                            <Terminal className="w-4 h-4 text-indigo-400" />
                        </div>
                        <div>
                            <CardTitle className="text-sm font-black text-white uppercase tracking-wider">System Live Stream</CardTitle>
                            <CardDescription className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                {selectedService ? `${selectedService} Active Feed` : 'Global Request Logs'}
                            </CardDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Filter className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input 
                                type="text" 
                                value={logFilter}
                                onChange={(e) => setLogFilter(e.target.value)}
                                placeholder="Filter path or method..."
                                className="bg-slate-800/50 border border-slate-700 text-slate-300 text-[11px] rounded-lg pl-9 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-48 transition-all"
                            />
                        </div>
                        {selectedService && (
                            <button 
                                onClick={() => setSelectedService(null)}
                                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="h-[400px] overflow-y-auto font-mono text-[11px] scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
                                <tr>
                                    <th className="px-6 py-3 text-slate-500 font-bold uppercase tracking-widest text-[9px]">Time</th>
                                    <th className="px-4 py-3 text-slate-500 font-bold uppercase tracking-widest text-[9px]">Method</th>
                                    <th className="px-4 py-3 text-slate-500 font-bold uppercase tracking-widest text-[9px]">Path</th>
                                    <th className="px-4 py-3 text-slate-500 font-bold uppercase tracking-widest text-[9px]">Status</th>
                                    <th className="px-4 py-3 text-slate-500 font-bold uppercase tracking-widest text-[9px]">Latency</th>
                                    <th className="px-4 py-3 text-slate-500 font-bold uppercase tracking-widest text-[9px]">User</th>
                                    <th className="px-6 py-3 text-slate-500 font-bold uppercase tracking-widest text-[9px]">Source IP</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-20 text-center text-slate-600 font-medium">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-12 h-12 rounded-full border-2 border-dashed border-slate-800 flex items-center justify-center animate-pulse">
                                                    <Activity className="w-5 h-5 opacity-20" />
                                                </div>
                                                <span>Waiting for events... Perform some actions to see live logs.</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLogs.map((log, i) => (
                                        <tr key={i} className="group border-b border-slate-800/50 hover:bg-indigo-500/5 transition-colors">
                                            <td className="px-6 py-2.5 text-slate-500 tabular-nums">{log.timestamp}</td>
                                            <td className="px-4 py-2.5 font-black">
                                                <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                                                    log.method === 'GET' ? 'bg-emerald-500/10 text-emerald-400' :
                                                    log.method === 'POST' ? 'bg-sky-500/10 text-sky-400' :
                                                    log.method === 'PUT' ? 'bg-amber-500/10 text-amber-400' :
                                                    'bg-rose-500/10 text-rose-400'
                                                }`}>
                                                    {log.method}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5 text-slate-300 font-medium max-w-xs truncate group-hover:text-white transition-colors">{log.path}</td>
                                            <td className="px-4 py-2.5 font-black">
                                                <span className={`${
                                                    log.status < 300 ? 'text-emerald-400' :
                                                    log.status < 400 ? 'text-sky-400' :
                                                    'text-rose-400'
                                                }`}>
                                                    {log.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5 text-slate-400 tabular-nums">{log.duration}</td>
                                            <td className="px-4 py-2.5 text-slate-400 truncate max-w-[120px]">{log.user}</td>
                                            <td className="px-6 py-2.5 text-slate-600 text-[10px] tabular-nums">{log.ip}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
