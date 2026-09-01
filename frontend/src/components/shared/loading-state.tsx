import React from 'react';
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface LoadingStateProps {
  message?: string;
  fullScreen?: boolean;
}

export function LoadingState({ 
  message = "Loading...", 
  fullScreen = false 
}: LoadingStateProps) {
  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <LoadingSpinner message={message} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <LoadingSpinner message={message} />
      </div>
    </div>
  );
}
