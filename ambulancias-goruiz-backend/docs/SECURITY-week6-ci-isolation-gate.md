# SECURITY Week 6 - CI Isolation Gate

## Goal

Prevent merges to `main` when critical tenant isolation/security tests fail.

## What was added

- GitHub Actions workflow: `.github/workflows/security-isolation-gate.yml`
- npm scripts:
  - `test:security:isolation`
  - `test:security:isolation:ci`

## Gate scope (current)

- `src/__tests__/operational.isolation.test.ts`
- `src/__tests__/multi-tenant.isolation.test.ts`
- `src/__tests__/files.security.integration.test.ts`
- `src/__tests__/support-access.integration.test.ts`

These suites cover high-risk multi-tenant boundaries and protected file/support paths.

## Repository setting required (one-time)

To fully enforce the gate, set branch protection in GitHub:

1. Go to repository **Settings** -> **Branches**.
2. Edit protection rule for `main`.
3. Enable **Require status checks to pass before merging**.
4. Mark `security-isolation` as required.

After this is enabled, PRs cannot merge unless the security isolation gate is green.
