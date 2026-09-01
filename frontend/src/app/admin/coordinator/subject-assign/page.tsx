"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import {
  BookOpen,
  Plus,
  Edit,
  Trash2,
  Search,
  Loader2,
  AlertCircle
} from "lucide-react"
import {
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  getCurrentUserProfile,
  findCoordinatorByEmployeeCode
} from "@/lib/api"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Subject {
  id: number;
  name: string;
  code: string;
  description: string;
  campus: number;
  level: {
    id: number;
    name: string;
  } | null;
  is_active: boolean;
}

interface CoordinatorLevel {
  id: number;
  name: string;
}

export default function SubjectPoolPage() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [coordinatorInfo, setCoordinatorInfo] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeLevelTab, setActiveLevelTab] = useState<string>("all")

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    level: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch Data
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // 1. Get campus ID directly from localStorage user object (most reliable)
      const userStr = localStorage.getItem("sis_user")
      if (!userStr) throw new Error("Session expired")
      const user = JSON.parse(userStr)

      // Extract campus ID from user object directly
      let campusId: number | undefined = undefined
      if (user.campus && typeof user.campus === 'object' && user.campus.id) {
        campusId = user.campus.id
      } else if (typeof user.campus === 'number') {
        campusId = user.campus
      }

      // 2. Try to get full coordinator info for level tabs (best effort, not required)
      try {
        const coord = await findCoordinatorByEmployeeCode(user.username)
        if (coord) {
          setCoordinatorInfo(coord)
          // Use coordinator's campus if user campus not found
          if (!campusId) {
            campusId = typeof coord.campus === 'object' && coord.campus !== null
              ? coord.campus.id
              : coord.campus
          }
        } else {
          // Fallback: set minimal coordinator info from user object
          setCoordinatorInfo({ campus: user.campus, assigned_levels: [], level: user.level })
        }
      } catch {
        // Non-fatal: coordinator profile fetch failed, continue with what we have
        setCoordinatorInfo({ campus: user.campus, assigned_levels: [], level: user.level })
      }

      // 3. Fetch subjects — if no campusId, backend will auto-filter by coordinator_profile
      const subjectsData = await getSubjects(campusId ? { campus: campusId } : undefined)
      setSubjects(subjectsData)

    } catch (err: any) {
      console.error("Error fetching data:", err)
      setError(err.message || "Failed to load subjects")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    document.title = "Subject Pool Management - Coordinator | Newton AMS"
    fetchData()
  }, [fetchData])

  // Get unique levels from coordinator info
  const coordinatorLevels: CoordinatorLevel[] = (() => {
    if (!coordinatorInfo) return []
    const levels: CoordinatorLevel[] = []

    // 1. Try assigned_levels_details (full objects from our backend)
    if (Array.isArray(coordinatorInfo.assigned_levels_details)) {
      coordinatorInfo.assigned_levels_details.forEach((l: any) => {
        if (l && l.id) levels.push({ id: l.id, name: l.name || `Level ${l.id}` })
      })
    }
    // 2. Fallback to assigned_levels (might be IDs or objects)
    else if (Array.isArray(coordinatorInfo.assigned_levels)) {
      coordinatorInfo.assigned_levels.forEach((l: any) => {
        if (typeof l === 'object' && l !== null && l.id) {
          levels.push({ id: l.id, name: l.name || `Level ${l.id}` })
        } else if (typeof l === 'number' || typeof l === 'string') {
          levels.push({ id: Number(l), name: `Level ${l}` })
        }
      })
    }

    // 3. Add primary level if not in assigned_levels
    if (coordinatorInfo.level) {
      const primaryLevel = typeof coordinatorInfo.level === 'object'
        ? coordinatorInfo.level
        : { id: coordinatorInfo.level, name: coordinatorInfo.level_name || `Level ${coordinatorInfo.level}` };

      if (primaryLevel && primaryLevel.id) {
        levels.push({ id: primaryLevel.id, name: primaryLevel.name })
      }
    }

    // De-duplicate by ID
    const unique = Array.from(new Map(
      levels
        .filter(l => l && l.id !== undefined && l.id !== null)
        .map(l => [l.id, l])
    ).values())

    return unique
  })()

  // Filter subjects
  const filteredSubjects = subjects.filter(sub => {
    const matchesSearch = sub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sub.code && sub.code.toLowerCase().includes(searchQuery.toLowerCase()))

    // Only show subjects that belong to one of the coordinator's assigned levels
    const isLevelAssigned = coordinatorLevels.some(lvl => lvl.id === sub.level?.id)
    if (!isLevelAssigned) return false

    const matchesLevel = activeLevelTab === "all" ||
      (sub.level?.id?.toString() === activeLevelTab)

    return matchesSearch && matchesLevel
  })

  // Handlers
  const handleOpenAddModal = () => {
    setEditingSubject(null)
    setFormData({ name: "", level: "" })
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (subject: Subject) => {
    setEditingSubject(subject)
    setFormData({
      name: subject.name,
      level: subject.level?.id?.toString() || "",
    })
    setIsModalOpen(true)
  }

  const [suggestions, setSuggestions] = useState([
    "English", "Mathematics", "Urdu", "Science", "Social Studies", 
    "Islamiat", "Geography", "History", "Computer Science", "Art", 
    "Physics", "Chemistry", "Biology", "Economics", "Accounting", 
    "Business Studies", "General Knowledge", "Robotics", "Arabic"
  ]);

  const handleSubmit = async (e?: React.FormEvent, isQuickAdd: boolean = false) => {
    if (e) e.preventDefault()
    if (!formData.name) {
      toast.error("Subject name is required")
      return
    }

    // NEW LOGIC: Plus icon only adds to suggestions list, not DB
    if (isQuickAdd) {
      if (!suggestions.includes(formData.name)) {
        setSuggestions(prev => [...prev, formData.name]);
      }
      setFormData({ ...formData, name: "" });
      toast.success("Added to Quick Pick", { description: "This subject name is now in your suggestions list." });
      return;
    }

    // Level is now required
    if (!formData.level || formData.level === "none") {
      toast.error("Please select a level for this subject")
      return
    }

    setIsSubmitting(true)
    try {
      // Robust Campus ID extraction
      let campusId: number | null = null;
      
      // 1. Check Coordinator Info state
      if (coordinatorInfo?.campus) {
        campusId = typeof coordinatorInfo.campus === 'object' ? coordinatorInfo.campus.id : coordinatorInfo.campus;
      }
      
      // 2. Fallback to Local Storage (Most reliable for current user)
      if (!campusId) {
        const userStr = localStorage.getItem("sis_user");
        if (userStr) {
          const user = JSON.parse(userStr);
          if (user.campus) {
            campusId = typeof user.campus === 'object' ? user.campus.id : user.campus;
          }
        }
      }

      if (!campusId) {
        throw new Error("Campus information not found. Please refresh and try again.");
      }

      const levelId = parseInt(formData.level);
      if (!levelId || isNaN(levelId)) {
        throw new Error("Invalid level selected.");
      }

      const payload = {
        name: formData.name,
        campus: Number(campusId),
        level: levelId,
      }

      if (editingSubject) {
        await updateSubject(editingSubject.id, payload)
        toast.success("Subject updated successfully")
      } else {
        await createSubject(payload)
        toast.success("Subject created successfully")
      }

      setIsModalOpen(false)
      fetchData()
    } catch (err: any) {
      console.error('Failed to create subject:', err)
      let msg = err.message || "Operation failed";
      try {
        const parsed = JSON.parse(msg);
        if (parsed.non_field_errors) {
          const rawErr = parsed.non_field_errors.join(' ');
          // Simplify common Django unique constraint errors
          if (rawErr.toLowerCase().includes('unique') || rawErr.toLowerCase().includes('already exists') || rawErr.toLowerCase().includes('unique set')) {
            msg = `"${formData.name}" already exists in this campus. Please use a different name.`;
          } else {
            msg = rawErr;
          }
        } else if (parsed.name) {
          msg = `Name: ${parsed.name.join(', ')}`;
        } else if (typeof parsed === 'object') {
          msg = Object.values(parsed).flat().join(', ');
        }
      } catch {
        // Not JSON — check raw string for known patterns
        if (msg.toLowerCase().includes('unique set') || msg.toLowerCase().includes('unique') || msg.toLowerCase().includes('already exists')) {
          msg = `"${formData.name}" already exists in this campus. Please use a different name.`;
        }
      }
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this subject?")) return

    try {
      await deleteSubject(id)
      toast.success("Subject deleted")
      fetchData()
    } catch (err: any) {
      toast.error(err.message || "Delete failed")
    }
  }

  if (loading && subjects.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 px-2 md:px-4 lg:px-4 max-w-[1600px] mx-auto min-h-[calc(100vh-100px)]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900" style={{ color: '#274c77' }}>Subject Pool Management</h1>
          <p className="text-slate-500 mt-1">Define and manage standardized subjects for your campus levels.</p>
        </div>
        <Button
          onClick={handleOpenAddModal}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Subject
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50 text-red-800">
          <CardContent className="p-4 flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
            <Button variant="ghost" size="sm" onClick={fetchData} className="ml-auto">Retry</Button>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Card className="border-slate-200 shadow-sm overflow-hidden min-h-[750px] flex flex-col">
        <CardHeader className="bg-slate-50 border-b border-slate-200 p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search subjects or codes..."
                className="pl-9 h-10 border-slate-300 focus:ring-blue-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Tabs
              value={activeLevelTab}
              onValueChange={setActiveLevelTab}
              className="w-full md:w-auto overflow-x-auto"
            >
              <TabsList className="bg-slate-200/50 p-1">
                <TabsTrigger value="all" className="text-xs sm:text-sm">All Levels</TabsTrigger>
                {coordinatorLevels.map(lvl => (
                  <TabsTrigger key={lvl.id} value={lvl.id.toString()} className="text-xs sm:text-sm">
                    {lvl.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>

        <CardContent className="p-0 flex-1 flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px] font-bold tracking-wider">
                  <th className="text-left pl-10 pr-4 py-4">Subject Name</th>
                  <th className="text-left px-4 py-4">Code</th>
                  <th className="text-left px-4 py-4">Assigned Level</th>
                  <th className="text-left px-4 py-4">Status</th>
                  <th className="text-right pl-4 pr-10 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSubjects.length > 0 ? (
                  filteredSubjects.map((subject) => (
                    <tr key={subject.id} className="hover:bg-slate-50 transition-colors">
                      <td className="pl-10 pr-4 py-3 font-semibold text-slate-900 flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                          <BookOpen className="h-4 w-4" />
                        </div>
                        {subject.name}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">
                        {subject.code}
                      </td>
                      <td className="px-4 py-3">
                        {subject.level ? (
                          <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200">
                            {subject.level.name}
                          </Badge>
                        ) : (
                          <span className="text-slate-400 italic">Level Not Specified</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={subject.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600"}>
                          {subject.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="pl-4 pr-10 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={() => handleOpenEditModal(subject)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDelete(subject.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-4">
                        <div className="bg-slate-50 p-8 rounded-full">
                          <BookOpen className="h-20 w-20 text-slate-200" />
                        </div>
                        <div>
                          <p className="text-slate-500 font-semibold text-xl">No subjects found.</p>
                          <p className="text-slate-400 mt-2">Try adjusting your filters or search query.</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add / Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingSubject ? "Edit Subject" : "Add New Subject"}</DialogTitle>
            <DialogDescription>
              {editingSubject
                ? "Update the details of the existing subject."
                : "Create a new standardized subject for your campus levels."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => handleSubmit(e)} className="space-y-5 py-2">
            {/* 1. Subject Name Input with Plus */}
            <div className="space-y-2">
              <Label htmlFor="name">Subject Name <span className="text-red-500">*</span></Label>
              <div className="flex gap-2">
                <Input
                  id="name"
                  placeholder="Type subject name..."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="flex-1 h-10 shadow-sm"
                />
                {!editingSubject && (
                  <Button 
                    type="button" 
                    onClick={() => handleSubmit(undefined, true)} 
                    disabled={isSubmitting || !formData.name}
                    className="bg-blue-600 hover:bg-blue-700 text-white shrink-0 h-10 w-10 p-0 rounded-lg shadow-md transition-all active:scale-95"
                    title="Add to Suggestions"
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-5 w-5" />}
                  </Button>
                )}
              </div>
              <p className="text-[10px] text-slate-400 italic">Type a name and click [+] to add it to suggestions below.</p>
            </div>

            {/* 2. Quick Pick Suggestions */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2">
              <Label className="text-[11px] text-slate-500 uppercase font-bold flex items-center gap-2">
                <BookOpen className="h-3 w-3" /> Quick Pick Suggestions
              </Label>
              <Select onValueChange={(val) => setFormData({ ...formData, name: val })}>
                <SelectTrigger className="h-10 text-sm bg-white border-slate-200">
                  <SelectValue placeholder="Select from your list..." />
                </SelectTrigger>
                <SelectContent>
                  {suggestions.map(subj => (
                    <SelectItem key={subj} value={subj}>{subj}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 3. Level Selection */}
            <div className="space-y-2">
              <Label htmlFor="level" className="font-medium">Assign to Level <span className="text-red-500">*</span></Label>
              <Select
                value={formData.level}
                onValueChange={(val) => setFormData({ ...formData, level: val })}
                required
              >
                <SelectTrigger id="level" className="h-10 border-slate-200">
                  <SelectValue placeholder="Select Level" />
                </SelectTrigger>
                <SelectContent>
                  {coordinatorLevels.map(lvl => (
                    <SelectItem key={lvl.id} value={lvl.id.toString()}>
                      {lvl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-8 shadow-lg transition-all"
                disabled={isSubmitting || !formData.name}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  editingSubject ? "Update Subject" : "Create Subject"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
