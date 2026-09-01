"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { FileText, MessageSquare, Clock, CheckCircle, AlertTriangle, Eye } from "lucide-react"

export default function RequestComplainPage() {
  useEffect(() => {
    document.title = "Requests & Complaints - Coordinator | Newton AMS";
  }, []);

  const [requests, setRequests] = useState<any[]>([])
  const [complaints, setComplaints] = useState<any[]>([])

  useEffect(() => {
    // Mock data
    const mockRequests = [
      { id: 1, teacher: "Ahmed Ali", type: "Leave Request", date: "2024-01-15", status: "Pending", priority: "Normal" },
      { id: 2, teacher: "Fatima Sheikh", type: "Material Request", date: "2024-01-14", status: "Approved", priority: "High" },
      { id: 3, teacher: "Muhammad Hassan", type: "Class Change", date: "2024-01-13", status: "Under Review", priority: "Normal" },
    ]

    const mockComplaints = [
      { id: 1, teacher: "Aisha Khan", subject: "Classroom Equipment", date: "2024-01-12", status: "Resolved", severity: "Medium" },
      { id: 2, teacher: "Ali Raza", subject: "Student Behavior", date: "2024-01-11", status: "Investigating", severity: "High" },
      { id: 3, teacher: "Sara Ahmed", subject: "Schedule Conflict", date: "2024-01-10", status: "Pending", severity: "Low" },
    ]

    setRequests(mockRequests)
    setComplaints(mockComplaints)
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved':
      case 'Resolved':
        return '#6096ba'
      case 'Pending':
        return '#8b8c89'
      case 'Under Review':
      case 'Investigating':
        return '#274c77'
      default:
        return '#8b8c89'
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#274c77' }}>Requests & Complaints</h1>
        <p className="text-gray-600">Review and manage teacher requests and complaints</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card style={{ backgroundColor: '#e7ecef', borderColor: '#a3cef1' }}>
          <CardContent className="p-4 text-center">
            <FileText className="h-8 w-8 mx-auto mb-2" style={{ color: '#274c77' }} />
            <div className="text-2xl font-bold" style={{ color: '#274c77' }}>{requests.length}</div>
            <div className="text-sm text-gray-600">Total Requests</div>
          </CardContent>
        </Card>
        <Card style={{ backgroundColor: '#a3cef1', borderColor: '#6096ba' }}>
          <CardContent className="p-4 text-center">
            <MessageSquare className="h-8 w-8 mx-auto mb-2" style={{ color: '#274c77' }} />
            <div className="text-2xl font-bold" style={{ color: '#274c77' }}>{complaints.length}</div>
            <div className="text-sm" style={{ color: '#274c77' }}>Total Complaints</div>
          </CardContent>
        </Card>
        <Card style={{ backgroundColor: '#6096ba' }}>
          <CardContent className="p-4 text-center">
            <Clock className="h-8 w-8 mx-auto mb-2 text-white" />
            <div className="text-2xl font-bold text-white">
              {requests.filter(r => r.status === 'Pending').length + complaints.filter(c => c.status === 'Pending').length}
            </div>
            <div className="text-sm text-white">Pending Items</div>
          </CardContent>
        </Card>
        <Card style={{ backgroundColor: '#274c77' }}>
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-white" />
            <div className="text-2xl font-bold text-white">
              {requests.filter(r => r.status === 'Approved').length + complaints.filter(c => c.status === 'Resolved').length}
            </div>
            <div className="text-sm text-white">Resolved</div>
          </CardContent>
        </Card>
      </div>

      {/* Requests and Complaints Tabs */}
      <Tabs defaultValue="requests" className="w-full">
        <TabsList style={{ backgroundColor: '#a3cef1' }}>
          <TabsTrigger value="requests" style={{ color: '#274c77' }} className="data-[state=active]:bg-white">
            Requests ({requests.length})
          </TabsTrigger>
          <TabsTrigger value="complaints" style={{ color: '#274c77' }} className="data-[state=active]:bg-white">
            Complaints ({complaints.length})
          </TabsTrigger>
        </TabsList>

        {/* Requests Tab */}
        <TabsContent value="requests" className="mt-6">
          <Card style={{ backgroundColor: 'white', borderColor: '#a3cef1' }}>
            <CardHeader>
              <CardTitle style={{ color: '#274c77' }} className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Teacher Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {requests.map((request) => (
                  <div key={request.id} className="p-4 rounded-lg border hover:shadow-md transition-all" style={{ backgroundColor: '#e7ecef', borderColor: '#a3cef1' }}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h3 className="font-semibold" style={{ color: '#274c77' }}>{request.type}</h3>
                          <Badge style={{ backgroundColor: getStatusColor(request.status), color: 'white' }}>
                            {request.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">By: {request.teacher} • {request.date}</p>
                        <p className="text-xs text-gray-500">Priority: {request.priority}</p>
                      </div>
                      <div className="flex space-x-2">
                        <Button size="sm" style={{ backgroundColor: '#6096ba', color: 'white' }}>
                          <Eye className="h-4 w-4 mr-1" />
                          Review
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Complaints Tab */}
        <TabsContent value="complaints" className="mt-6">
          <Card style={{ backgroundColor: 'white', borderColor: '#a3cef1' }}>
            <CardHeader>
              <CardTitle style={{ color: '#274c77' }} className="flex items-center">
                <MessageSquare className="h-5 w-5 mr-2" />
                Teacher Complaints
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {complaints.map((complaint) => (
                  <div key={complaint.id} className="p-4 rounded-lg border hover:shadow-md transition-all" style={{ backgroundColor: '#a3cef1', borderColor: '#6096ba' }}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h3 className="font-semibold" style={{ color: '#274c77' }}>{complaint.subject}</h3>
                          <Badge style={{ backgroundColor: getStatusColor(complaint.status), color: 'white' }}>
                            {complaint.status}
                          </Badge>
                        </div>
                        <p className="text-sm" style={{ color: '#274c77' }}>By: {complaint.teacher} • {complaint.date}</p>
                        <p className="text-xs" style={{ color: '#274c77' }}>Severity: {complaint.severity}</p>
                      </div>
                      <div className="flex space-x-2">
                        <Button size="sm" style={{ backgroundColor: '#274c77', color: 'white' }}>
                          <Eye className="h-4 w-4 mr-1" />
                          Investigate
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
