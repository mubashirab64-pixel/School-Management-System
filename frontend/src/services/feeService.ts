import { apiGet, apiPost, apiPatch, apiDelete, API_ENDPOINTS } from '@/lib/api';

export interface FeeType {
  id: number;
  name: string;
  frequency: 'monthly' | 'yearly' | 'one_time';
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

export interface FeeLineItem {
  id?: number;
  fee_type: number;
  fee_type_name?: string;
  amount: string | number;
  frequency?: string;
}

export interface FeeStructure {
  id: number;
  name: string;
  campus: number;
  campus_name?: string;
  level: number | null;
  level_name?: string;
  grade: number | null;
  grade_name?: string;
  section: number | null;
  section_name?: string;
  is_default: boolean;
  is_active: boolean;
  line_items: FeeLineItem[];
  created_at: string;
}

export interface StudentFee {
  id: number;
  student: number;
  student_name: string;
  student_code: string;
  student_class?: string;
  student_gr_no?: string;
  school_name?: string;
  school_address?: string;
  organization_name?: string;
  fee_structure: number;
  month: number;
  year: number;
  invoice_number: string;
  total_amount: string;
  paid_amount: string;
  remaining_amount: string;
  status: 'unpaid' | 'issued' | 'partial' | 'paid';
  due_date: string;
  late_fee: string;
  other_charges: string;
  fee_structure_details: any;
  created_at: string;
  // Payment info (populated when status=paid/partial)
  payment_method?: 'cash' | 'bank' | null;
  payment_date?: string | null;
  receipt_number?: string | null;
  received_by_name?: string | null;
}

class FeeService {
  // Fee Types
  async getFeeTypes() {
    const data = await apiGet<any>(API_ENDPOINTS.FEE_TYPES);
    return Array.isArray(data) ? data : (data.results || []);
  }
  
  async createFeeType(data: Partial<FeeType>) {
    return await apiPost<FeeType>(API_ENDPOINTS.FEE_TYPES, data);
  }
  
  async deleteFeeType(id: number) {
    return await apiDelete(`${API_ENDPOINTS.FEE_TYPES}${id}/`);
  }

  // Fee Structures
  async getFeeStructures() {
    const data = await apiGet<any>(API_ENDPOINTS.FEE_STRUCTURES);
    return Array.isArray(data) ? data : (data.results || []);
  }
  
  async createFeeStructure(data: Partial<FeeStructure>) {
    return await apiPost<FeeStructure>(API_ENDPOINTS.FEE_STRUCTURES, data);
  }
  
  async updateFeeStructure(id: number, data: Partial<FeeStructure>) {
    // We'll use PUT as defined in the backend ViewSet generically, or PATCH
    try {
      return await apiPatch<FeeStructure>(`${API_ENDPOINTS.FEE_STRUCTURES}${id}/`, data);
    } catch {
      return await apiPost<FeeStructure>(`${API_ENDPOINTS.FEE_STRUCTURES}${id}/`, data);
    }
  }
  
  async deleteFeeStructure(id: number) {
    return await apiDelete(`${API_ENDPOINTS.FEE_STRUCTURES}${id}/`);
  }

  async generateChallans(data: { 
    month: number; 
    year: number; 
    campus_id?: number; 
    student_id?: number;
    level_id?: number; 
    grade_id?: number;
    structure_id?: number;
    level_ids?: number[];
    grade_ids?: number[];
    section_ids?: number[];
  }) {
    return await apiPost<any>(API_ENDPOINTS.FEE_GENERATE, data);
  }

  // Student Fees
  async getStudentFees(params: any = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== "") {
        query.append(key, val.toString());
      }
    });
    const data = await apiGet<any>(`${API_ENDPOINTS.STUDENT_FEES}?${query.toString()}`);
    return Array.isArray(data) ? data : (data.results || []);
  }
  
  async getStudentFee(id: number) {
    return await apiGet<StudentFee>(`${API_ENDPOINTS.STUDENT_FEES}${id}/`);
  }
  
  async updateFeeStatus(id: number) {
    return await apiPatch<any>(`${API_ENDPOINTS.STUDENT_FEES}${id}/status/`, {});
  }

  // Payments
  async recordPayment(data: {
    student_fee: number;
    amount: number;
    method: 'cash' | 'bank';
    bank_name?: string;
    transaction_id?: string;
    deposit_date?: string;
  }) {
    return await apiPost<any>(API_ENDPOINTS.FEE_PAYMENTS, data);
  }

  // Reports
  async getCollectionReport(params: {
    month?: number;
    year?: number;
    month_from?: number;
    year_from?: number;
    month_to?: number;
    year_to?: number;
    grade_id?: number;
    campus_id?: number;
  }) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        query.append(key, val.toString());
      }
    });
    return await apiGet<any>(`${API_ENDPOINTS.FEE_REPORTS_COLLECTION}?${query.toString()}`);
  }

  // Shared lookups
  async getCampuses() {
    const res = await apiGet<any>(API_ENDPOINTS.CAMPUS);
    return Array.isArray(res) ? res : (res?.results || []);
  }

  async getLevelsByCampus(campusId: number | string) {
    const res = await apiGet<any>(`${API_ENDPOINTS.LEVELS}?campus_id=${campusId}`);
    return Array.isArray(res) ? res : (res?.results || []);
  }

  async getGradesByLevel(levelId: number | string) {
    const res = await apiGet<any>(`${API_ENDPOINTS.GRADES}?level_id=${levelId}`);
    return Array.isArray(res) ? res : (res?.results || []);
  }
  
  async getGradesByCampus(campusId: number | string) {
    const res = await apiGet<any>(`${API_ENDPOINTS.GRADES}?campus_id=${campusId}`);
    return Array.isArray(res) ? res : (res?.results || []);
  }

  async getSectionsByGrade(gradeId: number | string) {
    const res = await apiGet<any>(`${API_ENDPOINTS.CLASSROOMS}?grade_id=${gradeId}`);
    return Array.isArray(res) ? res : (res?.results || []);
  }

  async searchStudents(params: { q?: string; campus_id?: number; classroom_id?: number }) {
    const query = new URLSearchParams();
    if (params.q) query.append('search', params.q);
    if (params.campus_id) query.append('campus_id', params.campus_id.toString());
    if (params.classroom_id) query.append('classroom', params.classroom_id.toString());
    
    // Using existing student endpoints
    // Note: If /api/students returns 403 for accountant, we should use the fee_assignments or student_fees endpoint
    const res = await apiGet<any>(`${API_ENDPOINTS.STUDENTS}?${query.toString()}`);
    return Array.isArray(res) ? res : (res?.results || []);
  }
}

export const feeService = new FeeService();
