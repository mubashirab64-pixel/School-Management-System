"use client";

import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { parseApiError, isAuthError, isNetworkError } from '@/lib/error-handling';
import { ApiError } from '@/lib/api';

interface UseErrorHandlerOptions {
  showToast?: boolean;
  onAuthError?: () => void;
  onNetworkError?: () => void;
  onError?: (error: any) => void;
}

export function useErrorHandler(options: UseErrorHandlerOptions = {}) {
  const { toast } = useToast();
  const [error, setError] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    showToast = true,
    onAuthError,
    onNetworkError,
    onError
  } = options;

  const handleError = useCallback((error: any) => {
    console.error('Error handled:', error);
    
    setError(error);
    
    // Call custom error handler if provided
    if (onError) {
      onError(error);
    }

    // Handle authentication errors
    if (isAuthError(error)) {
      if (onAuthError) {
        onAuthError();
      } else {
        // Default auth error handling
        if (typeof window !== 'undefined') {
          localStorage.removeItem('sis_access_token');
          localStorage.removeItem('sis_refresh_token');
          localStorage.removeItem('sis_user');
          window.location.href = '/login';
        }
      }
      return;
    }

    // Handle network errors
    if (isNetworkError(error)) {
      if (onNetworkError) {
        onNetworkError();
      }
    }

    // Show toast notification
    if (showToast) {
      const errorInfo = parseApiError(error);
      toast({
        title: errorInfo.title,
        description: errorInfo.message,
        variant: "destructive"
      });
    }
  }, [toast, showToast, onAuthError, onNetworkError, onError]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const executeWithErrorHandling = useCallback(async <T>(
    operation: () => Promise<T>,
    options?: { showLoading?: boolean }
  ): Promise<T | null> => {
    const { showLoading = true } = options || {};
    
    try {
      if (showLoading) {
        setIsLoading(true);
      }
      clearError();
      
      const result = await operation();
      return result;
    } catch (error) {
      handleError(error);
      return null;
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, [handleError, clearError]);

  return {
    error,
    isLoading,
    handleError,
    clearError,
    executeWithErrorHandling
  };
}

interface UseApiCallOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: any) => void;
  showToast?: boolean;
  showLoading?: boolean;
}

export function useApiCall<T>(
  apiCall: () => Promise<T>,
  options: UseApiCallOptions<T> = {}
) {
  const { executeWithErrorHandling, isLoading, error, clearError } = useErrorHandler({
    showToast: options.showToast,
    onError: options.onError
  });

  const execute = useCallback(async () => {
    const result = await executeWithErrorHandling(apiCall, {
      showLoading: options.showLoading
    });
    
    if (result && options.onSuccess) {
      options.onSuccess(result);
    }
    
    return result;
  }, [apiCall, executeWithErrorHandling, options]);

  return {
    execute,
    isLoading,
    error,
    clearError
  };
}


interface UseFormErrorHandlerOptions {
  onFieldError?: (field: string, message: string) => void;
  onGeneralError?: (message: string) => void;
}

export function useFormErrorHandler(options: UseFormErrorHandlerOptions = {}) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string>('');

  const { onFieldError, onGeneralError } = options;

  const handleFormError = useCallback((error: any) => {
    console.error('Form error:', error);

    if (error instanceof ApiError) {
      try {
        // New backend format: details contains field errors
        const fieldErrorSource: Record<string, unknown> =
          Object.keys(error.details).length > 0
            ? error.details
            : JSON.parse(error.response || '{}')?.error?.details ?? JSON.parse(error.response || '{}');

        const fieldErrors: Record<string, string> = {};
        Object.entries(fieldErrorSource).forEach(([field, messages]) => {
          if (field !== 'non_field_errors') {
            const message = Array.isArray(messages) ? (messages as string[])[0] : String(messages);
            fieldErrors[field] = message;
            if (onFieldError) onFieldError(field, message);
          }
        });

        setFieldErrors(fieldErrors);

        const nonFieldRaw = (fieldErrorSource as any).non_field_errors;
        if (nonFieldRaw) {
          const generalMessage = Array.isArray(nonFieldRaw)
            ? nonFieldRaw.join(', ')
            : String(nonFieldRaw);
          setGeneralError(generalMessage);
          if (onGeneralError) onGeneralError(generalMessage);
        } else if (Object.keys(fieldErrors).length === 0) {
          setGeneralError(error.message);
          if (onGeneralError) onGeneralError(error.message);
        }
      } catch (parseError) {
        setGeneralError(error.message);
        if (onGeneralError) onGeneralError(error.message);
      }
    } else {
      // Handle non-ApiError errors
      const errorMessage = error?.message || 'An unexpected error occurred';
      setGeneralError(errorMessage);
      
      if (onGeneralError) {
        onGeneralError(errorMessage);
      }
    }
  }, [onFieldError, onGeneralError]);

  const clearFieldError = useCallback((field: string) => {
    setFieldErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  }, []);

  const clearAllErrors = useCallback(() => {
    setFieldErrors({});
    setGeneralError('');
  }, []);

  const getFieldError = useCallback((field: string) => {
    return fieldErrors[field] || '';
  }, [fieldErrors]);

  return {
    fieldErrors,
    generalError,
    handleFormError,
    clearFieldError,
    clearAllErrors,
    getFieldError
  };
}
