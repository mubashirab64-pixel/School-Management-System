"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { X, Plus, ChevronRight, ChevronDown, Trash2, GraduationCap } from "lucide-react"

export interface GradeEntry {
  level: string
  grade: string
  shift?: string
  classrooms: {
    count: number
    names: string[]
  }
}

interface GradeWizardProps {
  grades: GradeEntry[]
  shiftType: string
  shiftLabel: string
  onChange: (grades: GradeEntry[]) => void
}

const DEFAULT_LEVELS: Record<string, string[]> = {
  "Pre-Primary": ["Nursery", "KG-I", "KG-II"],
  "Primary": ["Grade I", "Grade II", "Grade III", "Grade IV", "Grade V"],
  "Secondary": ["Grade VI", "Grade VII", "Grade VIII", "Grade IX", "Grade X"],
  "Higher Secondary": ["Grade XI", "Grade XII"],
}

type WizardStep = "level" | "grade" | "classroom"

interface ModalState {
  open: boolean
  step: WizardStep
  selectedLevels: string[]
  availableLevels: string[]
  customLevels: Record<string, string[]>
  selectedGrades: Record<string, string[]> // keys: level
  newLevelInput: string
  newGradeInput: string
  addingLevel: boolean
  addingGradeLevel: string | null
  classroomData: Record<string, {
    count: string, names: string
  }> // keys: `${level}|${grade}`
}

