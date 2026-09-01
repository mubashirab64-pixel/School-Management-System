# Teacher Attendance System — ZKTeco uFace 800 Integration Plan
> **Urdu Roman Documentation** | SMS School Management System  
> **Machine:** ZKTeco uFace 800 (Face + Fingerprint + Card)  
> **Date:** April 2026

---

## 1. OVERVIEW — Yeh Kya Hai?

Is document mein ham teacher attendance ko **2 tareekon** se implement karne ka pura plan explain karein ge:

| Tareeqa | Description |
|---------|-------------|
| **Method 1: ZKTeco Machine** | Physical biometric device se real-time attendance |
| **Method 2: Manual Marking** | Admin/Principal web interface se manually mark karna |

**Machine:** ZKTeco uFace 800
- Face Recognition
- Fingerprint Scanner
- RFID Card Reader
- Built-in WiFi/Ethernet
- SDK available (ZKTeco provides free SDK)

---

## 2. CURRENT SYSTEM KI HALAT

```
JO ABHI HAI:
✅ Student attendance (complete)
✅ Teacher → Student attendance mark karna
✅ Holiday/Weekend management
✅ Coordinator review + approval workflow
✅ JWT authentication
✅ Multi-campus support

JO ABHI NAHI HAI:
❌ Teacher ki apni attendance
❌ ZKTeco machine integration
❌ Teacher punch in/out tracking
❌ Teacher leave management
❌ Staff attendance dashboard
```

---

## 3. ZKTECO MACHINE KO INTEGRATE KARNE KE TAREEQE

### Method A — PUSH API (REAL-TIME) ⭐ BEST OPTION

```
HOW IT WORKS:
ZKTeco Machine → [Punch hoti hai] → Machine khud API call karti hai → 
Hamara Backend receive karta hai → Database mein save → 
Frontend real-time update hota hai
```

**Kaise kaam karta hai:**
- ZKTeco uFace 800 mein ek feature hota hai: **"PUSH Protocol"** ya **"Real-Time Monitor"**
- Machine ke andar hamara server ka URL configure karte hain
- Jab bhi koi teacher punch kare, machine **automatically** POST request bhejti hai
- Hamara Django backend us request ko receive karta hai

**Machine Configuration (ek baar karna hai):**
```
Machine Settings > Communication > HTTP Server:
- Server: https://sms.idaraalkhair.sbs/api/attendance/zkteco/push/
- Port: 443
- Username: zkteco_api
- Password: [secret_key]
```

**Pros:**
- Real-time — punch hone ke 1-2 second mein system update
- Machine internet ho toh kahi se bhi kaam karta hai
- Free (machine ka built-in feature)
- Internet cut ho toh machine locally store karti hai, baad mein sync

**Cons:**
- Machine ko server se network connection chahiye
- Network configuration thodi complicated hai

---

### Method B — PULL API (POLLING) 

```
HOW IT WORKS:
Hamara Backend (har X minutes) → Machine se data maangta hai → 
Machine respond karti hai → Backend save karta hai
```

**Kaise kaam karta hai:**
- ZKTeco ka **ADMS** (Advanced Desk Management System) use karte hain
- Ya seedha machine ka **ZKTeco SDK** use karte hain
- Backend ek scheduler (Celery Beat) se har 5-10 minute mein machine ko poll karta hai
- Machine apna attendance log return karti hai

**Python SDK Usage:**
```python
# pyzk library (free, open source)
from zk import ZK

zk = ZK('192.168.1.201', port=4370, timeout=5)
conn = zk.connect()
attendances = conn.get_attendance()
for att in attendances:
    # att.user_id, att.timestamp, att.punch (0=check-in, 1=check-out)
    save_to_database(att)
conn.disconnect()
```

**Pros:**
- Simple setup
- Free library available (pyzk)
- Machine ko configure nahi karna

