# AI Chat Assistant — Architecture

## Overview

SMS ka built-in AI chat assistant users ko natural language mein school data query karne deta hai — students, teachers, attendance, aur campuses ke baare mein. System Google Gemini ke **Function Calling** feature par based hai.

---

## High-Level Flow

```
User (Browser)
     │
     │  POST /api/ai/chat/   { message: "..." }
     ▼
┌─────────────────────────────────────┐
│         Django Backend              │
│                                     │
│  1. User message → Gemini (Round 1) │
│     + Function Declarations         │
│                                     │
│  2. Gemini returns functionCall     │
│     e.g. get_students(campus=...)   │
│                                     │
│  3. _execute_tool() → Django ORM    │
│     → Real DB query                 │
│                                     │
│  4. Tool result → Gemini (Round 2)  │
│                                     │
│  5. Gemini returns final text reply │
└─────────────────────────────────────┘
     │
     │  { reply: "Campus 3 mein 240 active students hain." }
     ▼
User (Browser)
```

---

## Components

### 1. Frontend — `AIChatWidget.tsx`

**Location:** `frontend/src/components/AIChatWidget.tsx`

| Element | Description |
|---|---|
| Floating Bot Button | Screen ke bottom-right mein fixed; click karo to open |
| Chat Window | 380×560px popup; animated slide-in |
| Message History | Local React state mein — page refresh par reset hoti hai |
| Quick Suggestions | Pehli message ke baad 4 shortcut queries dikhata hai |
| Input Bar | Enter key ya Send button se message bhejta hai |

**Auth:** `localStorage` se `sis_access_token` utha ke `Authorization: Bearer` header mein bhejta hai.

**Integration:** `frontend/src/app/admin/layout.tsx` mein mount kiya gaya hai — poore admin panel mein available.

---

### 2. Backend API — `ai_chat/views.py`

**Endpoint:** `POST /api/ai/chat/`
**Auth:** `IsAuthenticated` (JWT required)

#### Request / Response

```
Request:  { "message": "Campus 3 ke absent students" }
Response: { "reply": "Aaj Campus 3 mein 18 students absent hain..." }
```

#### Two-Round Gemini Call

```
Round 1:
  Input:  user message + FUNCTION_DECLARATIONS + SYSTEM_PROMPT
  Output: functionCall  (ya direct text)

Round 2:  (sirf agar function call aya)
  Input:  Round 1 conversation + tool result
  Output: final text reply
```

---

### 3. AI Model

| Property | Value |
|---|---|
| Provider | Google Gemini |
| Model | `gemini-2.5-flash` |
| API | `generativelanguage.googleapis.com/v1beta` |
| Config Key | `settings.GEMINI_API_KEY` |
| Timeout | 25s request, 28s thread |

**Note:** API call `urllib.request` se ki jati hai (koi extra SDK nahi).

---

### 4. Function Declarations (Tools)

Gemini ko 5 tools available hain:

| Tool Name | Kya karta hai |
|---|---|
| `get_students` | Students list with filters (campus, grade, gender, state) |
| `get_absent_students` | Kisi date ke absent students |
| `get_attendance_summary` | Attendance stats (present/absent/percentage) |
| `get_teachers` | Teachers list with campus filter |
| `get_campus_list` | Sab campuses + student/teacher counts |

---

### 5. Tool Execution — `_execute_tool()`

Har tool call:
1. `request.user` se `organization` nikalta hai (multi-tenant isolation)
2. Django ORM se real database query karta hai
3. JSON-serializable dict return karta hai

**Campus Resolution (`_resolve_campus`):**
User "Campus 3" likhta hai → function `campus_name` mein string deta hai → `_resolve_campus` DB mein `campus_name__icontains` ya `campus_code__icontains` se actual `campus_id` dhundta hai.

---

### 6. System Prompt

```
SYSTEM_PROMPT rules:
- Hamesha function call karo pehle, phir jawab do
- User ki language mein jawab do (Roman Urdu / Urdu / English)
- Today's date inject hoti hai runtime par
- "active students" = current_state=active (Alumni excluded)
```

---

## Data Flow Diagram (Detailed)

```
Browser
  │
  │ 1. POST /api/ai/chat/ { message }
  │    Bearer JWT
  ▼
Django AIChatView
  │
  │ 2. Build: contents=[user msg]
  │           tools=FUNCTION_DECLARATIONS
  │           system=SYSTEM_PROMPT
  │
  │ 3. _gemini_call() → Gemini API (Round 1)
  ▼
Gemini 2.5 Flash
  │
  │ 4. Returns: functionCall { name, args }
  ▼
Django _execute_tool()
  │
  │ 5. ORM query → PostgreSQL
  │    (multi-tenant: filter by organization)
  │
  │ 6. Returns: { total, students: [...] }
  ▼
Django AIChatView
  │
  │ 7. Append functionResponse to contents
  │
  │ 8. _gemini_call() → Gemini API (Round 2)
  ▼
Gemini 2.5 Flash
  │
  │ 9. Returns: natural language reply
  ▼
Django AIChatView
  │
  │ 10. Response: { reply: "..." }
  ▼
Browser — message display
```

---

## File Structure

```
backend/
└── ai_chat/
    ├── __init__.py
    ├── apps.py
    ├── urls.py          ← POST chat/ endpoint register
    └── views.py         ← Gemini call + tool execution (main logic)

frontend/src/
└── components/
    └── AIChatWidget.tsx ← Floating chat UI
```

**URL Registration:**
- `backend/backend/urls.py` → `path("api/ai/", include("ai_chat.urls"))`
- `backend/backend/settings.py` → `INSTALLED_APPS` mein `"ai_chat"` added

---

## Limitations & Future Improvements

| Limitation | Detail |
|---|---|
| No conversation memory | Har message stateless hai — history backend tak nahi jati |
| No streaming | Poora reply ek saath aata hai, token-by-token nahi |
| No chat history persistence | Page refresh par sab messages reset |
| Single-turn tool calling | Sirf ek function call per message handle hoti hai |
| No role-based tool restriction | Sab authenticated users sab tools use kar sakte hain |

---

## Environment Config

```python
# backend/backend/settings.py
GEMINI_API_KEY = env("GEMINI_API_KEY")
```

```env
# .env
GEMINI_API_KEY=your_google_gemini_api_key
```
