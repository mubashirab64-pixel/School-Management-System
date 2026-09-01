"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, ShieldCheck, Layers, Building2, GraduationCap, X, Loader2, Save, Trash, Layout, DollarSign, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { feeService, FeeStructure, FeeType } from "@/services/feeService";
import { FeeTabs } from "../components/FeeTabs";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function FeeStructuresPage() {
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
  const [campuses, setCampuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  // Cascading Lookups
  const [levels, setLevels] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);

  // Form State
  const [name, setName] = useState("");
  const [campusId, setCampusId] = useState<string>("");
  const [levelId, setLevelId] = useState<string>("null");
  const [gradeId, setGradeId] = useState<string>("null");
  const [sectionId, setSectionId] = useState<string>("null");
  const [isActive, setIsActive] = useState(true);
  const [isDefault, setIsDefault] = useState(false);
  const [lineItems, setLineItems] = useState<{ fee_type: string, amount: string }[]>([{ fee_type: "", amount: "" }]);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sData, ftData, cData] = await Promise.all([
        feeService.getFeeStructures(),
        feeService.getFeeTypes(),
        feeService.getCampuses()
      ]);
      setStructures(sData);
      setFeeTypes(ftData);
      setCampuses(cData);
    } catch (error) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCampusChange = async (val: string) => {
    setCampusId(val);
    setLevelId("null");
    setGradeId("null");
    setSectionId("null");
    const data = await feeService.getLevelsByCampus(val);
    setLevels(data);
  };

  const handleLevelChange = async (val: string) => {
    setLevelId(val);
    setGradeId("null");
    setSectionId("null");
    if (val === "null") {
      setGrades([]);
      return;
    }
    const data = await feeService.getGradesByLevel(val);
    setGrades(data);
  };

  const handleGradeChange = async (val: string) => {
    setGradeId(val);
    setSectionId("null");
    if (val === "null") {
      setSections([]);
      return;
    }
    // For sections, we might need a specific helper or just filter
    const data = await feeService.getStudentFees(); // Placeholder for fetching classrooms
    // Note: I'll use a direct fetch for classrooms here since it's needed
    const classrooms = await feeService.getGradesByCampus(campusId); // Actually need classrooms
    // I'll add a simplified classroom fetch if needed or just use current grades
  };

  const addLine = () => setLineItems([...lineItems, { fee_type: "", amount: "" }]);
  const removeLine = (index: number) => setLineItems(lineItems.filter((_, i) => i !== index));
  const updateLine = (index: number, field: string, val: string) => {
    const newItems = [...lineItems];
    (newItems[index] as any)[field] = val;
    setLineItems(newItems);
  };

  const calculateTotal = () => lineItems.reduce((acc, item) => acc + (parseFloat(item.amount) || 0), 0);

  const resetForm = () => {
    setEditId(null);
    setName("");
    setCampusId("");
    setLevelId("null");
    setGradeId("null");
    setSectionId("null");
    setIsActive(true);
    setIsDefault(false);
    setLineItems([{ fee_type: "", amount: "" }]);
    setLevels([]);
    setGrades([]);
  };

  const handleEdit = async (s: FeeStructure) => {
    resetForm();
    setEditId(s.id);
    setName(s.name);
    setCampusId(s.campus.toString());
    setIsActive(s.is_active);
    setIsDefault(s.is_default);
    
    if (s.campus) {
      const l = await feeService.getLevelsByCampus(s.campus.toString());
      setLevels(l);
    }
    if (s.level) {
      const g = await feeService.getGradesByLevel(s.level.toString());
      setGrades(g);
    }

    setLevelId(s.level ? s.level.toString() : "null");
    setGradeId(s.grade ? s.grade.toString() : "null");
    setSectionId(s.section ? s.section.toString() : "null");
    
    if (s.line_items && s.line_items.length > 0) {
      setLineItems(s.line_items.map(i => ({ fee_type: i.fee_type.toString(), amount: i.amount.toString() })));
    } else {
      setLineItems([{ fee_type: "", amount: "" }]);
    }
    
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!name || !campusId) {
      toast.error("Please fill required fields");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name,
        campus: parseInt(campusId),
        level: levelId === "null" ? null : parseInt(levelId),
        grade: gradeId === "null" ? null : parseInt(gradeId),
        section: sectionId === "null" ? null : parseInt(sectionId),
        is_active: isActive,
        is_default: isDefault,
        line_items: lineItems.filter(i => i.fee_type && i.amount).map(i => ({
          fee_type: parseInt(i.fee_type),
          amount: parseFloat(i.amount)
        }))
      };
      
      if (editId) {
         await feeService.updateFeeStructure(editId, payload);
         toast.success("Structure updated successfully");
      } else {
         await feeService.createFeeStructure(payload);
         toast.success("Structure created");
      }
      setIsModalOpen(false);
      resetForm();
      fetchData();
    } catch (e) {
      toast.error("Failed to save structure");
    } finally {
      setSubmitting(false);
    }
  };

  const getScopeBadge = (s: FeeStructure) => {
    if (s.section_name) return <Badge variant="outline" className="bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200 text-xs font-medium px-2.5 py-0.5 rounded-md">Section: {s.section_name}</Badge>;
    if (s.grade_name) return <Badge variant="outline" className="bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 text-xs font-medium px-2.5 py-0.5 rounded-md">Grade: {s.grade_name}</Badge>;
    if (s.level_name && s.level_name !== 'N/A') return <Badge variant="outline" className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 text-xs font-medium px-2.5 py-0.5 rounded-md">Level: {s.level_name}</Badge>;
    return <Badge variant="outline" className="bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200 text-xs font-medium px-2.5 py-0.5 rounded-md">School Default</Badge>;
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-10 px-1">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 flex items-center gap-2.5">
            <Layers className="h-6 w-6 text-blue-600" />
            Fee Structures
          </h2>
          <p className="text-gray-500 text-sm mt-1.5">
            Manage your school's financial templates and configure fee components.
          </p>
        </div>
        <Button
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-primary hover:bg-primary/80 text-white shadow-sm rounded-lg h-10 px-5"
        >
          <Plus className="w-4 h-4 mr-2" /> 
          New Structure
        </Button>
      </div>

      <div className="-mx-2 px-2">
        <FeeTabs active="structures" />
      </div>

      {/* Main Table Card */}
      <Card className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="px-6 py-5 border-b border-gray-100 flex flex-row items-center justify-between bg-white">
          <div>
            <CardTitle className="text-lg font-semibold text-gray-900">Templates Inventory</CardTitle>
            <CardDescription className="text-sm text-gray-500 mt-1">All configured fee structures across campuses.</CardDescription>
          </div>
          <Badge variant="secondary" className="bg-gray-100 text-gray-600 hover:bg-gray-100 border-transparent font-medium px-3 py-1 rounded-md">
            {structures.length} {structures.length === 1 ? 'Record' : 'Records'}
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/50 hover:bg-gray-50/50 border-b border-gray-100">
                <TableHead className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider h-auto">Internal Name</TableHead>
                <TableHead className="py-4 text-xs font-medium text-gray-500 uppercase tracking-wider h-auto">Application Scope</TableHead>
                <TableHead className="py-4 text-xs font-medium text-gray-500 uppercase tracking-wider h-auto">Campus Location</TableHead>
                <TableHead className="py-4 text-xs font-medium text-gray-500 uppercase tracking-wider h-auto text-center">Status</TableHead>
                <TableHead className="py-4 text-xs font-medium text-gray-500 uppercase tracking-wider h-auto">Fee Details</TableHead>
                <TableHead className="pr-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider h-auto text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-20"><Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" /></TableCell></TableRow>
              ) : structures.map((s) => (
                <TableRow key={s.id} className="hover:bg-gray-50/80 transition-colors border-b border-gray-100 last:border-none">
                  <TableCell className="px-6 py-4 align-middle">
                    <div className="font-medium text-gray-900 text-sm">{s.name}</div>
                    <div className="text-xs text-gray-500 mt-1">REF-{s.id.toString().padStart(6, '0')}</div>
                  </TableCell>
                  <TableCell className="py-4 align-middle">
                    {getScopeBadge(s)}
                  </TableCell>
                  <TableCell className="py-4 align-middle">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-700">{s.campus_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-4 text-center align-middle">
                    {s.is_active ?
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-medium px-2.5 py-0.5 rounded-md hover:bg-emerald-100">Active</Badge> :
                      <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200 text-xs font-medium px-2.5 py-0.5 rounded-md hover:bg-gray-100">Inactive</Badge>
                    }
                  </TableCell>
                  <TableCell className="py-4 align-middle">
                    <div className="flex flex-col gap-1.5">
                      {s.line_items && s.line_items.length > 0 ? (
                        s.line_items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs w-44 bg-gray-50 px-2.5 py-1 rounded-md border border-gray-100">
                            <span className="font-medium text-gray-600">{item.fee_type_name || 'Fee'}</span>
                            <span className="font-semibold text-gray-900">Rs {Number(item.amount).toLocaleString()}</span>
                          </div>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400 italic">No fees defined</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="pr-6 py-4 text-right align-middle">
                    <div className="flex justify-end gap-1.5">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" onClick={() => handleEdit(s)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        onClick={async () => {
                          if (confirm("Permanently delete this fee structure template?")) {
                            try {
                               await feeService.deleteFeeStructure(s.id);
                               toast.success("Template deleted successfully");
                               fetchData();
                            } catch (e) {
                               toast.error("Failed to delete. It might be assigned to students.");
                            }
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && structures.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-24"><div className="text-gray-500 text-sm">No fee structures configured yet.</div><div className="text-gray-400 text-xs mt-1">Click "New Structure" to create one.</div></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modern SaaS Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 text-left">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={() => setIsModalOpen(false)}></div>
          
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col relative z-10 animate-in zoom-in-95 duration-200 mt-8">
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-start bg-white rounded-t-xl shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {editId ? 'Edit Fee Structure' : 'Create Fee Structure'}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Define a new template for recurring or one-time fees.
                </p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-md transition-colors text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                
                {/* Left Column: General & Scope */}
                <div className="space-y-6">
                  
                  {/* General Info Card */}
                  <Card className="border border-gray-200 shadow-sm overflow-hidden bg-white">
                    <div className="p-5 space-y-5">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-gray-700">STRUCTURE NAME</Label>
                        <Input 
                          value={name} 
                          onChange={e => setName(e.target.value)} 
                          placeholder="e.g. Primary Standard - 2026"
                          className="h-10 border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg text-sm bg-gray-50/50"
                        />
                      </div>
                      
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <div className="pt-2">
                          <Label className="text-sm font-semibold text-gray-900">Active Status</Label>
                          <p className="text-xs text-gray-500 mt-0.5">Enable or disable this template</p>
                        </div>
                        <Switch checked={isActive} onCheckedChange={setIsActive} className="data-[state=checked]:bg-primary mt-2" />
                      </div>
                    </div>
                  </Card>

                  {/* Applicability Scope */}
                  <Card className="border border-gray-200 shadow-sm overflow-hidden bg-white">
                    <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                      <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-500" />
                        Applicability Scope
                      </h4>
                    </div>
                    
                    <div className="p-5 space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-gray-700">CAMPUS LOCATION <span className="text-red-500">*</span></Label>
                        <Select value={campusId} onValueChange={handleCampusChange}>
                          <SelectTrigger className="h-10 border-gray-200 rounded-lg text-sm bg-gray-50/50">
                            <SelectValue placeholder="Select Campus" />
                          </SelectTrigger>
                          <SelectContent>
                            {campuses.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.campus_name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-gray-700">TARGET LEVEL</Label>
                        <Select value={levelId} onValueChange={handleLevelChange} disabled={!campusId}>
                          <SelectTrigger className="h-10 border-gray-200 rounded-lg text-sm bg-gray-50/50 disabled:opacity-60">
                            <SelectValue placeholder="All Levels (Default)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="null">All Levels (Default)</SelectItem>
                            {levels.map(l => <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-gray-700">STUDENT GRADE</Label>
                        <Select value={gradeId} onValueChange={handleGradeChange} disabled={levelId === "null"}>
                          <SelectTrigger className="h-10 border-gray-200 rounded-lg text-sm bg-gray-50/50 disabled:opacity-60">
                            <SelectValue placeholder="All Grades in Level" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="null">All Grades in Level</SelectItem>
                            {grades.map(g => <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Right Column: Fees & Summary */}
                <div className="space-y-6 h-full flex flex-col">
                  <Card className="border border-gray-200 shadow-sm flex-1 flex flex-col overflow-hidden bg-white">
                    <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                      <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-gray-500" />
                        Fee Line Items
                      </h4>
                      <Button 
                        onClick={addLine}
                        variant="outline" 
                        size="sm"
                        className="h-8 text-xs font-medium border-primary text-primary hover:bg-primary/5 bg-white"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add Fee
                      </Button>
                    </div>

                    <div className="p-5 space-y-3.5 flex-1 overflow-y-auto max-h-[340px]">
                      {lineItems.map((item, idx) => (
                        <div key={idx} className="flex gap-3 items-center group">
                          <div className="flex-1">
                            <Select value={item.fee_type} onValueChange={(val) => updateLine(idx, 'fee_type', val)}>
                              <SelectTrigger className="h-10 border-gray-200 rounded-lg text-sm bg-gray-50/50">
                                <SelectValue placeholder="Select Type" />
                              </SelectTrigger>
                              <SelectContent>
                                {feeTypes.map(ft => <SelectItem key={ft.id} value={ft.id.toString()}>{ft.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="w-32 relative flex items-center">
                            <div className="absolute left-3 text-gray-500 font-medium text-sm">Rs</div>
                            <Input 
                              type="number" 
                              value={item.amount} 
                              onChange={(e) => updateLine(idx, 'amount', e.target.value)} 
                              className="h-10 pl-9 border-gray-200 rounded-lg text-sm text-right pr-3 font-medium focus:border-blue-500 focus:ring-blue-500 bg-gray-50/50"
                              placeholder="0"
                            />
                            {lineItems.length > 1 && (
                              <button 
                                onClick={() => removeLine(idx)} 
                                className="absolute -right-8 text-gray-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Total Highlight */}
                    <div className="bg-primary p-5 shrink-0 flex items-center justify-between text-white">
                      <span className="text-sm font-semibold opacity-90">Total Amount</span>
                      <span className="text-2xl font-bold tracking-tight">
                        Rs {calculateTotal().toLocaleString()}
                      </span>
                    </div>
                  </Card>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-white rounded-b-xl flex justify-end items-center gap-3 shrink-0">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="text-gray-600 hover:bg-gray-100 h-10 px-4 rounded-lg text-sm font-medium">Cancel</Button>
              <Button 
                onClick={handleSave} 
                className="bg-primary hover:bg-primary/80 text-white h-10 px-6 rounded-lg text-sm font-semibold shadow-sm transition-colors"
                disabled={submitting}
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Save Structure
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
