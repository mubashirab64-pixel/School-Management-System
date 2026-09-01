"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function AuditorRoot() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/auditor/dashboard")
  }, [router])
  return null
}
