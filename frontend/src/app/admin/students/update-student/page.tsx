"use client"

import { useState, useMemo, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { apiGet } from "@/lib/api"

import { useEffect } from "react";

function UpdateStudentContent() {
  useEffect(() => {
    document.title = "Update Student | Newton AMS";
  }, []);
  const router = useRouter()
  const params = useSearchParams()
  const studentId = params?.get("studentId") || ""

  const [student, setStudent] = useState<any | null>(null)
  const [campusOptions, setCampusOptions] = useState<string[]>([])
  const [gradeOptions, setGradeOptions] = useState<string[]>([])
  useEffect(() => {
    async function load() {
      try {
        const [students, campuses] = await Promise.all([
          apiGet<any[]>("/api/students/"),
          apiGet<any[]>("/api/campus/"),
        ])
        const s = (students || []).find((x) => String(x.id) === studentId || String(x.gr_no) === studentId) || null
        setStudent(s ? {
          studentId: String(s.gr_no || s.id || ""),
          name: s.name,
          campus: s.campus?.name || "",
          grade: s.current_grade || "",
        } : null)
        setCampusOptions((campuses || []).map((c: any) => c.name).filter(Boolean))
        setGradeOptions(Array.from(new Set((students || []).map((x) => x.current_grade).filter(Boolean))))
      } catch {
        setStudent(null)
        setCampusOptions([])
        setGradeOptions([])
      }
    }
    if (studentId) void load()
  }, [studentId])

  const [category, setCategory] = useState<"Contact" | "Academic" | "Family" | "Address" | "">("")

  // Contact fields
  const [primaryPhone, setPrimaryPhone] = useState("")
  const [secondaryPhone, setSecondaryPhone] = useState("")
  const [emergencyContact, setEmergencyContact] = useState("")

  // Academic fields
  const [selectedCampus, setSelectedCampus] = useState<string>("")
  const [selectedGrade, setSelectedGrade] = useState<string>("")
  const [shift, setShift] = useState<string>("Morning")
  const [status, setStatus] = useState<string>("Active")

  // Family fields
  const [fatherName, setFatherName] = useState("")
  const [fatherCnic, setFatherCnic] = useState("")
  const [fatherOccupation, setFatherOccupation] = useState("")
  const [fatherContact, setFatherContact] = useState("")

  // Address fields
  const [currentAddress, setCurrentAddress] = useState("")
  const [houseOwnership, setHouseOwnership] = useState("")
  const [rent, setRent] = useState("")
  const [familyIncome, setFamilyIncome] = useState("")

  if (!student) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold">Update Student</h2>
        <p className="text-muted-foreground">Student not found.</p>
        <div className="mt-4">
          <Button variant="ghost" onClick={() => router.back()}>
            Back
          </Button>
        </div>
      </div>
    )
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    // no persistence in mock environment, just go back
    router.back()
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold">Update Details for {student.name}</h2>
      <p className="text-muted-foreground">Select a category and update required fields.</p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Student Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Student ID / GR No</Label>
                <Input value={student?.studentId || ""} readOnly />
              </div>
              <div>
                <Label>Student Name</Label>
                <Input value={student?.name || ""} readOnly />
              </div>
              <div>
                <Label>Current Campus</Label>
                <Input value={student?.campus || ""} readOnly />
              </div>
              <div>
                <Label>Current Grade/Class & Section</Label>
                <Input value={student?.grade || ""} readOnly />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Update Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button variant={category === "Contact" ? undefined : "ghost"} onClick={() => setCategory("Contact")}>Contact</Button>
              <Button variant={category === "Academic" ? undefined : "ghost"} onClick={() => setCategory("Academic")}>Academic</Button>
              <Button variant={category === "Family" ? undefined : "ghost"} onClick={() => setCategory("Family")}>Family</Button>
              <Button variant={category === "Address" ? undefined : "ghost"} onClick={() => setCategory("Address")}>Address</Button>
            </div>
          </CardContent>
        </Card>

        {category === "Contact" && (
          <Card>
            <CardHeader>
              <CardTitle>Contact Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Primary Phone</Label>
                  <Input value={primaryPhone} onChange={(e) => setPrimaryPhone(e.target.value)} />
                </div>
                <div>
                  <Label>Secondary Phone</Label>
                  <Input value={secondaryPhone} onChange={(e) => setSecondaryPhone(e.target.value)} />
                </div>
                <div>
                  <Label>Emergency Contact</Label>
                  <Input value={emergencyContact} onChange={(e) => setEmergencyContact(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {category === "Academic" && (
          <Card>
            <CardHeader>
              <CardTitle>Academic Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Campus</Label>
                  <Select value={selectedCampus} onValueChange={(v) => setSelectedCampus(v)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {campusOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Grade / Class</Label>
                  <Select value={selectedGrade} onValueChange={(v) => setSelectedGrade(v)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {gradeOptions.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Shift</Label>
                  <Select value={shift} onValueChange={(v) => setShift(v)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="morning">Morning</SelectItem>
                      <SelectItem value="afternoon">Afternoon</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Not Active">Not Active</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {category === "Family" && (
          <Card>
            <CardHeader>
              <CardTitle>Family Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Father / Guardian Name</Label>
                  <Input value={fatherName} onChange={(e) => setFatherName(e.target.value)} />
                </div>
                <div>
                  <Label>CNIC</Label>
                  <Input value={fatherCnic} onChange={(e) => setFatherCnic(e.target.value)} />
                </div>
                <div>
                  <Label>Occupation</Label>
                  <Input value={fatherOccupation} onChange={(e) => setFatherOccupation(e.target.value)} />
                </div>
                <div>
                  <Label>Contact</Label>
                  <Input value={fatherContact} onChange={(e) => setFatherContact(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {category === "Address" && (
          <Card>
            <CardHeader>
              <CardTitle>Address Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Current Address</Label>
                  <Input value={currentAddress} onChange={(e) => setCurrentAddress(e.target.value)} />
                </div>
                <div>
                  <Label>House Ownership</Label>
                  <Input value={houseOwnership} onChange={(e) => setHouseOwnership(e.target.value)} />
                </div>
                <div>
                  <Label>Rent</Label>
                  <Input value={rent} onChange={(e) => setRent(e.target.value)} />
                </div>
                <div>
                  <Label>Family Income</Label>
                  <Input value={familyIncome} onChange={(e) => setFamilyIncome(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-2">
          <Button type="submit">Save Changes</Button>
          <Button variant="ghost" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  )
}

export default function UpdateStudentPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <UpdateStudentContent />
    </Suspense>
  )
}
