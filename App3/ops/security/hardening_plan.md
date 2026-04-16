# Security Hardening Plan

Date: 2026-04-16
Branch: feature/codebase-audit-fixes

## Audit Findings Summary

1. Dependency audit currently reports 0 vulnerabilities.
2. Auth guard behavior is correct on checked protected route (`/api/profile` returns 401 without token).
3. Static analysis tools (CodeQL/Sonar) are not installed in local environment.
4. Lint coverage is narrow (backend syntax check only).

## Hardening Actions

1. CI security baseline
- Add pipeline stages for:
  - `npm audit --audit-level=high`
  - CodeQL scan (JavaScript + TypeScript)
  - Sonar scan (quality gate + security hotspots)
- Block merges on high/critical security failures.

2. Secrets and config hygiene
- Enforce `.env` template with required keys and production-safe defaults.
- Add startup checks for required production secrets (JWT, database, payment credentials).

3. Route protection and least privilege
- Add test coverage for admin endpoints to assert 401/403 under unauthorized roles.
- Verify middleware ordering for admin paths in all route modules.

4. Input validation consistency
- Standardize request validators for admin diagnostics and profile mutation endpoints.
- Normalize error payload shape to avoid accidental leakage of internal details.

5. Observability and alerting
- Add audit log coverage for critical admin payment actions:
  - reset test data
  - generate test users
  - readiness toggles
- Emit structured security events for repeated auth failures.

## Execution Order

1. Install and wire CodeQL/Sonar in CI.
2. Expand lint configuration to include frontend and backend style/risk rules.
3. Add endpoint authorization regression tests for admin APIs.
4. Add production startup guardrails for required environment variables.
