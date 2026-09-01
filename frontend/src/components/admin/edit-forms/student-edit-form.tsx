"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calender";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Calendar as CalendarIcon } from "lucide-react";
import { getApiBaseUrl, getClassrooms, getStudentFormOptions, getAllCampuses, apiPatch } from "@/lib/api";
import { toast } from "sonner";
import { useAutoSave } from "@/hooks/useAutoSave";
import { SaveStatusIndicator } from "@/components/offline/SaveStatusIndicator";
import { DraftRecoveryDialog } from "@/components/offline/DraftRecoveryDialog";
import { useAppForm } from "@/hooks/useAppForm";
import { applyApiErrorsToForm } from "@/lib/validation/apiErrors";
import { studentEditSchema, type StudentEditInput } from "@/lib/validation/schemas/student.schema";
import { FormField } from "@/components/form/FormField";
import { FormSelect } from "@/components/form/FormSelect";
import { FormBanner } from "@/components/form/FormBanner";

// Minimal shape the parent needs to pass in — just enough to load + label the record.
export interface EditableStudent {
  id: number | string;
  name?: string;
}

export interface StudentEditFormProps {
  open: boolean;
  student: EditableStudent | null;
  /** Shared dropdown options (gender/religion/shift/...) already loaded by the page. */
  formOptions?: any;
  /** Campus list already loaded by the page (used for shift-availability). */
  campuses?: any[];
  onOpenChange: (open: boolean) => void;
  /** Called after a successful save so the parent can refresh its list. */
  onSaved: () => void;
}

// Normalize an international phone to the local 11-digit Pakistani format.
// +923121234133 -> 03121234133, already 03xx -> keep as is.
const normalizePhone = (phone: string | null | undefined): string => {
  if (!phone) return "";
  let p = phone.toString().trim();
  p = p.replace(/[\s\-]/g, "");
  if (p.startsWith("+92")) return "0" + p.slice(3);
  if (p.startsWith("92") && p.length === 12) return "0" + p.slice(2);
  return p;
};

// Fields not covered by the shared validation schema — either read-only
// (academic assignment, managed elsewhere) or non-text controls (photo,
// booleans). Kept as plain local state exactly like before.
interface ExtraFields {
  campus: string | number | null;
  current_grade: string;
  section: string;
  enrollment_year: string | number;
  shift: string;
  classroom: string | number | null;
  is_active: boolean;
  is_draft: string;
  photo: string | File | null;
  _alumni: boolean;
}

const EXTRA_DEFAULTS: ExtraFields = {
  campus: null,
  current_grade: "",
  section: "",
  enrollment_year: "",
  shift: "",
  classroom: null,
  is_active: true,
  is_draft: "false",
  photo: null,
  _alumni: false,
};

const EDIT_DEFAULTS: StudentEditInput = {
  name: "",
  gender: "",
  dob: "",
  place_of_birth: "",
  religion: "",
  mother_tongue: "",
  email: "",
  phone_number: "",
  emergency_contact: "",
  special_needs_disability: "",
  father_name: "",
  father_cnic: "",
  father_contact: "",
  father_profession: "",
  father_status: "",
  address: "",
  guardian_name: "",
  guardian_cnic: "",
  guardian_contact: "",
  guardian_relation: "",
  mother_name: "",
  mother_contact: "",
  mother_cnic: "",
  mother_profession: "",
  student_cnic: "",
  nationality: "",
  blood_group: "",
  family_income: "",
  zakat_status: "",
  house_owned: "",
}

/**
 * Self-contained Student edit dialog. The parent only controls visibility
 * (`open`) and passes the record to edit (`student`); this component fetches the
 * full record, owns all form state + validation + the PATCH, then calls
 * `onSaved()` so the parent can refresh. Keeps its OWN classroom list so it never
 * clobbers a shared list-page filter.
 */
