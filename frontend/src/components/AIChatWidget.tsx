"use client"

import { useState, useRef, useEffect } from "react"
import { Bot, Send, MessageSquare, Minimize2, SquarePen, History } from "lucide-react"

interface ConversationItem {
  id: string
  title: string
  updated_at: string
}

function timeAgo(isoStr: string): string {
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000)
  if (diff < 60) return "Abhi"
  if (diff < 3600) return `${Math.floor(diff / 60)} min pehle`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ghante pehle`
  if (diff < 172800) return "Kal"
  return `${Math.floor(diff / 86400)} din pehle`
}

interface Message {
  role: "user" | "assistant"
  content: string
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || ""

function getToken() {
  if (typeof window === "undefined") return ""
  return localStorage.getItem("sis_access_token") || ""
}

const ROLE_LABELS: Record<string, string> = {
  student: "Student",
  teacher: "Teacher",
  coordinator: "Coordinator",
  principal: "Principal",
  org_admin: "Org Admin",
  admin: "Admin",
  superadmin: "Super Admin",
}

function getUserRole(): string | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem("sis_user")
    if (!raw) return null
    return JSON.parse(raw)?.role ?? null
  } catch {
    return null
  }
}

function getUserName(): string | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem("sis_user")
    if (!raw) return null
    const u = JSON.parse(raw)
    if (u?.first_name && u?.last_name) return `${u.first_name} ${u.last_name}`.trim()
    if (u?.first_name) return u.first_name
    if (u?.name) return u.name
    if (u?.username) return u.username
    return null
  } catch {
    return null
  }
}

function getRoleLabel(role: string | null): string {
  if (!role) return "AI Assistant"
  return ROLE_LABELS[role] ?? role
}

function getRoleSuggestions(role: string | null): string[] {
  switch (role) {
    case "student":
      return ["Mere marks dikhao", "Meri attendance", "Final term result"]
    case "teacher":
      return ["Meri class ke students", "Aaj absent kon hai", "Class attendance summary"]
    case "coordinator":
      return ["Mere level ke teachers", "Aaj absent students", "Assigned classrooms"]
    case "principal":
      return ["Aaj absent students", "Aaj add hue students", "Exam results summary", "Kitne transfer hue"]
    case "org_admin":
    case "admin":
      return ["Sab campuses dikhao", "Aaj absent students", "Teachers ki list", "Active students count"]
    default:
      return ["Campus 3 ke active students", "Aaj absent students", "Sab campuses dikhao", "Teachers ki list"]
  }
}

function getWelcomeMessage(role: string | null, name: string | null): string {
  const greeting = name ? `Assalam o Alaikum ${name}!` : "Assalam o Alaikum!"
  switch (role) {
    case "student":
      return `${greeting} Apne marks, attendance ya results ke baare mein poochein.`
    case "teacher":
      return `${greeting} Apni class ke students ya attendance ke baare mein poochein.`
    case "coordinator":
      return `${greeting} Apne level ke teachers, students ya attendance ke baare mein poochein.`
    case "principal":
    case "org_admin":
    case "admin":
      return `${greeting} Students, teachers, attendance, campuses — kuch bhi poochein.`
    default:
      return `${greeting} Main aapka AI assistant hun. Kuch bhi poochein.`
  }
}

const CONV_STORAGE_KEY = "sis_ai_conversation_id"

export default function AIChatWidget() {
  const role = getUserRole()
  const name = getUserName()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: getWelcomeMessage(role, name) },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [conversationId, setConversationId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null
    return localStorage.getItem(CONV_STORAGE_KEY)
  })
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load history on mount if conversation exists
  useEffect(() => {
    const savedId = localStorage.getItem(CONV_STORAGE_KEY)
    if (!savedId) return
    fetch(`${API_BASE}/api/ai/chat/history/?conversation_id=${savedId}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.messages?.length) {
          setMessages([
            { role: "assistant", content: getWelcomeMessage(role, name) },
            ...data.messages.map((m: { role: string; content: string }) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
          ])
          setConversationId(data.conversation_id)
        }
      })
      .catch(() => {})
  }, [])

  // Persist conversationId to localStorage whenever it changes
  useEffect(() => {
    if (conversationId) localStorage.setItem(CONV_STORAGE_KEY, conversationId)
  }, [conversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  function loadConversations() {
    fetch(`${API_BASE}/api/ai/chat/conversations/`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((data) => setConversations(Array.isArray(data) ? data : []))
      .catch(() => {})
  }

  function openHistory() {
    loadConversations()
    setShowHistory(true)
  }

  function loadConversation(id: string) {
    fetch(`${API_BASE}/api/ai/chat/history/?conversation_id=${id}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.messages?.length) {
          setMessages([
            { role: "assistant", content: getWelcomeMessage(role, name) },
            ...data.messages.map((m: { role: string; content: string }) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
          ])
          setConversationId(data.conversation_id)
          localStorage.setItem(CONV_STORAGE_KEY, data.conversation_id)
        }
        setShowHistory(false)
      })
      .catch(() => {})
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text || loading) return

    setInput("")
    setMessages((prev) => [...prev, { role: "user", content: text }])
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE}/api/ai/chat/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ message: text, conversation_id: conversationId }),
      })

      if (res.status === 429) {
        const data = await res.json()
        const msg = data.message || "Aaj ka AI quota khatam ho gaya hai. Kal dobara try karein."
        setMessages((prev) => [...prev, { role: "assistant", content: msg }])
        return
      }

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let firstChunk = true

      outer: while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const data = line.slice(6).trim()
          if (data === "[DONE]") break outer

          try {
            const parsed = JSON.parse(data)

            if (parsed.error) {
              let errMsg: string = parsed.error
              if (errMsg.includes("503")) {
                errMsg = "AI service abhi busy hai. Thodi der baad dobara koshish karein."
              } else if (errMsg.includes("429")) {
                errMsg = "Bahut zyada requests aa gayi hain. 1 minute baad dobara koshish karein."
              }
              firstChunk = false
              setLoading(false)
              setMessages((prev) => [...prev, { role: "assistant", content: errMsg }])
              break outer
            }

            if (parsed.conversation_id) {
              setConversationId(parsed.conversation_id)
            }

            if (parsed.chunk) {
              if (firstChunk) {
                firstChunk = false
                setLoading(false)
                setMessages((prev) => [...prev, { role: "assistant", content: parsed.chunk }])
              } else {
                setMessages((prev) => {
                  const msgs = [...prev]
                  const last = msgs[msgs.length - 1]
                  msgs[msgs.length - 1] = { ...last, content: last.content + parsed.chunk }
                  return msgs
                })
              }
            }
          } catch {
            // ignore malformed JSON chunks
          }
        }
      }

      if (firstChunk) {
        setMessages((prev) => [...prev, { role: "assistant", content: "Jawab nahi mila." }])
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Network error. Dobara koshish karein." },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const suggestions = getRoleSuggestions(role)

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#6096ba] text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-[#4a7ba0] transition-all hover:scale-110 active:scale-95"
          title="AI Assistant"
        >
          <Bot className="w-6 h-6" />
        </button>
      )}

      {/* Chat Window */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-6rem)] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-gray-100 animate-in slide-in-from-bottom-4 fade-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 bg-[#6096ba] text-white flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-sm leading-tight">AI Assistant</p>
                <p className="text-[10px] text-blue-100 font-medium">{getRoleLabel(role)}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={openHistory}
                className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
                title="Chat History"
              >
                <History className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setMessages([{ role: "assistant", content: getWelcomeMessage(role, name) }])
                  setConversationId(null)
                  setShowHistory(false)
                  localStorage.removeItem(CONV_STORAGE_KEY)
                }}
                className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
                title="New Chat"
              >
                <SquarePen className="w-4 h-4" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* History Panel */}
          {showHistory && (
            <div className="flex-1 overflow-y-auto bg-white">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">Past Conversations</p>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-xs text-[#6096ba] hover:underline"
                >
                  Back
                </button>
              </div>
              {conversations.length === 0 ? (
                <p className="text-center text-sm text-gray-400 mt-10">Koi history nahi mili.</p>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {conversations.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => loadConversation(c.id)}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                          c.id === conversationId ? "bg-[#6096ba]/10 border-l-2 border-[#6096ba]" : ""
                        }`}
                      >
                        <p className="text-sm font-medium text-gray-800 truncate">{c.title}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{timeAgo(c.updated_at)}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Messages */}
          <div className={`flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50/50 ${showHistory ? "hidden" : ""}`}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 bg-[#6096ba] rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-[#6096ba] text-white rounded-br-md"
                      : "bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-md"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="w-7 h-7 bg-[#6096ba] rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-white border border-gray-100 px-4 py-3.5 rounded-2xl rounded-bl-md shadow-sm flex items-center gap-1">
                  <span className="w-2 h-2 bg-[#6096ba] rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 bg-[#6096ba] rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 bg-[#6096ba] rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}

            {/* Suggestions — only show at start */}
            {messages.length === 1 && !loading && (
              <div className="pt-1">
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-2 ml-9">Quick queries</p>
                <div className="flex flex-wrap gap-2 ml-9">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => { setInput(s); inputRef.current?.focus() }}
                      className="text-xs bg-white border border-[#6096ba]/30 text-[#6096ba] px-3 py-1.5 rounded-full hover:bg-[#6096ba]/10 transition-colors font-medium"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          {!showHistory && <div className="px-4 py-3 border-t border-gray-100 bg-white flex-shrink-0">
            <div className="flex items-center gap-2 bg-gray-50 rounded-2xl px-4 py-2.5 border border-gray-200 focus-within:border-[#6096ba]/50 focus-within:ring-2 focus-within:ring-[#6096ba]/10 transition-all">
              <MessageSquare className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Kuch bhi poochein..."
                className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"
                disabled={loading}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="w-8 h-8 bg-[#6096ba] text-white rounded-full flex items-center justify-center disabled:opacity-40 hover:bg-[#4a7ba0] transition-colors flex-shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>}
        </div>
      )}
    </>
  )
}
