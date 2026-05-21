---
name: secure-files-review
description: Reviews file upload, download, and static serving for security regressions. Use when changes touch /uploads, /api/files, fileOwnership, openSecureFile, multer, or document modules.
---

# Secure Files Review

## Checklist

- [ ] `/uploads` still restricted to image extensions only (`.jpg`, `.jpeg`, `.png`, `.webp`)
- [ ] Sensitive files use `GET /api/files/:filename` with `authenticateToken` + `canAccessFile`
- [ ] Frontend uses `openSecureFile()` for PDFs and medical attachments
- [ ] No new public links to PDFs, payroll, sick-leave, or message attachments
- [ ] File access emits audit logs where existing pattern applies

## References

- `docs/FILE-SECURITY.md`
- `ambulancias-goruiz-backend/src/utils/fileOwnership.ts`
- Test: `src/__tests__/files.security.integration.test.ts`

## Output format

```markdown
## Secure Files Review

### Verdict: SAFE / RISK / BLOCK

### Findings
- 🔴 Critical: ...
- 🟡 Warning: ...
```
