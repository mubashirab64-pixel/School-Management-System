"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ProgressBar } from "@/components/ui/progress-bar"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ArrowRight, Eye } from "lucide-react"
import { PersonalInfoStep } from "./coordinator-form/personal-info-step"
import { EducationStep } from "./coordinator-form/education-step"
import { WorkAssignmentStep } from "./coordinator-form/work-assignment-step"
import { CoordinatorPreview } from "./coordinator-form/coordinator-preview"
import { useToast } from "@/hooks/use-toast"
import { getCurrentUser, getCurrentUserRole } from "@/lib/permissions"
import { validateFields, parseField } from "@/lib/validation/common"
import { staffContactNumberField } from "@/lib/validation/schemas/_staffShared"
import { coordinatorCreateSchema } from "@/lib/validation/schemas/coordinator.schema"
import { useFormErrorHandler } from "@/hooks/use-error-handler"
import { ErrorDisplay } from "@/components/ui/error-display"
import { toast as sonnerToast } from "sonner"
import { getApiBaseUrl, checkEmailExists, getCoordinatorFormOptions } from "@/lib/api"
import { useAutoSave } from "@/hooks/useAutoSave"
import { SaveStatusIndicator } from "@/components/offline/SaveStatusIndicator"
import { DraftRecoveryDialog } from "@/components/offline/DraftRecoveryDialog"

interface CoordinatorDraft { formData: any; currentStep: number }

const steps = [
  { id: 1, title: "Personal" },
  { id: 2, title: "Education" },
  { id: 3, title: "Work Assignment" },
]

