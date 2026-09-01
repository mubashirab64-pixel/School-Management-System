"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { fetchRolePermissions, toggleRolePermission, RolePermission } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import {
    ChevronRight,
    Users,
    LayoutDashboard,
    FileText,
    BookOpen,
    ClipboardList,
    Building2,
    Shield,
    Save,
    RotateCcw,
    CheckCircle,
    Banknote,
    CalendarDays,
    ArrowRightLeft,
    Fingerprint,
    Search,
    ShieldAlert,
    HelpCircle,
    Lock,
    Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePermissions, getCurrentUserRole } from "@/lib/permissions";
import { AccessDenied } from "@/components/AccessDenied";
import { useOrgFeatures } from "@/hooks/useOrgFeatures";

const MODULES = [
    {
        key: "dashboard_analytics",
        label: "Dashboard & Analytics",
        icon: LayoutDashboard,
        color: "from-blue-500 to-indigo-500",
        submodules: [
            {
                key: "access",
                label: "Dashboard Access",
                description: "Toggle landing page dashboards for different roles.",
                patterns: [/view_.*_dashboard/],
            },
            {
                key: "charts_kpi",
                label: "Charts & KPI Cards",
                description: "Detailed graphical reports and key performance indicators.",
                patterns: [/_kpi$/, /_chart$/],
            },
        ],
    },
    {
        key: "staff_management",
        label: "Staff Management",
        featureKey: "staff_management",
        icon: Users,
        color: "from-emerald-500 to-teal-500",
        submodules: [
            {
                key: "students",
                label: "Students",
                description: "View, add, and edit student profiles.",
                patterns: [/^view_students/, /^add_student/, /^edit_student/, /^delete_student/],
            },
            {
                key: "teachers",
                label: "Teachers",
                description: "View, add, and edit teacher profiles.",
                patterns: [/^view_teachers/, /^add_teacher/, /^edit_teacher/, /^delete_teacher/],
            },
            {
                key: "coordinators",
                label: "Coordinators",
                description: "View, add, and edit coordinator access.",
                patterns: [/^view_coordinators/, /^add_coordinator/, /^edit_coordinator/, /^delete_coordinator/],
            },
            {
                key: "principals",
                label: "Principals",
                description: "View, add, and edit principal permissions.",
                patterns: [/^view_principals/, /^add_principal/, /^edit_principal/, /^delete_principal/],
            },
            {
                key: "promotions",
                label: "Promotions",
                description: "Handle class promotions and student movements.",
                patterns: [/^view_promotions/],
            },
        ],
    },
    {
        key: "academic_structure",
        label: "Academic Structure",
        featureKey: "academic_structure",
        icon: Building2,
        color: "from-purple-500 to-pink-500",
        submodules: [
            {
                key: "campus",
                label: "Campus & Infrastructure",
                description: "Campus facilities, classrooms, levels, and grades.",
                patterns: [/^view_campus/, /^add_campus/],
            },
        ],
    },
    {
        key: "fees_management",
        label: "Fees Management",
        featureKey: "fees_management",
        icon: Banknote,
        color: "from-cyan-500 to-blue-500",
        submodules: [
            {
                key: "fees",
                label: "Fee Access & Control",
                description: "View and manage fee structures, payments, and vouchers.",
                patterns: [/_fees$/],
            },
        ],
    },
    {
        key: "result_management",
        label: "Result Management",
        featureKey: "result_management",
        icon: FileText,
        color: "from-rose-500 to-orange-500",
        submodules: [
            {
                key: "results",
                label: "Results & Exams",
                description: "View, create, edit, bulk import, and approve results.",
                patterns: [/^view_results/, /^edit_results/, /^bulk_import_results/, /^approve_results/],
            },
        ],
    },
    {
        key: "student_attendance",
        label: "Student Attendance",
        featureKey: "student_attendance",
        icon: CheckCircle,
        color: "from-green-500 to-emerald-500",
        submodules: [
            {
                key: "attendance",
                label: "Attendance Controls",
                description: "View, mark, and approve daily student attendance.",
                patterns: [/^view_attendance/, /^mark_attendance/, /^approve_attendance/],
            },
        ],
    },
    {
        key: "timetable",
        label: "Timetable",
        featureKey: "timetable",
        icon: CalendarDays,
        color: "from-amber-500 to-yellow-500",
        submodules: [
            {
                key: "timetable_access",
                label: "Timetable Access",
                description: "View and manage timetables for classes and teachers.",
                patterns: [/^view_timetable/],
            },
        ],
    },
    {
        key: "transfers",
        label: "Transfers",
        featureKey: "transfers",
        icon: ArrowRightLeft,
        color: "from-indigo-500 to-violet-500",
        submodules: [
            {
                key: "transfers_access",
                label: "Transfer Access",
                description: "View and handle student and staff transfers.",
                patterns: [/^view_transfers/],
            },
        ],
    },
    {
        key: "support_desk",
        label: "Support Desk",
        featureKey: "support_desk",
        icon: ClipboardList,
        color: "from-slate-500 to-slate-700",
        submodules: [
            {
                key: "requests",
                label: "Requests & Complaints",
                description: "View and manage internal requests and complaints.",
                patterns: [/^view_requests/],
            },
        ],
    },
    {
        key: "subject_assignment",
        label: "Subject Assignment",
        featureKey: "subject_assignment",
        icon: BookOpen,
        color: "from-sky-500 to-cyan-500",
        // Only these roles can be toggled for Subject Assignment; the rest stay disabled.
        allowedRoles: ["principal", "coordinator"],
        submodules: [
            {
                key: "subjects",
                label: "Subject Access",
                description: "View and assign subjects to teachers and classes.",
                patterns: [/^view_subjects/],
            },
        ],
    },
    {
        key: "system_admin",
        label: "System Admin",
        icon: Shield,
        color: "from-red-500 to-rose-500",
        submodules: [
            {
                key: "security",
                label: "Roles & Security",
                description: "Override and manage role-based permissions.",
                patterns: [/^manage_permissions/],
            },
            {
                key: "tooling",
                label: "Tooling & Utilities",
                description: "Form builders and internal system tools.",
                patterns: [/^manage_forms/],
            },
        ],
    },
];

