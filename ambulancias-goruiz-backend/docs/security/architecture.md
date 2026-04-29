# Security Architecture

## 1) Access model

- `superadmin` is a platform role and does not have permanent tenant-data access by default.
- Tenant data access for support is only allowed through break-glass (JIT) flow.
- `admin` and `worker` remain company-scoped through backend isolation checks.

## 2) Break-glass model

- Create request: `POST /api/support-access/requests`
- Review request: `POST /api/support-access/requests/:id/review`
- Revoke request: `POST /api/support-access/requests/:id/revoke`
- Active check: `GET /api/support-access/active?companyId=...`

Current enforcement:

- Mandatory reason and ticket ID.
- Time-limited access window (`expiresAt`).
- Separation of duties:
  - requester cannot approve own request
  - same approver cannot approve twice
- Four-eyes final activation:
  - first approval keeps `pending`
  - second independent approval moves to `approved`

## 3) Permissions baseline

| Capability | superadmin | admin | worker |
|---|---:|---:|---:|
| Manage companies and bootstrap | yes | no | no |
| Normal tenant business operations | no (default) | yes (same company) | limited own scope |
| Cross-tenant access | no | no | no |
| Break-glass support access | yes (JIT only) | no | no |

## 4) Audit model

Event schema (core):

- `event`
- `outcome` (`success` | `denied` | `error`)
- `at`
- optional actor, tenant, resource, request, and reason fields

Canonical implementation:

- Event catalog: `src/security/audit-events.ts`
- Emit helper: `src/security/audit-log.ts`
- Persistent model: `src/security/models/security-audit-log.model.ts`

Persistence properties:

- Collection: `security_audit_logs`
- Indexes: `event`, `at`, `actorUserId`, `tenantCompanyId`, `outcome`
- Retention: TTL on `at` from `SECURITY_AUDIT_LOG_RETENTION_DAYS` (default `180`)
- Write pattern: append-only (update/delete blocked at model layer)

## 5) Isolation gate in CI

- Workflow: `.github/workflows/security-isolation-gate.yml`
- Required check name: `security-isolation`
- Test scope:
  - `operational.isolation.test.ts`
  - `multi-tenant.isolation.test.ts`
  - `files.security.integration.test.ts`
  - `support-access.integration.test.ts`
