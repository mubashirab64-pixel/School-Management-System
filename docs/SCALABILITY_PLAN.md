# Scalability Plan — SMS Project

**Version:** 1.0  
**Date:** 2026-04-10  
**Current Users:** 5000+  
**Status:** Planning

---

## 1. Current Architecture (Problem)

```
5000 users (multiple organizations)
          ↓
      [Nginx]
          ↓
  [1 Backend Container]     ← single point of failure
          ↓
  [PostgreSQL]              ← max_connections = 100
  [Redis]                   ← already exists, underutilized
```

### Problems Identified

| Problem | Impact |
|---------|--------|
| Single backend container | Ek container sab 5000 users ki requests handle karta hai |
| PostgreSQL max_connections = 100 | 100 se zyada concurrent DB connections = crash/hang |
| No connection pooling | Har Django request ek naya DB connection kholta hai |
| Redis caching minimal | Sab queries DB tak ja rahi hain |
| No horizontal scaling | Load badha to sirf ek container pe aata hai |

---

## 2. Target Architecture

```
5000 users (multiple organizations)
              ↓
     [Nginx — Load Balancer]
      ↙          ↓         ↘
[Backend-1]  [Backend-2]  [Backend-3]    ← 3 Django/Daphne replicas
      ↓          ↓         ↓
          [PgBouncer]                     ← Connection Pooler
               ↓
          [PostgreSQL]                    ← tuned config
               
          [Redis Cache]                  ← shared by all 3 backends
          [Redis Channels]               ← WebSocket state (already works)
```

### Why This Works

- **Nginx** Docker internal DNS se automatically teeno backends ko round-robin mein route karega
- **PgBouncer** 3 backends ki connections ko pool karega — PostgreSQL ko sirf 20-30 real connections dikhenge
- **Redis** sab backends share karte hain — WebSocket (Django Channels) aur caching dono kaam karenge
- **WebSocket** koi masla nahi — Redis-based channels hain, backend switch hone pe session nahi tutega

---

## 3. Changes Required

### 3.1 PgBouncer — Connection Pooler (MOST CRITICAL)

**File:** `docker-compose.yml`

**Naya service add karna hai:**
```yaml
pgbouncer:
  image: bitnami/pgbouncer:latest
  container_name: sms_pgbouncer
  environment:
    POSTGRESQL_HOST: db
    POSTGRESQL_PORT: 5432
    POSTGRESQL_USERNAME: ${POSTGRES_USER}
    POSTGRESQL_PASSWORD: ${POSTGRES_PASSWORD}
    POSTGRESQL_DATABASE: ${POSTGRES_DB}
    PGBOUNCER_DATABASE: ${POSTGRES_DB}
    PGBOUNCER_POOL_MODE: transaction      # Django ke liye best mode
    PGBOUNCER_MAX_CLIENT_CONN: 500        # Django se max connections
    PGBOUNCER_DEFAULT_POOL_SIZE: 20       # PostgreSQL ko real connections
    PGBOUNCER_MIN_POOL_SIZE: 5
    PGBOUNCER_RESERVE_POOL_SIZE: 5
    PGBOUNCER_SERVER_IDLE_TIMEOUT: 600
    PGBOUNCER_LOG_CONNECTIONS: 0
    PGBOUNCER_LOG_DISCONNECTIONS: 0
  depends_on:
    db:
      condition: service_healthy
```

**Backend service mein change:**
```yaml
# Pehle:
environment:
  DB_HOST: db

# Baad mein:
environment:
  DB_HOST: pgbouncer     ← ab direct db se nahi, pgbouncer se connect hoga
```

**Connection Flow:**
```
Pehle:  Django → PostgreSQL (max 100 connections = bottleneck)
Baad:   Django → PgBouncer → PostgreSQL (sirf 20 real connections, 500 clients handle)
```

**Kyun transaction mode:**
- Django REST APIs = short-lived requests = transaction mode perfect
- Session mode sirf tab chahiye jab `SET`, `LISTEN`, `NOTIFY` use ho
- Django Channels (WebSocket) Redis use karta hai, DB connection nahi rakhta

---

### 3.2 Backend Replicas — Horizontal Scaling

**File:** `docker-compose.yml`

