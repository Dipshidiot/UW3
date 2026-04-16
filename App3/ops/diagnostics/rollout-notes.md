# Rollout Notes: Audit Hardening Bundle

Date: 2026-04-16
Release Type: Internal reliability and governance hardening

## Rollout Plan

1. Merge PR into target integration branch.
2. Run full command gate in CI:
   - `npm run lint`
   - `npm run typecheck`
   - `npm test`
   - `npm run e2e`
   - `npm run build`
   - `npm run smoke`
3. Enable static analysis jobs:
   - Add `SONAR_TOKEN` and `SONAR_HOST_URL` repo/org secrets.
   - Confirm CodeQL Security tab ingestion.
4. Monitor first 24 hours:
   - smoke job reliability
   - auth-route behavior on staging
   - dependency scan drift

## Rollback Strategy

1. Revert workflow files if scan integration causes CI blocking:
   - `.github/workflows/codeql.yml`
   - `.github/workflows/sonar.yml`
2. Revert smoke command wiring if environment mismatch occurs:
   - `package.json`
   - `scripts/smoke-test.ps1`
   - `scripts/smoke-test.sh`

## Operational Notes

- Windows hosts should use `npm run smoke` (PowerShell script).
- Bash smoke script remains available for Linux CI runners.
- Health endpoint contract for this service is `/api/health`.
