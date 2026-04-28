# SECURITY Week 10 - Branch Enforcement and Persistent Audit Logs

## Goal

Close two pending controls:

1. Enforce that `security-isolation` blocks merges to `main`.
2. Persist security audit events in MongoDB with retention and queryability.

## Branch enforcement (main)

### What is now in-repo

- Existing gate workflow: `.github/workflows/security-isolation-gate.yml`
- New enforcement auditor workflow: `.github/workflows/security-branch-enforcement-audit.yml`
  - Runs on PRs to `main`, daily, and manually.
  - Fails when `main` does not enforce `security-isolation` through either:
    - Branch Protection required checks, or
    - Repository Ruleset required status checks.

### Required one-time GitHub setup

This repository-level setting cannot be committed from code and must be enabled in GitHub UI/API.

Preferred (`Rulesets`, if available in your plan):

1. Repository `Settings` -> `Rules` -> `Rulesets` -> `New branch ruleset`.
2. Target branch: `main`.
3. Enable `Require status checks to pass`.
4. Add required check context: `security-isolation`.
5. Save with enforcement `Active`.

Fallback (`Branch protection rule`, if Rulesets unavailable):

1. Repository `Settings` -> `Branches`.
2. Edit rule for `main`.
3. Enable `Require status checks to pass before merging`.
4. Mark `security-isolation` as required.
5. Save.

### Operational verification

- Open latest run of `Security Branch Enforcement Audit`.
- Green result means enforcement is active on `main`.
- Red result means merges may not be blocked and repository config must be fixed.

## Persistent/immutable security audit logs

### What was added

- Model: `src/security/models/security-audit-log.model.ts`
  - Collection: `security_audit_logs`
  - Append-only guard: rejects update/replace/delete operations at model level.
  - Fields preserve existing event structure.
  - Indexes:
    - `event`
    - `at`
    - `actorUserId`
    - `tenantCompanyId`
    - `outcome`
  - Retention:
    - TTL index on `at`
    - Expiration from `SECURITY_AUDIT_LOG_RETENTION_DAYS` (default: `180`)

- Emitter update: `src/security/audit-log.ts`
  - Keeps existing `console.info("[audit]", ...)` behavior.
  - Adds fire-and-forget Mongo persistence for each `emitAuditLog`.
  - Persistence failures are logged as `[audit-persistence-error]` without breaking request flow.

- Config: `src/config/env.ts`
  - New env var: `SECURITY_AUDIT_LOG_RETENTION_DAYS`

## Querying persistent audit logs

Mongo shell examples:

```javascript
// Latest 100 denied events
db.security_audit_logs
  .find({ outcome: "denied" })
  .sort({ at: -1 })
  .limit(100);

// Events for one tenant in last 24h
db.security_audit_logs.find({
  tenantCompanyId: "company-id",
  at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
});

// Daily counts by event for last 7 days
db.security_audit_logs.aggregate([
  { $match: { at: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
  { $group: { _id: "$event", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
]);
```

## Residual risks and next steps

- Without repository-level required checks enabled, GitHub UI may still allow merge on `main`.
- Model immutability is enforced at app/model layer; direct DB admin access can still alter records.
- Recommended next hardening:
  - Enforce least-privilege DB credentials (no write/delete outside app role).
  - Export audit events to external immutable storage/SIEM (WORM/object-lock) for tamper resistance.
  - Add dashboard/alerts on sustained denied spikes and unusual actor/tenant patterns.
