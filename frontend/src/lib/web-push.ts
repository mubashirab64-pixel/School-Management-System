import { getApiBaseUrl } from "@/lib/api"

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

let inFlight = false

/**
 * Registers the service worker, asks for notification permission (once),
 * subscribes to Web Push, and sends the subscription to the backend.
 * Safe to call repeatedly — it no-ops if unsupported, no token, or already done.
 */
export async function registerWebPush(): Promise<void> {
  if (typeof window === "undefined" || inFlight) return
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return

  const token = localStorage.getItem("sis_access_token")
  if (!token) return

  inFlight = true
  try {
    const reg = await navigator.serviceWorker.register("/sw.js")
    await navigator.serviceWorker.ready

    let permission = Notification.permission
    if (permission === "default") {
      permission = await Notification.requestPermission()
    }
    if (permission !== "granted") return

    const base = getApiBaseUrl().replace(/\/$/, "")

    const keyRes = await fetch(`${base}/api/push/vapid-public-key/`)
    if (!keyRes.ok) return
    const { publicKey } = await keyRes.json()
    if (!publicKey) return

    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      })
    }

    await fetch(`${base}/api/push/subscribe/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(sub.toJSON()),
    })
  } catch {
    /* silent — web push is best-effort */
  } finally {
    inFlight = false
  }
}

/** Remove the current subscription (e.g., on logout). */
export async function unregisterWebPush(): Promise<void> {
  if (typeof window === "undefined") return
  if (!("serviceWorker" in navigator)) return
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (!sub) return
    const token = localStorage.getItem("sis_access_token")
    const base = getApiBaseUrl().replace(/\/$/, "")
    await fetch(`${base}/api/push/unsubscribe/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => {})
    await sub.unsubscribe().catch(() => {})
  } catch {
    /* silent */
  }
}
