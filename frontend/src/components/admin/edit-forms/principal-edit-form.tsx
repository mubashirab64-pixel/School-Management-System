"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User } from "lucide-react";
import { getApiBaseUrl, getAllCampuses } from "@/lib/api";
import { toast } from "sonner";
import { useAutoSave } from "@/hooks/useAutoSave";
import { SaveStatusIndicator } from "@/components/offline/SaveStatusIndicator";
import { DraftRecoveryDialog } from "@/components/offline/DraftRecoveryDialog";
import { parseField } from "@/lib/validation/common";
import { principalEditSchema } from "@/lib/validation/schemas/principal.schema";

export interface EditablePrincipal {
  id: number | string;
  full_name?: string;
  employee_code?: string;
  email?: string;
  contact_number?: string;
  cnic?: string;
  dob?: string;
  gender?: string;
  permanent_address?: string;
  education_level?: string;
  institution_name?: string;
  year_of_passing?: number | string;
  total_experience_years?: number | string;
  campus?: number | string;
  shift?: string;
  joining_date?: string;
  is_currently_active?: boolean;
  biometric_id?: string;
  photo?: string | null;
}

export interface PrincipalEditFormProps {
  open: boolean;
  principal: EditablePrincipal | null;
  /** Campus list for the campus select. If omitted, the component fetches it. */
  campuses?: any[];
  onOpenChange: (open: boolean) => void;
  /** Called after a successful save so the parent can refresh its list. */
  onSaved: () => void;
}

/**
 * Self-contained Principal edit dialog. Shares the same visual language as the
 * Student / Teacher / Coordinator edit forms (gray section cards, #274c77
 * headings, 2-col grid). Seeds its form state from the passed row (the list
 * already returns the full record), validates, PATCHes, then calls `onSaved()`.
 */
