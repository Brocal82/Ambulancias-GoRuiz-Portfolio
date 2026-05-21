# Predeploy checklist

Run a minimal, non-destructive pre-deploy verification. **Do not** run migrations, seeds, cleanup, or backfills.

## Checklist

1. **Typecheck**
   ```bash
   npm run typecheck
   ```

2. **Backend security isolation tests**
   ```bash
   npm --prefix ambulancias-goruiz-backend run test:security:isolation
   ```

3. **Frontend unit tests**
   ```bash
   npm --prefix ambulancias-goruiz-frontend run test:run
   ```

4. **Secret scan** (requires [Gitleaks](https://github.com/gitleaks/gitleaks) installed)
   ```bash
   npm run secrets:scan
   ```

5. **Manual reviews** (use sibling commands if code changed):
   - `/review-multitenant` — tenant isolation
   - `/review-secure-files` — file security
   - `/review-auth` — auth boundaries
   - `/review-frontend` — frontend regressions
   - `/safe-to-commit` — final commit readiness

6. **OpenAPI drift** (if API docs touched): follow `swagger-openapi-review` skill.

Report pass/fail per step. Verdict: **READY FOR DEPLOY REVIEW** or **NOT READY** with blockers.
