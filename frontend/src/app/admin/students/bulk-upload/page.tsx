"use client"

import StudentBulkUpload from "@/components/admin/StudentBulkUpload"
import { usePermissions } from "@/lib/permissions"
import { AccessDenied } from "@/components/AccessDenied"

export default function BulkUploadStudentsPage() {
  const { canAddStudent } = usePermissions()

  if (!canAddStudent) {
    return (
      <AccessDenied
        title="Access Restricted"
        message="Only Org Admins and Principals can upload students in bulk."
      />
    )
  }

  return (
    <div className="p-6">
      <StudentBulkUpload />
    </div>
  )
}
