# Security Week 2: JIT / Break-glass support access

This phase adds a minimal Just-In-Time (JIT) flow for exceptional support access.

## Implemented backend endpoints (superadmin-only)

- `POST /api/support-access/requests`
  - Create a pending request.
  - Required body: `companyId`, `reason`, `ticketId`, `durationMinutes` (5-240).
- `GET /api/support-access/requests?status=...`
  - List support-access requests.
- `POST /api/support-access/requests/:id/review`
  - Body: `{ "approve": true|false, "reviewComment"?: string }`
  - Enforces separation of duties: reviewer cannot be the requester.
- `POST /api/support-access/requests/:id/revoke`
  - Revoke an approved request.
- `GET /api/support-access/active?companyId=...`
  - Check if current superadmin has active approved access for a company.

## Security behavior

- Approved requests receive an automatic expiry timestamp.
- Expired approved requests are auto-marked as `expired`.
- Revocation is explicit and auditable.

## Audit + alerts

New audit events:

- `support_access.requested`
- `support_access.approved`
- `support_access.denied`
- `support_access.revoked`
- `support_access.expired` (cataloged for next sink/cron step)

Security alerts (stderr warning channel):

- `support_access_approved`
- `support_access_revoked`

## Data model

Collection: `SupportAccessRequest`

Core fields:

- `companyId`
- `requestedBy`
- `reason`
- `ticketId`
- `durationMinutes`
- `status` (`pending|approved|denied|revoked|expired`)
- `reviewedBy`, `reviewedAt`, `expiresAt`
- `revokedBy`, `revokedAt`, `revokeReason`
