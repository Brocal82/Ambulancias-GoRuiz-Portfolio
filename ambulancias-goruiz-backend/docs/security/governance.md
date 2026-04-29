# Security Governance

## 1) Monthly superadmin review template

Use this one-page checklist every month.

Header:

- Month (`YYYY-MM`)
- Reviewer
- Date

Core metrics:

- requested
- approved final
- denied
- revoked
- expired
- off-hours final approvals

Risk summary:

- Overall status: `green` | `yellow` | `red`
- One-line reason

Required checks:

- denied spike above threshold? yes/no
- off-hours approvals unjustified? yes/no
- tenant isolation concern detected? yes/no

Actions (mandatory if yellow/red):

- action, owner, due date

Sign-off:

- superadmin approval

## 2) Residual risks

- Branch-level required check still depends on repository-level GitHub settings.
- Audit immutability is enforced in app/model layer; direct DB admin access remains a residual risk.

## 3) Next hardening steps

- Enforce least-privilege DB credentials for runtime identity.
- Export audit trail to external immutable sink (SIEM/WORM/object-lock).
- Add alert routing and escalation policy for denied spikes and off-hours approvals.
- Maintain quarterly tabletop exercise cadence.
