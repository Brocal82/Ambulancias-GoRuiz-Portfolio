# 🚑 Ambulancias GoRuiz — AI Rules (CLAUDE.md)

## 🚨 CRITICAL RULE: DO NOT BREAK WORKING FEATURES

This is a real system with:

- workers
- medical data
- documents
- scheduling logic

❗ NEVER introduce breaking changes  
❗ ALWAYS prefer minimal, surgical modifications

---

# 🧠 WORKFLOW (MANDATORY)

Every response MUST follow:

1. Analysis
2. Problems detected
3. Verdict (SAFE TO COMMIT / NOT SAFE)
4. Proposed changes
5. Exact files affected

If implementation is requested:

- Keep changes minimal
- No refactors unless explicitly asked

---

# 🔒 MULTI-TENANT (companyId) RULES

All admin operations MUST be scoped by companyId.

Correct pattern:

- New records:
  → direct check  
  `record.companyId === admin.companyId`

- Legacy records (companyId = null):
  → fallback via user  
  `isSameCompany(user.companyId, admin.companyId)`

❌ NEVER:

- Remove legacy fallback
- Trust only userId relationships
- Skip company checks in services

---

# 📁 FILE SECURITY RULES

Uploads system rules:

- `/api/files/:filename` → AUTHENTICATED (documents, PDFs)
- `/uploads` → PUBLIC ONLY FOR IMAGES (.jpg, .png, .webp)

❌ NEVER expose:

- PDFs
- medical documents
- attachments
  via public `/uploads`

Frontend:

- ALWAYS use `openSecureFile()` for documents
- NEVER use direct `<a href="/uploads/...">` for sensitive files

---

# ⚙️ BACKEND RULES

- Do NOT change schemas unless required
- Do NOT introduce new dependencies
- Reuse existing utilities:
    - isSameCompany
    - requireCompanyForAdmin
- Avoid duplicate queries unless necessary
- Prefer service-level enforcement (not only controller)
- Controllers only: parse request → call service → return JSON. No business logic or DB queries in controllers.
- companyId enforcement belongs in the service layer, not only at the route or controller level.

**Domain-critical modules:** Some domains (e.g. `diensts` / scheduling) have lifecycle constraints across sub-modules. Read `ambulancias-goruiz-backend/docs/DOMAIN-diensts.md` before modifying scheduling logic.

---

# 🎨 FRONTEND RULES

- Do NOT refactor UI structure
- Preserve UX exactly
- Avoid new hooks unless necessary
- Prefer existing utilities over new abstractions
- Follow existing API call patterns: HTTP calls belong in each module's `domain/api.ts`, using the shared axios instance. Do not introduce new calling patterns.

Examples:

- Use `openSecureFile` instead of new download logic
- Do NOT replace `<img>` without explicit instruction

---

# 🔄 CHANGE STRATEGY

- One change at a time
- One module at a time
- Keep diffs small
- Maintain backward compatibility

---

# ❌ NEVER DO

- Large refactors
- Renaming files/folders
- Changing APIs without request
- Mixing multiple concerns
- Breaking legacy data behavior

---

# ✅ ALWAYS DO

- Minimal safe changes
- Preserve behavior
- Respect existing patterns
- Keep legacy support (companyId = null)

---

# 🎯 GOAL

Incrementally improve:

- security
- multi-tenant isolation
- file handling

WITHOUT breaking the system.

---

# 📋 ADDITIONAL CONTEXT

This file provides global rules. File-specific operational guidance lives in `.cursor/rules/`:

- `backend-modules.mdc` — backend module structure and utility imports (activates on `src/modules/**`)
- `frontend-modules.mdc` — frontend API patterns, locale sync, shared components (activates on `src/**`)
