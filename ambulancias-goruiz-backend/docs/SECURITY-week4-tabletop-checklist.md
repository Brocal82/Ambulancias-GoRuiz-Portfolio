# SECURITY Week 4 - Tabletop Simulation Checklist

## Scenario

Simulate a report that Tenant A user can access a file belonging to Tenant B through `/api/files/:filename`.

## Objective

Validate incident readiness for:
- Detection.
- Containment.
- Technical triage.
- Stakeholder communication.
- Recovery and follow-up.

## Preparation

- [ ] Assign roles: IC, Security Lead, Backend Owner, Communications Owner.
- [ ] Confirm test environment and sample tenants are available.
- [ ] Prepare synthetic IDs for users, companies, and files.
- [ ] Confirm access to audit logs and deployment controls.

## Exercise Steps

### 1) Alert and Intake
- [ ] Log the initial report with timestamp and source.
- [ ] Classify initial severity (SEV-1/2/3).
- [ ] Open incident channel and assign Incident Commander.

### 2) Containment
- [ ] Pause deploy pipeline for affected service.
- [ ] Restrict risky access paths (feature flag, temporary route block, or guard).
- [ ] Revoke unnecessary support-access approvals.
- [ ] Decide whether session revocation is required.

### 3) Technical Validation
- [ ] Attempt controlled reproduction in test/staging.
- [ ] Identify failing isolation check and exact exploit path.
- [ ] Confirm affected roles and tenant boundaries.
- [ ] Build preliminary list of impacted tenants/resources.

### 4) Fix and Verification
- [ ] Implement minimal patch focused on isolation boundary.
- [ ] Add regression test for reproduced path.
- [ ] Execute targeted tests plus related security suites.
- [ ] Verify post-fix behavior with same reproduction steps.

### 5) Communication
- [ ] Draft internal status update (scope, impact, ETA).
- [ ] Draft external message template (if required).
- [ ] Confirm approval path for customer-facing notice.

### 6) Closeout
- [ ] Document timeline from detection to mitigation.
- [ ] Capture root cause and contributing factors.
- [ ] Create action items with owners and due dates.
- [ ] Schedule follow-up tabletop rerun.

## Success Criteria

- [ ] Roles responded within expected time.
- [ ] Containment decision made quickly and clearly.
- [ ] Technical team reproduced and fixed issue with tests.
- [ ] Communications were accurate and consistent.
- [ ] Action items were concrete and tracked.
