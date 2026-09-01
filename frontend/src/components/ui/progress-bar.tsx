"use client"

import { CheckCircle } from "lucide-react"

interface Step {
  id: number
  title: string
}

interface ProgressBarProps {
  steps: Step[]
  currentStep: number
  onStepClick?: (stepId: number) => void
  showClickable?: boolean
}

export function ProgressBar({ steps, currentStep, onStepClick, showClickable = false }: ProgressBarProps) {
  return (
    <div className="relative w-full">
      {/* Connecting Lines Container - Positioned behind the circles */}
      <div className="absolute top-5 left-0 w-full px-[15%] flex items-center -z-10">
        {steps.map((step, index) => (
          index < steps.length - 1 && (
            <div key={`line-${step.id}`} className="flex-1 h-[2px] bg-gray-200 mx-2">
              <div 
                className="h-full bg-[#274C77] transition-all duration-300"
                style={{ width: currentStep > step.id ? '100%' : '0%' }}
              />
            </div>
          )
        ))}
      </div>

      <div className="flex justify-between items-start relative z-10 px-6 sm:px-[10%] pb-8">
        {steps.map((step) => {
          const isCompleted = currentStep > step.id
          const isActive = currentStep === step.id
          
          return (
            <div key={step.id} className="flex flex-col items-center">
              <button
                onClick={() => onStepClick && onStepClick(step.id)}
                disabled={!showClickable || !onStepClick}
                className="flex flex-col items-center group disabled:cursor-default"
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 border-2 ${
                    isCompleted
                      ? 'bg-[#274C77] border-[#274C77] text-white'
                      : isActive
                      ? 'bg-[#E7ECEF] border-[#274C77] text-[#274C77] shadow-md scale-110'
                      : 'bg-white border-gray-200 text-gray-400'
                  }`}
                >
                  {isCompleted ? <CheckCircle className="h-5 w-5" /> : step.id}
                </div>
                <span 
                  className={`mt-3 text-xs sm:text-sm font-semibold transition-all duration-300 ${
                    isActive ? 'text-[#274C77]' : 'text-gray-500'
                  }`}
                >
                  {step.title}
                </span>
              </button>
            </div>
          )
        })}
      </div>

      {/* Bottom Progress Bar - True full width line as seen in Campus form */}
      <div className="absolute bottom-0 left-0 w-full h-[3px] bg-gray-100 overflow-hidden">
        <div 
          className="h-full bg-[#274C77] transition-all duration-500"
          style={{ width: `${(currentStep / steps.length) * 100}%` }}
        />
      </div>
    </div>
  )
}
