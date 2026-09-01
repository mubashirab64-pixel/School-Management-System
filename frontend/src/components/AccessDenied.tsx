"use client"
import React from 'react'
import { Button } from "@/components/ui/button"
import { ShieldAlert, Lock } from "lucide-react"

interface AccessDeniedProps {
    message?: string
    title?: string
}

export function AccessDenied({
    title = "Access Restricted",
    message = "You do not have the required permissions to access this page. Please contact your system administrator to request access."
}: AccessDeniedProps) {
    return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
            <div className="bg-white/80 backdrop-blur-md p-10 rounded-3xl shadow-2xl border border-white/20 text-center max-w-lg transform transition-all duration-500 hover:scale-[1.02]">
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-red-50 mb-6 relative">
                    <ShieldAlert className="w-12 h-12 text-red-500 relative z-10" />
                    <div className="absolute inset-0 rounded-full bg-red-100 animate-pulse scale-125 opacity-30"></div>
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-4 tracking-tight">{title}</h2>
                <p className="text-gray-600 mb-8 leading-relaxed">
                    {message}
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button
                        onClick={() => window.history.back()}
                        variant="outline"
                        className="px-8 py-4 rounded-xl border-2 hover:bg-gray-50 text-gray-700 font-semibold transition-all"
                    >
                        Go Back
                    </Button>
                    <Button
                        className="px-8 py-4 rounded-xl bg-[#274c77] hover:bg-[#1a3554] text-white font-semibold shadow-lg shadow-blue-200 transition-all flex items-center gap-2"
                        onClick={() => window.location.href = '/admin'}
                    >
                        <Lock className="w-4 h-4" />
                        Dashboard
                    </Button>
                </div>
            </div>
            <div className="mt-8 text-sm text-gray-400 font-medium tracking-widest uppercase">
                Al-Khair IT • Educational Management System
            </div>
        </div>
    )
}
