# Security Operations

## 1) Branch enforcement on `main`

Goal: merges to `main` must be blocked when `security-isolation` fails.

In-repo controls:

- Gate workflow: `.github/workflows/security-isolation-gate.yml`
- Enforcement auditor: `.github/workflows/security-branch-enforcement-audit.yml`

Required GitHub repository configuration (one-time):

- Preferred: Ruleset with required status check `security-isolation` on `main`
- Fallback: Branch protection rule requiring status check `security-isolation`

Verification:

- Open latest run of `Security Branch Enforcement Audit`
- Green: enforcement active
- Red: enforcement missing or misconfigured

## 2) Daily security monitoring

Monitoring source:

- Service: `src/security/security-monitoring.ts`
- Endpoint (superadmin): `GET /api/support-access/monitoring/daily-summary?hours=24`
- Manual execution: `npm run security:report:daily`
- Scheduled execution: cron in `src/index.ts`

Environment variables:

- `SECURITY_MONITORING_ENABLED` (default `true`)
- `SECURITY_MONITORING_CRON` (default `0 7 * * *`)
- `SECURITY_MONITORING_DENIED_THRESHOLD` (default `3`)
- `SUPPORT_ACCESS_EXPIRATION_CRON` (default `*/15 * * * *`)

## 2b) Support access expiration

- Service: `src/modules/support-access/services/support-access.service.ts` (`runSupportAccessExpirationSweep`)
- Scheduled execution: cron in `src/index.ts` (every 15 min by default)
- Read-path trigger: list requests and active-check endpoints also sweep stale approved records
- Bootstrap: server startup runs one sweep to avoid stale records after restarts

## 3) Metrics meaning

All values are global support-access metrics for the selected time window:

- `requested`: support-access requests created
- `denied`: requests denied in review
- `approvalRecorded`: partial approvals (not fully approved yet)
- `approvedFinal`: fully approved requests (four-eyes complete)
- `revoked`: approved accesses revoked
- `expired`: accesses auto-expired
- `offHoursFinalApprovals`: final approvals outside business hours

## 4) Querying persistent audit logs

```javascript
// Last 100 denied events
db.security_audit_logs.find({ outcome: "denied" }).sort({ at: -1 }).limit(100);

// Tenant-specific events in the last 24h
db.security_audit_logs.find({
  tenantCompanyId: "company-id",
  at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
});

// Top events in the last 7 days
db.security_audit_logs.aggregate([
  { $match: { at: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
  { $group: { _id: "$event", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
]);
```
