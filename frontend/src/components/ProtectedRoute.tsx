"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isRouteAllowed, FEATURES } from "@/config/features";
import { getCurrentUserRole } from "@/lib/permissions";

const DEVELOPMENT_PHASE_ROUTES: Record<string, string> = {
  // '/admin/coordinator/time-table': 'Time Table Management',
  // '/admin/teachers/result': 'Teacher Results',
  // '/admin/teachers/request': 'Teacher Requests',
  // '/admin/teachers/timetable': 'Teacher Timetable',
  // '/admin/students/leaving-certificate': 'Leaving Certificate',
  // '/admin/students/termination-certificate': 'Termination Certificate',
  // '/admin/coordinator/result-approval': 'Result Approval',
  // '/admin/principals/transfers': 'Transfer Management',
  // '/admin/principals/transfers/create': 'Create Transfer',
  // '/admin/coordinator/requests' : 'Requests Management',
  // '/admin/principal/shift-timings': 'Shift Timings',
  // '/admin/principal/result-approval': 'Result Approval',
};

const BYPASS_FEATURE_GUARD_ROLES = new Set(["superadmin", "admin"]);

function getOrgFeatures(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem("sis_organization");
    if (raw) {
      const org = JSON.parse(raw);
      return org.enabled_features ?? {};
    }
  } catch { /* ignore */ }
  return {};
}

function hasNewFeatureFormat(features: Record<string, boolean>): boolean {
  const newKeys = new Set(FEATURES.map(f => f.key));
  return Object.keys(features).some(k => newKeys.has(k as never));
}

function getBlockedFeatureName(pathname: string, features: Record<string, boolean>): string | null {
  for (const feature of FEATURES) {
    const isBlocked = feature.routes.some(route => pathname.startsWith(route));
    if (isBlocked && !features[feature.key]) return feature.label;
  }
  return null;
}

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    // Persist last safe route for reliable back navigation
    const isProtected = !!DEVELOPMENT_PHASE_ROUTES[pathname || ""];
    const isDevPhase = pathname === "/development-phase";
    const isFeatureDisabled = pathname === "/feature-disabled";

    if (pathname && !isProtected && !isDevPhase && !isFeatureDisabled) {
      sessionStorage.setItem("last-safe-route", pathname);
    }

    // 1. Auth check
    const token = window.localStorage.getItem("sis_access_token");
    if (!token) {
      router.replace("/login");
      return;
    }

    // 2. Development phase check
    if (pathname && DEVELOPMENT_PHASE_ROUTES[pathname]) {
      const featureName = DEVELOPMENT_PHASE_ROUTES[pathname];
      const currentRoute = pathname;
      const stored = sessionStorage.getItem("last-safe-route");
      const ref = document.referrer ? new URL(document.referrer).pathname : "";
      let previousRoute = stored || ref || "/admin";
      if (!previousRoute || previousRoute === currentRoute || DEVELOPMENT_PHASE_ROUTES[previousRoute]) {
        previousRoute = "/admin";
      }
      router.replace(
        `/development-phase?feature=${encodeURIComponent(featureName)}&route=${encodeURIComponent(currentRoute)}&previous=${encodeURIComponent(previousRoute)}`
      );
      return;
    }

    // 3. Feature-disabled route guard
    const role = getCurrentUserRole();
    if (!BYPASS_FEATURE_GUARD_ROLES.has(role) && pathname) {
      const features = getOrgFeatures();
      if (hasNewFeatureFormat(features)) {
        const blockedFeature = getBlockedFeatureName(pathname, features);
        if (blockedFeature) {
          const stored = sessionStorage.getItem("last-safe-route");
          const previousRoute = stored || "/admin";
          router.replace(
            `/feature-disabled?feature=${encodeURIComponent(blockedFeature)}&previous=${encodeURIComponent(previousRoute)}`
          );
          return;
        }
      }
    }

    setIsAuthorized(true);
  }, [router, pathname]);

  if (!isAuthorized) return null;
  return <>{children}</>;
}