export function GradeWizard({ grades, shiftType, shiftLabel, onChange }: GradeWizardProps) {
  const [modal, setModal] = useState<ModalState>({
    open: false,
    step: "level",
    selectedLevels: [],
    availableLevels: Object.keys(DEFAULT_LEVELS),
    customLevels: {},
    selectedGrades: {},
    newLevelInput: "",
    newGradeInput: "",
    addingLevel: false,
    addingGradeLevel: null,
    classroomData: {},
  })

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const openWizard = () =>
    setModal(prev => ({ ...prev, open: true, step: "level", selectedLevels: [], selectedGrades: {}, classroomData: {} }))

  const closeWizard = () => setModal(prev => ({ ...prev, open: false }))

  const allLevels = modal.availableLevels

  const gradesForLevel = (level: string): string[] => {
    const custom = modal.customLevels[level] || []
    const defaults = DEFAULT_LEVELS[level] || []
    return [...defaults, ...custom]
  }

  const toggleLevel = (level: string) => {
    setModal(prev => ({
      ...prev,
      selectedLevels: prev.selectedLevels.includes(level)
        ? prev.selectedLevels.filter(l => l !== level)
        : [...prev.selectedLevels, level],
    }))
  }

  const toggleGrade = (level: string, grade: string) => {
    setModal(prev => {
      const current = prev.selectedGrades[level] || []
      const updated = current.includes(grade) ? current.filter(g => g !== grade) : [...current, grade]
      return {
        ...prev,
        selectedGrades: { ...prev.selectedGrades, [level]: updated }
      }
    })
  }

  const goToGrades = () => {
    if (modal.selectedLevels.length === 0) return
    setModal(prev => ({ ...prev, step: "grade" }))
  }

  const goToClassrooms = () => {
    const hasAnyGrade = Object.values(modal.selectedGrades).some(arr => arr.length > 0)
    if (!hasAnyGrade) return

    const initData: Record<string, any> = { ...modal.classroomData }
    Object.entries(modal.selectedGrades).forEach(([level, gradesArr]) => {
      gradesArr.forEach(grade => {
        const key = `${level}|${grade}`
        if (!initData[key]) {
          initData[key] = { count: "", names: "" }
        }
      })
    })

    setModal(prev => ({ ...prev, step: "classroom", classroomData: initData }))
  }

  const parseNames = (names: string) => names ? names.split(",").map(n => n.trim()).filter(Boolean) : []

  const namesCountMismatch = (data: { count: string, names: string }) => {
    const count = parseInt(data.count || "0") || 0
    const namesList = parseNames(data.names)
    return count > 0 && namesList.length > 0 && namesList.length !== count
  }

  const saveGrades = () => {
    const newEntries: GradeEntry[] = []

    Object.entries(modal.selectedGrades).forEach(([level, gradesArr]) => {
      gradesArr.forEach(grade => {
        const data = modal.classroomData[`${level}|${grade}`]
        if (!data) return

        newEntries.push({
          level, grade, shift: shiftType,
          classrooms: { count: parseInt(data.count || "0") || 0, names: parseNames(data.names) }
        })
      })
    })

    const newKeys = new Set(newEntries.map(e => `${e.level}|${e.grade}|${e.shift}`))
    const filtered = grades.filter(e => !newKeys.has(`${e.level}|${e.grade}|${e.shift}`))
    onChange([...filtered, ...newEntries])
    closeWizard()
  }

  const addCustomLevel = () => {
    const name = modal.newLevelInput.trim()
    if (!name || allLevels.includes(name)) return
    setModal(prev => ({
      ...prev,
      availableLevels: [...prev.availableLevels, name],
      newLevelInput: "",
      addingLevel: false,
    }))
  }

  const addCustomGrade = (level: string) => {
    const name = modal.newGradeInput.trim()
    if (!name) return
    setModal(prev => ({
      ...prev,
      customLevels: {
        ...prev.customLevels,
        [level]: [...(prev.customLevels[level] || []), name],
      },
      newGradeInput: "",
      addingGradeLevel: null,
      selectedGrades: {
        ...prev.selectedGrades,
        [level]: [...(prev.selectedGrades[level] || []), name]
      }
    }))
  }

  const removeEntry = (entry: GradeEntry) => {
    onChange(grades.filter(e => !(e.level === entry.level && e.grade === entry.grade && e.shift === entry.shift)))
  }

  const grouped = grades.reduce<Record<string, GradeEntry[]>>((acc, entry) => {
    const key = `${entry.level}`
    if (!acc[key]) acc[key] = []
    acc[key].push(entry)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" onClick={openWizard} className="border-dashed border-[#6096BA]/40 border-2 text-[#274C77] hover:bg-[#6096BA]/10 hover:border-[#6096BA]">
          <Plus className="w-4 h-4 mr-2" />
          {grades.length === 0 ? "Add Levels & Grades" : "Edit Configuration"}
        </Button>
        {grades.length > 0 && (
          <span className="text-sm font-medium text-slate-500">{grades.length} configured item(s)</span>
        )}
      </div>

      {Object.keys(grouped).length > 0 && (
        <div className="space-y-3 mt-4">
          {Object.entries(grouped).map(([groupKey, entries]) => (
            <div key={groupKey} className="border-2 border-slate-100 rounded-xl overflow-hidden bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setCollapsed(prev => ({ ...prev, [groupKey]: !prev[groupKey] }))}
                className="w-full flex items-center justify-between px-6 py-3 bg-slate-50 hover:bg-[#6096BA]/10 text-left transition-colors"
              >
                <span className="font-bold text-sm text-[#274C77] flex items-center gap-3 uppercase tracking-wider">
                  <GraduationCap className="w-5 h-5" />
                  {groupKey}
                  <Badge variant="secondary" className="ml-2 bg-[#6096BA]/20 text-[#274C77] border-none">{entries.length}</Badge>
                </span>
                {collapsed[groupKey] ? <ChevronRight className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </button>
              {!collapsed[groupKey] && (
                <div className="divide-y divide-slate-100">
                  {entries.map((entry, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 text-sm gap-4 hover:bg-slate-50/50 transition-colors">
                      <span className="font-bold text-slate-700">{entry.grade}</span>
                      <div className="flex items-center gap-4">
                        <Badge variant="outline" className="text-xs bg-white text-slate-600 border-slate-200">
                          {entry.classrooms.count} classroom{entry.classrooms.count !== 1 ? "s" : ""}
                          {entry.classrooms.names.length > 0 && `: ${entry.classrooms.names.join(", ")}`}
                        </Badge>
                        <button
                          type="button"
                          onClick={() => removeEntry(entry)}
                          className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-md transition-colors"
                          title="Delete exactly this configuration"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal.open && mounted && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-auto overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-6 border-b bg-gradient-to-r from-[#274C77] to-[#6096BA] shrink-0">
              <div>
                <h2 className="text-white font-bold text-xl tracking-wide">
                  {modal.step === "level" && `Step 1: Select ${shiftLabel} Levels`}
                  {modal.step === "grade" && `Step 2: Select Grades for ${shiftLabel}`}
                  {modal.step === "classroom" && `Step 3: Setup Classrooms for ${shiftLabel}`}
                </h2>
                <p className="text-blue-100/80 text-sm mt-1 uppercase tracking-wider font-semibold">
                  {shiftLabel}
                </p>
              </div>
              <button onClick={closeWizard} className="text-white/80 hover:text-white p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 overflow-y-auto">
              
              {/* STEP A: Multi-Level Selection */}
              {modal.step === "level" && (
                <div className="space-y-6">
                  <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 mb-6">
                    <p className="text-sm font-bold text-blue-800">Select Multiple Levels</p>
                    <p className="text-xs text-blue-600 mt-1">Select the levels that operate during the {shiftLabel}.</p>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                    {allLevels.map(level => {
                      const isCustom = !Object.keys(DEFAULT_LEVELS).includes(level)
                      const isSelected = modal.selectedLevels.includes(level)
                      return (
                        <div key={level} className="relative group">
                          <button
                            type="button"
                            onClick={() => toggleLevel(level)}
                            className={`w-full h-full py-8 px-4 border-2 rounded-xl text-center transition-all font-bold 
                              ${isSelected 
                                ? "border-[#6096BA] bg-blue-50/30 text-[#274C77] shadow-sm transform scale-[1.02]" 
                                : "border-slate-100 hover:border-[#6096BA]/40 text-slate-600 hover:bg-slate-50"}`}
                          >
                            <GraduationCap className={`w-8 h-8 mx-auto mb-3 ${isSelected ? "text-[#274C77]" : "text-[#6096BA]/60"}`} />
                            {level}
                          </button>
                          {isCustom && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setModal(prev => ({ 
                                  ...prev, 
                                  availableLevels: prev.availableLevels.filter(l => l !== level),
                                  selectedLevels: prev.selectedLevels.filter(l => l !== level)
                                }))
                              }}
                              className="absolute top-2 right-2 p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500 rounded-full transition-colors md:opacity-0 md:group-hover:opacity-100"
                              title="Delete Custom Level"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {modal.addingLevel ? (
                    <div className="flex gap-3 mt-4">
                      <Input
                        autoFocus
                        value={modal.newLevelInput}
                        onChange={e => setModal(prev => ({ ...prev, newLevelInput: e.target.value }))}
                        onKeyDown={e => e.key === "Enter" && addCustomLevel()}
                        placeholder="New level name..."
                        className="flex-1 h-12 border-slate-200"
                      />
                      <Button type="button" onClick={addCustomLevel} className="h-12 px-6 bg-[#274C77] hover:bg-[#6096BA] font-bold">Add</Button>
                      <Button type="button" variant="ghost" onClick={() => setModal(prev => ({ ...prev, addingLevel: false }))} className="h-12 font-bold text-slate-500">
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setModal(prev => ({ ...prev, addingLevel: true }))}
                      className="w-full flex items-center justify-center gap-2 py-4 mt-2 border-2 border-dashed border-slate-200 rounded-xl text-sm font-bold text-slate-500 hover:border-[#6096BA] hover:text-[#6096BA] hover:bg-slate-50 transition-all uppercase tracking-wider"
                    >
                      <Plus className="w-5 h-5" /> Add New Custom Level
                    </button>
                  )}

                  <div className="flex justify-end pt-6 border-t border-slate-100 mt-6">
                    <Button
                      type="button"
                      className="h-14 px-8 text-md font-bold bg-gradient-to-r from-[#274C77] to-[#6096BA] hover:opacity-90 transition-opacity"
                      disabled={modal.selectedLevels.length === 0}
                      onClick={goToGrades}
                    >
                      Continue to Grades Setup
                      <ChevronRight className="w-5 h-5 ml-2" />
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP B: Grade Selection */}
              {modal.step === "grade" && (
                <div className="space-y-10">
                  {modal.selectedLevels.map(level => {
                    const selectedForLevel = modal.selectedGrades[level] || []
                    return (
                      <div key={level} className="space-y-4">
                        <h3 className="text-lg font-bold text-[#274C77] uppercase tracking-wider flex items-center gap-3">
                          <GraduationCap className="w-5 h-5 text-[#6096BA]" />
                          {level}
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                          {gradesForLevel(level).map(grade => {
                            const isSelected = selectedForLevel.includes(grade)
                            return (
                              <label key={grade} className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${isSelected ? "border-[#6096BA] bg-blue-50/50 shadow-sm" : "border-slate-200 hover:border-[#6096BA]/40 bg-white"}`}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleGrade(level, grade)}
                                  className="h-5 w-5 text-[#6096BA] rounded border-slate-300 focus:ring-[#6096BA]"
                                />
                                <span className={`text-sm font-bold ${isSelected ? "text-[#274C77]" : "text-slate-600"}`}>{grade}</span>
                              </label>
                            )
                          })}
                          
                          {/* Adding Grade directly under level */}
                          {modal.addingGradeLevel === level ? (
                            <div className="col-span-full flex gap-3 mt-2">
                              <Input
                                autoFocus
                                value={modal.newGradeInput}
                                onChange={e => setModal(prev => ({ ...prev, newGradeInput: e.target.value }))}
                                onKeyDown={e => e.key === "Enter" && addCustomGrade(level)}
                                placeholder={`New grade in ${level}...`}
                                className="flex-1 h-12 border-slate-200"
                              />
                              <Button type="button" onClick={() => addCustomGrade(level)} className="h-12 px-6 bg-[#274C77] hover:bg-[#6096BA]">Add</Button>
                              <Button type="button" variant="ghost" onClick={() => setModal(prev => ({ ...prev, addingGradeLevel: null, newGradeInput: "" }))} className="h-12">
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setModal(prev => ({ ...prev, addingGradeLevel: level, newGradeInput: "" }))}
                              className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-200 rounded-xl text-sm font-bold text-slate-500 hover:border-[#6096BA] hover:text-[#6096BA] bg-white transition-all uppercase tracking-wider h-full"
                            >
                              <Plus className="w-5 h-5" /> Add
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  <div className="flex gap-4 pt-6 border-t border-slate-100">
                    <Button type="button" variant="outline" onClick={() => setModal(prev => ({ ...prev, step: "level" }))} className="h-14 px-8 font-bold text-slate-600 border-slate-200">
                      Back to Levels
                    </Button>
                    <Button
                      type="button"
                      className="flex-1 h-14 text-md font-bold bg-gradient-to-r from-[#274C77] to-[#6096BA] hover:opacity-90 transition-opacity"
                      disabled={Object.values(modal.selectedGrades).every(arr => arr.length === 0)}
                      onClick={goToClassrooms}
                    >
                      Next Step: Configure Classrooms
                      <ChevronRight className="w-5 h-5 ml-2" />
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP C: Classroom Setup */}
              {modal.step === "classroom" && (
                <div className="space-y-8">
                  {Object.entries(modal.selectedGrades).map(([level, gradesArr]) => {
                    if (gradesArr.length === 0) return null;
                    return (
                      <div key={level} className="space-y-6">
                        <h4 className="text-lg font-bold text-[#274C77] uppercase tracking-wider flex items-center gap-3 pb-2 border-b-2 border-slate-100">
                          <GraduationCap className="w-5 h-5" /> {level}
                        </h4>
                        
                        <div className="space-y-6 pl-4">
                          {gradesArr.map(grade => {
                            const dataKey = `${level}|${grade}`
                            const data = modal.classroomData[dataKey] || { count: "", names: "" }
                            
                            return (
                              <div key={grade} className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm">
                                <p className="font-bold text-lg text-[#274C77] mb-5">{grade}</p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="space-y-2">
                                    <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Number of Classrooms</Label>
                                    <Input
                                      type="number" min="0" value={data.count}
                                      onChange={e => setModal(prev => ({
                                        ...prev, classroomData: { ...prev.classroomData, [dataKey]: { ...prev.classroomData[dataKey], count: e.target.value } }
                                      }))}
                                      className="h-11 border-slate-200" placeholder="e.g. 3"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Names (Comma Separated)</Label>
                                    <Input
                                      value={data.names}
                                      onChange={e => {
                                        const lettersOnly = e.target.value.replace(/[^a-zA-Z,\s]/g, "")
                                        setModal(prev => ({
                                          ...prev, classroomData: { ...prev.classroomData, [dataKey]: { ...prev.classroomData[dataKey], names: lettersOnly } }
                                        }))
                                      }}
                                      className={`h-11 border-slate-200 ${namesCountMismatch(data) ? "border-red-500" : ""}`} placeholder="e.g. A, B, C"
                                    />
                                    {namesCountMismatch(data) && (
                                      <p className="text-xs text-red-600 mt-1">
                                        {parseNames(data.names).length} name(s) entered but {data.count} classroom(s) specified — must match
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}

                  <div className="flex gap-4 pt-8 border-t border-slate-100 mt-8">
                    <Button type="button" variant="outline" onClick={() => setModal(prev => ({ ...prev, step: "grade" }))} className="h-14 px-8 font-bold text-slate-600 border-slate-200">
                      Back to Grades
                    </Button>
                    <Button
                      type="button"
                      disabled={Object.values(modal.classroomData).some(d => namesCountMismatch(d))}
                      className="flex-1 h-14 text-md font-bold bg-gradient-to-r from-[#274C77] to-[#6096BA] hover:opacity-90 transition-opacity tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={saveGrades}
                    >
                      SAVE ALL CONFIGURATIONS
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