**Cons:**
- Real-time nahi — 5-10 minute delay
- Machine aur backend same network par hone chahiye (ya VPN)
- Machine ka port 4370 open hona chahiye

---

### Method C — ZKTeco ADMS SERVER

```
HOW IT WORKS:
Machine → ZKTeco ADMS Software → Database → 
Hamara Backend ADMS DB se data uthata hai
```

**Pros:**
- ZKTeco official software use karta hai
- Reliable

**Cons:**
- ADMS software paid hai (~$200-500)
- Extra layer complexity
- Windows server chahiye ADMS ke liye

---

### Method D — MANUAL ENTRY (WEB INTERFACE)

```
HOW IT WORKS:
Admin/Principal → Web Browser → Teacher list dekhe → 
Present/Absent/Leave mark kare → Save
```

**Pros:**
- ZKTeco machine ki zaroorat nahi
- Simple UI
- Already existing system se familiar

**Cons:**
- Manual work
- Human error possible
- Real-time nahi

---

## 4. RECOMMENDED ARCHITECTURE — BEST PLAN

```
┌─────────────────────────────────────────────────────────────┐
│                    DUAL SYSTEM DESIGN                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ZKTeco uFace 800          Manual Entry                   │
│   (Primary Method)          (Backup Method)                │
│         │                         │                         │
│         ▼                         ▼                         │
│   Push API Endpoint         Web Interface                  │
│   /api/attendance/          /admin/teachers/               │
│   zkteco/push/              staff-attendance/              │
│         │                         │                         │
│         └──────────┬──────────────┘                         │
│                    ▼                                        │
│           TeacherAttendance Model                          │
│           (Database)                                        │
│                    │                                        │
│                    ▼                                        │
│           WebSocket (Real-time)                            │
│                    │                                        │
│                    ▼                                        │
│           Dashboard (Frontend)                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. DATABASE DESIGN — Naye Models

### TeacherAttendance Model

```python
class TeacherAttendance(models.Model):
    
    SOURCE_CHOICES = [
        ('biometric', 'Biometric Machine'),
        ('manual', 'Manual Entry'),
        ('mobile', 'Mobile App'),
    ]
    
    STATUS_CHOICES = [
        ('present', 'Present'),
        ('absent', 'Absent'),
        ('late', 'Late'),
        ('leave', 'Leave'),
        ('half_day', 'Half Day'),
    ]
    
    # Core fields
    teacher         = ForeignKey(Teacher)
    campus          = ForeignKey(Campus)
    date            = DateField()
    
    # Timing
    check_in_time   = TimeField(null=True)      # Punch in
    check_out_time  = TimeField(null=True)       # Punch out
    working_hours   = DurationField(null=True)   # Auto calculated
    
    # Status
    status          = CharField(choices=STATUS_CHOICES)
    late_minutes    = IntegerField(default=0)    # Kitne minute late aya
    
    # Source — Machine se aya ya manual
    source          = CharField(choices=SOURCE_CHOICES)
    device_id       = CharField(null=True)       # Machine ka ID
    
    # Manual entry info
    marked_by       = ForeignKey(User, null=True)
    remarks         = TextField(null=True)
    
    # Audit
    created_at      = DateTimeField(auto_now_add=True)
    updated_at      = DateTimeField(auto_now=True)
    organization    = ForeignKey(Organization)
    
    class Meta:
        unique_together = ['teacher', 'date']    # Ek din ek record
```

### ZKTecoDevice Model

```python
class ZKTecoDevice(models.Model):
    campus          = ForeignKey(Campus)
    device_name     = CharField()               # "Main Gate", "Staff Room"
    ip_address      = GenericIPAddressField()   # Machine ka IP
    port            = IntegerField(default=4370)
    serial_number   = CharField(unique=True)    # Machine ka serial
    is_active       = BooleanField(default=True)
    last_sync       = DateTimeField(null=True)  # Aakhri baar kab sync hua
    organization    = ForeignKey(Organization)
