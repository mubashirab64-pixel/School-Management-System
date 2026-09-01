import { CacheManager } from './cache';
import { clearAllDrafts } from './offline/db';

export function getApiBaseUrl(): string {
  // Prefer envs; provide sensible fallbacks per environment
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || 'https://sms.idaraalkhair.sbs';
  return baseUrl;
}

// API endpoints - obfuscated to reduce visibility in bundled code
const _a = '/api', _s = 'students', _t = 'teachers', _c = 'campus', _u = 'users';
const _at = 'attendance', _co = 'coordinators', _p = 'principals';
const _l = 'levels', _g = 'grades', _cr = 'classrooms', _au = 'auth';
const _cu = 'current-user', _tc = 'total', _gs = 'gender_stats';
const _cs = 'campus_stats', _gd = 'grade_distribution', _et = 'enrollment_trend';
const _mt = 'mother_tongue_distribution', _rd = 'religion_distribution';
const _ad = 'age_distribution', _zs = 'zakat_status', _ho = 'house_ownership';
const _lo = 'login', _rf = 'refresh', _ch = 'choices', _sec = 'sections';
const _av = 'available', _id = '{id}', _na = 'new_admissions_stats';
const _tt = 'timetable', _sub = 'subjects', _ctt = 'class-timetable', _ttt = 'teacher-timetable';
const _f = 'fees', _ft = 'fee-types', _fs = 'structures', _sf = 'student-fees', _py = 'payments', _gn = 'generate', _rp = 'reports';

const getEndpoints = () => ({
  STUDENTS: `${_a}/${_s}/`,
  STUDENTS_FORM_OPTIONS: `${_a}/${_s}/form_options/`,
  CHECK_STUDENT_DUPLICATE: `${_a}/${_s}/check_duplicate/`,
  STUDENTS_TOTAL: `${_a}/${_s}/${_tc}/`,
  STUDENTS_GENDER_STATS: `${_a}/${_s}/${_gs}/`,
  STUDENTS_CAMPUS_STATS: `${_a}/${_s}/${_cs}/`,
  STUDENTS_GRADE_DISTRIBUTION: `${_a}/${_s}/${_gd}/`,
  STUDENTS_ENROLLMENT_TREND: `${_a}/${_s}/${_et}/`,
  STUDENTS_MOTHER_TONGUE_DISTRIBUTION: `${_a}/${_s}/${_mt}/`,
  STUDENTS_RELIGION_DISTRIBUTION: `${_a}/${_s}/${_rd}/`,
  STUDENTS_AGE_DISTRIBUTION: `${_a}/${_s}/${_ad}/`,
  STUDENTS_NEW_ADMISSIONS: `${_a}/${_s}/${_na}/`,
  STUDENTS_ZAKAT_STATUS: `${_a}/${_s}/${_zs}/`,
  STUDENTS_HOUSE_OWNERSHIP: `${_a}/${_s}/${_ho}/`,
  TEACHERS: `${_a}/${_t}/`,
  CAMPUS: `${_a}/${_c}/`,
  CAMPUS_ACTIVE: `${_a}/${_c}/active/`,
  USERS: `${_a}/${_u}/`,
  AUTH_LOGIN: `${_a}/${_au}/${_lo}/`,
  AUTH_REFRESH: `${_a}/${_au}/${_rf}/`,
  COORDINATORS: `${_a}/${_co}/`,
  COORDINATORS_FORM_OPTIONS: `${_a}/${_co}/form_options/`,
  PRINCIPALS: `${_a}/${_p}/`,
  LEVELS: `${_a}/${_l}/`,
  GRADES: `${_a}/${_g}/`,
  CLASSROOMS: `${_a}/${_cr}/`,
  LEVEL_CHOICES: `${_a}/${_l}/${_ch}/`,
  GRADE_CHOICES: `${_a}/${_g}/${_ch}/`,
  CLASSROOM_CHOICES: `${_a}/${_cr}/${_ch}/`,
  CLASSROOM_SECTIONS: `${_a}/${_cr}/${_sec}/`,
  CLASSROOM_STUDENTS: `${_a}/${_at}/class/${_id}/${_s}/`,
  AVAILABLE_STUDENTS: `${_a}/${_at}/class/${_id}/${_av}-${_s}/`,
  CURRENT_USER_PROFILE: `${_a}/${_cu}/`,
  CHECK_EMAIL: `${_a}/users/check-email/`,
  // Permissions
  ROLE_PERMISSIONS: `${_a}/permissions/`,
  TOGGLE_PERMISSION: `${_a}/permissions/toggle/`,
  MY_PERMISSIONS: `${_a}/permissions/my/`,
  // Behaviour
  BEHAVIOUR_CREATE: `/api/behaviour/record/`,
  BEHAVIOUR_STUDENT: (id: number | string) => `/api/behaviour/student/${id}/`,
  BEHAVIOUR_MONTHLY_STUDENT: (id: number | string) => `/api/behaviour/monthly/student/${id}/`,
  BEHAVIOUR_MONTHLY_COMPUTE: `/api/behaviour/monthly/compute/`,
  // Timetable
  TIMETABLE: `${_a}/${_tt}/`,
  TIMETABLE_SUBJECTS: `${_a}/${_tt}/${_sub}/`,
  TIMETABLE_CLASS: `${_a}/${_tt}/${_ctt}/`,
  TIMETABLE_TEACHER: `${_a}/${_tt}/${_ttt}/`,
  FORM_TEMPLATES: `${_a}/form-builder/templates/`,
  // Fees
  FEE_TYPES: `${_a}/${_f}/${_ft}/`,
  FEE_STRUCTURES: `${_a}/${_f}/${_fs}/`,
  STUDENT_FEES: `${_a}/${_f}/${_sf}/`,
  FEE_PAYMENTS: `${_a}/${_f}/${_py}/`,
  FEE_GENERATE: `${_a}/${_f}/${_gn}/`,
  FEE_REPORTS_COLLECTION: `${_a}/${_f}/${_rp}/collection/`,
  FEE_CASH_RECORD: `${_a}/${_f}/cash/record/`,
  CURRENT_USER_UPLOAD_PHOTO: `${_a}/${_cu}/upload-photo/`,
  STUDENT_RESULTS: (id: number | string) => `/api/students/${id}/results/`,
  SYSTEM_VERSION: `${_a}/version/`,
  SYSTEM_VERSION_RELEASE: `${_a}/version/release/`,
});

export const API_ENDPOINTS = getEndpoints() as ReturnType<typeof getEndpoints>;


// Enhanced error handling
export class ApiError extends Error {
  public code: string;
  public details: Record<string, unknown>;

  constructor(
    message: string,
    public status: number,
    public statusText: string,
    public response?: any,
    code?: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code ?? _statusToCode(status);
    this.details = details ?? {};
  }
}

function _statusToCode(status: number): string {
  const map: Record<number, string> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    422: 'VALIDATION_ERROR',
    429: 'TOO_MANY_REQUESTS',
    500: 'SERVER_ERROR',
    502: 'BAD_GATEWAY',
    503: 'SERVICE_UNAVAILABLE',
    504: 'NETWORK_ERROR',
  };
  return map[status] ?? (status === 0 ? 'NETWORK_ERROR' : 'SERVER_ERROR');
}

// Generic API error handler — understands new backend format
function handleApiError(response: Response, errorText: string): never {
  let errorMessage = `API Error (${response.status}): ${response.statusText}`;
  let errorCode: string | undefined;
  let errorDetails: Record<string, unknown> | undefined;

  // Shared flattener for {field: ["msg", ...]} / nested DRF-style error shapes
  const flattenError = (err: unknown): string => {
    if (typeof err === 'string') return err;
    if (Array.isArray(err)) return err.map(flattenError).join(', ');
    if (typeof err === 'object' && err !== null) {
      return Object.entries(err)
        .map(([key, val]) => {
          const flattenedVal = flattenError(val);
          if (['non_field_errors', 'detail', 'error'].includes(key)) return flattenedVal;
          return `${key}: ${flattenedVal}`;
        })
        .join('; ');
    }
    return String(err);
  };

  try {
    const errorData = JSON.parse(errorText);

    // New backend format: {success: false, error: {code, message, details, status}}
    if (errorData?.success === false && errorData?.error) {
      const err = errorData.error;
      errorMessage = err.message ?? errorMessage;
      errorCode = err.code;
      errorDetails = err.details ?? {};
      // `details` usually holds the actual per-field validation reasons (e.g.
      // {"official_email": ["Enter a valid email address."]}) — without merging
      // them in, callers only ever see the generic top-level message ("Bad request.")
      // and the user has no way to tell which field/why it failed.
      if (errorDetails && Object.keys(errorDetails).length > 0) {
        const detailsText = flattenError(errorDetails);
        if (detailsText && detailsText !== errorMessage) {
          errorMessage = `${errorMessage} (${detailsText})`;
        }
      }
      throw new ApiError(errorMessage, response.status, response.statusText, errorText, errorCode, errorDetails);
    }

    // Legacy DRF formats
    if (errorData) {
      errorMessage = flattenError(errorData);
    }
  } catch (e) {
    if (e instanceof ApiError) throw e;
    
    // Check if the error text is actually HTML (common with Nginx timeouts/errors)
    if (errorText && (errorText.trim().startsWith('<!DOCTYPE html>') || errorText.trim().startsWith('<html') || errorText.includes('<body'))) {
      errorMessage = `Server Error (${response.status}): The server returned an unexpected response. This usually happens during maintenance or when the server is overloaded. Please try again in a few moments.`;
    } else if (errorText) {
      errorMessage = errorText;
    }
  }

  throw new ApiError(errorMessage, response.status, response.statusText, errorText, errorCode, errorDetails);
}

const ACCESS_TOKEN_KEY = 'sis_access_token';
const REFRESH_TOKEN_KEY = 'sis_refresh_token';

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setAuthTokens(access: string, refresh?: string) {
  if (typeof window === 'undefined') return;

  // Store in localStorage
  window.localStorage.setItem(ACCESS_TOKEN_KEY, access);
  if (refresh) window.localStorage.setItem(REFRESH_TOKEN_KEY, refresh);

  // Also store in cookies for middleware access
  document.cookie = `sis_access_token=${access}; path=/; max-age=${15 * 60}`; // 15 minutes
  if (refresh) {
    document.cookie = `sis_refresh_token=${refresh}; path=/; max-age=${7 * 24 * 60 * 60}`; // 7 days
  }
}

export function clearAuthTokens() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);

  // Also clear cookies
  document.cookie = 'sis_access_token=; path=/; max-age=0';
  document.cookie = 'sis_refresh_token=; path=/; max-age=0';
}

const REQUEST_TIMEOUT_MS = 10_000;

// --- Request concurrency limiter -------------------------------------------
// The backend serves synchronous Django views on a single ASGI (daphne) thread,
// so concurrent requests are processed one-at-a-time. A page that fires 15-20
// requests at once (dashboard widgets + stats + class results + filtered
// students) makes the later ones sit in the backend's queue past the 10s client
// timeout — which is exactly the "Request timed out" flood on heavy pages.
//
// We cap how many requests are in flight at once and queue the rest. Crucially,
// a queued request's timeout clock does NOT start until it leaves the queue, so
// waiting behind other requests never counts against its own timeout.
const MAX_CONCURRENT_REQUESTS = 5;
let inFlightCount = 0;
const pendingQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (inFlightCount < MAX_CONCURRENT_REQUESTS) {
    inFlightCount++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => pendingQueue.push(resolve));
}

function releaseSlot(): void {
  const next = pendingQueue.shift();
  if (next) {
    next();            // hand the slot straight to the next waiter (count unchanged)
  } else {
    inFlightCount--;
  }
}

function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  // Wait for a free slot BEFORE arming the timeout, so time spent queued behind
  // other in-flight requests doesn't burn this request's timeout budget.
  return acquireSlot().then(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    return fetch(url, { ...init, signal: controller.signal })
      .finally(() => { clearTimeout(timer); releaseSlot(); });
  });
}

// Centralized authorized fetch with auto-refresh, 10s timeout, and 401 redirect
export async function authorizedFetch(path: string, init: RequestInit = {}, alreadyRetried = false): Promise<Response> {
  const base = getApiBaseUrl();
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${cleanBase}${cleanPath}`;

  const headers = new Headers(init.headers || {});
  const token = getAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const finalInit: RequestInit = {
    ...init,
    headers,
    credentials: 'omit',
    cache: init.cache || 'no-store',
  };

  let res: Response;
  try {
    res = await fetchWithTimeout(url, finalInit);
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new ApiError('Request timed out. Please try again.', 504, 'Timeout', undefined, 'NETWORK_ERROR');
    }
    throw new ApiError('Network error. Please check your connection.', 0, 'Network Error', undefined, 'NETWORK_ERROR');
  }

  if (res.status !== 401) return res;

  // Attempt token refresh once
  if (!alreadyRetried) {
    const refresh = getRefreshToken();
    if (refresh) {
      try {
        const refreshRes = await fetchWithTimeout(`${cleanBase}${API_ENDPOINTS.AUTH_REFRESH}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh }),
          credentials: 'omit',
        });
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          const newAccess = data?.access as string | undefined;
          if (newAccess) {
            setAuthTokens(newAccess, refresh);
            const retryHeaders = new Headers(init.headers || {});
            retryHeaders.set('Authorization', `Bearer ${newAccess}`);
            return fetchWithTimeout(url, { ...init, headers: retryHeaders, credentials: 'omit' });
          }
        }
      } catch {
        // Refresh failed — fall through to logout
      }
    }
  }

  // 401 and no valid refresh → logout and redirect
  if (typeof window !== 'undefined') {
    // If a new session was established after this request started (re-login), don't interfere.
    // This prevents stale in-flight requests from logging out a freshly re-authenticated user.
    const currentToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    if (currentToken && currentToken !== token) {
      return res;
    }
    // If already on the login page, a stale request is completing after logout — skip redirect.
    if (window.location.pathname === '/login') {
      return res;
    }
    window.localStorage.clear();
    document.cookie = 'sis_access_token=; path=/; max-age=0';
    document.cookie = 'sis_refresh_token=; path=/; max-age=0';
    window.location.href = '/login';
  }

  return res;
}

