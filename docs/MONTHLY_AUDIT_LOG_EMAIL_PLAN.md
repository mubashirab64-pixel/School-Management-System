# Monthly Audit-Log CSV Email — Implementation Plan

**Status:** Planned (not built)
**Decided:** Each Principal → their campus's logs · All features · 1st of each month, previous month, via cron

---

## Goal

On the 1st of every month, email each principal a CSV of the previous month's
audit logs for their scope. Hooks into the server's existing nightly cron (the
one that already runs the midnight backup) — no new infrastructure.

## Why this approach

The project has no Celery / task queue, but it **does** have:

- Working email (Gmail SMTP, `no-reply.ait@iak.ngo`) — `EmailNotificationService`
  already sends credential and OTP emails.
- A management-command pattern (`seed_weekends.py`, etc.).
- CSV generation (the attendance export already writes CSV).
- A server cron already running nightly.

So the standard Django-without-Celery pattern fits exactly: **management command
+ system cron**. Celery Beat would be overkill for one monthly job.

---

## Files

| File | What |
|------|------|
| `attendance/services/audit_csv.py` | Pure CSV builder: logs queryset → CSV bytes. Reusable, testable without email or cron. |
| `attendance/management/commands/email_monthly_audit_log.py` | Orchestration: loop principals, scope logs, build CSV, send. |
| `services/email_notification_service.py` | Add `send_with_attachment()` — the existing `send_mail` cannot attach files. |

---

## Steps

### 1. CSV builder (`audit_csv.py`)

- Input: an `AuditLog` queryset + a label (month, scope name).
- Columns: Date/Time, Action, Feature, Entity Type, Entity ID, User, Changes, IP.
- **Use `AuditLog._base_manager`, not `.objects`.** `AuditLog` uses
  `OrganizationManager`, which returns nothing when there is no request user —
  and a management command has none. This is the same trap that bit the review
  tests three times; the command must bypass it and filter organization
  explicitly.

### 2. Scope resolution (in the command)

- Loop every `Principal`.
- `AuditLog._base_manager.filter(organization=principal.org, timestamp__year=Y, timestamp__month=M)`
  for the previous month.
- ⚠️ **Campus-level scope is not possible yet — see Open Questions.** Today
  AuditLog carries only `organization`, not `campus`. If one org == one campus,
  `organization` is enough. For a multi-campus org, add a `campus` field to
  AuditLog first (small migration).

### 3. Email with attachment (`email_notification_service.py`)

- Use `EmailMessage` (not `send_mail`):
  `msg.attach('audit_log_2026-07_Campus-5.csv', csv_bytes, 'text/csv')`.
- Subject e.g. `Monthly Audit Log — July 2026 — Campus 5`.

### 4. Command orchestration

- Default month: the previous month. `--month YYYY-MM` overrides it for manual
  testing.
- Per principal: build CSV → send email, each wrapped in try/except so one bad
  address does not abort the batch. Print a summary at the end.
- Empty month: decide whether to send a "no activity" email or skip. (Open
  Question.)

### 5. Idempotency

- `0 0 1 * *` runs once a month, so it is naturally idempotent — no extra
  tracking needed. An `EmailLog` "sent for month X" record is over-engineering
  for now.

---

## Cron line (added on the server, not in code)

```
# 1st of the month, 01:00 — after the midnight backup, so that night's activity
# is included in the CSV.
0 1 1 * *   cd /path/to/backend && ./venv/bin/python manage.py email_monthly_audit_log
```

---

## Open questions to confirm before building

1. **Campus-level scope.** AuditLog has only `organization`, not `campus`.
   - One org = one campus → `organization` filter is enough, build as-is.
   - Multi-campus org → add a `campus` field to AuditLog (+ migration + set it at
     every `AuditLog.objects.create` call) before this can scope per campus.
2. **Empty month:** send a "no activity this month" email, or skip silently?
3. **Attachment size:** a CSV of a full month's logs for a busy org could be
   large. Fine as an attachment for reasonable sizes; if it grows, switch to a
   secure download link instead of attaching.

---

## Testing (before wiring cron)

- Run manually: `python manage.py email_monthly_audit_log --month 2026-07`.
- Verify: the email arrives, the CSV opens, rows match the Logs tab for that
  month and scope, and a principal only receives their own campus's logs.

---

## Effort

- CSV builder + email attachment + command: **~half a day.**
- Cron line: a 2-minute change on the server (whoever manages deployment).
