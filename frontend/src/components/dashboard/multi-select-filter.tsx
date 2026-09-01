"use client"

import { useState } from "react"
import { Check, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"

interface MultiSelectFilterProps {
  title: string
  options: string[] | number[]
  selectedValues: (string | number)[]
  onSelectionChange: (values: (string | number)[]) => void
  placeholder?: string
}

export function MultiSelectFilter({
  title,
  options,
  selectedValues,
  onSelectionChange,
  placeholder = "Select options...",
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false)

  const handleToggleOption = (option: string | number) => {
    const newSelection = selectedValues.includes(option)
      ? selectedValues.filter((item) => item !== option)
      : [...selectedValues, option]
    onSelectionChange(newSelection)
  }

  const handleSelectAll = () => {
    if (selectedValues.length === options.length) {
      onSelectionChange([])
    } else {
      onSelectionChange([...options])
    }
  }

  const displayText =
    selectedValues.length === 0
      ? placeholder
      : selectedValues.length === 1
        ? String(selectedValues[0])
        : `${selectedValues.length} selected`

  return (
    <div className="space-y-2 w-full transition-all duration-300">
      <label className="text-sm font-semibold text-[#274C77]">{title}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={`w-full justify-between bg-white hover:bg-gray-50 border-2 transition-all duration-200 ${
              selectedValues.length > 0 ? 'border-[#6096BA] shadow-sm' : 'border-gray-200'
            }`}
          >
            <span className={`truncate ${selectedValues.length > 0 ? 'font-medium text-[#274C77]' : 'text-gray-500'}`}>
              {displayText}
            </span>
            <ChevronDown className={`ml-2 h-4 w-4 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0 shadow-lg border-[#6096BA]" align="start">
          <div className="p-2 space-y-2">
            <div className="flex items-center space-x-2 p-2 hover:bg-[#E7ECEF] rounded-md transition-colors">
              <Checkbox
                id="select-all"
                checked={selectedValues.length === options.length}
                onCheckedChange={handleSelectAll}
                className="border-[#6096BA]"
              />
              <label htmlFor="select-all" className="text-sm font-semibold cursor-pointer text-[#274C77]">
                Select All
              </label>
            </div>
            <div className="border-t border-[#E7ECEF] pt-2 max-h-64 overflow-y-auto">
              {options.map((option) => (
                <div
                  key={option}
                  className="flex items-center space-x-2 p-2 hover:bg-[#E7ECEF] rounded-md cursor-pointer transition-colors"
                  onClick={() => handleToggleOption(option)}
                >
                  <Checkbox
                    id={`option-${option}`}
                    checked={selectedValues.includes(option)}
                    onCheckedChange={() => handleToggleOption(option)}
                    className="border-[#6096BA]"
                  />
                  <label htmlFor={`option-${option}`} className="text-sm cursor-pointer flex-1 text-gray-700">
                    {String(option)}
                  </label>
                  {selectedValues.includes(option) && <Check className="h-4 w-4 text-[#6096BA]" />}
                </div>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {selectedValues.length > 0 && (
        <div className="flex flex-wrap gap-1 animate-fade-in">
          {selectedValues.slice(0, 3).map((value) => (
            <Badge key={value} className="text-xs bg-[#6096BA] text-white hover:bg-[#274C77] transition-colors">
              {String(value)}
            </Badge>
          ))}
          {selectedValues.length > 3 && (
            <Badge className="text-xs bg-[#A3CEF1] text-[#274C77] hover:bg-[#6096BA] hover:text-white transition-colors">
              +{selectedValues.length - 3} more
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}
