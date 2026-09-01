import React, { useState, useRef, useEffect, useCallback } from 'react'
import { JSX } from 'react/jsx-runtime'

type ImportReport = {
  row: number
  status: 'ok' | 'error'
  message: string
}

type MidTermStatus = {
  checking: boolean
  total: number
  approved: number
  pendingCoordinator: number
  pendingPrincipal: number
  notApproved: number
  allApproved: boolean
}

type Props = {
  initialFile?: File | null
  initialExamType?: 'monthly' | 'midterm' | 'final' | null
  initialMonth?: string
  classroomId?: number | null
  teacherId?: string | number | null
  onClose?: () => void
}

// Icons as SVG components
const UploadIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </svg>
)

const CheckCircleIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const XCircleIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const FileIcon = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
)

const SparkleIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
)

const DownloadIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
)

const LoadingSpinner = () => (
  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
)

export default function ResultBulkUpload({ initialFile, initialExamType, initialMonth, classroomId, teacherId, onClose }: Props): JSX.Element {
  const [file, setFile] = useState<File | null>(null)
  const [localTeacherId, setLocalTeacherId] = useState<string>(teacherId ? String(teacherId) : '')
  const [overwrite, setOverwrite] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)
  const [reports, setReports] = useState<ImportReport[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState<boolean>(false)
  const [showSuccess, setShowSuccess] = useState<boolean>(false)
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [selectedExamType, setSelectedExamType] = useState<'monthly' | 'midterm' | 'final' | null>(initialExamType || null)
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth || '')
  const [midTermStatus, setMidTermStatus] = useState<MidTermStatus | null>(null)

  // Download sample CSV handler (context-aware)
  const handleDownloadSample = async (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
    e.preventDefault();
    if (!selectedExamType) {
      // Fallback or alert if no type selected, though button implies context
      // But for safety, default to final or show error
      // Let's assume default is fine or just return if not critical
    }

    let endpoint = '/api/results/sample-template/';
    let filename = 'sample_results.csv';
    if (selectedExamType === 'monthly') {
      endpoint = '/api/results/sample-template-monthly/';
      filename = 'sample_results_monthly.xls';
    } else if (selectedExamType === 'midterm') {
      endpoint = '/api/results/sample-template-mid/';
      filename = 'sample_results_mid.xls';
    } else if (selectedExamType === 'final') {
      endpoint = '/api/results/sample-template-final/';
      filename = 'sample_results_final.xls';
    }

    // Append classroomId and teacherId
    const queryParams = new URLSearchParams();
    if (classroomId) queryParams.append('classroom_id', String(classroomId));
    if (teacherId) queryParams.append('teacher_id', String(teacherId));
    if (selectedMonth) queryParams.append('month', selectedMonth);
    const queryString = queryParams.toString();
    if (queryString) {
      endpoint += `?${queryString}`;
    }

    const getCookie = (name: string) => {
      const v = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)')
      return v ? v.pop() : ''
    }

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      // Construct URL
      const url = `${apiBase}${endpoint}`;

      let token = typeof window !== 'undefined' && (
        localStorage.getItem('token') ||
        localStorage.getItem('access') ||
        localStorage.getItem('auth_token') ||
        sessionStorage.getItem('token') ||
        sessionStorage.getItem('access') ||
        sessionStorage.getItem('auth_token') ||
        (window as any).__IAK_AUTH_TOKEN__
      )

      if (!token) {
        token = getCookie('sis_access_token') || getCookie('access') || getCookie('token') || getCookie('auth_token')
      }

      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: headers
      });

      if (!response.ok) {
        throw new Error(`Failed to download: ${response.status}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);

    } catch (err: any) {
      setError(err.message || 'Failed to download template');
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0]
    setFile(f || null)
    setReports(null)
    setError(null)
    setShowSuccess(false)
  }

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile.type === 'text/csv' || droppedFile.name.endsWith('.csv')) {
        setFile(droppedFile)
        setReports(null)
        setError(null)
        setShowSuccess(false)
      } else {
        setError('Please upload a CSV file')
      }
    }
  }

  useEffect(() => {
    if (initialFile) setFile(initialFile)
  }, [initialFile])

  // Check mid-term approval status when Final Term is selected
  const checkMidTermApprovalStatus = useCallback(async () => {
    setMidTermStatus({ checking: true, total: 0, approved: 0, pendingCoordinator: 0, pendingPrincipal: 0, notApproved: 0, allApproved: false })
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || ''
      let token: string | null = null
      if (typeof window !== 'undefined') {
        token = localStorage.getItem('token') || localStorage.getItem('access') || localStorage.getItem('auth_token') ||
          sessionStorage.getItem('token') || sessionStorage.getItem('access') || sessionStorage.getItem('auth_token') ||
          (window as any).__IAK_AUTH_TOKEN__
      }
      if (!token) {
        const getCookie = (name: string) => { const v = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)'); return v ? v.pop() || '' : '' }
        token = getCookie('sis_access_token') || getCookie('access') || getCookie('token') || getCookie('auth_token')
      }
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      // Fetch all mid-term results for this teacher
      const res = await fetch(`${apiBase}/api/results/?exam_type=midterm`, { headers })
      if (!res.ok) throw new Error('Failed to fetch mid-term results')
      const data = await res.json()
      const midTermResults = Array.isArray(data) ? data : (data.results || [])

      const total = midTermResults.length
      const approved = midTermResults.filter((r: any) => r.status === 'approved').length
      const pendingCoordinator = midTermResults.filter((r: any) => r.status === 'pending_coordinator' || r.status === 'pending').length
      const pendingPrincipal = midTermResults.filter((r: any) => r.status === 'pending_principal').length
      const notApproved = total - approved

      setMidTermStatus({
        checking: false,
        total,
        approved,
        pendingCoordinator,
        pendingPrincipal,
        notApproved,
        allApproved: total > 0 && approved === total
      })
    } catch (e) {
      setMidTermStatus({ checking: false, total: 0, approved: 0, pendingCoordinator: 0, pendingPrincipal: 0, notApproved: 0, allApproved: false })
    }
  }, [])

  // Trigger mid-term check whenever Final Term is selected
  useEffect(() => {
    if (selectedExamType === 'final') {
      checkMidTermApprovalStatus()
    } else {
      setMidTermStatus(null)
    }
  }, [selectedExamType, checkMidTermApprovalStatus])

  // Simulate progress during upload
  useEffect(() => {
    if (loading) {
      setUploadProgress(0)
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) return prev
          return prev + Math.random() * 15
        })
      }, 200)
      return () => clearInterval(interval)
    } else {
      setUploadProgress(100)
    }
  }, [loading])

  const upload = async () => {
    if (!file) return

    // Block upload if Final Term and mid-terms not all approved
    if (selectedExamType === 'final' && midTermStatus && !midTermStatus.allApproved && !midTermStatus.checking) {
      setError(
        `Cannot upload Final Term results. Mid Term results are not fully approved. ` +
        `${midTermStatus.pendingCoordinator > 0 ? `${midTermStatus.pendingCoordinator} result(s) pending coordinator approval. ` : ''}` +
        `${midTermStatus.pendingPrincipal > 0 ? `${midTermStatus.pendingPrincipal} result(s) pending principal approval. ` : ''}` +
        `All Mid Term results must be approved by both coordinator and principal first.`
      )
      return
    }

    setLoading(true)
    setError(null)
    setReports(null)
    setShowSuccess(false)

    const fd = new FormData()
    fd.append('file', file)
    if (selectedExamType) fd.append('exam_type', selectedExamType)
    if (selectedExamType === 'monthly' && selectedMonth) fd.append('month', selectedMonth)
    if (localTeacherId) fd.append('teacher_id', localTeacherId)
    if (overwrite) fd.append('overwrite', 'true')

    const getCookie = (name: string) => {
      const v = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)')
      return v ? v.pop() : ''
    }

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || ''
      const headers: Record<string, string> = {
        'X-CSRFToken': getCookie('csrftoken') || ''
      }

      let token = typeof window !== 'undefined' && (
        localStorage.getItem('token') ||
        localStorage.getItem('access') ||
        localStorage.getItem('auth_token') ||
        sessionStorage.getItem('token') ||
        sessionStorage.getItem('access') ||
        sessionStorage.getItem('auth_token') ||
        (window as any).__IAK_AUTH_TOKEN__
      )

      if (!token) {
        token = getCookie('sis_access_token') || getCookie('access') || getCookie('token') || getCookie('auth_token')
      }

      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const res = await fetch(`${apiBase}/api/results/bulk-upload/`, {
        method: 'POST',
        body: fd,
        credentials: 'include',
        headers,
      })

      if (res.status === 404) {
        setError('Upload endpoint not found on server.')
        setLoading(false)
        return
      }

      if (!res.ok) {
        const text = await res.text()
        setError(`Upload failed: ${res.status} ${text}`)
        setLoading(false)
        return
      }

      const data = await res.json()
      if (Array.isArray(data)) {
        setReports(data)
      } else if (Array.isArray(data.reports)) {
        setReports(data.reports)
      } else if (data.message) {
        setError(String(data.message))
      }

      // Show success animation
      setShowSuccess(true)
    } catch (e: any) {
      setError(e?.message || 'Network error')
    } finally {
      setLoading(false)
    }
  }

  const clearForm = () => {
    setFile(null)
    if (inputRef.current) inputRef.current.value = ''
    setReports(null)
    setError(null)
    setShowSuccess(false)
  }

  const getExamTypeLabel = (type: string | null) => {
    switch (type) {
      case 'monthly': return 'Monthly Test'
      case 'midterm': return 'Mid Term'
      case 'final': return 'Final Term'
      default: return 'Select exam type'
    }
  }

  const successCount = reports?.filter(r => r.status === 'ok').length || 0
  const errorCount = reports?.filter(r => r.status === 'error').length || 0

  return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl shadow-2xl p-8 max-w-2xl w-full mx-auto max-h-[90vh] overflow-y-auto relative no-scrollbar">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl -translate-y-32 translate-x-32" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-emerald-500/10 to-cyan-500/10 rounded-full blur-3xl translate-y-24 -translate-x-24" />

      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/25">
              <UploadIcon />
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                Bulk Result Upload
              </h2>
              <p className="text-slate-500 text-sm">Import student results from CSV file</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-200 rounded-lg transition-all duration-200 hover:rotate-90"
            >
              <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Exam Type Selection */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Exam Type <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-3 gap-3">
            {(['monthly', 'midterm', 'final'] as const).map(type => (
              <button
                key={type}
                onClick={() => setSelectedExamType(type)}
                className={`px-4 py-3 rounded-xl font-medium transition-all duration-300 transform hover:scale-[1.02] ${selectedExamType === type
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30'
                  : 'bg-white border-2 border-slate-200 text-slate-600 hover:border-blue-300 hover:shadow-md'
                  }`}
              >
                {getExamTypeLabel(type)}
              </button>
            ))}
          </div>

          {/* Month Selection (Only for Monthly Test) */}
          {selectedExamType === 'monthly' && (
            <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Month <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-700"
              >
                <option value="">Select Month</option>
                {['April', 'May', 'June', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}

          {/* Mid Term Approval Status Warning (shown when Final Term is selected) */}
          {selectedExamType === 'final' && midTermStatus && (
            <div className={`mt-3 p-4 rounded-xl border-2 ${midTermStatus.checking
                ? 'border-slate-200 bg-slate-50'
                : midTermStatus.allApproved
                  ? 'border-emerald-300 bg-emerald-50'
                  : 'border-rose-300 bg-rose-50'
              }`}>
              {midTermStatus.checking ? (
                <div className="flex items-center gap-2 text-slate-600">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-sm font-medium">Checking Mid Term approval status...</span>
                </div>
              ) : midTermStatus.allApproved ? (
                <div className="flex items-center gap-2 text-emerald-700">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold">✅ Mid Term Approved</p>
                    <p className="text-xs text-emerald-600">{midTermStatus.approved} result(s) approved by coordinator and principal. You can upload Final Term.</p>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 text-rose-700 mb-2">
                    <svg className="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-sm font-semibold">🚫 Final Term Upload Blocked</p>
                  </div>
                  <p className="text-xs text-rose-700 mb-2">
                    Mid Term results must be approved by <strong>both coordinator and principal</strong> before Final Term can be uploaded.
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-white rounded-lg p-2 text-center border border-rose-200">
                      <div className="font-bold text-slate-700">{midTermStatus.total}</div>
                      <div className="text-slate-500">Total Mid Term</div>
                    </div>
                    <div className="bg-white rounded-lg p-2 text-center border border-emerald-200">
                      <div className="font-bold text-emerald-700">{midTermStatus.approved}</div>
                      <div className="text-emerald-600">Approved</div>
                    </div>
                    <div className="bg-white rounded-lg p-2 text-center border border-orange-200">
                      <div className="font-bold text-orange-700">{midTermStatus.notApproved}</div>
                      <div className="text-orange-600">Pending</div>
                    </div>
                  </div>
                  {midTermStatus.pendingCoordinator > 0 && (
                    <p className="text-xs text-orange-700 mt-2">⏳ {midTermStatus.pendingCoordinator} result(s) waiting for <strong>coordinator</strong> approval</p>
                  )}
                  {midTermStatus.pendingPrincipal > 0 && (
                    <p className="text-xs text-indigo-700 mt-1">⏳ {midTermStatus.pendingPrincipal} result(s) waiting for <strong>principal</strong> approval</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* File Drop Zone */}
        <div
          className={`relative mb-6 border-2 border-dashed rounded-2xl p-8 transition-all duration-300 ${dragActive
            ? 'border-blue-500 bg-blue-50 scale-[1.02]'
            : file
              ? 'border-emerald-400 bg-emerald-50'
              : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50'
            }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={onFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />

          <div className="text-center">
            {file ? (
              <div className="flex items-center justify-center gap-4 animate-fade-in">
                <div className="p-3 bg-emerald-100 rounded-xl text-emerald-600">
                  <FileIcon />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-slate-800">{file.name}</p>
                  <p className="text-sm text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); clearForm() }}
                  className="ml-4 p-2 hover:bg-rose-100 rounded-lg transition-colors text-rose-500"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center text-blue-500">
                  <UploadIcon />
                </div>
                <div>
                  <p className="font-semibold text-slate-700">Drop your CSV file here</p>
                  <p className="text-sm text-slate-500">or click to browse files</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <button
            disabled={!file || loading || !selectedExamType || (selectedExamType === 'final' && midTermStatus !== null && !midTermStatus.checking && !midTermStatus.allApproved)}
            onClick={upload}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold transition-all duration-300 transform ${!file || loading || !selectedExamType || (selectedExamType === 'final' && midTermStatus !== null && !midTermStatus.checking && !midTermStatus.allApproved)
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98]'
              }`}
          >
            {loading ? (
              <>
                <LoadingSpinner />
                <span>Uploading... {Math.round(uploadProgress)}%</span>
              </>
            ) : (
              <>
                <UploadIcon />
                <span>Upload Results</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownloadSample}
            className="flex items-center gap-2 px-5 py-3.5 bg-white border-2 border-slate-200 rounded-xl font-medium text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-all duration-200 hover:shadow-md"
          >
            <DownloadIcon />
            <span>Template</span>
          </button>
        </div>

        {/* Loading Progress Bar */}
        {loading && (
          <div className="mb-6 overflow-hidden">
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 animate-shake">
            <div className="p-1 bg-rose-100 rounded-lg text-rose-500">
              <XCircleIcon />
            </div>
            <div>
              <p className="font-medium text-rose-700">Upload Failed</p>
              <p className="text-sm text-rose-600">{error}</p>
            </div>
          </div>
        )}

        {/* Success Results */}
        {reports && showSuccess && (
          <div className="animate-slide-up">
            {/* Success Summary */}
            <div className="mb-4 p-5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl text-white shadow-lg shadow-emerald-500/30">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <SparkleIcon />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold">Upload Complete!</h3>
                  <p className="text-emerald-100">
                    {successCount} results imported successfully
                    {errorCount > 0 && `, ${errorCount} failed`}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold">{reports.length}</div>
                  <div className="text-xs text-emerald-200">Total Rows</div>
                </div>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="flex items-center gap-2 text-emerald-600 mb-1">
                  <CheckCircleIcon />
                  <span className="font-medium">Successful</span>
                </div>
                <div className="text-2xl font-bold text-emerald-700">{successCount}</div>
              </div>
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl">
                <div className="flex items-center gap-2 text-rose-600 mb-1">
                  <XCircleIcon />
                  <span className="font-medium">Failed</span>
                </div>
                <div className="text-2xl font-bold text-rose-700">{errorCount}</div>
              </div>
            </div>

            {/* Detailed Results Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                <h4 className="font-semibold text-slate-700">Import Details</h4>
              </div>
              <div className="max-h-64 overflow-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Row</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reports.map((r, idx) => (
                      <tr
                        key={r.row}
                        className={`transition-colors ${r.status === 'error' ? 'bg-rose-50 hover:bg-rose-100' : 'hover:bg-slate-50'}`}
                        style={{ animationDelay: `${idx * 50}ms` }}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-slate-700">{r.row}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${r.status === 'ok'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-rose-100 text-rose-700'
                            }`}>
                            {r.status === 'ok' ? <CheckCircleIcon /> : <XCircleIcon />}
                            {r.status === 'ok' ? 'Success' : 'Error'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{r.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action Button */}
            <div className="flex justify-end mt-4">
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
        .animate-slide-up { animation: slide-up 0.4s ease-out; }
        .animate-shake { animation: shake 0.5s ease-in-out; }
        /* Hide scrollbar for Chrome, Safari and Opera */
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        /* Hide scrollbar for IE, Edge and Firefox */
        .no-scrollbar {
          -ms-overflow-style: none;  /* IE and Edge */
          scrollbar-width: none;  /* Firefox */
        }
      `}</style>
    </div>
  )
}
