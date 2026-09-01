"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";
import { getApiBaseUrl, getAllCampuses, getLevels } from "@/lib/api";
import { toast } from "sonner";
import { useAutoSave } from "@/hooks/useAutoSave";
import { SaveStatusIndicator } from "@/components/offline/SaveStatusIndicator";
import { DraftRecoveryDialog } from "@/components/offline/DraftRecoveryDialog";
import { parseField } from "@/lib/validation/common";
import { coordinatorEditSchema } from "@/lib/validation/schemas/coordinator.schema";

export interface EditableCoordinator {
  id: number | string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  campus_name?: string;
  joining_date?: string;
  is_active?: boolean;
}

export interface CoordinatorEditFormProps {
  open: boolean;
  coordinator: EditableCoordinator | null;
  /** Campus list (used to resolve campus_name → id for level lookup). If omitted, the component fetches it. */
  campuses?: any[];
  onOpenChange: (open: boolean) => void;
  /** Called after a successful save so the parent can refresh its list. */
  onSaved: () => void;
}

/**
 * Self-contained Coordinator edit dialog. Shares the same visual language as the
 * Student / Teacher edit forms (gray section cards, #274c77 headings, 2-col grid).
 * Fetches the full record, owns all form state (incl. the campus-scoped
 * assigned-levels checkboxes) and validation, then calls `onSaved()`.
 */
