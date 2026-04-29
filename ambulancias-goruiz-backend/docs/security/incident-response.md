# Security Incident Response

## Scope

Use this runbook for potential cross-tenant data leakage, especially:

- unauthorized access to `/api/files/:filename`
- tenant isolation failures in API endpoints
- accidental exposure through exports, logs, or misconfiguration

## Roles

- Incident Commander (IC)
- Security Lead
- Backend Owner
- Communications Owner

## Severity

- `SEV-1`: active unauthorized cross-tenant exposure
- `SEV-2`: confirmed vulnerability, no confirmed exploit
- `SEV-3`: suspicious signal under investigation

## Immediate containment (first 30 minutes)

1. Open incident channel and assign IC.
2. Pause deploys for affected surface.
3. Reduce blast radius:
   - revoke unnecessary active support-access windows
   - revoke high-risk sessions if needed
4. Collect evidence:
   - timeline start
   - endpoint, actor, tenant, and resource identifiers
   - relevant audit events and request IDs

## Triage and impact

1. Reproduce safely in test/staging.
2. Identify affected endpoint/module and role boundary.
3. Determine affected data class and tenant count.
4. Build impacted entity list.
5. Estimate exposure window (`first_possible` -> `last_confirmed`).

## Eradication and recovery

1. Apply minimal safe fix at isolation boundary.
2. Add regression tests for the exact exploit path.
3. Run targeted security suites and validate.
4. Deploy with heightened monitoring.
5. Confirm no new unauthorized events after deployment.

## Communications

- Internal: severity, scope, containment status, ETA
- External (if needed): impact, mitigation, recommended tenant actions

## Post-incident (within 5 business days)

1. Postmortem with timeline and root cause.
2. Track remediation actions with owner and due date.
3. Re-run tabletop simulation for this scenario.
4. Update this documentation if process changed.

## Tabletop checklist

- [ ] Roles assigned and contact path confirmed
- [ ] Initial severity classified
- [ ] Containment decisions executed
- [ ] Exploit path reproduced and verified
- [ ] Fix validated by tests
- [ ] Internal/external communication drafted
- [ ] Postmortem and action items created
