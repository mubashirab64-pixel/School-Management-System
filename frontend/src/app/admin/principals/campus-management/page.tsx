"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Building2, GraduationCap, School, Users } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { getCurrentUserProfile } from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"
import LevelManagement from "@/components/campus-management/level-management"
import GradeManagement from "@/components/campus-management/grade-management"
import ClassroomManagement from "@/components/campus-management/classroom-management"

export default function CampusManagementPage() {
  const [activeTab, setActiveTab] = useState<'levels' | 'grades' | 'classrooms'>('levels')
  const [userProfile, setUserProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.title = "Campus Management | Newton AMS"
    
    async function fetchProfile() {
      setLoading(true)
      try {
        const profile = await getCurrentUserProfile()
        setUserProfile(profile)
      } catch (error) {
        console.error('Failed to fetch user profile:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchProfile()
  }, [])

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2" style={{ color: '#274c77' }}>
            <Building2 className="h-7 w-7 sm:h-8 sm:w-8" style={{ color: '#274c77' }} />
            Campus Management
          </h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">
            Manage your campus structure: Levels, Grades, and Classrooms
          </p>
          {loading ? (
            <Skeleton className="h-4 w-32 mt-1" />
          ) : userProfile?.campus_name && (
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Campus: <span className="font-semibold">{userProfile.campus_name}</span>
            </p>
          )}
        </div>
      </div>

      {/* Management Tabs */}
      <Card className="border border-gray-100 shadow-sm rounded-xl">
        <CardContent className="p-3 sm:p-4 md:p-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <div className="overflow-x-auto -mx-3 sm:-mx-4 md:-mx-6 pb-2">
              <TabsList className="hidden sm:grid w-full grid-cols-3 mb-3 sm:mb-4 md:mb-6 bg-gray-100 h-auto">
              <TabsTrigger 
                value="levels" 
                className="flex items-center gap-2 text-sm sm:text-base data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm"
                style={{ 
                  backgroundColor: activeTab === 'levels' ? 'white' : 'transparent',
                  color: activeTab === 'levels' ? '#274c77' : '#6B7280'
                }}
              >
                <School className="h-4 w-4" style={{ color: activeTab === 'levels' ? '#274c77' : '#6B7280' }} />
                Levels
              </TabsTrigger>
              <TabsTrigger 
                value="grades" 
                className="flex items-center gap-2 text-sm sm:text-base data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm"
                style={{ 
                  backgroundColor: activeTab === 'grades' ? 'white' : 'transparent',
                  color: activeTab === 'grades' ? '#274c77' : '#6B7280'
                }}
              >
                <GraduationCap className="h-4 w-4" style={{ color: activeTab === 'grades' ? '#274c77' : '#6B7280' }} />
                Grades
              </TabsTrigger>
              <TabsTrigger 
                value="classrooms" 
                className="flex items-center gap-2 text-sm sm:text-base data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm"
                style={{ 
                  backgroundColor: activeTab === 'classrooms' ? 'white' : 'transparent',
                  color: activeTab === 'classrooms' ? '#274c77' : '#6B7280'
                }}
              >
                <Users className="h-4 w-4" style={{ color: activeTab === 'classrooms' ? '#274c77' : '#6B7280' }} />
                Classrooms
              </TabsTrigger>
              </TabsList>
            </div>

            {/* Mobile: Dropdown instead of tabs */}
            <div className="sm:hidden mb-4">
              <Label className="sr-only">Section</Label>
              <Select value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="levels">Levels</SelectItem>
                  <SelectItem value="grades">Grades</SelectItem>
                  <SelectItem value="classrooms">Classrooms</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <TabsContent value="levels" className="mt-6">
              <LevelManagement campusId={userProfile?.campus_id} />
            </TabsContent>
            
            <TabsContent value="grades" className="mt-6">
              <GradeManagement campusId={userProfile?.campus_id} />
            </TabsContent>
            
            <TabsContent value="classrooms" className="mt-6">
              <ClassroomManagement campusId={userProfile?.campus_id} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

  