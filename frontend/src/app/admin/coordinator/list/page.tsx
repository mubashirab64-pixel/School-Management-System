"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Search, Clock, Award, Plus, User, RefreshCcw, ChevronDown, MapPin } from "lucide-react"
import { getAllCoordinators, getAllCampuses, getApiBaseUrl } from "@/lib/api"
import { getCurrentUserRole, getCurrentUser } from "@/lib/permissions"
import { CoordinatorEditForm } from "@/components/admin/edit-forms/coordinator-edit-form"
import { DataTable, ListFilters } from "@/components/shared"
import { Skeleton } from "@/components/ui/skeleton"
import { usePermissions } from "@/lib/permissions"
import { toast } from "sonner"

interface CoordinatorUser {
  id: number
  username: string
  email: string
  employee_code?: string
  first_name: string
  last_name: string
  full_name?: string
  role: string
  campus_name?: string
  is_active: boolean
  level?: string
  shift?: string
  joining_date?: string
  photo?: string | null
}

export default function CoordinatorListPage() {
  const perms = usePermissions()
  useEffect(() => {
    document.title = "Coordinator List - Coordinator | Newton AMS"
  }, [])

  const [search, setSearch] = useState("")
  const [shiftFilter, setShiftFilter] = useState("all")  // "all" means show everything
  const [levelFilter, setLevelFilter] = useState("all")  // "all" means show every level
  const [coordinators, setCoordinators] = useState<CoordinatorUser[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string>("")
  const [userCampus, setUserCampus] = useState<string>("")
  const [campusIdToName, setCampusIdToName] = useState<Record<string, string>>({})
  const [editingCoordinator, setEditingCoordinator] = useState<CoordinatorUser | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [allCampusesData, setAllCampusesData] = useState<any[]>([])
  const router = useRouter()

  // Get user role and campus for principal filtering
  // Get user role and campus for principal filtering
  useEffect(() => {
    if (typeof window !== "undefined") {
      const role = getCurrentUserRole()
      setUserRole(role)

      const user = getCurrentUser() as any

      // Check different possible campus data structures
      if (user?.campus?.campus_name) {
        setUserCampus(user.campus.campus_name)
      } else if (user?.campus_name) {
        setUserCampus(user.campus_name)
      } else if (user?.campus) {
        setUserCampus(user.campus)
      } else {
        // Try to get campus from username pattern (C06-M-24-P-0057)
        if (user?.username) {
          const campusMatch = user.username.match(/C(\d+)/);
          if (campusMatch) {
            const campusNumber = campusMatch[1];
            const campusName = `Campus ${campusNumber}`;
            setUserCampus(campusName)
          }
        }
      }
    }
  }, [])

  useEffect(() => {
    let isSubscribed = true;  // For avoiding state updates after unmount

    async function load() {
      if (!isSubscribed) return;
      setLoading(true)

      try {
        let campusMap = campusIdToName // local view (may be replaced after fetching)
        if (Object.keys(campusIdToName).length === 0) {
          try {
            const campuses: any = await getAllCampuses()
            const results = campuses?.results || campuses || []
            const map: Record<string, string> = {}
            results.forEach((c: any) => {
              const id = String(c.id ?? c.campus_id ?? '').trim()
              const name = c.campus_name || c.name || ''
              if (id) map[id] = name
            })
            // update state for future renders
            setCampusIdToName(map)
            setAllCampusesData(results)
            campusMap = map // use local map immediately for this run
          } catch (e) {
            console.warn('Failed to load campuses for mapping (optional):', e)
          }
        }

        if ((userRole === 'principal' || userRole === 'coordinator') && userCampus) {
          const allCoordinators = await getAllCoordinators('') as any  // Load all coordinators without shift filter

          // Handle API response structure
          const coordinatorsList = allCoordinators?.results || allCoordinators || []

          // Filter coordinators by campus
          const normalize = (val: any): { name: string; num?: string } => {
            if (val === undefined || val === null) return { name: '' }
            // If numeric id, map to name when possible
            if (typeof val === 'number' || /^\d+$/.test(String(val))) {
              const idStr = String(val)
              const mapped = campusMap[idStr]
              return { name: (mapped || idStr).toLowerCase(), num: idStr }
            }
            const s = String(val).toLowerCase()
            const m = s.match(/(\d+)/)
            return { name: s, num: m ? m[1] : undefined }
          }

          const userNorm = normalize(userCampus)
          const campusCoordinators = coordinatorsList.filter((coord: any) => {
            const raw = coord.campus?.campus_name || coord.campus
            const coordNorm = normalize(raw)

            // Exact string match
            if (coordNorm.name && coordNorm.name === userNorm.name) return true
            // If both have numbers, compare the numbers
            if (coordNorm.num && userNorm.num && coordNorm.num === userNorm.num) return true
            // If only one has number, allow contains check
            if (coordNorm.num && userNorm.name.includes(coordNorm.num)) return true
            if (userNorm.num && coordNorm.name.includes(userNorm.num)) return true
            return false
          })

          // Map to CoordinatorUser format
          const mappedCoordinators = campusCoordinators.map((coord: any) => {
            return {
              id: coord.id,
              username: coord.email || coord.username || '',
              email: coord.email || '',
              employee_code: coord.employee_code || '',
              first_name: coord.full_name?.split(' ')[0] || coord.first_name || '',
              last_name: coord.full_name?.split(' ').slice(1).join(' ') || coord.last_name || '',
              role: 'coordinator',
              campus_name: coord.campus?.campus_name || coord.campus || userCampus,
              is_active: coord.is_currently_active !== false,
              photo: coord.photo || null,
              level: (() => {
                if (Array.isArray(coord.assigned_levels_details) && coord.assigned_levels_details.length > 0)
                  return coord.assigned_levels_details.map((l: any) => l.name).filter(Boolean).join(', ')
                if (coord.level_name) return coord.level_name
                return 'Not Assigned'
              })(),
              shift: coord.shift || '',
              joining_date: coord.joining_date || 'Unknown'
            }
          })

          setCoordinators(mappedCoordinators)
        } else {
          // For other roles, always get all coordinators and filter on client side
          const allCoordinators = await getAllCoordinators() as any

          // Handle API response structure
          const coordinatorsList = allCoordinators?.results || allCoordinators || []

          const mappedCoordinators = coordinatorsList.map((coord: any) => ({
            id: coord.id,
            username: coord.email || coord.username || '',
            email: coord.email || '',
            employee_code: coord.employee_code || '',
            first_name: coord.full_name?.split(' ')[0] || coord.first_name || '',
            last_name: coord.full_name?.split(' ').slice(1).join(' ') || coord.last_name || '',
            role: 'coordinator',
            campus_name: coord.campus?.campus_name || campusMap[String(coord.campus)] || (coord.campus ? String(coord.campus) : 'Unknown'),
            is_active: coord.is_currently_active !== false,
            level: (() => {
              if (Array.isArray(coord.assigned_levels_details) && coord.assigned_levels_details.length > 0)
                return coord.assigned_levels_details.map((l: any) => l.name).filter(Boolean).join(', ')
              if (coord.level_name) return coord.level_name
              return 'Unknown'
            })(),
            shift: coord.shift || 'Unknown',
            joining_date: coord.joining_date || 'Unknown'
          }))

          if (isSubscribed) {
            setCoordinators(mappedCoordinators)
          }
        }
      } catch (error) {
        console.error('Error loading coordinators:', error)
        if (isSubscribed) {
          setCoordinators([])
        }
      } finally {
        if (isSubscribed) {
          setLoading(false)
        }
      }
    }

    load()

    // Cleanup function to prevent state updates after unmount
    return () => {
      isSubscribed = false;
    }
  }, [userRole, userCampus]) // Removed shiftFilter from dependencies since we want to filter client-side

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let filteredCoordinators = [...coordinators]  // Create a new array to avoid mutations

    // Apply search filter — match across full name, email, ID (employee code) and username
    if (q) {
      filteredCoordinators = filteredCoordinators.filter(u => {
        const haystack = [
          u.first_name,
          u.last_name,
          `${u.first_name || ''} ${u.last_name || ''}`.trim(),
          u.username,
          u.email,
          u.employee_code,
        ].filter(Boolean).join(' ').toLowerCase()
        return haystack.includes(q)
      })
    }

    // Apply shift filter based on coordinator's shift status
    if (shiftFilter !== "all") {  // When "all" is selected, don't filter by shift
      filteredCoordinators = filteredCoordinators.filter(u => {
        const shift = (u.shift || "").toLowerCase();

        // If filtering for "both", only show coordinators with both shifts
        if (shiftFilter === "both") {
          return shift === "both";
        }

        // For morning/afternoon, show single shift coordinators and those with both shifts
        return shift === shiftFilter.toLowerCase() || shift === "both";
      });
    }
    // For "all", we keep all coordinators

    // Apply level filter — match if the coordinator is assigned the selected level
    if (levelFilter !== "all") {
      filteredCoordinators = filteredCoordinators.filter(u =>
        (u.level || "").split(',').map(s => s.trim().toLowerCase()).includes(levelFilter.toLowerCase())
      )
    }

    return filteredCoordinators
  }, [search, shiftFilter, levelFilter, coordinators])

  // Unique level options derived from the loaded coordinators
  const levelOptions = useMemo(() => {
    const set = new Set<string>()
    coordinators.forEach(u => {
      (u.level || '').split(',').map(s => s.trim()).forEach(l => {
        const low = l.toLowerCase()
        if (l && low !== 'not assigned' && low !== 'unknown') set.add(l)
      })
    })
    return Array.from(set).sort()
  }, [coordinators])

  const [currentOrdering, setCurrentOrdering] = useState('joining_date')

  const handleQuickFilter = (type: string, value?: string) => {
    switch (type) {
      case 'all':
        setSearch("");
        setShiftFilter("all");
        setLevelFilter("all");
        break;
      case 'alphabetical':
        const isCurrentlyAsc = currentOrdering === 'alphabetical-asc'
        const newOrdering = isCurrentlyAsc ? 'alphabetical-desc' : 'alphabetical-asc'
        setCurrentOrdering(newOrdering)
        setCoordinators(prev => [...prev].sort((a, b) => 
          newOrdering === 'alphabetical-asc' 
            ? (a.first_name || "").localeCompare(b.first_name || "")
            : (b.first_name || "").localeCompare(a.first_name || "")
        ));
        break;
      case 'recent':
        setCurrentOrdering('joining_date')
        setCoordinators(prev => [...prev].sort((a, b) => 
          new Date(b.joining_date || 0).getTime() - new Date(a.joining_date || 0).getTime()
        ));
        break;
    }
  };

  const handleClearFiltersClick = () => {
    setIsClearing(true)
    setSearch("")
    setShiftFilter("all")
    setLevelFilter("all")
    setTimeout(() => setIsClearing(false), 700)
  }

  // Open the shared edit dialog — the CoordinatorEditForm component fetches the
  // full record + campus-scoped levels itself, so we only gate + select here.
  const handleEdit = (coordinator: CoordinatorUser) => {
    if (!perms.canEditCoordinator) {
      toast.error("You are not allowed to edit this information. Please contact your principal or administrator.");
      return;
    }
    setEditingCoordinator(coordinator)
    setShowEditDialog(true)
  }

  // Define columns for DataTable
  const columns = [
    {
      key: 'name',
      label: 'Coordinator',
      icon: <User className="w-4 h-4" />,
      render: (row: any) => (
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            {row.photo ? (
              <img
                src={row.photo}
                alt={row.name}
                className="h-9 w-9 rounded-full object-cover border-2 border-[#a3cef1]/40"
                onError={(e) => {
                  const t = e.currentTarget as HTMLImageElement;
                  t.style.display = 'none';
                  const fb = t.nextElementSibling as HTMLElement;
                  if (fb) fb.style.display = 'flex';
                }}
              />
            ) : null}
            <div
              className="h-9 w-9 rounded-full flex items-center justify-center bg-[#6096ba]"
              style={{ display: row.photo ? 'none' : 'flex' }}
            >
              <User className="h-5 w-5 text-white" />
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900 truncate">{row.name}</div>
            <div className="text-xs text-gray-500 truncate">{row.employee_id && row.employee_id !== '—' ? row.employee_id : row.email}</div>
          </div>
        </div>
      )
    },
    ...(userRole === 'org_admin' ? [{
      key: 'campus_name',
      label: 'Campus',
      icon: <MapPin className="w-4 h-4" />,
      render: (row: any) => (
        <span className="text-sm font-medium text-gray-900">{row.campus_name || '—'}</span>
      )
    }] : []),
    {
      key: 'level',
      label: 'Level',
      icon: <Award className="w-4 h-4" />,
      render: (row: any) => {
        const lvl = (row.level || '').toString();
        if (!lvl || lvl === '—' || lvl.toLowerCase() === 'not assigned' || lvl.toLowerCase() === 'unknown') {
          return <span className="text-xs text-gray-400 italic">Not Assigned</span>;
        }
        return (
          <div className="flex flex-wrap gap-1 max-w-[220px]">
            {lvl.split(',').map((l: string) => l.trim()).filter(Boolean).map((l: string) => (
              <span key={l} className="text-[11px] font-medium bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md">{l}</span>
            ))}
          </div>
        );
      }
    },
    {
      key: 'shift',
      label: 'Shift',
      icon: <Clock className="w-4 h-4" />,
      render: (row: any) => row.shift
        ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md">
            <Clock className="h-3 w-3" />{row.shift}
          </span>
        )
        : <span className="text-xs text-gray-400">—</span>
    },
    {
      key: 'status',
      label: 'Status',
      icon: <div className="h-3 w-3 rounded-full bg-green-500" />,
      render: (row: any) => (
        <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full ${row.is_active ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
          <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${row.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
          {row.is_active ? 'Active' : 'Inactive'}
        </span>
      )
    }
  ]

  if (!perms.canViewCoordinators && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-4 text-center">
        <div className="bg-red-50 p-8 rounded-3xl border border-red-100 max-w-md shadow-sm">
          <Award className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">
            You do not have permission to view the coordinators list. Please contact your administrator if you believe this is an error.
          </p>
          <Button 
            onClick={() => router.push('/admin/dashboard')}
            className="w-full bg-[#274c77] text-white hover:bg-[#1e3a5f]"
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div className="flex flex-row items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1" style={{ color: '#274c77' }}>Coordinator List</h1>
          <p className="text-gray-600 text-sm sm:text-base">
            {userRole === 'principal' && userCampus
              ? `Coordinators from ${userCampus} campus`
              : 'All coordinators across campuses'}
          </p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-2 sm:gap-3">
          {!loading && (
            <Badge style={{ backgroundColor: '#6096ba', color: 'white' }} className="hidden sm:inline-flex px-3 py-1">
              {filtered.length} Coordinators
            </Badge>
          )}
          {(userRole === 'principal' || perms.canAddCoordinator) && (
            <Button
              onClick={() => router.push('/admin/coordinator/add')}
              className="flex items-center gap-2 font-semibold shadow-sm hover:shadow-md transition-all duration-200 whitespace-nowrap"
              style={{ backgroundColor: '#274c77', color: 'white' }}
            >
              <Plus className="h-4 w-4" /> <span className="hidden xs:inline">Add Coordinator</span><span className="xs:hidden">Add</span>
            </Button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2.5 sm:p-3 md:p-4 w-full overflow-x-hidden">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative w-full sm:flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder={userRole === 'principal' && userCampus ? `Search coordinators from ${userCampus}...` : 'Search by name or email...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2F6B8A]/20 focus:border-[#2F6B8A] transition-colors"
            />
          </div>

          {/* Shift */}
          <div className="relative flex-1 sm:flex-none">
            <select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
              className="appearance-none w-full sm:w-auto h-9 pl-3 pr-8 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#2F6B8A]/20 cursor-pointer"
            >
              <option value="all">All Shifts</option>
              {(() => {
                if (userRole === 'principal' && userCampus) {
                  const principalCampus = allCampusesData.find(c => (c.campus_name || c.name) === userCampus);
                  const shiftAvail = principalCampus?.shift_available || 'both';
                  if (shiftAvail === 'morning') return <option value="morning">Morning</option>;
                  if (shiftAvail === 'afternoon') return <option value="afternoon">Afternoon</option>;
                }
                return (
                  <>
                    <option value="morning">Morning</option>
                    <option value="afternoon">Afternoon</option>
                    <option value="both">Both</option>
                  </>
                );
              })()}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Level */}
          <div className="relative flex-1 sm:flex-none">
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="appearance-none w-full sm:w-auto h-9 pl-3 pr-8 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#2F6B8A]/20 cursor-pointer"
            >
              <option value="all">Level</option>
              {levelOptions.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>

          <div className="flex items-center gap-2 sm:ml-auto">
            <button
              onClick={handleClearFiltersClick}
              className="inline-flex items-center gap-1.5 h-9 px-3 text-sm font-semibold text-white bg-[#6096ba] hover:bg-[#274c77] rounded-lg transition-colors"
            >
              <RefreshCcw className={`h-4 w-4 transition-transform duration-500 ${isClearing ? 'rotate-[360deg]' : 'rotate-0'}`} />
              <span>Clear</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active filter chips */}
      {(search || shiftFilter !== 'all' || levelFilter !== 'all') && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Filters:</span>
          {search && (
            <span className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full text-xs font-semibold bg-[#2F6B8A]/10 text-[#274c77] border border-[#2F6B8A]/20">
              &quot;{search}&quot;
              <button onClick={() => setSearch('')} className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-[#2F6B8A]/25 transition-colors"><span className="text-sm leading-none">×</span></button>
            </span>
          )}
          {shiftFilter !== 'all' && (
            <span className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full text-xs font-semibold bg-[#2F6B8A]/10 text-[#274c77] border border-[#2F6B8A]/20">
              {shiftFilter.charAt(0).toUpperCase() + shiftFilter.slice(1)}
              <button onClick={() => setShiftFilter('all')} className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-[#2F6B8A]/25 transition-colors"><span className="text-sm leading-none">×</span></button>
            </span>
          )}
          {levelFilter !== 'all' && (
            <span className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full text-xs font-semibold bg-[#2F6B8A]/10 text-[#274c77] border border-[#2F6B8A]/20">
              {levelFilter}
              <button onClick={() => setLevelFilter('all')} className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-[#2F6B8A]/25 transition-colors"><span className="text-sm leading-none">×</span></button>
            </span>
          )}
          <button onClick={handleClearFiltersClick} className="text-[11px] font-semibold text-gray-400 hover:text-rose-500 underline underline-offset-2 ml-1 transition-colors">Clear all</button>
        </div>
      )}

      {/* Quick Filters (sort) */}
      <ListFilters onFilterChange={handleQuickFilter} showGender={false} />

      <DataTable
              data={filtered.map(u => ({
                id: u.id,
                name: (`${u.first_name || ''} ${u.last_name || ''}`).trim() || u.username,
                email: u.email || '',
                employee_id: u.employee_code || '—',
                campus_name: u.campus_name || '—',
                level: u.level || '—',
                shift: u.shift || '',
                joining_date: u.joining_date || '—',
                is_active: u.is_active,
                photo: u.photo || null,
              }))}
              columns={columns}
              onView={(coordinator) => router.push(`/admin/coordinator/profile/${coordinator.id}`)}
              onEdit={(coordinator) => handleEdit(filtered.find(u => u.id === coordinator.id)!)}
              onDelete={async (coordinator) => {
                if (!perms.canDeleteCoordinator) {
                  toast.error("Unauthorized: You do not have permission to delete coordinator records.");
                  return;
                }
                if (!confirm('Are you sure you want to delete this coordinator?')) return;
                try {
                  const baseUrl = getApiBaseUrl();
                  const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
                  const res = await fetch(`${cleanBase}/api/coordinators/${coordinator.id}/`, {
                    method: 'DELETE',
                    headers: {
                      'Authorization': `Bearer ${localStorage.getItem('sis_access_token')}`,
                    }
                  });
                  if (res.ok || res.status === 204) {
                    toast.success('Coordinator deleted successfully.');
                    window.location.reload();
                  } else {
                    const msg = await res.text();
                    toast.error(`Failed to delete: ${res.status} ${msg}`);
                  }
                } catch (e) {
                  console.error('Delete coordinator error:', e);
                  toast.error('Error deleting coordinator');
                }
              }}
              isLoading={loading}
              emptyMessage="No coordinators found"
              allowEdit={perms.canEditCoordinator}
              allowDelete={perms.canDeleteCoordinator}
              deleteLabel="Delete Coordinator"
            />

      {/* Edit Dialog — shared reusable component (fetches full record + levels itself) */}
      <CoordinatorEditForm
        open={showEditDialog}
        coordinator={editingCoordinator}
        campuses={allCampusesData}
        onOpenChange={setShowEditDialog}
        onSaved={() => window.location.reload()}
      />
    </div>
  )
}


