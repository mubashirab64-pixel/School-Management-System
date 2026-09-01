import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  showRetryButton?: boolean;
}

export function ErrorState({ 
  title = "Error",
  message,
  onRetry,
  showRetryButton = false
}: ErrorStateProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 text-center">
          <div className="text-red-500 mb-4 flex justify-center">
            <AlertCircle className="w-12 h-12" />
          </div>
          <h2 className="text-xl font-semibold mb-2 text-gray-900">{title}</h2>
          <p className="text-gray-600 mb-4">{message}</p>
          {showRetryButton && onRetry && (
            <Button onClick={onRetry} className="bg-[#6096ba] hover:bg-[#274c77] text-white">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}