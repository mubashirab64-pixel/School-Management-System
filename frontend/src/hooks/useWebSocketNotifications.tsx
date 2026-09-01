"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { toast } from "sonner"
import type { Notification } from "@/types/notification"
import { getApiBaseUrl } from "@/lib/api"
import { setupNotificationAudioUnlock, notifyNotificationIds } from "@/lib/notification-sound"

interface WebSocketNotification {
  id: number
  verb: string
  target_text: string
  actor_name?: string
  timestamp: string
  data: Record<string, any>
  unread: boolean
}

const HIDDEN_KEY = 'sis_hidden_notifications'

// Module-level (shared across all hook instances in this tab) toast watermark,
// so the bell + the notifications page don't each fire their own toast.
let toastWatermarkId = 0
let toastInitialized = false

export function useWebSocketNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [hiddenIds, setHiddenIds] = useState<number[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [usePolling, setUsePolling] = useState(false)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const manualCloseRef = useRef(false)
  const consecutiveFailuresRef = useRef(0)
  const backendHintShownRef = useRef(false)
  const MAX_FAILURES_BEFORE_POLLING = 3
  // Show a toast for newly-arrived notifications (delta-based; never for the
  // already-present items on first load). Uses a module-level watermark so the
  // bell + the notifications page (two hook instances) never double-toast.
  const toastForNewNotifications = useCallback((items: Notification[]) => {
    if (!Array.isArray(items) || !items.length) return
    const numIds = items
      .map((n) => n.id)
      .filter((x): x is number => typeof x === "number")
    if (!numIds.length) return
    const maxId = Math.max(...numIds)
    if (!toastInitialized) {
      toastInitialized = true
      toastWatermarkId = maxId
      return // baseline — no toast for items already present on load
    }
    const fresh = items.filter(
      (n) => typeof n.id === "number" && (n.id as number) > toastWatermarkId,
    )
    if (!fresh.length) return
    toastWatermarkId = maxId
    const top = fresh[0] // list is newest-first
    toast(top.actor_name || "New notification", {
      description: `${top.verb || ""}${top.target_text ? " — " + top.target_text : ""}`.trim(),
    })
    if (fresh.length > 1) {
      toast(`+${fresh.length - 1} more notification${fresh.length - 1 > 1 ? "s" : ""}`)
    }
  }, [])

  const describeReadyState = (state: number) => {
    switch (state) {
      case WebSocket.CONNECTING:
        return 'CONNECTING (0)'
      case WebSocket.OPEN:
        return 'OPEN (1)'
      case WebSocket.CLOSING:
        return 'CLOSING (2)'
      case WebSocket.CLOSED:
        return 'CLOSED (3)'
      default:
        return `UNKNOWN (${state})`
    }
  }

  // Load hidden IDs from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(HIDDEN_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as number[]
        if (Array.isArray(parsed)) {
          setHiddenIds(parsed)
        }
      }
    } catch (error) {
      console.error('Error loading hidden notifications from localStorage:', error)
    }
  }, [])

  const connectWebSocket = useCallback(() => {
    const token = localStorage.getItem('sis_access_token')
    if (!token) {
      console.log('No authentication token found for WebSocket')
      return
    }

    // Don't reconnect if already connected
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return
    }

    // Close existing connection if any
    if (wsRef.current) {
      manualCloseRef.current = true
      wsRef.current.close()
      wsRef.current = null
    }

    // Get WebSocket URL (convert http/https to ws/wss)
    const apiBaseUrl = getApiBaseUrl()
    let wsUrl: string

    if (apiBaseUrl.startsWith('https://')) {
      wsUrl = apiBaseUrl.replace(/^https/, 'wss')
    } else {
      wsUrl = apiBaseUrl.replace(/^http/, 'ws')
    }

    // Remove trailing slash if present
    wsUrl = wsUrl.replace(/\/$/, '')

    // Add WebSocket path and token
    wsUrl = `${wsUrl}/ws/notifications/?token=${encodeURIComponent(token)}`

    // console.log('🔌 Connecting to WebSocket:', wsUrl.replace(token, 'TOKEN'))
    // console.log('📍 API Base URL:', apiBaseUrl)

    try {
      manualCloseRef.current = false
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        // console.log('✅ WebSocket connected successfully')
        setIsConnected(true)
        consecutiveFailuresRef.current = 0
        setUsePolling((prev) => {
          if (prev) {
            // console.log('🔁 WebSocket recovered - disabling polling fallback')
          }
          return false
        })
        // Clear any reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
          reconnectTimeoutRef.current = null
        }
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === 'pong') {
            // Respond to ping
            return
          }

          // Handle notification message
          if (data.id && data.verb) {
            const notification: WebSocketNotification = data

            // Add to notifications list (avoid duplicates)
            setNotifications((prev) => {
              const exists = prev.find(n => n.id === notification.id)
              if (exists) return prev
              return [notification as Notification, ...prev]
            })
            setUnreadCount((prev) => prev + 1)

            // Play notification sound for this newly-arrived item (delta-based)
            notifyNotificationIds([notification.id])

            // Show toast notification (live arrival → always toast),
            // and bump the watermark so fetch/polling don't re-toast it.
            if (typeof notification.id === 'number') {
              toastInitialized = true
              toastWatermarkId = Math.max(toastWatermarkId, notification.id)
            }
            toast(notification.actor_name || 'System', {
              description: `${notification.verb} ${notification.target_text}`,
              duration: 5000,
            })
          }
          // Handle audit log updates (real-time fetch trigger)
          else if (data.event_type === 'audit_log_created') {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('sis-audit-log-new', { 
                detail: { feature: data.feature, action: data.action } 
              }))
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      ws.onerror = (error) => {
        if (manualCloseRef.current) {
          return
        }

        const maskedUrl = wsUrl.replace(token, 'TOKEN')
        const readyStateLabel = describeReadyState(ws.readyState)

        const payload: Record<string, unknown> = {
          type: error?.type,
          message: (error as ErrorEvent)?.message,
          url: maskedUrl,
          readyState: readyStateLabel,
        }

        if (error instanceof CloseEvent) {
          payload.code = error.code
          payload.reason = error.reason
          payload.wasClean = error.wasClean
        }

        // console.warn('⚠️ WebSocket transient issue detected', payload)

        setIsConnected(false)
      }

      ws.onclose = (event) => {
        const closeReasons: Record<number, string> = {
          1000: 'Normal closure',
          1001: 'Going away',
          1002: 'Protocol error',
          1003: 'Unsupported data',
          1006: 'Abnormal closure',
          1007: 'Invalid data',
          1008: 'Policy violation',
          1009: 'Message too big',
          1010: 'Extension error',
          1011: 'Internal error',
          4001: 'No token provided',
          4003: 'Authentication failed',
        }

        /* console.log('🔌 WebSocket disconnected', {
          code: event.code,
          reason: event.reason || closeReasons[event.code] || 'Unknown',
          wasClean: event.wasClean,
          readyState: ws.readyState
        }) */

        setIsConnected(false)

        if (manualCloseRef.current) {
          manualCloseRef.current = false
          return
        }

        // Don't reconnect on authentication errors (4003) or no token (4001)
        if (event.code === 4001 || event.code === 4003) {
          console.error('🚫 Authentication failed - not reconnecting')
          return
        }

        if (event.code !== 1000) {
          consecutiveFailuresRef.current += 1

          if (consecutiveFailuresRef.current >= MAX_FAILURES_BEFORE_POLLING) {
            // console.warn('⚠️ WebSocket connection failed repeatedly - falling back to polling')
            setUsePolling(true)
            if (!backendHintShownRef.current) {
              /* console.info(
                '💡 Check that the ASGI server is running (e.g. daphne -b 0.0.0.0 -p 8000 backend.asgi:application)'
              ) */
              backendHintShownRef.current = true
            }
            return
          }

          if (!reconnectTimeoutRef.current) {
            // console.log('🔄 WebSocket will attempt to reconnect in 3 seconds...')
            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectTimeoutRef.current = null
              connectWebSocket()
            }, 3000)
          }
        }
      }
    } catch (error) {
      console.error('❌ Error creating WebSocket connection:', error)
      setIsConnected(false)
    }
  }, [])

  const disconnectWebSocket = useCallback(() => {
    if (wsRef.current) {
      manualCloseRef.current = true
      wsRef.current.close()
      wsRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    consecutiveFailuresRef.current = 0
  }, [])

  // Send ping to keep connection alive
  useEffect(() => {
    if (!isConnected || !wsRef.current) return

    const pingInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000)

    return () => clearInterval(pingInterval)
  }, [isConnected])

  // Polling fallback when WebSocket is not available
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const token = localStorage.getItem('sis_access_token')
        if (!token) return

        const response = await fetch(`${getApiBaseUrl()}/api/notifications/`, {
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })

        if (response.ok) {
          const data = await response.json()
          const notificationsList = Array.isArray(data) ? data : (data.results || [])
          const visible = notificationsList.filter(
            (n: Notification) => !hiddenIds.includes(n.id),
          )
          setNotifications(visible)
          const unreadCount = visible.filter((n: Notification) => n.unread === true).length
          setUnreadCount(unreadCount)
          // Delta-based sound + toast on the polling fallback (WS down)
          notifyNotificationIds(visible.map((n: Notification) => n.id))
          toastForNewNotifications(visible)
        }
      } catch (error) {
        console.error('Error polling notifications:', error)
      }
    }, 15000)
  }, [hiddenIds, toastForNewNotifications])

  useEffect(() => {
    if (usePolling) {
      startPolling()
      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
        }
      }
    } else {
      connectWebSocket()
      return () => {
        disconnectWebSocket()
      }
    }
  }, [connectWebSocket, disconnectWebSocket, usePolling, startPolling])

  const fetchNotifications = useCallback(async () => {
    try {
      const token = localStorage.getItem('sis_access_token')
      if (!token) {
        return
      }

      const response = await fetch(`${getApiBaseUrl()}/api/notifications/`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        const notificationsList = Array.isArray(data) ? data : (data.results || [])
        const visible = notificationsList.filter(
          (n: Notification) => !hiddenIds.includes(n.id),
        )
        setNotifications(visible)
        const unreadCount = visible.filter((n: Notification) => n.unread === true).length
        setUnreadCount(unreadCount)
        // Delta-based sound + toast: baseline on first load, only for genuinely new ids
        notifyNotificationIds(visible.map((n: Notification) => n.id))
        toastForNewNotifications(visible)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }, [hiddenIds, toastForNewNotifications])

  const markAsRead = useCallback(async (notificationId: number) => {
    try {
      const token = localStorage.getItem('sis_access_token')
      if (!token) {
        return
      }

      const response = await fetch(`${getApiBaseUrl()}/api/notifications/${notificationId}/mark_read/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, unread: false } : n)),
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
        await fetchNotifications()
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sis-notifications-sync'))
        }
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }, [fetchNotifications])

  const markAllAsRead = useCallback(async () => {
    try {
      const token = localStorage.getItem('sis_access_token')
      if (!token) {
        return
      }

      const response = await fetch(`${getApiBaseUrl()}/api/notifications/mark_all_read/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        // Update all notifications to mark as read
        setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })))
        setUnreadCount(0)
        // Refetch to ensure state is in sync with backend
        await fetchNotifications()
        // Broadcast to other hook instances
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sis-notifications-sync'))
        }
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    }
  }, [fetchNotifications])

  useEffect(() => {
    setupNotificationAudioUnlock()
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const removeNotificationsLocal = useCallback((ids: number[]) => {
    setHiddenIds(prev => {
      const merged = Array.from(new Set([...prev, ...ids]))
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(HIDDEN_KEY, JSON.stringify(merged))
      }
      return merged
    })

    setNotifications(prev => {
      const remaining = prev.filter(n => !ids.includes(n.id))
      const unread = remaining.filter(n => n.unread).length
      setUnreadCount(unread)
      return remaining
    })
  }, [])

  const clearAllLocal = useCallback(() => {
    // Hide all current notifications so they don't come back on refresh
    setHiddenIds(prev => {
      const allIds = notifications.map(n => n.id)
      const merged = Array.from(new Set([...prev, ...allIds]))
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(HIDDEN_KEY, JSON.stringify(merged))
      }
      return merged
    })
    setNotifications([])
    setUnreadCount(0)
  }, [notifications])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handler = () => {
      fetchNotifications()
    }

    window.addEventListener('sis-notifications-sync', handler)
    return () => {
      window.removeEventListener('sis-notifications-sync', handler)
    }
  }, [fetchNotifications])

  return {
    notifications,
    unreadCount,
    isConnected,
    refetch: fetchNotifications,
    markAsRead,
    markAllAsRead,
    removeNotificationsLocal,
    clearAllLocal,
  }
}