// Auth APIs
export async function loginWithEmailPassword(emailOrCode: string, password: string, recaptchaToken?: string) {
  const base = getApiBaseUrl();
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const res = await fetch(`${cleanBase}${API_ENDPOINTS.AUTH_LOGIN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: emailOrCode, password, recaptcha_token: recaptchaToken }),
    credentials: 'omit'
  });
  if (!res.ok) {
    const text = await res.text();
    handleApiError(res, text);
  }
  const data = await res.json();
  const access = data?.access as string | undefined;
  const refresh = data?.refresh as string | undefined;
  if (access) setAuthTokens(access, refresh);
  if (typeof window !== 'undefined' && data?.user) {
    window.localStorage.setItem('sis_user', JSON.stringify(data.user));
  }
  if (typeof window !== 'undefined' && data?.organization) {
    window.localStorage.setItem('sis_organization', JSON.stringify(data.organization));
  }
  return data;
}

export async function getPrincipalFormOptions() {
  try {
    const data = await apiGet('/api/principals/form_options/');
    return data;
  } catch (error) {
    console.error('Failed to fetch principal form options:', error);
    return null;
  }
}

export function logoutClientOnly() {
  if (typeof window !== 'undefined') {
    // Offline drafts (IndexedDB) localStorage.clear() se saaf nahi hote —
    // shared PC par agle user ko na milein isliye alag se clear karo.
    void clearAllDrafts();
    // Clear all localStorage completely for security
    window.localStorage.clear();

    // Also clear all cookies
    document.cookie = 'sis_access_token=; path=/; max-age=0';
    document.cookie = 'sis_refresh_token=; path=/; max-age=0';
  }
}

// Helper function to get user profile from localStorage
export function getStoredUserProfile() {
  if (typeof window === 'undefined') return null;
  try {
    const profile = window.localStorage.getItem('sis_user');
    return profile ? JSON.parse(profile) : null;
  } catch (error) {
    console.error('Error parsing user profile:', error);
    return null;
  }
}

// Helper function to get campus ID for principals
export function getUserCampusId(): number | null {
  const profile = getStoredUserProfile();
  // console.log('DEBUG: User profile from storage:', profile);
  // Handle both nested object and flat field
  let campusId = null;
  if (profile?.campus?.id) campusId = profile.campus.id;
  else if (profile?.campus_id) campusId = profile.campus_id;

  // console.log('DEBUG: Detected Campus ID:', campusId);
  return campusId;
}

// Helper function to get level ID for coordinators
export function getUserLevelId(): number | null {
  const profile = getStoredUserProfile();
  return profile?.level_id || null;
}

// Helper function to get user role
export function getUserRole(): string | null {
  const profile = getStoredUserProfile();
  return profile?.role || null;
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isRetryable = err instanceof ApiError && err.status >= 500;
      if (!isRetryable || attempt === retries) break;
      await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
    }
  }
  throw lastError;
}

//post api call for creating a new campus; and other JSON POSTs
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return withRetry(async () => {
    try {
      const res = await authorizedFetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        handleApiError(res, text);
      }
      return (await res.json()) as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(`Network error: ${error}`, 0, 'Network Error', undefined, 'NETWORK_ERROR');
    }
  });
}


// simple GET helper
export async function apiGet<T>(path: string): Promise<T> {
  return withRetry(async () => {
    try {
      const res = await authorizedFetch(path, {
        method: "GET",
        headers: { "Accept": "application/json" },
      });

      if (!res.ok) {
        const text = await res.text();
        handleApiError(res, text);
      }

      return (await res.json()) as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(`Network error: ${error}`, 0, 'Network Error', undefined, 'NETWORK_ERROR');
    }
  });
}

// optional: DELETE helper
export async function apiDelete(path: string): Promise<void> {
  try {
    const res = await authorizedFetch(path, { method: "DELETE" });
    if (!res.ok) {
      const text = await res.text();
      handleApiError(res, text);
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(`Network error: ${error}`, 0, 'Network Error');
  }
}

// PATCH helper for updating partial resources
export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  try {
    const res = await authorizedFetch(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      handleApiError(res, text);
    }
    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(`Network error: ${error}`, 0, 'Network Error');
  }
}

// PUT helper for replacing resources
export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  try {
    const res = await authorizedFetch(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      handleApiError(res, text);
    }
    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(`Network error: ${error}`, 0, 'Network Error');
  }
}

// FormData POST helper (e.g., uploading photo)
export async function apiPostFormData<T>(path: string, formData: FormData): Promise<T> {
  try {
    const res = await authorizedFetch(path, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const text = await res.text();
      handleApiError(res, text);
    }
    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(`Network error: ${error}`, 0, 'Network Error');
  }
}

// FormData PATCH helper (e.g., uploading photo via multipart)
export async function apiPatchFormData<T>(path: string, formData: FormData): Promise<T> {
  try {
    const res = await authorizedFetch(path, {
      method: 'PATCH',
      body: formData,
    });
    if (!res.ok) {
      const text = await res.text();
      handleApiError(res, text);
    }
    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(`Network error: ${error}`, 0, 'Network Error');
  }
}

// Dashboard-specific API functions
export interface DashboardStats {
  totalStudents: number;
  male: number;
  female: number;
  other: number;
  campusStats: Array<{ campus: string; count: number }>;
}

export interface CampusCountStat {
  campus: string;
  count: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const [totalRes, genderRes, campusRes] = await Promise.all([
      apiGet<{ totalStudents: number }>(API_ENDPOINTS.STUDENTS_TOTAL),
      apiGet<{ male: number; female: number; other: number }>(API_ENDPOINTS.STUDENTS_GENDER_STATS),
      apiGet<Array<{ campus: string; count: number }>>(API_ENDPOINTS.STUDENTS_CAMPUS_STATS)
    ]);

    return {
      totalStudents: totalRes.totalStudents,
      male: genderRes.male,
      female: genderRes.female,
      other: genderRes.other,
      campusStats: campusRes
    };
  } catch (error) {
    console.error('Failed to fetch dashboard stats:', error);

    // Show user-friendly error message
    if (error instanceof ApiError) {
      console.error(`API Error: ${error.status} - ${error.message}`);
    }

    // Return fallback data
    return {
      totalStudents: 0,
      male: 0,
      female: 0,
      other: 0,
      campusStats: []
    };
  }
}

export interface NewAdmissionsStats {
  period: string;
  total_new: number;
  prev_period_count: number;
  by_grade: { grade: string; count: number }[];
  by_section: { section: string; count: number }[];
  by_level: { level: string; count: number }[];
  by_gender: { male: number; female: number; unknown: number };
  trend: { date: string; count: number }[];
}

export async function getEnrollmentTrendMonthly(year: number): Promise<Array<{ month: string; month_num: number; count: number }>> {
  return apiGet(`${API_ENDPOINTS.STUDENTS_ENROLLMENT_TREND}?trend_mode=month&trend_year=${year}`)
}

export async function getNewAdmissionsStats(
  period: 'today' | 'week' | 'month' | 'year' | 'all' = 'month',
  campusId?: number
): Promise<NewAdmissionsStats> {
  let url = `${API_ENDPOINTS.STUDENTS_NEW_ADMISSIONS}?period=${period}`;
  if (campusId) url += `&campus=${campusId}`;
  return apiGet<NewAdmissionsStats>(url);
}

// Simple helpers for campus-wise counts (students & teachers)
export async function getStudentCampusStats(): Promise<CampusCountStat[]> {
  try {
    const data = await apiGet<CampusCountStat[]>(API_ENDPOINTS.STUDENTS_CAMPUS_STATS);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Failed to fetch student campus stats:', error);
    return [];
  }
}

export async function getTeacherCampusStats(): Promise<CampusCountStat[]> {
  try {
    const url = `${API_ENDPOINTS.TEACHERS}campus_stats/`;
    const data = await apiGet<CampusCountStat[]>(url);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Failed to fetch teacher campus stats:', error);
    return [];
  }
}

export async function getTeacherMyClasses(): Promise<any> {
  try {
    const url = `${API_ENDPOINTS.TEACHERS}my-classes/`;
    return await apiGet<any>(url);
  } catch (error) {
    console.error('Failed to fetch teacher my-classes:', error);
    return null;
  }
}

export async function getClassroomCampusStats(): Promise<CampusCountStat[]> {
  try {
    const url = `${API_ENDPOINTS.CLASSROOMS}campus_stats/`;
    const data = await apiGet<CampusCountStat[]>(url);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Failed to fetch classroom campus stats:', error);
    return [];
  }
}

export async function getCampusAttendanceStats(days = 30): Promise<Array<{ campus: string; percentage: number; present: number; total: number }>> {
  try {
    const data = await apiGet<any>(`/api/attendance/campus_stats/?days=${days}`);
    return Array.isArray(data) ? data : (data?.results || []);
  } catch (error) {
    console.error('Failed to fetch campus attendance stats:', error);
    return [];
  }
}

// Head-to-head figures for one campus — feeds the INTER "Campus Comparison" card.
export async function getCampusComparisonStats(campusId: string | number): Promise<{
  campus_id: number; campus_name: string; students: number; teachers: number;
  subjects: number; attendance_pct: number;
} | null> {
  try {
    return await apiGet<any>(`/api/campus/${campusId}/comparison-stats/`);
  } catch (error) {
    console.error('Failed to fetch campus comparison stats:', error);
    return null;
  }
}

// Per-day present/absent over a window, optionally scoped to one campus — feeds
// the Weekly Attendance chart on the donor dashboard.
export async function getDailyAttendanceStats(days = 7, campus?: string | number): Promise<Array<{ day: string; date: string; present: number; absent: number }>> {
  try {
    const q = new URLSearchParams({ days: String(days) });
    if (campus) q.append('campus', String(campus));
    const data = await apiGet<any>(`/api/attendance/daily_stats/?${q.toString()}`);
    return Array.isArray(data) ? data : (data?.results || []);
  } catch (error) {
    console.error('Failed to fetch daily attendance stats:', error);
    return [];
  }
}

// Fetch chart data from backend (aggregated for all students), with optional filters
export async function getDashboardChartData(params?: {
  enrollment_year?: number | number[]
  campus?: string | number | Array<string | number>
  current_grade?: string | string[]
  gender?: string | string[]
  mother_tongue?: string | string[]
  religion?: string | string[]
  shift?: string
}) {
  try {
    const buildQuery = () => {
      if (!params) return '';
      const qp = new URLSearchParams();
      const appendMulti = (key: string, value?: any) => {
        if (value === undefined || value === null) return;
        if (Array.isArray(value)) {
          value
            .filter(v => v !== undefined && v !== null && String(v).trim() !== '')
            .forEach(v => qp.append(key, String(v)));
        } else {
          qp.append(key, String(value));
        }
      };
      appendMulti('enrollment_year', params.enrollment_year);
      // BaseInFilter on backend expects comma-separated: campus=1,2 not campus=1&campus=2
      if (params.campus !== undefined && params.campus !== null) {
        const v = Array.isArray(params.campus)
          ? params.campus.filter(x => x !== undefined && x !== null && String(x).trim() !== '').join(',')
          : String(params.campus);
        if (v) qp.append('campus', v);
      }
      appendMulti('current_grade', params.current_grade);
      appendMulti('gender', params.gender);
      appendMulti('mother_tongue', params.mother_tongue);
      appendMulti('religion', params.religion);
      appendMulti('shift', params.shift);
      const qs = qp.toString();
      return qs ? `?${qs}` : '';
    };
    const qs = buildQuery();
    const [gradeDistribution, genderDistribution, enrollmentTrend, motherTongueDistribution, religionDistribution, campusStats, ageDistribution, zakatStatus, houseOwnership] = await Promise.all([
      apiGet<Array<{ grade: string; count: number }>>(`${API_ENDPOINTS.STUDENTS_GRADE_DISTRIBUTION}${qs}`),
      apiGet<{ male: number; female: number; other: number }>(`${API_ENDPOINTS.STUDENTS_GENDER_STATS}${qs}`),
      apiGet<Array<{ year: number; count: number }>>(`${API_ENDPOINTS.STUDENTS_ENROLLMENT_TREND}${qs}`),
      apiGet<Array<{ name: string; value: number }>>(`${API_ENDPOINTS.STUDENTS_MOTHER_TONGUE_DISTRIBUTION}${qs}`),
      apiGet<Array<{ name: string; value: number }>>(`${API_ENDPOINTS.STUDENTS_RELIGION_DISTRIBUTION}${qs}`),
      apiGet<Array<{ campus: string; count: number }>>(`${API_ENDPOINTS.STUDENTS_CAMPUS_STATS}${qs}`),
      apiGet<Array<{ age: number; male: number; female: number }>>(`${API_ENDPOINTS.STUDENTS_AGE_DISTRIBUTION}${qs}`),
      apiGet<Array<{ name: string; value: number }>>(`${API_ENDPOINTS.STUDENTS_ZAKAT_STATUS}${qs}`),
      apiGet<Array<{ name: string; value: number }>>(`${API_ENDPOINTS.STUDENTS_HOUSE_OWNERSHIP}${qs}`),
    ]);

    // Format gender distribution
    const genderData = [
      { name: 'Male', value: genderDistribution.male },
      { name: 'Female', value: genderDistribution.female },
      { name: 'Other', value: genderDistribution.other }
    ].filter(item => item.value > 0);

    // Format campus performance
    const campusPerformance = campusStats.map(item => ({
      name: item.campus,
      value: item.count
    }));

    // Transform grade distribution to match frontend expectations
    const transformedGradeDistribution = gradeDistribution.map(item => ({
      name: item.grade,
      value: item.count
    }));

    // Transform enrollment trend to match frontend expectations
    const transformedEnrollmentTrend = enrollmentTrend.map(item => ({
      year: item.year,
      enrollment: item.count || 0
    }));

    // Transform age distribution to match frontend expectations
    const transformedAgeDistribution = ageDistribution.map(item => ({
      age: item.age,
      male: item.male,
      female: item.female,
      total: (item.male || 0) + (item.female || 0)
    }));

    return {
      gradeDistribution: transformedGradeDistribution,
      genderDistribution: genderData,
      enrollmentTrend: transformedEnrollmentTrend,
      motherTongueDistribution,
      religionDistribution,
      campusPerformance,
      ageDistribution: transformedAgeDistribution,
      zakatStatus,
      houseOwnership
    };
  } catch (error) {
    // console.error('Failed to fetch dashboard chart data:', error);

    // Return empty data on error
    return {
      gradeDistribution: [],
      genderDistribution: [],
      enrollmentTrend: [],
      motherTongueDistribution: [],
      religionDistribution: [],
      campusPerformance: [],
      ageDistribution: [],
      zakatStatus: [],
      houseOwnership: []
    };
  }
}

// Fetch limited students for dashboard (first page only)
export async function getDashboardStudents(pageSize: number = 50) {
  try {
    const data = await apiGet(`${API_ENDPOINTS.STUDENTS}?page=1&page_size=${pageSize}`);

    if (Array.isArray(data)) {
      return data;
    } else if (data && typeof data === 'object' && 'results' in data && Array.isArray(data.results)) {
      return data.results;
    }

    return [];
  } catch (error) {
    console.error('Error fetching dashboard students:', error);
    return [];
  }
}

export async function getStudentFormOptions() {
  try {
    const data = await apiGet(API_ENDPOINTS.STUDENTS_FORM_OPTIONS);
    return data;
  } catch (error) {
    console.error('Failed to fetch student form options:', error);
    return null;
  }
}

export async function checkStudentDuplicate(cnic?: string, email?: string) {
  try {
    return await apiPost<{ cnic_exists: boolean; email_exists: boolean }>(
      API_ENDPOINTS.CHECK_STUDENT_DUPLICATE,
      { student_cnic: cnic, email: email }
    );
  } catch (error) {
    console.error('Failed to check student duplicate:', error);
    return { cnic_exists: false, email_exists: false };
  }
}

export async function getCoordinatorFormOptions() {
  try {
    const data = await apiGet(API_ENDPOINTS.COORDINATORS_FORM_OPTIONS);
    return data;
  } catch (error) {
    console.error('Failed to fetch coordinator form options:', error);
    return null;
  }
}

export async function getAllStudents(forceRefresh: boolean = false, shift?: string) {
  try {
    // Try to get from cache first (unless force refresh or shift filter)
    if (!forceRefresh && !shift) {
      const cached = CacheManager.get(CacheManager.KEYS.STUDENTS);
      if (cached) {
        return cached;
      }
    }

    // Fetch all students with pagination
    let allStudents: unknown[] = [];
    let page = 1;
    let hasNext = true;

    while (hasNext) {
      let url = `${API_ENDPOINTS.STUDENTS}?page=${page}&page_size=1000`;
      if (shift) {
        url += `&shift=${encodeURIComponent(shift)}`;
      }
      const data = await apiGet(url);

      if (Array.isArray(data)) {
        allStudents = [...allStudents, ...data];
        hasNext = false; // If no pagination, stop
      } else if (data && typeof data === 'object' && 'results' in data && Array.isArray(data.results)) {
        allStudents = [...allStudents, ...data.results];
        hasNext = (data as { next?: string | null }).next !== null; // Check if there's a next page
        page++;
      } else {
        hasNext = false;
      }
    }

    // Disable caching of huge arrays to prevent quota issues
    // CacheManager.set(CacheManager.KEYS.STUDENTS, allStudents, 10 * 60 * 1000);

    return allStudents;
  } catch (error) {
    console.error('Failed to fetch students:', error);
    return [];
  }
}

export async function getTeacherStudents(classroomId?: number) {
  try {
    // Don't use cache for teacher-specific students
    // Backend will filter students based on teacher's assigned classroom
    let url = `${API_ENDPOINTS.STUDENTS}?page=1&page_size=1000`;
    if (classroomId) {
      url += `&classroom=${classroomId}`;
    }
    const data = await apiGet(url);

    if (Array.isArray(data)) {
      return data;
    } else if (data && typeof data === 'object' && 'results' in data && Array.isArray(data.results)) {
      return data.results;
    }

    return [];
  } catch (error) {
    console.error('Failed to fetch teacher students:', error);
    return [];
  }
}

export async function getFilteredStudents(params: {
  page?: number;
  page_size?: number;
  search?: string;
  campus?: number;
  current_grade?: string;
  section?: string;
  current_state?: string;
  cohort_year?: string;
  cohort_date?: string;
  cohort_start?: string;
  cohort_end?: string;
  cohort_outcome?: string;
  gender?: string;
  shift?: string;
  classroom?: number | string;
  level?: number | string;
  is_new_admission?: string;
  ordering?: string;
  start_date?: string;
  end_date?: string;
}): Promise<{
  count: number;
  next: string | null;
  previous: string | null;
  results: unknown[];
}> {
  try {
    const queryParams = new URLSearchParams();

    // Add pagination params
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.page_size) queryParams.append('page_size', params.page_size.toString());

    // Add search param
    if (params.search) queryParams.append('search', params.search);

    // Add filter params
    if (params.campus) queryParams.append('campus', params.campus.toString());
    if (params.current_grade) queryParams.append('current_grade', params.current_grade);
    if (params.section) queryParams.append('section', params.section);
    if (params.current_state) queryParams.append('current_state', params.current_state);
    if (params.cohort_year) queryParams.append('cohort_year', params.cohort_year);
    if (params.cohort_date) queryParams.append('cohort_date', params.cohort_date);
    if (params.cohort_start) queryParams.append('cohort_start', params.cohort_start);
    if (params.cohort_end) queryParams.append('cohort_end', params.cohort_end);
    if (params.cohort_outcome) queryParams.append('cohort_outcome', params.cohort_outcome);
    if (params.gender) queryParams.append('gender', params.gender);
    if (params.shift) queryParams.append('shift', params.shift);
    if (params.classroom) queryParams.append('classroom', params.classroom.toString());
    if (params.level) queryParams.append('level', params.level.toString());
    if (params.is_new_admission) queryParams.append('is_new_admission', params.is_new_admission);

    // Add ordering param
    if (params.ordering) queryParams.append('ordering', params.ordering);

    // Add date range params
    if (params.start_date) queryParams.append('start_date', params.start_date);
    if (params.end_date) queryParams.append('end_date', params.end_date);

    const response = await apiGet(`${API_ENDPOINTS.STUDENTS}?${queryParams.toString()}`);
    return response as {
      count: number;
      next: string | null;
      previous: string | null;
      results: unknown[];
    };
  } catch (error: unknown) {
    const apiErr = error as { status?: number; response?: { status?: number }; message?: string };
    const status = apiErr?.status || apiErr?.response?.status;
    const msg = (apiErr?.message || '').toString().toLowerCase();
    if (!(status === 404 || msg.includes('invalid page'))) {
      console.error('Failed to fetch filtered students:', error);
    }
    return { results: [], count: 0, next: null, previous: null };
  }
}

export async function bulkAssignClassroom(studentIds: number[], classroomId: number | null) {
  try {
    return await apiPost(`${API_ENDPOINTS.STUDENTS}bulk_assign_classroom/`, {
      student_ids: studentIds,
      classroom_id: classroomId
    });
  } catch (error) {
    console.error('Failed to bulk assign classroom:', error);
    throw error;
  }
}

export async function bulkMarkAsAlumni(studentIds: number[]) {
  try {
    return await apiPost(`${API_ENDPOINTS.STUDENTS}bulk_mark_alumni/`, {
      student_ids: studentIds,
    });
  } catch (error) {
    console.error('Failed to mark students as alumni:', error);
    throw error;
  }
}

export async function getAnnouncements(): Promise<any[]> {
  try {
    const data = await apiGet<any>('/api/announcements/');
    return Array.isArray(data) ? data : (data?.results || []);
  } catch (error) {
    console.error('Failed to fetch announcements:', error);
    return [];
  }
}

export async function createAnnouncement(payload: {
  title: string;
  body?: string;
  priority?: string;
  audience?: string;
  campus?: number | null;
  expires_at?: string | null;
}) {
  return await apiPost('/api/announcements/', payload);
}

export async function getAllCampuses() {
  try {
    // Try to get from cache first
    const cached = CacheManager.get(CacheManager.KEYS.CAMPUSES);
    if (cached) {
      return cached;
    }

    const data = await apiGet(API_ENDPOINTS.CAMPUS);

    // Handle different response formats
    let campuses = [];
    if (Array.isArray(data)) {
      campuses = data;
    } else if (data && typeof data === 'object' && 'results' in data && Array.isArray(data.results)) {
      campuses = data.results;
    } else if (data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
      campuses = data.data;
    } else {
      campuses = [];
    }

    // Only cache if we got valid data
    if (campuses.length > 0) {
      CacheManager.set(CacheManager.KEYS.CAMPUSES, campuses, 30 * 60 * 1000);
    }

    return campuses;
  } catch (error) {
    console.error('Failed to fetch campuses:', error);
    // Return empty array instead of throwing error
    return [];
  }
}

export async function getAllTeachers(shift?: string) {
  try {
    // Try to get from cache first (only if no shift filter)
    if (!shift) {
      const cached = CacheManager.get(CacheManager.KEYS.TEACHERS);
      if (cached) {
        return cached;
      }
    }

    // Fetch all teachers with pagination
    let allTeachers: unknown[] = [];
    let page = 1;
    let hasNext = true;

    while (hasNext) {
      let url = `${API_ENDPOINTS.TEACHERS}?page=${page}&page_size=1000`;
      if (shift) {
        url += `&shift=${encodeURIComponent(shift)}`;
      }
      const data = await apiGet(url);

      if (Array.isArray(data)) {
        allTeachers = [...allTeachers, ...data];
        hasNext = false; // If no pagination, stop
      } else if (data && typeof data === 'object' && 'results' in data && Array.isArray(data.results)) {
        allTeachers = [...allTeachers, ...data.results];
        hasNext = (data as { next?: string | null }).next !== null; // Check if there's a next page
        page++;
      } else {
        hasNext = false;
      }
    }

    // Disable caching of huge arrays to prevent quota issues
    // CacheManager.set(CacheManager.KEYS.TEACHERS, allTeachers, 10 * 60 * 1000);

    return allTeachers;
  } catch (error) {
    console.error('Failed to fetch teachers:', error);
    return [];
  }
}

export async function getFilteredTeachers(params: {
  page?: number;
  page_size?: number;
  search?: string;
  current_campus?: number;
  shift?: string;
  is_currently_active?: boolean;
  assigned_coordinator?: number;
  is_class_teacher?: boolean;
  is_subject_teacher?: boolean;
  is_teacher_assistant?: boolean;
  current_subjects?: string;
  grade?: string | number;
  gender?: string;
  current_role_title?: string;
  ordering?: string;
}): Promise<{
  count: number;
  next: string | null;
  previous: string | null;
  results: any[];
}> {
  try {
    const queryParams = new URLSearchParams();

    // Add pagination params
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.page_size) queryParams.append('page_size', params.page_size.toString());

    // Add search param
    if (params.search) queryParams.append('search', params.search);

    // Add filter params
    if (params.current_campus) queryParams.append('current_campus', params.current_campus.toString());
    if (params.shift) queryParams.append('shift', params.shift);
    if (params.is_currently_active !== undefined) queryParams.append('is_currently_active', params.is_currently_active.toString());
    if (params.assigned_coordinator) queryParams.append('assigned_coordinator', params.assigned_coordinator.toString());
    if (params.is_class_teacher !== undefined) queryParams.append('is_class_teacher', params.is_class_teacher.toString());
    if (params.is_subject_teacher !== undefined) queryParams.append('is_subject_teacher', params.is_subject_teacher.toString());
    if (params.is_teacher_assistant !== undefined) queryParams.append('is_teacher_assistant', params.is_teacher_assistant.toString());
    if (params.current_subjects) queryParams.append('current_subjects', params.current_subjects);
    if (params.grade) queryParams.append('grade', params.grade.toString());
    if (params.gender) queryParams.append('gender', params.gender);
    if (params.current_role_title) queryParams.append('current_role_title', params.current_role_title);

    // Add ordering param
    if (params.ordering) queryParams.append('ordering', params.ordering);

    const response = await apiGet(`${API_ENDPOINTS.TEACHERS}?${queryParams.toString()}`);
    return response as {
      count: number;
      next: string | null;
      previous: string | null;
      results: any[];
    };

  } catch (error) {
    console.error('Failed to fetch filtered teachers:', error);
    return { results: [], count: 0, next: null, previous: null };
  }
}

export async function getTeacherById(teacherId: string | number) {
  try {
    // Try to get from cache first
    const cached = CacheManager.get(CacheManager.KEYS.TEACHER_PROFILE(Number(teacherId)));
    if (cached) {
      return cached;
    }

    const teacher = await apiGet(`${API_ENDPOINTS.TEACHERS}${teacherId}/`);

    // Cache the teacher profile for 15 minutes
    CacheManager.set(CacheManager.KEYS.TEACHER_PROFILE(Number(teacherId)), teacher, 15 * 60 * 1000);

    return teacher;
  } catch (error) {
    console.error('Failed to fetch teacher by ID:', error);
    return null;
  }
}


export async function getStudentById(studentId: string | number) {
  try {
    // Try to get from cache first
    const cached = CacheManager.get(CacheManager.KEYS.STUDENT_PROFILE(Number(studentId)));
    if (cached) {
      return cached;
    }

    const url = `${API_ENDPOINTS.STUDENTS}${studentId}/`;
    const student = await apiGet(url);

    // Cache the student profile for 15 minutes
    CacheManager.set(CacheManager.KEYS.STUDENT_PROFILE(Number(studentId)), student, 15 * 60 * 1000);

    return student;
  } catch (error) {
    console.error('Failed to fetch student by ID:', error);
    return null;
  }
}

export async function deleteStudent(studentId: number) {
  try {
    const url = `${API_ENDPOINTS.STUDENTS}${studentId}/`;
    const res = await apiDelete(url);
    invalidateStudentCache(studentId);
    return res;
  } catch (error) {
    console.error('Failed to delete student:', error);
    throw error;
  }
}


// Cache invalidation functions
export function invalidateStudentCache(studentId?: number) {
  if (studentId) {
    CacheManager.remove(CacheManager.KEYS.STUDENT_PROFILE(studentId));
  }
  CacheManager.remove(CacheManager.KEYS.STUDENTS);
}

export function invalidateTeacherCache(teacherId?: number) {
  if (teacherId) {
    CacheManager.remove(CacheManager.KEYS.TEACHER_PROFILE(teacherId));
  }
  CacheManager.remove(CacheManager.KEYS.TEACHERS);
}

export function invalidateCampusCache() {
  CacheManager.remove(CacheManager.KEYS.CAMPUSES);
}

export function clearAllCache() {
  CacheManager.clear();
}
export async function getUsers(role?: string) {
  try {
    const path = role ? `${API_ENDPOINTS.USERS}?role=${encodeURIComponent(role)}` : API_ENDPOINTS.USERS;
    return await apiGet(path);
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return [];
  }
}

// Coordinator API
export async function getCoordinatorTeachers(coordinatorId: number) {
  try {
    return await apiGet(`${API_ENDPOINTS.COORDINATORS}${coordinatorId}/teachers/`);
  } catch (error) {
    console.error('Failed to fetch coordinator teachers:', error);
    return { teachers: [], total_teachers: 0 };
  }
}

export async function getCoordinatorGeneralStats(coordinatorId: number) {
  try {
    return await apiGet(`${API_ENDPOINTS.COORDINATORS}${coordinatorId}/dashboard_stats/`);
  } catch (error) {
    console.error('Failed to fetch coordinator dashboard stats:', error);
    return { stats: { total_teachers: 0, total_students: 0, total_classes: 0, pending_requests: 0 } };
  }
}

// Get classrooms for a coordinator by ID (for principal view)
export async function getCoordinatorClassrooms(coordinatorId: number) {
  try {
    const baseUrl = getApiBaseUrl();
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const url = `${cleanBaseUrl}/api/coordinators/${coordinatorId}/classrooms/`;
    console.log('Fetching classrooms from:', url);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('sis_access_token')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`Classrooms endpoint not found (404) for coordinator ${coordinatorId}. Make sure backend server is running and endpoint is registered.`);
      } else {
        console.error(`Failed to fetch classrooms: ${response.status} ${response.statusText}`);
      }
      // Return empty array if endpoint doesn't exist or error occurs
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : (data.classrooms || []);
  } catch (error) {
    console.error('Failed to fetch coordinator classrooms:', error);
    return [];
  }
}

// Classes API functions

export async function findCoordinatorByEmployeeCode(employeeCode: string) {
  try {
    const response = await apiGet(API_ENDPOINTS.COORDINATORS);

    // Handle different response formats
    let coordinators = []
    if (Array.isArray(response)) {
      coordinators = response
    } else if (response && (response as any).results) {
      coordinators = (response as any).results
    } else if (response && Array.isArray((response as any).data)) {
      coordinators = (response as any).data
    }

    const foundCoordinator = coordinators.find((coord: any) => coord.employee_code === employeeCode);
    return foundCoordinator || null;
  } catch (error) {
    console.error('Failed to find coordinator by employee code:', error);
    return null;
  }
}

export async function findCoordinatorByEmail(email: string) {
  try {
    const coordinators = await apiGet(API_ENDPOINTS.COORDINATORS);
    if (Array.isArray(coordinators)) {
      return coordinators.find((coord: any) => coord.email === email);
    }
    return null;
  } catch (error) {
    console.error('Failed to find coordinator by email:', error);
    return null;
  }
}

export async function getCampusStudents(campusId: number) {
  try {
    return await apiGet(`${API_ENDPOINTS.STUDENTS}?campus=${campusId}`);
  } catch (error) {
    console.error('Failed to fetch campus students:', error);
    return [];
  }
}

export async function getClassroomStudents(classroomId: number, teacherId?: number) {
  try {
    const url = API_ENDPOINTS.CLASSROOM_STUDENTS.replace('{id}', classroomId.toString());
    const params = teacherId ? `?teacher_id=${teacherId}` : '';
    return await apiGet(url + params);
  } catch (error) {
    console.error('Failed to fetch classroom students:', error);
    return { students: [], total_students: 0 };
  }
}

export async function getAvailableStudentsForClassroom(classroomId: number) {
  try {
    const url = API_ENDPOINTS.AVAILABLE_STUDENTS.replace('{id}', classroomId.toString());
    return await apiGet(url);
  } catch (error) {
    console.error('Failed to fetch available students for classroom:', error);
    return { available_students: [], total_available: 0 };
  }
}

export async function getCurrentUserProfile() {
  try {
    return await apiGet(API_ENDPOINTS.CURRENT_USER_PROFILE);
  } catch (error) {
    console.error('Failed to fetch current user profile:', error);
    return null;
  }
}

/**
 * Fetch fresh user profile from backend and sync with localStorage
 */
export async function refreshUserProfile() {
  try {
    const freshUser = await getCurrentUserProfile();
    if (freshUser && typeof window !== 'undefined') {
      window.localStorage.setItem('sis_user', JSON.stringify(freshUser));
      return freshUser;
    }
    return null;
  } catch (error) {
    console.error('refreshUserProfile failed:', error);
    return null;
  }
}

export async function checkEmailExists(email: string): Promise<boolean> {
  try {
    const base = getApiBaseUrl()
    const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base
    const url = `${cleanBase}${API_ENDPOINTS.CHECK_EMAIL}?email=${encodeURIComponent(email)}`
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('sis_access_token') || ''}`
      }
    })
    if (!res.ok) return false
    const data = await res.json()
    return Boolean(data?.exists)
  } catch {
    return false
  }
}

