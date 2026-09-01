"use client"

import { TeacherForm } from "@/components/admin/teacher-form"
import { Button } from "@/components/ui/button"
import { Upload } from "lucide-react"
import Link from "next/link"

export default function AddTeacherPage() {
  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Add New Teacher</h1>
          <p className="text-sm text-gray-500">Fill the multi-step form below to register a teacher manually.</p>
        </div>
        <Link href="/admin/teachers/bulk-upload">
          <Button variant="outline" className="flex items-center gap-2 border-[#013a63] text-[#013a63] hover:bg-[#013a63]/5 font-semibold">
            <Upload className="w-4 h-4" />
            Bulk Import Teachers
          </Button>
        </Link>
      </div>
      
      <TeacherForm />
    </div>
  )
}
