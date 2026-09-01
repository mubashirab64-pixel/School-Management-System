/**
 * Standard delta-based notification sound manager.
 *
 * - Plays a short sound ONCE when genuinely new notification(s) arrive
 *   (compared to a persisted last-seen id) — never on plain refresh.
 * - Debounces bursts so 5 notifications in 1s = 1 sound.
 * - Cross-tab + rapid-burst guard via a shared localStorage timestamp.
 * - Respects a user mute toggle.
 * - Unlocks audio on the first user gesture (browser autoplay policy).
 */

const AUDIO_SRC = "/notification_audio/ping_notification.mp3"
const LS_LAST_SEEN = "notif_sound_last_seen"
const LS_LAST_PLAYED = "notif_sound_last_played"
const LS_MUTED = "notif_sound_muted"
const DEBOUNCE_MS = 1200
const CROSS_TAB_GUARD_MS = 1500

let audio: HTMLAudioElement | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let unlockBound = false
let initialized = false

function getAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null
  if (!audio) {
    audio = new Audio(AUDIO_SRC)
    audio.preload = "auto"
  }
  return audio
}

export function isNotificationSoundMuted(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(LS_MUTED) === "1"
}

export function setNotificationSoundMuted(muted: boolean) {
  if (typeof window === "undefined") return
  localStorage.setItem(LS_MUTED, muted ? "1" : "0")
}

/** Clear the baseline — call on login/logout so a new user starts fresh. */
export function resetNotificationSound() {
  if (typeof window === "undefined") return
  localStorage.removeItem(LS_LAST_SEEN)
  initialized = false
}

/** Bind a one-time unlock on the first user gesture (autoplay policy). */
export function setupNotificationAudioUnlock() {
  if (typeof window === "undefined" || unlockBound) return
  unlockBound = true
  const unlock = () => {
    const a = getAudio()
    if (a) {
      const v = a.volume
      a.volume = 0
      a.play()
        .then(() => {
          a.pause()
          a.currentTime = 0
          a.volume = v
        })
        .catch(() => {
          a.volume = v
        })
    }
    window.removeEventListener("pointerdown", unlock)
    window.removeEventListener("keydown", unlock)
  }
  window.addEventListener("pointerdown", unlock, { once: true })
  window.addEventListener("keydown", unlock, { once: true })
}

function actuallyPlay() {
  if (isNotificationSoundMuted()) {
    console.debug("[notif-sound] skipped: muted")
    return
  }
  const now = Date.now()
  const lastPlayed = Number(localStorage.getItem(LS_LAST_PLAYED) || "0")
  // Another tab (or an immediate burst) just played — skip.
  if (now - lastPlayed < CROSS_TAB_GUARD_MS) {
    console.debug("[notif-sound] skipped: cross-tab/burst guard")
    return
  }
  localStorage.setItem(LS_LAST_PLAYED, String(now))
  const a = getAudio()
  if (!a) return
  try {
    a.currentTime = 0
    a.play()
      .then(() => console.debug("[notif-sound] played ✓"))
      .catch((err) => console.warn("[notif-sound] play blocked (autoplay?) — click the page once:", err?.name || err))
  } catch (err) {
    console.warn("[notif-sound] play threw:", err)
  }
}

/** Explicit user-triggered test (always within a gesture → always allowed).
 *  Also unlocks the audio element for future programmatic plays. */
export function playTestSound() {
  const a = getAudio()
  if (!a) return
  try {
    a.currentTime = 0
    a.play()
      .then(() => console.debug("[notif-sound] test played ✓ (audio unlocked)"))
      .catch((err) => console.warn("[notif-sound] test play failed:", err?.name || err))
  } catch (err) {
    console.warn("[notif-sound] test threw:", err)
  }
}

function getLastSeen(): number {
  const v = Number(localStorage.getItem(LS_LAST_SEEN) || "0")
  return Number.isFinite(v) ? v : 0
}

/**
 * Delta trigger. Pass the current notification IDs (or a single new ID).
 * Plays at most one sound per burst, only for IDs newer than last-seen,
 * and never on the first baseline load or a plain refresh.
 */
export function notifyNotificationIds(ids: Array<number | undefined | null>) {
  if (typeof window === "undefined") return
  const nums = ids.filter((x): x is number => typeof x === "number" && Number.isFinite(x))
  if (!nums.length) return
  const maxId = Math.max(...nums)
  const lastSeen = getLastSeen()

  // First time ever (no stored baseline) → set baseline silently.
  if (!initialized && lastSeen === 0) {
    initialized = true
    localStorage.setItem(LS_LAST_SEEN, String(maxId))
    console.debug("[notif-sound] baseline set (no sound):", maxId)
    return
  }
  initialized = true

  if (maxId > lastSeen) {
    console.debug("[notif-sound] NEW notification → scheduling sound. maxId:", maxId, "lastSeen:", lastSeen)
    localStorage.setItem(LS_LAST_SEEN, String(maxId))
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      actuallyPlay()
    }, DEBOUNCE_MS)
  } else {
    console.debug("[notif-sound] no new (maxId <= lastSeen):", maxId, lastSeen)
  }
}
