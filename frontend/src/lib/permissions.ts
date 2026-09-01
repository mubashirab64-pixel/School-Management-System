// Role-based permissions utility
// Urdu roman: Ye file har role ke liye permissions define karti hai
// English: This file defines permissions for each role

export type UserRole = 'superadmin' | 'coordinator' | 'teacher' | 'principal' | string;

export interface User {
  username: string;
  first_name: string;
  last_name: string;
  role: string;
  email?: string;
  name?: string;
  campus?: any;
  campus_id?: number | string;
  campus_name?: string;
  shift?: string;
  cnic?: string;
  permissions?: Record<string, boolean>;
}

// Get normalized role from user object
export function getUserRole(user: User | null): UserRole {
  if (!user) return 'guest';

  const roleNorm = String(user.role || '').toLowerCase().trim();

  // Order matters: check more specific roles first
  if (roleNorm === 'superadmin') return 'superadmin';
  if (
    roleNorm === 'org_admin' ||
    roleNorm === 'org admin' ||
    roleNorm === 'org-admin' ||
    (roleNorm.includes('org') && roleNorm.includes('admin'))
  ) return 'org_admin';
  
  if (roleNorm.includes('compliance') || roleNorm === 'compliance_officer') return 'compliance_officer';
  if (roleNorm.includes('coord')) return 'coordinator';
  if (roleNorm.includes('teach')) return 'teacher';
  if (roleNorm === 'admin') return 'admin';
  if (roleNorm.includes('admin')) return 'superadmin'; // fallback for legacy (e.g. system_admin)
  if (roleNorm.includes('princ')) return 'principal';

  return roleNorm;
}

