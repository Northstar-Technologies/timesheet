# Roadmap (Northstar Timesheet)

This document captures recommended design/deployment improvements and a phased plan to make the app more robust, secure, and maintainable as it grows.

## Guiding Principles

- **Reliability over cleverness**: favor proven patterns (migrations, object storage, background jobs) over one-off logic.
- **Separation of concerns**: keep the web app stateless; push state to Postgres/Redis/object storage.
- **Production parity**: development should resemble production (same entrypoints, same config model, same deployment shape).
- **Security by default**: least privilege, secure cookies, hardened auth flow, and safe file handling.
- **Observability**: logs + metrics + trace context so issues are diagnosable quickly.

## Current Architecture (Baseline)

- Flask app served by Gunicorn (gevent) behind Nginx.
- PostgreSQL for data.
- Redis for SSE pub/sub.
- Attachments stored on the container filesystem (mounted volume in Docker).
- MSAL-based Microsoft 365 auth; “dev mode” bypass creates a local admin session if Azure values are missing/placeholder.
- Vanilla JS + Jinja templates for frontend.

## Recommended Design Changes (Detailed)

### 1) Production Database Lifecycle: Stop `db.create_all()` on startup

**Why**
- `create_all()` is convenient for prototyping but risky in production: it can drift from intended schema, does not manage migrations, and can hide migration gaps.
- Migrations provide repeatability, auditability, and safer upgrades/rollbacks.

**What to do**
- Remove automatic `db.create_all()` from app startup.
- Make Alembic/Flask-Migrate the only schema management mechanism.
- Add a deployment step: `flask db upgrade` (or Alembic equivalent) prior to starting web workers.

**Acceptance criteria**
- Production deploys apply migrations explicitly.
- App starts cleanly even if it cannot create tables (because it shouldn’t try).

---

### 2) Attachment Storage: Move from local filesystem to object storage

**Why**
- Container filesystems are ephemeral or tied to a single node; scaling horizontally makes “local file” a liability.
- Backups and retention become difficult with local volumes.

**Recommended approach**
- Store attachment **bytes** in S3-compatible storage (AWS S3, or Cloudflare R2 if you want Cloudflare adjacency).
- Store only **metadata** in Postgres: `attachment_id`, `timesheet_id`, `original_filename`, `mime_type`, `size`, `storage_key`, timestamps.
- Serve downloads via **signed URLs** (short-lived) instead of proxying all bytes through Flask.

**Implementation notes**
- Upload flow options:
  1. Upload to Flask, then Flask streams to object storage (simpler).
  2. Direct-to-object-storage upload using signed POST/PUT (more scalable).
- Add virus/malware scanning if attachments may come from untrusted sources.
- Enforce MIME and extension validation server-side and verify file signatures where practical.

**Acceptance criteria**
- App can run multiple web instances with no shared filesystem.
- Attachments persist independently of web containers.

---

### 3) Authentication Hardening (OIDC correctness)

**Why**
- Production auth must validate standard OIDC protections:
  - `state` (CSRF protection for auth redirects)
  - `nonce` (token replay protection)
  - strict redirect URI handling
- Session cookies must be hardened for HTTPS deployments.

**What to do**
- Ensure MSAL flow uses and validates `state` and `nonce` properly (and that your callback checks them).
- Set secure session cookie defaults:
  - `SESSION_COOKIE_SECURE=True` (HTTPS only)
  - `SESSION_COOKIE_HTTPONLY=True`
  - `SESSION_COOKIE_SAMESITE='Lax'` (or `Strict` if compatible)
- Ensure logout routes align with CSRF expectations (see below).
- Review admin privilege model: ensure admin claims are sourced from a trusted directory group or a safe allowlist, not user-editable DB flags without governance.

**Dev mode**
- Keep dev-mode bypass, but make it explicit:
  - gated by `FLASK_ENV=development` or `DEV_AUTH_BYPASS=true`
  - never auto-enabled just because env vars are missing

