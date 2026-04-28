# SECURITY Week 4 - Data Leakage Incident Runbook

## Purpose

Provide a practical and repeatable response process when a potential cross-tenant data exposure is detected.

## Scope

This runbook applies to:
- Unauthorized access to `/api/files/:filename`.
- Tenant isolation failures in API endpoints.
- Accidental exposure caused by misconfiguration, logging, or exports.

## Roles During Incident

- Incident Commander (IC): coordinates response and timeline.
- Security Lead: validates impact and containment actions.
- Backend Owner: applies code/config/database mitigations.
- Communications Owner: prepares internal/external updates.

## Severity Levels

- SEV-1: Active exposure of real tenant data to unauthorized tenant/users.
- SEV-2: Confirmed vulnerability with no proof of exploit yet.
- SEV-3: Suspicious signal, under investigation.

## Detection Triggers

- Security alerts for denied/granted file access patterns that look abnormal.
- Reports from users about seeing another company's resources.
- Failed or flaky isolation tests that indicate possible access regression.
- Manual review finding inconsistent `companyId` scoping behavior.

## Immediate Containment (first 30 minutes)

1. Open incident channel and assign IC.
2. Freeze risky changes:
   - Pause deploys.
   - Lock feature flags related to impacted module.
3. Reduce blast radius:
   - Revoke active support access requests not strictly required.
   - Revoke sessions for high-risk actors if needed.
4. Collect evidence:
   - Incident start timestamp (UTC).
   - Suspected endpoint/file IDs/user IDs/company IDs.
   - Relevant audit events and request IDs.

## Triage and Impact Analysis

1. Confirm whether unauthorized access is reproducible.
2. Identify affected surface:
   - Endpoint(s), module(s), and role(s) involved.
   - Tenant boundaries crossed.
3. Determine data classes involved:
   - Operational data, schedules, documents, payroll, attachments, etc.
4. Build affected-entity list:
   - Impacted company IDs.
   - Potentially exposed user/document IDs.
5. Estimate exposure window:
   - First possible occurrence.
   - Last confirmed occurrence.

## Eradication and Recovery

1. Implement minimal safe fix (guard/ownership/scope validation).
2. Add or extend integration tests for the exact exploit path.
3. Validate:
   - Targeted failing test now passes.
   - Related isolation suites remain green.
4. Deploy with heightened monitoring.
5. Verify no new unauthorized access events after deployment.

## Communication Checklist

- Internal:
  - Incident summary, severity, scope, current status.
  - Current workaround/limitations.
- External (if required):
  - What happened.
  - What data was potentially affected.
  - What was done to contain and fix.
  - Recommended tenant actions.

## Post-Incident Actions (within 5 business days)

1. Write postmortem with timeline and root cause.
2. Track permanent remediation tasks:
   - Test coverage gaps.
   - Missing audits/alerts.
   - Process/tooling improvements.
3. Re-run tabletop scenario using this runbook and compare results.
4. Update security docs and permissions matrix if behavior changed.

## Evidence to Preserve

- Audit logs around the incident window.
- Error tracking events and request traces.
- Hashes/IDs of affected documents where applicable.
- PR(s) and commits used for mitigation.
