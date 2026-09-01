"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
// Use a lightweight UI type for this page
type UiStudent = {
  studentId: string;
  name: string;
  campus: string;
  grade: string;
  enrollmentDate: Date;
}
import { apiGet } from "@/lib/api"

export default function TransferPage() {
  const [students, setStudents] = useState<UiStudent[]>([]);
  const [campusOptions, setCampusOptions] = useState<string[]>([])
  const [gradeOptions, setGradeOptions] = useState<string[]>([])
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<UiStudent | null>(null);
  const [admissionDate, setAdmissionDate] = useState("");
  const [newCampus, setNewCampus] = useState("");
  const [newShift, setNewShift] = useState("");
  const [reason, setReason] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [studentsApi, campusesApi] = await Promise.all([
          apiGet<any[]>("/api/students/"),
          apiGet<any[]>("/api/campus/"),
        ])
        const mapped: UiStudent[] = (studentsApi || []).map((s: any) => ({
          studentId: String(s.gr_no || s.id || ""),
          name: s.name || "Unknown",
          campus: String((s.campus?.name ?? s.campus ?? "")).trim(),
          grade: String(s.current_grade ?? "").trim(),
          enrollmentDate: new Date(String(s.created_at ?? new Date()).split('T')[0] || new Date()),
        }))
        setStudents(mapped)
        setCampusOptions((campusesApi || []).map((c: any) => c.name).filter(Boolean))
        setGradeOptions(Array.from(new Set((studentsApi || []).map((x: any) => x.current_grade).filter(Boolean))))
      } catch {
        setStudents([])
        setCampusOptions([])
        setGradeOptions([])
      }
    }
    void load()
  }, [])

  function handleStudentSelect(student: UiStudent) {
    setSelectedStudent(student);
    setAdmissionDate(student.enrollmentDate instanceof Date ? student.enrollmentDate.toISOString().slice(0, 10) : "");
    setNewCampus("");
    setNewShift("");
    setReason("");
    setEffectiveDate("");
    setPreview(false);
    setError("");
  }

  function handleTransferSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!selectedStudent) {
      setError("Please select a student.");
      return;
    }
    if (!newCampus && !newShift) {
      setError("Select new campus or shift.");
      return;
    }
    if (!reason) {
      setError("Please enter a reason for transfer.");
      return;
    }
    if (!effectiveDate) {
      setError("Please select an effective date.");
      return;
    }
    setPreview(true);
  }

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.studentId.toLowerCase().includes(search.toLowerCase())
  );

  return (
  <div className="min-h-screen flex bg-gradient-to-br from-[#e0e7ef] to-[#f8fafc]">
      {/* Sidebar */}
  <div className="w-[340px] min-w-[320px] max-w-[360px] h-[calc(100vh-40px)] sticky top-5 left-0 bg-white shadow-2xl rounded-3xl p-6 flex flex-col border-r border-[#c7d0e0] mt-5 mb-5 z-10" style={{height:'calc(100vh - 40px)'}}>
        <h2 className="text-lg font-bold text-[#274c77] mb-2">Auto-fill student information</h2>
        <Label className="text-[#274c77] font-semibold mb-1">Student</Label>
        <Input
          placeholder="Search student..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="mb-3 bg-[#f1f5fa] border border-[#b6c6e3] rounded-lg px-3 py-2"
        />
  <div className="overflow-y-auto rounded-lg border border-[#e0e7ef] bg-[#f8fafc]" style={{ height: 'calc(100vh - 220px)' }}>
          {filteredStudents.length === 0 && (
            <div className="p-4 text-[#8b8c89] text-center">No students found.</div>
          )}
          <ul className="divide-y divide-[#e0e7ef]">
            {filteredStudents.map(s => (
              <li
                key={s.studentId}
                className={`p-3 cursor-pointer hover:bg-[#dbeafe] transition rounded ${selectedStudent?.studentId === s.studentId ? "bg-[#b6e0fe] font-bold" : ""}`}
                onClick={() => handleStudentSelect(s)}
              >
                <div className="text-[#274c77] text-base">{s.name}</div>
                <div className="text-xs text-[#8b8c89]">{s.studentId} | {s.campus}</div>
                <div className="text-xs text-[#8b8c89]">{s.grade}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Main Form */}
      <div className="flex-1 flex flex-col items-center justify-start p-10">
        <div className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl p-12 border border-[#e0e7ef] transition-all duration-300">
          <h1 className="text-3xl font-extrabold text-[#274c77] mb-2">Transfer Form</h1>
          <p className="text-[#8b8c89] mb-6">Choose transfer type and fill details</p>
          <form onSubmit={handleTransferSubmit} className="space-y-6">
            <div className="flex gap-4 mb-4">
              <Button type="button" variant="outline" className="rounded-full px-6 py-2 font-semibold bg-[#e7ecef] text-[#274c77] border-2 border-[#b6c6e3] shadow-sm">Campus Transfer</Button>
              <Button type="button" variant="outline" className="rounded-full px-6 py-2 font-semibold bg-[#f1f5fa] text-[#274c77] border-2 border-[#b6c6e3] shadow-sm">Shift Transfer</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>New Campus</Label>
                <Select value={newCampus} onValueChange={setNewCampus}>
                  <SelectTrigger className="w-full mt-1 border border-[#b6c6e3] bg-[#f8fafc]">
                    <SelectValue placeholder="Select new campus" />
                  </SelectTrigger>
                  <SelectContent>
                    {campusOptions.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>New Shift</Label>
                <Select value={newShift} onValueChange={setNewShift}>
                  <SelectTrigger className="w-full mt-1 border border-[#b6c6e3] bg-[#f8fafc]">
                    <SelectValue placeholder="Select shift" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning</SelectItem>
                    <SelectItem value="afternoon">Afternoon</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>New Student ID (preview)</Label>
              <Input value={selectedStudent ? `${selectedStudent.studentId}${newCampus ? '-' + newCampus : ''}${newShift ? '-' + newShift : ''}` : ''} disabled className="mt-1 bg-[#f1f5fa]" />
            </div>
            <div>
              <Label>Reason for Transfer</Label>
              <textarea
                className="w-full mt-1 border border-[#b6c6e3] rounded-lg px-3 py-2 bg-[#f8fafc] min-h-[60px]"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Enter reason for transfer"
                required
              />
            </div>
            <div>
              <Label>Effective Date</Label>
              <Input
                type="date"
                value={effectiveDate}
                onChange={e => setEffectiveDate(e.target.value)}
                min={admissionDate}
                className="mt-1 bg-[#f1f5fa]"
                required
              />
            </div>
            {error && <div className="text-red-600 font-semibold text-sm">{error}</div>}
            <div className="flex gap-4 mt-4">
              <Button type="submit" className="bg-[#274c77] text-white font-bold px-6 py-2 rounded-lg shadow-md">Request Transfer</Button>
              <Button type="button" variant="outline" className="border-[#b6c6e3] text-[#274c77] font-semibold px-6 py-2 rounded-lg" onClick={() => setPreview(true)}>Preview Certificate</Button>
            </div>
          </form>
          {preview && selectedStudent && (
            <div className="mt-8 border-t pt-6">
              <h2 className="text-xl font-bold text-[#274c77] mb-2">Transfer Certificate Preview</h2>
              <div className="bg-[#e7ecef] p-4 rounded-lg">
                <p><b>Student Name:</b> {selectedStudent.name}</p>
                <p><b>Student ID / GR No:</b> {selectedStudent.studentId}</p>
                <p><b>Current Campus:</b> {selectedStudent.campus}</p>
                <p><b>Current Grade/Class:</b> {selectedStudent.grade}</p>
                <p><b>Date of Admission:</b> {admissionDate}</p>
                <p><b>New Campus:</b> {newCampus || '-'}</p>
                <p><b>New Shift:</b> {newShift || '-'}</p>
                <p><b>Reason for Transfer:</b> {reason}</p>
                <p><b>Effective Date:</b> {effectiveDate}</p>
                <p className="mt-4 text-[#274c77] font-semibold">This is to certify that the above student is being transferred as per the details above.</p>
              </div>
            </div>
          )}
        </div>
  <div className="w-full max-w-3xl mt-8 bg-[#f8fafc] rounded-2xl shadow p-6 border border-[#e0e7ef]">
          <h3 className="text-lg font-bold text-[#274c77] mb-2">Transfer Requests & Approvals</h3>
          <p className="text-[#8b8c89]">Simulate approvals from campus heads below</p>
          <div className="mt-4 text-[#8b8c89]">No transfer requests yet.</div>
        </div>
      </div>
    </div>
  );
}