**Acceptance criteria**
- Auth redirect cannot be forged cross-site.
- Sessions are secure under HTTPS reverse proxy.
- Dev bypass cannot accidentally run in production.

---

### 4) CSRF and Session Safety for Mutating Endpoints

**Why**
- `POST`/`PUT`/`DELETE` endpoints are vulnerable to CSRF if they rely only on cookies for auth and do not validate a CSRF token.

**Options**
- Use `Flask-WTF` CSRF tokens for form and AJAX requests.
- Or implement a lightweight double-submit cookie token for API requests.

**Acceptance criteria**
- All mutating endpoints require a CSRF token (or equivalent defense) when authenticated by cookies.

---

### 5) Make the App Stateless and Scalable

**Why**
- Stateless web servers scale and recover easily.
- Any state should live in Postgres/Redis/object storage.

**What to do**
- Ensure session storage is robust:
  - Either keep cookie-based sessions and ensure secret rotation strategy,
  - or move sessions to Redis (server-side sessions) for easier revocation/scale.
- Ensure SSE works across replicas:
  - Redis pub/sub already supports fan-out; keep it as the source of truth.

**Acceptance criteria**
- Multiple web instances can run behind a load balancer with consistent behavior.

---

### 6) Background Jobs for Notifications and Long-Running Work

**Why**
- Twilio sends, reminders, exports, and future integrations should not block web requests.

**Recommended approach**
- Use a queue:
  - **RQ** (simple; Redis-backed) is a good fit since Redis is already present.
  - Celery is more feature-rich but heavier operationally.
- Add job retries and dead-letter behavior.
- Persist notification outcomes in the `Notification` table.

**Acceptance criteria**
- Web endpoints enqueue work and return quickly.
- Retries/visibility exist for failed notifications.

---

### 7) API Consistency, Validation, and Error Handling

**Why**
- Robust apps validate inputs, return consistent errors, and avoid “silent” corrupt state.

**What to do**
- Introduce schema validation for request bodies (Marshmallow, Pydantic, or lightweight manual validation).
- Standardize error responses:
  - `{ "error": "...", "code": "...", "details": {...} }`
- Add global exception handlers that log stack traces with request IDs.

**Acceptance criteria**
- Invalid inputs never write partial/bad records.
- Errors are consistent and diagnosable.

---

### 8) Observability: Logging, Metrics, and Tracing Context

**Why**
- Production issues are inevitable; the difference is how quickly you can isolate them.

**What to do**
- Add structured JSON logging (timestamp, level, request_id, user_id, route, latency).
- Propagate `X-Request-ID` (generate if missing).
- Add basic metrics (Prometheus-style or provider-specific):
  - request duration
  - error rate
  - queue depth (if background jobs)
  - Redis connection failures
  - DB pool saturation

**Acceptance criteria**
- You can answer: “What failed? For whom? How often? Since when?”

---

### 9) Frontend Build Tools (and whether to use Bun)

**Should we use Bun?**
- **Not necessary** for the current frontend: you’re shipping plain JS/CSS without bundling/transpiling.
- Bun helps when you have a build pipeline (bundling, minification, testing, TypeScript, linting) and want speed and a simpler toolchain.

**When Bun becomes worthwhile**
- You introduce TypeScript, a component framework, or bundling (Vite/Webpack/Rollup).
- You want consistent lint/test tooling for frontend code.

**Near-term improvements without Bun**
- Add basic client-side tests only if you introduce a framework/build step.
- Add error reporting (Sentry or similar) for JS runtime errors.
- Improve caching strategy (versioned assets / cache-busting).

**Acceptance criteria**
- Choose a toolchain based on product needs, not novelty.

---

### 10) Cloudflare: What’s realistic and what’s valuable

**Cloudflare “containers”**
- Cloudflare’s primary strengths are edge network services (CDN/WAF/Zero Trust) and Workers.
- This app depends on Postgres + Redis + file storage. That typically lives best on a conventional container platform.

