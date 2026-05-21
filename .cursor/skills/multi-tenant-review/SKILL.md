---
name: multi-tenant-review
description: Reviews backend changes for companyId isolation and legacy null-companyId compatibility. Use when reviewing services, controllers, routes, or PRs touching tenant boundaries, admin writes, or cross-company data access.
---

# Multi-Tenant Review

Review changed backend files for tenant isolation.

## Checklist

- [ ] Admin writes call `requireCompanyForAdmin` or equivalent at service entry
- [ ] Queries filter by acting admin's `companyId`
- [ ] Record-level checks use `isSameCompany` (legacy null) or direct `companyId` match (new records)
- [ ] Resource checks use `isResourceFromCompany` where applicable
- [ ] No new code spreads legacy `$or: [{ companyId: null }, ...]` without documented reason
- [ ] Superadmin paths stay on dedicated routes, not loosened admin guards

## References

- `ambulancias-goruiz-backend/docs/POLICY-multi-tenant-legacy-companyId.md`
- `docs/MULTI-TENANT.md`
- Tests: `npm --prefix ambulancias-goruiz-backend run test:security:isolation`

## Output format

```markdown
## Multi-Tenant Review

### Verdict: SAFE / RISK / BLOCK

### Findings
- 🔴 Critical: ...
- 🟡 Warning: ...

### Files reviewed
- path/to/file.ts
```
