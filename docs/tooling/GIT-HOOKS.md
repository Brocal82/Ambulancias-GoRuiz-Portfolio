# Git Hooks (Optional)

Safe pre-commit hook: **typecheck only + secret scan**. No auto-fix, auto-commit, or auto-push.

## Enable (one-time, reversible)

From repo root:

```bash
git config core.hooksPath .githooks
```

On Windows (Git Bash or WSL), ensure `.githooks/pre-commit` is executable:

```bash
chmod +x .githooks/pre-commit
```

## Disable

```bash
git config --unset core.hooksPath
```

## What runs

1. `npm run typecheck` (backend + frontend)
2. `npm run secrets:scan` if `gitleaks` is on PATH; otherwise warns and continues

## Manual equivalent

```bash
npm run precommit:check
```
