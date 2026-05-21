# Safe to commit

Evaluate whether current git changes are safe to commit.

1. Read and follow the **safe-to-commit-evaluator** skill (`.cursor/skills/safe-to-commit-evaluator/SKILL.md`).
2. Run `git status` and `git diff` (include staged changes).
3. Apply rules from `CLAUDE.md` and `.cursor/rules/`.
4. If productive code changed, suggest running `npm run typecheck` (do not auto-commit or auto-push).
5. Respond with verdict: **SAFE TO COMMIT** or **NOT SAFE**, blockers, and exact files affected.

Do not run migrations, seeds, cleanup, backfill, or delete scripts.
