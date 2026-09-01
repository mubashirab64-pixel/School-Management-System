import React from 'react';
import { Button } from "@/components/ui/button";
import { 
    RotateCcw,
    CalendarClock,
    Users2,
    ArrowDownAZ,
    ArrowUpAZ,
    Search
} from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface ListFiltersProps {
    onFilterChange: (filterType: string, value?: string) => void;
    currentOrdering?: string;
    currentGender?: string;
    genderOptions?: { label: string, value: string }[];
    showGender?: boolean;
}

export const ListFilters: React.FC<ListFiltersProps> = ({
    onFilterChange,
    currentOrdering,
    currentGender,
    genderOptions,
    showGender = true
}) => {
    // Determine the alphabetical label and icon
    const isAlphabetical = currentOrdering === 'name' || currentOrdering === 'full_name' || currentOrdering === '-name' || currentOrdering === '-full_name';
    const isReverse = currentOrdering?.startsWith('-');
    
    return (
        <div className="flex flex-wrap items-center gap-2 mb-6">
            <Button 
                variant={!currentOrdering && !currentGender ? "default" : "outline"}
                size="sm"
                onClick={() => onFilterChange('all')}
                className="flex items-center gap-1.5 rounded-full px-4 h-9 transition-all border-[#a3cef1]"
                style={!currentOrdering && !currentGender ? { backgroundColor: '#274c77', color: 'white' } : { color: '#274c77' }}
            >
                <RotateCcw className="w-4 h-4" />
                <span>All</span>
            </Button>

            <Button 
                variant={isAlphabetical ? "default" : "outline"}
                size="sm"
                onClick={() => onFilterChange('alphabetical')}
                className="flex items-center gap-1.5 rounded-full px-4 h-9 transition-all border-[#a3cef1]"
                style={isAlphabetical ? { backgroundColor: '#274c77', color: 'white' } : { color: '#274c77' }}
            >
                {isReverse ? <ArrowUpAZ className="w-4 h-4" /> : <ArrowDownAZ className="w-4 h-4" />}
                <span>{isReverse ? 'Z to A' : 'A to Z'}</span>
            </Button>

            <Button 
                variant={currentOrdering?.includes('date') || currentOrdering?.includes('id') ? "default" : "outline"}
                size="sm"
                onClick={() => onFilterChange('recent')}
                className="flex items-center gap-1.5 rounded-full px-4 h-9 transition-all border-[#a3cef1]"
                style={currentOrdering?.includes('date') || currentOrdering?.includes('id') ? { backgroundColor: '#274c77', color: 'white' } : { color: '#274c77' }}
            >
                <CalendarClock className="w-4 h-4" />
                <span>Most Recent</span>
            </Button>

            {showGender && (
            <div className="flex items-center gap-2">
                <Select value={currentGender || "all"} onValueChange={(val) => onFilterChange('gender', val)}>
                    <SelectTrigger 
                        className={`h-9 px-4 rounded-full border-2 transition-all text-xs sm:text-sm font-semibold ${currentGender ? 'bg-[#274c77] border-[#274c77] text-white' : 'bg-white border-[#a3cef1] text-[#274c77] hover:bg-[#f8fafc]'}`}
                        style={{ width: '150px' }}
                    >
                        <div className="flex items-center gap-2 text-[#274c77]">
                            <Users2 className={`w-4 h-4 transition-colors ${currentGender ? 'text-[#274c77]' : 'text-[#274c77]'}`} />
                            <SelectValue placeholder="Gender" />
                        </div>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-[#a3cef1]">
                        <SelectItem value="all" className="text-[#274c77]">All Genders</SelectItem>
                        {genderOptions && genderOptions.length > 0 ? (
                            genderOptions.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value} className="text-[#274c77]">{opt.label}</SelectItem>
                            ))
                        ) : (
                            <>
                                <SelectItem value="male" className="text-[#274c77]">Male</SelectItem>
                                <SelectItem value="female" className="text-[#274c77]">Female</SelectItem>
                            </>
                        )}
                    </SelectContent>
                </Select>
            </div>
            )}


        </div>
    );
};