```yaml
# Pehle (single container):
backend:
  container_name: sms_backend     ← ye hata do
  restart: always

# Baad mein (3 replicas):
backend:
  image: sms_backend:latest
  restart: always
  deploy:
    replicas: 3                   ← 3 instances chalenge
    restart_policy:
      condition: on-failure
      delay: 5s
      max_attempts: 3
```

**Note:** `container_name` aur `deploy.replicas` saath nahi chal sakte — `container_name` hatana padega.

**Nginx config change nahi chahiye** — Docker DNS `backend:8000` ko automatically teeno containers ke IPs pe resolve karta hai (round-robin).

---

### 3.3 PostgreSQL Config Tuning

**File:** `postgresql/postgresql.conf`

```ini
# Connections
max_connections = 200          # 100 se 200 (PgBouncer filter karega)

# Memory — server ki RAM ke hisaab se adjust karo
shared_buffers = 256MB         # RAM ka 25% (agar 1GB RAM hai)
effective_cache_size = 768MB   # RAM ka 75%
work_mem = 4MB                 # per-sort/hash operation
maintenance_work_mem = 64MB    # VACUUM, CREATE INDEX ke liye

# Performance
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1         # SSD use kar rahe ho to ye set karo

# Logging (slow queries detect karne ke liye)
log_min_duration_statement = 500    # 500ms se zyada queries log ho
```

---

### 3.4 Redis Tuning

**File:** `docker-compose.yml` — redis service

```yaml
redis:
  command: >
    redis-server
    --maxmemory 512mb
    --maxmemory-policy allkeys-lru    # memory full hone pe purani keys auto-delete
    --save ""                          # persistence band (cache ke liye zaroor nahi)
```

---

### 3.5 Django Caching (Code Changes — Phase 2)

Ye baad mein implement hoga. Heavy queries jo bar bar chal rahi hain unhe cache karo:

```python
# Example: Attendance report (har page load pe query nahi)
from django.core.cache import cache

def get_monthly_attendance(school_id, month):
    key = f"attendance:{school_id}:{month}"
    data = cache.get(key)
    if not data:
        data = Attendance.objects.filter(...).values(...)
        cache.set(key, data, timeout=300)   # 5 min cache
    return data
```

**Views jahan caching lagani hai (future):**
- Attendance reports
- Fee summaries
- Result/marks data
- Dashboard stats

---

## 4. Rollout Order

```
Phase 1 (No downtime):
  └── postgresql.conf tune karo
  └── Redis maxmemory set karo

Phase 2 (1-2 min downtime):
  └── PgBouncer add karo
  └── Backend DB_HOST: pgbouncer karo
  └── docker compose up -d

Phase 3 (1-2 min downtime):
  └── container_name backend se hato
  └── deploy.replicas: 3 add karo
  └── image: sms_backend:latest add karo
  └── docker compose up -d

Phase 4 (Code changes — future):
  └── Django view-level caching
  └── Heavy query optimization
```

---

## 5. Expected Impact

| Metric | Before | After |
|--------|--------|-------|
| Max concurrent users | ~100-200 | ~1500-2000+ |
| DB connections (real) | Up to 300+ | 20-30 (fixed) |
| Backend throughput | 1x | 3x |
| DB crash risk | High | Very Low |
| Response time (peak) | Slow | Stable |

---

## 6. Monitoring (Recommended)

Deploy ke baad ye check karo:

```bash
# PgBouncer stats
docker exec sms_pgbouncer psql -h localhost -U pgbouncer pgbouncer -c "SHOW POOLS;"

# PostgreSQL active connections
docker exec sms_postgres psql -U $POSTGRES_USER -c "SELECT count(*) FROM pg_stat_activity;"

# Backend replicas status
docker compose ps

# Redis memory
docker exec sms_redis redis-cli info memory | grep used_memory_human
```

---

## 7. Future Scaling (If users cross 10,000+)

- **Read Replica:** PostgreSQL streaming replication — SELECT queries replica pe, writes master pe
- **CDN:** Static files aur media Cloudflare ya AWS CloudFront se serve karo
- **Celery:** Heavy background tasks (reports generate, bulk SMS) async queue mein daalo
- **Multi-server:** Docker Swarm ya Kubernetes — multiple VMs pe spread karo
