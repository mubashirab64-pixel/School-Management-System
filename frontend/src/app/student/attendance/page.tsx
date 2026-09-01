"use client";

import { Construction } from "lucide-react";

export default function ComingSoonPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-16 h-16 bg-[#a3cef1] rounded-full flex items-center justify-center mb-4">
        <Construction className="w-8 h-8 text-[#274c77]" />
      </div>
      <h2 className="text-xl font-bold text-[#274c77] mb-2">Coming Soon</h2>
      <p className="text-gray-500 max-w-xs">This section is currently under development and will be available soon.</p>
    </div>
  );
}
