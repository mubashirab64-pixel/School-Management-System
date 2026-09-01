"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrendingUp, FileText, DollarSign, BarChart, Building2, ShieldCheck } from "lucide-react";
import { getPendingPayments } from "@/lib/bankApi";

export function FeeTabs({ active }: { active: string }) {
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const fetchPending = async () => {
      try {
        const result = await getPendingPayments();
        setPendingCount(result?.length || 0);
      } catch (e) {
        console.error("Failed to fetch pending payments for tabs:", e);
      }
    };
    fetchPending();
    
    // Refresh every 2 minutes
    const interval = setInterval(fetchPending, 120000);
    return () => clearInterval(interval);
  }, []);

  const tabs = [
    { id: "overview",         label: "Dashboard",          href: "/admin/fees",                      icon: TrendingUp },
    { id: "generate",         label: "Generate Fees",      href: "/admin/fees/generate",             icon: FileText },
    { id: "structures",       label: "Structures",         href: "/admin/fees/structures",           icon: FileText },
    { id: "fee-types",        label: "Fee Types",          href: "/admin/fees/fee-types",            icon: FileText },
    { id: "students",         label: "Student Fees",       href: "/admin/fees/students",             icon: DollarSign },
    { id: "reports",          label: "Reports",            href: "/admin/fees/reports",              icon: BarChart },
    { id: "bank-accounts",    label: "Bank Accounts",      href: "/admin/fees/bank-accounts",        icon: Building2 },
    { id: "pending-payments", label: "Verify Payments",    href: "/admin/fees/pending-payments",     icon: ShieldCheck },
  ];

  return (
    <div className="flex flex-wrap gap-2 bg-white/50 p-1.5 rounded-2xl border border-[#a3cef1]/30">
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        const isVerifyTab = tab.id === "pending-payments";
        
        return (
          <Link href={tab.href} key={tab.id}>
            <button
              className={`
                rounded-xl transition-all font-bold px-6 py-3 flex items-center gap-2 text-sm relative
                ${isActive 
                  ? "bg-[#1e3a5f] text-white shadow-md" 
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"}
              `}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
              
              {isVerifyTab && pendingCount > 0 && (
                <div className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded-lg shadow-sm animate-pulse border-2 border-white">
                  {pendingCount} NEW
                </div>
              )}
            </button>
          </Link>
        );
      })}
    </div>
  );
}