```

---

## 6. BACKEND API ENDPOINTS — Kya Banana Hai

### ZKTeco Push Receiver
```
POST /api/attendance/zkteco/push/
> Machine khud yahan call karti hai jab punch hoti hai
> No auth needed (machine secret key use karti hai)
> Body: {user_id, timestamp, punch_type, device_serial}
```

### Manual Attendance Endpoints
```
POST   /api/attendance/teacher/mark/          - Manual attendance mark
GET    /api/attendance/teacher/list/          - Teacher attendance list
GET    /api/attendance/teacher/summary/       - Summary/Report
PUT    /api/attendance/teacher/{id}/edit/     - Edit entry
GET    /api/attendance/teacher/today/         - Aaj ki attendance
GET    /api/attendance/teacher/monthly/       - Monthly report
```

### Device Management
```
GET    /api/attendance/devices/               - All devices
POST   /api/attendance/devices/add/           - New device add
POST   /api/attendance/devices/{id}/sync/     - Manual sync trigger
GET    /api/attendance/devices/{id}/status/   - Device online/offline check
```

### Employee Registration (Teacher ko Machine par Register karna)
```
POST   /api/attendance/devices/{id}/enroll/   - Teacher fingerprint/face enroll
DELETE /api/attendance/devices/{id}/remove/   - Teacher remove from device
GET    /api/attendance/devices/{id}/users/    - Device par registered users
```

---

## 7. FRONTEND PAGES — Kya Banana Hai

### 1. Admin — Staff Attendance Dashboard
```
Path: /admin/teachers/staff-attendance
Features:
- Aaj ki attendance summary (Present/Absent/Late cards)
- Teacher wise status table
- Manual mark karne ka option
- Date filter
- Export to Excel/PDF
```

### 2. Admin — ZKTeco Device Management
```
Path: /admin/settings/devices
Features:
- Connected devices list
- Device online/offline status
- Manual sync button
- Teacher enrollment management
```

### 3. Principal — Campus Attendance View
```
Path: /principal/staff-attendance
Features:
- Campus level attendance overview
- Department/shift wise breakdown
- Approval of manual adjustments
```

### 4. Teacher — Apni Attendance Dekhe
```
Path: /teacher/my-attendance
Features:
- Monthly calendar view
- Check-in/check-out times
- Leave balance
- Punch history
```

---

## 8. ZKTECO MACHINE SETUP — Step by Step

### Step 1: Machine ko Network se Connect karo
```
1. ZKTeco uFace 800 ke back mein Ethernet port hai
2. Us mein LAN cable lagao (ya WiFi configure karo)
3. Machine ke screen par jao: Menu > Communication > IP Address
4. IP set karo: 192.168.1.201 (ya jo bhi available ho)
5. Subnet: 255.255.255.0
6. Gateway: 192.168.1.1 (router ka IP)
```

### Step 2: Push Protocol Enable karo
```
Machine Settings > Communication > HTTP Server:
- Enable HTTP Push: YES
- Server Address: https://sms.idaraalkhair.sbs/api/attendance/zkteco/push/
- Port: 80
- HTTP Method: POST
- Push Interval: 10 seconds (ya real-time)
```

### Step 3: Teacher Registration
```
Machine par har teacher ka:
- Employee ID: Teacher ka employee_code (e.g., TCH001)
- Face Registration: Camera ke samne kharo
- Fingerprint: Scanner par finger rakho
- RFID Card: Card reader par tap karo (optional)
```

### Step 4: Backend Configuration
```python
# settings.py mein add karo:
ZKTECO_SECRET_KEY = env('ZKTECO_SECRET_KEY')
ZKTECO_DEVICE_IPS = ['192.168.1.201']
LATE_ARRIVAL_THRESHOLD = 10  # minutes
EARLY_DEPARTURE_THRESHOLD = 15  # minutes
```

---

## 9. REAL-TIME FLOW — Punch se Dashboard tak

```
1. Teacher machine par punch kare (face/finger/card)
         ↓
