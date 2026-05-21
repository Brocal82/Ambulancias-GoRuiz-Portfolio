# Review frontend regressions

Review frontend changes for API, locale, and UX regressions.

1. Follow **frontend-regression-review** skill (`.cursor/skills/frontend-regression-review/SKILL.md`).
2. Check `domain/api.ts` pattern, locale sync (de/en/es), and secure file access.
3. Flag unintended UI refactors or new axios instances.
4. If applicable, note `npm --prefix ambulancias-goruiz-frontend run test:run`.

Output: verdict (SAFE / RISK / BLOCK) and findings. Preserve existing UX.