export function StudentEditForm({
  open,
  student,
  formOptions: formOptionsProp,
  campuses: campusesProp = [],
  onOpenChange,
  onSaved,
}: StudentEditFormProps) {
  // Dropdown data: use what the parent passed, else fetch it once so the
  // component works standalone on any page (e.g. the coordinator student list).
  const [internalFormOptions, setInternalFormOptions] = useState<any>(null);
  const [internalCampuses, setInternalCampuses] = useState<any[]>([]);
  const formOptions = formOptionsProp ?? internalFormOptions;
  const campuses = campusesProp && campusesProp.length ? campusesProp : internalCampuses;

  useEffect(() => {
    if (!formOptionsProp) {
      getStudentFormOptions().then(setInternalFormOptions).catch(() => {});
    }
    if (!campusesProp || !campusesProp.length) {
      getAllCampuses()
        .then((d: any) => setInternalCampuses(Array.isArray(d) ? d : d?.results || []))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const form = useAppForm<StudentEditInput>({ schema: studentEditSchema, defaultValues: EDIT_DEFAULTS });
  const { register, control, watch, reset, getValues, setError, handleSubmit, formState: { errors } } = form;

  const [extraFields, setExtraFields] = useState<ExtraFields>(EXTRA_DEFAULTS);
  const updateExtra = (patch: Partial<ExtraFields>) => setExtraFields((prev) => ({ ...prev, ...patch }));

  // Offline auto-save (Phase 7) — edit mode, baselineSkip, sirf open par active.
  const studentEditDraftId = `edit-student-${student?.id ?? "unknown"}`;
  const watchedValues = watch();
  const { status: saveStatus, lastSavedAt, clearDraft } = useAutoSave<any>(
    studentEditDraftId,
    { ...watchedValues, ...extraFields },
    { enabled: open, baselineSkip: true }
  );

  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [banner, setBanner] = useState<string | undefined>();

  // Load the full student record whenever the dialog opens for a student.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!open || !student) return;
      try {
        const baseForRead = getApiBaseUrl();
        const cleanBaseForRead = baseForRead.endsWith("/") ? baseForRead.slice(0, -1) : baseForRead;
        const response = await fetch(`${cleanBaseForRead}/api/students/${student.id}/`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("sis_access_token")}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          console.error("Error fetching student data:", response.statusText);
          toast.error("Error loading student data");
          return;
        }

        const studentData = await response.json();
        if (cancelled) return;

        // Load full data; UI hides specific fields (grade/section/GR/shift/is_draft).
        reset({
          name: studentData.name || "",
          gender: studentData.gender || "",
          dob: studentData.dob || "",
          place_of_birth: studentData.place_of_birth || "",
          religion: studentData.religion || "",
          mother_tongue: studentData.mother_tongue || "",
          emergency_contact: normalizePhone(studentData.emergency_contact),
          special_needs_disability: studentData.special_needs_disability || "none",
          father_name: studentData.father_name || "",
          father_cnic: studentData.father_cnic ? studentData.father_cnic.replace(/\D/g, "") : "",
          father_contact: normalizePhone(studentData.father_contact),
          father_profession: studentData.father_profession || "",
          father_status: studentData.father_status || "",
          address: studentData.address || "",
          guardian_name: studentData.guardian_name || "",
          guardian_cnic: studentData.guardian_cnic ? String(studentData.guardian_cnic).replace(/\D/g, "") : "",
          guardian_contact: normalizePhone(studentData.guardian_contact),
          guardian_relation: studentData.guardian_relation || "",
          email: studentData.email || "",
          student_cnic: studentData.student_cnic ? String(studentData.student_cnic).replace(/\D/g, "") : "",
          nationality: studentData.nationality || "",
          blood_group: studentData.blood_group || "",
          phone_number: normalizePhone(studentData.phone_number),
          mother_name: studentData.mother_name || "",
          mother_contact: normalizePhone(studentData.mother_contact),
          mother_cnic: studentData.mother_cnic ? String(studentData.mother_cnic).replace(/\D/g, "") : "",
          mother_profession: studentData.mother_profession || "",
          zakat_status: studentData.zakat_status || "",
          family_income: studentData.family_income ?? "",
          house_owned: studentData.house_owned || "",
        });

        updateExtra({
          campus: typeof studentData.campus === "object" ? studentData.campus?.id : studentData.campus,
          current_grade: studentData.current_grade || "",
          section: studentData.section || "",
          enrollment_year: studentData.enrollment_year || "",
          shift: studentData.shift || "",
          is_draft: studentData.is_draft ? "true" : "false",
          is_active: studentData.is_active !== undefined ? studentData.is_active : true,
          classroom: studentData.classroom || studentData.classroom_id || "",
          photo: studentData.photo || null,
          _alumni: false,
        });

        // Fetch classrooms for this student's campus + shift (own state, never the page's).
        if (studentData.campus) {
          const campusId = typeof studentData.campus === "object" ? studentData.campus.id : studentData.campus;
          const studentShift = studentData.shift || "";
          try {
            const classroomsData: any = await getClassrooms(undefined, undefined, campusId, studentShift);
            const classroomsList: any[] = Array.isArray(classroomsData)
              ? classroomsData
              : Array.isArray(classroomsData?.results)
                ? classroomsData.results
                : [];
            if (!cancelled) setClassrooms(classroomsList);
          } catch (error) {
            console.error("Error fetching classrooms:", error);
            if (!cancelled) setClassrooms([]);
          }
        }
      } catch (error) {
        console.error("Error fetching student data:", error);
        toast.error("Error loading student data");
      }
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, student?.id]);

  const handleClose = () => {
    onOpenChange(false);
    reset(EDIT_DEFAULTS);
    setExtraFields(EXTRA_DEFAULTS);
    setBanner(undefined);
  };

  const handleDobSelect = (date: Date | undefined) => {
    if (date) {
      const iso = date.toISOString().slice(0, 10);
      form.setValue("dob", iso, { shouldValidate: true });
    }
    setShowDobPicker(false);
  };

  const handleDeletePhoto = async () => {
    if (!student) return;

    // Photo not uploaded yet (a File) — just clear it locally.
    if (extraFields.photo && extraFields.photo instanceof File) {
      updateExtra({ photo: null });
      return;
    }

    try {
      const baseForUpdate = getApiBaseUrl();
      const cleanBaseForUpdate = baseForUpdate.endsWith("/") ? baseForUpdate.slice(0, -1) : baseForUpdate;
      const resp = await fetch(`${cleanBaseForUpdate}/api/students/${student.id}/delete-photo/`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("sis_access_token")}`,
        },
      });

      if (resp.ok) {
        updateExtra({ photo: null });
        toast.success(" Photo deleted");
      } else {
        const text = await resp.text();
        console.error("Failed to delete photo:", resp.status, text);
        toast.error(`Error deleting photo: ${resp.status} - ${text}`);
      }
    } catch (err) {
      console.error("Error deleting photo:", err);
      toast.error("Error deleting photo");
    }
  };

  const onSubmit = async () => {
    if (!student) return;
    setBanner(undefined);
    setIsSubmitting(true);
    try {
      // Upload a new photo first if present.
      let photoUrl = extraFields.photo;
      if (extraFields.photo && extraFields.photo instanceof File) {
        const photoForm = new FormData();
        photoForm.append("photo", extraFields.photo);

        const baseForUpdate = getApiBaseUrl();
        const cleanBaseForUpdate = baseForUpdate.endsWith("/") ? baseForUpdate.slice(0, -1) : baseForUpdate;

        try {
          const photoResponse = await fetch(`${cleanBaseForUpdate}/api/students/${student.id}/upload-photo/`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${localStorage.getItem("sis_access_token")}`,
            },
            body: photoForm,
          });

          if (photoResponse.ok) {
            const photoData = await photoResponse.json();
            photoUrl = photoData.photo_url;
            updateExtra({ photo: photoUrl });
          }
        } catch (error) {
          console.error("Error uploading photo:", error);
        }
      }

      // Combine RHF-managed fields with the read-only/non-text extra fields —
      // getValues() (not the resolver-validated output) so nothing gets
      // silently stripped by the schema.
      const combined: Record<string, any> = { ...getValues(), ...extraFields };

      // Academic Information is view-only in the edit form — never modify grade,
      // section, enrollment year, shift or classroom from here.
      const excludeKeys = new Set([
        "current_grade",
        "section",
        "enrollment_year",
        "classroom",
        "shift",
        "gr_no",
        "is_draft",
        "photo",
        "_alumni",
      ]);
      const updateData: any = {};

      if (extraFields._alumni) {
        updateData.classroom = null;
        updateData.current_grade = "Alumni";
        updateData.section = null;
        updateData.is_active = false;
      }
      Object.keys(combined).forEach((key) => {
        if (excludeKeys.has(key)) return;
        if (key === "classroom") {
          updateData[key] = combined[key] !== undefined ? combined[key] || null : undefined;
        } else if (combined[key] !== "" && combined[key] !== null && combined[key] !== undefined) {
          updateData[key] = combined[key];
        }
      });

      // Phone fields back to international format for the backend.
      const phoneFields = ["phone_number", "emergency_contact", "father_contact", "mother_contact", "guardian_contact"];
      phoneFields.forEach((field) => {
        if (combined[field] && typeof combined[field] === "string") {
          let p = combined[field].trim();
          if (p.startsWith("0")) {
            updateData[field] = "+92" + p.slice(1);
          } else if (p.startsWith("+92")) {
            updateData[field] = p;
          } else if (p && !p.startsWith("+")) {
            updateData[field] = "+92" + p;
          }
        }
      });

      await apiPatch(`/api/students/${student.id}/`, updateData);

      toast.success("Student Updated", {
        description: `Student ${combined.name || student.name} has been updated successfully!`,
      });
      clearDraft();
      onOpenChange(false);
      reset(EDIT_DEFAULTS);
      setExtraFields(EXTRA_DEFAULTS);
      onSaved();
    } catch (error) {
      const message = applyApiErrorsToForm(setError, error);
      if (message) setBanner(message);
      toast.error("Update Failed", { description: message || "Please check the highlighted fields." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto px-4 sm:px-6 py-6 rounded-3xl hide-scrollbar">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 pr-6">
            <DialogTitle className="text-2xl font-bold transition-all duration-150 ease-in-out transform hover:shadow-lg active:scale-95 active:shadow-md" style={{ color: "#274c77" }}>
              Edit Student - {student?.name}
            </DialogTitle>
            <SaveStatusIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
          </div>
        </DialogHeader>

        {/* Offline: modal khulte hi adhoora edit-draft mila to restore prompt. */}
        <DraftRecoveryDialog<any>
          formId={studentEditDraftId}
          onRestore={(d) => {
            reset(d);
            updateExtra(d);
          }}
        />

        {banner && <FormBanner message={banner} onDismiss={() => setBanner(undefined)} />}

        <div className="space-y-6 text-sm sm:text-base">
          {/* Personal Information */}
          <div className="bg-gray-50 p-4 sm:p-5 rounded-2xl border border-[#e4ecf5] shadow-inner">
            <h3 className="text-lg font-semibold mb-4" style={{ color: "#274c77" }}>Personal Information</h3>

            {/* Photo Upload */}
            <div className="mb-6">
              <Label htmlFor="photo">Profile Photo</Label>
              <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
                {extraFields.photo ? (
                  <div className="relative">
                    <img
                      src={typeof extraFields.photo === "string" ? extraFields.photo : URL.createObjectURL(extraFields.photo)}
                      alt="Student photo"
                      className="w-24 h-24 object-cover rounded-lg border-2 border-gray-200"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                      onClick={async () => {
                        if (extraFields.photo && extraFields.photo instanceof File) {
                          updateExtra({ photo: null });
                          return;
                        }
                        await handleDeletePhoto();
                      }}
                    >
                      ×
                    </Button>
                  </div>
                ) : (
                  <div className="w-24 h-24 flex items-center justify-center rounded-lg border-2 border-dashed border-gray-200">
                    <User className="h-8 w-8 text-gray-400" />
                  </div>
                )}
                <div className="flex-1">
                  <Input
                    id="photo"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) updateExtra({ photo: file });
                    }}
                    className="mt-1"
                  />
                  <p className="mt-1 text-xs text-gray-500">Upload a profile photo (JPG, PNG)</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Full Name" {...register("name")} error={errors.name} placeholder="Enter full name" />

              <FormSelect
                control={control}
                name="gender"
                label="Gender"
                placeholder="Select gender"
                options={(formOptions?.gender || [{ value: "male", label: "Male" }, { value: "female", label: "Female" }]).map((o: any) => ({ value: o.value, label: o.label }))}
              />

              <div>
                <Label htmlFor="dob">Date of Birth</Label>
                <Popover open={showDobPicker} onOpenChange={setShowDobPicker}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={`w-full h-10 justify-start text-left font-normal ${!watch("dob") ? "text-muted-foreground" : ""}`}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {watch("dob") ? new Date(watch("dob")).toLocaleDateString() : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={watch("dob") ? new Date(watch("dob")) : undefined}
                      onSelect={handleDobSelect}
                      disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {errors.dob?.message && <p className="mt-1 text-xs text-red-600">{errors.dob.message}</p>}
              </div>

              <FormField label="Place of Birth" {...register("place_of_birth")} error={errors.place_of_birth} placeholder="Enter place of birth" />

              <FormSelect
                control={control}
                name="religion"
                label="Religion"
                placeholder="Select religion"
                options={(formOptions?.religion || []).map((o: any) => ({ value: o.value, label: o.label }))}
              />

              <FormSelect
                control={control}
                name="mother_tongue"
                label="Mother Tongue"
                placeholder="Select mother tongue"
                options={(formOptions?.mother_tongue || []).map((o: any) => ({ value: o.value, label: o.label }))}
              />

              <FormField
                label="Student B-Form / CNIC"
                maxLength={13}
                error={errors.student_cnic}
                placeholder="Enter 13-digit CNIC / B-Form"
                {...register("student_cnic", { onChange: (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 13) } })}
              />

              <FormSelect
                control={control}
                name="nationality"
                label="Nationality"
                placeholder="Select nationality"
                options={(formOptions?.nationality || []).map((o: any) => ({ value: o.value, label: o.label }))}
              />

              <FormSelect
                control={control}
                name="blood_group"
                label="Blood Group"
                placeholder="Select blood group"
                options={(formOptions?.blood_group || []).map((o: any) => ({ value: o.value, label: o.label }))}
              />

              <FormField
                label="Student Phone"
                type="tel"
                maxLength={11}
                error={errors.phone_number}
                placeholder="Enter student phone (11 digits)"
                {...register("phone_number", { onChange: (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 11) } })}
              />

              <FormField
                label="Emergency Contact"
                type="tel"
                maxLength={11}
                error={errors.emergency_contact}
                hint={!errors.emergency_contact ? "Must be exactly 11 digits and make sure start with 03" : undefined}
                placeholder="Enter emergency contact (11 digits)"
                {...register("emergency_contact", { onChange: (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 11) } })}
              />

              <FormField
                label="Student Email"
                type="email"
                {...register("email")}
                error={errors.email}
                hint="Optional. Can be used for login."
                placeholder="Enter student email"
              />

              <FormSelect
                control={control}
                name="special_needs_disability"
                label="Special Needs / Disability"
                placeholder="Select status"
                options={
                  formOptions?.special_needs || [
                    { value: "none", label: "None" },
                    { value: "physical", label: "Physical Disability" },
                    { value: "visual", label: "Visual Impairment" },
                    { value: "hearing", label: "Hearing Impairment" },
                    { value: "learning", label: "Learning Disability" },
                    { value: "other", label: "Other" },
                  ]
                }
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="is_active">Student Status</Label>
                  <Select
                    value={extraFields.is_active !== undefined ? (extraFields.is_active ? "true" : "false") : "true"}
                    onValueChange={(value) => updateExtra({ is_active: value === "true" })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Active</SelectItem>
                      <SelectItem value="false">Inactive (Left)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <FormField
                as="textarea"
                containerClassName="md:col-span-2"
                label="Permanent Address"
                {...register("address")}
                error={errors.address}
                placeholder="Enter permanent address"
                rows={3}
                className="resize-none"
              />
            </div>
          </div>

          {/* Father Information */}
          <div className="bg-gray-50 p-4 sm:p-5 rounded-2xl border border-[#e4ecf5] shadow-inner">
            <h3 className="text-lg font-semibold mb-4" style={{ color: "#274c77" }}>Father Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Father Name" {...register("father_name")} error={errors.father_name} placeholder="Enter father name" />

              <FormField
                label="Father CNIC"
                maxLength={13}
                error={errors.father_cnic}
                hint={!errors.father_cnic ? "Must be exactly 13 digits" : undefined}
                placeholder="Enter father CNIC (13 digits)"
                {...register("father_cnic", { onChange: (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 13) } })}
              />

              <FormField
                label="Father Contact"
                type="tel"
                maxLength={11}
                error={errors.father_contact}
                hint={!errors.father_contact ? "Must be exactly 11 digits and make sure start with 03" : undefined}
                placeholder="Enter father contact (11 digits)"
                {...register("father_contact", { onChange: (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 11) } })}
              />

              <FormField label="Father Profession" {...register("father_profession")} error={errors.father_profession} placeholder="Enter father profession" />

              <FormSelect
                control={control}
                name="father_status"
                label="Father Status"
                placeholder="Select father status"
                options={formOptions?.father_status || [{ value: "alive", label: "Alive" }, { value: "dead", label: "Dead" }]}
              />
            </div>
          </div>

          {/* Mother Information */}
          <div className="bg-gray-50 p-4 sm:p-5 rounded-2xl border border-[#e4ecf5] shadow-inner">
            <h3 className="text-lg font-semibold mb-4" style={{ color: "#274c77" }}>Mother Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Mother Name" {...register("mother_name")} error={errors.mother_name} placeholder="Enter mother name" />

              <FormField
                label="Mother Contact"
                type="tel"
                maxLength={11}
                error={errors.mother_contact}
                placeholder="Enter mother contact (11 digits)"
                {...register("mother_contact", { onChange: (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 11) } })}
              />
            </div>
          </div>

          {/* Guardian Information */}
          <div className="bg-gray-50 p-4 sm:p-5 rounded-2xl border border-[#e4ecf5] shadow-inner">
            <h3 className="text-lg font-semibold mb-4" style={{ color: "#274c77" }}>Guardian Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Guardian Name" {...register("guardian_name")} error={errors.guardian_name} placeholder="Enter guardian name" />

              <FormField label="Relation" {...register("guardian_relation")} error={errors.guardian_relation} placeholder="e.g. Uncle" />

              <FormField
                label="Guardian Contact"
                type="tel"
                maxLength={11}
                error={errors.guardian_contact}
                placeholder="Enter guardian contact (11 digits)"
                {...register("guardian_contact", { onChange: (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 11) } })}
              />

              <FormField
                label="Guardian CNIC"
                maxLength={13}
                error={errors.guardian_cnic}
                placeholder="Enter guardian CNIC (13 digits)"
                {...register("guardian_cnic", { onChange: (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 13) } })}
              />
            </div>
          </div>

          {/* Family & Financial Information */}
          <div className="bg-gray-50 p-4 sm:p-5 rounded-2xl border border-[#e4ecf5] shadow-inner">
            <h3 className="text-lg font-semibold mb-4" style={{ color: "#274c77" }}>Family &amp; Financial Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                label="Monthly Family Income"
                type="number"
                min="0"
                {...register("family_income")}
                error={errors.family_income}
                placeholder="Enter monthly family income"
              />

              <FormSelect
                control={control}
                name="zakat_status"
                label="Zakat Status"
                placeholder="Select zakat status"
                options={formOptions?.zakat_status || [{ value: "applicable", label: "Applicable" }, { value: "not_applicable", label: "Not Applicable" }]}
              />

              <FormSelect
                control={control}
                name="house_owned"
                label="House Owned"
                placeholder="Select house ownership"
                options={formOptions?.house_owned || [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]}
              />
            </div>
          </div>

          {/* Academic Information */}
          <div className="bg-gray-50 p-4 sm:p-5 rounded-2xl border border-[#e4ecf5] shadow-inner">
            <h3 className="text-lg font-semibold mb-4" style={{ color: "#274c77" }}>Academic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="current_grade">Current Grade</Label>
                <Input
                  id="current_grade"
                  value={extraFields.current_grade || ""}
                  readOnly
                  disabled
                  className="bg-gray-100 cursor-not-allowed"
                  placeholder="Current grade"
                />
              </div>
              <div>
                <Label htmlFor="section">Current Section</Label>
                <Input
                  id="section"
                  value={extraFields.section || ""}
                  readOnly
                  disabled
                  className="bg-gray-100 cursor-not-allowed"
                  placeholder="Current section"
                />
              </div>
              <div>
                <Label htmlFor="enrollment_year">Enrollment Year</Label>
                <Input
                  id="enrollment_year"
                  type="number"
                  value={extraFields.enrollment_year || ""}
                  readOnly
                  disabled
                  className="bg-gray-100 cursor-not-allowed"
                  placeholder="Enrollment year"
                />
              </div>
              <div>
                <Label htmlFor="shift">Shift</Label>
                <Select value={extraFields.shift || ""} disabled onValueChange={(value) => updateExtra({ shift: value })}>
                  <SelectTrigger className="bg-gray-100 cursor-not-allowed">
                    <SelectValue placeholder="Select shift" />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const campusObj = campuses.find((c) => String(c.id) === String(extraFields.campus));
                      const shiftAvailable = campusObj?.shift_available || "both";

                      const options = formOptions?.shift || [
                        { value: "morning", label: "Morning" },
                        { value: "afternoon", label: "Afternoon" },
                      ];

                      if (shiftAvailable === "both") {
                        return options.map((opt: any) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ));
                      } else {
                        return options
                          .filter((opt: any) => opt.value === shiftAvailable)
                          .map((opt: any) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ));
                      }
                    })()}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="classroom">Classroom</Label>
                <Select
                  value={extraFields._alumni ? "alumni" : extraFields.classroom ? String(extraFields.classroom) : "none"}
                  disabled
                  onValueChange={(value) => {
                    if (value === "alumni") {
                      updateExtra({ classroom: null, _alumni: true });
                    } else if (value === "none") {
                      updateExtra({ classroom: null, _alumni: false });
                    } else {
                      updateExtra({ classroom: parseInt(value), _alumni: false });
                    }
                  }}
                >
                  <SelectTrigger className="bg-gray-100 cursor-not-allowed">
                    <SelectValue placeholder="Select classroom" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Classroom</SelectItem>
                    <SelectItem value="alumni">Alumni</SelectItem>
                    {classrooms.map((classroom: any) => (
                      <SelectItem key={classroom.id} value={String(classroom.id)}>
                        {classroom.grade?.name || classroom.grade_name || "N/A"} - {classroom.section || "N/A"} ({classroom.shift || "N/A"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-gray-500">
                  Select the correct classroom for this student. This will automatically update the student's class assignment.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-end gap-3 mt-6 transition-all duration-150">
          <Button onClick={handleClose} variant="outline" className="px-6 w-full sm:w-auto">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            className="px-6 w-full sm:w-auto"
            style={{ backgroundColor: "#6096ba" }}
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Updating...
              </>
            ) : (
              "Update Student"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default StudentEditForm;
