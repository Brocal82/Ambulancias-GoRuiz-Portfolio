---
name: frontend-regression-review
description: Reviews frontend changes for API pattern, locale sync, secure file access, and UX regressions. Use when reviewing React modules, hooks, domain/api.ts, or locale files.
---

# Frontend Regression Review

## Checklist

- [ ] HTTP calls in module `domain/api.ts`, not ad-hoc in components
- [ ] Shared axios from `src/api/axios.ts` only
- [ ] New UI strings added to `de`, `en`, `es` locale files
- [ ] Documents opened via `openSecureFile()`, not `/uploads` for non-images
- [ ] No unintended UI structure refactors or visual changes
- [ ] Existing hook/API patterns preserved

## References

- `.cursor/rules/frontend-modules.mdc`
- `docs/frontend/FRONTEND-STRUCTURE.md`

## Output format

```markdown
## Frontend Regression Review

### Verdict: SAFE / RISK / BLOCK

### Findings
- 🔴 Critical: ...
- 🟡 Warning: ...
```