**Recommended Cloudflare usage**
- Put Cloudflare **in front** of your origin:
  - CDN caching for static assets
  - WAF and rate limiting
  - bot protection
  - Access/Zero Trust for admin routes (optional but valuable)
- Use **Cloudflare R2** for attachments if you move to object storage.

**Where to host containers**
- Simpler: Render/Fly.io/DigitalOcean App Platform
- Cloud-native: AWS ECS/EKS, GCP Cloud Run/GKE, Azure Container Apps/AKS

**Acceptance criteria**
- Clear separation: Cloudflare for edge/security; origin hosting for compute/storage.

## Hosting & Deployment Recommendations

### Option A: “Simple and solid” (recommended for small team)

- Host: Render / Fly.io / DigitalOcean
- DB: managed Postgres
- Redis: managed Redis
- Attachments: S3/R2
- Reverse proxy: platform-managed or Nginx
- CI/CD: GitHub Actions deploy on merge to `main`

**Pros**: minimal ops, good reliability, fast iteration  
**Cons**: some vendor constraints, cost can rise with scale

### Option B: “Full control” (Kubernetes/ECS)

- Host: AWS ECS/Fargate or Kubernetes
- Managed services: RDS Postgres, ElastiCache Redis, S3

**Pros**: scalable, standardized ops patterns  
**Cons**: more operational overhead

## Security Hardening Checklist

- Enforce HTTPS end-to-end; set secure cookie flags.
- Implement CSRF protection for all mutating endpoints.
- Validate and sanitize uploads; restrict file types and sizes; consider malware scanning.
- Add authorization checks to every admin endpoint and log admin actions (audit trail).
- Principle of least privilege for DB/Redis credentials.
- Add dependency scanning (Dependabot) and container image updates.

## Data & Workflow Improvements

- Add explicit workflow transitions with validation (draft -> submitted -> approved/needs-approval).
- Add audit log table for status changes (who/when/what).
- Add unique constraints/indices where needed for performance (e.g., `(timesheet_id, entry_date, hour_type)` for entries if you normalize updates).

## Testing & CI/CD

### Tests to add first (highest ROI)

- Auth: dev bypass gated properly; unauthorized requests get 401/403.
- Timesheet: create/update/submit; attachment-required transition.
- Admin: list excludes drafts; approve/unapprove/reject transitions.
- Attachments: upload rejects invalid extensions; download respects access control.

### CI/CD pipeline goals

- Run `black --check`, `flake8`, and unit tests on PRs.
- Build container image and run a smoke test.
- Deploy on merge to `main` with migration step.

## Phased Plan (Future Development Goals)

### Phase 1 (Stabilize: 1–2 weeks)

- Remove `db.create_all()` from startup; formalize migrations.
- Harden auth dev-mode gating and session cookie config.
- Add CSRF protection for mutating endpoints.
- Add basic tests for the main workflows.
- Add request-id logging and consistent error responses.

### Phase 2 (Scale-ready: 2–4 weeks)

- Move attachments to object storage (S3/R2) + signed URLs.
- Introduce background job queue for Twilio notifications (RQ).
- Add admin audit log for approvals and changes.
- Add metrics and operational dashboards.

### Phase 3 (Product/UX: ongoing)

- Improve frontend ergonomics (accessibility, better validation, offline/draft UX).
- Consider a frontend build step only if it unlocks meaningful UX velocity (TypeScript, componentization, testing).
- Add scheduled reminders and reporting exports (background jobs).

## Decision Log (fill in as you choose)

- **Attachment storage**: local volume vs S3/R2 (recommended: S3/R2)
- **Session storage**: cookie vs Redis-backed server-side sessions
- **Queue**: RQ vs Celery (recommended: RQ)
- **Hosting**: managed platform vs ECS/K8s
- **Frontend tooling**: keep vanilla vs introduce build tool (Bun/Vite/etc.)

