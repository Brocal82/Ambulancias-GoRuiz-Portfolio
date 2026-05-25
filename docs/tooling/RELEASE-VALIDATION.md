# Release validation

Concise operational checklist for backend, frontend, and worker releases. No infra changes required.

## CI validation flow

GitHub Actions workflow: `.github/workflows/ci.yml`

| Job | What it validates |
|-----|-------------------|
| `validate` | Root typecheck, gitleaks, backend build, OpenAPI artifact, frontend build/tests, worker typecheck/validate, build artifact smoke |
| `security-isolation` | Backend tenant/file/support-access isolation tests (MongoDB service) |
| `backend-smoke` | Running backend `/health` and `/api/docs.json` after build |

Triggers: pull requests and pushes to `main`, plus manual `workflow_dispatch`.

Local parity (run before tagging or deploying):

```bash
npm run typecheck
npm run secrets:scan
npm --prefix ambulancias-goruiz-backend run build
node scripts/validate-openapi-artifact.mjs
npm --prefix ambulancias-goruiz-backend run test:security:isolation:ci
npm --prefix ambulancias-goruiz-frontend run build
node scripts/ci-smoke-artifacts.mjs
npm --prefix ambulancias-goruiz-frontend run test:run
npm --prefix apps/app-worker run typecheck
npm --prefix apps/app-worker run validate
```

Optional backend HTTP smoke (requires local MongoDB + env):

```bash
npm --prefix ambulancias-goruiz-backend run build
MONGODB_URI=mongodb://127.0.0.1:27017/ambulancias_smoke JWT_SECRET=local-smoke-secret-minimum-32-chars node scripts/ci-smoke-backend.mjs
```

## Required smoke checks

### Automated (CI)

- Backend build output: `ambulancias-goruiz-backend/dist/index.js`
- OpenAPI artifact: `ambulancias-goruiz-backend/dist/openapi/openapi.json` with `/health` and `/api/users/login`
- Frontend artifact: `ambulancias-goruiz-frontend/dist/index.html`
- Backend runtime: `GET /health` returns `{ status: "ok" }`
- Backend docs: `GET /api/docs.json` returns OpenAPI JSON

### Manual (production/staging)

- Admin login and one tenant-scoped list view
- Worker mobile login against production API URL
- One secure document open (`/api/files/:filename`)
- One scheduling/workday path if release touched diensts/workday

See also: `.cursor/commands/predeploy-checklist.md`

## Backup confirmation expectation

Before production deploy:

1. Confirm MongoDB backup/snapshot policy for the target environment (provider snapshot or `mongodump`).
2. Record backup timestamp and retention window in the release note or ticket.
3. Do **not** run destructive scripts (`delete:*`, `reset:*`, backfills) during release unless explicitly planned.

## Rollback owner and process

| Step | Owner | Action |
|------|-------|--------|
| 1 | Release owner | Stop rollout; note failing commit/tag and CI job |
| 2 | Backend owner | Redeploy previous backend build; verify `/health` |
| 3 | Frontend owner | Redeploy previous SPA artifact |
| 4 | Mobile owner | Halt store rollout; republish previous EAS build if needed |
| 5 | DBA/platform | Restore DB snapshot only if data migration caused failure |

Rollback is redeploy-previous-artifact first. Database restore is last resort.

## Mobile production validation

Production/store builds **must** set `EXPO_PUBLIC_API_BASE_URL` to the public HTTPS API root (with or without `/api`; the app normalizes it).

Guardrails in `apps/app-worker/src/config/env.ts`:

- Production rejects localhost, LAN/private IPs, Expo host fallback, and hardcoded dev fallback
- Production requires explicit `EXPO_PUBLIC_API_BASE_URL` or `expo.extra.apiBaseUrl`
- Production requires `https://`

EAS production profile reads `EXPO_PUBLIC_API_BASE_URL` from EAS secrets/environment. Set it in the Expo dashboard before `eas build --profile production`.

Pre-release mobile checks:

```bash
npm --prefix apps/app-worker run typecheck
npm --prefix apps/app-worker run validate
```

Manual: install the release candidate, confirm login, push token registration, and one module-specific screen for the tenant.

## Branch protection

`.github/workflows/security-branch-enforcement-audit.yml` verifies that `main` requires the `security-isolation` CI job. After enabling root CI, keep that required check name unchanged.

## Related docs

- `docs/DEPLOYMENT.md` — env vars and runtime configuration
- `docs/tooling/GITLEAKS.md` — secret scanning
- `docs/frontend/WORKER-APP.md` — worker app architecture
