"use client";
/**
 * Search, status chips, A–Z strip and sort for the register.
 *
 * All of it filters the list already in memory — no request goes out. A class
 * is tens of students, not thousands, so filtering client-side keeps the
 * register instant and avoids a round-trip per keystroke.
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowDownUp, Search } from "lucide-react";

import type { MarkingStatus } from "@/components/attendance/marking-stat-cards";

/** "unmarked" is not a MarkingStatus — it is the absence of one. */
export type MarkingFilter = "all" | "unmarked" | MarkingStatus;

export type MarkingSort = "roll" | "name" | "pct";

const FILTERS: { value: MarkingFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unmarked", label: "Only Unmarked" },
  { value: "absent", label: "Only Absent" },
  { value: "late", label: "Only Late" },
  { value: "leave", label: "Only Leave" },
  { value: "excused", label: "Only Excused" },
];

const SORTS: { value: MarkingSort; label: string }[] = [
  { value: "roll", label: "Roll No" },
  { value: "name", label: "Name" },
  { value: "pct", label: "Attendance %" },
];

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export interface MarkingFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  filter: MarkingFilter;
  onFilterChange: (value: MarkingFilter) => void;
  letter: string | null;
  onLetterChange: (value: string | null) => void;
  sort: MarkingSort;
  onSortChange: (value: MarkingSort) => void;
  sortAsc: boolean;
  onSortDirectionToggle: () => void;
  /** Initials present in the class, so dead letters can be disabled. */
  availableLetters: Set<string>;
}

export default function MarkingFilters({
  search,
  onSearchChange,
  filter,
  onFilterChange,
  letter,
  onLetterChange,
  sort,
  onSortChange,
  sortAsc,
  onSortDirectionToggle,
  availableLetters,
}: MarkingFiltersProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search student by name or roll no..."
            className="h-9 pl-8"
            aria-label="Search students"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((item) => (
            <Button
              key={item.value}
              type="button"
              size="sm"
              variant={filter === item.value ? "default" : "outline"}
              className="h-8 text-xs"
              onClick={() => onFilterChange(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-500">Sort by:</span>
          <Select value={sort} onValueChange={(v) => onSortChange(v as MarkingSort)}>
            <SelectTrigger className="h-8 w-[9rem] text-xs" aria-label="Sort by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORTS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={onSortDirectionToggle}
            aria-label={sortAsc ? "Sort descending" : "Sort ascending"}
            title={sortAsc ? "Ascending" : "Descending"}
          >
            <ArrowDownUp className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Wraps rather than scrolls: a scrollbar under 26 one-character buttons
          hides half the alphabet and looks like a broken control. */}
      <div className="flex flex-wrap gap-1">
        <Button
          type="button"
          size="sm"
          variant={letter === null ? "default" : "outline"}
          className="h-7 w-7 p-0 text-[11px]"
          onClick={() => onLetterChange(null)}
        >
          All
        </Button>
        {ALPHABET.map((char) => {
          const enabled = availableLetters.has(char);
          return (
            <Button
              key={char}
              type="button"
              size="sm"
              variant={letter === char ? "default" : "outline"}
              className="h-7 w-7 p-0 text-[11px] disabled:opacity-25"
              disabled={!enabled}
              // Disabled rather than hidden: a letter vanishing as the class
              // changes would make the strip jump around under the cursor.
              onClick={() => onLetterChange(letter === char ? null : char)}
            >
              {char}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
