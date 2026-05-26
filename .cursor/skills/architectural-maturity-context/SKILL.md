---
name: architectural-maturity-context
description: Aligns architectural and migration decisions with the project's pre-production maturity stage. Use when planning refactors, schema changes, migrations, DB resets, backward compatibility trade-offs, payroll architecture, or long-term SaaS design.
---

# Architectural Maturity Context

Shared context for Ambulancias GoRuiz. Read this before recommending architecture, migrations, or compatibility strategies.

**Complements (does not override):** `CLAUDE.md`, `.cursor/rules/safe-changes.mdc`, and domain-specific skills (`multi-tenant-review`, `secure-files-review`).

---

## Purpose

This skill exists to align future architectural and engineering decisions with the REAL current maturity stage of the project.

The goal is to prevent:

- unnecessary backward compatibility
- premature enterprise overengineering
- excessive migration complexity
- duplicate legacy systems
- unnecessary compatibility layers
- overprotective handling of disposable fake data

while STILL preserving:

- production-quality architecture
- backend authority
- multi-tenant safety
- auditability
- future payroll correctness
- scalable long-term design

---

## Current Project Reality

At the current stage of the project:

- There is NO real payroll data.
- There is NO legally sensitive historical data.
- There are NO production customers yet.
- Current database contents are disposable test/fake data only.
- Full database resets are acceptable if they improve architecture safely.
- Long-term maintainability is more important than preserving temporary fake datasets.
- Backward compatibility is preferred but NOT mandatory if it creates unnecessary technical debt.

HOWEVER:

The system MUST STILL be designed for future:

- production safety
- payroll correctness
- auditability
- tenant isolation
- historical stability
- scalable SaaS operation

---

## Engineering Principles

Future recommendations should prioritize:

- clean architecture
- maintainability
- backend as source of truth
- deterministic calculations
- typed business rules
- minimal safe complexity
- stable domain-driven design
- explicit logic over dynamic systems
- long-term scalability

Avoid:

- unnecessary legacy preservation
- duplicate systems
- temporary compatibility layers
- generic scripting/rule engines
- eval-based systems
- unnecessary abstraction
- migration complexity protecting fake data

---

## Migration Philosophy

### Default stance (pre-production)

| Situation | Prefer |
|-----------|--------|
| Schema redesign with fake data only | Clean break + documented reset over incremental shims |
| Legacy field with no production consumers | Remove or rename directly; update seeds/tests |
| Dual-write / shadow tables for test data | Reject unless required for zero-downtime cutover planning |
| One-off data backfill scripts | Skip if DB reset + seed is simpler and safer |
| API shape cleanup | Version or replace; do not maintain parallel endpoints for test clients |

### When compatibility IS warranted

- Multi-tenant isolation paths (`companyId`, legacy null fallbacks) — see `multi-tenant-review`
- File security (`/api/files`, `openSecureFile`) — see `secure-files-review`
- Auth and role boundaries — see `auth-boundaries.mdc`
- Domain invariants documented in backend domain docs (e.g. `DOMAIN-diensts.md`)
- Changes that would block a near-term pilot with real users (only if explicitly stated)

### DB reset checklist

Before recommending reset:

1. Confirm no real payroll, legal, or customer data exists.
2. Confirm seeds/fixtures can reproduce required test scenarios.
3. Document reset steps in PR or `docs/tooling/NEXT-STEPS.md` if non-obvious.
4. Do not run reset/migration scripts unless the user explicitly requests execution.

---

## Operational Maturity Assumptions

| Dimension | Current assumption | Design target |
|-----------|-------------------|---------------|
| Data | Disposable test/fake | Immutable audit trail for payroll |
| Tenants | Test companies | Strict `companyId` isolation at scale |
| Deployments | Dev/staging friendly | Zero-downtime migrations later |
| Observability | Basic | Structured logs, traceable payroll runs |
| Rules engine | Typed services | No runtime-evaluated business rules |
| Frontend | Source of display only | Backend owns calculations and validation |

Build toward the **Design target** now. Do not pay pre-production costs of the **Design target** when fake data is the only thing at risk.

---

## Expected Claude Behavior

Claude should:

- recommend simpler long-term architecture when appropriate
- favor maintainability over temporary compatibility
- allow safe modernization early
- recommend DB resets when safer and cleaner
- think like a senior architect building toward production SaaS maturity

Claude should NOT:

- assume fake historical data requires enterprise-grade preservation
- block safe architectural improvements unnecessarily
- introduce years of compatibility debt prematurely

---

## Decision Framework

When two approaches compete, score mentally:

```
Long-term clarity + tenant/payroll safety  >  Preserving fake data shape
Explicit typed domain logic                >  Generic configurable engines
Single source of truth (backend)           >  Client-side duplicated rules
Documented clean break (pre-prod)          >  Silent dual-path behavior
Minimal diff (CLAUDE.md)                   >  Large opportunistic refactors
```

If unsure whether data is still disposable, **ask once** — do not assume production sensitivity.

---

## Architectural Recommendation Format

When giving architecture or migration advice, use:

```markdown
## Architectural Recommendation

### Maturity context
[Pre-production / approaching pilot / production — state assumption]

### Verdict
[Proceed with clean break | Proceed with compatibility layer | Defer]

### Rationale
[Why this fits long-term SaaS goals without overengineering now]

### Preserved invariants
- Multi-tenant: ...
- Backend authority: ...
- Audit/payroll readiness: ...

### Trade-offs accepted
- ...

### Not recommended
- ...
```

---

## Related References

- Global policy: `CLAUDE.md`
- Multi-tenant: `ambulancias-goruiz-backend/docs/POLICY-multi-tenant-legacy-companyId.md`
- Safe change scope: `.cursor/rules/safe-changes.mdc`
- Tooling index: `docs/tooling/README.md`
