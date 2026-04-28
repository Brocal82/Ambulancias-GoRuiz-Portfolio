# SECURITY Week 8 - Operational Security Monitoring

## Goal

Add continuous operational visibility so security controls are monitored daily, not only during development.

## Implemented

- Daily monitoring service:
  - `src/security/security-monitoring.ts`
  - Builds 24h summary for break-glass/support-access activity.
  - Emits audit event: `security.daily_monitoring_reported`.
  - Emits alert when denied requests exceed threshold.
  - Emits alert when final approvals happen outside business hours.

- Daily cron scheduling:
  - `src/index.ts` schedules monitoring using `SECURITY_MONITORING_CRON`.
  - Controlled by `SECURITY_MONITORING_ENABLED`.

- Manual report command:
  - `npm run security:report:daily`
  - Runs `src/scripts/run-security-monitoring-report.ts`.

- Coverage:
  - `src/__tests__/security-monitoring.integration.test.ts`

## New environment settings

- `SECURITY_MONITORING_ENABLED` (default: `true`)
- `SECURITY_MONITORING_CRON` (default: `0 7 * * *`)
- `SECURITY_MONITORING_DENIED_THRESHOLD` (default: `3`)

## Monthly operational checklist

- Review trend of `support_access` requested/approved/denied/revoked/expired.
- Investigate denied spikes and off-hours final approvals.
- Validate incident runbook remains aligned with observed patterns.
