# Divine Yoga Studio — Finance & Client CRM

## Original problem statement
Build a private, single-admin finance and CRM dashboard for Divine Yoga Studio, Pune. The owner needs one place to manage clients, batches, membership plans, fee payments, overdue follow-ups, and WhatsApp payment reminders. The user confirmed MongoDB for this workspace, manual payment recording only, and a queued/logged reminder workflow until WATI credentials are available.

## Architecture decisions
- React admin SPA with protected routes, a responsive sidebar, and Lucide SVG icons.
- FastAPI API with MongoDB collections mirroring the requested CRM entities.
- Secure owner authentication: Argon2id password hashing, short-lived access sessions, refresh sessions, account lockout, request limits, audit logs, encryption for medical notes, and security response headers.
- APScheduler daily payment-reminder scan and idempotent reminder log queue.

## User persona
- Mrs. Varsha Kakade / Studio Owner: manages classes, client records, monthly dues, payments, and follow-up messages without a client portal or staff roles.

## Core requirements
- Client, batch, plan, subscription, and payment tracking.
- Pending/overdue payment prioritisation and basic finance overview.
- Exportable payment ledger.
- Manual and automated reminder queuing that honors WhatsApp opt-in.
- Self-service reminder templates and studio settings.

## What has been implemented

### 2026-07-29 — Initial CRM workspace
- Private owner login with `admin@divineyogastudio.in`; temporary credential is stored in `test_credentials.md`.
- Dashboard, Clients, Batches & Plans, Finances, Reminders, and Settings screens.
- MongoDB CRUD endpoints for core records plus payment ledger export.
- Seeded yoga studio data and overdue payment examples for immediate use.
- Reminder template management, batch/manual queue endpoints, delivery logs, WATI webhook signature gate, and daily reminder scheduler.
- Security middleware, rate limiting, audit records, encrypted medical notes, and protected admin routes.

## Prioritized backlog

### P0
- Add WATI account credentials, webhook secret, and approved WhatsApp utility templates before live delivery is enabled.
- Add a real password-change workflow and optional TOTP MFA setup.

### P1
- Replace prompt-based quick-create actions with full modal forms for client, batch, plan, payment, and subscription creation.
- Add payment recording controls and next-due-date creation directly in the interface.
- Add richer revenue trends, retention metrics, and attendance tracking.

### P2
- Add Excel and PDF ledger formats alongside the CSV export.
- Add owner alerts for reminder delivery failures and repeated sign-in failures.
- Add configurable studio profile persistence rather than read-only starter values.

## Next tasks
1. Connect approved WATI templates and verify a controlled test-number reminder.
2. Replace quick-add prompts with complete record forms and validation feedback.
3. Add finance charts and export formats for accounting workflows.