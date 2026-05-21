---
name: swagger-openapi-review
description: Reviews OpenAPI spec and docs routes for accuracy, security exposure, and drift from implemented endpoints. Use when changing openapi.yaml, docs routes, or API surface documentation.
---

# Swagger / OpenAPI Review

## Principles

- Document only endpoints that exist and match real behavior.
- Do not invent request/response fields or status codes.
- Prefer minimal surface: health + auth basics unless explicitly expanded.
- Do not document internal/superadmin-only ops without security review.

## Checklist

- [ ] Paths match actual Express routes (`/health`, `/api/users/login`, etc.)
- [ ] Request bodies match Zod schemas in backend
- [ ] Response shapes match controller/service returns
- [ ] `/api/docs` and `/api/docs.json` serve the same spec
- [ ] No secrets, example tokens, or real credentials in spec
- [ ] Cross-check with `docs/API-REFERENCE.md` when in doubt

## References

- `ambulancias-goruiz-backend/src/openapi/openapi.json`
- `docs/API-REFERENCE.md`

## Output format

```markdown
## OpenAPI Review

### Verdict: ACCURATE / DRIFT / UNSAFE

### Drift findings
- ...
```
