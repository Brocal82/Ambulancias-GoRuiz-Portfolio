# Gitleaks — Secret Scanning

Minimal secret scanning for the monorepo. Non-aggressive: PR + manual dispatch only.

## Install Gitleaks (manual)

- **Windows:** `choco install gitleaks` or download from [releases](https://github.com/gitleaks/gitleaks/releases)
- **macOS:** `brew install gitleaks`
- **Linux:** see [installing](https://github.com/gitleaks/gitleaks#installing)

## Run locally

```bash
npm run secrets:scan
```

If Gitleaks is not installed, the script exits 0 with a warning (local dev friendly).

## Configuration

- Config: `.gitleaks.toml` (extends default rules + allowlists for `.env.example`, OpenAPI examples)
- CI: `.github/workflows/gitleaks.yml` on `pull_request` to `main` and `workflow_dispatch`

## Reversibility

Remove `.gitleaks.toml`, `.github/workflows/gitleaks.yml`, and `scripts/gitleaks-detect.mjs` to disable entirely.
