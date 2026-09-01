"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { getApiBaseUrl } from "@/lib/api"

export interface SystemStats {
  cpu: number
  memory: number
  disk: number
  network: number
  services: {
    frontend: { latency: string; status: string; uptime: string }
    backend: { latency: string; status: string; uptime: string }
    database: { latency: string; status: string; uptime: string }
    redis: { latency: string; status: string; uptime: string }
    auth: { latency: string; status: string; uptime: string }
    storage: { latency: string; status: string; uptime: string }
  }
  timestamp: string
}

export function useSystemMonitoring() {
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [history, setHistory] = useState<SystemStats[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const connectWebSocket = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return
    }

    const apiBaseUrl = getApiBaseUrl()
    let wsUrl: string

    if (apiBaseUrl.startsWith('https://')) {
      wsUrl = apiBaseUrl.replace(/^https/, 'wss')
    } else {
      wsUrl = apiBaseUrl.replace(/^http/, 'ws')
    }

    wsUrl = wsUrl.replace(/\/$/, '')
    wsUrl = `${wsUrl}/ws/monitoring/`

    const token = typeof window !== "undefined" ? localStorage.getItem("sis_access_token") : null

    try {
      const urlWithToken = token ? `${wsUrl}?token=${encodeURIComponent(token)}` : wsUrl
      const ws = new WebSocket(urlWithToken)
      wsRef.current = ws

      ws.onopen = () => {
        setIsConnected(true)
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
          reconnectTimeoutRef.current = null
        }
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'system_stats') {
            const newStats = {
                ...data.data,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            }
            setStats(newStats)
            setHistory(prev => {
                const updated = [...prev, newStats]
                if (updated.length > 30) return updated.slice(1)
                return updated
            })
          } else if (data.type === 'system_log') {
            setLogs(prev => {
                const updated = [data.data, ...prev]
                if (updated.length > 100) return updated.slice(0, 100)
                return updated
            })
          }
        } catch (error) {
          // Silent error handling
        }
      }

      ws.onclose = (event) => {
        setIsConnected(false)
        if (event.code !== 1000) {
          if (!reconnectTimeoutRef.current) {
            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectTimeoutRef.current = null
              connectWebSocket()
            }, 5000)
          }
        }
      }

      ws.onerror = () => {
        setIsConnected(false)
      }
    } catch (error) {
      setIsConnected(false)
    }
  }, [])

  useEffect(() => {
    connectWebSocket()
    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000)
        wsRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [connectWebSocket])

  return { stats, history, logs, isConnected }
}