export function PrincipalEditForm({
  open,
  principal,
  campuses: campusesProp = [],
  onOpenChange,
  onSaved,
}: PrincipalEditFormProps) {
  const [editFormData, setEditFormData] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Offline auto-save (Phase 7) — edit mode, baselineSkip, sirf open par active.
  const principalEditDraftId = `edit-principal-${principal?.id ?? "unknown"}`;
  const { status: saveStatus, lastSavedAt, clearDraft } = useAutoSave<any>(
    principalEditDraftId,
    editFormData,
    { enabled: open, baselineSkip: true }
  );

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
    const fullName = parseField(principalEditSchema.entries.full_name, editFormData.full_name ?? "");
    if (!fullName.isValid) errs.full_name = fullName.message!;
    const email = parseField(principalEditSchema.entries.email, editFormData.email ?? "");
    if (!email.isValid) errs.email = email.message!;
    const phone = parseField(principalEditSchema.entries.contact_number, editFormData.contact_number ?? "");
    if (!phone.isValid) errs.contact_number = phone.message!;
    const cnic = parseField(principalEditSchema.entries.cnic, editFormData.cnic ?? "");
    if (!cnic.isValid) errs.cnic = cnic.message!;
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

  // Seed the form from the passed row whenever the dialog opens.
  useEffect(() => {
    if (!open || !principal) return;
    setEditFormData({
      full_name: principal.full_name || "",
      email: principal.email || "",
      contact_number: principal.contact_number || "",
      cnic: principal.cnic || "",
      dob: principal.dob || "",
      gender: (principal.gender || "").toLowerCase(),
      permanent_address: principal.permanent_address || "",
      education_level: principal.education_level || "",
      institution_name: principal.institution_name || "",
      year_of_passing: principal.year_of_passing ?? "",
      total_experience_years: principal.total_experience_years ?? "",
      campus: principal.campus ?? "",
      shift: principal.shift || "",
      joining_date: principal.joining_date || "",
      is_currently_active: principal.is_currently_active ?? true,
      biometric_id: principal.biometric_id || "",
      photo: principal.photo || null,
    });
    setFieldErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, principal?.id]);

  const handleClose = () => {
    onOpenChange(false);
    setEditFormData({});
    setFieldErrors({});
  };

  // Remove the profile photo. If it's an un-uploaded File, just clear locally;
  // otherwise call the backend delete-photo action.
  const handleDeletePhoto = async () => {
    if (!principal) return;
    if (editFormData.photo && editFormData.photo instanceof File) {
      setEditFormData((prev: any) => ({ ...prev, photo: null }));
      return;
    }
    try {
      const baseUrl = getApiBaseUrl();
      const cleanBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
      const resp = await fetch(`${cleanBase}/api/principals/${principal.id}/delete-photo/`, {
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

  // The backend regenerates the employee code when campus/shift/joining changes.
  const codeWillRegenerate =
    !!principal &&
    (String(editFormData.campus ?? "") !== String(principal.campus ?? "") ||
      (editFormData.shift ?? "") !== (principal.shift ?? "") ||
      (editFormData.joining_date ?? "") !== (principal.joining_date ?? ""));

  const handleEditSubmit = async () => {
    if (!principal) return;

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
          const photoResponse = await fetch(`${cb}/api/principals/${principal.id}/upload-photo/`, {
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
      Object.keys(editFormData).forEach((key) => {
        // photo is handled via its own endpoint above — never send it in the JSON PATCH.
        if (key === "photo") return;
        if (editFormData[key] !== "" && editFormData[key] !== null && editFormData[key] !== undefined) {
          updateData[key] = editFormData[key];
        }
      });
      if (updateData.gender) updateData.gender = String(updateData.gender).toLowerCase();
      if (updateData.year_of_passing) updateData.year_of_passing = parseInt(String(updateData.year_of_passing));
      if (updateData.total_experience_years)
        updateData.total_experience_years = parseInt(String(updateData.total_experience_years));
      if (updateData.campus) updateData.campus = parseInt(String(updateData.campus));
      // Status is a boolean that must always persist (incl. false).
      updateData.is_currently_active = editFormData.is_currently_active;

      const baseUrl = getApiBaseUrl();
      const cleanBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
      const response = await fetch(`${cleanBase}/api/principals/${principal.id}/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("sis_access_token")}`,
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        toast.success(`Principal ${editFormData.full_name || principal.full_name || ""} has been updated successfully!`);
        clearDraft();
        onOpenChange(false);
        setEditFormData({});
        onSaved();
      } else {
        const errorText = await response.text();
        console.error("Error updating principal:", response.status, errorText);
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
                if (field === "email") msg = "This email is already registered to another principal.";
                else if (field === "cnic") msg = "This CNIC is already registered to another principal.";
              }
              mapped[field] = msg;
              summary.push(`${labelFor(field)}: ${msg}`);
            });
          }
          if (summary.length === 0 && topMessage) summary.push(topMessage);
        } catch {
          summary.push(errorText || `Error updating principal: ${response.status}`);
        }
        if (Object.keys(mapped).length > 0) setFieldErrors(mapped);
        toast.error("Update Failed", {
          description: (
            <ul className="mt-1 list-disc pl-4 text-xs opacity-90 space-y-0.5">
              {(summary.length ? summary : [`Error updating principal: ${response.status}`]).map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          ),
        });
      }
    } catch (error) {
      console.error("Error updating principal:", error);
      toast.error("Error updating principal");
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
              Edit Principal{principal?.full_name ? ` - ${principal.full_name}` : ""}
            </DialogTitle>
            <SaveStatusIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
          </div>
        </DialogHeader>

        {/* Offline: modal khulte hi adhoora edit-draft mila to restore prompt. */}
        <DraftRecoveryDialog<any>
          formId={principalEditDraftId}
          onRestore={(d) => setEditFormData(d)}
        />

        <div className="space-y-6 text-sm sm:text-base">
          {/* Employee Code — system generated, read-only */}
          <div>
            <Label htmlFor="employee_code">
              Employee Code <span className="text-xs text-gray-500">(System Generated)</span>
            </Label>
            <Input id="employee_code" value={principal?.employee_code || "N/A"} readOnly className="bg-gray-100 cursor-not-allowed" />
          </div>

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
                      alt="Principal photo"
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
                <Label htmlFor="contact_number">Contact Number *</Label>
                <Input id="contact_number" value={editFormData.contact_number || ""} onChange={(e) => updateField("contact_number", e.target.value)} placeholder="Enter contact number (03xxxxxxxxx)" className={fieldErrors.contact_number ? "border-red-400 focus-visible:ring-red-400" : ""} />
                {fieldErrors.contact_number && <p className="mt-1 text-xs text-red-600">{fieldErrors.contact_number}</p>}
              </div>
              <div>
                <Label htmlFor="cnic">CNIC *</Label>
                <Input id="cnic" maxLength={13} value={editFormData.cnic || ""} onChange={(e) => updateField("cnic", e.target.value.replace(/\D/g, "").slice(0, 13))} placeholder="Enter 13-digit CNIC" className={fieldErrors.cnic ? "border-red-400 focus-visible:ring-red-400" : ""} />
                {fieldErrors.cnic && <p className="mt-1 text-xs text-red-600">{fieldErrors.cnic}</p>}
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
                <Label htmlFor="campus">Campus</Label>
                <Select value={String(editFormData.campus || "")} onValueChange={(value) => setEditFormData({ ...editFormData, campus: parseInt(value) })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Campus" />
                  </SelectTrigger>
                  <SelectContent>
                    {campuses.map((campus: any) => (
                      <SelectItem key={campus.id} value={String(campus.id)}>
                        {campus.campus_name || campus.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="shift">Shift</Label>
                <Select value={editFormData.shift || ""} onValueChange={(value) => setEditFormData({ ...editFormData, shift: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Shift" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning</SelectItem>
                    <SelectItem value="afternoon">Afternoon</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="joining_date">Joining Date</Label>
                <Input id="joining_date" type="date" value={editFormData.joining_date || ""} onChange={(e) => setEditFormData({ ...editFormData, joining_date: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="is_currently_active">Status</Label>
                <Select value={editFormData.is_currently_active ? "active" : "inactive"} onValueChange={(value) => setEditFormData({ ...editFormData, is_currently_active: value === "active" })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="biometric_id">Biometric ID</Label>
                <Input id="biometric_id" value={editFormData.biometric_id || ""} onChange={(e) => setEditFormData({ ...editFormData, biometric_id: e.target.value })} placeholder="Device user ID (e.g. 5)" />
              </div>
            </div>

            {codeWillRegenerate && (
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Employee Code will be automatically regenerated because Campus, Shift, or Joining Date has been changed.
                </p>
              </div>
            )}
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
              "Update Principal"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PrincipalEditForm;
