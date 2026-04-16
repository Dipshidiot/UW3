# Utility Watch

Utility Watch is a clean, gamified utility-tracking platform built with a React + Vite frontend and a Node.js + Express + MongoDB backend.

## Structure

- `frontend/` — React 18 dashboard with usage graphs, XP, badges, notifications, rewards, and admin views
- `backend/` — Express API with MongoDB models, JWT auth, notifications, rewards, and admin endpoints

## Audit and operations deliverables

Open these directly from the root README in your markdown viewer:

- Diagnostics report: `ops/diagnostics/report.md`
- Metrics summary: `ops/diagnostics/metrics.md`
- PR summary: `ops/diagnostics/pr-summary.md`
- Rollout notes: `ops/diagnostics/rollout-notes.md`
- UI simplification spec: `design/ui-simplify.md`
- Security hardening plan: `ops/security/hardening_plan.md`
- Smoke scripts:
  - `scripts/smoke-test.sh`
  - `scripts/smoke-test.ps1`

## Quick start

### 1. Install dependencies

```bash
npm run install:backend
npm run install:frontend
```

### 2. Configure backend

Copy `backend/.env.example` to `backend/.env` and set your MongoDB connection string and JWT secret.

> Prelaunch preview mode: set `DEMO_MODE_ONLY=true` to keep the app in demo-only testing mode. In that mode, live member registration and member login are blocked until you decide to go live.

Optional safe exploration flags while still in demo mode:

- `DEMO_ALLOW_MEMBER_LOGIN=true` allows member sign-in while `DEMO_MODE_ONLY=true`.
- `DEMO_ALLOW_MEMBER_SIGNUP=true` allows member registration while `DEMO_MODE_ONLY=true`.

Recommended safest setup for public testers:

- Keep `DEMO_MODE_ONLY=true`.
- Enable only `DEMO_ALLOW_MEMBER_LOGIN=true` first.
- Enable `DEMO_ALLOW_MEMBER_SIGNUP=true` only when you are ready to accept test account creation.

### 3. Seed demo data

```bash
npm run seed:backend
```

Demo credentials:

- `admin@utilitywatch.dev` / `Admin123!`
- `member@utilitywatch.dev` / `Member123!`
- `buyer@utilitywatch.dev` / `246810`
- Buyer API key default after seeding: `buyer_demo.safeinsights2026`

### 4. Run the apps

```bash
npm run dev:backend
npm run dev:frontend
```

### 5. Run backend integration tests

```bash
npm run test:backend
```

## Buyer insights examples

After `npm run seed:backend`, you can query the buyer-only aggregated API with the seeded demo credentials.

### PowerShell login example

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:5000/api/buyer/auth/login" `
  -ContentType "application/json" `
  -Body '{"email":"buyer@utilitywatch.dev","pin":"246810"}'
```

### PowerShell aggregated monthly usage example

```powershell
Invoke-RestMethod -Headers @{ 'x-api-key'='buyer_demo.safeinsights2026' } `
  -Uri "http://localhost:5000/api/insights/usage/monthly?region=north&month=4&year=2026"
```

### curl provider trends example

```bash
curl -H "x-api-key: buyer_demo.safeinsights2026" "http://localhost:5000/api/insights/providers/trends?region=north&provider=northgrid&month=4&year=2026"
```

See `docs/buyer-insights-api.md` for a fuller set of example calls.

## Key rule

Utility submissions are only allowed for the **current month** or the **previous month**. The backend enforces this rule for create and update actions.
