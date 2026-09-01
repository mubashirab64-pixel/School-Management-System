"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { User, Crown, Users as UsersIcon, GraduationCap, Building2 } from "lucide-react"

interface UserGreetingProps {
  className?: string
}

export function UserGreeting({ className }: UserGreetingProps) {
  const [userName, setUserName] = useState<string>("")
  const [userRole, setUserRole] = useState<string>("")
  const [userCampus, setUserCampus] = useState<string>("")
  const [greeting, setGreeting] = useState<string>("Welcome")

  useEffect(() => {
    if (typeof window !== "undefined") {
      const userStr = window.localStorage.getItem("sis_user")
      if (userStr) {
        try {
          const user = JSON.parse(userStr)

          // Try to get full name first, then fallback to other fields
          let fullName = user.full_name || user.name || user.username || user.email || "User"

          // If we have first_name and last_name, combine them
          if (user.first_name && user.last_name) {
            fullName = `${user.first_name} ${user.last_name}`
          } else if (user.first_name) {
            fullName = user.first_name
          }

          setUserName(fullName.trim() || "User")

          const role = String(user.role || "").toLowerCase()
          if (role.includes("princ")) {
            setUserRole("Principal")
            setUserCampus(user.campus?.campus_name || user.campus || "")
          } else if (role.includes("coord")) {
            setUserRole("Coordinator")
          } else if (role.includes("teach")) {
            setUserRole("Teacher")
          } else if (role.includes("admin")) {
            setUserRole("Super Admin")
          } else {
            setUserRole("Admin")
          }
        } catch {
          setUserName("User")
          setUserRole("Admin")
        }
      }

      // Set time-based greeting
      const hour = new Date().getHours()
      if (hour < 12) {
        setGreeting("Good Morning")
      } else if (hour < 17) {
        setGreeting("Good Afternoon")
      }
    }
  }, [])

  const getRoleIcon = () => {
    switch (userRole) {
      case "Super Admin":
        return <Crown className="h-4 w-4" />
      case "Principal":
        return <GraduationCap className="h-4 w-4" />
      case "Coordinator":
        return <UsersIcon className="h-4 w-4" />
      case "Teacher":
        return <User className="h-4 w-4" />
      default:
        return <User className="h-4 w-4" />
    }
  }

  const getRoleBadgeColor = () => {
    switch (userRole) {
      case "Super Admin":
        return "bg-[#274C77] text-white"
      case "Principal":
        return "bg-[#6096BA] text-white"
      case "Coordinator":
        return "bg-[#10b981] text-white"
      case "Teacher":
        return "bg-[#14b8a6] text-white"
      default:
        return "bg-[#8B8C89] text-white"
    }
  }

  return (
    <Card className={`relative overflow-hidden bg-gradient-to-br from-[#163B5C] via-[#2F6B8A] to-[#5F93B3] text-white shadow-lg border-none rounded-2xl ${className}`}>
      <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-36 translate-x-36" />
      <div className="absolute bottom-0 left-0 w-56 h-56 bg-white/5 rounded-full translate-y-28 -translate-x-28" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
      <div className="relative p-5 sm:p-7">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {greeting}, {userName}!
            </h1>
            <div className="flex items-center gap-3 flex-wrap">
              {userRole && (
                <Badge className={`${getRoleBadgeColor()} flex items-center gap-1.5 px-3 py-1 text-xs font-semibold shadow-lg rounded-full`}>
                  {getRoleIcon()}
                  {userRole}
                </Badge>
              )}
              {userCampus && (
                <span className="flex items-center gap-1.5 text-sm text-white/75">
                  <Building2 className="h-3.5 w-3.5" />
                  {userCampus}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
