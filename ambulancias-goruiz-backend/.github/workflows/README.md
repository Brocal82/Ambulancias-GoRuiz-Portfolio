# Backend nested workflows (inactive)

GitHub Actions only runs workflows from the repository root `.github/workflows/`.

These files are kept for reference only. Active CI lives in:

- `.github/workflows/ci.yml` — build, test, worker validate, security isolation
- `.github/workflows/security-branch-enforcement-audit.yml` — branch protection audit
- `.github/workflows/gitleaks.yml` — dedicated secret scan on pull requests

Do not re-enable nested workflows here; consolidate changes at the repo root.
