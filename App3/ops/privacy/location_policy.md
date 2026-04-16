# Location Data Policy

## Purpose
Location data is used to improve weather impact scoring, anomaly context, and region-specific forecasting.
Location access is optional and never required to use core utility tracking workflows.

## Consent Types and Scopes
- `precise`: user explicitly allows precise coordinates.
- `approximate`: user allows coarse location (region or 0.1-degree coordinates).
- `session` scope: expires automatically after 24 hours.
- `persistent` scope: remains until revoked.

## Retention Rules
- Precise location data retention: 30 days.
- Approximate location data retention: 12 months.
- Expired location records are deleted by automated retention jobs.

## Deletion and Anonymization
- Revocation stops future collection immediately.
- Users can delete stored location records directly from Settings using "Delete my location data".
- Existing records continue only until retention expiry unless legal deletion is requested.
- Anonymization removes account association by replacing `account_id` with irreversible tokens when required by policy workflow.

## Consent Logging and Versioning
- Every consent record stores source and `consent_text_version`.
- Consent transitions are append-only and auditable.
- Revocations are timestamped and never overwritten.

## Data Access Restrictions
- Location tables are sensitive PII stores.
- Access is limited to service roles that require it for runtime features.
- Analyst access requires approved aggregate views; no raw coordinate reads for ad hoc users.
- Raw precise coordinates are encrypted before storage.
- Application logs and analytics events must not contain raw coordinates.

## App Store Compliance (Apple)
- Purpose string for iOS permission prompt:
	- `NSLocationWhenInUseUsageDescription = "We use your location to improve weather impact insights and anomaly context. You can choose precise or approximate and change this any time in Settings."`
- Location permission request happens only after the in-app consent modal and explicit user action.
- No background location APIs are called; only foreground, user-triggered collection is used.
- App behavior remains fully functional if location access is denied.

## Play Store Compliance (Google)
- Data Safety classification:
	- Data type: Location (approximate or precise, user controlled).
	- Collected: Yes (only with consent).
	- Shared with third parties: No.
	- Required for app functionality: No.
	- Purposes: App functionality (localized weather context), analytics (consent/collection quality), fraud prevention (suspicious region mismatch signal).
- Prominent disclosure appears in-app before requesting device permission.
- Delete-my-data option is available in Settings and removes stored location points.

## Global Privacy Mode
- `LOCATION_PRIVACY_MODE=true` disables location consent creation and location collection APIs globally.
- Revoke and status actions remain available so users can manage and verify data state while collection is disabled.

## Audit Verification Notes (2026-04-16)
- Runtime health endpoint is served at `/api/health` (not `/health`), returning service mode metadata.
- Location flows remain optional and app usage is not blocked when permission is denied.
- Delete-my-data behavior is available from Settings and maps to backend revoke with `deleteStoredData=true`.
- No background location collection path is enabled in current frontend flows.