export async function checkCNICExists(cnic: string): Promise<boolean> {
  try {
    const base = getApiBaseUrl()
    const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base
    const url = `${cleanBase}/api/coordinators/check-cnic/?cnic=${encodeURIComponent(cnic)}`
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('sis_access_token') || ''}`
      }
    })
    if (!res.ok) return false
    const data = await res.json()
    return Boolean(data?.exists)
  } catch {
    return false
  }
}

// Behaviour API helpers
export async function createBehaviourRecord(data: {
  student: number;
  week_start: string;
  week_end: string;
  metrics: Record<string, number>;
  notes?: string;
  events?: Array<{ date: string; name: string; progress: string; award?: string }>;
}) {
  return await apiPost(API_ENDPOINTS.BEHAVIOUR_CREATE, data);
}

// Org-admin Global Network performance dashboard (pass rates, grade distribution,
// subject heatmap, and per-branch drill-down). Only approved results are counted.
export async function getOrgPerformanceDashboard(params?: {
  academic_year?: string;
  exam_type?: string;
  month?: string;
  campus?: number | string;
}) {
  const q = new URLSearchParams();
  if (params?.academic_year) q.append('academic_year', params.academic_year);
  if (params?.exam_type) q.append('exam_type', params.exam_type);
  if (params?.month) q.append('month', params.month);
  if (params?.campus) q.append('campus', String(params.campus));
  const url = `/api/result/org-performance-dashboard/${q.toString() ? '?' + q.toString() : ''}`;
  return await apiGet(url);
}

// Principal performance dashboard: own-campus internals (INTRA) + network ranking
// (INTER). Approved results only. Scoped to the logged-in principal's campus.
export async function getPrincipalPerformanceDashboard(params?: {
  academic_year?: string;
  exam_type?: string;
  month?: string;
  level?: string;
  classroom?: number | string;
}) {
  const q = new URLSearchParams();
  if (params?.academic_year) q.append('academic_year', params.academic_year);
  if (params?.exam_type) q.append('exam_type', params.exam_type);
  if (params?.month) q.append('month', params.month);
  if (params?.level) q.append('level', params.level);
  if (params?.classroom) q.append('classroom', String(params.classroom));
  const url = `/api/result/principal-performance-dashboard/${q.toString() ? '?' + q.toString() : ''}`;
  return await apiGet(url);
}

// Coordinator performance dashboard: own wing/level internals (INTRA) + wing vs
// campus baseline (COMPARE). Approved results only. Scoped to the coordinator's
// campus + assigned level(s).
export async function getCoordinatorPerformanceDashboard(params?: {
  academic_year?: string;
  exam_type?: string;
  month?: string;
  level?: number | string;
  classroom?: number | string;
}) {
  const q = new URLSearchParams();
  if (params?.academic_year) q.append('academic_year', params.academic_year);
  if (params?.exam_type) q.append('exam_type', params.exam_type);
  if (params?.month) q.append('month', params.month);
  if (params?.level) q.append('level', String(params.level));
  if (params?.classroom) q.append('classroom', String(params.classroom));
  const url = `/api/result/coordinator-performance-dashboard/${q.toString() ? '?' + q.toString() : ''}`;
  return await apiGet(url);
}

// Class-teacher performance dashboard: own classroom internals (roster, student×
// subject heatmap) + class vs campus baseline. Approved results only.
export async function getClassTeacherPerformanceDashboard(params?: {
  academic_year?: string;
  exam_type?: string;
  month?: string;
  classroom?: number | string;
}) {
  const q = new URLSearchParams();
  if (params?.academic_year) q.append('academic_year', params.academic_year);
  if (params?.exam_type) q.append('exam_type', params.exam_type);
  if (params?.month) q.append('month', params.month);
  if (params?.classroom) q.append('classroom', String(params.classroom));
  const url = `/api/result/class-teacher-performance-dashboard/${q.toString() ? '?' + q.toString() : ''}`;
  return await apiGet(url);
}

// Donor Impact & Performance Dashboard: INTER (sponsored network) + INTRA
// (single campus, when `campus` is passed). Approved results only, org-scoped.
export async function getDonorPerformanceDashboard(params?: {
  academic_year?: string;
  exam_type?: string;
  month?: string;
  campus?: number | string;
}) {
  const q = new URLSearchParams();
  if (params?.academic_year) q.append('academic_year', params.academic_year);
  if (params?.exam_type) q.append('exam_type', params.exam_type);
  if (params?.month) q.append('month', params.month);
  if (params?.campus) q.append('campus', String(params.campus));
  const url = `/api/result/donor-performance-dashboard/${q.toString() ? '?' + q.toString() : ''}`;
  return await apiGet(url);
}

// Change a student's enrollment status (records an EnrollmentEvent server-side).
// Maps to POST /api/students/<id>/change-status/ — created_by is set from the
// authenticated user on the backend, not passed here.
export async function changeStudentEnrollmentStatus(
  studentId: number | string,
  payload: { status: string; event_date: string; reason?: string; reason_code?: string }
) {
  // Coordinator/principal/admin → applies immediately (returns the student).
  // Teacher → creates a pending request (returns { message, request }).
  return await apiPost(`${API_ENDPOINTS.STUDENTS}${studentId}/change-status/`, payload);
}

// ── Enrollment-status coordinator-approval workflow ──
// Teacher: their own submitted status-change requests (any status).
export async function getMyEnrollmentRequests() {
  return await apiGet(`${API_ENDPOINTS.STUDENTS}enrollment-requests/mine/`);
}

// Enrollment KPIs (Retention Rate). No campus_id → whole org (Org Admin);
// campus_id or a principal's own campus → that campus.
export async function getEnrollmentKPIs(params?: { academic_year?: string; campus_id?: number | string }) {
  const q = new URLSearchParams();
  if (params?.academic_year) q.append('academic_year', params.academic_year);
  if (params?.campus_id) q.append('campus_id', String(params.campus_id));
  return await apiGet(`${API_ENDPOINTS.STUDENTS}enrollment-kpis/${q.toString() ? '?' + q.toString() : ''}`);
}

// Regional Score Variance: school subject averages vs external regional
// benchmarks. Endpoint scopes by role (no campus = org; principal → own campus).
export async function getRegionalVariance(params?: {
  academic_year?: string;
  exam_type?: string;
  campus_id?: number | string;
  grade?: string;
}) {
  const q = new URLSearchParams();
  if (params?.academic_year) q.append('academic_year', params.academic_year);
  if (params?.exam_type) q.append('exam_type', params.exam_type);
  if (params?.campus_id) q.append('campus_id', String(params.campus_id));
  if (params?.grade) q.append('grade', params.grade);
  return await apiGet(`/api/result/regional-variance/${q.toString() ? '?' + q.toString() : ''}`);
}

// Coordinator: pending requests in their campus/levels (?all=1 → include decided).
export async function getPendingEnrollmentRequests(all = false) {
  const q = all ? '?all=1' : '';
  return await apiGet(`${API_ENDPOINTS.STUDENTS}enrollment-requests/pending/${q}`);
}

export async function approveEnrollmentRequest(requestId: number | string, response?: string) {
  return await apiPost(`${API_ENDPOINTS.STUDENTS}enrollment-requests/${requestId}/approve/`, { response: response || '' });
}

export async function rejectEnrollmentRequest(requestId: number | string, response: string) {
  return await apiPost(`${API_ENDPOINTS.STUDENTS}enrollment-requests/${requestId}/reject/`, { response });
}

export async function getStudentBehaviourRecords(studentId: number | string, opts?: { start_date?: string; end_date?: string }) {
  const params = new URLSearchParams();
  if (opts?.start_date) params.append('start_date', opts.start_date);
  if (opts?.end_date) params.append('end_date', opts.end_date);
  const base = typeof API_ENDPOINTS.BEHAVIOUR_STUDENT === 'function' ? API_ENDPOINTS.BEHAVIOUR_STUDENT(studentId) : `/api/behaviour/student/${studentId}/`;
  const url = params.toString() ? `${base}?${params.toString()}` : base;
  return await apiGet(url);
}

export async function getStudentMonthlyBehaviourLatest(studentId: number | string) {
  const base = typeof API_ENDPOINTS.BEHAVIOUR_MONTHLY_STUDENT === 'function' ? API_ENDPOINTS.BEHAVIOUR_MONTHLY_STUDENT(studentId) : `/api/behaviour/monthly/student/${studentId}/`;
  return await apiGet(base);
}

export async function getStudentMonthlyBehaviour(studentId: number | string, monthYYYYMM: string) {
  const base = typeof API_ENDPOINTS.BEHAVIOUR_MONTHLY_STUDENT === 'function' ? API_ENDPOINTS.BEHAVIOUR_MONTHLY_STUDENT(studentId) : `/api/behaviour/monthly/student/${studentId}/`;
  const url = `${base}?month=${encodeURIComponent(monthYYYYMM)}`;
  return await apiGet(url);
}

export async function computeMonthlyBehaviour(payload: { student: number; month: string }) {
  return await apiPost(API_ENDPOINTS.BEHAVIOUR_MONTHLY_COMPUTE, payload);
}

export async function getAllCoordinators(shift?: string) {
  try {
    let url = API_ENDPOINTS.COORDINATORS;
    if (shift) {
      url += `?shift=${encodeURIComponent(shift)}`;
    }
    return await apiGet(url);
  } catch (error) {
    console.error('Failed to fetch coordinators:', error);
    return [];
  }
}

// List functions for displaying data

// Level Management APIs
export async function getLevels(campusId?: number) {
  try {
    const url = campusId ? `${API_ENDPOINTS.LEVELS}?campus_id=${campusId}` : API_ENDPOINTS.LEVELS;
    return await apiGet(url);
  } catch (error) {
    console.error('Failed to fetch levels:', error);
    return [];
  }
}

export async function getCampusClassesByShiftAndLevel(campusId: number, shift: string, levelId: number) {
  try {
    const url = `${API_ENDPOINTS.CLASSROOMS}?campus_id=${campusId}&shift=${shift}&grade__level=${levelId}`;
    return await apiGet(url);
  } catch (error) {
    console.error('Failed to fetch campus classes by shift and level:', error);
    return [];
  }
}

// -----------------------------------------------------
// Role Permissions API
// -----------------------------------------------------

export interface RolePermission {
  id: number;
  role: string;
  role_label: string;
  permission_codename: string;
  permission_label: string;
  is_allowed: boolean;
  updated_at: string;
}

export async function fetchRolePermissions(role?: string): Promise<RolePermission[]> {
  try {
    const url = role ? `${API_ENDPOINTS.ROLE_PERMISSIONS}?role=${role}` : API_ENDPOINTS.ROLE_PERMISSIONS;
    const data = await apiGet<RolePermission[]>(url);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Failed to fetch role permissions:', error);
    return [];
  }
}

export async function toggleRolePermission(role: string, permission_codename: string, is_allowed: boolean): Promise<RolePermission | null> {
  try {
    const data = await apiPatch<RolePermission>(API_ENDPOINTS.TOGGLE_PERMISSION, {
      role,
      permission_codename,
      is_allowed
    });
    return data;
  } catch (error) {
    console.error(`Failed to toggle permission ${permission_codename} for ${role}:`, error);
    throw error;
  }
}

export async function fetchMyPermissions(): Promise<{ role: string, permissions: Record<string, boolean> }> {
  try {
    const data = await apiGet<{ role: string, permissions: Record<string, boolean> }>(API_ENDPOINTS.MY_PERMISSIONS);
    return data;
  } catch (error) {
    console.error('Failed to fetch my permissions:', error);
    // Return empty defaults
    return { role: '', permissions: {} };
  }
}

export async function createLevel(data: unknown) {
  try {
    return await apiPost(API_ENDPOINTS.LEVELS, data);
  } catch (error) {
    console.error('Failed to create level:', error);
    throw error;
  }
}

export async function updateLevel(id: number, data: unknown) {
  try {
    return await apiPut(`${API_ENDPOINTS.LEVELS}${id}/`, data);
  } catch (error) {
    console.error('Failed to update level:', error);
    throw error;
  }
}

export async function deleteLevel(id: number) {
  try {
    return await apiDelete(`${API_ENDPOINTS.LEVELS}${id}/`);
  } catch (error) {
    console.error('Failed to delete level:', error);
    throw error;
  }
}

// Grade Management APIs
export async function getGrades(levelId?: number, campusId?: number, shift?: string) {
  try {
    let url = API_ENDPOINTS.GRADES;
    const params = new URLSearchParams();
    if (levelId) params.append('level_id', levelId.toString());
    if (campusId) params.append('campus_id', campusId.toString());
    if (shift) params.append('shift', shift);
    
    // Request a large page size to avoid pagination issues in dropdowns
    params.append('page_size', '1000');
    
    if (params.toString()) url += `?${params.toString()}`;
    return await apiGet(url);
  } catch (error) {
    console.error('Failed to fetch grades:', error);
    return [];
  }
}

export async function createGrade(data: any) {
  try {
    return await apiPost(API_ENDPOINTS.GRADES, data);
  } catch (error) {
    console.error('Failed to create grade:', error);
    throw error;
  }
}

export async function updateGrade(id: number, data: any) {
  try {
    return await apiPut(`${API_ENDPOINTS.GRADES}${id}/`, data);
  } catch (error) {
    console.error('Failed to update grade:', error);
    throw error;
  }
}

export async function deleteGrade(id: number) {
  try {
    return await apiDelete(`${API_ENDPOINTS.GRADES}${id}/`);
  } catch (error) {
    console.error('Failed to delete grade:', error);
    throw error;
  }
}

// Classroom Management APIs
export async function getClassrooms(gradeId?: number, levelId?: number, campusId?: number, shift?: string) {
  try {
    let url = API_ENDPOINTS.CLASSROOMS;
    const params = new URLSearchParams();
    if (gradeId) params.append('grade_id', gradeId.toString());
    if (levelId) params.append('level_id', levelId.toString());
    if (campusId) params.append('campus_id', campusId.toString());
    if (shift) params.append('shift', shift);
    if (params.toString()) url += `?${params.toString()}`;
    return await apiGet(url);
  } catch (error) {
    console.error('Failed to fetch classrooms:', error);
    return [];
  }
}

export async function createClassroom(data: any) {
  try {
    return await apiPost(API_ENDPOINTS.CLASSROOMS, data);
  } catch (error) {
    console.error('Failed to create classroom:', error);
    throw error;
  }
}

export async function updateClassroom(id: number, data: any) {
  try {
    return await apiPut(`${API_ENDPOINTS.CLASSROOMS}${id}/`, data);
  } catch (error) {
    console.error('Failed to update classroom:', error);
    throw error;
  }
}

export async function deleteClassroom(id: number) {
  try {
    return await apiDelete(`${API_ENDPOINTS.CLASSROOMS}${id}/`);
  } catch (error) {
    console.error('Failed to delete classroom:', error);
    throw error;
  }
}

// Teacher Assignment APIs
export async function assignTeacherToClassroom(classroomId: number, teacherId: number) {
  try {
    return await apiPost(`${API_ENDPOINTS.CLASSROOMS}${classroomId}/assign_teacher/`, {
      teacher_id: teacherId
    });
  } catch (error) {
    console.error('Failed to assign teacher to classroom:', error);
    throw error;
  }
}

export async function unassignTeacherFromClassroom(classroomId: number) {
  try {
    return await apiPost(`${API_ENDPOINTS.CLASSROOMS}${classroomId}/unassign_teacher/`, {});
  } catch (error) {
    console.error('Failed to unassign teacher from classroom:', error);
    throw error;
  }
}

export async function getAvailableTeachers(campusId?: number, shift?: string) {
  try {
    let url = `${API_ENDPOINTS.CLASSROOMS}available_teachers/`;
    const params = new URLSearchParams();
    if (campusId) params.append('campus_id', String(campusId));
    if (shift) params.append('shift', shift);
    if (Array.from(params).length > 0) url += `?${params.toString()}`;
    return await apiGet(url);
  } catch (error) {
    console.error('Failed to fetch available teachers:', error);
    return [];
  }
}

// Coordinator Assignment APIs
export async function assignCoordinatorToLevel(levelId: number, coordinatorId: number) {
  try {
    return await apiPost(`${API_ENDPOINTS.LEVELS}${levelId}/assign_coordinator/`, {
      coordinator_id: coordinatorId
    });
  } catch (error) {
    console.error('Failed to assign coordinator to level:', error);
    throw error;
  }
}

export async function unassignCoordinatorFromLevel(levelId: number) {
  try {
    return await apiPost(`${API_ENDPOINTS.LEVELS}${levelId}/unassign_coordinator/`, {});
  } catch (error) {
    console.error('Failed to unassign coordinator from level:', error);
    throw error;
  }
}

export async function getAvailableCoordinators(campusId?: number) {
  try {
    const url = campusId
      ? `/api/coordinators/?campus_id=${campusId}`
      : '/api/coordinators/';
    const response = await apiGet(url);

    // Handle paginated response - return results array or empty array
    if (response && typeof response === 'object' && 'results' in response) {
      return response.results || [];
    } else if (Array.isArray(response)) {
      return response;
    } else {
      return [];
    }
  } catch (error) {
    console.error('Failed to fetch available coordinators:', error);
    return [];
  }
}



export async function getCampusDashboardStats(campusId: number) {
  try {
    const [students, teachers, campus] = await Promise.all([
      getCampusStudents(campusId),
      getCampusTeachers(campusId),
      getPrincipalCampusData(campusId)
    ]);

    return {
      campus,
      totalStudents: Array.isArray(students) ? students.length : 0,
      totalTeachers: Array.isArray(teachers) ? teachers.length : 0,
      students: Array.isArray(students) ? students : [],
      teachers: Array.isArray(teachers) ? teachers : []
    };
  } catch (error) {
    console.error('Failed to fetch campus dashboard stats:', error);
    return {
      campus: null,
      totalStudents: 0,
      totalTeachers: 0,
      students: [],
      teachers: []
    };
  }
}



function getCampusTeachers(_campusId: number): any {
  throw new Error("Function not implemented.");
}

function getPrincipalCampusData(_campusId: number): any {
  throw new Error("Function not implemented.");
}

// Attendance API functions
export async function getTeacherClasses() {
  try {
    return await apiGet('/api/attendance/staff/classes/');
  } catch (error) {
    // Swallow 404 (e.g., teacher profile not found for attendance yet)
    if (error instanceof ApiError && (error.status === 404 || /not found/i.test(error.message))) {
      return [] as any[];
    }
    console.error('Failed to fetch teacher classes:', error);
    return [] as any[];
  }
}

export async function getClassStudents(classroomId: number) {
  try {
    return await apiGet(`/api/attendance/class/${classroomId}/students/`);
  } catch (error) {
    console.error('Failed to fetch class students:', error);
    return [];
  }
}

export async function getAlumniStudents(campusId?: number) {
  try {
    const timestamp = new Date().getTime();
    let url = `${API_ENDPOINTS.STUDENTS}?current_grade=Alumni&is_draft=false&is_deleted=false&page_size=1000&_t=${timestamp}`;
    if (campusId) {
      url += `&campus=${campusId}`;
    }
    const data = await apiGet(url);
    const students = Array.isArray(data) ? data : (data && Array.isArray((data as any).results) ? (data as any).results : []);
    return students;
  } catch (error) {
    console.error('Failed to fetch alumni students:', error);
    return [];
  }
}

export async function getUnassignedStudents(campusId?: number) {
  try {
    // Add timestamp to prevent caching
    const timestamp = new Date().getTime();
    let url = `${API_ENDPOINTS.STUDENTS}?classroom__isnull=true&is_draft=false&is_deleted=false&page_size=1000&_t=${timestamp}`;
    if (campusId) {
      url += `&campus=${campusId}`;
    }
    const data = await apiGet(url);
    const students = Array.isArray(data) ? data : (data && Array.isArray((data as any).results) ? (data as any).results : []);
    return students;
  } catch (error) {
    console.error('Failed to fetch unassigned students:', error);
    return [];
  }
}

export async function bulkAssignStudentsToClassroom(studentIds: number[], classroomId: number) {
  try {
    // Update each student's classroom field
    const updates = await Promise.all(
      studentIds.map(async (studentId) => {
        try {
          const response = await apiPatch(`${API_ENDPOINTS.STUDENTS}${studentId}/`, {
            classroom: classroomId
          });
          return response;
        } catch (error: any) {
          return { id: studentId, error: error?.message || 'Failed to assign' };
        }
      })
    );
    return updates;
  } catch (error) {
    console.error('Failed to bulk assign students:', error);
    throw error;
  }
}

export async function markBulkAttendance(data: {
  classroom_id: number;
  date: string;
  student_attendance: Array<{
    student_id: number;
    status: string;
    remarks?: string;
  }>;
}) {
  try {
    return await apiPost('/api/attendance/mark-bulk/', data);
  } catch (error) {
    console.error('Failed to mark attendance:', error);
    throw error;
  }
}

export async function getAttendanceHistory(classroomId: number, startDate?: string, endDate?: string) {
  try {
    let url = `/api/attendance/class/${classroomId}/`;
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (params.toString()) url += `?${params.toString()}`;

    return await apiGet(url);
  } catch (error) {
    console.error('Failed to fetch attendance history:', error);
    return [];
  }
}

export async function getAttendanceForDate(classroomId: number, date: string) {
  try {
    // Add cache-busting parameter
    const timestamp = new Date().getTime();
    return await apiGet(`/api/attendance/class/${classroomId}/attendance/${date}/?t=${timestamp}`);
  } catch (error) {
    console.error('Failed to fetch attendance for date:', error);
    return null;
  }
}

export async function editAttendance(attendanceId: number, data: {
  student_attendance: Array<{
    student_id: number;
    status: string;
    remarks?: string;
  }>;
}) {
  try {
    return await apiPut(`/api/attendance/edit/${attendanceId}/`, data);
  } catch (error) {
    // Re-throw ApiError with proper message for user-friendly display
    if (error instanceof ApiError) {
      // Extract user-friendly message from error
      let userMessage = error.message;

      // Handle specific error cases
      if (error.status === 403) {
        if (error.message.includes('7 days') || error.message.includes('older than')) {
          userMessage = '⚠️ Cannot Edit Old Attendance\n\nYou cannot edit attendance that is older than 7 days. Please contact your coordinator if you need to make changes to older attendance records.';
        } else if (error.message.includes('permission')) {
          userMessage = '⚠️ Permission Denied\n\nYou do not have permission to edit this attendance.';
        } else {
          userMessage = error.message || 'You do not have permission to perform this action.';
        }
      } else if (error.status === 400) {
        userMessage = error.message || 'Invalid request. Please check your data and try again.';
      } else if (error.status === 404) {
        userMessage = 'Attendance record not found.';
      }

      // Create new error with user-friendly message
      throw new ApiError(userMessage, error.status, error.statusText, error.response);
    }

    console.error('Failed to edit attendance:', error);
    throw error;
  }
}

export async function getCoordinatorClasses() {
  try {
    const response = await apiGet('/api/attendance/coordinator/classes/');
    return response;
  } catch (error) {
    console.error('API: Failed to fetch coordinator classes:', error);
    return [];
  }
}

export async function getLevelAttendanceSummary(levelId: number, startDate?: string, endDate?: string) {
  try {
    let url = `/api/attendance/level/${levelId}/summary/`;
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (params.toString()) url += `?${params.toString()}`;

    return await apiGet(url);
  } catch (error) {
    console.error('Failed to fetch level attendance summary:', error);
    return null;
  }
}

// Request/Complaint API functions
export interface RequestData {
  category: string;
  subject: string;
  description: string;
  priority?: string;
}

export interface RequestUpdateData {
  status?: string;
  priority?: string;
  coordinator_notes?: string;
  resolution_notes?: string;
}

export async function createRequest(data: RequestData) {
  try {
    return await apiPost('/api/requests/create/', data);
  } catch (error) {
    console.error('Failed to create request:', error);
    throw error;
  }
}

export async function getMyRequests() {
  try {
    return await apiGet('/api/requests/my-requests/');
  } catch (error) {
    console.error('Failed to fetch my requests:', error);
    return [];
  }
}

export async function getRequestDetail(requestId: number) {
  try {
    return await apiGet(`/api/requests/${requestId}/`);
  } catch (error) {
    console.error('Failed to fetch request detail:', error);
    return null;
  }
}

export async function getCoordinatorRequests(filters?: {
  status?: string;
  priority?: string;
  category?: string;
}) {
  try {
    let url = '/api/requests/coordinator/requests/';
    if (filters) {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.priority) params.append('priority', filters.priority);
      if (filters.category) params.append('category', filters.category);
      if (params.toString()) url += `?${params.toString()}`;
    }
    return await apiGet(url);
  } catch (error) {
    console.error('Failed to fetch coordinator requests:', error);
    return [];
  }
}

export async function getCoordinatorDashboardStats(coordinatorId?: number) {
  try {
    if (coordinatorId) {
      return await apiGet(`/api/coordinators/${coordinatorId}/dashboard_stats/`);
    } else {
      // Fallback to requests stats if no coordinator ID provided
      return await apiGet('/api/requests/coordinator/dashboard-stats/');
    }
  } catch (error) {
    console.error('Failed to fetch coordinator dashboard stats:', error);
    return {
      stats: {
        total_teachers: 0,
        total_students: 0,
        total_classes: 0,
        pending_requests: 0,
      }
    };
  }
}

export interface CoordinatorAttendanceStatus {
  date: string;
  grades: Array<{
    grade: string;
    level: string | null;
    shift: string;
    total_classrooms: number;
    marked_count: number;
    holiday_count: number;
    unmarked_teachers: Array<{
      teacher_id: number | null;
      full_name: string;
      employee_code: string | null;
      email: string | null;
      classroom_id: number;
      section: string;
      grade: string;
      has_user: boolean;
    }>;
  }>;
  total_classrooms: number;
  marked_count: number;
  unmarked_count: number;
  holiday_count: number;
}

export async function getCoordinatorAttendanceStatus(
  coordinatorId: number,
  date?: string
): Promise<CoordinatorAttendanceStatus> {
  try {
    const qs = date ? `?date=${encodeURIComponent(date)}` : "";
    return await apiGet(`/api/coordinators/${coordinatorId}/attendance_status/${qs}`);
  } catch (error) {
    console.error("Failed to fetch coordinator attendance status:", error);
    return {
      date: date || "",
      grades: [],
      total_classrooms: 0,
      marked_count: 0,
      unmarked_count: 0,
      holiday_count: 0,
    };
  }
}

export interface CoordinatorRemindResult {
  sent: number;
  skipped: number;
  date: string;
  details?: Array<{ classroom_id: number; reason: string }>;
}

export async function remindCoordinatorAttendance(
  coordinatorId: number,
  date?: string,
  classroomIds?: number[]
): Promise<CoordinatorRemindResult> {
  const payload: Record<string, unknown> = {};
  if (date) payload.date = date;
  if (classroomIds && classroomIds.length) payload.classroom_ids = classroomIds;
  return await apiPost<CoordinatorRemindResult>(
    `/api/coordinators/${coordinatorId}/attendance-status/remind/`,
    payload
  );
}

// Result Management API functions
export interface SubjectMark {
  subject_name: string;
  total_marks: number;
  obtained_marks: number | null;
  has_practical: boolean;
  practical_total?: number;
  practical_obtained?: number | null;
  is_pass: boolean;
  grade?: string;
  variant?: string;
  is_included?: boolean;
  is_absent?: boolean;
}

export interface ResultData {
  student: number;
  exam_type: 'midterm' | 'final' | 'monthly';
  month?: string;
  academic_year: string;
  semester: string;
  subject_marks: SubjectMark[];
  attendance_score?: number;
  total_attendance?: number;
  teacher_remarks?: string;
  is_absent?: boolean;
}

export interface Result {
  id: number;
  student: {
    id: number;
    full_name: string;
    student_code: string;
  };
  teacher: {
    id: number;
    full_name: string;
    signature?: string;
  };
  coordinator?: {
    id: number;
    full_name: string;
  };
  exam_type: string;
  exam_type_display: string;
  month?: string;
  academic_year: string;
  semester: string;
  status: string;
  status_display: string;
  edit_count: number;
  total_marks: number;
  obtained_marks: number;
  percentage: number;
  grade: string;
  result_status: string;
  result_status_display: string;
  pass_status?: string;
  coordinator_comments?: string;
  principal_comments?: string;
  coordinator_signature?: string;
  principal_signature?: string;
  coordinator_signed_at?: string;
  principal_signed_at?: string;
  subject_marks: SubjectMark[];
  attendance_score?: number;
  total_attendance?: number;
  teacher_remarks?: string;
  is_absent?: boolean;
  position?: string;
  created_at: string;
  updated_at: string;
}

export interface Student {
  level: { id: number; name: string } | null;
  id: number;
  name: string;
  full_name?: string;
  student_code: string;
  student_id?: string;
  gr_no?: string;
  roll_number?: string;
  father_name: string;
  phone_number?: string;
  email?: string;
  address?: string; // Student's home address
  date_of_birth?: string;
  gender: string;
  admission_date?: string;
  created_at?: string;
  class_name?: string;
  section?: string;
  campus_name?: string;
  campus_data?: {
    id: number;
    campus_name: string;
    campus_code: string;
    address_full?: string;
    city?: string;
    district?: string;
  };
  classroom?: {
    id: number;
    class_name: string;
    section: string;
  };
}

export interface MidTermCheck {
  student_id: number;
  student_name: string;
  mid_term_exists: boolean;
  mid_term_approved: boolean;
}

export async function createResult(data: ResultData) {
  try {
    return await apiPost('/api/result/create/', data);
  } catch (error) {
    console.error('Failed to create result:', error);
    throw error;
  }
}

export async function getCoordinatorResults() {
  try {
    const response = await apiGet('/api/result/coordinator/results/');

    if (response && typeof response === 'object' && 'results' in response) {
      return response.results;
    }

    if (Array.isArray(response)) {
      return response;
    }

    return [];

  } catch (error: any) {
    if (error?.status === 401) {
      localStorage.removeItem('sis_access_token');
      localStorage.removeItem('sis_refresh_token');
      localStorage.removeItem('sis_user');
      window.location.href = '/login';
      return [];
    }

    throw error;
  }
}

export async function getCoordinatorPendingResults() {
  try {
    return await apiGet('/api/result/coordinator/pending/');
  } catch (error) {
    console.error('Failed to fetch pending results:', error);
    throw error;
  }
}

export async function approveResult(resultId: number, data: { status: string; coordinator_comments?: string; principal_comments?: string; signature?: string }) {
  try {
    return await apiPut(`/api/result/${resultId}/approve/`, data);
  } catch (error) {
    console.error('Failed to approve result:', error);
    throw error;
  }
}

export async function principalApproveResult(resultId: number, data: { status: string; principal_comments?: string; signature?: string }) {
  try {
    return await apiPut(`/api/result/principal/${resultId}/approve/`, data);
  } catch (error) {
    console.error('Failed to principal approve result:', error);
    throw error;
  }
}

export async function rejectResult(resultId: number, data: { status: string; coordinator_comments?: string; principal_comments?: string }) {
  try {
    return await apiPut(`/api/result/${resultId}/approve/`, data);
  } catch (error) {
    console.error('Failed to reject result:', error);
    throw error;
  }
}

export async function principalRejectResult(resultId: number, data: { status: string; principal_comments?: string }) {
  try {
    return await apiPut(`/api/result/principal/${resultId}/approve/`, { ...data, status: 'rejected' });
  } catch (error) {
    console.error('Failed to principal reject result:', error);
    throw error;
  }
}

export async function bulkApproveResults(resultIds: number[], comments: string, signature?: string) {
  try {
    return await apiPost('/api/result/coordinator/bulk-approve/', {
      result_ids: resultIds,
      comments: comments || '',
      signature: signature
    });
  } catch (error) {
    console.error('Failed to bulk approve results:', error);
    throw error;
  }
}

export async function bulkRejectResults(resultIds: number[], comments: string) {
  try {
    return await apiPost('/api/result/coordinator/bulk-reject/', {
      result_ids: resultIds,
      comments: comments
    });
  } catch (error) {
    console.error('Failed to bulk reject results:', error);
    throw error;
  }
}

export async function calculatePositions(classroomId?: number, examType?: string, month?: string) {
  try {
    return await apiPost('/api/result/calculate-positions/', {
      classroom_id: classroomId,
      exam_type: examType,
      month: month,
    });
  } catch (error) {
    console.error('Failed to calculate positions:', error);
    throw error;
  }
}

export async function promoteStudents(data: { student_ids: number[]; target_classroom_id: number }): Promise<{ message: string }> {
  try {
    return await apiPost<{ message: string }>('/api/result/promote-students/', data);
  } catch (error) {
    console.error('Failed to promote students:', error);
    throw error;
  }
}

export async function getMyResults(classroomId?: number) {
  try {
    const url = classroomId
      ? `/api/result/my-results/?classroom=${classroomId}`
      : '/api/result/my-results/';
    return await apiGet(url);
  } catch (error) {
    console.error('Failed to fetch my results:', error);
    return [];
  }
}

export async function getResultDetail(resultId: number) {
  try {
    return await apiGet(`/api/result/${resultId}/`);
  } catch (error) {
    console.error('Failed to fetch result detail:', error);
    throw error;
  }
}

export async function fetchStudentFullResults(studentId: number) {
  try {
    const response = await apiGet(`/api/result/?student=${studentId}`);
    if (response && typeof response === 'object' && 'results' in response) {
      return response.results as Result[];
    }
    return (Array.isArray(response) ? response : []) as Result[];
  } catch (error) {
    console.error('Failed to fetch student results:', error);
    return [];
  }
}

export async function updateResult(resultId: number, data: Partial<ResultData>) {
  try {
    return await apiPut(`/api/result/${resultId}/`, data);
  } catch (error) {
    console.error('Failed to update result:', error);
    throw error;
  }
}

// ─── Result edit-request workflow (re-open an approved result) ───────────────

export async function requestResultEdit(resultId: number, reason: string) {
  return await apiPost('/api/result/edit-request/', { result: resultId, reason });
}

export async function getMyResultEditRequests() {
  try { return await apiGet('/api/result/edit-request/'); }
  catch (error) { console.error('Failed to fetch my edit requests:', error); return []; }
}

export async function getCoordinatorEditRequests() {
  try { return await apiGet('/api/result/coordinator/edit-requests/'); }
  catch (error) { console.error('Failed to fetch edit requests:', error); return []; }
}

export async function approveResultEditRequest(id: number, response?: string) {
  return await apiPost(`/api/result/coordinator/edit-requests/${id}/approve/`, { response: response || '' });
}

export async function rejectResultEditRequest(id: number, response: string) {
  return await apiPost(`/api/result/coordinator/edit-requests/${id}/reject/`, { response });
}

export async function submitResult(resultId: number) {
  try {
    // Send a valid status; backend will override it based on exam_type
    // (monthly → pending_coordinator, midterm/final → pending_principal)
    return await apiPut(`/api/result/${resultId}/submit/`, { status: 'pending_coordinator' });
  } catch (error) {
    console.error('Failed to submit result:', error);
    throw error;
  }
}

export async function forwardClassResults(classroomId: number, examType: string, month?: string) {
  try {
    return await apiPost(`/api/result/forward-class/`, {
      classroom_id: classroomId,
      exam_type: examType,
      month: month
    });
  } catch (error) {
    console.error('Failed to forward class results:', error);
    throw error;
  }
}

// Per-month total marks for Monthly Test (uniform across subjects), by classroom + year.
export async function getMonthlyMarkConfig(classroomId: number | string, academicYear: string) {
  const q = new URLSearchParams({ classroom: String(classroomId), academic_year: academicYear });
  try {
    return await apiGet(`/api/result/monthly-mark-config/?${q.toString()}`);
  } catch (error) {
    console.error('Failed to fetch monthly mark config:', error);
    return {};
  }
}

export async function setMonthlyMarkConfig(
  classroomId: number | string, academicYear: string, month: string, totalMarks: number
) {
  return await apiPost(`/api/result/monthly-mark-config/`, {
    classroom: classroomId, academic_year: academicYear, month, total_marks: totalMarks,
  });
}

export async function forwardResult(resultId: number) {
  try {
    return await apiPut(`/api/result/${resultId}/submit/`, { status: 'pending' });
  } catch (error) {
    console.error('Failed to forward result:', error);
    throw error;
  }
}

export async function checkMidTerm(studentId: number): Promise<MidTermCheck> {
  try {
    return await apiGet(`/api/result/check-midterm/${studentId}/`);
  } catch (error) {
    console.error('Failed to check mid-term:', error);
    throw error;
  }
}

export async function getStudentMonthlyAttendance(studentId: number, month: string, year: string = '2024-25') {
  try {
    return await apiGet(`/api/attendance/student/${studentId}/monthly/?month=${month}&year=${year}`);
  } catch (error) {
    console.error('Failed to fetch monthly attendance:', error);
    return { days_present: 0, total_working_days: 0 };
  }
}


export async function updateRequestStatus(requestId: number, data: RequestUpdateData) {
  try {
    return await apiPut(`/api/requests/${requestId}/update-status/`, data);
  } catch (error) {
    console.error('Failed to update request status:', error);
    throw error;
  }
}

export async function addRequestComment(requestId: number, comment: string) {
  try {
    return await apiPost(`/api/requests/${requestId}/comment/`, { comment });
  } catch (error) {
    console.error('Failed to add comment:', error);
    throw error;
  }
}

// New Request Workflow API functions
export interface ForwardToPrincipalData {
  forwarding_note: string;
}

export interface ApprovalData {
  resolution_notes?: string;
  send_for_confirmation?: boolean;
}

export interface RejectionData {
  rejection_reason: string;
}

export interface ConfirmationData {
  teacher_satisfaction_note?: string;
}

export async function forwardToPrincipal(requestId: number, data: ForwardToPrincipalData) {
  try {
    return await apiPost(`/api/requests/${requestId}/forward-to-principal/`, data);
  } catch (error) {
    console.error('Failed to forward request to principal:', error);
    throw error;
  }
}

export async function approveRequest(requestId: number, data: ApprovalData) {
  try {
    return await apiPost(`/api/requests/${requestId}/approve/`, data);
  } catch (error) {
    console.error('Failed to approve request:', error);
    throw error;
  }
}

export async function rejectRequest(requestId: number, data: RejectionData) {
  try {
    return await apiPost(`/api/requests/${requestId}/reject/`, data);
  } catch (error) {
    console.error('Failed to reject request:', error);
    throw error;
  }
}

// Employee Shift Timings APIs
export async function getEmployeeTimings(campusId?: number | string) {
  try {
    const params = new URLSearchParams();
    if (campusId) params.append('campus_id', String(campusId));
    let url = '/api/attendance/employee-timings/';
    if (params.toString()) url += `?${params.toString()}`;
    return await apiGet(url);
  } catch (error) {
    console.error('Failed to fetch employee timings:', error);
    return [];
  }
}

export async function saveEmployeeTimings(timingsData: any[]) {
  try {
    return await apiPost('/api/attendance/employee-timings/save/', timingsData);
  } catch (error) {
    console.error('Failed to save employee timings:', error);
    throw error;
  }
}


export async function confirmCompletion(requestId: number, data: ConfirmationData) {
  try {
    return await apiPost(`/api/requests/${requestId}/confirm/`, data);
  } catch (error) {
    console.error('Failed to confirm request completion:', error);
    throw error;
  }
}

export async function getPrincipalRequests(filters?: {
  status?: string;
  priority?: string;
  category?: string;
}) {
  try {
    let url = '/api/requests/principal/requests/';
    if (filters) {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.priority) params.append('priority', filters.priority);
      if (filters.category) params.append('category', filters.category);
      if (params.toString()) url += `?${params.toString()}`;
    }
    return await apiGet(url);
  } catch (error: any) {
    const msg = error?.message || '';
    if (!/not found|404/i.test(msg)) {
      console.error('Failed to fetch principal requests:', error);
    }
    return [];
  }
}

export async function getTeacherAttendanceSummary(classroomId: number, startDate?: string, endDate?: string) {
  try {
    let url = `/api/attendance/class/${classroomId}/summary/`;
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (params.toString()) url += `?${params.toString()}`;

    return await apiGet(url);
  } catch (error) {
    console.error('Failed to fetch teacher attendance summary:', error);
    return [];
  }
}

export async function getTeacherWeeklyAttendance(classroomId: number) {
  try {
    const today = new Date();
    const startDateObj = new Date(today);
    startDateObj.setDate(today.getDate() - 6); // 7 days ago including today

    const startDate = startDateObj.toISOString().split('T')[0];
    const endDate = today.toISOString().split('T')[0];

    return await getTeacherAttendanceSummary(classroomId, startDate, endDate);
  } catch (error) {
    console.error('Failed to fetch weekly attendance:', error);
    return [];
  }
}

export async function getTeacherMonthlyTrend(classroomId: number) {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const startDate = startOfMonth.toISOString().split('T')[0];
    const endDate = endOfMonth.toISOString().split('T')[0];

    return await getTeacherAttendanceSummary(classroomId, startDate, endDate);
  } catch (error) {
    console.error('Failed to fetch monthly trend:', error);
    return [];
  }
}

export async function getTeacherTodayAttendance(classroomId: number) {
  try {
    const today = new Date().toISOString().split('T')[0];
    return await getAttendanceForDate(classroomId, today);
  } catch (error) {
    console.error('Failed to fetch today attendance:', error);
    return null;
  }
}

// Attendance State Management
export async function submitAttendance(attendanceId: number) {
  try {
    return await apiPost(`/api/attendance/submit/${attendanceId}/`, {});
  } catch (error) {
    console.error('Failed to submit attendance:', error);
    throw error;
  }
}

export async function reviewAttendance(attendanceId: number) {
  try {
    return await apiPost(`/api/attendance/review/${attendanceId}/`, {});
  } catch (error) {
    console.error('Failed to review attendance:', error);
    throw error;
  }
}

export async function finalizeAttendance(attendanceId: number) {
  try {
    return await apiPost(`/api/attendance/finalize/${attendanceId}/`, {});
  } catch (error) {
    console.error('Failed to approve attendance:', error);
    throw error;
  }
}

export async function coordinatorApproveAttendance(attendanceId: number, comment?: string) {
  try {
    return await apiPost(`/api/attendance/coordinator-approve/${attendanceId}/`, { comment });
  } catch (error) {
    console.error('Failed to approve attendance:', error);
    throw error;
  }
}

export async function coordinatorBulkApproveAttendance(attendanceIds: number[], comment?: string) {
  try {
    return await apiPost(`/api/attendance/coordinator-bulk-approve/`, {
      attendance_ids: attendanceIds,
      comment: comment || ''
    });
  } catch (error) {
    console.error('Failed to bulk approve attendance:', error);
    throw error;
  }
}

export async function reopenAttendance(attendanceId: number, reason: string) {
  try {
    return await apiPost(`/api/attendance/reopen/${attendanceId}/`, { reason });
  } catch (error) {
    console.error('Failed to reopen attendance:', error);
    throw error;
  }
}

// Backfill Permission Management
export async function grantBackfillPermission(data: {
  classroom_id: number;
  date: string;
  teacher_id: number;
  reason: string;
  deadline: string;
}) {
  try {
    return await apiPost('/api/attendance/backfill/grant/', data);
  } catch (error) {
    console.error('Failed to grant backfill permission:', error);
    throw error;
  }
}

export async function getBackfillPermissions() {
  try {
    return await apiGet('/api/attendance/backfill/permissions/');
  } catch (error) {
    console.error('Failed to fetch backfill permissions:', error);
    return [];
  }
}

// Holiday Management
type HolidayPayload = {
  date: string;
  reason: string;
  shift?: string;
  level_id?: number;
  level_ids?: number[];
  grade_ids?: number[];
};

type HolidayUpdatePayload = HolidayPayload;

export async function createHoliday(data: HolidayPayload) {
  try {
    return await apiPost('/api/attendance/holidays/create/', data);
  } catch (error) {
    console.error('Failed to create holiday:', error);
    throw error;
  }
}

export interface GetHolidaysParams {
  levelId?: number;
  levelIds?: number[];
  gradeId?: number;
  gradeIds?: number[];
  startDate?: string;
  endDate?: string;
  shift?: string;
}

export async function getHolidays(params: GetHolidaysParams = {}) {
  try {
    let url = '/api/attendance/holidays/';
    const query = new URLSearchParams();

    if (params.levelId) query.append('level_id', params.levelId.toString());
    params.levelIds?.forEach((id) => query.append('level_ids', id.toString()));
    if (params.gradeId) query.append('grade_id', params.gradeId.toString());
    params.gradeIds?.forEach((id) => query.append('grade_ids', id.toString()));
    if (params.startDate) query.append('start_date', params.startDate);
    if (params.endDate) query.append('end_date', params.endDate);
    if (params.shift) query.append('shift', params.shift);

    if (query.toString()) {
      url += `?${query.toString()}`;
    }

    return await apiGet(url);
  } catch (error) {
    console.error('Failed to fetch holidays:', error);
    return [];
  }
}

export async function updateHoliday(holidayId: number, data: HolidayUpdatePayload) {
  try {
    return await apiPut(`/api/attendance/holidays/${holidayId}/`, data);
  } catch (error) {
    console.error('Failed to update holiday:', error);
    throw error;
  }
}

export async function deleteHoliday(holidayId: number, restoreAttendance: boolean = false) {
  try {
    const res = await authorizedFetch(`/api/attendance/holidays/${holidayId}/delete/`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restore_attendance: restoreAttendance })
    });
    if (!res.ok) {
      const text = await res.text();
      handleApiError(res, text);
    }
    return await res.json();
  } catch (error) {
    console.error('Failed to delete holiday:', error);
    throw error;
  }
}

// Real-time Metrics
export async function getRealtimeMetrics() {
  try {
    return await apiGet('/api/attendance/metrics/realtime/');
  } catch (error) {
    console.error('Failed to fetch real-time metrics:', error);
    return { today: '', classrooms: [] };
  }
}

// ==================== TRANSFER MANAGEMENT APIs ====================

export interface TransferRequest {
  id: number;
  request_type: 'student' | 'teacher';
  transfer_category?: string | null;
  status: 'draft' | 'pending' | 'approved' | 'declined' | 'cancelled';
  entity_name: string;
  current_id: string;
  from_campus: number;
  from_campus_name: string;
  from_shift: 'M' | 'A';
  to_campus: number;
  to_campus_name: string;
  to_shift: 'M' | 'A';
  requesting_principal: number;
  requesting_principal_name: string;
  receiving_principal: number;
  receiving_principal_name: string;
  student?: number;
  student_name?: string;
  student_id?: string;
  teacher?: number;
  teacher_name?: string;
  teacher_id?: string;
  reason: string;
  requested_date: string;
  notes: string;
  reviewed_at?: string;
  decline_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface IDHistory {
  id: number;
  entity_type: 'student' | 'teacher';
  entity_name: string;
  student?: number;
  teacher?: number;
  old_id: string;
  old_campus_code: string;
  old_shift: string;
  old_year: string;
  new_id: string;
  new_campus_code: string;
  new_shift: string;
  new_year: string;
  immutable_suffix: string;
  transfer_request: number;
  changed_by: number;
  changed_by_name: string;
  change_reason: string;
  changed_at: string;
}

export interface IDPreview {
  old_id: string;
  new_id: string;
  changes: {
    campus_code: string;
    shift: string;
    year: string;
    role?: string;
    suffix: string;
  };
}

// Class/Section Transfer
export interface ClassTransfer {
  id: number;
  student: number;
  student_name: string;
  student_id: string;
  from_classroom: number | null;
  from_classroom_display?: string | null;
  to_classroom: number | null;
  to_classroom_display?: string | null;
  from_section?: string | null;
  to_section?: string | null;
  from_grade_name?: string | null;
  to_grade_name?: string | null;
  initiated_by_teacher: number | null;
  initiated_by_teacher_name?: string | null;
  coordinator: number | null;
  coordinator_name?: string | null;
  principal: number | null;
  principal_name?: string | null;
  status: 'pending' | 'approved' | 'declined' | 'cancelled';
  reason: string;
  requested_date: string;
  decline_reason?: string;
  created_at: string;
  updated_at: string;
}

// Shift Transfer
export interface ShiftTransfer {
  id: number;
  student: number;
  student_name: string;
  student_id: string;
  campus: number;
  campus_name: string;
  from_shift: 'morning' | 'afternoon';
  to_shift: 'morning' | 'afternoon';
  from_classroom: number | null;
  from_classroom_display?: string | null;
  to_classroom: number | null;
  to_classroom_display?: string | null;
  requesting_teacher: number | null;
  requesting_teacher_name?: string | null;
  from_shift_coordinator: number | null;
  from_shift_coordinator_name?: string | null;
  to_shift_coordinator: number | null;
  to_shift_coordinator_name?: string | null;
  principal: number | null;
  principal_name?: string | null;
  transfer_request: number | null;
  status: 'pending_own_coord' | 'pending_other_coord' | 'approved' | 'declined' | 'cancelled';
  reason: string;
  requested_date: string;
  decline_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface AvailableClassroomOption {
  id: number;
  label: string;
  grade_name: string;
  grade_id?: number;  // Actual grade ID (may differ from requested grade ID if alternative grade was used)
  section: string;
  shift: string;
  class_teacher_name?: string | null;
  coordinator_name?: string | null;
}

// Transfer Request APIs
export async function createTransferRequest(data: {
  request_type: 'student' | 'teacher';
  from_campus: number;
  from_shift: 'M' | 'A';
  to_campus: number;
  to_shift: 'M' | 'A';
  student?: number;
  teacher?: number;
  reason: string;
  requested_date: string;
  notes?: string;
  transfer_type?: 'campus' | 'shift';
  transfer_category?: string;
}) {
  try {
    return await apiPost('/api/transfers/request/', data);
  } catch (error) {
    console.error('Failed to create transfer request:', error);
    throw error;
  }
}

export async function getTransferRequests(params?: {
  type?: 'student' | 'teacher';
  status?: 'draft' | 'pending' | 'approved' | 'declined' | 'cancelled';
  direction?: 'all' | 'outgoing' | 'incoming';
}) {
  try {
    const queryParams = new URLSearchParams();
    if (params?.type) queryParams.append('type', params.type);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.direction) queryParams.append('direction', params.direction);

    const url = `/api/transfers/request/list/${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return await apiGet(url);
  } catch (error) {
    console.error('Failed to fetch transfer requests:', error);
    return [];
  }
}