const ROLE_DISPLAY_NAMES: Record<string, string> = {
    principal: "Principal",
    coordinator: "Coordinator",
    teacher: "Teacher",
    donor: "Donor",
    accounts_officer: "Accountant",
    admissions_counselor: "Receptionist",
    compliance_officer: "Auditor",
};

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string; accent: string }> = {
    principal: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", accent: "bg-purple-600" },
    coordinator: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", accent: "bg-indigo-600" },
    teacher: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", accent: "bg-emerald-600" },
    donor: { bg: "bg-pink-50", text: "text-pink-700", border: "border-pink-200", accent: "bg-pink-600" },
    accounts_officer: { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200", accent: "bg-cyan-600" },
    admissions_counselor: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", accent: "bg-rose-600" },
    compliance_officer: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", accent: "bg-amber-600" },
};

export default function PermissionsPage() {
    const { canManagePermissions } = usePermissions();
    const [permissions, setPermissions] = useState<RolePermission[]>([]);

    const [originalPermissions, setOriginalPermissions] = useState<RolePermission[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedSubmodules, setExpandedSubmodules] = useState<string[]>([]);
    const { features: enabledFeatures, hasFeatureConfig } = useOrgFeatures();
    const { toast } = useToast();

    const hasAccess = canManagePermissions;

    const loadPermissions = async () => {
        if (!hasAccess) return;
        try {
            setLoading(true);
            const data = await fetchRolePermissions();
            const fetched = data || [];
            setPermissions([...fetched]);
            setOriginalPermissions(JSON.parse(JSON.stringify(fetched)));
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to load permissions.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPermissions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasAccess]);

    if (!hasAccess) {
        return <AccessDenied title="Restricted Area" message="Only administrators can manage role-based permissions." />
    }

    const RBAC_HIERARCHY: Record<string, string[]> = {
        'view_teachers': ['add_teacher', 'edit_teacher', 'delete_teacher'],
        'view_students': ['add_student', 'edit_student', 'delete_student'],
        'view_coordinators': ['add_coordinator', 'edit_coordinator', 'delete_coordinator'],
        'view_principals': ['add_principal', 'edit_principal', 'delete_principal']
    };

    const getParentOf = (codename: string) => {
        return Object.keys(RBAC_HIERARCHY).find(parent => RBAC_HIERARCHY[parent].includes(codename));
    };

    const handleToggle = (role: string, codename: string, currentValue: boolean) => {
        setPermissions(prev => {
            const newPerms = [...prev];
            const newValue = !currentValue;

            // Toggle target
            const idx = newPerms.findIndex(p => p.role === role && p.permission_codename === codename);
            if (idx !== -1) {
                newPerms[idx] = { ...newPerms[idx], is_allowed: newValue };
            }

            // Rule 1: If parent is disabled, disable all children
            if (RBAC_HIERARCHY[codename] && newValue === false) {
                RBAC_HIERARCHY[codename].forEach(child => {
                    const cIdx = newPerms.findIndex(p => p.role === role && p.permission_codename === child);
                    if (cIdx !== -1) {
                        newPerms[cIdx] = { ...newPerms[cIdx], is_allowed: false };
                    }
                });
            }

            // Rule 2 & 3: If child is enabled, parent MUST be enabled
            const parentName = getParentOf(codename);
            if (parentName && newValue === true) {
                const pIdx = newPerms.findIndex(p => p.role === role && p.permission_codename === parentName);
                if (pIdx !== -1) {
                    newPerms[pIdx] = { ...newPerms[pIdx], is_allowed: true };
                }
            }

            return newPerms;
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const changes = permissions.filter(p => {
                const original = originalPermissions.find(op => op.id === p.id);
                return original && original.is_allowed !== p.is_allowed;
            });

            if (changes.length === 0) return;

            await Promise.all(changes.map(p => toggleRolePermission(p.role, p.permission_codename, p.is_allowed)));

            setOriginalPermissions(JSON.parse(JSON.stringify(permissions)));
            toast({
                title: "Policies Published",
                description: `${changes.length} permission roles have been successfully updated in real-time.`,
            });
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to save some permissions.",
                variant: "destructive",
            });
            loadPermissions();
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = () => {
        setPermissions(JSON.parse(JSON.stringify(originalPermissions)));
        toast({
            title: "Changes Reverted",
            description: "Permissions have been reset to the last published state.",
        });
    };

    const hasChanges = JSON.stringify(permissions) !== JSON.stringify(originalPermissions);

    const roles = useMemo(() => {
        const roleOrder = ['principal', 'coordinator', 'teacher', 'donor'];
        const r = Array.from(new Set(permissions.map(p => p.role)))
            .filter(role => role !== 'superadmin' && role !== 'org_admin');
        
        return r.sort((a, b) => {
            const idxA = roleOrder.indexOf(a);
            const idxB = roleOrder.indexOf(b);
            
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.localeCompare(b);
        });
    }, [permissions]);

    // Structure the data into the Modules -> Submodules -> Capabilities hierarchy
    const structuredModules = useMemo(() => {
        const uniqueCodenames = Array.from(new Set(permissions.map(p => p.permission_codename)));

        return MODULES.map(module => {
            const submodules = module.submodules.map(sub => {
                const codenames = uniqueCodenames
                    .filter(cn => sub.patterns.some(p => p.test(cn)))
                    .sort((a, b) => {
                        const idxA = sub.patterns.findIndex(p => p.test(a));
                        const idxB = sub.patterns.findIndex(p => p.test(b));
                        if (idxA !== idxB) return idxA - idxB;
                        return a.localeCompare(b);
                    });
                
                const capabilities = codenames.map(cn => {
                    const sample = permissions.find(p => p.permission_codename === cn);
                    const label = (sample?.permission_label || cn)
                        .replace('view_', '')
                        .replace('_dashboard', ' Dashboard')
                        .replace('_', ' ')
                        .replace(' KPI', '')
                        .replace(' Chart', '');
                    const roleStates = roles.reduce((acc, role) => {
                        const perm = permissions.find(p => p.role === role && p.permission_codename === cn);
                        acc[role] = perm?.is_allowed || false;
                        return acc;
                    }, {} as Record<string, boolean>);
                    return { codename: cn, label, roleStates };
                }).filter(cap => {
                    if (!searchQuery) return true;
                    const query = searchQuery.toLowerCase();
                    return cap.label.toLowerCase().includes(query) || cap.codename.toLowerCase().includes(query);
                });
                return { ...sub, capabilities };
            }).filter(sub => sub.capabilities.length > 0);

            return { ...module, submodules };
        }).filter(m => {
            if (m.submodules.length === 0) return false;

            const userRole = getCurrentUserRole();

            // System Admin module — superadmin only
            if (m.key === "system_admin" && userRole !== "superadmin") return false;

            // Feature gating — only applies when org has new feature format
            if (hasFeatureConfig && (m as any).featureKey) {
                if (!enabledFeatures[(m as any).featureKey]) return false;
            }

            return true;
        });
    }, [permissions, roles, enabledFeatures, searchQuery]);

    const [activeTab, setActiveTab] = useState<string>("");
    
    useEffect(() => {
        if (!activeTab && structuredModules.length > 0) {
            setActiveTab(structuredModules[0].key);
        }
    }, [structuredModules, activeTab]);

    const toggleSubmodule = (key: string) => {
        setExpandedSubmodules(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    const getPermissionBadgeColor = (codename: string) => {
        if (codename.includes('delete')) return "bg-rose-50 text-rose-700 border-rose-100";
        if (codename.includes('add') || codename.includes('create') || codename.includes('mark')) return "bg-emerald-50 text-emerald-700 border-emerald-100";
        if (codename.includes('edit') || codename.includes('change') || codename.includes('update')) return "bg-amber-50 text-amber-700 border-amber-100";
        if (codename.includes('approve')) return "bg-purple-50 text-purple-700 border-purple-100";
        return "bg-blue-50 text-blue-700 border-blue-100";
    };

    const getPermissionTypeLabel = (codename: string) => {
        if (codename.includes('delete')) return "Danger";
        if (codename.includes('add') || codename.includes('create') || codename.includes('mark')) return "Write";
        if (codename.includes('edit') || codename.includes('change') || codename.includes('update')) return "Update";
        if (codename.includes('approve')) return "Authorize";
        return "Read";
    };

    if (loading) {
        return (
            <div className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 space-y-8 animate-pulse">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-3">
                        <div className="h-10 w-64 bg-gray-200 rounded-lg"></div>
                        <div className="h-4 w-96 bg-gray-100 rounded-md"></div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="flex gap-2 border-b border-gray-100 pb-2">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="h-10 w-24 bg-gray-100 rounded-md"></div>
                        ))}
                    </div>

                    <Card className="border-none shadow-xl shadow-blue-500/5 overflow-hidden">
                        <CardContent className="p-0">
                            <div className="h-16 bg-gray-50/50 border-b border-gray-100 flex items-center px-6 gap-8">
                                <div className="w-[450px] h-6 bg-gray-200 rounded-md"></div>
                                <div className="flex-1 flex gap-4">
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} className="flex-1 h-6 bg-gray-200 rounded-md"></div>
                                    ))}
                                </div>
                            </div>
                            <div className="p-6 space-y-8">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="space-y-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-8 h-8 rounded-full bg-gray-100"></div>
                                            <div className="space-y-2">
                                                <div className="h-4 w-48 bg-gray-200 rounded"></div>
                                                <div className="h-3 w-64 bg-gray-100 rounded"></div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-[1650px] mx-auto p-4 sm:p-6 lg:p-8 space-y-8 antialiased">
            {/* Header Suite */}
            <div className="relative overflow-hidden bg-gradient-to-r from-[#1a365d] via-[#244976] to-[#2a4e78] text-white rounded-[32px] p-6 sm:p-8 lg:p-10 shadow-2xl border border-[#2a4e78]/30">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-full blur-3xl opacity-60 pointer-events-none -mr-40 -mt-40" />
                <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-emerald-500/5 rounded-full blur-3xl opacity-40 pointer-events-none -ml-20 -mb-20" />
                
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                    <div className="space-y-3">
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-bold uppercase tracking-wider">
                            <Sparkles className="w-3.5 h-3.5" />
                            Security Suite v3.2
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                            Platform Setup & Permissions
                        </h1>
                        <p className="text-slate-400 text-sm sm:text-base font-medium max-w-2xl leading-relaxed">
                            Configure granular feature access matrices, manage custom role security, and toggle platform visibility features globally in real-time.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 bg-slate-800/40 backdrop-blur border border-white/5 p-2 rounded-2xl shrink-0 self-start lg:self-center">
                        <AnimatePresence>
                            {hasChanges ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="flex items-center gap-2"
                                >
                                    <Button
                                        variant="ghost"
                                        onClick={handleReset}
                                        className="h-12 px-5 gap-2 text-rose-300 hover:text-rose-100 hover:bg-rose-950/30 font-bold rounded-xl transition-colors cursor-pointer"
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                        Revert Changes
                                    </Button>
                                    <Button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="h-12 px-6 gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold rounded-xl shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all duration-200 cursor-pointer min-w-[150px]"
                                    >
                                        {isSaving ? (
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <Save className="w-4 h-4" />
                                        )}
                                        {isSaving ? "Saving..." : "Publish Policies"}
                                    </Button>
                                </motion.div>
                            ) : (
                                <div className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-slate-400">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    Security policies fully synced
                                </div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Matrix & Search Utilities */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <div className="relative w-full lg:max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search capability or codename..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-11 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:ring-4 focus:ring-blue-50 focus:border-blue-500 transition-all outline-none"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 py-1 px-2 rounded-md hover:bg-slate-100 transition-colors"
                        >
                            Clear
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100">
                    <Lock className="w-3.5 h-3.5 text-blue-500" />
                    <span>Cascading rules active: Enabling Write/Delete automatically authorizes Read capability.</span>
                </div>
            </div>

            {/* Matrix Container */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
                {/* Beautiful Scrollable Pill Tabs */}
                {/* Beautiful Scrollable Pill Tabs */}
                <div className="relative w-full overflow-visible">
                    <style dangerouslySetInnerHTML={{__html: `
                        .custom-tabs-scroll::-webkit-scrollbar {
                            display: none !important;
                            width: 0 !important;
                            height: 0 !important;
                        }
                    `}} />
                    <TabsList 
                        className="flex flex-row flex-nowrap gap-2.5 bg-transparent border-none px-28 pr-6 pt-1.5 pb-2.5 w-full overflow-x-auto whitespace-nowrap scrollbar-none custom-tabs-scroll shadow-none"
                        style={{ height: 'auto', background: 'transparent', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                        {structuredModules.map(module => (
                            <TabsTrigger 
                                key={module.key} 
                                value={module.key}
                                className="group flex items-center gap-2.5  py-3 rounded-xl border border-slate-200/80 text-slate-600 bg-white hover:text-slate-800 hover:bg-slate-50/80 hover:border-slate-300 text-xs font-extrabold uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-sm data-[state=active]:!bg-[#2a4e78] data-[state=active]:!text-white data-[state=active]:!border-[#2a4e78] data-[state=active]:shadow-md data-[state=active]:shadow-[#2a4e78]/25 data-[state=active]:scale-[1.02] shrink-0"
                            >
                                <div className="p-1 rounded-lg transition-colors bg-slate-100 text-slate-500 group-data-[state=active]:!bg-white/15 group-data-[state=active]:!text-white">
                                    <module.icon className="w-4 h-4 shrink-0" />
                                </div>
                                <span className="shrink-0">{module.label}</span>
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </div>

                {/* Iterate Tab Contents */}
                {structuredModules.map(module => (
                    <TabsContent key={module.key} value={module.key} className="outline-none focus:outline-none">
                        <Card className="border border-slate-100 shadow-2xl shadow-slate-100 rounded-3xl overflow-hidden bg-white">
                            <CardContent className="p-0 overflow-x-auto overflow-y-visible scrollbar-thin">
                                <div className="min-w-[1450px]">
                                    {/* Sticky Table Header for Capabilities */}
                                    <div className="flex items-center bg-slate-50 border-b border-slate-100 py-5 sticky top-0 z-30 backdrop-blur-md bg-white/90">
                                        <div className="w-[480px] shrink-0 px-8 text-xs font-extrabold text-[#2a4e78] uppercase tracking-widest">
                                            CAPABILITY GROUPS
                                        </div>
                                        <div className="flex flex-1 items-center pr-4">
                                            {roles.map(role => {
                                                const colors = ROLE_COLORS[role] || { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200", accent: "bg-slate-600" };
                                                return (
                                                    <div key={role} className="w-[105px] shrink-0 px-2 flex justify-center">
                                                        <div className={`py-2 px-3 rounded-xl border ${colors.bg} ${colors.text} ${colors.border} flex flex-col items-center justify-center gap-1 font-bold text-xs uppercase tracking-wider shadow-sm transition-all hover:scale-[1.02]`}>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className={`w-2 h-2 rounded-full ${colors.accent}`} />
                                                                <span>{ROLE_DISPLAY_NAMES[role] || role}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Scrollable Capability Items */}
                                    <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100 scrollbar-thin">
                                        {module.submodules.map((sub) => (
                                            <div key={sub.key} className="flex flex-col hover:bg-slate-50/20 transition-colors">
                                                {/* Submodule Accordion Header */}
                                                <div 
                                                    onClick={() => toggleSubmodule(sub.key)}
                                                    className="flex items-center cursor-pointer group py-6 relative"
                                                >
                                                    <div className="w-[480px] shrink-0 px-8 z-10 flex items-start gap-4">
                                                        <motion.div
                                                            animate={{ rotate: expandedSubmodules.includes(sub.key) ? 90 : 0 }}
                                                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                                            className="mt-1 bg-slate-100 p-1 rounded-md text-slate-500 group-hover:bg-[#2a4e78]/10 group-hover:text-[#2a4e78] transition-colors"
                                                        >
                                                            <ChevronRight className="w-4.5 h-4.5" />
                                                        </motion.div>
                                                        <div>
                                                            <h3 className="font-extrabold text-slate-800 text-[15px] group-hover:text-[#2a4e78] transition-colors">{sub.label}</h3>
                                                            <p className="text-xs text-slate-500 font-semibold mt-0.5">{sub.description}</p>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Master Toggle Area for Submodule */}    
                                                    <div className="flex flex-1 items-center z-10 pr-4">
                                                        {roles.map(role => {
                                                            const allEnabled = sub.capabilities.every(p => p.roleStates[role]);
                                                            const someEnabled = sub.capabilities.some(p => p.roleStates[role]) && !allEnabled;
                                                            const roleAllowed = !(module as any).allowedRoles || (module as any).allowedRoles.includes(role);
                                                            return (
                                                                <div key={role} className="w-[105px] shrink-0 px-2 text-center flex flex-col items-center justify-center gap-1 group/master">
                                                                    <Switch
                                                                        checked={allEnabled}
                                                                        disabled={!roleAllowed}
                                                                        className={`scale-90 transition-all ${!roleAllowed ? 'opacity-30 cursor-not-allowed' : someEnabled ? 'opacity-60 bg-blue-400' : 'data-[state=checked]:bg-[#2a4e78]'}`}
                                                                        onCheckedChange={(val) => {
                                                                            if (!roleAllowed) return;
                                                                            setPermissions(prev => {
                                                                                const newPerms = [...prev];
                                                                                sub.capabilities.forEach(cp => {
                                                                                    const idx = newPerms.findIndex(p => p.role === role && p.permission_codename === cp.codename);
                                                                                    if (idx !== -1) newPerms[idx].is_allowed = val;
                                                                                });
                                                                                return newPerms;
                                                                            });
                                                                        }}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    />
                                                                    <span className="text-[9px] font-bold text-slate-400 tracking-tighter uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        {allEnabled ? "ALL ON" : "TOGGLE GROUP"}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Submodule Content (Capabilities) */}
                                                <AnimatePresence initial={false}>
                                                    {expandedSubmodules.includes(sub.key) && (
                                                        <motion.div
                                                            key={`${sub.key}-content`}
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: "auto", opacity: 1, transition: { duration: 0.25, ease: "easeInOut" } }}
                                                            exit={{ height: 0, opacity: 0, transition: { duration: 0.2 } }}
                                                            className="overflow-hidden bg-slate-50/50 border-t border-slate-100"
                                                        >
                                                            <div className="divide-y divide-slate-100/60 pl-0 bg-slate-50/20">
                                                                {sub.capabilities.map((cap) => (
                                                                    <div key={cap.codename} className="flex items-center hover:bg-white transition-all duration-200 py-4 relative group">
                                                                        {/* Visual Nesting Indicator Line */}
                                                                        <div className="absolute left-6 top-0 bottom-0 w-px bg-slate-200" />
                                                                        <div className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-px bg-slate-200" />

                                                                        {/* Capability Label & Badge */}
                                                                        <div className="w-[480px] shrink-0 pl-14 pr-6 py-1">
                                                                            <div className="flex items-center gap-3">
                                                                                <div className="space-y-1">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="text-sm font-bold text-slate-700 capitalize">
                                                                                            {cap.label.replace('View ', '').replace('Add ', '').replace('Edit ', '').replace('Manage ', '')} 
                                                                                        </span>
                                                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getPermissionBadgeColor(cap.codename)}`}>
                                                                                            {getPermissionTypeLabel(cap.codename)}
                                                                                        </span>
                                                                                    </div>
                                                                                    <p className="text-[10px] text-slate-400 font-mono tracking-normal block group-hover:text-[#2a4e78] transition-colors">{cap.codename}</p>
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        {/* Capability Toggles */}
                                                                        <div className="flex flex-1 items-center pr-4">
                                                                            {roles.map(role => {
                                                                                const roleAllowed = !(module as any).allowedRoles || (module as any).allowedRoles.includes(role);
                                                                                return (
                                                                                <div key={role} className="w-[105px] shrink-0 px-2 text-center flex justify-center">
                                                                                    <Switch
                                                                                        checked={cap.roleStates[role]}
                                                                                        disabled={!roleAllowed}
                                                                                        className={`scale-90 data-[state=checked]:bg-[#10b981] ${!roleAllowed ? 'opacity-30 cursor-not-allowed' : ''}`}
                                                                                        onCheckedChange={() => { if (roleAllowed) handleToggle(role, cap.codename, cap.roleStates[role]); }}
                                                                                    />
                                                                                </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    );
}
