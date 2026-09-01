import { ApiError } from './api';

export interface ErrorDisplay {
  title: string;
  message: string;
  type: 'error' | 'warning' | 'info';
  field?: string;
  details?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

/**
 * Parse API error response and convert to user-friendly format
 */
export function parseApiError(error: any): ErrorDisplay {
  // Handle ApiError instances — new format already parsed in api.ts
  if (error instanceof ApiError) {
    return {
      title: getErrorTitle(error.status),
      message: error.message,
      type: 'error',
      field: error.code,
      details: error.details ? JSON.stringify(error.details) : error.response
    };
  }

  // New backend JSON format arriving raw (edge case)
  if (error?.success === false && error?.error) {
    const e = error.error;
    return {
      title: getErrorTitle(e.status ?? 500),
      message: e.message ?? 'An error occurred.',
      type: 'error',
      details: e.details ? JSON.stringify(e.details) : undefined,
    };
  }

  // Handle network errors
  if (error instanceof Error && error.name === 'TypeError' && error.message.includes('fetch')) {
    return {
      title: 'Connection Error',
      message: 'Unable to connect to the server. Please check your internet connection and try again.',
      type: 'error'
    };
  }

  // Handle timeout errors
  if (error instanceof Error && error.message.includes('timeout')) {
    return {
      title: 'Request Timeout',
      message: 'The request took too long to complete. Please try again.',
      type: 'error'
    };
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      title: 'Error',
      message: error,
      type: 'error'
    };
  }

  // Handle object errors
  if (error && typeof error === 'object') {
    // Handle validation errors from Django REST Framework
    if (error.email || error.cnic || error.password || error.username) {
      const fieldErrors = Object.entries(error).map(([field, messages]) => {
        const message = Array.isArray(messages) ? messages[0] : String(messages);
        return `${field}: ${message}`;
      }).join(', ');

      return {
        title: 'Validation Error',
        message: fieldErrors,
        type: 'error'
      };
    }

    // Handle detail field (common in DRF)
    if (error.detail) {
      return {
        title: 'Error',
        message: error.detail,
        type: 'error'
      };
    }

    // Handle error field
    if (error.error) {
      return {
        title: 'Error',
        message: error.error,
        type: 'error'
      };
    }

    // Handle message field
    if (error.message) {
      return {
        title: 'Error',
        message: error.message,
        type: 'error'
      };
    }

    // Handle non_field_errors (DRF specific)
    if (error.non_field_errors) {
      const messages = Array.isArray(error.non_field_errors) 
        ? error.non_field_errors.join(', ')
        : String(error.non_field_errors);
      
      return {
        title: 'Error',
        message: messages,
        type: 'error'
      };
    }

    // Handle generic object errors
    return {
      title: 'Error',
      message: JSON.stringify(error),
      type: 'error'
    };
  }

  // Default fallback
  return {
    title: 'Unknown Error',
    message: 'An unexpected error occurred. Please try again.',
    type: 'error'
  };
}

/**
 * Get appropriate error title based on HTTP status code
 */
function getErrorTitle(status: number): string {
  switch (status) {
    case 400:
      return 'Invalid Request';
    case 401:
      return 'Authentication Required';
    case 403:
      return 'Access Denied';
    case 404:
      return 'Not Found';
    case 409:
      return 'Conflict';
    case 422:
      return 'Validation Error';
    case 429:
      return 'Too Many Requests';
    case 500:
      return 'Server Error';
    case 502:
      return 'Bad Gateway';
    case 503:
      return 'Service Unavailable';
    default:
      return 'Error';
  }
}

/**
 * Parse validation errors for form fields
 */
export function parseValidationErrors(error: any): ValidationError[] {
  const errors: ValidationError[] = [];

  if (error && typeof error === 'object') {
    Object.entries(error).forEach(([field, messages]) => {
      if (Array.isArray(messages)) {
        messages.forEach(message => {
          errors.push({
            field,
            message: String(message),
            code: 'validation_error'
          });
        });
      } else {
        errors.push({
          field,
          message: String(messages),
          code: 'validation_error'
        });
      }
    });
  }

  return errors;
}

/**
 * Get user-friendly error message for specific error types
 */
export function getErrorMessage(error: any): string {
  const parsed = parseApiError(error);
  return parsed.message;
}

/**
 * Check if error is authentication related
 */
export function isAuthError(error: any): boolean {
  if (error instanceof ApiError) {
    return error.status === 401 || error.status === 403;
  }
  
  const message = String(error?.message || '').toLowerCase();
  return message.includes('authentication') || 
         message.includes('unauthorized') || 
         message.includes('forbidden') ||
         message.includes('token');
}

/**
 * Check if error is network related
 */
export function isNetworkError(error: any): boolean {
  if (error instanceof Error) {
    return error.name === 'TypeError' && error.message.includes('fetch');
  }
  
  const message = String(error?.message || '').toLowerCase();
  return message.includes('network') || 
         message.includes('connection') ||
         message.includes('timeout');
}

/**
 * Check if error is validation related
 */
export function isValidationError(error: any): boolean {
  if (error instanceof ApiError) {
    return error.status === 400 || error.status === 422;
  }
  
  if (error && typeof error === 'object') {
    return !!(error.email || error.cnic || error.password || error.username || error.non_field_errors);
  }
  
  return false;
}

/**
 * Format error for display in UI components
 */
export function formatErrorForDisplay(error: any): {
  title: string;
  message: string;
  type: 'error' | 'warning' | 'info';
  showRetry?: boolean;
  showContact?: boolean;
} {
  const parsed = parseApiError(error);
  
  let showRetry = false;
  let showContact = false;
  
  // Determine if retry should be shown
  if (isNetworkError(error) || (error instanceof ApiError && error.status >= 500)) {
    showRetry = true;
  }
  
  // Determine if contact support should be shown
  if (error instanceof ApiError && error.status >= 500) {
    showContact = true;
  }
  
  return {
    ...parsed,
    showRetry,
    showContact
  };
}
