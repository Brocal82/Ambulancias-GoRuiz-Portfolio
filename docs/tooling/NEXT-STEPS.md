# Tooling — Next Steps (optional)

Items intentionally deferred to keep this rollout minimal and reversible.

## OpenAPI

- [ ] Expand spec incrementally from `docs/API-REFERENCE.md` (one module at a time)
- [ ] Add CI drift check: compare documented paths vs route files
- [ ] Consider disabling `/api/docs` in production via env flag if desired

## Gitleaks

- [ ] Add `gitleaks` as required check on `main` branch protection (alongside `security-isolation`)
- [ ] Tune allowlists if false positives appear

## Hooks

- [ ] Optional Cursor agent hooks (`.cursor/hooks.json`) to block destructive git commands during agent sessions
- [ ] Husky alternative if team prefers npm-managed hooks over `core.hooksPath`

## CI consolidation

- Workflows currently split: security tests in `ambulancias-goruiz-backend/.github/`, gitleaks at repo root `.github/`. Consider consolidating under monorepo root when convenient.

## Worker app

- [ ] Extend typecheck script to `apps/app-worker` if needed