export function CoordinatorForm({
  onSuccess,
  onCancel,
  editData,
  isEdit = false
}: {
  onSuccess?: () => void;
  onCancel?: () => void;
  editData?: any;
  isEdit?: boolean;
}) {
  const { toast } = useToast()
  const [currentStep, setCurrentStep] = useState(1)
  const [showPreview, setShowPreview] = useState(false)
  const [formData, setFormData] = useState<any>({
    full_name: '',
    dob: '',
    gender: '',
    contact_number: '',
    email: '',
    cnic: '',
    permanent_address: '',
    education_level: '',
    institution_name: '',
    year_of_passing: new Date().getFullYear(),
    total_experience_years: 0,
    campus: null,
    level: null,
    assigned_levels: [],
    shift: 'morning',
    joining_date: '',
    is_currently_active: true,
    can_assign_class_teachers: true,
    employee_code: '',
    biometric_id: '',
    ...editData
  })
  const [isAutoGenerateId, setIsAutoGenerateId] = useState(!editData?.employee_code)
  const [formOptions, setFormOptions] = useState<any>(null)

  // Offline auto-save (Phase 7): add vs edit ke liye alag draft key. Edit mode
  // mein baselineSkip — loaded record ka draft tab tak nahi banta jab tak user
  // actual change na kare.
  const coordDraftId = isEdit
    ? `edit-coordinator-${editData?.id ?? "unknown"}`
    : "add-coordinator-draft"
  const { status: saveStatus, lastSavedAt, clearDraft } = useAutoSave<CoordinatorDraft>(
    coordDraftId,
    { formData, currentStep },
    { baselineSkip: isEdit }
  )
  const restoreDraft = (draft: CoordinatorDraft) => {
    if (draft.formData) setFormData(draft.formData)
    if (draft.currentStep) setCurrentStep(draft.currentStep)
  }
  const [invalidFields, setInvalidFields] = useState<string[]>([])
  const [duplicateErrors, setDuplicateErrors] = useState<{ [key: string]: string }>({})
  const [campuses, setCampuses] = useState<any[]>([])
  const [levels, setLevels] = useState<any[]>([])
  const [currentUserCampus, setCurrentUserCampus] = useState<any>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [generalError, setGeneralError] = useState<string>('')
  const [submitError, setSubmitError] = useState<string>('')



  const totalSteps = steps.length

  useEffect(() => {
    loadCurrentUserCampus();
    loadFormOptions();
    if (editData?.campus) {
      loadLevels(editData.campus, editData.shift);
    }
  }, []);

  const loadFormOptions = async () => {
    const options = await getCoordinatorFormOptions();
    if (options) {
      setFormOptions(options);
    }
  };

  // Load current user campus
  const loadCurrentUserCampus = async () => {
    try {
      const user = getCurrentUser();
      const userRole = getCurrentUserRole();

      console.log('Current user:', user);
      console.log('User role:', userRole);

      if (userRole === 'principal') {
        // For principal, try to get campus from user data or load from API
        if ((user as any)?.campus) {
          console.log('Principal campus from user data:', (user as any).campus);
          setCurrentUserCampus((user as any).campus);
          setCampuses([(user as any).campus]);
        } else {
          console.log('Principal campus not in user data, loading from API...');
          // Load campus data from API for principal
          try {
            const token = localStorage.getItem('sis_access_token');
            const base = getApiBaseUrl();
            const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
            const response = await fetch(`${cleanBase}/api/campus/`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              }
            });
            if (response.ok) {
              const data = await response.json();
              const allCampuses = data.results || data;
              console.log('All campuses for principal:', allCampuses);

              // Filter to show only principal's campus
              // We need to get principal's campus ID from user data or API
              // For now, let's try to get it from the user object
              const userCampusId = (user as any)?.campus_id || (user as any)?.campus?.id;
              if (userCampusId) {
                const principalCampus = allCampuses.find((campus: any) => campus.id === userCampusId);
                if (principalCampus) {
                  console.log('Principal campus found:', principalCampus);
                  setCurrentUserCampus(principalCampus);
                  setCampuses([principalCampus]);
                } else {
                  console.log('Principal campus not found, showing all campuses');
                  setCampuses(allCampuses);
                }
              } else {
                console.log('No campus ID found for principal, showing all campuses');
                setCampuses(allCampuses);
              }
            }
          } catch (error) {
            console.error('Error loading campuses for principal:', error);
          }
        }
      } else {
        // For other roles, load all campuses
        console.log('Loading all campuses...');

        try {
          const token = localStorage.getItem('sis_access_token');
          const base = getApiBaseUrl();
          const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
          const response = await fetch(`${cleanBase}/api/campus/`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            }
          });
          console.log('Campus API response:', response.status);

          if (response.ok) {
            const data = await response.json();
            console.log('Campus data:', data);
            setCampuses(data.results || data);
          } else {
            console.error('Campus API error:', response.status, response.statusText);
            const errorText = await response.text();
            console.error('Error response:', errorText);

            // Show user-friendly error message
            toast({
              title: "Backend Error",
              description: "Cannot connect to backend server. Please make sure the backend is running.",
              variant: "destructive"
            });
          }
        } catch (fetchError) {
          console.error('Fetch error:', fetchError);
          toast({
            title: "Connection Error",
            description: "Cannot connect to backend server. Please make sure you are connected to the internet.",
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      console.error('Error loading user campus:', error);
      toast({
        title: "Error",
        description: "Failed to load campus information",
        variant: "destructive"
      });
    }
  };

  // Load levels based on selected campus and shift
  const loadLevels = async (campusId: number, shift?: string) => {
    try {
      if (!campusId) {
        console.warn('loadLevels called without campusId');
        return;
      }

      console.log(`[loadLevels] Loading levels for campus ${campusId}, shift: ${shift}`);
      const token = localStorage.getItem('sis_access_token');
      const base = getApiBaseUrl();
      const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;

      const response = await fetch(`${cleanBase}/api/levels/?campus_id=${campusId}`, {
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const data = await response.json();
        const allLevels = data.results || data;
        console.log(`[loadLevels] Found ${allLevels.length} total levels for campus`);

        // Filter levels by shift
        const filteredLevels = allLevels.filter((level: any) => {
          // If shift is 'both', show all levels
          if (!shift || shift === 'both') return true;

          // Show levels that match the shift or are 'both'
          return level.shift === shift || level.shift === 'both';
        });

        console.log(`[loadLevels] Final levels to display: ${filteredLevels.length}`);
        setLevels(filteredLevels);
      } else {
        console.error('Levels API error:', response.status);
      }
    } catch (error) {
      console.error('Error loading levels:', error);
      toast({
        title: "Error",
        description: "Failed to load levels",
        variant: "destructive"
      });
    }
  };

  // Check for duplicate email/CNIC
  const checkDuplicates = async (email: string, cnic: string) => {
    try {
      const token = localStorage.getItem('sis_access_token');
      const duplicateErrors: { [key: string]: string } = {};
      const base = getApiBaseUrl();
      const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;

      // Check email duplicate
      if (email && email.trim()) {
        const emailResponse = await fetch(`${cleanBase}/api/coordinators/check-email/?email=${encodeURIComponent(email)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (emailResponse.ok) {
          const data = await emailResponse.json();
          if (data.exists && (!isEdit || email !== editData?.email)) {
            duplicateErrors.email = "This email is already registered.";
          }
        }
      }

      // Check CNIC duplicate
      if (cnic && cnic.trim()) {
        const cnicResponse = await fetch(`${cleanBase}/api/coordinators/check-cnic/?cnic=${encodeURIComponent(cnic)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (cnicResponse.ok) {
          const data = await cnicResponse.json();
          if (data.exists && (!isEdit || cnic !== editData?.cnic)) {
            duplicateErrors.cnic = "This CNIC is already registered.";
          }
        }
      }

      setDuplicateErrors(duplicateErrors);
      return Object.keys(duplicateErrors).length === 0;
    } catch (error) {
      console.error('Error checking duplicates:', error);
      return true;
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }))
    if (invalidFields.includes(field)) {
      setInvalidFields((prev) => prev.filter((f) => f !== field))
    }

    // Clear duplicate error for this field
    if (duplicateErrors[field]) {
      setDuplicateErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }

    // Load levels when campus changes
    if (field === 'campus' && value) {
      loadLevels(parseInt(value), formData.shift);
      setFormData((prev: any) => ({ ...prev, level: null })); // Reset level selection
    }

    // Reload levels when shift changes (if campus is already selected)
    if (field === 'shift' && formData.campus) {
      loadLevels(parseInt(formData.campus), value);
      setFormData((prev: any) => ({ ...prev, level: null })); // Reset level selection
    }
  }

  const validateCurrentStep = () => {
    const requiredFields: { [step: number]: string[] } = {
      1: ["full_name", "dob", "gender", "contact_number", "email", "cnic", "permanent_address"],
      2: ["education_level", "institution_name", "year_of_passing", "total_experience_years"],
      3: formData.shift === 'both'
        ? ["campus", "assigned_levels", "shift", "joining_date"]
        : ["campus", "level", "shift", "joining_date"],
    }

    const required = requiredFields[currentStep] || []
    const { invalid, messages } = validateFields(coordinatorCreateSchema, formData, required)

    setInvalidFields(invalid)

    if (invalid.length > 0) {
      toast({
        title: messages[invalid[0]] || "Please fill required fields",
        description: `Please check: ${invalid.map(f => f.replace('_', ' ')).join(", ")}`,
        variant: "destructive"
      })
    }

    return invalid
  }

  const handleNext = async () => {
    const invalid = validateCurrentStep()
    if (invalid.length > 0) {
      return
    }

    // Check for duplicates on step 1 (personal info)
    if (currentStep === 1) {
      const isDuplicateFree = await checkDuplicates(formData.email, formData.cnic);
      if (!isDuplicateFree) {
        toast({
          title: "Duplicate Information",
          description: "Email or CNIC already exists. Please check the error messages below.",
          variant: "destructive"
        });
        return;
      }
    }

    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    } else {
      setShowPreview(true)
    }
  }

  const handleSave = async () => {
    const invalid = validateCurrentStep()
    if (invalid.length > 0) {
      toast({
        title: "Please fill required fields",
        description: invalid.join(", "),
        variant: "destructive"
      })
      return
    }

    // Check for duplicates before going to preview
    const isDuplicateFree = await checkDuplicates(formData.email, formData.cnic);
    if (!isDuplicateFree) {
      toast({
        title: "Duplicate Information",
        description: "Email or CNIC already exists. Please check the error messages below.",
        variant: "destructive"
      });
      return;
    }

    // Go to preview instead of submitting directly
    setShowPreview(true)
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleStepChange = (step: number) => {
    // Only allow going to previous steps or current step
    if (step <= currentStep) {
      setCurrentStep(step)
    } else {
      toast({
        title: "Step Locked",
        description: "Please complete the current step before proceeding to the next step.",
        variant: "destructive"
      })
    }
  }

  const handleSubmit = async () => {
    if (isSubmitting) return; // Prevent multiple submissions

    setIsSubmitting(true);
    try {
      // Global duplicate email check before submission
      if (formData?.email) {
        const exists = await checkEmailExists(formData.email)
        if (exists) {
          setIsSubmitting(false)
          setSubmitError('This email is already registered. Please use a different email address.')
          return
        }
      }

      const base = getApiBaseUrl();
      const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
      const url = isEdit ? `${cleanBase}/api/coordinators/${editData?.id}/` : `${cleanBase}/api/coordinators/`;
      const method = isEdit ? 'PUT' : 'POST';

      // Prepare form data for submission
      const submitData: any = {
        ...formData,
        campus: parseInt(formData.campus),
        level: formData.shift === 'both' ? null : parseInt(formData.level),
        assigned_levels: formData.shift === 'both' ? (Array.isArray(formData.assigned_levels) ? formData.assigned_levels.map((id: any) => parseInt(id)) : []) : [],
        year_of_passing: parseInt(formData.year_of_passing),
        total_experience_years: parseInt(formData.total_experience_years),
        // Handle hybrid ID
        employee_code: isAutoGenerateId ? '' : formData.employee_code,
      };

      // Check if principal is trying to create coordinator with their own email/CNIC
      const currentUser = getCurrentUser();
      if (currentUser && !isEdit) {
        if (submitData.email === currentUser.email) {
          toast({
            title: "Error",
            description: "You cannot create a coordinator with your own email address. Please use a different email.",
            variant: "destructive"
          });
          return;
        }

        if (currentUser.cnic && submitData.cnic === currentUser.cnic) {
          toast({
            title: "Error",
            description: "You cannot create a coordinator with your own CNIC. Please use a different CNIC.",
            variant: "destructive"
          });
          return;
        }
      }

      console.log('Submitting coordinator data:', submitData);

      const token = localStorage.getItem('sis_access_token');
      console.log('Using token:', token ? 'Token exists' : 'No token');

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      if (response.ok) {
        const responseData = await response.json();
        console.log('Success response:', responseData);

        // Show success popup modal
        setSubmitError('') // Clear any errors
        const coordinatorName = responseData.full_name || formData.full_name || "Coordinator"
        const employeeCode = responseData.employee_code || "Pending"
        let levelName = "N/A"
        if (formData.shift === 'both') {
          const selectedIds: number[] = Array.isArray(formData.assigned_levels) ? formData.assigned_levels.map((x: any) => parseInt(x)) : []
          const selectedLevels = levels.filter((l) => selectedIds.includes(l.id))
          if (selectedLevels.length > 0) {
            levelName = selectedLevels
              .map((l) => {
                const shiftLabel = (l.shift_display || (l.shift || '')).toString()
                const code = l.code ? ` ${l.code}` : ''
                return `${l.name} (${shiftLabel})${code ? ` •${code}` : ''}`
              })
              .join(', ')
          }
        } else {
          const match = levels.find(l => l.id === parseInt(formData.level))
          if (match) {
            const shiftLabel = (match.shift_display || (match.shift || '')).toString()
            levelName = `${match.name} (${shiftLabel})${match.code ? ` • ${match.code}` : ''}`
          }
        }

        sonnerToast.success(`✅ Coordinator ${isEdit ? 'Updated' : 'Added'} Successfully!`, {
          description: (
            <div className="space-y-1">
              <p className="font-semibold">Coordinator: {coordinatorName}</p>
              <p>Employee Code: {employeeCode}</p>
              {!isEdit && levelName && (
                <p>Level: {levelName}</p>
              )}
            </div>
          ),
          duration: 5000,
        })

        // Reset form and go to first step
        if (!isEdit) {
          setFormData({
            full_name: '',
            dob: '',
            gender: '',
            contact_number: '',
            email: '',
            cnic: '',
            permanent_address: '',
            education_level: '',
            institution_name: '',
            year_of_passing: new Date().getFullYear(),
            total_experience_years: 0,
            campus: null,
            level: null,
            joining_date: '',
            is_currently_active: true,
            can_assign_class_teachers: true,
          });
          setCurrentStep(1);
          setShowPreview(false);
          setLevels([]);
        }

        // Server pe save ho gaya — local draft hata do (add ya edit dono).
        clearDraft();
        onSuccess?.();
      } else {
        const errorText = await response.text();
        let errorMessage = 'Failed to create coordinator. Please try again.';

        try {
          const errorData = JSON.parse(errorText);
          if (errorData.email && Array.isArray(errorData.email) && errorData.email[0].includes('already exists')) {
            errorMessage = 'This email is already registered. Please use a different email address.';
          } else if (errorData.cnic && Array.isArray(errorData.cnic) && errorData.cnic[0].includes('already exists')) {
            errorMessage = 'This CNIC is already registered. Please check your CNIC number.';
          } else if (errorData.level && Array.isArray(errorData.level)) {
            errorMessage = 'This level already has a coordinator assigned. Please choose a different level.';
          } else if (errorData.non_field_errors) {
            errorMessage = Array.isArray(errorData.non_field_errors)
              ? errorData.non_field_errors.join(', ')
              : errorData.non_field_errors;
          } else if (typeof errorData === 'object') {
            const fieldErrors = Object.values(errorData);
            if (fieldErrors.length > 0) {
              const firstError = Array.isArray(fieldErrors[0]) ? fieldErrors[0][0] : fieldErrors[0];
              errorMessage = firstError;
            }
          }
        } catch { }

        setSubmitError(errorMessage)
        sonnerToast.error("Failed to save coordinator", { description: errorMessage })
      }
    } catch (error) {
      console.error('Network/Request error:', error);
      const networkError = "Network error. Please check your connection and try again."
      setSubmitError(networkError)
      sonnerToast.error("Error", { description: networkError });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (showPreview) {
    return (
      <CoordinatorPreview
        formData={formData}
        onEdit={() => setShowPreview(false)}
        onSubmit={handleSubmit}
        onCancel={onCancel || (() => { })}
        isEdit={isEdit}
        campuses={campuses}
        levels={levels}
        isSubmitting={isSubmitting}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-3 sm:p-4">
      {/* Offline: mount par saved draft mila to restore prompt (Phase 7). */}
      <DraftRecoveryDialog<CoordinatorDraft>
        formId={coordDraftId}
        onRestore={restoreDraft}
      />

      {/* Error Popup Modal */}
      {submitError && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="border-red-500 bg-white shadow-2xl max-w-md w-full">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-red-600 text-xl font-bold">⚠</span>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-red-800 text-lg">Submission Error</h3>
                  <p className="text-red-700 text-sm mt-1">{submitError}</p>
                </div>
                <button
                  onClick={() => setSubmitError('')}
                  className="text-red-400 hover:text-red-600 transition-colors"
                >
                  ✕
                </button>
              </div>
              <div className="mt-6 flex justify-end">
                <Button
                  onClick={() => setSubmitError('')}
                  className="bg-red-600 hover:bg-red-700 text-white rounded-xl px-6"
                >
                  Understand
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Progress Card */}
      {!showPreview && (
        <Card className="border-2 bg-white shadow-sm mb-6 rounded-3xl overflow-hidden">
          <CardHeader className="py-4 px-6 border-b bg-white">
            <div className="w-full">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold text-slate-800">Registration Progress</CardTitle>
                  <CardDescription className="text-sm font-medium text-slate-500">
                    Step {currentStep} of {totalSteps}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <SaveStatusIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
                  <div className="hidden sm:block text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                    New Coordinator
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <ProgressBar
                  steps={steps}
                  currentStep={currentStep}
                  onStepClick={handleStepChange}
                  showClickable={true}
                />
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Step Content */}
      <div className="space-y-6">
        {currentStep === 1 && (
          <PersonalInfoStep
            formData={formData}
            onInputChange={handleInputChange}
            invalidFields={invalidFields}
            duplicateErrors={duplicateErrors}
            isAutoGenerateId={isAutoGenerateId}
            setIsAutoGenerateId={setIsAutoGenerateId}
            onBlurCheck={(field, value) => {
              if (field === 'email') checkDuplicates(value, formData.cnic)
              if (field === 'cnic') checkDuplicates(formData.email, value)
            }}
            formOptions={formOptions}
          />
        )}

        {currentStep === 2 && (
          <EducationStep
            formData={formData}
            onInputChange={handleInputChange}
            invalidFields={invalidFields}
            formOptions={formOptions}
          />
        )}

        {currentStep === 3 && (
          <WorkAssignmentStep
            formData={formData}
            onInputChange={handleInputChange}
            invalidFields={invalidFields}
            campuses={campuses}
            levels={levels}
            onShiftChange={(shift) => {
              if (formData.campus) {
                loadLevels(parseInt(formData.campus), shift);
                setFormData((prev: any) => ({ ...prev, level: null }));
              }
            }}
            formOptions={formOptions}
          />
        )}
      </div>

      {/* Footer Navigation */}
      {!showPreview && (
        <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-3xl border-2 border-dashed border-blue-200 mt-8 gap-4 shadow-sm">
          <Button
            onClick={handlePrevious}
            disabled={currentStep === 1}
            variant="ghost"
            className={`flex items-center gap-2 px-6 h-12 font-bold rounded-2xl transition-all ${currentStep === 1 ? "opacity-30 cursor-not-allowed" : "hover:bg-slate-50 text-slate-600"
              }`}
          >
            <ArrowLeft className="h-5 w-5" />
            Previous
          </Button>

          <div className="flex gap-3 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={onCancel}
              className="flex-1 sm:flex-initial h-12 px-6 font-bold rounded-2xl border-2 border-slate-200 text-slate-600 hover:bg-slate-50 transition-all"
            >
              Cancel
            </Button>
            <Button
              onClick={currentStep === totalSteps ? handleSave : handleNext}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-8 h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-100 transition-all active:scale-95 disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {isEdit ? 'Updating...' : 'Saving...'}
                </>
              ) : (
                <>
                  {currentStep === totalSteps ? (
                    <>Review & Save <Eye className="h-5 w-5" /></>
                  ) : (
                    <>Next Step <ArrowRight className="h-5 w-5" /></>
                  )}
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
