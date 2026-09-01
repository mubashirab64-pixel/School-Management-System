import React from 'react';
import { Search, Filter } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface FilterOption {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

interface SearchFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit?: (query: string) => void;
  filters: FilterOption[];
  filterValues: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  onClearFilters?: () => void;
  showClearButton?: boolean;
}

export function SearchFilterBar({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  filters,
  filterValues,
  onFilterChange,
  onClearFilters,
  showClearButton = true
}: SearchFilterBarProps) {
  const hasActiveFilters = Object.values(filterValues).some(value => value !== '');
  const hasSearchQuery = searchQuery.trim() !== '';

  const handleClear = () => {
    onSearchChange('');
    onClearFilters?.();
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSearchSubmit) {
      onSearchSubmit(searchQuery);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyPress={handleKeyPress}
          className="pl-10 pr-10 absolute inset-0"
        />
        {(hasSearchQuery || hasActiveFilters) && showClearButton && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-7"
          >
            Clear
          </Button>
        )}
      </div>

      {/* Filter Dropdowns */}
      {filters.length > 0 && (
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Filter className="h-4 w-4" />
            <span className="font-medium">Filters:</span>
          </div>
          {filters.map((filter) => (
            <div key={filter.key} className="min-w-[150px]">
              <Select
                value={filterValues[filter.key] || ''}
                onValueChange={(value) => onFilterChange(filter.key, value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={filter.placeholder || filter.label} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All {filter.label}</SelectItem>
                  {filter.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
