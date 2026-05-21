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
npm run typecheck          # backend + frontend
npm run secrets:scan       # gitleaks (skips if not installed)
npm run precommit:check    # typecheck + secrets
```

See also: [GITLEAKS.md](./GITLEAKS.md), [GIT-HOOKS.md](./GIT-HOOKS.md), [NEXT-STEPS.md](./NEXT-STEPS.md).
