# Review auth boundaries

Review auth and authorization changes for regressions.

1. Read `.cursor/rules/auth-boundaries.mdc` and `docs/AUTH.md`.
2. Inspect changed files under `middlewares/`, `**/routes.ts`, and auth-related services.
3. Verify middleware order: `authenticateToken → requireModule → authorizeRole → [requireStepUp]`.
4. Confirm `superadmin` is not accidentally granted via `authorizeRole("admin")`.
5. Check rate limits on login, uploads, and invitations were not bypassed.

Output: verdict (SAFE / RISK / BLOCK), findings by severity, files reviewed.
