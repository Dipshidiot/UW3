# UI Simplification Audit

Date: 2026-04-16
Scope: Frontend navigation continuity and admin/user route clarity

## Current Route Continuity

Observed in routing setup:
- User routes: `/`, `/profile`, `/achievements`, `/rewards`, `/weather`, `/settings/location`, `/notifications`, legal pages.
- Plan routes: `/plans/:planCode`, `/plans/compare/:planCode`.
- Admin routes: `/admin`, `/admin/payments/setup-wizard`.
- Catch-all route redirects to `/`.

Access control:
- Admin routes gate on `user?.role === 'admin'` and redirect non-admin users to `/`.
- This protects deep links but can hide context for non-admin users who expected admin tooling.

## Simplification Recommendations

1. Add lightweight unauthorized context screen for admin deep links.
- Replace direct redirect with a small message card: "Admin access required" + "Go to dashboard".
- Benefit: avoids confusing route jumps during link sharing.

2. Consolidate plan route naming.
- Keep either `/plans/:planCode` and `/plans/compare/:planCode` or move compare under `/plans/:planCode/compare`.
- Benefit: easier breadcrumb and mental model.

3. Normalize settings navigation labels.
- Keep all user settings pages under `/settings/*` as the app grows.
- Existing `/settings/location` is a good anchor for this pattern.

4. Add explicit 404 content page before redirect fallback.
- Current catch-all sends users to `/` silently.
- A minimal `NotFound` page can preserve trust and provide recovery links.

## Priority Changes for Next Sprint

1. Admin unauthorized context page.
2. NotFound route page with common recovery links.
3. Route map test that asserts all primary nav links resolve without redirect loops.
