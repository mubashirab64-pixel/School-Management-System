"use client";

import React from 'react';
import { AlertCircle, RefreshCw, Phone, X } from 'lucide-react';
import { formatErrorForDisplay } from '@/lib/error-handling';

interface ErrorDisplayProps {
  error: any;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
  showIcon?: boolean;
  showActions?: boolean;
  variant?: 'default' | 'compact' | 'inline';
}

export function ErrorDisplay({
  error,
  onRetry,
  onDismiss,
  className = '',
  showIcon = true,
  showActions = true,
  variant = 'default'
}: ErrorDisplayProps) {
  const errorInfo = formatErrorForDisplay(error);

  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-2 text-red-600 text-sm ${className}`}>
        {showIcon && <AlertCircle className="h-4 w-4 flex-shrink-0" />}
        <span>{errorInfo.message}</span>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="ml-2 text-red-500 hover:text-red-700"
            aria-label="Dismiss error"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-md p-3 ${className}`}>
        <div className="flex items-start gap-2">
          {showIcon && <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />}
          <div className="flex-1">
            <p className="text-sm text-red-800 font-medium">{errorInfo.title}</p>
            <p className="text-sm text-red-700 mt-1">{errorInfo.message}</p>
            {showActions && (errorInfo.showRetry || errorInfo.showContact) && (
              <div className="flex gap-2 mt-2">
                {errorInfo.showRetry && onRetry && (
                  <button
                    onClick={onRetry}
                    className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Try Again
                  </button>
                )}
                {errorInfo.showContact && (
                  <a
                    href="mailto:support@school.com"
                    className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1"
                  >
                    <Phone className="h-3 w-3" />
                    Contact Support
                  </a>
                )}
              </div>
            )}
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-red-400 hover:text-red-600"
              aria-label="Dismiss error"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Default variant
  return (
    <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-start gap-3">
        {showIcon && <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />}
        <div className="flex-1">
          <h3 className="text-sm font-medium text-red-800">{errorInfo.title}</h3>
          <p className="text-sm text-red-700 mt-1">{errorInfo.message}</p>
          
          {showActions && (errorInfo.showRetry || errorInfo.showContact) && (
            <div className="flex gap-3 mt-3">
              {errorInfo.showRetry && onRetry && (
                <button
                  onClick={onRetry}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 transition-colors"
                >
                  <RefreshCw className="h-3 w-3" />
                  Try Again
                </button>
              )}
              {errorInfo.showContact && (
                <a
                  href="mailto:support@school.com"
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 transition-colors"
                >
                  <Phone className="h-3 w-3" />
                  Contact Support
                </a>
              )}
            </div>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-red-400 hover:text-red-600 transition-colors"
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

interface FieldErrorProps {
  error?: string;
  className?: string;
}

export function FieldError({ error, className = '' }: FieldErrorProps) {
  if (!error) return null;

  return (
    <div className={`flex items-center gap-1 text-red-500 text-sm mt-1 ${className}`}>
      <AlertCircle className="h-3 w-3 flex-shrink-0" />
      <span>{error}</span>
    </div>
  );
}

interface LoadingErrorProps {
  error: any;
  onRetry?: () => void;
  className?: string;
}

export function LoadingError({ error, onRetry, className = '' }: LoadingErrorProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center ${className}`}>
      <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">Something went wrong</h3>
      <p className="text-gray-600 mb-4 max-w-md">
        {formatErrorForDisplay(error).message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Try Again
        </button>
      )}
    </div>
  );
}
