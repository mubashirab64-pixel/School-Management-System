"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
    Users, Search, ShieldCheck, Mail, Building2, 
    MoreVertical, UserPlus, RefreshCcw, XCircle
} from "lucide-react"
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

interface UserData {
    id: number
    username: string
    email: string
    first_name: string
    last_name: string
    role: string
    role_display: string
    organization: number | string | null
    organization_name: string
    phone_number: string
    is_active: boolean
    last_login: string
}

interface Organization {
    id: number
    name: string
}

export default function UserManagementPage() {
    const { toast } = useToast()
    const searchParams = useSearchParams()
    const roleFilter = searchParams.get('role')
    
    const [users, setUsers] = useState<UserData[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")

    // Modal States
    const [showModal, setShowModal] = useState(false)
    const [saving, setSaving] = useState(false)
    const [editingUser, setEditingUser] = useState<UserData | null>(null)
    const [orgs, setOrgs] = useState<Organization[]>([])
    
    // Password Reset States
    const [showResetModal, setShowResetModal] = useState(false)
    const [resettingUser, setResettingUser] = useState<UserData | null>(null)
    const [resetPassword, setResetPassword] = useState("")

    const [formData, setFormData] = useState({
        first_name: "",
        last_name: "",
        email: "",
        username: "",
        password: "",
        phone_number: "",
        role: "org_admin",
        organization: "",
        is_active: true
    })

    const fetchUsers = async () => {
        setLoading(true)
        try {
            let url = "/api/users/"
            if (roleFilter) {
                url += `?role=${roleFilter}`
            }
            const data = await apiGet<any>(url)
            setUsers(Array.isArray(data) ? data : (data.results || []))
        } catch (error) {
            console.error("Failed to fetch users:", error)
        } finally {
            setLoading(false)
        }
    }

    const fetchOrgs = async () => {
        try {
            const data = await apiGet<any>("/api/organizations/")
            setOrgs(Array.isArray(data) ? data : (data.results || []))
        } catch (error) {
            console.error("Failed to fetch organizations:", error)
        }
    }

    useEffect(() => {
        fetchUsers()
        fetchOrgs()
    }, [roleFilter])

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        try {
            if (editingUser) {
                const payload = {
                    first_name: formData.first_name,
                    last_name: formData.last_name,
                    email: formData.email,
                    username: formData.email,
                    phone_number: formData.phone_number,
                    organization: formData.organization,
                    is_active: formData.is_active
                }
                await apiPatch(`/api/users/${editingUser.id}/`, payload)
                
                toast({
                    title: "Profile Updated",
                    description: `Admin profile for ${formData.first_name} has been updated successfully.`,
                })
            } else {
                const payload = {
                    ...formData,
                    password_confirm: formData.password
                }
                await apiPost("/api/auth/register/", payload)
                
                toast({
                    title: "Admin Created",
                    description: `${formData.first_name} has been registered as ${formData.role === 'admin' ? 'an Admin' : 'an Organization Admin'}.`,
                })
            }
            
            setShowModal(false)
            setSearchQuery("")
            fetchUsers()
        } catch (error: any) {
            console.error("Save error:", error)
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message || "Failed to save user profile.",
            })
        } finally {
            setSaving(false)
        }
    }

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!resettingUser) return
        
        setSaving(true)
        try {
            await apiPost(`/api/users/${resettingUser.id}/reset-password/`, {
                password: resetPassword
            })
            
            toast({
                title: "Password Reset",
                description: `Password for ${resettingUser.first_name} has been reset successfully.`,
            })
            
            setShowResetModal(false)
            setResetPassword("")
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message || "Failed to reset password.",
            })
        } finally {
            setSaving(false)
        }
    }

    const handleDeleteUser = async (user: UserData) => {
        if (!confirm(`Are you sure you want to permanently delete the account for ${user.first_name} ${user.last_name}? This action cannot be undone.`)) {
            return
        }

        try {
            await apiDelete(`/api/users/${user.id}/`)
            toast({
                title: "User Deleted",
                description: "The account has been successfully removed from the system.",
            })
            setSearchQuery("")
            fetchUsers()
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Deletion Failed",
                description: error.message || "Could not delete user account at this time.",
            })
        }
    }

    const openCreateModal = () => {
        setEditingUser(null)
        setFormData({
            first_name: "",
            last_name: "",
            email: "",
            username: "",
            password: "",
            phone_number: "",
            role: "org_admin",
            organization: "",
            is_active: true
        })
        setShowModal(true)
    }

    const openEditModal = (user: UserData) => {
        setEditingUser(user)
        setFormData({
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            username: user.username,
            password: "",
            phone_number: user.phone_number || "",
            role: user.role,
            organization: user.organization?.toString() || "",
            is_active: user.is_active
        })
        setShowModal(true)
    }

    const openResetModal = (user: UserData) => {
        setResettingUser(user)
        setResetPassword("")
        setShowResetModal(true)
    }

    const filteredUsers = users.filter(user => 
        (user.first_name + " " + user.last_name).toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.organization_name?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold text-gray-900">
                        {roleFilter === 'org_admin' ? "System Users" : "System Users"}
                    </h1>
                    <p className="text-sm text-gray-500">
                        {roleFilter === 'org_admin' 
                            ? "Manage owners and administrators across all school organizations" 
                            : "Manage all system users, roles and platform access"}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={fetchUsers} variant="outline" size="sm" className="bg-white">
                        <RefreshCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button onClick={openCreateModal} className="bg-[#2a4e78] hover:bg-[#2a4e78]/90 text-white">
                        <UserPlus className="w-4 h-4 mr-2" />
                        Add User
                    </Button>
                </div>
            </div>

            <Card className="border-none shadow-sm overflow-hidden rounded-2xl bg-white">
                <CardHeader className="border-b border-gray-50 bg-white p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input 
                                placeholder="Search by name, email or organization..." 
                                className="pl-10 bg-gray-50 border-none rounded-xl"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 py-1.5 px-3">
                                Total: {filteredUsers.length} Users
                            </Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50/50 text-[10px] uppercase tracking-wider font-bold text-gray-500 border-b border-gray-50">
                                <tr>
                                    <th className="px-6 py-4">User Details</th>
                                    <th className="px-6 py-4">Organization</th>
                                    <th className="px-6 py-4">Role</th>
                                    <th className="px-6 py-4 hidden md:table-cell">Last Login</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {loading ? (
                                    [1, 2, 3, 4, 5].map(i => (
                                        <tr key={i} className="animate-pulse">
                                            <td className="px-6 py-4"><div className="h-10 w-48 bg-gray-100 rounded" /></td>
                                            <td className="px-6 py-4"><div className="h-4 w-32 bg-gray-100 rounded" /></td>
                                            <td className="px-6 py-4"><div className="h-6 w-20 bg-gray-100 rounded-full" /></td>
                                            <td className="px-6 py-4"><div className="h-6 w-16 bg-gray-100 rounded-full" /></td>
                                            <td className="px-6 py-4 text-right"><div className="h-8 w-8 bg-gray-100 rounded ml-auto" /></td>
                                        </tr>
                                    ))
                                ) : filteredUsers.length > 0 ? (
                                    filteredUsers.map((user) => (
                                        <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-[#2a4e78]/10 flex items-center justify-center text-[#2a4e78] font-bold">
                                                        {user.first_name[0]}{user.last_name[0] || ""}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-bold text-gray-900 leading-none">
                                                            {user.first_name} {user.last_name}
                                                        </span>
                                                        <span className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                                            <Mail className="w-3 h-3" />
                                                            {user.email}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2 text-sm text-gray-700">
                                                    <Building2 className="w-4 h-4 text-gray-400" />
                                                    {user.organization_name || "System Admin"}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5">
                                                    <ShieldCheck className={`w-4 h-4 ${user.role === 'superadmin' ? 'text-amber-500' : 'text-blue-500'}`} />
                                                    <span className="text-xs font-semibold capitalize bg-gray-100 px-2.5 py-1 rounded-full">
                                                        {user.role_display}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 hidden md:table-cell">
                                                {user.last_login ? (
                                                    <div>
                                                        <div className="text-xs text-gray-800 font-medium">
                                                            {new Date(user.last_login).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })}
                                                        </div>
                                                        <div className="text-xs text-gray-400">
                                                            {new Date(user.last_login).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-gray-400">Never</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {user.is_active ? (
                                                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 font-bold text-[10px]">
                                                        ACTIVE
                                                    </Badge>
                                                ) : (
                                                    <Badge className="bg-red-50 text-red-700 border-red-100 font-bold text-[10px]">
                                                        INACTIVE
                                                    </Badge>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-gray-900">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-40 rounded-xl shadow-xl">
                                                        <DropdownMenuItem onClick={() => openEditModal(user)} className="text-xs font-medium cursor-pointer">
                                                            Edit Profile
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => openResetModal(user)} className="text-xs font-medium cursor-pointer">
                                                            Reset Password
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleDeleteUser(user)} className="text-xs font-medium text-red-600 cursor-pointer">
                                                            Delete User
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-20 text-center text-gray-500">
                                            <div className="flex flex-col items-center gap-2">
                                                <Users className="w-10 h-10 text-gray-200" />
                                                <p className="font-medium">No users found</p>
                                                <p className="text-xs">Adjust your search or filter to find what you're looking for</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Add/Edit User Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                            <div>
                                <h2 className="text-xl font-black text-[#2a4e78] uppercase tracking-tight">
                                    {editingUser ? "Update Admin Profile" : "Add New Admin"}
                                </h2>
                                <p className="text-xs text-gray-500 flex items-center gap-1 mt-1 font-bold">
                                    <Building2 className="w-3 h-3" /> 
                                    {editingUser ? "MODIFYING ORGANIZATION ACCESS" : "SETTING UP ORGANIZATION ACCESS"}
                                </p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setShowModal(false)} className="rounded-full">
                                <XCircle className="w-6 h-6 text-gray-400" />
                            </Button>
                        </div>
                        
                        <form onSubmit={handleSaveUser} className="p-8 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2 ml-1">Head Name</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Input required placeholder="First" value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} className="bg-gray-50/50 border-gray-100 rounded-xl" />
                                        <Input required placeholder="Last" value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} className="bg-gray-50/50 border-gray-100 rounded-xl" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2 ml-1">Position (Role)</label>
                                    <select 
                                        required
                                        value={formData.role}
                                        onChange={e => setFormData({...formData, role: e.target.value})}
                                        className="w-full bg-blue-50/50 border border-blue-100 rounded-xl px-4 py-2 text-sm text-blue-700 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                                    >
                                        <option value="org_admin">Organization Admin</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2 ml-1">Head Email (Username)</label>
                                    <Input required type="email" placeholder="email@example.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value, username: e.target.value})} className="bg-gray-50/50 border-gray-100 rounded-xl" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2 ml-1">Phone Number</label>
                                    <Input required placeholder="+92 XXX XXXXXXX" value={formData.phone_number} onChange={e => setFormData({...formData, phone_number: e.target.value})} className="bg-gray-50/50 border-gray-100 rounded-xl" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className={formData.role === 'admin' ? 'opacity-50 cursor-not-allowed' : ''}>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2 ml-1">
                                        Select Organization {formData.role === 'admin' && '(Optional for Admins)'}
                                    </label>
                                    <select 
                                        required={formData.role !== 'admin'}
                                        disabled={formData.role === 'admin'}
                                        value={formData.organization}
                                        onChange={e => setFormData({...formData, organization: e.target.value})}
                                        className="w-full bg-gray-50/50 border border-gray-100 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2a4e78]/10"
                                    >
                                        <option value="">{formData.role === 'admin' ? 'No Organization (System Level)' : 'Select Organization...'}</option>
                                        {orgs.map((org: any) => (
                                            <option key={org.id} value={org.id}>{org.name}</option>
                                        ))}
                                    </select>
                                </div>
                                {!editingUser ? (
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2 ml-1">Initial Password</label>
                                        <Input required type="password" placeholder="••••••••" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="bg-gray-50/50 border-gray-100 rounded-xl" />
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2 ml-1">Account Active Status</label>
                                        <select 
                                            required
                                            value={formData.is_active ? "true" : "false"}
                                            onChange={e => setFormData({...formData, is_active: e.target.value === "true"})}
                                            className={`w-full border rounded-xl px-4 py-2 text-sm focus:outline-none font-bold transition-all duration-200 ${formData.is_active ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}
                                        >
                                            <option value="true">ACTIVE (USER CAN LOGIN)</option>
                                            <option value="false">INACTIVE (BLOCK ACCESS)</option>
                                        </select>
                                    </div>
                                )}
                            </div>

                            {!editingUser && (
                                <div className="grid grid-cols-1 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2 ml-1">Account Active Status</label>
                                        <select 
                                            required
                                            value={formData.is_active ? "true" : "false"}
                                            onChange={e => setFormData({...formData, is_active: e.target.value === "true"})}
                                            className={`w-full border rounded-xl px-4 py-2 text-sm focus:outline-none font-bold transition-all duration-200 ${formData.is_active ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}
                                        >
                                            <option value="true">ACTIVE (USER CAN LOGIN)</option>
                                            <option value="false">INACTIVE (BLOCK ACCESS)</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3 pt-6">
                                <Button type="button" variant="outline" onClick={() => setShowModal(false)} className="flex-1 rounded-2xl py-6 font-bold text-gray-500">Cancel</Button>
                                <Button type="submit" disabled={saving} className="flex-1 rounded-2xl py-6 font-bold bg-[#2a4e78] hover:bg-[#2a4e78]/90 text-white">
                                    {saving ? (editingUser ? "Updating..." : "Creating Admin...") : (editingUser ? "Update Profile" : "Save Admin Profile")}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Reset Password Modal */}
            {showResetModal && resettingUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-50 bg-amber-50/30 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-100 rounded-lg">
                                    <RefreshCcw className="w-5 h-5 text-amber-600" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-amber-900 uppercase tracking-tight">Reset Password</h2>
                                    <p className="text-[10px] text-amber-700 font-bold uppercase">{resettingUser.first_name} {resettingUser.last_name}</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setShowResetModal(false)} className="rounded-full">
                                <XCircle className="w-5 h-5 text-gray-400" />
                            </Button>
                        </div>
                        
                        <form onSubmit={handleResetPassword} className="p-6 space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2 ml-1">New Secure Password</label>
                                <Input 
                                    required 
                                    type="password" 
                                    placeholder="Enter new password" 
                                    value={resetPassword} 
                                    onChange={e => setResetPassword(e.target.value)} 
                                    className="bg-gray-50/50 border-gray-100 rounded-xl py-6" 
                                />
                                <p className="text-[9px] text-gray-400 mt-2 ml-1">User will need to use this new password for the next login.</p>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button type="button" variant="ghost" onClick={() => setShowResetModal(false)} className="flex-1 rounded-xl font-bold text-gray-400">Abort</Button>
                                <Button type="submit" disabled={saving} className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold">
                                    {saving ? "Resetting..." : "Confirm Reset"}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
