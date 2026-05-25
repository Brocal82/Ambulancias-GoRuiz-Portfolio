# AI Tooling & Developer Safety

Minimal, reversible tooling for Ambulancias GoRuiz. Does not modify productive runtime behavior except OpenAPI doc routes.

## Structure

| Path | Purpose |
|------|---------|
| `CLAUDE.md` | Global AI policy (existing) |
| `.cursor/rules/` | Focused Cursor rules (safe changes, tenant, files, auth, frontend API) |
| `.cursor/skills/` | Review workflows (tenant, files, frontend, commit, OpenAPI) |
| `.cursor/commands/` | Slash commands (`/safe-to-commit`, `/review-*`, `/predeploy-checklist`) |
| `.cursor/agents/` | Subagents (tenant guardian, files guardian, frontend QA, scheduling) |
| `.gitleaks.toml` | Secret scanning config |
| `.githooks/pre-commit` | Optional git hook (typecheck + gitleaks) |
| `ambulancias-goruiz-backend/src/openapi/` | Minimal OpenAPI (`/api/docs`, `/api/docs.json`) |

## Quick commands

```bash
npm run typecheck          # backend + frontend + worker
npm run secrets:scan       # gitleaks (skips if not installed)
npm run precommit:check    # typecheck + secrets
```

See also: [GITLEAKS.md](./GITLEAKS.md), [GIT-HOOKS.md](./GIT-HOOKS.md), [RELEASE-VALIDATION.md](./RELEASE-VALIDATION.md), [NEXT-STEPS.md](./NEXT-STEPS.md).

## OpenAPI public endpoints

| Endpoint | Auth | Rate limit | Notes |
|----------|------|------------|-------|
| `GET /api/docs.json` | No | 60 req/min (docs limiter) | OpenAPI spec JSON |
| `GET /api/docs` | No | 60 req/min | Swagger UI HTML; CSP scoped locally for unpkg |
| `GET /api/docs/init.js` | No | 60 req/min | Swagger init script (no inline script in HTML) |

These endpoints are **public read-only** documentation. They intentionally bypass the global `/api` rate limiter (mounted before it in `app.ts`) and use a dedicated docs limiter instead. Productive routes (`/api/users/login`, etc.) are unchanged.
