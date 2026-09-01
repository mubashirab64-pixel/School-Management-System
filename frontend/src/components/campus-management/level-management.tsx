"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Plus, Edit, Trash2, School, UserPlus } from "lucide-react"
import {
  getLevels, createLevel, updateLevel, deleteLevel, getUserCampusId,
  assignCoordinatorToLevel, getAvailableCoordinators, getGrades,
  unassignCoordinatorFromLevel
} from "@/lib/api"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"

interface LevelManagementProps {
  campusId?: number
}

// Common level suggestions
const LEVEL_SUGGESTIONS = ['Pre-Primary', 'Primary', 'Middle Secondary', 'Secondary', 'Senior Secondary'];

export default function LevelManagement({ campusId }: LevelManagementProps) {
  const [levels, setLevels] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingLevel, setEditingLevel] = useState<any>(null)
  const [formData, setFormData] = useState<{ name: string, shift: string }>({
    name: '', shift: 'morning'
  })
  const [saving, setSaving] = useState(false)
  const [allCampusGrades, setAllCampusGrades] = useState<any[]>([])
  const [loadingGrades, setLoadingGrades] = useState(false)
  const [gradeTemplates, setGradeTemplates] = useState<string[]>([])

  // Coordinator assignment state
  const [coordinatorModalOpen, setCoordinatorModalOpen] = useState(false)
  const [selectedLevel, setSelectedLevel] = useState<any>(null)
  const [availableCoordinators, setAvailableCoordinators] = useState<any[]>([])
  const [selectedCoordinatorId, setSelectedCoordinatorId] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [loadingCoordinators, setLoadingCoordinators] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const userCampusId = campusId || getUserCampusId()

  useEffect(() => {
    fetchData()
  }, [userCampusId])

  async function fetchData() {
    setLoading(true)
    try {
      const data = await getLevels(userCampusId || undefined)
      // Handle paginated response
      const levelsArray = (data as any)?.results || (Array.isArray(data) ? data : [])
      setLevels(levelsArray)

      // Get unique grade names globally for templates
      const gradesData = await getGrades()
      const allGrades = (gradesData as any)?.results || (Array.isArray(gradesData) ? gradesData : [])
      if (allGrades.length > 0) {
        const uniqueNames = Array.from(new Set(allGrades.map((g: any) => g.name))) as string[];
        // Sort them for better UX
        uniqueNames.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
        setGradeTemplates(uniqueNames)
      } else {
        // Fallback to basic set if DB is truly empty
        setGradeTemplates(['Nursery', 'KG-I', 'KG-II', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'])
      }
    } catch (error) {
      console.error('Failed to fetch levels:', error)
    } finally {
      setLoading(false)
    }
  }



  function handleCreate() {
    setEditingLevel(null)
    setFormData({ name: '', shift: 'morning' })
    setIsDialogOpen(true)
  }

  function handleEdit(level: any) {
    setEditingLevel(level)
    setFormData({
      name: level.name,
      shift: level.shift || 'morning'
    })
    setIsDialogOpen(true)
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      toast.error('Please enter a level name')
      return
    }
    if (!formData.shift) {
      toast.error('Please select a shift')
      return
    }

    if (!userCampusId && !editingLevel) {
      toast.error('Campus information not found. Please log in again.')
      return
    }

    setSaving(true)
    try {
      if (editingLevel) {
        await updateLevel(editingLevel.id, formData)
      } else {
        // Include campus field for new level
        const dataWithCampus = {
          ...formData,
          campus: userCampusId
        }
        console.log('Creating level with data:', dataWithCampus)
        console.log('User campus ID:', userCampusId)
        await createLevel(dataWithCampus)
      }

      setIsDialogOpen(false)
      fetchData()
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to save level. Please try again.'

      // Only log as error if it's not a validation error (400 status)
      if (error?.status !== 400) {
        console.error('Failed to save level:', error)
      } else {
        console.warn('Level validation:', errorMessage)
      }

      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(level: any) {
    if (!confirm(`Are you sure you want to delete ${level.name}?`)) {
      return
    }

    try {
      await deleteLevel(level.id)
      fetchData()
    } catch (error) {
      console.error('Failed to delete level:', error)
      toast.error('Failed to delete level. It may have associated grades.')
    }
  }

  async function openCoordinatorModal(level: any) {
    setSelectedLevel(level)
    setSelectedCoordinatorId('')
    setCoordinatorModalOpen(true)
    setLoadingCoordinators(true)
    setAvailableCoordinators([]) // Reset coordinators

    try {
      const coordinators = await getAvailableCoordinators(userCampusId || undefined)

      // Ensure coordinators is always an array
      if (Array.isArray(coordinators)) {
        setAvailableCoordinators(coordinators)
      } else {
        console.warn('getAvailableCoordinators returned non-array:', coordinators)
        setAvailableCoordinators([])
      }
    } catch (error) {
      console.error('Failed to fetch coordinators:', error)
      setAvailableCoordinators([]) // Set empty array on error
      toast.error('Failed to load coordinators')
    } finally {
      setLoadingCoordinators(false)
    }
  }

  async function handleCoordinatorAssignment() {
    if (!selectedCoordinatorId || !selectedLevel) return

    setAssigning(true)
    try {
      await assignCoordinatorToLevel(selectedLevel.id, parseInt(selectedCoordinatorId))
      setCoordinatorModalOpen(false)
      toast.success('Coordinator assigned successfully!')
      fetchData() // Refresh the list
    } catch (error) {
      console.error('Failed to assign coordinator:', error)
      toast.error('Failed to assign coordinator. Please try again.')
    } finally {
      setAssigning(false)
    }
  }

  async function handleUnassignCoordinator(level: any) {
    if (!confirm(`Are you sure you want to unassign ${level.coordinator_name} from ${level.name}?`)) {
      return
    }

    try {
      await unassignCoordinatorFromLevel(level.id)
      toast.success('Coordinator unassigned successfully!')
      fetchData()
    } catch (error) {
      console.error('Failed to unassign coordinator:', error)
      toast.error('Failed to unassign coordinator')
    }
  }
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="border rounded-lg p-4 space-y-4">
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4 items-center">
              <Skeleton className="h-6 w-1/4" />
              <Skeleton className="h-6 w-1/4" />
              <Skeleton className="h-6 w-1/4" />
              <Skeleton className="h-6 w-1/4" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start sm:items-center gap-3 flex-col sm:flex-row">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold" style={{ color: '#274c77' }}>Manage Levels</h2>
          <p className="text-xs sm:text-sm text-gray-600">
            Create and manage educational levels for your campus
          </p>
        </div>
        <Button
          onClick={handleCreate}
          className="w-full sm:w-auto flex items-center justify-center gap-2"
          style={{ backgroundColor: '#274b77ff', color: 'white' }}
        >
          <Plus className="h-4 w-4" />
          Create Level
        </Button>
      </div>

      {/* Mobile collapse toggle */}
      <div className="sm:hidden">
        <Button variant="outline" onClick={() => setMobileOpen(!mobileOpen)} className="w-full">
          {mobileOpen ? 'Hide List' : 'Show List'}
        </Button>
      </div>

      {levels.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <School className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No levels found for your campus</p>
          <Button onClick={handleCreate} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Level
          </Button>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className={(mobileOpen ? 'grid' : 'hidden') + ' sm:hidden grid-cols-1 gap-3'}>
            {levels.map((level) => (
              <div key={level.id} className="rounded-lg border p-4 shadow-sm bg-white">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-base font-semibold">{level.name}</div>
                    <div className="text-xs text-gray-500 capitalize">{level.shift}</div>
                  </div>
                  <span className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">{level.code}</span>
                </div>
                <div className="mt-2">
                  {level.coordinator_name ? (
                    <div className="text-xs text-gray-700 flex items-center justify-between">
                      <div>
                        Coordinator: <span className="font-medium">{level.coordinator_name}</span>
                        <span className="text-gray-500"> ({level.coordinator_code})</span>
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full"
                        onClick={() => handleUnassignCoordinator(level)}
                        title="Unassign Coordinator"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" className="mt-1" onClick={() => openCoordinatorModal(level)}>
                      <UserPlus className="h-4 w-4 mr-1" /> Assign Coordinator
                    </Button>
                  )}
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(level)} className="text-gray-700 hover:text-gray-900">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(level)} className="text-red-600 hover:text-red-800">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto -mx-4 sm:mx-0">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-50 border-b border-gray-100">
                  <TableHead className="text-gray-500 font-semibold text-xs uppercase tracking-wider">Name</TableHead>
                  <TableHead className="text-gray-500 font-semibold text-xs uppercase tracking-wider">Shift</TableHead>
                  <TableHead className="text-gray-500 font-semibold text-xs uppercase tracking-wider">Code</TableHead>
                  <TableHead className="text-gray-500 font-semibold text-xs uppercase tracking-wider">Coordinator</TableHead>
                  <TableHead className="text-right text-gray-500 font-semibold text-xs uppercase tracking-wider">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {levels.map((level) => (
                  <TableRow key={level.id}>
                    <TableCell className="font-medium">{level.name}</TableCell>
                    <TableCell className="capitalize">{level.shift}</TableCell>
                    <TableCell>
                      <span className="px-2 py-1 bg-gray-100 rounded text-xs sm:text-sm font-mono">
                        {level.code}
                      </span>
                    </TableCell>
                    <TableCell>
                      {level.coordinator_name ? (
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col">
                            <span className="text-xs sm:text-sm font-medium">{level.coordinator_name}</span>
                            <span className="text-[10px] text-gray-500">({level.coordinator_code})</span>
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 px-2 text-[10px] text-red-500 border-red-100 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all gap-1.5 font-bold"
                            onClick={() => handleUnassignCoordinator(level)}
                          >
                            Unassign
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openCoordinatorModal(level)}
                        >
                          <UserPlus className="h-4 w-4 mr-1" />
                          Assign Coordinator
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(level)}
                          className="text-gray-700 hover:text-gray-900"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(level)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingLevel ? 'Edit Level' : 'Create New Level'}
            </DialogTitle>
            <DialogDescription>
              {editingLevel
                ? 'Update the level information. Code cannot be changed.'
                : 'Enter the level name. Code will be generated automatically.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Level Name *</Label>
              <div className="space-y-2">
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Primary, Foundation, Senior Section"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="shift">Shift *</Label>
              <Select
                value={formData.shift}
                onValueChange={(value) => setFormData({ ...formData, shift: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select shift" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">Morning</SelectItem>
                  <SelectItem value="afternoon">Afternoon</SelectItem>
                </SelectContent>
              </Select>
            </div>



            {editingLevel && (
              <div className="space-y-2">
                <Label>Level Code</Label>
                <Input
                  value={editingLevel.code}
                  disabled
                  className="bg-gray-100"
                />
                <p className="text-xs text-gray-500">
                  System-generated code cannot be modified
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingLevel ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Coordinator Assignment Modal */}
      <Dialog open={coordinatorModalOpen} onOpenChange={setCoordinatorModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md md:max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Coordinator to {selectedLevel?.name}</DialogTitle>
            <DialogDescription>
              Select a coordinator to assign to this level. A coordinator can manage multiple levels.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Available Coordinators</Label>
              {loadingCoordinators ? (
                <div className="flex items-center gap-2 p-3 border rounded-md">
                  <LoadingSpinner />
                  <span className="text-sm text-gray-600">Loading coordinators...</span>
                </div>
              ) : (
                <Select value={selectedCoordinatorId} onValueChange={setSelectedCoordinatorId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a coordinator" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.isArray(availableCoordinators) && availableCoordinators.length > 0 ? (
                      availableCoordinators.map(coord => {
                        const assignedLevels = coord.assigned_levels_details || []
                        const alreadyAssigned = assignedLevels.some((l: any) => l.id === selectedLevel?.id)
                        const levelNames = assignedLevels.map((l: any) => l.name).join(', ')
                        return (
                          <SelectItem key={coord.id} value={coord.id.toString()} disabled={alreadyAssigned}>
                            {coord.full_name} ({coord.employee_code})
                            {levelNames ? ` — ${levelNames}` : ''}
                            {alreadyAssigned ? ' ✓ Already assigned' : ''}
                          </SelectItem>
                        )
                      })
                    ) : (
                      <SelectItem value="no-coordinators" disabled>
                        No coordinators found
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setCoordinatorModalOpen(false)}
              disabled={assigning}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCoordinatorAssignment}
              disabled={assigning || !selectedCoordinatorId}
              className="w-full sm:w-auto"
            >
              {assigning ? 'Assigning...' : 'Assign Coordinator'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

