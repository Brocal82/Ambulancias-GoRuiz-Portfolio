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

---

# 🎨 FRONTEND RULES

- Do NOT refactor UI structure
- Preserve UX exactly
- Avoid new hooks unless necessary
- Prefer existing utilities over new abstractions

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
