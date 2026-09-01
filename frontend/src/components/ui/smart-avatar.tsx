"use client"

import React from "react"

interface SmartAvatarProps {
  src?: string | null
  name?: string | null
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl"
  className?: string
  ringClass?: string
  textSizeOverride?: string
}

const SIZE_MAP = {
  xs:    { container: "w-7 h-7",   text: "text-xs"   },
  sm:    { container: "w-9 h-9",   text: "text-sm"   },
  md:    { container: "w-11 h-11", text: "text-base" },
  lg:    { container: "w-16 h-16", text: "text-xl"   },
  xl:    { container: "w-24 h-24", text: "text-2xl"  },
  "2xl": { container: "w-32 h-32", text: "text-4xl"  },
}

/**
 * SmartAvatar
 * - Shows profile photo when src is provided
 * - Falls back to circular initials avatar (up to 2 letters)
 * - Uses Tailwind `bg-primary` (#365486 from tailwind.config.ts)
 * - Fully reusable across sidebar, navbar, and profile hero
 */
export function SmartAvatar({
  src,
  name,
  size = "md",
  className = "",
  ringClass = "",
  textSizeOverride,
}: SmartAvatarProps) {
  const { container, text } = SIZE_MAP[size]

  const initials = React.useMemo(() => {
    if (!name) return "?"
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0][0].toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }, [name])

  const base = `relative flex-shrink-0 rounded-full overflow-hidden select-none ${container} ${ringClass} ${className}`

  // If src is a relative /media/ path, prepend the Django backend base URL
  const resolvedSrc = React.useMemo(() => {
    if (!src) return null
    if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("blob:")) return src
    const apiBase =
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      (typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname}:8000` : "")
    return `${apiBase}${src.startsWith("/") ? "" : "/"}${src}`
  }, [src])

  if (resolvedSrc) {
    return (
      <div className={base}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={resolvedSrc} alt={name ?? "avatar"} className="w-full h-full object-cover" />
      </div>
    )
  }

  return (
    <div className={`${base} flex items-center justify-center font-bold text-white bg-primary`}>
      <span className={textSizeOverride ?? text}>{initials}</span>
    </div>
  )
}

export default SmartAvatar
