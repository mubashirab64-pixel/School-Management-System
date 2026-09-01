"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getPrincipalById } from "@/lib/api"
import { ArrowLeft, User, GraduationCap, Briefcase, Mail, Phone, MapPin, Calendar, Clock, Award, School, Download, Share, CheckCircle } from "lucide-react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

// Theme colors - Newton AMS Brand Colors
const themeColors = {
  primary: '#274c77',      // Dark Blue
  secondary: '#6096ba',    // Medium Blue  
  accent: '#a3cef1',       // Light Blue
  success: '#16a34a',      // Green
  warning: '#f59e0b',      // Orange
  error: '#dc2626',        // Red
  info: '#3b82f6',         // Blue
  purple: '#9333ea',       // Purple
  pink: '#ec4899',         // Pink
  gray: '#6b7280'          // Gray
}

function PrincipalProfileContent() {
  const [mounted, setMounted] = useState(false)
  const [principal, setPrincipal] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const router = useRouter()
  const params = useSearchParams()
  const principalId = params?.get("id") || ""
  
  if (!principalId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Principal Not Found</h2>
          <p className="text-gray-600 mb-4">No principal ID provided</p>
          <Button onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || !principalId) return

    const fetchPrincipalData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const principalData = await getPrincipalById(parseInt(principalId))
        if (principalData) {
          setPrincipal(principalData)
        } else {
          setError('Principal not found')
        }
      } catch (err) {
        console.error('Error fetching principal:', err)
        setError('Failed to load principal data')
      } finally {
        setLoading(false)
      }
    }

    fetchPrincipalData()
  }, [mounted, principalId])

  if (!mounted) {
    return <LoadingSpinner />
  }

  if (loading) {
    return <LoadingSpinner />
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  if (!principal) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Principal Not Found</h2>
          <p className="text-gray-600 mb-4">The requested principal could not be found</p>
          <Button onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  // Format date helper
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A'
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-gray-50">
      <div className=" mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {/* Back Button */}
        <div className="mb-4 sm:mb-6">
          <Button
            variant="ghost" 
            size="sm" 
            onClick={() => router.back()}
            className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>

        {/* Hero Header Section */}
        <div className="mb-6 sm:mb-8">
          <Card className="overflow-hidden shadow-2xl border-0">
            <div className="relative">
              {/* Background Gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#274c77] via-[#6096ba] to-[#274c77]"></div>
              <div className="absolute inset-0 bg-black/5"></div>
              
              {/* Decorative Elements */}
              <div className="absolute top-0 right-0 w-32 h-32 sm:w-48 sm:h-48 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 sm:w-36 sm:h-36 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
              
              {/* Content */}
              <div className="relative p-6 sm:p-8 lg:p-10 text-white">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div className="flex items-start md:items-center gap-4 sm:gap-6 flex-1">
                    {/* Profile Picture */}
                    <div className="relative flex-shrink-0">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 rounded-full bg-white/20 backdrop-blur-sm border-4 border-white/30 flex items-center justify-center shadow-xl">
                        <User className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 text-white" />
                      </div>
                      {/* Status Indicator */}
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white border-4 border-[#274c77] flex items-center justify-center shadow-lg">
                        <div className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full ${principal?.is_currently_active ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                      </div>
                    </div>
                    
                    {/* Principal Info */}
                    <div className="flex-1 min-w-0">
                      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 sm:mb-3 drop-shadow-lg">
                        {principal?.full_name || 'Principal Profile'}
                      </h1>
                      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                        <div className="flex items-center gap-2 text-sm sm:text-base text-white/90">
                          <Briefcase className="w-4 h-4 sm:w-5 sm:h-5" />
                          <span>Code: {principal?.employee_code || principalId || 'N/A'}</span>
                        </div>
                        <Badge className="bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm px-3 py-1">
                          {principal?.shift ? principal.shift.charAt(0).toUpperCase() + principal.shift.slice(1) : 'N/A'} Shift
                        </Badge>
                        {principal?.campus_name || principal?.campus?.campus_name ? (
                          <div className="flex items-center gap-2 text-sm sm:text-base text-white/90">
                            <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
                            <span>{principal?.campus_name || principal?.campus?.campus_name}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2 sm:gap-3">
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      <span className="hidden sm:inline">Export</span>
                    </Button>
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm"
                    >
                      <Share className="w-4 h-4 mr-2" />
                      <span className="hidden sm:inline">Share</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Principal Info Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Contact Information Card */}
          <Card className="bg-white shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-200 group">
            <CardHeader className="pb-4 bg-gradient-to-r from-blue-50 to-transparent border-b border-slate-100">
              <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-slate-800">
                <div className="p-2 rounded-lg bg-blue-100">
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                </div>
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-50/50 hover:bg-blue-50 transition-colors border border-blue-100">
                  <div className="p-2 rounded-lg bg-blue-100 flex-shrink-0">
                    <User className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm sm:text-base text-slate-800 mb-1">{principal?.full_name || 'N/A'}</div>
                    <div className="text-xs sm:text-sm text-slate-600">Full Name</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-50/50 hover:bg-blue-50 transition-colors border border-blue-100">
                  <div className="p-2 rounded-lg bg-blue-100 flex-shrink-0">
                    <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm sm:text-base text-slate-800 mb-1 break-all">{principal?.email || 'N/A'}</div>
                    <div className="text-xs sm:text-sm text-slate-600">Email Address</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-50/50 hover:bg-blue-50 transition-colors border border-blue-100">
                  <div className="p-2 rounded-lg bg-blue-100 flex-shrink-0">
                    <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm sm:text-base text-slate-800 mb-1">{principal?.contact_number || 'N/A'}</div>
                    <div className="text-xs sm:text-sm text-slate-600">Contact Number</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-50/50 hover:bg-blue-50 transition-colors border border-blue-100">
                  <div className="p-2 rounded-lg bg-blue-100 flex-shrink-0">
                    <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm sm:text-base text-slate-800 mb-1">{principal?.campus_name || principal?.campus?.campus_name || 'N/A'}</div>
                    <div className="text-xs sm:text-sm text-slate-600">Campus</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-50/50 hover:bg-blue-50 transition-colors border border-blue-100">
                  <div className="p-2 rounded-lg bg-blue-100 flex-shrink-0">
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm sm:text-base text-slate-800 mb-1 capitalize">{principal?.shift || 'N/A'}</div>
                    <div className="text-xs sm:text-sm text-slate-600">Working Shift</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Employment Details Card */}
          <Card className="bg-white shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-200 group">
            <CardHeader className="pb-4 bg-gradient-to-r from-green-50 to-transparent border-b border-slate-100">
              <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-slate-800">
                <div className="p-2 rounded-lg bg-green-100">
                  <Briefcase className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                </div>
                Employment Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-green-50/50 hover:bg-green-50 transition-colors border border-green-100">
                  <div className="p-2 rounded-lg bg-green-100 flex-shrink-0">
                    <Briefcase className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm sm:text-base text-slate-800 mb-1">{principal?.employee_code || 'N/A'}</div>
                    <div className="text-xs sm:text-sm text-slate-600">Employee Code</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-green-50/50 hover:bg-green-50 transition-colors border border-green-100">
                  <div className="p-2 rounded-lg bg-green-100 flex-shrink-0">
                    <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm sm:text-base text-slate-800 mb-1">{formatDate(principal?.joining_date)}</div>
                    <div className="text-xs sm:text-sm text-slate-600">Joining Date</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-green-50/50 hover:bg-green-50 transition-colors border border-green-100">
                  <div className="p-2 rounded-lg bg-green-100 flex-shrink-0">
                    <Award className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm sm:text-base text-slate-800 mb-1">{principal?.total_experience_years || 0} Years</div>
                    <div className="text-xs sm:text-sm text-slate-600">Total Experience</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-green-50/50 hover:bg-green-50 transition-colors border border-green-100">
                  <div className="p-2 rounded-lg bg-green-100 flex-shrink-0">
                    <School className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm sm:text-base text-slate-800 mb-1">{principal?.education_level || 'N/A'}</div>
                    <div className="text-xs sm:text-sm text-slate-600">Education Level</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status Card */}
          <Card className="bg-white shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-200 group">
            <CardHeader className="pb-4 bg-gradient-to-r from-purple-50 to-transparent border-b border-slate-100">
              <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-slate-800">
                <div className="p-2 rounded-lg bg-purple-100">
                  <Award className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                </div>
                Current Status
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-purple-50/50 border border-purple-100">
                  <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full ${principal?.is_currently_active ? 'bg-green-500 animate-pulse shadow-lg shadow-green-500/50' : 'bg-red-500'}`}></div>
                  <div>
                    <div className="font-bold text-base sm:text-lg text-slate-800">{principal?.is_currently_active ? 'Active' : 'Inactive'}</div>
                    <div className="text-xs sm:text-sm text-slate-600">Employment Status</div>
                  </div>
                </div>
                {principal?.is_currently_active && (
                  <div className="p-4 rounded-xl bg-green-50 border border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-sm font-semibold text-green-800">Currently Serving</span>
                    </div>
                    <p className="text-xs text-green-700">Principal is actively working at this campus</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Additional Information Card */}
        <Card className="bg-white shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-200">
          <CardHeader className="pb-4 bg-gradient-to-r from-indigo-50 to-transparent border-b border-slate-100">
            <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-slate-800">
              <div className="p-2 rounded-lg bg-indigo-100">
                <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
              </div>
              Additional Information
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-xs sm:text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">CNIC</div>
                <div className="text-sm sm:text-base font-bold text-slate-800">{principal?.cnic || 'N/A'}</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-xs sm:text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">Date of Birth</div>
                <div className="text-sm sm:text-base font-bold text-slate-800">{formatDate(principal?.dob)}</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-xs sm:text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">Gender</div>
                <div className="text-sm sm:text-base font-bold text-slate-800 capitalize">{principal?.gender || 'N/A'}</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-xs sm:text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">Year of Passing</div>
                <div className="text-sm sm:text-base font-bold text-slate-800">{principal?.year_of_passing || 'N/A'}</div>
              </div>
              <div className="sm:col-span-2 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-xs sm:text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">Institution Name</div>
                <div className="text-sm sm:text-base font-bold text-slate-800">{principal?.institution_name || 'N/A'}</div>
              </div>
              <div className="sm:col-span-2 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-xs sm:text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">Permanent Address</div>
                <div className="text-sm sm:text-base font-medium text-slate-700">{principal?.permanent_address || 'N/A'}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function PrincipalProfilePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <PrincipalProfileContent />
    </Suspense>
  )
}


