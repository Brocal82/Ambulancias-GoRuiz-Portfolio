---
name: safe-to-commit-evaluator
description: Evaluates whether current git changes are safe to commit following project constraints. Use before commits, after feature work, or when the user asks if changes are ready to commit.
---

# Safe-to-Commit Evaluator

## Process

1. Run `git status` and `git diff` (staged + unstaged).
2. Classify changes: tooling-only vs productive logic vs schema/data.
3. Apply project rules from `CLAUDE.md` and `.cursor/rules/`.

## Blockers (NOT SAFE)

- Missing `companyId` checks on new admin write paths
- Public exposure of sensitive files
- Breaking API contracts or auth boundaries
- Destructive scripts, migrations, or seeds included unintentionally
- Secrets or credentials in diff
- Large refactors mixed with feature fixes

## Recommended checks (when backend/frontend code changed)

```bash
npm run typecheck
npm --prefix ambulancias-goruiz-backend run test:security:isolation
npm --prefix ambulancias-goruiz-frontend run test:run
```

Do not run migrations, seeds, cleanup, or backfill scripts unless explicitly requested.

## Output format

```markdown
## Safe-to-Commit Evaluation

### Verdict: SAFE TO COMMIT / NOT SAFE

### Summary
[1-2 sentences]

### Blockers
- ...

### Recommended before commit
- [ ] ...
```
