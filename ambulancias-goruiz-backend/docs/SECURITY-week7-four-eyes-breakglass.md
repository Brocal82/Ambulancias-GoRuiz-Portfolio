# SECURITY Week 7 - Four-Eyes Break-Glass Approvals

## Goal

Harden privileged JIT support access by requiring two independent superadmin approvals before access becomes active.

## Implemented behavior

- New support-access requests start as `pending`.
- First valid approval:
  - keeps request in `pending`,
  - records approval actor and count.
- Second approval by a different superadmin:
  - changes status to `approved`,
  - sets `expiresAt` and activates the access window.
- Requester cannot approve their own request.
- Same approver cannot approve twice.

## Audit and alert behavior

- `support_access.approval_recorded`: emitted for first approval steps.
- `support_access.approved`: emitted when the second approval activates access.
- `support_access_approved` alert is emitted only on full approval.

## Files touched

- `src/modules/support-access/models/support-access-request.model.ts`
- `src/modules/support-access/services/support-access.service.ts`
- `src/modules/support-access/controllers/support-access.controller.ts`
- `src/security/audit-events.ts`
- `src/__tests__/support-access.integration.test.ts`
