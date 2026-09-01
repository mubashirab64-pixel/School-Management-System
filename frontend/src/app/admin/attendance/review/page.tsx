/**
 * app/admin/attendance/review/page.tsx
 *   → The one route every staff role uses to review past attendance.
 *
 * Server Component by default: it renders no data itself, it only mounts the
 * client component. Keeping the shell on the server means the page's JS bundle
 * starts at the boundary below, not at the route.
 *
 * There is deliberately no role in the path. What each role sees is decided by
 * the backend's scope resolver, so /admin/coordinator/attendance-review and
 * friends do not need to exist.
 */
import type { Metadata } from "next";

import AttendanceReview from "@/components/attendance/attendance-review";

export const metadata: Metadata = {
  title: "Attendance Review",
  description: "Review submitted attendance for any past period.",
};

export default function AttendanceReviewPage() {
  return <AttendanceReview />;
}
