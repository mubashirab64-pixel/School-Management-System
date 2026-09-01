'use client'
import React, { useState, useRef } from 'react'
import { UploadCloud, CheckCircle2, XCircle, FileSpreadsheet, Download, Loader2, RefreshCw, Info, Eye } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

type ImportReport = {
  row: number
  status: 'ok' | 'error'
  name?: string
  message: string
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return (
    localStorage.getItem('sis_access_token') ||
    localStorage.getItem('token') ||
    localStorage.getItem('access') ||
    null
  )
}

export default function StudentBulkUpload() {
  const [showGuide, setShowGuide] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [reports, setReports] = useState<ImportReport[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '')

  const handleDownloadTemplate = async () => {
    const token = getAuthToken()
    try {
      const res = await fetch(`${apiBase}/api/students/bulk-upload-template/`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'student_bulk_upload_template.xls'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError('Could not download template. Please try again.')
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragActive(false)
    const f = e.dataTransfer.files?.[0]
    if (f) setFile(f)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) setFile(f)
  }

  const handleUpload = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    setReports(null)
    setUploadProgress(0)

    const token = getAuthToken()
    const formData = new FormData()
    formData.append('file', file)

    // Simulate progress
    const progressInterval = setInterval(() => {
      setUploadProgress(p => Math.min(p + 10, 85))
    }, 300)

    try {
      const res = await fetch(`${apiBase}/api/students/bulk-upload/`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      clearInterval(progressInterval)
      setUploadProgress(100)

      const data = await res.json()

      if (!res.ok) {
        setError(data?.error || `Upload failed (${res.status})`)
        return
      }

      setReports(data.reports ?? [])
    } catch (e: any) {
      clearInterval(progressInterval)
      setError(e?.message || 'Upload failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setFile(null)
    setReports(null)
    setError(null)
    setUploadProgress(0)
    if (inputRef.current) inputRef.current.value = ''
  }

  const successCount = reports?.filter(r => r.status === 'ok').length ?? 0
  const errorCount = reports?.filter(r => r.status === 'error').length ?? 0

  return (
    <div className="mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
      
      {/* Dynamic Header */}
      <Card className="border-none shadow-xl bg-gradient-to-r from-[#013a63] via-[#01497c] to-[#012a4a] text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 p-16 opacity-10 pointer-events-none transform translate-x-1/4 -translate-y-1/4">
          <UploadCloud className="w-64 h-64" />
        </div>
        <CardHeader className="relative z-10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl shadow-inner">
              <FileSpreadsheet className="w-8 h-8 text-white" />
            </div>
            <div>
              <CardTitle className="text-3xl font-bold tracking-tight">Bulk Student Upload</CardTitle>
              <CardDescription className="text-blue-50 mt-1 text-base">
                Download the Excel template, populate it with student records, and seamlessly upload them back into the system.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Step 1: Template Info */}
        <Card className="border-none shadow-lg bg-white/80 backdrop-blur-sm transition-all duration-300 hover:shadow-xl relative">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#013a63] text-white font-bold text-sm shadow-md">1</div>
                  <CardTitle className="text-xl text-[#013a63]">Download Template</CardTitle>
                </div>
                <CardDescription className="text-gray-500 mt-2">
                  The template contains all mandatory and optional fields. Ensure data follows the required format.
                </CardDescription>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowGuide(true)} 
                className="text-[#013a63] hover:bg-[#013a63]/10 -mt-1 -mr-2"
                title="View Fields Guide"
              >
                <Eye className="w-5 h-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-[#f0f4f8] rounded-xl p-5 border border-[#a3cef1]/30">
              <h4 className="font-semibold text-[#013a63] mb-3 flex items-center gap-2">
                <Info className="w-4 h-4" /> Required Columns
              </h4>
              <div className="flex flex-wrap gap-2 mb-5">
                {['student_id', 'name', 'gender', 'dob', 'grade III', 'section', 'classroom grade III - a', 'shift', 'campus', 'admission_year'].map(col => (
                  <span key={col} className="bg-[#01497c] text-white px-2.5 py-1 rounded-md font-mono text-xs shadow-sm">{col}</span>
                ))}
              </div>
              
              <h4 className="font-semibold text-gray-700 mb-3 text-sm">Optional Columns</h4>
              <div className="flex flex-wrap gap-2">
                {['religion', 'mother_tongue', 'emergency_contact', 'address', 'siblings_count', 'email', 'phone_number', 'father_name', 'father_contact'].map(col => (
                  <span key={col} className="bg-white border border-gray-200 text-gray-600 px-2.5 py-1 rounded-md font-mono text-xs shadow-sm">{col}</span>
                ))}
              </div>
              
              <div className="mt-5 pt-4 border-t border-gray-200/60">
                <p className="text-xs text-gray-500 leading-relaxed font-mono">
                  <strong className="text-gray-700">Formats:</strong> Gender: male/female | DOB: YYYY-MM-DD | Section: A–F <br />Shift: morning/afternoon
                </p>
              </div>
            </div>

            <Button
              onClick={handleDownloadTemplate}
              className="w-full bg-[#013a63] hover:bg-[#012a4a] text-white font-semibold py-6 rounded-xl shadow-md transition-all duration-300 transform hover:scale-[1.02] flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              Download Excel Template
            </Button>
          </CardContent>
        </Card>

        {/* Step 2: Upload */}
        <Card className="border-none shadow-lg bg-white/80 backdrop-blur-sm transition-all duration-300 hover:shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#6096ba] text-white font-bold text-sm shadow-md">2</div>
              <CardTitle className="text-xl text-[#013a63]">Upload Filled CSV</CardTitle>
            </div>
            <CardDescription className="text-gray-500">
              Upload your completed spreadsheet. Valid student records will be enrolled automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!reports ? (
              <div className="space-y-6">
                <div
                  onDragOver={e => { e.preventDefault(); setDragActive(true) }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                  onClick={() => inputRef.current?.click()}
                  className={`relative overflow-hidden border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 group ${
                    dragActive 
                      ? 'border-[#6096ba] bg-[#6096ba]/10' 
                      : 'border-gray-300 hover:border-[#6096ba] hover:bg-[#f8fbfd]'
                  }`}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".csv,.xls,.xlsx"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  
                  {file ? (
                    <div className="flex flex-col items-center gap-3 animate-in zoom-in duration-300">
                      <div className="p-4 bg-emerald-50 rounded-full text-emerald-600">
                        <FileSpreadsheet className="w-10 h-10" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800 text-lg">{file.name}</p>
                        <p className="text-sm text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4 text-gray-400 group-hover:text-[#6096ba] transition-colors">
                      <div className="p-4 bg-gray-50 rounded-full group-hover:bg-[#6096ba]/10 transition-colors">
                        <UploadCloud className="w-10 h-10" />
                      </div>
                      <div>
                        <p className="text-base font-semibold text-gray-700">Click or drag file to this area to upload</p>
                        <p className="text-sm mt-1 text-gray-500">Supports .csv</p>
                      </div>
                    </div>
                  )}
                </div>

                {loading && (
                  <div className="space-y-2 animate-in fade-in">
                    <div className="flex justify-between text-sm font-medium text-gray-700">
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-[#6096ba]" /> Processing records...
                      </span>
                      <span className="text-[#6096ba]">{uploadProgress}%</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                      <div
                        className="h-full bg-gradient-to-r from-[#6096ba] to-[#274c77] transition-all duration-300 ease-out relative"
                        style={{ width: `${uploadProgress}%` }}
                      >
                        <div className="absolute inset-0 bg-white/20 animate-[shimmer_1.5s_infinite]" />
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 animate-in slide-in-from-top-2">
                    <XCircle className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium">{error}</span>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={handleUpload}
                    disabled={!file || loading}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-6 rounded-xl shadow-md transition-all duration-300 transform hover:scale-[1.02] flex items-center justify-center gap-2 text-base"
                  >
                    {loading ? (
                      <>Processing...</>
                    ) : (
                      <>
                        <UploadCloud className="w-5 h-5" /> Upload & Enroll
                      </>
                    )}
                  </Button>
                  
                  {file && !loading && (
                    <Button
                      onClick={handleReset}
                      variant="outline"
                      className="border-gray-300 text-gray-600 hover:bg-gray-50 font-semibold py-6 px-6 rounded-xl shadow-sm transition-all duration-300"
                    >
                      <RefreshCw className="w-5 h-5" />
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-8 text-center space-y-4 animate-in zoom-in duration-500">
                <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-2 shadow-inner">
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </div>
                <h3 className="text-2xl font-bold text-gray-800">Upload Complete!</h3>
                <p className="text-gray-500 max-w-[250px]">
                  Your student records have been successfully processed. Check the detailed report below.
                </p>
                <Button 
                  onClick={handleReset}
                  variant="outline"
                  className="mt-4 text-[#013a63] border-[#013a63]/30 hover:bg-[#013a63]/5"
                >
                  <UploadCloud className="w-4 h-4 mr-2" /> Upload Another File
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Results Report */}
      {reports && (
        <Card className="border-none shadow-xl bg-white/90 backdrop-blur-md overflow-hidden animate-in slide-in-from-bottom-8 duration-700">
          <CardHeader className="border-b border-gray-100 bg-gray-50/50 pb-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl text-[#013a63]">Processing Report</CardTitle>
                <CardDescription className="mt-1 text-gray-500">Detailed line-by-line status of your uploaded records</CardDescription>
              </div>
              <div className="flex gap-3">
                <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-xl text-sm font-bold shadow-sm">
                  <CheckCircle2 className="w-5 h-5" />
                  {successCount} Enrolled
                </div>
                {errorCount > 0 && (
                  <div className="flex items-center gap-2 text-rose-700 bg-rose-50 border border-rose-100 px-4 py-2 rounded-xl text-sm font-bold shadow-sm">
                    <XCircle className="w-5 h-5" />
                    {errorCount} Failed
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f8fbfd] text-[#013a63] text-xs uppercase font-bold border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left w-20 tracking-wider">Row</th>
                  <th className="px-6 py-4 text-left tracking-wider">Student Name</th>
                  <th className="px-6 py-4 text-left tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left tracking-wider">System Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {reports.map((r, i) => (
                  <tr key={i} className={`transition-colors hover:bg-gray-50/80 ${r.status === 'error' ? 'bg-rose-50/20' : ''}`}>
                    <td className="px-6 py-4">
                      <span className="font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded-md text-xs">{r.row}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-gray-800">{r.name || '—'}</span>
                    </td>
                    <td className="px-6 py-4">
                      {r.status === 'ok' ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold text-xs bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Success
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-rose-700 font-bold text-xs bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100">
                          <XCircle className="w-3.5 h-3.5" /> Error
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium">{r.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {/* Fields Guide Modal */}
      <Dialog open={showGuide} onOpenChange={setShowGuide}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-[#013a63]">Required Fields Guide</DialogTitle>
            <DialogDescription>
              Here is why these specific fields are mandatory for bulk upload.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <h4 className="font-bold text-[#013a63] text-lg mb-1">student_id</h4>
              <p className="text-gray-600 text-sm">Required because it serves as the specific, unique identifier for the child across the entire system. It prevents duplicate entries and ensures correct tracking.</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <h4 className="font-bold text-[#013a63] text-lg mb-1">campus</h4>
              <p className="text-gray-600 text-sm">Required to identify which exact branch or campus the student is enrolling in, as this affects fee structures and local administration.</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <h4 className="font-bold text-[#013a63] text-lg mb-1">grade, section & classroom</h4>
              <p className="text-gray-600 text-sm">Required to correctly assign the child to their physical classroom and link them to the correct class teacher and timetable.</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <h4 className="font-bold text-[#013a63] text-lg mb-1">shift</h4>
              <p className="text-gray-600 text-sm">Required because a child's shift (e.g. morning/afternoon) directly impacts their class assignments, transport, and attendance timings.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
