"use client";
import React, { useState, useEffect } from "react";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Users, CheckCircle, XCircle, AlertCircle, RefreshCw, Download, Eye, Edit3 } from "lucide-react";
import { getCurrentUserRole } from "@/lib/permissions";
import { getCurrentUserProfile, getAttendanceHistory } from "@/lib/api";
import { useRouter } from "next/navigation";

interface Student {
  id: number;
  name: string;
  student_code: string;
  gr_no?: string;
  gender: string;
  photo?: string;
}

interface ClassInfo {
  id: number;
  name: string;
  code: string;
  grade: string;
  section: string;
  shift: string;
  campus?: string;
}

interface AttendanceRecord {
  id: number;
  date: string;
  total_students: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  leave_count: number;
  attendance_percentage: number;
  is_editable: boolean;
  marked_at: string;
  marked_by: string;
  student_attendance: Array<{
    student_id: number;
    student_name: string;
    student_code: string;
    status: string;
    remarks: string;
  }>;
  edit_history: any[];
}

interface TeacherProfile {
  assigned_classroom?: {
    id: number;
    name: string;
    code: string;
    grade?: { name: string };
    section: string;
    shift: string;
    campus?: { campus_name: string };
  };
}

export default function AttendanceHistoryPage() {
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDateRange, setSelectedDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const router = useRouter();

  const userRole = getCurrentUserRole();

  useEffect(() => {
    if (userRole === 'teacher') {
      document.title = "Attendance History | Newton AMS";
      fetchTeacherData();
    }
  }, [userRole]);

  useEffect(() => {
    if (classInfo) {
      fetchAttendanceHistory();
    }
  }, [classInfo, selectedDateRange]);

  const fetchTeacherData = async () => {
    try {
      setLoading(true);
      setError("");
      
      const teacherProfile = await getCurrentUserProfile() as TeacherProfile;
      
      if (!teacherProfile) {
        setError("Failed to load user profile. Please login again.");
        setTimeout(() => {
          router.push('/login');
        }, 2000);
        return;
      }
      
      if (!teacherProfile.assigned_classroom) {
        setError("No classroom assigned to you. Please contact administrator.");
        return;
      }

      setClassInfo({
        id: teacherProfile.assigned_classroom.id,
        name: teacherProfile.assigned_classroom.name || "Unknown Class",
        code: teacherProfile.assigned_classroom.code || "",
        grade: teacherProfile.assigned_classroom.grade?.name || "",
        section: teacherProfile.assigned_classroom.section || "",
        shift: teacherProfile.assigned_classroom.shift || "",
        campus: teacherProfile.assigned_classroom.campus?.campus_name || ""
      });

    } catch (err: unknown) {
      console.error('Error fetching teacher data:', err);
      setError("Failed to load class data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceHistory = async () => {
    if (!classInfo) return;

    try {
      setLoading(true);
      const history = await getAttendanceHistory(
        classInfo.id, 
        selectedDateRange.start, 
        selectedDateRange.end
      ) as AttendanceRecord[];
      
      setAttendanceHistory(history);
    } catch (err: unknown) {
      console.error('Error fetching attendance history:', err);
      setError("Failed to load attendance history. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDateRangeChange = (field: 'start' | 'end', value: string) => {
    setSelectedDateRange(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const viewDetails = (record: AttendanceRecord) => {
    setSelectedRecord(record);
    setShowDetails(true);
  };

  const exportToCSV = () => {
    if (attendanceHistory.length === 0) return;

    const headers = ['Date', 'Total Students', 'Present', 'Absent', 'Late', 'Leave', 'Percentage', 'Marked By', 'Marked At'];
    const csvContent = [
      headers.join(','),
      ...attendanceHistory.map(record => [
        record.date,
        record.total_students,
        record.present_count,
        record.absent_count,
        record.late_count,
        record.leave_count,
        record.attendance_percentage,
        record.marked_by,
        record.marked_at
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_history_${classInfo?.name}_${selectedDateRange.start}_to_${selectedDateRange.end}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-800 border-green-300';
      case 'absent': return 'bg-red-100 text-red-800 border-red-300';
      case 'late': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'leave': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present': return <CheckCircle className="h-4 w-4" />;
      case 'absent': return <XCircle className="h-4 w-4" />;
      case 'late': return <Clock className="h-4 w-4" />;
      case 'leave': return <Calendar className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto mt-12 p-10 bg-[#e7ecef] rounded-2xl shadow-2xl border-2 border-[#a3cef1]">
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-6 w-6 animate-spin text-[#6096ba]" />
            <span className="text-[#274c77] font-medium">Loading attendance history...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto mt-12 p-10 bg-[#e7ecef] rounded-2xl shadow-2xl border-2 border-[#a3cef1]">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-[#274c77] mb-2">Error</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={fetchTeacherData} className="bg-[#6096ba] hover:bg-[#274c77] text-white">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto mt-8 p-6 space-y-6">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-[#274c77] to-[#6096ba] rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Attendance History</h1>
            <div className="flex items-center space-x-4 text-lg">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>{classInfo?.name} - {classInfo?.section}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Calendar className="h-5 w-5" />
                <span>{attendanceHistory.length} records found</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              onClick={exportToCSV}
              className="bg-white/20 hover:bg-white/30 text-white border border-white/30"
              disabled={attendanceHistory.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Date Range Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[#274c77]">Filter by Date Range</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium">From:</label>
              <input
                type="date"
                value={selectedDateRange.start}
                onChange={(e) => handleDateRangeChange('start', e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6096ba]"
              />
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium">To:</label>
              <input
                type="date"
                value={selectedDateRange.end}
                onChange={(e) => handleDateRangeChange('end', e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6096ba]"
              />
            </div>
            <Button 
              onClick={fetchAttendanceHistory}
              className="bg-[#6096ba] hover:bg-[#274c77] text-white"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Attendance History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[#274c77]">Attendance Records</CardTitle>
        </CardHeader>
        <CardContent>
          {attendanceHistory.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">No attendance records found</p>
              <p className="text-gray-500 text-sm">Try adjusting the date range or mark some attendance first</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Present</TableHead>
                    <TableHead>Absent</TableHead>
                    <TableHead>Late</TableHead>
                    <TableHead>Leave</TableHead>
                    <TableHead>Percentage</TableHead>
                    <TableHead>Marked By</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceHistory.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {new Date(record.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{record.total_students}</TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-800 border-green-300">
                          {record.present_count}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-red-100 text-red-800 border-red-300">
                          {record.absent_count}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                          {record.late_count}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                          {record.leave_count}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          className={`${
                            record.attendance_percentage >= 80 
                              ? 'bg-green-100 text-green-800 border-green-300'
                              : record.attendance_percentage >= 60
                              ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                              : 'bg-red-100 text-red-800 border-red-300'
                          }`}
                        >
                          {record.attendance_percentage}%
                        </Badge>
                      </TableCell>
                      <TableCell>{record.marked_by}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => viewDetails(record)}
                            className="border-[#6096ba] text-[#6096ba] hover:bg-[#6096ba] hover:text-white"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                          {record.is_editable && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                // Navigate to edit page with date parameter
                                router.push(`/admin/teachers/attendance?date=${record.date}&edit=true`);
                              }}
                              className="border-yellow-500 text-yellow-500 hover:bg-yellow-50"
                            >
                              <Edit3 className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Modal */}
      {showDetails && selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-[#274c77]">
                Attendance Details - {new Date(selectedRecord.date).toLocaleDateString()}
              </h2>
              <Button
                variant="outline"
                onClick={() => setShowDetails(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </Button>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-4 text-center">
                  <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-green-600">{selectedRecord.present_count}</p>
                  <p className="text-sm text-green-600">Present</p>
                </CardContent>
              </Card>
              <Card className="bg-red-50 border-red-200">
                <CardContent className="p-4 text-center">
                  <XCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-red-600">{selectedRecord.absent_count}</p>
                  <p className="text-sm text-red-600">Absent</p>
                </CardContent>
              </Card>
              <Card className="bg-yellow-50 border-yellow-200">
                <CardContent className="p-4 text-center">
                  <Clock className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-yellow-600">{selectedRecord.late_count}</p>
                  <p className="text-sm text-yellow-600">Late</p>
                </CardContent>
              </Card>
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4 text-center">
                  <Calendar className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-blue-600">{selectedRecord.leave_count}</p>
                  <p className="text-sm text-blue-600">Leave</p>
                </CardContent>
              </Card>
            </div>

            {/* Student Details */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedRecord.student_attendance.map((student) => (
                    <TableRow key={student.student_id}>
                      <TableCell className="font-medium">{student.student_name}</TableCell>
                      <TableCell>{student.student_code}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(student.status)}>
                          <div className="flex items-center space-x-1">
                            {getStatusIcon(student.status)}
                            <span className="capitalize">{student.status}</span>
                          </div>
                        </Badge>
                      </TableCell>
                      <TableCell>{student.remarks || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Edit History */}
            {selectedRecord.edit_history && selectedRecord.edit_history.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-[#274c77] mb-3">Edit History</h3>
                <div className="space-y-2">
                  {selectedRecord.edit_history.map((edit: any, index: number) => (
                    <div key={index} className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-600">
                        <strong>{edit.action}</strong> by {edit.user} on {new Date(edit.timestamp).toLocaleString()}
                      </p>
                      {edit.reason && <p className="text-xs text-gray-500">Reason: {edit.reason}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