export async function getTransferRequest(requestId: number) {
  try {
    return await apiGet(`/api/transfers/request/${requestId}/`);
  } catch (error) {
    console.error('Failed to fetch transfer request:', error);
    throw error;
  }
}

export async function approveTransfer(requestId: number) {
  try {
    return await apiPost(`/api/transfers/request/${requestId}/approve/`, {});
  } catch (error) {
    console.error('Failed to approve transfer:', error);
    throw error;
  }
}

export async function declineTransfer(requestId: number, reason: string) {
  try {
    return await apiPost(`/api/transfers/request/${requestId}/decline/`, {
      action: 'decline',
      reason: reason
    });
  } catch (error) {
    console.error('Failed to decline transfer:', error);
    throw error;
  }
}

export async function cancelTransfer(requestId: number) {
  try {
    return await apiPost(`/api/transfers/request/${requestId}/cancel/`, {});
  } catch (error) {
    console.error('Failed to cancel transfer:', error);
    throw error;
  }
}

// ID History APIs
export async function getIDHistory(entityType: 'student' | 'teacher', entityId: number) {
  try {
    return await apiGet(`/api/transfers/history/${entityType}/${entityId}/`);
  } catch (error) {
    console.error('Failed to fetch ID history:', error);
    return [];
  }
}

