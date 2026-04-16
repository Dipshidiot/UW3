# Diagnostics Metrics Baseline

Date: 2026-04-16
Branch: feature/codebase-audit-fixes

## Build and Test Health

| Metric | Value |
| --- | --- |
| Lint pass rate | 100% (configured checks) |
| Typecheck errors | 0 |
| Unit/integration test status | Pass |
| Frontend e2e location status | Pass |
| Frontend production build | Pass |
| Staging smoke command (`npm run smoke`) | Pass |
| npm audit high/critical findings | 0 |

## Runtime Smoke Indicators

| Check | Value |
| --- | --- |
| Backend staging boot | Pass |
| Health endpoint | `/api/health` 200 |
| Protected profile endpoint without token | 401 (expected) |
| Legacy `/health` path | 404 (expected for current router map) |

## Compliance-Oriented Indicators

| Area | Status | Evidence |
| --- | --- | --- |
| Location consent gate | Pass | Feature flag and consent-first flow implemented; no promptless geolocation path. |
| Location delete-my-data | Pass | Settings action plus backend `deleteStoredData` revoke support. |
| Location global privacy kill switch | Pass | `LOCATION_PRIVACY_MODE=true` blocks consent/collect. |
| Payment setup readiness checklist | Pass | Admin diagnostics wizard + readiness persistence. |

## Next Metrics to Add in CI

1. Route-guard regression rate (admin route unauthorized access checks).
2. Frontend route crawl count (broken links and fallback redirects).
3. Mean staging boot time and p95 endpoint latency for `/api/health`.
4. Security scan trend (npm audit + CodeQL/Sonar when installed).
