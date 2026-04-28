# Security Audit Events Catalog (Week 1 baseline)

This file defines the initial audit event catalog and required fields.

## Required fields for all events

- `event`
- `outcome` (`success` | `denied` | `error`)
- `at` (ISO timestamp)
- `actorUserId` (if authenticated)
- `actorRole`
- `tenantCompanyId` (if tenant-scoped)
- `resourceType`
- `resourceId`
- `httpMethod`
- `path`
- `statusCode`
- `ip`
- `userAgent`
- `reason` (for denied/error)

## Implemented event names

- `auth.login_succeeded`
- `auth.login_failed`
- `company.created`
- `company.updated`
- `company.deleted`
- `file.access_granted`
- `file.access_denied`

## Event source files

- Event constants: `src/security/audit-events.ts`
- Emit/log helper: `src/security/audit-log.ts`
- Login events: `src/modules/users/controllers/users.controller.ts`
- Company admin events: `src/modules/companies/controllers/companies.controller.ts`
- File access events: `src/app.ts` (`GET /api/files/:filename`)

## Next hardening steps

1. Persist events to immutable external sink (SIEM/WORM) with retention policy.
2. Add alert rules for suspicious patterns (e.g., repeated denied file access).
3. Introduce `requestId` propagation for full traceability across services.