export async function searchByOldID(oldId: string) {
  try {
    return await apiGet(`/api/transfers/search-by-old-id/?id=${encodeURIComponent(oldId)}`);
  } catch (error) {
    console.error('Failed to search by old ID:', error);
    throw error;
  }
}

// ID Preview API
export async function previewIDChange(data: {
  old_id: string;
  new_campus_code: string;
  new_shift: 'M' | 'A';
  new_role?: string;
}) {
  try {
    return await apiPost('/api/transfers/preview-id-change/', data);
  } catch (error) {
    console.error('Failed to preview ID change:', error);
    throw error;
  }
}

// Class Transfer APIs
export async function createClassTransfer(data: {
  student: number;
  to_classroom: number;
  reason: string;
  requested_date: string;
}) {
  try {
    return await apiPost('/api/transfers/class/request/', data);
  } catch (error) {
    console.error('Failed to create class transfer:', error);
    throw error;
  }
}

export async function getClassTransfers(params?: { status?: string }) {
  try {
    const qs = new URLSearchParams();
    if (params?.status) qs.append('status', params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return await apiGet<ClassTransfer[]>(`/api/transfers/class/list/${suffix}`);
  } catch (error) {
    console.error('Failed to fetch class transfers:', error);
    return [];
  }
}

export async function approveClassTransfer(transferId: number) {
  try {
    return await apiPost(`/api/transfers/class/${transferId}/approve/`, {});
  } catch (error) {
    console.error('Failed to approve class transfer:', error);
    throw error;
  }
}

export async function declineClassTransfer(transferId: number, reason: string) {
  try {
    return await apiPost(`/api/transfers/class/${transferId}/decline/`, { reason });
  } catch (error) {
    console.error('Failed to decline class transfer:', error);
    throw error;
  }
}

export async function getAvailableClassSections(studentId: number) {
  try {
    const url = `/api/transfers/available-class-sections/?student=${studentId}`;
    return await apiGet<AvailableClassroomOption[]>(url);
  } catch (error) {
    console.error('Failed to fetch available class sections:', error);
    return [];
  }
}

// Shift Transfer APIs
export async function createShiftTransfer(data: {
  student: number;
  to_shift: 'morning' | 'afternoon';
  to_classroom?: number;
  reason: string;
  requested_date: string;
}) {
  try {
    return await apiPost('/api/transfers/shift/request/', data);
  } catch (error) {
    console.error('Failed to create shift transfer:', error);
    throw error;
  }
}

export async function getShiftTransfers(params?: { status?: string }) {
  try {
    const qs = new URLSearchParams();
    if (params?.status) qs.append('status', params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return await apiGet<ShiftTransfer[]>(`/api/transfers/shift/list/${suffix}`);
  } catch (error) {
    console.error('Failed to fetch shift transfers:', error);
    return [];
  }
}

export async function approveShiftTransferOwn(transferId: number) {
  try {
    return await apiPost(`/api/transfers/shift/${transferId}/approve-own/`, {});
  } catch (error) {
    console.error('Failed to approve shift transfer (own coordinator):', error);
    throw error;
  }
}

export async function approveShiftTransferOther(transferId: number) {
  try {
    return await apiPost(`/api/transfers/shift/${transferId}/approve-other/`, {});
  } catch (error) {
    console.error('Failed to approve shift transfer (other coordinator):', error);
    throw error;
  }
}

export async function declineShiftTransfer(transferId: number, reason: string) {
  try {
    return await apiPost(`/api/transfers/shift/${transferId}/decline/`, { reason });
  } catch (error) {
    console.error('Failed to decline shift transfer:', error);
    throw error;
  }
}

export async function getAvailableShiftSections(studentId: number, toShift: 'morning' | 'afternoon') {
  try {
    const qs = new URLSearchParams();
    qs.append('student', studentId.toString());
    qs.append('to_shift', toShift);
    const url = `/api/transfers/available-shift-sections/?${qs.toString()}`;
    return await apiGet<AvailableClassroomOption[]>(url);
  } catch (error) {
    console.error('Failed to fetch available shift sections:', error);
    return [];
  }
}

export async function getAvailableCampusTransferSections(
  studentId: number,
  toCampusId: number,
  toShift: 'M' | 'A'
) {
  try {
    const qs = new URLSearchParams();
    qs.append('student', studentId.toString());
    qs.append('to_campus', toCampusId.toString());
    qs.append('to_shift', toShift === 'M' ? 'morning' : 'afternoon');
    const url = `/api/transfers/campus/available-sections/?${qs.toString()}`;
    return await apiGet<AvailableClassroomOption[]>(url);
  } catch (error) {
    console.error('Failed to fetch available campus transfer sections:', error);
    return [];
  }
}

// Grade Skip Transfer APIs
export interface GradeSkipTransfer {
  id: number;
  student: number;
  student_name: string;
  student_id: string;
  campus: number;
  campus_name: string;
  from_grade: number;
  from_grade_name: string;
  to_grade: number;
  to_grade_name: string;
  from_classroom: number | null;
  from_classroom_display: string | null;
  to_classroom: number | null;
  to_classroom_display: string | null;
  from_section: string | null;
  to_section: string | null;
  from_shift: string;
  to_shift: string | null;
  initiated_by_teacher: number | null;
  initiated_by_teacher_name: string | null;
  from_grade_coordinator: number | null;
  from_grade_coordinator_name: string | null;
  to_grade_coordinator: number | null;
  to_grade_coordinator_name: string | null;
  principal: number | null;
  principal_name: string | null;
  transfer_request: number | null;
  status: 'pending_own_coord' | 'pending_other_coord' | 'approved' | 'declined' | 'cancelled';
  reason: string;
  requested_date: string;
  decline_reason: string;
  created_at: string;
  updated_at: string;
}

export interface AvailableGradeForSkip {
  id: number;
  name: string;
  level_name: string | null;
  campus_name: string | null;
}

export async function getAvailableGradesForSkip(studentId: number) {
  try {
    const url = `/api/transfers/grade-skip/available-grades/?student_id=${studentId}`;
    return await apiGet<AvailableGradeForSkip>(url);
  } catch (error) {
    console.error('Failed to fetch available grades for skip:', error);
    throw error;
  }
}

export async function getAvailableGradesForCampusSkip(studentId: number, toCampusId: number) {
  try {
    const url = `/api/transfers/campus/available-grades-for-skip/?student_id=${studentId}&to_campus_id=${toCampusId}`;
    return await apiGet<AvailableGradeForSkip>(url);
  } catch (error) {
    console.error('Failed to fetch available grades for campus skip:', error);
    throw error;
  }
}

// Delete Logs API
export interface DeleteLogResponse {
  results: Array<{
    id: number;
    feature: string;
    feature_display: string;
    action: string;
    action_display: string;
    entity_type: string;
    entity_id: number;
    entity_name: string;
    user: number | null;
    user_name: string;
    user_role: string | null;
    timestamp: string;
    ip_address: string | null;
    changes: Record<string, any>;
    reason: string;
  }>;
  count: number;
  total: number;
}

export async function getDeleteLogs(feature?: string, limit?: number): Promise<DeleteLogResponse> {
  try {
    const qs = new URLSearchParams();
    if (feature) {
      qs.append('feature', feature);
    }
    if (limit) {
      qs.append('limit', limit.toString());
    }
    const url = `/api/attendance/delete-logs/${qs.toString() ? `?${qs.toString()}` : ''}`;
    return await apiGet<DeleteLogResponse>(url);
  } catch (error) {
    console.error('Failed to fetch delete logs:', error);
    throw error;
  }
}

export async function getAvailableSectionsForGradeSkip(
  studentId: number,
  toGradeId: number,
  toShift?: 'morning' | 'afternoon'
) {
  try {
    const qs = new URLSearchParams();
    qs.append('student_id', studentId.toString());
    qs.append('to_grade_id', toGradeId.toString());
    if (toShift) {
      qs.append('to_shift', toShift);
    }
    const url = `/api/transfers/grade-skip/available-sections/?${qs.toString()}`;
    const result = await apiGet<AvailableClassroomOption[]>(url);
    return result;
  } catch (error) {
    console.error('Failed to fetch available sections for grade skip:', error);
    return [];
  }
}

export async function getAvailableSectionsForCampusSkip(
  studentId: number,
  toGradeId: number,
  toCampusId: number,
  toShift: 'M' | 'A'
) {
  try {
    const qs = new URLSearchParams();
    qs.append('student_id', studentId.toString());
    qs.append('to_grade_id', toGradeId.toString());
    qs.append('to_campus_id', toCampusId.toString());
    qs.append('to_shift', toShift === 'M' ? 'morning' : 'afternoon');
    const url = `/api/transfers/campus/available-sections-for-skip/?${qs.toString()}`;
    return await apiGet<AvailableClassroomOption[]>(url);
  } catch (error) {
    console.error('Failed to fetch available sections for campus skip:', error);
    return [];
  }
}

// Campus Transfer APIs
export interface CampusTransfer {
  id: number;
  student: number;
  student_name: string;
  student_id: string;
  from_campus: number;
  from_campus_name: string;
  to_campus: number;
  to_campus_name: string;
  from_shift: 'morning' | 'afternoon';
  to_shift: 'morning' | 'afternoon';
  from_classroom: number | null;
  from_classroom_display: string | null;
  to_classroom: number | null;
  to_classroom_display: string | null;
  from_grade: number | null;
  to_grade: number | null;
  from_grade_name: string | null;
  to_grade_name: string | null;
  from_section: string | null;
  to_section: string | null;
  skip_grade: boolean;
  initiated_by_teacher: number | null;
  initiated_by_teacher_name?: string | null;
  from_coordinator: number | null;
  from_coordinator_name?: string | null;
  to_coordinator: number | null;
  to_coordinator_name?: string | null;
  from_principal: number | null;
  from_principal_name?: string | null;
  to_principal: number | null;
  to_principal_name?: string | null;
  transfer_request: number | null;
  status:
  | 'pending_from_coord'
  | 'pending_from_principal'
  | 'pending_to_principal'
  | 'pending_to_coord'
  | 'approved'
  | 'declined'
  | 'cancelled';
  reason: string;
  requested_date: string;
  decline_reason?: string | null;
  letter_generated_at?: string | null;
  letter_new_student_id?: string | null;
  letter_from_campus_name?: string | null;
  letter_to_campus_name?: string | null;
  letter_from_class_label?: string | null;
  letter_to_class_label?: string | null;
  letter_from_principal_name?: string | null;
  letter_to_principal_name?: string | null;
  letter_to_coordinator_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampusTransferLetterPayload {
  student_name: string;
  student_old_id: string;
  student_new_id: string;
  from_campus_name: string;
  to_campus_name: string;
  from_class_label: string | null;
  to_class_label: string | null;
  from_principal_name: string | null;
  to_principal_name: string | null;
  to_coordinator_name: string | null;
  approved_at: string;
  requested_date: string;
  reason: string;
}

export async function createCampusTransfer(data: {
  student: number;
  to_campus: number;
  to_shift: 'morning' | 'afternoon';
  to_grade?: number;
  to_classroom?: number;
  skip_grade?: boolean;
  reason: string;
  requested_date: string;
}) {
  try {
    return await apiPost('/api/transfers/campus/create/', data);
  } catch (error) {
    console.error('Failed to create campus transfer:', error);
    throw error;
  }
}

export async function getCampusTransfers(params?: {
  status?: string;
  direction?: 'incoming' | 'outgoing' | 'all';
}) {
  try {
    const qs = new URLSearchParams();
    if (params?.status) qs.append('status', params.status);
    if (params?.direction) qs.append('direction', params.direction);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return await apiGet<CampusTransfer[]>(`/api/transfers/campus/list/${suffix}`);
  } catch (error) {
    console.error('Failed to fetch campus transfers:', error);
    return [];
  }
}

export async function approveCampusTransferFromCoord(transferId: number) {
  try {
    return await apiPost(`/api/transfers/campus/${transferId}/approve-from-coord/`, {});
  } catch (error) {
    console.error('Failed to approve campus transfer (from coordinator):', error);
    throw error;
  }
}

export async function approveCampusTransferFromPrincipal(transferId: number) {
  try {
    return await apiPost(`/api/transfers/campus/${transferId}/approve-from-principal/`, {});
  } catch (error) {
    console.error('Failed to approve campus transfer (from principal):', error);
    throw error;
  }
}

export async function approveCampusTransferToPrincipal(transferId: number) {
  try {
    return await apiPost(`/api/transfers/campus/${transferId}/approve-to-principal/`, {});
  } catch (error) {
    console.error('Failed to approve campus transfer (to principal):', error);
    throw error;
  }
}

export async function confirmCampusTransfer(transferId: number, confirmText: string, comment?: string) {
  try {
    return await apiPost(`/api/transfers/campus/${transferId}/confirm/`, {
      confirm_text: confirmText,
      comment,
    });
  } catch (error) {
    console.error('Failed to confirm campus transfer:', error);
    throw error;
  }
}

export async function declineCampusTransfer(transferId: number, reason: string) {
  try {
    return await apiPost(`/api/transfers/campus/${transferId}/decline/`, { reason });
  } catch (error) {
    console.error('Failed to decline campus transfer:', error);
    throw error;
  }
}

export async function cancelCampusTransfer(transferId: number) {
  try {
    return await apiPost(`/api/transfers/campus/${transferId}/cancel/`, {});
  } catch (error) {
    console.error('Failed to cancel campus transfer:', error);
    throw error;
  }
}

export async function getCampusTransferLetter(transferId: number) {
  try {
    return await apiGet<CampusTransferLetterPayload>(`/api/transfers/campus/${transferId}/letter/`);
  } catch (error) {
    console.error('Failed to fetch campus transfer letter:', error);
    throw error;
  }
}

export async function createGradeSkipTransfer(data: {
  student: number;
  to_grade: number;
  to_classroom?: number;
  to_shift?: 'morning' | 'afternoon';
  reason: string;
  requested_date: string;
}) {
  try {
    return await apiPost('/api/transfers/grade-skip/create/', data);
  } catch (error) {
    console.error('Failed to create grade skip transfer:', error);
    throw error;
  }
}

export async function getGradeSkipTransfers(params?: { status?: string }) {
  try {
    const qs = new URLSearchParams();
    if (params?.status) qs.append('status', params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return await apiGet<GradeSkipTransfer[]>(`/api/transfers/grade-skip/list/${suffix}`);
  } catch (error) {
    console.error('Failed to fetch grade skip transfers:', error);
    return [];
  }
}

export async function approveGradeSkipOwnCoord(transferId: number) {
  try {
    return await apiPost(`/api/transfers/grade-skip/${transferId}/approve-own/`, {});
  } catch (error) {
    console.error('Failed to approve grade skip transfer (own coordinator):', error);
    throw error;
  }
}

export async function approveGradeSkipOtherCoord(transferId: number) {
  try {
    return await apiPost(`/api/transfers/grade-skip/${transferId}/approve-other/`, {});
  } catch (error) {
    console.error('Failed to approve grade skip transfer (other coordinator):', error);
    throw error;
  }
}

export async function declineGradeSkip(transferId: number, reason: string) {
  try {
    return await apiPost(`/api/transfers/grade-skip/${transferId}/decline/`, { reason });
  } catch (error) {
    console.error('Failed to decline grade skip transfer:', error);
    throw error;
  }
}

// ==================== PASSWORD CHANGE OTP APIs ====================

export async function sendPasswordChangeOTP(email: string) {
  try {
    const response = await fetch('/api/users/send-password-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new ApiError(errorData.error || 'Failed to send OTP', response.status, response.statusText);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(`Network error: ${error}`, 0, 'Network Error');
  }
}

export async function verifyPasswordChangeOTP(email: string, otpCode: string) {
  try {
    const response = await fetch('/api/users/verify-password-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp_code: otpCode }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new ApiError(errorData.message || 'Failed to verify OTP', response.status, response.statusText);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(`Network error: ${error}`, 0, 'Network Error');
  }
}

export async function changePasswordWithOTP(sessionToken: string, newPassword: string, confirmPassword: string) {
  try {
    const response = await fetch('/api/users/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_token: sessionToken,
        new_password: newPassword,
        confirm_password: confirmPassword
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new ApiError(errorData.error || 'Failed to change password', response.status, response.statusText);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(`Network error: ${error}`, 0, 'Network Error');
  }
}

// ==================== FORGOT PASSWORD OTP APIs ====================

export async function sendForgotPasswordOTP(email: string) {
  try {
    const response = await fetch('/api/users/send-forgot-password-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new ApiError(errorData.error || 'Failed to send OTP', response.status, response.statusText);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(`Network error: ${error}`, 0, 'Network Error');
  }
}

// Principal APIs
export async function getAllPrincipals() {
  try {
    const principals = await apiGet(API_ENDPOINTS.PRINCIPALS) as any;
    return Array.isArray(principals) ? principals : (principals?.results || []);
  } catch (error) {
    console.error('Failed to fetch principals:', error);
    return [];
  }
}

export async function getFilteredPrincipals(params: {
  page?: number;
  page_size?: number;
  search?: string;
  campus?: number;
  shift?: string;
  is_currently_active?: boolean;
  ordering?: string;
}): Promise<{
  count: number;
  next: string | null;
  previous: string | null;
  results: any[];
}> {
  try {
    const queryParams = new URLSearchParams();

    // Add pagination params
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.page_size) queryParams.append('page_size', params.page_size.toString());

    // Add search param
    if (params.search) queryParams.append('search', params.search);

    // Add filter params
    if (params.campus) queryParams.append('campus', params.campus.toString());
    if (params.shift) queryParams.append('shift', params.shift);
    if (params.is_currently_active !== undefined) queryParams.append('is_currently_active', params.is_currently_active.toString());

    // Add ordering param
    if (params.ordering) queryParams.append('ordering', params.ordering);

    const response = await apiGet(`${API_ENDPOINTS.PRINCIPALS}?${queryParams.toString()}`);
    return response as {
      count: number;
      next: string | null;
      previous: string | null;
      results: any[];
    };
  } catch (error) {
    console.error('Failed to fetch filtered principals:', error);
    throw error;
  }
}

export async function getPrincipalById(id: number) {
  try {
    return await apiGet(`${API_ENDPOINTS.PRINCIPALS}${id}/`);
  } catch (error) {
    console.error('Failed to fetch principal:', error);
    throw error;
  }
}

export async function createPrincipal(data: any) {
  try {
    return await apiPost(API_ENDPOINTS.PRINCIPALS, data);
  } catch (error) {
    console.error('Failed to create principal:', error);
    throw error;
  }
}

export async function updatePrincipal(id: number, data: any) {
  try {
    return await apiPut(`${API_ENDPOINTS.PRINCIPALS}${id}/`, data);
  } catch (error) {
    console.error('Failed to update principal:', error);
    throw error;
  }
}

/**
 * Save principal's digital signature via the dedicated endpoint.
 * Uses auth token to identify the principal — no ID required.
 */
export async function savePrincipalSignature(signature: string) {
  try {
    return await apiPatch(`${API_ENDPOINTS.PRINCIPALS}signature/save/`, { signature });
  } catch (error) {
    console.error('Failed to save principal signature:', error);
    throw error;
  }
}

export async function deletePrincipal(id: number) {
  try {
    return await apiDelete(`${API_ENDPOINTS.PRINCIPALS}${id}/`);
  } catch (error) {
    console.error('Failed to delete principal:', error);
    throw error;
  }
}

export async function getPrincipalStats() {
  try {
    return await apiGet(`${API_ENDPOINTS.PRINCIPALS}stats/`);
  } catch (error) {
    console.error('Failed to fetch principal stats:', error);
    throw error;
  }
}

export async function verifyForgotPasswordOTP(email: string, otpCode: string) {
  try {
    const response = await fetch('/api/users/verify-forgot-password-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        otp_code: otpCode
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new ApiError(errorData.message || 'Failed to verify OTP', response.status, response.statusText);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(`Network error: ${error}`, 0, 'Network Error');
  }
}

export async function resetPasswordWithOTP(sessionToken: string, newPassword: string, confirmPassword: string) {
  try {
    const response = await fetch('/api/users/reset-password-with-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_token: sessionToken,
        new_password: newPassword,
        confirm_password: confirmPassword
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new ApiError(errorData.error || 'Failed to reset password', response.status, response.statusText);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(`Network error: ${error}`, 0, 'Network Error');
  }
}

export async function getSubjects(params?: { campus?: number; level?: number; is_active?: boolean }) {
  try {
    const queryParams = new URLSearchParams();
    if (params?.campus) queryParams.append('campus', params.campus.toString());
    if (params?.level) queryParams.append('level', params.level.toString());
    if (params?.is_active !== undefined) queryParams.append('is_active', params.is_active.toString());

    const url = queryParams.toString()
      ? API_ENDPOINTS.TIMETABLE_SUBJECTS + '?' + queryParams.toString()
      : API_ENDPOINTS.TIMETABLE_SUBJECTS;

    const response = await apiGet(url);
    return Array.isArray(response) ? response : (response as any)?.results || [];
  } catch (error) {
    console.error('Failed to fetch subjects:', error);
    return [];
  }
}

/**
 * Get available subjects for a specific student or classroom using backend helper
 */
export async function getAvailableSubjects(params?: { student_id?: number; classroom_id?: number }) {
  try {
    const query = new URLSearchParams();
    if (params?.student_id) query.append('student_id', params.student_id.toString());
    if (params?.classroom_id) query.append('classroom_id', params.classroom_id.toString());

    const url = '/api/result/available-subjects/';
    const fullUrl = query.toString() ? `${url}?${query.toString()}` : url;

    const response = await apiGet(fullUrl);
    return Array.isArray((response as any)?.subjects) ? (response as any).subjects : [];
  } catch (error) {
    console.error('Failed to fetch available subjects:', error);
    return [];
  }
}

/**
 * Create a new subject
 */
export async function createSubject(data: { name: string; campus: number; level?: number; description?: string }) {
  try {
    return await apiPost(API_ENDPOINTS.TIMETABLE_SUBJECTS, data);
  } catch (error) {
    console.error('Failed to create subject:', error);
    throw error;
  }
}

/**
 * Update an existing subject
 */
export async function updateSubject(id: number, data: Partial<{ name: string; campus: number; level?: number; description?: string; is_active: boolean }>) {
  try {
    return await apiPatch(`${API_ENDPOINTS.TIMETABLE_SUBJECTS}${id}/`, data);
  } catch (error) {
    console.error(`Failed to update subject ${id}:`, error);
    throw error;
  }
}

/**
 * Delete a subject
 */
export async function deleteSubject(id: number) {
  try {
    return await apiDelete(`${API_ENDPOINTS.TIMETABLE_SUBJECTS}${id}/`);
  } catch (error) {
    console.error(`Failed to delete subject ${id}:`, error);
    throw error;
  }
}

/**
 * Get class timetable periods (optionally filtered)
 */
export async function getClassTimetable(params?: {
  classroom?: number;
  teacher?: number;
  subject?: number;
  day?: string;
  grade?: string;
  section?: string;
}) {
  try {
    const queryParams = new URLSearchParams();
    if (params?.classroom) queryParams.append('classroom', params.classroom.toString());
    if (params?.teacher) queryParams.append('teacher', params.teacher.toString());
    if (params?.subject) queryParams.append('subject', params.subject.toString());
    if (params?.day) queryParams.append('day', params.day);
    if (params?.grade) queryParams.append('grade', params.grade);
    if (params?.section) queryParams.append('section', params.section);

    const url = queryParams.toString()
      ? API_ENDPOINTS.TIMETABLE_CLASS + '?' + queryParams.toString()
      : API_ENDPOINTS.TIMETABLE_CLASS;

    const response = await apiGet(url);
    return Array.isArray(response) ? response : (response as any)?.results || [];
  } catch (error) {
    console.error('Failed to fetch class timetable:', error);
    return [];
  }
}

/**
 * Get teacher timetable periods (optionally filtered)
 */
export async function getTeacherTimetable(params?: {
  teacher?: number;
  classroom?: number;
  subject?: number;
  day?: string;
}) {
  try {
    const queryParams = new URLSearchParams();
    if (params?.teacher) queryParams.append('teacher_id', params.teacher.toString());
    if (params?.classroom) queryParams.append('classroom', params.classroom.toString());
    if (params?.subject) queryParams.append('subject', params.subject.toString());
    if (params?.day) queryParams.append('day', params.day);

    const url = queryParams.toString()
      ? API_ENDPOINTS.TIMETABLE_TEACHER + '?' + queryParams.toString()
      : API_ENDPOINTS.TIMETABLE_TEACHER;

    const response = await apiGet(url);
    return Array.isArray(response) ? response : (response as any)?.results || [];
  } catch (error) {
    console.error('Failed to fetch teacher timetable:', error);
    return [];
  }
}

export async function createClassPeriod(data: {
  classroom: number;
  teacher: number;
  subject: number;
  day: string;
  start_time: string;
  end_time: string;
  is_break?: boolean;
  notes?: string;
}) {
  try {
    return await apiPost(API_ENDPOINTS.TIMETABLE_CLASS, data);
  } catch (error) {
    console.error('Failed to create class period:', error);
    throw error;
  }
}

export async function deleteClassPeriods(params: {
  classroom?: number;
  teacher?: number;
}) {
  try {
    const queryParams = new URLSearchParams();
    if (params.classroom) queryParams.append('classroom', params.classroom.toString());
    if (params.teacher) queryParams.append('teacher', params.teacher.toString());

    const url = queryParams.toString()
      ? API_ENDPOINTS.TIMETABLE_CLASS + 'bulk_delete/?' + queryParams.toString()
      : API_ENDPOINTS.TIMETABLE_CLASS + 'bulk_delete/';

    return await apiDelete(url);
  } catch (error) {
    console.error('Failed to delete class periods:', error);
    throw error;
  }
}

export async function bulkCreateClassPeriods(periods: Array<{
  classroom: number;
  teacher: number;
  subject: number;
  day: string;
  start_time: string;
  end_time: string;
  is_break?: boolean;
  notes?: string;
}>) {
  try {
    return await apiPost(API_ENDPOINTS.TIMETABLE_CLASS + 'bulk_create/', { periods });
  } catch (error) {
    console.error('Failed to bulk create class periods:', error);
    throw error;
  }
}


export async function bulkCreateTeacherPeriods(periods: Array<{
  classroom: number;
  teacher: number;
  subject: number;
  day: string;
  start_time: string;
  end_time: string;
  is_break?: boolean;
  notes?: string;
}>) {
  try {
    return await apiPost(API_ENDPOINTS.TIMETABLE_TEACHER + 'bulk_create/', { periods });
  } catch (error) {
    console.error('Failed to bulk create teacher periods:', error);
    throw error;
  }
}
// Shift Timing API
export async function getShiftTimings(campusId: number | undefined | null, shift: string) {
  try {
    // Omit campus when unknown so the backend falls back to the logged-in
    // user's campus (coordinator/teacher profile) instead of a wrong hard-coded id.
    const q = new URLSearchParams();
    if (campusId) q.append('campus', String(campusId));
    if (shift) q.append('shift', shift);
    const data = await apiGet(`${API_ENDPOINTS.TIMETABLE}shift-timings/?${q.toString()}`);
    return Array.isArray(data) ? data : (data as any).results || [];
  } catch (error) {
    console.error('Failed to fetch shift timings:', error);
    return [];
  }
}

export async function createShiftTiming(data: any) {
  return apiPost(`${API_ENDPOINTS.TIMETABLE}shift-timings/`, data);
}

export async function updateShiftTiming(id: number, data: any) {
  return apiPut(`${API_ENDPOINTS.TIMETABLE}shift-timings/${id}/`, data);
}

export async function deleteShiftTiming(id: number) {
  return apiDelete(`${API_ENDPOINTS.TIMETABLE}shift-timings/${id}/`);
}

export async function createClassTimetable(data: any) {
  return apiPost(`${API_ENDPOINTS.TIMETABLE}class-timetable/`, data);
}

export async function updateClassTimetable(id: number, data: any) {
  return apiPut(`${API_ENDPOINTS.TIMETABLE}class-timetable/${id}/`, data);
}

export async function deleteClassTimetable(id: number) {
  return apiDelete(`${API_ENDPOINTS.TIMETABLE}class-timetable/${id}/`);
}


export async function createTeacherTimetable(data: any) {
  return apiPost(`${API_ENDPOINTS.TIMETABLE}teacher-timetable/`, data);
}

export async function updateTeacherTimetable(id: number, data: any) {
  return apiPut(`${API_ENDPOINTS.TIMETABLE}teacher-timetable/${id}/`, data);
}

export async function deleteTeacherTimetable(id: number) {
  return apiDelete(`${API_ENDPOINTS.TIMETABLE}teacher-timetable/${id}/`);
}

// ==================== STUDENT PORTAL APIs ====================

export async function studentDirectChangePassword(
  sessionToken: string,
  newPassword: string,
  confirmPassword: string
) {
  const base = getApiBaseUrl();
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const response = await fetch(`${cleanBase}/api/student-direct-change-password/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_token: sessionToken,
      new_password: newPassword,
      confirm_password: confirmPassword,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new ApiError(data.error || 'Failed to change password', response.status, response.statusText);
  }
  return data;
}

export async function getStudentMyProfile() {
  const res = await authorizedFetch('/api/students/my-profile/');
  if (!res.ok) throw new ApiError('Failed to fetch student profile', res.status, res.statusText);
  return res.json();
}

export async function getStudentResults(studentId?: number | string) {
  try {
    if (!studentId) {
      return await apiGet('/api/result/student/my-results/');
    }
    const url = typeof API_ENDPOINTS.STUDENT_RESULTS === 'function' 
      ? API_ENDPOINTS.STUDENT_RESULTS(studentId) 
      : `/api/students/${studentId}/results/`;
    return await apiGet(url);
  } catch (error) {
    console.error('Failed to fetch student results:', error);
    return [];
  }
}

// ─── Org Admin: Staff Management & Role Switch ────────────────────────────────

export interface OrgStaffMember {
  id: number
  full_name: string
  email: string
  role: string
  role_display: string
  employee_code: string
  campus_name: string | null
  is_active: boolean
  signature?: string
  signature_updated_at?: string
  last_login: string | null
  last_login_ip: string | null
  created_at: string | null
}

export async function getOrgStaff(): Promise<OrgStaffMember[]> {
  const res = await authorizedFetch('/api/users/org-staff/');
  if (!res.ok) throw new ApiError('Failed to fetch staff list', res.status, res.statusText);
  return res.json();
}

export async function switchUserRole(
  userId: number,
  newRole: string,
  options?: { level_ids?: number[]; campus_id?: number; shift?: string; custom_code?: string }
): Promise<{ message: string; new_employee_code: string; old_employee_code: string; new_role: string }> {
  const res = await authorizedFetch(`/api/users/${userId}/switch-role/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_role: newRole, ...options }),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.error || 'Failed to switch role', res.status, res.statusText);
  return data;
}

export async function toggleUserActive(userId: number): Promise<{ message: string; is_active: boolean }> {
  const res = await authorizedFetch(`/api/users/${userId}/toggle-active/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.error || 'Failed to toggle status', res.status, res.statusText);
  return data;
}

// ─── ZKTeco Device & Mapping APIs ────────────────────────────────────────────

export async function getZKDevices(): Promise<any[]> {
  const res = await authorizedFetch('/api/attendance/zkteco/devices/');
  if (!res.ok) throw new ApiError('Failed to fetch devices', res.status, res.statusText);
  return res.json();
}

export async function createZKDevice(data: any): Promise<any> {
  const res = await authorizedFetch('/api/attendance/zkteco/devices/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw { status: res.status, data: json };
  return json;
}

export async function getZKMappings(deviceId?: number): Promise<any[]> {
  const url = deviceId
    ? `/api/attendance/zkteco/mappings/?device_id=${deviceId}`
    : '/api/attendance/zkteco/mappings/';
  const res = await authorizedFetch(url);
  if (!res.ok) throw new ApiError('Failed to fetch mappings', res.status, res.statusText);
  return res.json();
}

export async function getZKUnmappedStaff(deviceId?: number): Promise<any[]> {
  const url = deviceId
    ? `/api/attendance/zkteco/unmapped-staff/?device_id=${deviceId}`
    : '/api/attendance/zkteco/unmapped-staff/';
  const res = await authorizedFetch(url);
  if (!res.ok) throw new ApiError('Failed to fetch unmapped staff', res.status, res.statusText);
  return res.json();
}

export async function createZKMapping(data: {
  device: number; device_user_id: string; device_user_name: string; user: number;
}): Promise<any> {
  const res = await authorizedFetch('/api/attendance/zkteco/mappings/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new ApiError(json.error || 'Failed to create mapping', res.status, res.statusText);
  return json;
}

export async function updateZKMapping(mappingId: number, data: { user: number | null }): Promise<any> {
  const res = await authorizedFetch(`/api/attendance/zkteco/mappings/${mappingId}/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new ApiError(json.error || 'Failed to update mapping', res.status, res.statusText);
  return json;
}

export async function deleteZKMapping(mappingId: number): Promise<void> {
  const res = await authorizedFetch(`/api/attendance/zkteco/mappings/${mappingId}/`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new ApiError('Failed to delete mapping', res.status, res.statusText);
}


// ─── Staff Attendance APIs ────────────────────────────────────────────────────

export async function getStaffAttendanceList(params: { date?: string; campus_id?: number | string }): Promise<any[]> {
  const q = new URLSearchParams();
  if (params.date) q.set('date', params.date);
  if (params.campus_id) q.set('campus_id', String(params.campus_id));
  const res = await authorizedFetch(`/api/attendance/staff/?${q.toString()}`);
  if (!res.ok) throw new ApiError('Failed to fetch teacher attendance', res.status, res.statusText);
  return res.json();
}

export async function markStaffAttendance(data: {
  date: string;
  records: { staff_id: number; status: string; check_in_time?: string; check_out_time?: string; remarks?: string }[];
}): Promise<any> {
  const res = await authorizedFetch('/api/attendance/staff/mark/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new ApiError('Failed to mark staff attendance', res.status, res.statusText);
  return res.json();
}

export async function getStaffAttendanceSummary(params: { date?: string; campus_id?: number | string }): Promise<any> {
  const q = new URLSearchParams();
  if (params.date) q.set('date', params.date);
  if (params.campus_id) q.set('campus_id', String(params.campus_id));
  const res = await authorizedFetch(`/api/attendance/staff/summary/?${q.toString()}`);
  if (!res.ok) throw new ApiError('Failed to fetch staff attendance summary', res.status, res.statusText);
  return res.json();
}

// Per-day present/absent over a trailing window, optionally scoped to one
// campus — feeds the Staff Attendance dashboard widget (weekly/monthly/
// 3-month/6-month, same shape as getDailyAttendanceStats for students).
export async function getStaffDailyAttendanceStats(days = 7, campusId?: string | number): Promise<Array<{ day: string; date: string; present: number; absent: number }>> {
  try {
    const q = new URLSearchParams({ days: String(days) });
    if (campusId) q.append('campus_id', String(campusId));
    const data = await apiGet<any>(`/api/attendance/staff/daily_stats/?${q.toString()}`);
    return Array.isArray(data) ? data : (data?.results || []);
  } catch (error) {
    console.error('Failed to fetch staff daily attendance stats:', error);
    return [];
  }
}

export interface StaffCalendarDay {
  date: string;
  day: number;
  weekday: string;
  status: 'present' | 'absent' | 'late' | 'leave' | 'half_day' | 'weekend' | 'holiday' | 'unmarked' | 'future';
}

export interface StaffCalendarResponse {
  user_id: number;
  month: string;
  days: StaffCalendarDay[];
  summary: {
    present: number;
    absent: number;
    late: number;
    leave: number;
    half_day: number;
    marked_days: number;
    attendance_pct: number;
  };
}

// One staff member's day-by-day attendance for a month — feeds the
// "Attendance Calendar" section on their profile (Teacher/Coordinator).
export async function fetchStaffCalendar(userId: number | string, month?: string): Promise<StaffCalendarResponse> {
  const q = month ? `?month=${encodeURIComponent(month)}` : '';
  return apiGet<StaffCalendarResponse>(`/api/attendance/staff/${userId}/calendar/${q}`);
}

export interface StaffHistoryMember {
  id: number;
  name: string;
  employee_code: string;
  role: string;
  campus_name: string | null;
}

export interface StaffHistoryDay {
  date: string;
  /** user id (as string) -> status */
  records: Record<string, string>;
}

export interface StaffAttendanceHistoryResponse {
  start_date: string;
  end_date: string;
  staff: StaffHistoryMember[];
  days: StaffHistoryDay[];
}

// All staff × every day in a date range — feeds the Weekly/Monthly grid view
// on the Staff Attendance page.
export async function getStaffAttendanceHistory(startDate: string, endDate: string, campusId?: string | number): Promise<StaffAttendanceHistoryResponse> {
  const q = new URLSearchParams({ start_date: startDate, end_date: endDate });
  if (campusId) q.append('campus_id', String(campusId));
  return apiGet<StaffAttendanceHistoryResponse>(`/api/attendance/staff/history/?${q.toString()}`);
}

// ─── Retest APIs ──────────────────────────────────────────────────────────────

export async function createRetestSchedule(data: {
  original_result_id: number;
  subject_name: string;
  scheduled_date?: string;
  scheduled_time?: string;
  venue?: string;
}) {
  try { return await apiPost('/api/retest/schedule/create/', data); }
  catch (error) { console.error('Failed to create retest schedule:', error); throw error; }
}

export async function getTeacherRetests(params?: { exam_type?: string; status?: string }) {
  try {
    const q = new URLSearchParams();
    if (params?.exam_type) q.set('exam_type', params.exam_type);
    if (params?.status) q.set('status', params.status);
    return await apiGet(`/api/retest/teacher/list/?${q.toString()}`);
  } catch (error) { console.error('Failed to fetch teacher retests:', error); return []; }
}

export async function enterRetestResult(data: { retest_result_id: number; marks_obtained?: number; is_absent?: boolean }) {
  try { return await apiPost('/api/retest/result/enter/', data); }
  catch (error) { console.error('Failed to enter retest result:', error); throw error; }
}

export async function submitRetestResult(retestResultId: number) {
  try { return await apiPost(`/api/retest/result/submit/${retestResultId}/`, {}); }
  catch (error) { console.error('Failed to submit retest result:', error); throw error; }
}

export async function cancelRetestSchedule(scheduleId: number) {
  try { return await apiPatch(`/api/retest/schedule/cancel/${scheduleId}/`, {}); }
  catch (error) { console.error('Failed to cancel retest schedule:', error); throw error; }
}

export async function getCoordinatorRetests() {
  try { return await apiGet('/api/retest/coordinator/list/'); }
  catch (error) { console.error('Failed to fetch coordinator retests:', error); return []; }
}

export async function approveRetestCoordinator(retestResultId: number) {
  try { return await apiPost(`/api/retest/coordinator/approve/${retestResultId}/`, {}); }
  catch (error) { console.error('Failed to approve retest:', error); throw error; }
}

export async function rejectRetestCoordinator(retestResultId: number, reject_reason: string) {
  try { return await apiPost(`/api/retest/coordinator/reject/${retestResultId}/`, { reject_reason }); }
  catch (error) { console.error('Failed to reject retest:', error); throw error; }
}

export async function getPrincipalRetests() {
  try { return await apiGet('/api/retest/principal/list/'); }
  catch (error) { console.error('Failed to fetch principal retests:', error); return []; }
}

export async function approveRetestPrincipal(retestResultId: number) {
  try { return await apiPost(`/api/retest/principal/approve/${retestResultId}/`, {}); }
  catch (error) { console.error('Failed to approve retest:', error); throw error; }
}

export async function rejectRetestPrincipal(retestResultId: number, reject_reason: string) {
  try { return await apiPost(`/api/retest/principal/reject/${retestResultId}/`, { reject_reason }); }
  catch (error) { console.error('Failed to reject retest:', error); throw error; }
}

export async function getStudentRetests() {
  try { return await apiGet('/api/retest/student/my-retests/'); }
  catch (error) { console.error('Failed to fetch student retests:', error); return []; }
}

export async function getStudentApprovedRetests(studentId: number) {
  try { return await apiGet(`/api/retest/student/${studentId}/approved/`); }
  catch (error) { console.error('Failed to fetch student approved retests:', error); return []; }
}

export async function fetchSystemVersion(): Promise<{ version: string | null; build: number | null; display: string | null; release_notes: string; created_at: string } | null> {
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/version/`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function releaseNewVersion(data: { version: string; release_notes?: string }, token: string): Promise<any> {
  try { return await apiPost('/api/version/release/', data); }
  catch (error) { console.error('Failed to release version:', error); throw error; }
}
