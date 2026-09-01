"use client"

import { useEffect, useState } from "react"
import { Volume2, VolumeX } from "lucide-react"
import { isNotificationSoundMuted, setNotificationSoundMuted, playTestSound } from "@/lib/notification-sound"

/** Small mute/unmute toggle for the notification sound (persisted in localStorage). */
export function NotificationSoundToggle({ className = "" }: { className?: string }) {
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    setMuted(isNotificationSoundMuted())
  }, [])

  const toggle = () => {
    const next = !muted
    setNotificationSoundMuted(next)
    setMuted(next)
    // When turning sound ON, play a test ding (also unlocks audio for autoplay)
    if (!next) playTestSound()
  }

  return (
    <button
      onClick={toggle}
      title={muted ? "Notification sound off — click to enable & test" : "Notification sound on — click to mute"}
      aria-label={muted ? "Enable notification sound" : "Mute notification sound"}
      className={`flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors ${className}`}
    >
      {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
    </button>
  )
}