2. Machine (ZKTeco uFace 800) process kare
         ↓
3. Machine POST request bheje:
   POST http://backend/api/attendance/zkteco/push/
   {
     "user_id": "TCH001",
     "timestamp": "2026-04-17T08:30:00",
     "punch_type": 0,  // 0=check-in, 1=check-out
     "device_serial": "ZK12345678"
   }
         ↓
4. Django view receive kare, validate kare
         ↓
5. TeacherAttendance model mein save kare
         ↓
6. Django Channels WebSocket se frontend ko notify kare
         ↓
7. Admin dashboard real-time update ho jaye
   (Page refresh ki zaroorat nahi!)
         ↓
8. Agar late aya → Automatically "Late" status set ho
   Agar absent tha → "Present" update ho
```

---

## 10. MANUAL ATTENDANCE FLOW

```
1. Admin/Principal browser khole
         ↓
2. /admin/teachers/staff-attendance par jaye
         ↓
3. Date select kare + Campus select kare
         ↓
4. Teacher list dikhe (by default sab "Absent")
         ↓
5. Har teacher ke liye status select kare:
   [Present] [Absent] [Late] [Leave] [Half Day]
         ↓
6. Late ho toh time bhi enter kare
         ↓
7. "Save" button click kare
         ↓
8. System mein source="manual" ke saath save ho
         ↓
9. Machine aur manual dono ka record ho
```

---

## 11. CHEZON KI LIST — Kya Kya Chahiye?

### FREE CHEEZEIN

| Item | Source | Cost |
|------|--------|------|
| pyzk library | GitHub (open source) | FREE |
| ZKTeco Push Protocol | Machine built-in | FREE |
| Django Channels (WebSocket) | pip install | FREE |
| Celery (background tasks) | pip install | FREE |
| Redis (Celery broker) | Docker | FREE |

### PAID CHEEZEIN

| Item | Source | Est. Cost |
|------|--------|-----------|
| ZKTeco uFace 800 Machine | Local market/online | ~$150-300 |
| ZKTeco ADMS Software | ZKTeco reseller | ~$200-500 (optional) |
| SSL Certificate | Let's Encrypt | FREE / $10-50/yr |
| Static IP (for push) | ISP | ~$5-20/month |

### SOFTWARE REQUIREMENTS

```
Backend:
pip install pyzk           # ZKTeco Python SDK (free)
pip install celery         # Background tasks
pip install redis          # Message broker
pip install channels       # WebSocket support
pip install channels-redis # WebSocket + Redis

Docker (already have):
- Redis container (for Celery + WebSocket)
```

---

## 12. POSSIBLE PROBLEMS AUR SOLUTIONS

### Problem 1: Machine aur Server alag network par hain
```
Solution A: Machine ko same network par rakho
Solution B: VPN setup karo (OpenVPN ya WireGuard — free)
Solution C: Machine DDNS use kare (DuckDNS — free)
```

### Problem 2: Internet cut ho jaye
```
Machine khud locally store karti hai 100,000+ records
Jab internet wapas aaye, machine automatically sync karti hai
Backend mein duplicate handling rakho (same timestamp ignore)
```

### Problem 3: Teacher ne naya face enroll nahi karaya
```
Manual attendance option hamesha available rahega
Admin override kar sakta hai
```

### Problem 4: Machine ka IP change ho jaye
```
Router mein machine ka MAC address se static IP assign karo
Ya DHCP reservation use karo
```

---

## 13. SECURITY CONSIDERATIONS

```python
# ZKTeco Push endpoint ko secure karo:

