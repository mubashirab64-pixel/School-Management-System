"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calender"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  id?: string
  date?: Date | string
  onChange: (date: string) => void
  placeholder?: string
  label?: string
  required?: boolean
  error?: boolean
  className?: string
  disabled?: (date: Date) => boolean
}

export function DatePicker({
  id,
  date,
  onChange,
  placeholder = "Select date",
  label,
  required,
  error,
  className,
  disabled
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  
  const selectedDate = React.useMemo(() => {
    if (!date) return undefined
    const d = new Date(date)
    return isNaN(d.getTime()) ? undefined : d
  }, [date])

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-semibold text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant={"outline"}
            className={cn(
              "w-full h-11 justify-start text-left font-normal border-2 rounded-xl transition-all duration-200 bg-white",
              !date && "text-muted-foreground",
              error ? "border-red-500 bg-red-50/10 focus:border-red-500" : "border-gray-200 focus:border-blue-400 focus:ring-blue-400",
            )}
          >
            <CalendarIcon className={cn("mr-2 h-5 w-5", error ? "text-red-400" : "text-blue-500")} />
            {selectedDate ? format(selectedDate, "PPP") : <span className="text-base">{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 rounded-2xl border-2 shadow-xl" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(d) => {
              if (d) {
                onChange(format(d, "yyyy-MM-dd"))
                setOpen(false)
              }
            }}
            disabled={disabled}
            initialFocus
            className="rounded-2xl"
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
