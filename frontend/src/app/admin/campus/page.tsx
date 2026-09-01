"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { List, Search, Filter, GraduationCap } from "lucide-react"
import { usePermissions } from "@/lib/permissions"
import { AccessDenied } from "@/components/AccessDenied"

export default function CampusPage() {
  const { canViewCampus } = usePermissions();

  if (!canViewCampus) {
    return <AccessDenied title="Campus Restricted" message="You do not have permission to view campus management. Please contact your administrator." />
  }

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <List className="h-5 w-5" />
          Welcome to Campus Management
        </CardTitle>
        <CardDescription>
          This is the campus management section.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center py-16">
          <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4 shadow-lg">
            <GraduationCap className="h-12 w-12 text-gray-400" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Welcome!</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            This is your central hub for all campus management activities. Use the navigation to explore features and manage your institution's campus efficiently.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