class ZKTecoPushView(APIView):
    permission_classes = []  # Public endpoint
    
    def post(self, request):
        # 1. Secret key validate karo
        secret = request.headers.get('X-ZKTeco-Secret')
        if secret != settings.ZKTECO_SECRET_KEY:
            return Response(status=403)
        
        # 2. Device serial validate karo
        device_serial = request.data.get('device_serial')
        if not ZKTecoDevice.objects.filter(
            serial_number=device_serial, is_active=True
        ).exists():
            return Response(status=403)
        
        # 3. Rate limiting (max 1 punch per teacher per minute)
        # 4. Input sanitization
        # 5. Idempotency check (duplicate punch ignore)
```

---

## 14. IMPLEMENTATION PHASES — Kab Kya Karain?

### Phase 1 — Manual Attendance (1-2 hafte)
```
✅ TeacherAttendance model banana
✅ Manual mark API endpoints
✅ Admin frontend page
✅ Basic reports
🎯 Is mein machine ki zaroorat nahi
```

### Phase 2 — ZKTeco Integration (1-2 hafte baad)
```
✅ ZKTecoDevice model
✅ Push API endpoint
✅ pyzk polling (backup)
✅ Real-time WebSocket updates
✅ Device management UI
🎯 Machine physically connect karni hai
```

### Phase 3 — Advanced Features (future)
```
⏳ Mobile app check-in (GPS based)
⏳ Leave management system
⏳ Teacher attendance analytics
⏳ Payroll integration (attendance se salary)
⏳ Notifications (WhatsApp/SMS jab absent)
```

---

## 15. SUMMARY TABLE

| Feature | Method | Real-time? | Cost | Complexity |
|---------|--------|-----------|------|------------|
| ZKTeco Push API | Biometric | ✅ Yes | Machine cost only | Medium |
| ZKTeco Polling (pyzk) | Biometric | ❌ 5-10 min delay | Free | Low |
| Manual Web Entry | Manual | ✅ Yes | Free | Low |
| Mobile GPS Check-in | Mobile | ✅ Yes | Free | High |
| ADMS Software | Biometric | ✅ Yes | $200-500 | Low |

**RECOMMENDED:** 
1. **Pehle Manual Entry implement karo** (jaldi hoga, kaam shuru ho jaye)
2. **Phir ZKTeco Push API add karo** (real-time best experience)
3. **Manual hamesha backup ke tor par rakho** (machine kharab ho toh bhi kaam chale)

---

## 16. EMPLOYEE CODE MAPPING

ZKTeco machine mein har teacher ka ek **User ID** hota hai.
Hamare system mein teacher ka **employee_code** field hai.

```
Machine User ID  ←→  Teacher.employee_code
Example: "TCH001" ←→ "TCH001"

Registration ke waqt:
- Admin machine par teacher enroll kare
- User ID mein teacher ka employee_code dalein
- Punch aane par backend employee_code se teacher dhundhe
```

---

## 17. EXISTING CODE MEIN KYA CHANGE HOGA?

### backend/attendance/models.py
```
+ TeacherAttendance class add karo
+ ZKTecoDevice class add karo
+ TeacherLeave class add karo (optional Phase 2)
```

### backend/attendance/views.py
```
+ ZKTecoPushView
+ TeacherAttendanceMarkView
+ TeacherAttendanceListView
+ TeacherAttendanceSummaryView
+ DeviceManagementViews
```

### backend/attendance/urls.py
```
+ /zkteco/push/
+ /teacher/mark/
+ /teacher/list/
+ /teacher/summary/
+ /devices/
```

### frontend/src/app/admin/teachers/
```
+ staff-attendance/page.tsx    (naya folder)
```

### frontend/src/app/admin/settings/
```
+ devices/page.tsx             (naya folder)
```

### docker-compose.yml
```
+ redis service (agar nahi hai)
+ celery worker service
+ celery beat service
```

---

*Document prepared for SMS School Management System — ZKTeco uFace 800 Integration*  
*Version 1.0 | April 2026*