export function CoordinatorEditForm({
  open,
  coordinator,
  campuses: campusesProp = [],
  onOpenChange,
  onSaved,
}: CoordinatorEditFormProps) {
  const [editFormData, setEditFormData] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Offline auto-save (Phase 7). Edit mode: baselineSkip → loaded record ka
  // draft tab tak nahi banta jab tak user actual change na kare. Sirf modal
  // open hone par active.
  const coordEditDraftId = `edit-coordinator-${coordinator?.id ?? "unknown"}`;
  const { status: saveStatus, lastSavedAt, clearDraft } = useAutoSave<any>(
    coordEditDraftId,
    editFormData,
    { enabled: open, baselineSkip: true }
  );

  const [availableLevels, setAvailableLevels] = useState<any[]>([]);
  const [internalCampuses, setInternalCampuses] = useState<any[]>([]);
  const campuses = campusesProp && campusesProp.length ? campusesProp : internalCampuses;
  // Per-field validation messages shown inline under each field.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const labelFor = (f: string) => {
    const labels: Record<string, string> = {
      full_name: "Full Name",
      email: "Email",
      contact_number: "Phone",
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
    const fullName = parseField(coordinatorEditSchema.entries.full_name, editFormData.full_name ?? "");
    if (!fullName.isValid) errs.full_name = fullName.message!;
    const phone = parseField(coordinatorEditSchema.entries.contact_number, editFormData.contact_number ?? "");
    if (!phone.isValid) errs.contact_number = phone.message!;
    const email = parseField(coordinatorEditSchema.entries.email, editFormData.email ?? "");
    if (!email.isValid) errs.email = email.message!;
    return errs;
  };

  // Fetch the campus list once if the parent didn't supply it.
  useEffect(() => {
    if (!campusesProp || !campusesProp.length) {
      getAllCampuses()
        .then((d: any) => setInternalCampuses(Array.isArray(d) ? d : d?.results || []))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the full coordinator record + campus-scoped levels whenever the dialog opens.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!open || !coordinator) return;

      // Resolve this coordinator's campus id (by name) to scope the levels list.
      const campusId = campuses.find(
        (c) => (c.campus_name || c.name) === coordinator.campus_name
      )?.id;
      try {
        const levelsData: any = await getLevels(campusId);
        if (!cancelled) setAvailableLevels(levelsData?.results || levelsData || []);
      } catch {
        if (!cancelled) setAvailableLevels([]);
      }

      // Fallback values from the row if the detail fetch fails.
      const fallbackName =
        coordinator.full_name || `${coordinator.first_name || ""} ${coordinator.last_name || ""}`.trim();
      try {
        const baseUrl = getApiBaseUrl();
        const cleanBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
        const response = await fetch(`${cleanBase}/api/coordinators/${coordinator.id}/`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("sis_access_token")}`,
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const fullData = await response.json();
          if (cancelled) return;
          setEditFormData({
            full_name: fullData.full_name || fallbackName,
            email: fullData.email || coordinator.email || "",
            dob: fullData.dob || "",
            gender: (fullData.gender || "").toLowerCase(),
            contact_number: fullData.contact_number || "",
            photo: fullData.photo || null,
            permanent_address: fullData.permanent_address || "",
            education_level: fullData.education_level || "",
            institution_name: fullData.institution_name || "",
            year_of_passing: fullData.year_of_passing || "",
            total_experience_years: fullData.total_experience_years || "",
            joining_date: fullData.joining_date || coordinator.joining_date || "",
            assigned_levels: Array.isArray(fullData.assigned_levels) ? fullData.assigned_levels : [],
            // Match the read-only Assigned Levels display by NAME (like the list does),
            // because the record's level ids don't line up with getLevels()' ids.
            // Merge BOTH sources: the M2M assigned_levels_details AND the single
            // `level` FK (level_name) — the list falls back to level_name too.
            assigned_level_names: (() => {
              const names = Array.isArray(fullData.assigned_levels_details)
                ? fullData.assigned_levels_details.map((l: any) => (l.name || "").toLowerCase())
                : [];
              if (fullData.level_name) names.push(String(fullData.level_name).toLowerCase());
              return Array.from(new Set(names.filter(Boolean)));
            })(),
            is_currently_active: fullData.is_currently_active !== false,
            can_assign_class_teachers: fullData.can_assign_class_teachers || false,
            biometric_id: fullData.biometric_id || "",
          });
        } else {
          if (cancelled) return;
          setEditFormData({
            full_name: fallbackName,
            email: coordinator.email || "",
            dob: "",
            gender: "",
            contact_number: "",
            photo: null,
            permanent_address: "",
            education_level: "",
            institution_name: "",
            year_of_passing: "",
            total_experience_years: "",
            joining_date: coordinator.joining_date || "",
            assigned_levels: [],
            assigned_level_names: [],
            is_currently_active: coordinator.is_active ?? true,
            can_assign_class_teachers: false,
            biometric_id: "",
          });
        }
      } catch (error) {
        console.error("Error loading coordinator details:", error);
        if (!cancelled)
          setEditFormData({
            full_name: fallbackName,
            email: coordinator.email || "",
            dob: "",
            gender: "",
            contact_number: "",
            photo: null,
            permanent_address: "",
            education_level: "",
            institution_name: "",
            year_of_passing: "",
            total_experience_years: "",
            joining_date: coordinator.joining_date || "",
            assigned_levels: [],
            assigned_level_names: [],
            is_currently_active: coordinator.is_active ?? true,
            can_assign_class_teachers: false,
            biometric_id: "",
          });
      }
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, coordinator?.id]);

  const handleClose = () => {
    onOpenChange(false);
    setEditFormData({});
    setFieldErrors({});
  };

  // Remove the profile photo. If it's an un-uploaded File, just clear locally;
  // otherwise call the backend delete-photo action.
  const handleDeletePhoto = async () => {
    if (!coordinator) return;
    if (editFormData.photo && editFormData.photo instanceof File) {
      setEditFormData((prev: any) => ({ ...prev, photo: null }));
      return;
    }
    try {
      const baseUrl = getApiBaseUrl();
      const cleanBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
      const resp = await fetch(`${cleanBase}/api/coordinators/${coordinator.id}/delete-photo/`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("sis_access_token")}` },
      });
      if (resp.ok) {
        setEditFormData((prev: any) => ({ ...prev, photo: null }));
        toast.success("Photo deleted");
      } else {
        const text = await resp.text();
        console.error("Failed to delete photo:", resp.status, text);
        toast.error(`Error deleting photo: ${resp.status}`);
      }
    } catch (err) {
      console.error("Error deleting photo:", err);
      toast.error("Error deleting photo");
    }
  };

  const handleEditSubmit = async () => {
    if (!coordinator) return;

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
        const b = getApiBaseUrl();
        const cb = b.endsWith("/") ? b.slice(0, -1) : b;
        try {
          const photoResponse = await fetch(`${cb}/api/coordinators/${coordinator.id}/upload-photo/`, {
            method: "POST",
            headers: { Authorization: `Bearer ${localStorage.getItem("sis_access_token")}` },
            body: photoForm,
          });
          if (photoResponse.ok) {
            const photoData = await photoResponse.json();
            setEditFormData((prev: any) => ({ ...prev, photo: photoData.photo_url }));
          }
        } catch (error) {
          console.error("Error uploading photo:", error);
        }
      }

      const updateData: any = {};
      if (editFormData.full_name) updateData.full_name = editFormData.full_name;
      if (editFormData.email) updateData.email = editFormData.email;
      if (editFormData.dob) updateData.dob = editFormData.dob;
      if (editFormData.gender) updateData.gender = editFormData.gender.toLowerCase();
      if (editFormData.contact_number) updateData.contact_number = editFormData.contact_number;
      if (editFormData.permanent_address) updateData.permanent_address = editFormData.permanent_address;
      if (editFormData.education_level) updateData.education_level = editFormData.education_level;
      if (editFormData.institution_name) updateData.institution_name = editFormData.institution_name;
      if (editFormData.year_of_passing) updateData.year_of_passing = parseInt(editFormData.year_of_passing);
      if (editFormData.total_experience_years)
        updateData.total_experience_years = parseInt(editFormData.total_experience_years);
      if (editFormData.joining_date) updateData.joining_date = editFormData.joining_date;
      if (editFormData.biometric_id) updateData.biometric_id = editFormData.biometric_id;
      // Always send the booleans so toggling persists.
      updateData.is_currently_active = editFormData.is_currently_active;
      updateData.can_assign_class_teachers = editFormData.can_assign_class_teachers;
      // Assigned Levels is VIEW-ONLY in this edit form (managed during coordinator
      // setup). The levels list shown here comes from a different scope than the
      // serializer's org-scoped queryset, so submitting ids caused "Invalid pk"
      // errors. We intentionally do NOT send assigned_levels from here.

      const baseUrl = getApiBaseUrl();
      const cleanBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
      const response = await fetch(`${cleanBase}/api/coordinators/${coordinator.id}/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("sis_access_token")}`,
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        toast.success(`Coordinator ${editFormData.full_name || coordinator.full_name || ""} has been updated successfully!`);
        clearDraft();
        onOpenChange(false);
        setEditFormData({});
        onSaved();
      } else {
        const errorText = await response.text();
        console.error("Error updating coordinator:", response.status, errorText);
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
              // Friendlier "already registered" for the unique email.
              if (/already exists|unique/i.test(msg) && field === "email") {
                msg = "This email is already registered to another coordinator.";
              }
              mapped[field] = msg;
              summary.push(`${labelFor(field)}: ${msg}`);
            });
          }
          if (summary.length === 0 && topMessage) summary.push(topMessage);
        } catch {
          summary.push(errorText || `Error updating coordinator: ${response.status}`);
        }
        if (Object.keys(mapped).length > 0) setFieldErrors(mapped);
        toast.error("Update Failed", {
          description: (
            <ul className="mt-1 list-disc pl-4 text-xs opacity-90 space-y-0.5">
              {(summary.length ? summary : [`Error updating coordinator: ${response.status}`]).map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          ),
        });
      }
    } catch (error) {
      console.error("Error updating coordinator:", error);
      toast.error("Error updating coordinator");
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
              Edit Coordinator{coordinator?.full_name ? ` - ${coordinator.full_name}` : ""}
            </DialogTitle>
            <SaveStatusIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
          </div>
        </DialogHeader>

        {/* Offline: modal khulte hi adhoora edit-draft mila to restore prompt. */}
        <DraftRecoveryDialog<any>
          formId={coordEditDraftId}
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
                      alt="Coordinator photo"
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
                <Label htmlFor="full_name">Full Name *</Label>
                <Input id="full_name" value={editFormData.full_name || ""} onChange={(e) => updateField("full_name", e.target.value)} placeholder="Enter full name" className={fieldErrors.full_name ? "border-red-400 focus-visible:ring-red-400" : ""} />
                {fieldErrors.full_name && <p className="mt-1 text-xs text-red-600">{fieldErrors.full_name}</p>}
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" value={editFormData.email || ""} onChange={(e) => updateField("email", e.target.value)} placeholder="Enter email" className={fieldErrors.email ? "border-red-400 focus-visible:ring-red-400" : ""} />
                {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
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
                <Label htmlFor="contact_number">Phone</Label>
                <Input id="contact_number" value={editFormData.contact_number || ""} onChange={(e) => updateField("contact_number", e.target.value)} placeholder="Enter phone number (03xxxxxxxxx)" className={fieldErrors.contact_number ? "border-red-400 focus-visible:ring-red-400" : ""} />
                {fieldErrors.contact_number && <p className="mt-1 text-xs text-red-600">{fieldErrors.contact_number}</p>}
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="permanent_address">Permanent Address</Label>
                <Textarea id="permanent_address" value={editFormData.permanent_address || ""} onChange={(e) => setEditFormData({ ...editFormData, permanent_address: e.target.value })} placeholder="Enter permanent address" rows={3} className="resize-none" />
              </div>
            </div>
          </div>

          {/* Educational Information */}
          <div className="bg-gray-50 p-4 sm:p-5 rounded-2xl border border-[#e4ecf5] shadow-inner">
            <h3 className="text-lg font-semibold mb-4" style={{ color: "#274c77" }}>Educational Information</h3>
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
                <Label htmlFor="total_experience_years">Total Experience (Years)</Label>
                <Input id="total_experience_years" type="number" value={editFormData.total_experience_years || ""} onChange={(e) => setEditFormData({ ...editFormData, total_experience_years: e.target.value })} placeholder="e.g. 5" />
              </div>
            </div>
          </div>

          {/* Work Assignment */}
          <div className="bg-gray-50 p-4 sm:p-5 rounded-2xl border border-[#e4ecf5] shadow-inner">
            <h3 className="text-lg font-semibold mb-4" style={{ color: "#274c77" }}>Work Assignment</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="joining_date">Joining Date</Label>
                <Input id="joining_date" type="date" value={editFormData.joining_date || ""} onChange={(e) => setEditFormData({ ...editFormData, joining_date: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="is_currently_active">Status</Label>
                <Select value={editFormData.is_currently_active ? "true" : "false"} onValueChange={(value) => setEditFormData({ ...editFormData, is_currently_active: value === "true" })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="can_assign_class_teachers">Can Assign Class Teachers</Label>
                <Select value={editFormData.can_assign_class_teachers ? "true" : "false"} onValueChange={(value) => setEditFormData({ ...editFormData, can_assign_class_teachers: value === "true" })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select option" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="biometric_id">Biometric ID</Label>
                <Input id="biometric_id" value={editFormData.biometric_id || ""} onChange={(e) => setEditFormData({ ...editFormData, biometric_id: e.target.value })} placeholder="Device user ID (e.g. 5)" />
              </div>
              <div className="md:col-span-2">
                <div className="flex items-center justify-between">
                  <Label>Assigned Levels</Label>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Read-only</span>
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  Academic levels this coordinator manages. Set during coordinator setup — not editable here.
                </p>
                {availableLevels.length === 0 ? (
                  <p className="mt-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-400">
                    No levels available for this campus.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {availableLevels.map((lvl: any) => {
                      // Match by name (ids differ between getLevels() and the record).
                      const checked = (editFormData.assigned_level_names || []).includes((lvl.name || "").toLowerCase());
                      return (
                        <div
                          key={lvl.id}
                          aria-disabled="true"
                          className={cn(
                            "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-not-allowed select-none",
                            checked
                              ? "border-[#274c77]/40 bg-[#274c77]/5 text-[#274c77] font-medium"
                              : "border-gray-200 bg-gray-50 text-gray-400"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled
                            readOnly
                            className="accent-[#274c77] w-4 h-4 cursor-not-allowed"
                          />
                          <span>{lvl.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
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
              "Update Coordinator"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CoordinatorEditForm;
