"use client";

import { useState, useEffect } from "react";
import { 
  Building2, Calendar, FileText, CheckCircle2, TrendingUp, AlertCircle, 
  Loader2, Play, Users, DollarSign, Wallet
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { feeService } from "@/services/feeService";
import { FeeTabs } from "../components/FeeTabs";
import { toast } from "sonner";

export default function FeeGenerationDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [campuses, setCampuses] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [campusId, setCampusId] = useState<string>("");
  
  // Custom Fee Selection
  const [selectedStructureId, setSelectedStructureId] = useState<string>("null");
  
  // Multi-select for Levels and Grades
  const [selectedLevels, setSelectedLevels] = useState<number[]>([]);
  const [selectedGrades, setSelectedGrades] = useState<number[]>([]);
  const [selectedSections, setSelectedSections] = useState<number[]>([]);
  
  const [levelOpen, setLevelOpen] = useState(false);
  const [gradeOpen, setGradeOpen] = useState(false);
  const [sectionOpen, setSectionOpen] = useState(false);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [allStructures, setAllStructures] = useState<any[]>([]);
  
  // New: Individual Generation Mode
  const [genMode, setGenMode] = useState<'batch' | 'individual'>('batch');
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [studentSearch, setStudentSearch] = useState("");
  const [isSearchingStudents, setIsSearchingStudents] = useState(false);

  // New: Hierarchical Selection for Individual Mode
  const [indivLevelId, setIndivLevelId] = useState<string>("");
  const [indivGradeId, setIndivGradeId] = useState<string>("");
  const [indivSectionId, setIndivSectionId] = useState<string>("");
  const [indivLevels, setIndivLevels] = useState<any[]>([]);
  const [indivGrades, setIndivGrades] = useState<any[]>([]);
  const [indivSections, setIndivSections] = useState<any[]>([]);

  useEffect(() => {
    const init = async () => {
      try {
        const [cData, sData, structData] = await Promise.all([
          feeService.getCampuses(),
          feeService.getCollectionReport({ month, year }),
          feeService.getFeeStructures()
        ]);
        setCampuses(cData);
        setStats(sData);
        setAllStructures(structData);
      } catch (e) {
        toast.error("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [month, year]);

  const getPreviewItems = () => {
    if (!campusId) return [];
    
    // Filter structures that match selected scope
    const filtered = allStructures.filter(s => {
      if (!s.is_active) return false;
      if (s.campus !== parseInt(campusId)) return false;
      
      // If a specific structure is selected, ONLY show that one
      if (selectedStructureId && selectedStructureId !== "null") {
        if (s.id !== parseInt(selectedStructureId)) return false;
      }

      // If specific levels are selected, filter by those
      if (selectedLevels.length > 0) {
        if (s.level && !selectedLevels.includes(s.level)) return false;
      }
      
      // If specific grades are selected, filter by those
      if (selectedGrades.length > 0) {
        if (s.grade && !selectedGrades.includes(s.grade)) return false;
      }

      return true;
    });

    const typesMap = new Map();
    filtered.forEach(s => {
      s.line_items?.forEach((li: any) => {
        const name = li.fee_type_name || "Unknown";
        if (!typesMap.has(name)) {
          typesMap.set(name, {
            name,
            frequency: li.frequency || "Monthly",
            amount: 0
          });
        }
        typesMap.get(name).amount += Number(li.amount);
      });
    });

    return Array.from(typesMap.values());
  };

  const previewItems = getPreviewItems();

  const handleCampusChange = async (val: string) => {
    setCampusId(val);
    setSelectedLevels([]);
    setSelectedGrades([]);
    setSelectedSections([]);
    setSelectedStructureId("null");
    setLevelOpen(false);
    setGradeOpen(false);
    setSectionOpen(false);

    // Individual mode resets
    setIndivLevelId("");
    setIndivGradeId("");
    setIndivSectionId("");
    setSelectedStudentId("");

    const data = await feeService.getLevelsByCampus(val);
    setLevels(data || []);
    setIndivLevels(data || []);
  };

  useEffect(() => {
    const fetchGrades = async () => {
      setSelectedGrades([]); 
      setSelectedSections([]);
      if (selectedLevels.length === 0) {
        setGrades([]);
        return;
      }
      try {
        const promises = selectedLevels.map(id => feeService.getGradesByLevel(id.toString()));
        const results = await Promise.all(promises);
        setGrades(results.flat());
      } catch (e) {
        console.error(e);
      }
    };
    fetchGrades();
  }, [selectedLevels]);

  const [sections, setSections] = useState<any[]>([]);
  useEffect(() => {
    const fetchSections = async () => {
      setSelectedSections([]);
      if (selectedGrades.length === 0) {
        setSections([]);
        return;
      }
      try {
        const promises = selectedGrades.map(id => feeService.getSectionsByGrade(id.toString()));
        const results = await Promise.all(promises);
        setSections(results.flat());
      } catch (e) {
        console.error(e);
      }
    };
    fetchSections();
  }, [selectedGrades]);

  const toggleLevel = (id: number, checked: boolean) => {
    if (checked) setSelectedLevels(prev => [...prev, id]);
    else setSelectedLevels(prev => prev.filter(x => x !== id));
  };

  const toggleAllLevels = (checked: boolean) => {
    if (checked) setSelectedLevels(levels.map(l => l.id));
    else setSelectedLevels([]);
  };

  const toggleGrade = (id: number, checked: boolean) => {
    if (checked) setSelectedGrades(prev => [...prev, id]);
    else setSelectedGrades(prev => prev.filter(x => x !== id));
  };

  const toggleAllGrades = (checked: boolean) => {
    if (checked) setSelectedGrades(grades.map(g => g.id));
    else setSelectedGrades([]);
  };

  const toggleSection = (id: number, checked: boolean) => {
    if (checked) setSelectedSections(prev => [...prev, id]);
    else setSelectedSections(prev => prev.filter(x => x !== id));
  };

  const toggleAllSections = (checked: boolean) => {
    if (checked) setSelectedSections(sections.map(s => s.id));
    else setSelectedSections([]);
  };

  const handleGenerate = async () => {
    if (genMode === 'batch' && !campusId) {
      toast.error("Please select a campus");
      return;
    }
    if (genMode === 'individual' && !selectedStudentId) {
      toast.error("Please select a student");
      return;
    }
    setIsGenerating(true);
    try {
      const payload: any = {
        month,
        year,
      };

      if (genMode === 'batch') {
        payload.campus_id = parseInt(campusId);
        if (selectedStructureId !== "null") payload.structure_id = parseInt(selectedStructureId);
        if (selectedLevels.length > 0) payload.level_ids = selectedLevels;
        if (selectedGrades.length > 0) payload.grade_ids = selectedGrades;
        if (selectedSections.length > 0) payload.section_ids = selectedSections;
      } else {
        payload.student_id = parseInt(selectedStudentId);
        if (selectedStructureId !== "null") payload.structure_id = parseInt(selectedStructureId);
      }

      const res = await feeService.generateChallans(payload);
      toast.success(res.message);
      const sData = await feeService.getCollectionReport({ month, year });
      setStats(sData);
      
      if (genMode === 'individual') {
        setSelectedStudentId("");
        setStudentSearch("");
      }
    } catch (e) {
      toast.error("Failed to generate challan");
    } finally {
      setIsGenerating(false);
    }
  };

  // Fetch students for search
  const fetchStudents = async (query: string) => {
    if (!query || query.length < 2) {
      setStudents([]);
      return;
    }
    setIsSearchingStudents(true);
    try {
      // Assuming a generic student search exists or using campuses to filter
      const data = await feeService.searchStudents({ 
        q: query,
        campus_id: campusId ? parseInt(campusId) : undefined 
      });
      setStudents(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearchingStudents(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (studentSearch) fetchStudents(studentSearch);
    }, 500);
    return () => clearTimeout(timer);
  }, [studentSearch]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div>
        <h2 className="text-3xl font-extrabold text-[#274c77] mb-2 tracking-wide flex items-center gap-3">
          Financial Dashboard
        </h2>
        <p className="text-gray-600 text-lg">Generate monthly fee challans and monitor collection performance.</p>
      </div>

      <FeeTabs active="generate" />

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-l-4 border-l-blue-500 shadow-xl bg-white group hover:scale-[1.02] transition-all">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Expected Collection</p>
                <h3 className="text-3xl font-black text-[#274c77]">Rs {stats?.total_expected?.toLocaleString() || '0'}</h3>
              </div>
              <div className="p-3 bg-blue-50 rounded-2xl group-hover:bg-blue-500 group-hover:text-white transition-colors">
                <TrendingUp className="w-6 h-6 text-blue-500 group-hover:text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 shadow-xl bg-white group hover:scale-[1.02] transition-all">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Collected</p>
                <h3 className="text-2xl font-black text-emerald-600">Rs {stats?.collected?.toLocaleString() || '0'}</h3>
              </div>
              <div className="p-3 bg-emerald-50 rounded-2xl group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 group-hover:text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-rose-500 shadow-xl bg-white group hover:scale-[1.02] transition-all">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Arrears Pending</p>
                <h3 className="text-2xl font-black text-rose-600">Rs {stats?.pending?.toLocaleString() || '0'}</h3>
              </div>
              <div className="p-3 bg-rose-50 rounded-2xl group-hover:bg-rose-500 group-hover:text-white transition-colors">
                <AlertCircle className="w-6 h-6 text-rose-500 group-hover:text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <Card className="xl:col-span-5 border-none shadow-xl bg-white border border-gray-100 overflow-visible">
          <CardHeader className="p-0 border-b">
            <div className="flex">
               <button 
                onClick={() => setGenMode('batch')}
                className={`flex-1 py-4 text-sm font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${genMode === 'batch' ? 'bg-white text-[#274c77] border-b-2 border-b-[#274c77]' : 'bg-gray-50 text-gray-400 hover:text-gray-600'}`}
               >
                 <Play className="w-4 h-4 fill-current" /> Batch Mode
               </button>
               <button 
                onClick={() => setGenMode('individual')}
                className={`flex-1 py-4 text-sm font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${genMode === 'individual' ? 'bg-white text-[#274c77] border-b-2 border-b-[#274c77]' : 'bg-gray-50 text-gray-400 hover:text-gray-600'}`}
               >
                 <Users className="w-4 h-4 fill-current" /> Individual
               </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <div className="grid gap-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Assignment Period (Month & Year)</label>
              <input 
                type="month" 
                value={`${year}-${month.toString().padStart(2, '0')}`} 
                onChange={e => {
                    if (e.target.value) {
                        const [y, m] = e.target.value.split('-');
                        setYear(parseInt(y));
                        setMonth(parseInt(m));
                    }
                }}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus:ring-2 focus:ring-[#274c77] cursor-pointer font-bold text-gray-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div className="grid gap-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Campus</label>
                <Select value={campusId} onValueChange={handleCampusChange}>
                  <SelectTrigger><SelectValue placeholder="Target Campus" /></SelectTrigger>
                  <SelectContent>
                    {campuses.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.campus_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Fee Structure</label>
                <Select value={selectedStructureId} onValueChange={setSelectedStructureId} disabled={!campusId}>
                  <SelectTrigger><SelectValue placeholder="Auto Filter" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="null">Match Config (Auto)</SelectItem>
                    {allStructures.filter(s => s.campus === parseInt(campusId)).map(s => (
                      <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {genMode === 'batch' ? (
              <>
                <div className="grid grid-cols-2 gap-5">
                  <div className="grid gap-2 relative">
                    <label className="text-xs font-bold text-gray-500 uppercase">Levels (Optional)</label>
                    <div 
                      className={`flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer ${!campusId && 'opacity-50 pointer-events-none'}`}
                      onClick={() => setLevelOpen(!levelOpen)}
                    >
                      <span className={selectedLevels.length === 0 ? "text-gray-500" : ""}>
                          {selectedLevels.length > 0 ? `${selectedLevels.length} Selected` : "Select Levels"}
                      </span>
                      <span className="opacity-50">▼</span>
                    </div>
                    {levelOpen && (
                      <div className="absolute top-[70px] left-0 w-[250px] bg-white border rounded-md shadow-xl z-50 p-2 max-h-56 overflow-y-auto">
                          {levels.length > 0 && (
                            <label className="flex items-center gap-2 p-2 hover:bg-emerald-50 cursor-pointer rounded border-b mb-1">
                              <input 
                                type="checkbox"
                                checked={selectedLevels.length === levels.length && levels.length > 0}
                                onChange={(e) => toggleAllLevels(e.target.checked)}
                                className="w-4 h-4 rounded text-emerald-600 border-gray-300"
                              />
                              <span className="text-sm font-black text-emerald-700 uppercase tracking-tighter">Select All Levels</span>
                            </label>
                          )}
                          {levels.map(l => (
                              <label key={l.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer rounded">
                                  <input 
                                      type="checkbox" 
                                      checked={selectedLevels.includes(l.id)} 
                                      onChange={(e) => toggleLevel(l.id, e.target.checked)}
                                      className="w-4 h-4 rounded text-[#274c77] border-gray-300"
                                  />
                                  <span className="text-sm font-medium">{l.name} <span className="text-gray-400 font-normal capitalize">({l.shift || 'Morning'})</span></span>
                              </label>
                          ))}
                          {levels.length === 0 && <p className="text-sm text-gray-400 p-2">No levels available.</p>}
                      </div>
                    )}
                  </div>

                  <div className="grid gap-2 relative">
                    <label className="text-xs font-bold text-gray-500 uppercase">Grades (Optional)</label>
                    <div 
                      className={`flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer ${selectedLevels.length === 0 && 'opacity-50 pointer-events-none'}`}
                      onClick={() => setGradeOpen(!gradeOpen)}
                    >
                      <span className={selectedGrades.length === 0 ? "text-gray-500" : ""}>
                          {selectedGrades.length > 0 ? `${selectedGrades.length} Selected` : "Select Grades"}
                      </span>
                      <span className="opacity-50">▼</span>
                    </div>
                    {gradeOpen && (
                      <div className="absolute top-[70px] right-0 w-[250px] bg-white border rounded-md shadow-xl z-50 p-2 max-h-56 overflow-y-auto">
                          {grades.length > 0 && (
                            <label className="flex items-center gap-2 p-2 hover:bg-emerald-50 cursor-pointer rounded border-b mb-1">
                              <input 
                                type="checkbox"
                                checked={selectedGrades.length === grades.length && grades.length > 0}
                                onChange={(e) => toggleAllGrades(e.target.checked)}
                                className="w-4 h-4 rounded text-emerald-600 border-gray-300"
                              />
                              <span className="text-sm font-black text-emerald-700 uppercase tracking-tighter">Select All Grades</span>
                            </label>
                          )}
                          {grades.map(g => (
                              <label key={g.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer rounded">
                                  <input 
                                      type="checkbox" 
                                      checked={selectedGrades.includes(g.id)} 
                                      onChange={(e) => toggleGrade(g.id, e.target.checked)}
                                      className="w-4 h-4 rounded text-[#274c77] border-gray-300"
                                  />
                                  <span className="text-sm font-medium">{g.name} <span className="text-gray-400 font-normal capitalize">({g.shift || 'Morning'})</span></span>
                              </label>
                          ))}
                          {grades.length === 0 && <p className="text-sm text-gray-400 p-2">No grades available.</p>}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-2 relative">
                  <label className="text-xs font-bold text-gray-500 uppercase">Sections (Optional)</label>
                  <div 
                    className={`flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer ${selectedGrades.length === 0 && 'opacity-50 pointer-events-none'}`}
                    onClick={() => setSectionOpen(!sectionOpen)}
                  >
                    <span className={selectedSections.length === 0 ? "text-gray-500" : ""}>
                        {selectedSections.length > 0 ? `${selectedSections.length} Selected` : "Select Sections"}
                    </span>
                    <span className="opacity-50">▼</span>
                  </div>
                  {sectionOpen && (
                    <div className="absolute top-[70px] left-0 w-full bg-white border rounded-md shadow-xl z-50 p-2 max-h-56 overflow-y-auto">
                        {sections.length > 0 && (
                          <label className="flex items-center gap-2 p-2 hover:bg-emerald-50 cursor-pointer rounded border-b mb-1">
                            <input 
                              type="checkbox"
                              checked={selectedSections.length === sections.length && sections.length > 0}
                              onChange={(e) => toggleAllSections(e.target.checked)}
                              className="w-4 h-4 rounded text-emerald-600 border-gray-300"
                            />
                            <span className="text-sm font-black text-emerald-700 uppercase tracking-tighter">Select All Sections</span>
                          </label>
                        )}
                        {sections.map(s => (
                            <label key={s.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer rounded">
                                <input 
                                    type="checkbox" 
                                    checked={selectedSections.includes(s.id)} 
                                    onChange={(e) => toggleSection(s.id, e.target.checked)}
                                    className="w-4 h-4 rounded text-[#274c77] border-gray-300"
                                />
                                <span className="text-sm font-medium">{s.code} <span className="text-gray-400 font-normal capitalize">({s.shift || 'Morning'})</span></span>
                            </label>
                        ))}
                        {sections.length === 0 && <p className="text-sm text-gray-400 p-2">No sections available.</p>}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-tighter">Level</label>
                    <Select value={indivLevelId} onValueChange={async (val) => {
                      setIndivLevelId(val);
                      setIndivGradeId("");
                      setIndivSectionId("");
                      setSelectedStudentId("");
                      const data = await feeService.getGradesByLevel(val);
                      setIndivGrades(data || []);
                    }}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Level" /></SelectTrigger>
                      <SelectContent>
                        {indivLevels.map(l => <SelectItem key={l.id} value={l.id.toString()}>{l.name} <span className="text-gray-400 capitalize">{l.shift ? `(${l.shift})` : ''}</span></SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-tighter">Grade</label>
                    <Select value={indivGradeId} onValueChange={async (val) => {
                      setIndivGradeId(val);
                      setIndivSectionId("");
                      setSelectedStudentId("");
                      const data = await feeService.getSectionsByGrade(val);
                      setIndivSections(data || []);
                    }} disabled={!indivLevelId}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Grade" /></SelectTrigger>
                      <SelectContent>
                        {indivGrades.map(g => <SelectItem key={g.id} value={g.id.toString()}>{g.name} <span className="text-gray-400 capitalize">{g.shift ? `(${g.shift})` : ''}</span></SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-tighter">Section</label>
                    <Select value={indivSectionId} onValueChange={async (val) => {
                      setIndivSectionId(val);
                      setSelectedStudentId("");
                      setIsSearchingStudents(true);
                      try {
                        const data = await feeService.getStudentFees({ classroom: val }); // Using student_fees endpoint to get students in classroom if no direct student list by section exists, or use generic search
                        // Actually, I should use a generic student list endpoint filtered by classroom
                        const studentsData = await feeService.searchStudents({ classroom_id: parseInt(val) } as any);
                        setStudents(studentsData || []);
                      } catch (e) {
                         console.error(e);
                      } finally {
                         setIsSearchingStudents(false);
                      }
                    }} disabled={!indivGradeId}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Section" /></SelectTrigger>
                      <SelectContent>
                        {indivSections.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.code} <span className="text-gray-400 capitalize">{s.shift ? `(${s.shift})` : ''}</span></SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-2 relative">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Select Student</label>
                  <Select value={selectedStudentId} onValueChange={setSelectedStudentId} disabled={!indivSectionId}>
                    <SelectTrigger className="w-full h-12 border-2 border-[#274c77]/20 focus:border-[#274c77]">
                        <SelectValue placeholder={isSearchingStudents ? "Loading Students..." : "Choose Student"} />
                    </SelectTrigger>
                    <SelectContent position="popper" side="bottom">
                       {students.length > 0 ? (
                         students.map(s => (
                            <SelectItem key={s.id} value={s.id.toString()} className="py-3">
                              <div className="flex flex-col">
                                <span className="font-bold text-[#274c77]">
                                  {s.name} {s.father_name && <span className="font-normal text-xs text-gray-500 ml-1">{s.father_name}</span>}
                                </span>
                                <span className="text-[10px] text-gray-400 uppercase tracking-widest">{s.student_code}</span>
                              </div>
                            </SelectItem>
                         ))
                       ) : (
                         <div className="p-4 text-center text-gray-400 italic text-sm">No students found in this section.</div>
                       )}
                    </SelectContent>
                  </Select>
                  {isSearchingStudents && <Loader2 className="absolute right-10 top-10 w-4 h-4 animate-spin text-[#274c77]" />}
                </div>
              </div>
            )}

            <Button 
              onClick={handleGenerate} 
              className={`w-full py-6 text-base font-black shadow-lg transition-all ${genMode === 'individual' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-[#274c77] hover:bg-[#1e3a5f]'} text-white`}
              disabled={isGenerating || (genMode === 'batch' && !campusId) || (genMode === 'individual' && !selectedStudentId)}
            >
              {isGenerating ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Play className="w-5 h-5 mr-2 fill-current" />}
              {genMode === 'batch' ? 'Generate Monthly Challans' : 'Generate Individual Challan'}
            </Button>
          </CardContent>
        </Card>
        <div className="xl:col-span-7 h-full">
          <Card className="border-none shadow-xl bg-white border border-gray-100 h-full flex flex-col">
            <CardHeader className="bg-emerald-50/30 flex flex-row justify-between items-center space-y-0">
              <CardTitle className="text-[#274c77]">Fee Breakdown Preview</CardTitle>
              <CardDescription>Fees applicable for {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][month-1]} {year}.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex-1">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 uppercase text-[10px] font-black tracking-widest text-gray-400">
                    <TableHead>Fee Type</TableHead>
                    <TableHead>Cycle</TableHead>
                    <TableHead className="text-right">Estimated Amount</TableHead>
                    <TableHead className="text-right">Action State</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campusId ? (
                    previewItems.length > 0 ? (
                      <>
                        {previewItems.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-bold text-[#274c77]">{item.name}</TableCell>
                            <TableCell className="capitalize">{item.frequency.toLowerCase()}</TableCell>
                            <TableCell className="text-right font-black text-[#274c77]">Rs {item.amount.toLocaleString()}</TableCell>
                            <TableCell className="text-right font-black text-emerald-600">Will Apply</TableCell>
                          </TableRow>
                        ))}
                        <TableRow>
                          <TableCell className="font-bold text-[#274c77]">Arrears Engine</TableCell>
                          <TableCell>FIFO-Brought-Fwd</TableCell>
                          <TableCell className="text-right font-black text-rose-500">Calculated</TableCell>
                          <TableCell className="text-right font-black text-rose-500">Auto</TableCell>
                        </TableRow>
                        <TableRow className="bg-gray-50/50">
                          <TableCell colSpan={2} className="font-black text-[#274c77] uppercase text-xs tracking-widest">Total Estimated Bill (excluding arrears)</TableCell>
                          <TableCell className="text-right font-black text-xl text-[#274c77]">
                            Rs {previewItems.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-black text-[#274c77]">Preview</TableCell>
                        </TableRow>
                      </>
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="py-10 text-center text-gray-400 font-medium italic">
                          No active fee structures found for this selection.
                        </TableCell>
                      </TableRow>
                    )
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="py-10 text-center text-gray-400 font-medium">
                        Select a campus to see a preview of applicable fees.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

