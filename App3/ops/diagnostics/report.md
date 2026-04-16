# Codebase Audit Report

Date: 2026-04-16
Branch: feature/codebase-audit-fixes
Scope: Monorepo root, backend, frontend, pricing/location TypeScript modules

## Command Results

| Command | Result | Notes |
| --- | --- | --- |
| `npm ci` | Pass | Dependencies installed from lockfile at root. |
| `npm run lint` | Pass | Mapped to backend syntax checks (`check:backend`). |
| `npm run typecheck` | Pass | Root TS config and typing fixes applied (`backend/src/location/controller.ts`, `src/pricing/routes.ts`). |
| `npm test` | Pass | Backend + pricing tests pass. |
| `npm run e2e` | Pass | Frontend location e2e suite pass. |
| `npm run build` | Pass | Frontend Vite production build pass. |
| `npm run smoke` | Pass | Windows-native staging smoke script validates health and auth guard behavior. |
| `npm audit` | Pass | 0 vulnerabilities reported. |
| `codeql` | Blocked | CLI not installed in local environment. |
| `sonar-scanner` | Blocked | CLI not installed in local environment. |

## Runtime Smoke Validation

Environment used:
- `PORT=5050` to avoid local `5000` collision
- `start:staging` command from root

Endpoint checks:
- `GET /api/health` -> 200 with service payload
- `GET /api/profile` (no token) -> 401 expected auth guard
- `GET /health` -> 404 (not implemented by this API)

Conclusion: service boot and key auth behavior are healthy for staging smoke checks when targeting `/api/health`.

## Key Remediations Applied

1. Added standardized root scripts required for audit workflow:
   - `lint`, `typecheck`, `test`, `e2e`, `start:staging`
2. Added executable root TypeScript config and resolved type contracts.
3. Added CI and smoke scripts under `scripts/`.
4. Updated smoke script default port strategy to reduce `EADDRINUSE` failures.
5. Added Windows-native smoke runner (`scripts/smoke-test.ps1`) and root `smoke` command.

## Remaining Gaps

1. Static analysis tooling (CodeQL/Sonar) must be installed/configured in CI.
2. Current lint scope is backend syntax checks only; does not yet include frontend ESLint rules.
3. Unix smoke script still depends on Bash/WSL; use `npm run smoke` on Windows hosts.
