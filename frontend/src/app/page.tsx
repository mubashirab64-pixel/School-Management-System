"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is already logged in
    if (typeof window !== "undefined") {
      const user = window.localStorage.getItem("sis_user");
      if (user) {
        // User is logged in, redirect to admin
        router.push('/admin');
      } else {
        // User is not logged in, redirect to login page
        router.push('/login');
      }
    }
  }, [router]);

  // Show loading or nothing while checking authentication
  return <LoadingSpinner message="Redirecting..." fullScreen />;
}

