# Review multi-tenant isolation

Review changes for multi-tenant `companyId` enforcement.

1. Follow **multi-tenant-review** skill (`.cursor/skills/multi-tenant-review/SKILL.md`).
2. Focus on services (not only routes) for admin write paths.
3. Verify legacy null `companyId` fallback via `isSameCompany` is preserved where needed.
4. If backend tenant code changed, note that `npm --prefix ambulancias-goruiz-backend run test:security:isolation` should pass.

Output: verdict, findings, files reviewed. Do not modify productive logic unless fixing a confirmed isolation bug.
