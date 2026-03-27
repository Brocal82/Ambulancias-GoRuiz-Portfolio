# Policy: Multi-tenant `companyId` and legacy compatibility

**Status:** Active internal policy  
**Scope:** Backend (`ambulancias-goruiz-backend`) and any feature touching tenant boundaries  
**Audience:** Engineers implementing new routes, services, or cross-entity mutations

---

## 1. What “legacy `companyId` behavior” means here

Some MongoDB documents (notably **Dienst** and related aggregates) may still have `companyId` **null** or **missing**, reflecting data or flows from before strict multi-tenant modeling.

The codebase still carries **helpers** (e.g. in `requireCompany.ts`, calendar/list filters) that treat “no company on the document” as compatible with certain **legacy** read or branching rules. That is **technical debt**, not the target architecture.

---

## 2. Users and workers

**Every user and worker is expected to belong to a company** (`User.companyId` present for normal accounts). New invitations and SaaS flows assume company-bound identities.

Do not design new features around users without a company unless there is an explicit, documented exception (e.g. superadmin).

---

## 3. Default rule for new backend writes

**New write paths must be strict company-scoped by default:**

- Resolve the acting admin’s or worker’s `companyId` from the authenticated context and/or loaded `User` / resource documents.
- Persist new rows with `companyId` set when the schema supports it.
- Restrict queries and updates so a tenant cannot read or mutate another tenant’s data.

Do **not** copy legacy `$or: [{ companyId: null }, { companyId: { $exists: false } }]` patterns into new code “for consistency” without an explicit review.

---

## 4. Legacy compatibility is not a template for new code

Legacy null/missing `companyId` handling may remain in **specific existing** helpers or flows until migrated. That compatibility:

- Must **not** be expanded casually into new write flows.
- Should be treated as **narrow exceptions**, not the default model.

If a new feature truly must touch legacy rows, document **why** in the PR and keep the scope minimal.

---

## 5. Read compatibility ≠ write safety

**Listing or displaying** legacy-tolerant data for operational continuity is not the same as **mutating** data without tenant boundaries.

- Read paths may use broader filters in controlled places.
- **Bulk mutations, cron-like jobs, and cross-document updates** must enforce tenant scope (e.g. filter by `companyId` derived from the user or resource) unless a dedicated migration owns the behavior.

---

## 6. Cleanup and migration

Backfilling or deleting legacy **Dienst** (or other) rows without `companyId` is a **planned migration or cleanup task**, not part of routine feature work.

Do not mix large data migrations into unrelated feature PRs. Track migration separately (ticket/runbook), with backups and verification.

---

## Summary

| Topic                         | Policy |
|-------------------------------|--------|
| New writes                    | Strict company scope by default |
| New code patterns             | Do not spread legacy null/missing `companyId` helpers by default |
| Existing legacy helpers       | Legacy debt; narrow use only |
| Reads vs writes               | Tolerant reads ≠ unscoped writes |
| Data cleanup                  | Separate planned effort |
