"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronsUpDown, Check, Plus, X, MapPin, Search, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { getApiBaseUrl, getSubjects, getGrades, getClassrooms, getAllCampuses } from "@/lib/api";
import { toast } from "sonner";
import { useAutoSave } from "@/hooks/useAutoSave";
import { SaveStatusIndicator } from "@/components/offline/SaveStatusIndicator";
import { DraftRecoveryDialog } from "@/components/offline/DraftRecoveryDialog";
import { parseField } from "@/lib/validation/common";
import { teacherEditSchema } from "@/lib/validation/schemas/teacher.schema";

/**
 * A native (non-cmdk) searchable multi-select list used inside a Popover.
 * Uses a plain overflow-y-auto div so scrolling works with trackpad/wheel
 * (the cmdk Command list didn't scroll on trackpad), and matches selection by
 * EXACT key so "Grade X" is never considered selected when "Grade XI" is.
 */
function SearchableMultiSelect({
  items,
  selectedKeys,
  onToggle,
  searchPlaceholder = "Search...",
  emptyText = "No results.",
}: {
  items: { key: string; label: string }[];
  selectedKeys: string[];
  onToggle: (key: string) => void;
  searchPlaceholder?: string;
  emptyText?: string;
}) {
  const [q, setQ] = useState("");
  const filtered = q.trim() ? items.filter((i) => i.label.toLowerCase().includes(q.trim().toLowerCase())) : items;
  return (
    <div className="bg-white">
      <div className="flex items-center gap-2 border-b px-3">
        <Search className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
        />
      </div>
      <div className="max-h-[220px] overflow-y-auto p-1" style={{ overscrollBehavior: "contain" }}>
        {filtered.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-gray-400">{emptyText}</p>
        ) : (
          filtered.map((i) => {
            const isSelected = selectedKeys.includes(i.key);
            return (
              <button
                type="button"
                key={i.key}
                onClick={() => onToggle(i.key)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-gray-100"
              >
                <Check className={cn("h-4 w-4 shrink-0", isSelected ? "opacity-100 text-[#274c77]" : "opacity-0")} />
                <span className="truncate">{i.label}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export interface EditableTeacher {
  id: number | string;
  full_name?: string;
  current_campus?: any;
}

export interface TeacherEditFormProps {
  open: boolean;
  teacher: EditableTeacher | null;
  /** Campus list (for shift availability). If omitted, the component fetches it. */
  campuses?: any[];
  onOpenChange: (open: boolean) => void;
  /** Called after a successful save so the parent can refresh its list. */
  onSaved: () => void;
}

/**
 * Self-contained Teacher edit dialog. Shares the same visual language as the
 * Student edit form (gray section cards, #274c77 headings, 2-col grid). Fetches
 * the full record, owns all form state (incl. subject/class multi-selects +
 * subject-assignment rows) and campus-scoped options, then calls `onSaved()`.
 */
export function TeacherEditForm({
  open,
  teacher,
  campuses: campusesProp = [],
  onOpenChange,
  onSaved,
}: TeacherEditFormProps) {
  const [editFormData, setEditFormData] = useState<any>({});

  // Offline auto-save (Phase 7) — edit mode, baselineSkip, sirf open par active.
  const teacherEditDraftId = `edit-teacher-${teacher?.id ?? "unknown"}`;
  const { status: saveStatus, lastSavedAt, clearDraft } = useAutoSave<any>(
    teacherEditDraftId,
    editFormData,
    { enabled: open, baselineSkip: true }
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allEditClassrooms, setAllEditClassrooms] = useState<any[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<any[]>([]);
  const [availableClasses, setAvailableClasses] = useState<any[]>([]);
  const [openSubjectsDropdown, setOpenSubjectsDropdown] = useState(false);
  const [openClassesDropdown, setOpenClassesDropdown] = useState(false);
  const [openAssignedClassroomsDropdown, setOpenAssignedClassroomsDropdown] = useState(false);
  const [internalCampuses, setInternalCampuses] = useState<any[]>([]);
  const campuses = campusesProp && campusesProp.length ? campusesProp : internalCampuses;
  // Per-field validation messages shown inline under each field.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const labelFor = (f: string) => {
    const labels: Record<string, string> = {
      full_name: "Full Name",
      email: "Email",
      contact_number: "Contact Number",
      cnic: "CNIC",
    };
    return labels[f] || f.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  };

  // Update a form field and clear any error currently shown for it.
  const updateField = (field: string, value: any) => {
    setEditFormData((prev: any) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  // Client-side format checks → instant, specific feedback before the request.
  const validateClientSide = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    const phone = parseField(teacherEditSchema.entries.contact_number, editFormData.contact_number ?? "");
    if (!phone.isValid) errs.contact_number = phone.message!;
    const cnic = parseField(teacherEditSchema.entries.cnic, editFormData.cnic ?? "");
    if (!cnic.isValid) errs.cnic = cnic.message!;
    const email = parseField(teacherEditSchema.entries.email, editFormData.email ?? "");
    if (!email.isValid) errs.email = email.message!;
    return errs;
  };

  useEffect(() => {
    if (!campusesProp || !campusesProp.length) {
      getAllCampuses()
        .then((d: any) => setInternalCampuses(Array.isArray(d) ? d : d?.results || []))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the full teacher record whenever the dialog opens for a teacher.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!open || !teacher) return;
      try {
        const baseForRead = getApiBaseUrl();
        const cleanBaseForRead = baseForRead.endsWith("/") ? baseForRead.slice(0, -1) : baseForRead;
        const response = await fetch(`${cleanBaseForRead}/api/teachers/${teacher.id}/`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("sis_access_token")}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          console.error("Error fetching teacher data:", response.statusText);
          toast.error("Error loading teacher data");
          return;
        }

        const teacherData = await response.json();
        if (cancelled) return;

        if (Array.isArray(teacherData.assigned_classrooms_details)) {
          setAllEditClassrooms((prev: any[]) => {
            const existingIds = new Set(prev.map((c) => c.id));
            const newClassrooms = teacherData.assigned_classrooms_details.filter((c: any) => !existingIds.has(c.id));
            return [...prev, ...newClassrooms];
          });
        }

        setEditFormData({
          full_name: teacherData.full_name || "",
          photo: teacherData.photo || null,
          father_name: teacherData.father_name || "",
          email: teacherData.email || "",
          contact_number: teacherData.contact_number || "",
          dob: teacherData.dob || "",
          gender: (teacherData.gender || "").toLowerCase(),
          permanent_address: teacherData.permanent_address || "",
          current_address: teacherData.current_address || "",
          marital_status: teacherData.marital_status || "",
          cnic: teacherData.cnic || "",
          education_level: teacherData.education_level || "",
          institution_name: teacherData.institution_name || "",
          year_of_passing: teacherData.year_of_passing || "",
          education_subjects: teacherData.education_subjects || "",
          education_grade: teacherData.education_grade || "",
          previous_institution_name: teacherData.previous_institution_name || "",
          previous_position: teacherData.previous_position || "",
          experience_from_date: teacherData.experience_from_date || "",
          experience_to_date: teacherData.experience_to_date || "",
          experience_subjects_classes_taught: teacherData.experience_subjects_classes_taught || "",
          previous_responsibilities: teacherData.previous_responsibilities || "",
          total_experience_years: teacherData.total_experience_years || "",
          joining_date: teacherData.joining_date || "",
          current_role_title: teacherData.current_role_title || "",
          current_campus: teacherData.current_campus || "",
          current_subjects:
            teacherData.current_subjects && teacherData.current_subjects.toLowerCase() !== "none"
              ? Array.from(new Set(teacherData.current_subjects.split(",").map((s: string) => s.trim()).filter(Boolean))).join(", ")
              : "",
          current_classes_taught:
            teacherData.current_classes_taught && teacherData.current_classes_taught.toLowerCase() !== "none"
              ? Array.from(new Set(teacherData.current_classes_taught.split(",").map((s: string) => s.trim()).filter(Boolean))).join(", ")
              : "",
          current_extra_responsibilities: teacherData.current_extra_responsibilities || "",
          role_start_date: teacherData.role_start_date || "",
          role_end_date: teacherData.role_end_date || "",
          biometric_id: teacherData.biometric_id || "",
          is_currently_active: teacherData.is_currently_active ? "true" : "false",
          shift: teacherData.shift || "",
          is_class_teacher: teacherData.is_class_teacher ? "true" : "false",
          is_subject_teacher: teacherData.is_subject_teacher ? "true" : "false",
          is_teacher_assistant: teacherData.is_teacher_assistant ? "true" : "false",
          assigned_classrooms_display: teacherData.assigned_classrooms_display || teacherData.classroom_name || "",
          assigned_classrooms: Array.isArray(teacherData.assigned_classrooms) ? teacherData.assigned_classrooms : [],
          subject_teacher_assignments: Array.isArray(teacherData.subject_assignments)
            ? teacherData.subject_assignments.map((sa: any) => ({
                classroom_id: String(sa.classroom || sa.classroom_id || ""),
                subject_id: String(sa.subject || sa.subject_id || ""),
              }))
            : [],
          save_status: ["draft", "final"].includes(teacherData.save_status) ? teacherData.save_status : "final",
        });
      } catch (error) {
        console.error("Error fetching teacher data:", error);
        toast.error("Error loading teacher data");
      }
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, teacher?.id]);

  // Load campus-scoped subjects / grades / classrooms when the campus changes.
  useEffect(() => {
    let cancelled = false;
    const campusId = editFormData.current_campus ? parseInt(editFormData.current_campus) : undefined;

    getSubjects({ is_active: true, campus: campusId })
      .then((data) => {
        if (!cancelled && Array.isArray(data)) {
          const uniqueSubjects = [];
          const seen = new Set();
          for (const s of data) {
            const name = (s.name || s.subject_name || "").trim();
            if (name && !seen.has(name)) {
              seen.add(name);
              uniqueSubjects.push(s);
            }
          }
          setAvailableSubjects(uniqueSubjects);
        }
      })
      .catch(console.error);

    getGrades(undefined, campusId)
      .then((data) => {
        const list = Array.isArray(data) ? data : Array.isArray((data as any)?.results) ? (data as any).results : [];
        if (!cancelled) {
          const uniqueGrades = [];
          const seen = new Set();
          for (const g of list) {
            const name = (g.name || "").trim();
            const key = name.toLowerCase();
            if (name && !seen.has(key)) {
              seen.add(key);
              uniqueGrades.push({ ...g, displayName: name });
            }
          }
          setAvailableClasses(uniqueGrades);
        }
      })
      .catch(console.error);

    getClassrooms(undefined, undefined, campusId)
      .then((data: any) => {
        const list = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];
        if (!cancelled) setAllEditClassrooms(list);
      })
      .catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [editFormData.current_campus]);

  // Auto-sync the Role title from the teacher-type booleans.
  useEffect(() => {
    if (!open) return;
    const isCT = editFormData.is_class_teacher === "true";
    const isST = editFormData.is_subject_teacher === "true";
    const isAT = editFormData.is_teacher_assistant === "true";

    let role = editFormData.current_role_title;
    if (isAT) role = "Assistant Teacher";
    else if (isCT && isST) role = "Class + Subject";
    else if (isCT) role = "Class Teacher";
    else if (isST) role = "Subject Teacher";

    if (role && role !== editFormData.current_role_title) {
      setEditFormData((prev: any) => ({ ...prev, current_role_title: role }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editFormData.is_class_teacher, editFormData.is_subject_teacher, editFormData.is_teacher_assistant, open]);

  const toggleMultiSelect = (field: string, itemValue: string) => {
    const currentStr = editFormData[field] || "";
    const currentArr = currentStr.split(",").map((s: string) => s.trim()).filter(Boolean);
    if (currentArr.includes(itemValue)) {
      setEditFormData({ ...editFormData, [field]: currentArr.filter((s: string) => s !== itemValue).join(", ") });
    } else {
      setEditFormData({ ...editFormData, [field]: [...currentArr, itemValue].join(", ") });
    }
  };

  const toggleIdMultiSelect = (field: string, id: number) => {
    const currentArr = Array.isArray(editFormData[field]) ? editFormData[field] : [];
    if (currentArr.includes(id)) {
      setEditFormData({ ...editFormData, [field]: currentArr.filter((i: number) => i !== id) });
    } else {
      setEditFormData({ ...editFormData, [field]: [...currentArr, id] });
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setEditFormData({});
    setFieldErrors({});
  };

  // Remove the profile photo. If it's an un-uploaded File, just clear locally;
  // otherwise call the backend delete-photo action.
  const handleDeletePhoto = async () => {
    if (!teacher) return;
    if (editFormData.photo && editFormData.photo instanceof File) {
      setEditFormData((prev: any) => ({ ...prev, photo: null }));
      return;
    }
    try {
      const b = getApiBaseUrl();
      const cb = b.endsWith("/") ? b.slice(0, -1) : b;
      const resp = await fetch(`${cb}/api/teachers/${teacher.id}/delete-photo/`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("sis_access_token")}` },
      });
      if (resp.ok) {
        setEditFormData((prev: any) => ({ ...prev, photo: null }));
        toast.success("Photo deleted");
      } else {
        toast.error(`Error deleting photo: ${resp.status}`);
      }
    } catch (err) {
      console.error("Error deleting photo:", err);
      toast.error("Error deleting photo");
    }
  };

  const handleEditSubmit = async () => {
    if (!teacher) return;

    // Validate on the client first — instant, specific feedback (no round-trip).
    const clientErrors = validateClientSide();
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      toast.error("Please fix the highlighted fields", {
        description: (
          <ul className="mt-1 list-disc pl-4 text-xs opacity-90 space-y-0.5">
            {Object.entries(clientErrors).map(([f, m]) => (
              <li key={f}>
                <span className="font-semibold">{labelFor(f)}:</span> {m}
              </li>
            ))}
          </ul>
        ),
      });
      return;
    }
    setFieldErrors({});

    setIsSubmitting(true);
    try {
      // Upload a new photo first if the user picked a file (multipart, separate endpoint).
      if (editFormData.photo && editFormData.photo instanceof File) {
        const photoForm = new FormData();
        photoForm.append("photo", editFormData.photo);
        const pb = getApiBaseUrl();
        const pcb = pb.endsWith("/") ? pb.slice(0, -1) : pb;
        try {
          const photoResponse = await fetch(`${pcb}/api/teachers/${teacher.id}/upload-photo/`, {
            method: "POST",
            headers: { Authorization: `Bearer ${localStorage.getItem("sis_access_token")}` },
            body: photoForm,
          });
          if (photoResponse.ok) {
            const photoData = await photoResponse.json();
            setEditFormData((prev: any) => ({ ...prev, photo: photoData.photo_url }));
          } else {
            const t = await photoResponse.json().catch(() => ({}));
            toast.error(t?.detail || "Photo upload failed");
          }
        } catch (error) {
          console.error("Error uploading photo:", error);
        }
      }

      const updateData: any = {};
      Object.keys(editFormData).forEach((key) => {
        // photo is handled via its own endpoint above — never send it in the JSON PATCH.
        if (key === "photo") return;
        if (editFormData[key] !== "" && editFormData[key] !== null && editFormData[key] !== undefined) {
          updateData[key] = editFormData[key];
        }
      });

      if (editFormData.dob === "" || editFormData.dob === null || editFormData.dob === undefined) updateData.dob = null;
      if (editFormData.joining_date === "" || editFormData.joining_date === null || editFormData.joining_date === undefined)
        updateData.joining_date = null;
      if (
        editFormData.experience_from_date === "" ||
        editFormData.experience_from_date === null ||
        editFormData.experience_from_date === undefined
      )
        updateData.experience_from_date = null;
      if (
        editFormData.experience_to_date === "" ||
        editFormData.experience_to_date === null ||
        editFormData.experience_to_date === undefined
      )
        updateData.experience_to_date = null;

      if (updateData.year_of_passing) updateData.year_of_passing = parseInt(updateData.year_of_passing);
      if (updateData.total_experience_years) updateData.total_experience_years = parseFloat(updateData.total_experience_years);
      if (updateData.is_currently_active) updateData.is_currently_active = updateData.is_currently_active === "true";
      if (updateData.is_class_teacher) updateData.is_class_teacher = updateData.is_class_teacher === "true";
      if (updateData.is_subject_teacher !== undefined) updateData.is_subject_teacher = updateData.is_subject_teacher === "true";
      if (updateData.is_teacher_assistant !== undefined)
        updateData.is_teacher_assistant = updateData.is_teacher_assistant === "true";

      if (updateData.is_class_teacher === false) {
        updateData.assigned_classrooms = [];
      } else if (Array.isArray(updateData.assigned_classrooms)) {
        updateData.assigned_classrooms = updateData.assigned_classrooms.map((id: any) => parseInt(String(id)));
      }

      if (Array.isArray(updateData.subject_teacher_assignments)) {
        updateData.subject_teacher_assignments = updateData.subject_teacher_assignments
          .filter((a: any) => a.classroom_id && a.subject_id)
          .map((a: any) => ({
            classroom_id: parseInt(String(a.classroom_id)),
            subject_id: parseInt(String(a.subject_id)),
          }));
      } else {
        updateData.subject_teacher_assignments = [];
      }
      if (updateData.gender) updateData.gender = updateData.gender.toLowerCase();

      const baseForUpdate = getApiBaseUrl();
      const cleanBaseForUpdate = baseForUpdate.endsWith("/") ? baseForUpdate.slice(0, -1) : baseForUpdate;
      const response = await fetch(`${cleanBaseForUpdate}/api/teachers/${teacher.id}/`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("sis_access_token")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        toast.success(`Teacher ${editFormData.full_name || teacher.full_name} has been updated successfully!`);
        clearDraft();
        onOpenChange(false);
        setEditFormData({});
        onSaved();
      } else {
        const errorText = await response.text();
        console.error("Error updating teacher:", response.status, errorText);
        const mapped: Record<string, string> = {};
        const summary: string[] = [];
        try {
          const errorData = JSON.parse(errorText);
          // API wraps errors as { success:false, error:{ message, details:{field:[msg]} } }.
          const fieldDict = errorData?.error?.details || errorData;
          const topMessage = errorData?.error?.message || "";
          if (fieldDict && typeof fieldDict === "object") {
            Object.entries(fieldDict).forEach(([field, val]) => {
              let msg = Array.isArray(val) ? val.join(" ") : String(val);
              if (field === "non_field_errors" || field === "detail") {
                summary.push(msg);
                return;
              }
              // Friendlier "already registered" for the unique email / CNIC.
              if (/already exists|unique/i.test(msg)) {
                if (field === "email") msg = "This email is already registered to another teacher.";
                else if (field === "cnic") msg = "This CNIC is already registered to another teacher.";
              }
              mapped[field] = msg;
              summary.push(`${labelFor(field)}: ${msg}`);
            });
          }
          if (summary.length === 0 && topMessage) summary.push(topMessage);
        } catch {
          summary.push(errorText || `Error updating teacher: ${response.status}`);
        }
        if (Object.keys(mapped).length > 0) setFieldErrors(mapped);
        toast.error("Update Failed", {
          description: (
            <ul className="mt-1 list-disc pl-4 text-xs opacity-90 space-y-0.5">
              {(summary.length ? summary : [`Error updating teacher: ${response.status}`]).map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          ),
        });
      }
    } catch (error) {
      console.error("Error updating teacher:", error);
      toast.error("Error updating teacher");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto px-4 sm:px-6 py-6 rounded-3xl hide-scrollbar">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 pr-6">
            <DialogTitle className="text-2xl font-bold" style={{ color: "#274c77" }}>
              Edit Teacher - {teacher?.full_name}
            </DialogTitle>
            <SaveStatusIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
          </div>
        </DialogHeader>

        {/* Offline: modal khulte hi adhoora edit-draft mila to restore prompt. */}
        <DraftRecoveryDialog<any>
          formId={teacherEditDraftId}
          onRestore={(d) => setEditFormData(d)}
        />

        <div className="space-y-6 text-sm sm:text-base">
          {/* Personal Information */}
          <div className="bg-gray-50 p-4 sm:p-5 rounded-2xl border border-[#e4ecf5] shadow-inner">
            <h3 className="text-lg font-semibold mb-4" style={{ color: "#274c77" }}>Personal Information</h3>

            {/* Photo Upload */}
            <div className="mb-6">
              <Label htmlFor="photo">Profile Photo</Label>
              <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
                {editFormData.photo ? (
                  <div className="relative">
                    <img
                      src={typeof editFormData.photo === "string" ? editFormData.photo : URL.createObjectURL(editFormData.photo)}
                      alt="Teacher photo"
                      className="w-24 h-24 object-cover rounded-lg border-2 border-gray-200"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                      onClick={handleDeletePhoto}
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
                      if (file) setEditFormData({ ...editFormData, photo: file });
                    }}
                    className="mt-1"
                  />
                  <p className="mt-1 text-xs text-gray-500">Upload a profile photo (JPG, PNG)</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="full_name">Full Name</Label>
                <Input id="full_name" value={editFormData.full_name || ""} onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })} placeholder="Enter full name" />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={editFormData.email || ""} onChange={(e) => updateField("email", e.target.value)} placeholder="Enter email" className={fieldErrors.email ? "border-red-400 focus-visible:ring-red-400" : ""} />
                {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
              </div>
              <div>
                <Label htmlFor="contact_number">Contact Number</Label>
                <Input id="contact_number" value={editFormData.contact_number || ""} onChange={(e) => updateField("contact_number", e.target.value)} placeholder="Enter contact number (03xxxxxxxxx)" className={fieldErrors.contact_number ? "border-red-400 focus-visible:ring-red-400" : ""} />
                {fieldErrors.contact_number && <p className="mt-1 text-xs text-red-600">{fieldErrors.contact_number}</p>}
              </div>
              <div>
                <Label htmlFor="dob">Date of Birth</Label>
                <Input id="dob" type="date" value={editFormData.dob || ""} onChange={(e) => setEditFormData({ ...editFormData, dob: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="gender">Gender</Label>
                <Select value={editFormData.gender || ""} onValueChange={(value) => setEditFormData({ ...editFormData, gender: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="marital_status">Marital Status</Label>
                <Input id="marital_status" value={editFormData.marital_status || ""} onChange={(e) => setEditFormData({ ...editFormData, marital_status: e.target.value })} placeholder="Enter marital status" />
              </div>
              <div>
                <Label htmlFor="cnic">CNIC</Label>
                <Input id="cnic" maxLength={13} value={editFormData.cnic || ""} onChange={(e) => updateField("cnic", e.target.value.replace(/\D/g, "").slice(0, 13))} placeholder="Enter 13-digit CNIC" className={fieldErrors.cnic ? "border-red-400 focus-visible:ring-red-400" : ""} />
                {fieldErrors.cnic && <p className="mt-1 text-xs text-red-600">{fieldErrors.cnic}</p>}
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="permanent_address">Permanent Address</Label>
                <Textarea id="permanent_address" value={editFormData.permanent_address || ""} onChange={(e) => setEditFormData({ ...editFormData, permanent_address: e.target.value })} placeholder="Enter permanent address" rows={3} className="resize-none" />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="current_address">Current Address</Label>
                <Textarea id="current_address" value={editFormData.current_address || ""} onChange={(e) => setEditFormData({ ...editFormData, current_address: e.target.value })} placeholder="Enter current address" rows={3} className="resize-none" />
              </div>
            </div>
          </div>

          {/* Education Information */}
          <div className="bg-gray-50 p-4 sm:p-5 rounded-2xl border border-[#e4ecf5] shadow-inner">
            <h3 className="text-lg font-semibold mb-4" style={{ color: "#274c77" }}>Education Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="education_level">Education Level</Label>
                <Input id="education_level" value={editFormData.education_level || ""} onChange={(e) => setEditFormData({ ...editFormData, education_level: e.target.value })} placeholder="e.g. Masters" />
              </div>
              <div>
                <Label htmlFor="institution_name">Institution Name</Label>
                <Input id="institution_name" value={editFormData.institution_name || ""} onChange={(e) => setEditFormData({ ...editFormData, institution_name: e.target.value })} placeholder="Enter institution name" />
              </div>
              <div>
                <Label htmlFor="year_of_passing">Year of Passing</Label>
                <Input id="year_of_passing" type="number" value={editFormData.year_of_passing || ""} onChange={(e) => setEditFormData({ ...editFormData, year_of_passing: e.target.value })} placeholder="YYYY" />
              </div>
              <div>
                <Label htmlFor="education_subjects">Education Subjects</Label>
                <Input id="education_subjects" value={editFormData.education_subjects || ""} onChange={(e) => setEditFormData({ ...editFormData, education_subjects: e.target.value })} placeholder="e.g. Physics, Math" />
              </div>
              <div>
                <Label htmlFor="education_grade">Education Grade</Label>
                <Input id="education_grade" value={editFormData.education_grade || ""} onChange={(e) => setEditFormData({ ...editFormData, education_grade: e.target.value })} placeholder="e.g. A, 3.5 GPA" />
              </div>
            </div>
          </div>

          {/* Experience Information */}
          <div className="bg-gray-50 p-4 sm:p-5 rounded-2xl border border-[#e4ecf5] shadow-inner">
            <h3 className="text-lg font-semibold mb-4" style={{ color: "#274c77" }}>Experience Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="previous_institution_name">Previous Institution</Label>
                <Input id="previous_institution_name" value={editFormData.previous_institution_name || ""} onChange={(e) => setEditFormData({ ...editFormData, previous_institution_name: e.target.value })} placeholder="Enter previous institution" />
              </div>
              <div>
                <Label htmlFor="previous_position">Previous Position</Label>
                <Input id="previous_position" value={editFormData.previous_position || ""} onChange={(e) => setEditFormData({ ...editFormData, previous_position: e.target.value })} placeholder="Enter previous position" />
              </div>
              <div>
                <Label htmlFor="total_experience_years">Total Experience (Years)</Label>
                <Input id="total_experience_years" type="number" step="0.1" value={editFormData.total_experience_years || ""} onChange={(e) => setEditFormData({ ...editFormData, total_experience_years: e.target.value })} placeholder="e.g. 5.5" />
              </div>
              <div>
                <Label htmlFor="experience_from_date">From Date</Label>
                <Input id="experience_from_date" type="date" value={editFormData.experience_from_date || ""} onChange={(e) => setEditFormData({ ...editFormData, experience_from_date: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="experience_to_date">To Date</Label>
                <Input id="experience_to_date" type="date"  min={editFormData.experience_from_date || ""}  value={editFormData.experience_to_date || ""} onChange={(e) => setEditFormData({ ...editFormData, experience_to_date: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="experience_subjects_classes_taught">Subjects/Classes Taught</Label>
                <Textarea id="experience_subjects_classes_taught" value={editFormData.experience_subjects_classes_taught || ""} onChange={(e) => setEditFormData({ ...editFormData, experience_subjects_classes_taught: e.target.value })} placeholder="Enter experience subjects and classes taught" rows={3} className="resize-none" />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="previous_responsibilities">Previous Responsibilities</Label>
                <Textarea id="previous_responsibilities" value={editFormData.previous_responsibilities || ""} onChange={(e) => setEditFormData({ ...editFormData, previous_responsibilities: e.target.value })} placeholder="Enter previous responsibilities" rows={3} className="resize-none" />
              </div>
            </div>
          </div>

          {/* Current Role Information */}
          <div className="bg-gray-50 p-4 sm:p-5 rounded-2xl border border-[#e4ecf5] shadow-inner">
            <h3 className="text-lg font-semibold mb-4" style={{ color: "#274c77" }}>Current Role Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="joining_date">Joining Date</Label>
                <Input id="joining_date" type="date" value={editFormData.joining_date || ""} onChange={(e) => setEditFormData({ ...editFormData, joining_date: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="current_role_title">Current Role Title</Label>
                <Select value={editFormData.current_role_title || ""} onValueChange={(value) => setEditFormData({ ...editFormData, current_role_title: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Class Teacher">Class Teacher</SelectItem>
                    <SelectItem value="Subject Teacher">Subject Teacher</SelectItem>
                    <SelectItem value="Class + Subject">Class + Subject</SelectItem>
                    <SelectItem value="Assistant Teacher">Assistant Teacher</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="shift">Shift</Label>
                <Select value={editFormData.shift || ""} onValueChange={(value) => setEditFormData({ ...editFormData, shift: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select shift" />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const campusId = editFormData.current_campus || teacher?.current_campus;
                      const campus = campuses.find((c) => String(c.id ?? c.campus_id) === String(campusId));
                      const shiftAvailable = campus?.shift_available || "both";
                      if (shiftAvailable === "morning") return <SelectItem value="morning">Morning</SelectItem>;
                      if (shiftAvailable === "afternoon") return <SelectItem value="afternoon">Afternoon</SelectItem>;
                      return (
                        <>
                          <SelectItem value="morning">Morning</SelectItem>
                          <SelectItem value="afternoon">Afternoon</SelectItem>
                          <SelectItem value="both">Both</SelectItem>
                        </>
                      );
                    })()}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="is_class_teacher">Is Class Teacher</Label>
                <Select value={editFormData.is_class_teacher || ""} onValueChange={(value) => setEditFormData({ ...editFormData, is_class_teacher: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editFormData.is_class_teacher === "true" && (
                <div className="md:col-span-2">
                  <Label htmlFor="assigned_classrooms">Assigned Classrooms</Label>
                  <Popover open={openAssignedClassroomsDropdown} onOpenChange={setOpenAssignedClassroomsDropdown}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" aria-expanded={openAssignedClassroomsDropdown} className="w-full justify-between font-normal">
                        {Array.isArray(editFormData.assigned_classrooms) && editFormData.assigned_classrooms.length > 0 ? (
                          <span className="truncate">
                            {editFormData.assigned_classrooms
                              .map((id: number) => {
                                const cls = allEditClassrooms.find((c) => c.id === id);
                                if (cls) return `${cls.grade_name || cls.grade?.name} – ${cls.section}`;
                                return `Classroom ${id}`;
                              })
                              .join(", ")}
                          </span>
                        ) : (
                          <span className="text-gray-400">Select classrooms...</span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[360px] p-0" align="start">
                      <SearchableMultiSelect
                        searchPlaceholder="Search classroom..."
                        emptyText="No classroom found."
                        items={allEditClassrooms.map((cls) => ({
                          key: String(cls.id),
                          label: `${cls.grade_name || cls.grade?.name} – ${cls.section} (${cls.shift})`,
                        }))}
                        selectedKeys={(Array.isArray(editFormData.assigned_classrooms) ? editFormData.assigned_classrooms : []).map((id: any) => String(id))}
                        onToggle={(key) => toggleIdMultiSelect("assigned_classrooms", parseInt(key))}
                      />
                    </PopoverContent>
                  </Popover>
                  <p className="mt-1 text-xs text-gray-500 flex items-center gap-1.5"><MapPin className="h-3 w-3" /> Select one or more classrooms assigned to this teacher.</p>
                </div>
              )}

              <div>
                <Label htmlFor="is_subject_teacher">Is Subject Teacher</Label>
                <Select value={editFormData.is_subject_teacher || "false"} onValueChange={(value) => setEditFormData({ ...editFormData, is_subject_teacher: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="is_teacher_assistant">Is Assistant Teacher</Label>
                <Select value={editFormData.is_teacher_assistant || "false"} onValueChange={(value) => setEditFormData({ ...editFormData, is_teacher_assistant: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editFormData.is_subject_teacher === "true" && (
                <div className="md:col-span-2 space-y-3 rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/40 p-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-bold text-blue-800">Subject Assignments</Label>
                    <button
                      type="button"
                      onClick={() => {
                        const rows = Array.isArray(editFormData.subject_teacher_assignments) ? editFormData.subject_teacher_assignments : [];
                        setEditFormData({ ...editFormData, subject_teacher_assignments: [...rows, { classroom_id: "", subject_id: "" }] });
                      }}
                      className="flex items-center gap-1 rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 transition-colors"
                    >
                      <Plus className="h-3 w-3" /> Add Assignment
                    </button>
                  </div>

                  {Array.isArray(editFormData.subject_teacher_assignments) && editFormData.subject_teacher_assignments.length > 0 ? (
                    <div className="space-y-2">
                      {editFormData.subject_teacher_assignments.map((row: any, idx: number) => (
                        <div key={idx} className="flex gap-2 items-end rounded-lg border border-gray-100 bg-white p-3 shadow-sm">
                          <div className="flex-1 min-w-0">
                            <Label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-500">Classroom</Label>
                            <Select
                              value={String(row.classroom_id || "")}
                              onValueChange={(v) => {
                                const rows = [...editFormData.subject_teacher_assignments];
                                rows[idx] = { ...rows[idx], classroom_id: v };
                                setEditFormData({ ...editFormData, subject_teacher_assignments: rows });
                              }}
                            >
                              <SelectTrigger className="h-9 text-sm">
                                <SelectValue placeholder="Select Classroom" />
                              </SelectTrigger>
                              <SelectContent>
                                {allEditClassrooms.map((c: any) => (
                                  <SelectItem key={c.id} value={String(c.id)}>
                                    {c.grade_name || c.grade?.name} – {c.section} ({c.shift})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex-1 min-w-0">
                            <Label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-500">Subject</Label>
                            <Select
                              value={String(row.subject_id || "")}
                              onValueChange={(v) => {
                                const rows = [...editFormData.subject_teacher_assignments];
                                rows[idx] = { ...rows[idx], subject_id: v };
                                setEditFormData({ ...editFormData, subject_teacher_assignments: rows });
                              }}
                            >
                              <SelectTrigger className="h-9 text-sm">
                                <SelectValue placeholder="Select Subject" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableSubjects.map((s: any) => (
                                  <SelectItem key={s.id} value={String(s.id)}>
                                    {s.name || s.subject_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const rows = editFormData.subject_teacher_assignments.filter((_: any, i: number) => i !== idx);
                              setEditFormData({ ...editFormData, subject_teacher_assignments: rows });
                            }}
                            className="mb-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="py-3 text-center text-sm text-gray-400">No assignments yet. Click "+ Add Assignment" to add one.</p>
                  )}
                </div>
              )}

              <div className="md:col-span-2">
                <Label htmlFor="current_subjects">Current Subjects</Label>
                <Popover open={openSubjectsDropdown} onOpenChange={setOpenSubjectsDropdown}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={openSubjectsDropdown} className="w-full justify-between font-normal">
                      {editFormData.current_subjects ? <span className="truncate">{editFormData.current_subjects}</span> : <span className="text-gray-400">Select subjects...</span>}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[360px] p-0" align="start">
                    <SearchableMultiSelect
                      searchPlaceholder="Search subject..."
                      emptyText="No subject found."
                      items={availableSubjects.map((subj) => ({ key: subj.name || subj.subject_name, label: subj.name || subj.subject_name }))}
                      selectedKeys={(editFormData.current_subjects || "").split(",").map((s: string) => s.trim()).filter(Boolean)}
                      onToggle={(key) => toggleMultiSelect("current_subjects", key)}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="current_classes_taught">Current Classes Taught</Label>
                <Popover open={openClassesDropdown} onOpenChange={setOpenClassesDropdown}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={openClassesDropdown} className="w-full justify-between font-normal">
                      {editFormData.current_classes_taught ? <span className="truncate">{editFormData.current_classes_taught}</span> : <span className="text-gray-400">Select classes...</span>}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[360px] p-0" align="start">
                    <SearchableMultiSelect
                      searchPlaceholder="Search class..."
                      emptyText="No class found."
                      items={availableClasses.map((cls) => ({ key: cls.name || cls.grade_name, label: cls.name || cls.grade_name }))}
                      selectedKeys={(editFormData.current_classes_taught || "").split(",").map((s: string) => s.trim()).filter(Boolean)}
                      onToggle={(key) => toggleMultiSelect("current_classes_taught", key)}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label htmlFor="is_currently_active">Currently Active</Label>
                <Select value={editFormData.is_currently_active || ""} onValueChange={(value) => setEditFormData({ ...editFormData, is_currently_active: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="save_status">Save Status</Label>
                <Select value={editFormData.save_status || ""} onValueChange={(value) => setEditFormData({ ...editFormData, save_status: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="final">Final</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="biometric_id">Biometric ID</Label>
                <Input id="biometric_id" value={editFormData.biometric_id || ""} onChange={(e) => setEditFormData({ ...editFormData, biometric_id: e.target.value })} placeholder="e.g. 5" />
              </div>
              <div>
                <Label htmlFor="role_start_date">Role Start Date</Label>
                <Input id="role_start_date" type="date" value={editFormData.role_start_date || ""} onChange={(e) => setEditFormData({ ...editFormData, role_start_date: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="role_end_date">Role End Date</Label>
                <Input id="role_end_date" type="date"  min={editFormData.role_start_date || ""} value={editFormData.role_end_date || ""} onChange={(e) => setEditFormData({ ...editFormData, role_end_date: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="current_extra_responsibilities">Current Extra Responsibilities</Label>
                <Textarea id="current_extra_responsibilities" value={editFormData.current_extra_responsibilities || ""} onChange={(e) => setEditFormData({ ...editFormData, current_extra_responsibilities: e.target.value })} placeholder="Enter current extra responsibilities" rows={3} className="resize-none" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-end gap-3 mt-6">
          <Button onClick={handleClose} variant="outline" className="px-6 w-full sm:w-auto">
            Cancel
          </Button>
          <Button onClick={handleEditSubmit} disabled={isSubmitting} className="px-6 w-full sm:w-auto" style={{ backgroundColor: "#6096ba" }}>
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Updating...
              </>
            ) : (
              "Update Teacher"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TeacherEditForm;
