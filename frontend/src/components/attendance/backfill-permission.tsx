'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { 
  grantBackfillPermission, 
  getBackfillPermissions,
  getAllTeachers,
  getClassrooms
} from '@/lib/api'
import { 
  Clock, 
  Plus, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  User,
  Calendar,
  Building
} from 'lucide-react'
import { toast } from 'sonner'

interface BackfillPermission {
  id: number
  classroom_id: number
  classroom_name: string
  date: string
  reason: string
  deadline: string
  is_expired: boolean
  granted_by: string
}

interface Teacher {
  id: number
  full_name: string
  employee_code: string
}

interface Classroom {
  id: number
  name: string
  grade: {
    name: string
  }
  section: string
}

interface BackfillPermissionProps {
  userRole: 'coordinator' | 'teacher'
  levelId?: number
}

export default function BackfillPermission({ userRole, levelId }: BackfillPermissionProps) {
  const [permissions, setPermissions] = useState<BackfillPermission[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showGrantDialog, setShowGrantDialog] = useState(false)
  const [formData, setFormData] = useState({
    classroom_id: '',
    date: '',
    teacher_id: '',
    reason: '',
    deadline: ''
  })

  useEffect(() => {
    if (userRole === 'teacher') {
      fetchPermissions()
    } else if (userRole === 'coordinator') {
      fetchPermissions()
      fetchTeachers()
      fetchClassrooms()
    }
  }, [userRole, levelId])

  const fetchPermissions = async () => {
    setIsLoading(true)
    try {
      const data = await getBackfillPermissions()
      setPermissions(data as BackfillPermission[])
    } catch (error) {
      console.error('Failed to fetch backfill permissions:', error)
      toast.error('Failed to load permissions')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchTeachers = async () => {
    try {
      const data = await getAllTeachers()
      setTeachers(data)
    } catch (error) {
      console.error('Failed to fetch teachers:', error)
    }
  }

  const fetchClassrooms = async () => {
    try {
      const data = await getClassrooms(undefined, levelId)
      
      // Handle different response formats
      if (Array.isArray(data)) {
        const filtered = levelId ? data.filter((c: any) => c.grade?.level?.id === levelId) : data
        setClassrooms(filtered as Classroom[])
      } else if (data && typeof data === 'object') {
        // Check if it's a paginated response
        if ((data as any).results && Array.isArray((data as any).results)) {
          const filtered = levelId ? (data as any).results.filter((c: any) => c.grade?.level?.id === levelId) : (data as any).results
          setClassrooms(filtered as Classroom[])
        } else if ((data as any).data && Array.isArray((data as any).data)) {
          const filtered = levelId ? (data as any).data.filter((c: any) => c.grade?.level?.id === levelId) : (data as any).data
          setClassrooms(filtered as Classroom[])
        } else {
          setClassrooms([])
        }
      } else {
        setClassrooms([])
      }
    } catch (error) {
      console.error('Failed to fetch classrooms:', error)
      setClassrooms([])
    }
  }

  const handleGrantPermission = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.classroom_id || !formData.date || !formData.teacher_id || !formData.reason || !formData.deadline) {
      toast.error('Please fill in all fields')
      return
    }

    setIsLoading(true)
    try {
      await grantBackfillPermission({
        classroom_id: parseInt(formData.classroom_id),
        date: formData.date,
        teacher_id: parseInt(formData.teacher_id),
        reason: formData.reason,
        deadline: formData.deadline
      })
      toast.success('Backfill permission granted successfully')
      setFormData({
        classroom_id: '',
        date: '',
        teacher_id: '',
        reason: '',
        deadline: ''
      })
      setShowGrantDialog(false)
      fetchPermissions()
    } catch (error: any) {
      toast.error(error.message || 'Failed to grant permission')
    } finally {
      setIsLoading(false)
    }
  }

  const getPermissionStatus = (permission: BackfillPermission) => {
    if (permission.is_expired) {
      return { label: 'Expired', color: 'bg-red-100 text-red-800 border-red-200' }
    } else {
      return { label: 'Active', color: 'bg-green-100 text-green-800 border-green-200' }
    }
  }

  const isPermissionExpiringSoon = (deadline: string) => {
    const deadlineDate = new Date(deadline)
    const now = new Date()
    const hoursUntilDeadline = (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60)
    return hoursUntilDeadline <= 24 && hoursUntilDeadline > 0
  }

  return (
    <Card className="w-full h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Backfill Permissions
          </div>
          {userRole === 'coordinator' && (
            <Dialog open={showGrantDialog} onOpenChange={setShowGrantDialog}>
              <DialogTrigger asChild>
                <Button size="sm" className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Grant Permission
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Grant Backfill Permission
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleGrantPermission} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="classroom">Classroom</Label>
                    <Select
                      value={formData.classroom_id}
                      onValueChange={(value) => setFormData({ ...formData, classroom_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select classroom" />
                      </SelectTrigger>
                      <SelectContent>
                        {classrooms.map((classroom) => (
                          <SelectItem key={classroom.id} value={classroom.id.toString()}>
                            {classroom.name} - {classroom.grade?.name} {classroom.section}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="teacher">Teacher</Label>
                    <Select
                      value={formData.teacher_id}
                      onValueChange={(value) => setFormData({ ...formData, teacher_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select teacher" />
                      </SelectTrigger>
                      <SelectContent>
                        {teachers.map((teacher) => (
                          <SelectItem key={teacher.id} value={teacher.id.toString()}>
                            {teacher.full_name} ({teacher.employee_code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="reason">Reason</Label>
                    <Textarea
                      id="reason"
                      placeholder="Enter reason for backfill permission..."
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                      rows={3}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="deadline">Deadline</Label>
                    <Input
                      id="deadline"
                      type="datetime-local"
                      value={formData.deadline}
                      onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div className="flex justify-end gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setShowGrantDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? 'Granting...' : 'Grant Permission'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : permissions.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No backfill permissions found</p>
            {userRole === 'teacher' && (
              <p className="text-xs">Contact your coordinator for backfill permissions</p>
            )}
          </div>
        ) : (
          <div className="space-y-3 h-full flex flex-col">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-2">
              <div className="text-center p-2 bg-green-50 rounded-lg">
                <div className="text-lg font-bold text-green-600">
                  {permissions.filter(p => !p.is_expired).length}
                </div>
                <div className="text-xs text-green-600">Active</div>
              </div>
              <div className="text-center p-2 bg-red-50 rounded-lg">
                <div className="text-lg font-bold text-red-600">
                  {permissions.filter(p => p.is_expired).length}
                </div>
                <div className="text-xs text-red-600">Expired</div>
              </div>
            </div>

            {/* Permissions Table */}
            <div className="flex-1 overflow-auto">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Classroom</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Status</TableHead>
                  {userRole === 'teacher' && <TableHead>Granted By</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {permissions
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((permission) => {
                    const status = getPermissionStatus(permission)
                    const isExpiringSoon = isPermissionExpiringSoon(permission.deadline)
                    
                    return (
                      <TableRow key={permission.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Building className="w-4 h-4 text-gray-500" />
                            {permission.classroom_name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-500" />
                            {new Date(permission.date).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {permission.reason}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-gray-500" />
                            <span className={isExpiringSoon ? 'text-orange-600 font-medium' : ''}>
                              {new Date(permission.deadline).toLocaleString()}
                            </span>
                            {isExpiringSoon && (
                              <AlertTriangle className="w-4 h-4 text-orange-500" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={status.color}>
                            {status.label}
                          </Badge>
                        </TableCell>
                        {userRole === 'teacher' && (
                          <TableCell className="text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4" />
                              {permission.granted_by}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
              </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