// Get current user from localStorage
export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null;

  try {
    const userStr = window.localStorage.getItem('sis_user');
    if (!userStr) return null;
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

// Get current user's role
export function getCurrentUserRole(): UserRole {
  return getUserRole(getCurrentUser());
}

// Permission checks for different actions
export interface Permissions {
  // Dashboard
  canViewDashboard: boolean;
  canViewAdminDashboard: boolean;
  canViewTeacherDashboard: boolean;
  canViewCoordinatorDashboard: boolean;
  canViewPrincipalDashboard: boolean;
  canViewStudentDashboard: boolean;
  canViewSuperadminDashboard: boolean;
  canViewAccountsDashboard: boolean;
  canViewAdmissionsDashboard: boolean;
  canViewComplianceDashboard: boolean;

  // Students
  canViewStudents: boolean;
  canAddStudent: boolean;
  canEditStudent: boolean;
  canDeleteStudent: boolean;
  canViewPromotions: boolean;

  // Teachers
  canViewTeachers: boolean;
  canAddTeacher: boolean;
  canEditTeacher: boolean;
  canDeleteTeacher: boolean;
  canApproveResults: boolean;
  canViewRequests: boolean;
  canViewTimetable: boolean;
  canViewSubjects: boolean;
  canMarkAttendance: boolean;
  canViewAttendance: boolean;
  canApproveAttendance: boolean;
  canViewTransfers: boolean;
  canViewClasses: boolean;

  // Campus
  canViewCampus: boolean;
  canAddCampus: boolean;
  canEditCampus: boolean;
  canDeleteCampus: boolean;

  // Coordinator
  canViewCoordinators: boolean;
  canAddCoordinator: boolean;
  canEditCoordinator: boolean;
  canDeleteCoordinator: boolean;

  // Principals & Results
  canViewPrincipals: boolean;
  canAddPrincipal: boolean;
  canEditPrincipal: boolean;
  canDeletePrincipal: boolean;
  canViewResults: boolean;
  canAddResult: boolean;
  canBulkImportResults: boolean;
  canEditResults: boolean;
  canManageFees: boolean;

  // Charts
  canViewGradeDistributionChart: boolean;
  canViewGenderDistributionChart: boolean;
  canViewMotherTongueChart: boolean;
  canViewReligionChart: boolean;
  canViewEnrollmentTrendChart: boolean;
  canViewAgeDistributionChart: boolean;
  canViewWeeklyAttendanceChart: boolean;
  canViewZakatStatusChart: boolean;
  canViewHouseOwnershipChart: boolean;
  canViewNetworkPerformanceChart: boolean;

  // KPIs
  canViewTotalStudentsKpi: boolean;
  canViewTotalTeachersKpi: boolean;
  canViewTeacherStudentRatioKpi: boolean;
  canViewAvgAttendanceKpi: boolean;

  // Management
  canManagePermissions: boolean;
  canManageForms: boolean;
}

export function getPermissions(role: UserRole): Permissions {
  const user = getCurrentUser();

  // Default minimal permissions model
  const defaultPerms: Permissions = {
    canViewDashboard: false,
    canViewAdminDashboard: false,
    canViewTeacherDashboard: false,
    canViewCoordinatorDashboard: false,
    canViewPrincipalDashboard: false,
    canViewStudentDashboard: false,
    canViewSuperadminDashboard: false,
    canViewAccountsDashboard: false,
    canViewAdmissionsDashboard: false,
    canViewComplianceDashboard: false,
    canViewStudents: false,
    canAddStudent: false,
    canEditStudent: false,
    canDeleteStudent: false,
    canViewPromotions: false,
    canViewTeachers: false,
    canAddTeacher: false,
    canEditTeacher: false,
    canDeleteTeacher: false,
    canApproveResults: false,
    canViewRequests: false,
    canViewTimetable: false,
    canViewSubjects: false,
    canMarkAttendance: false,
    canViewAttendance: false,
    canApproveAttendance: false,
    canViewTransfers: false,
    canViewClasses: false,
    canViewCampus: false,
    canAddCampus: false,
    canEditCampus: false,
    canDeleteCampus: false,
    canViewCoordinators: false,
    canAddCoordinator: false,
    canEditCoordinator: false,
    canDeleteCoordinator: false,
    canViewPrincipals: false,
    canAddPrincipal: false,
    canEditPrincipal: false,
    canDeletePrincipal: false,
    canViewResults: false,
    canAddResult: false,
    canBulkImportResults: false,
    canEditResults: false,
    canManageFees: false,
    // Charts
    canViewGradeDistributionChart: false,
    canViewGenderDistributionChart: false,
    canViewMotherTongueChart: false,
    canViewReligionChart: false,
    canViewEnrollmentTrendChart: false,
    canViewAgeDistributionChart: false,
    canViewWeeklyAttendanceChart: false,
    canViewZakatStatusChart: false,
    canViewHouseOwnershipChart: false,
    canViewNetworkPerformanceChart: false,
    canViewTotalStudentsKpi: false,
    canViewTotalTeachersKpi: false,
    canViewTeacherStudentRatioKpi: false,
    canViewAvgAttendanceKpi: false,
    // Management
    canManagePermissions: false,
    canManageForms: false,
  };


  // All roles (including superadmin) use dynamic permissions from backend
  
  // Master roles (SuperAdmin, Admin, OrgAdmin) bypass dynamic checks and get full access
  if (role === 'superadmin' || role === 'admin' || role === 'org_admin') {
      const allTrue = Object.keys(defaultPerms).reduce((acc, key) => {
          acc[key as keyof Permissions] = true;
          return acc;
      }, {} as Permissions);
      
      // Special exclusion: org_admin should not see Zakat status chart
      if (role === 'org_admin') {
          allTrue.canViewZakatStatusChart = false;
      }
      
      return allTrue;
  }

  // If we have dynamic permissions from backend (stored in user profile during login)
  if (user && user.permissions) {
    const p = user.permissions;
    return {
      canViewDashboard: !!p['view_dashboard'],
      canViewAdminDashboard: !!p['view_admin_dashboard'],
      canViewTeacherDashboard: !!p['view_teacher_dashboard'],
      canViewCoordinatorDashboard: !!p['view_coordinator_dashboard'],
      canViewPrincipalDashboard: !!p['view_principal_dashboard'],
      canViewStudentDashboard: !!p['view_student_dashboard'],
      canViewSuperadminDashboard: !!p['view_superadmin_dashboard'],
      canViewAccountsDashboard: !!p['view_accounts_dashboard'],
      canViewAdmissionsDashboard: !!p['view_admissions_dashboard'],
      canViewComplianceDashboard: !!p['view_compliance_dashboard'],
      canViewStudents: !!p['view_students'] || role === 'org_admin',
      canAddStudent: !!p['add_student'],
      canEditStudent: !!p['edit_student'],
      canDeleteStudent: false, // Backend doesn't have delete currently
      canViewTeachers: !!p['view_teachers'],
      canAddTeacher: !!p['add_teacher'],
      canEditTeacher: !!p['edit_teacher'], // Note: Backend has edit_teacher in permission model?
      canDeleteTeacher: false,
      canApproveResults: !!p['approve_results'],
      canViewRequests: !!p['view_requests'],
      canViewTimetable: !!p['view_timetable'] || role === 'teacher' || role === 'coordinator',
      canViewSubjects: !!p['view_subjects'],
      canMarkAttendance: !!p['mark_attendance'],
      canViewAttendance: !!p['view_attendance'],
      canApproveAttendance: !!p['approve_attendance'],
      canViewTransfers: !!p['view_transfers'],
      canViewPromotions: !!p['view_promotions'],
      canViewClasses: !!p['view_classes'] || !!p['view_dashboard'], // Provide a fallback
      canViewCampus: !!p['view_campus'],
      canAddCampus: !!p['add_campus'],
      canEditCampus: false, // Backend doesn't have edit_campus
      canDeleteCampus: false,
      canViewCoordinators: !!p['view_coordinators'],
      canAddCoordinator: !!p['add_coordinator'],
      canEditCoordinator: !!p['edit_coordinator'],
      canDeleteCoordinator: !!p['delete_coordinator'],
      canViewPrincipals: !!p['view_principals'],
      canAddPrincipal: !!p['add_principal'],
      canEditPrincipal: !!p['edit_principal'],
      canDeletePrincipal: !!p['delete_principal'],
      canViewResults: !!p['view_results'],
      canAddResult: !!p['add_result'],
      canViewGradeDistributionChart: !!p['view_grade_distribution_chart'],
      canViewGenderDistributionChart: !!p['view_gender_distribution_chart'],
      canViewMotherTongueChart: !!p['view_mother_tongue_chart'],
      canViewReligionChart: !!p['view_religion_chart'],
      canViewEnrollmentTrendChart: !!p['view_enrollment_trend_chart'],
      canViewAgeDistributionChart: !!p['view_age_distribution_chart'],
      canViewWeeklyAttendanceChart: !!p['view_weekly_attendance_chart'],
      canViewZakatStatusChart: !!p['view_zakat_status_chart'],
      canViewHouseOwnershipChart: !!p['view_house_ownership_chart'],
      canViewNetworkPerformanceChart: !!p['view_network_performance_chart'],
      canViewTotalStudentsKpi: !!p['view_total_students_kpi'],
      canViewTotalTeachersKpi: !!p['view_total_teachers_kpi'],
      canViewTeacherStudentRatioKpi: !!p['view_teacher_student_ratio_kpi'],
      canViewAvgAttendanceKpi: !!p['view_avg_attendance_kpi'],
      canManagePermissions: !!p['manage_permissions'] || role === 'org_admin',
      canManageForms: !!p['manage_forms'] || role === 'org_admin',
      canBulkImportResults: !!p['bulk_import_results'],
      canEditResults: !!p['edit_results'],
      canManageFees: !!p['manage_fees'] || !!p['view_fees'],
    };
  }

  // All roles use only dynamic permissions if available.
  // We fall back to default (minimal/all-false) permissions if not found.
  return defaultPerms;
}

// Hook to get current user permissions
export function usePermissions(): Permissions {
  const role = getCurrentUserRole();
  return getPermissions(role);
}

// Helper to check if user can perform action
export function canPerformAction(action: keyof Permissions): boolean {
  const role = getCurrentUserRole();
  const permissions = getPermissions(role);
  return permissions[action];
}

