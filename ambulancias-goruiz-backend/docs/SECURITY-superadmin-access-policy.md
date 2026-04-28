# Security Policy: SuperAdmin access model

**Status:** Active  
**Scope:** Backend platform access, support operations, and tenant boundaries.

## 1) Default rule

The `superadmin` role is a **platform role**, not a tenant operator role.

- SuperAdmin can manage platform-wide configuration (companies, activation, bootstrap flows).
- SuperAdmin must **not** have permanent unrestricted access to each tenant's business data.

## 2) Exceptional access (JIT / break-glass)

Any direct tenant-data access for support must follow Just-In-Time controls:

- Reason and ticket ID are mandatory.
- Time-limited session (auto-expiration).
- Explicit approval (minimum one approver; prefer two in production).
- Full audit trail for create/read/update/delete actions performed during the window.

## 3) Security outcomes expected

- Principle of least privilege by default.
- Reduced blast radius if a privileged account is compromised.
- Better compliance posture (SOC2 / ISO-style controls).
- Traceable, reviewable support intervention history.

## 4) Current implementation baseline

- `superadmin` routes are restricted to platform admin surfaces.
- Tenant operations remain company-scoped through backend checks (`companyId` + service-layer enforcement).
- Audit event scaffolding is available in `src/security/audit-events.ts` and `src/security/audit-log.ts`.

## 5) Required next steps

- Add approval + session-expiry mechanism for break-glass flow.
- Persist audit logs to immutable storage (SIEM/WORM) in addition to app logs.
- Add alerts when exceptional access starts/ends or violates policy.
