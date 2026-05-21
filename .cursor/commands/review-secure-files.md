# Review secure files

Review file handling changes for security regressions.

1. Follow **secure-files-review** skill (`.cursor/skills/secure-files-review/SKILL.md`).
2. Inspect `app.ts` upload middleware, `fileOwnership.ts`, frontend `openSecureFile` usage.
3. Flag any new public access to PDFs or medical documents.
4. Note if `files.security.integration.test.ts` should be run.

Output: verdict (SAFE / RISK / BLOCK) and prioritized findings.
