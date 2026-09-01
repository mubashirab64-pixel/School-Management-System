import React from 'react'
import TeacherBulkUpload from '@/components/admin/TeacherBulkUpload'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Bulk Teacher Upload | Al-Khair SMS',
  description: 'Upload multiple teacher records via CSV/Excel spreadsheet',
}

export default function BulkUploadPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <TeacherBulkUpload />
    </div>
  )
}
