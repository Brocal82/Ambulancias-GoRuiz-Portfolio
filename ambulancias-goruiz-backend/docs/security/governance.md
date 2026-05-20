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
- Route security alerts: set `SECURITY_ALERT_WEBHOOK_URL` in production (Slack/PagerDuty/SIEM ingest). Alerts are also logged to stdout as `[security-alert]`.
- UI export: superadmin monitoring page supports CSV download for audit and tenant-risk tables.
- Maintain quarterly tabletop exercise cadence.

## 4) Production superadmin checklist

- `SUPERADMIN_MFA_REQUIRED=true`
- Every superadmin account has TOTP enrolled before go-live
- At least two superadmin accounts for dual JIT approval
- Step-up enforced on: create company, delete company, sensitive company patch, create company admin, **approve** support-access (deny/revoke unchanged)
