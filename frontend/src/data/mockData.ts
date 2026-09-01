// Minimal shim: real chart helpers are in '@/lib/chart-utils'bhai 
export {
  getMotherTongueDistribution,
  getReligionDistribution,
  getGradeDistribution,
  getGenderDistribution,
  getCampusPerformance,
  getEnrollmentTrend,
} from "@/lib/chart-utils"

// Legacy constants left empty so older imports do not break
export const CAMPUSES: string[] = []
export const GRADES: string[] = []
export const ACADEMIC_YEARS: number[] = []
export const MOTHER_TONGUES: string[] = []
export const RELIGIONS: string[] = []
export const mockStudents: any[] = []
