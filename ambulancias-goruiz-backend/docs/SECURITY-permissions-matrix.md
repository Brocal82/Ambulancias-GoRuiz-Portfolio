# Security Permissions Matrix (Week 1 baseline)

This matrix defines the current baseline for major roles and sensitive operations.

| Capability / Operation | superadmin | admin | worker |
|---|---:|---:|---:|
| Create/update/delete companies | ✅ | ❌ | ❌ |
| Create first company admin | ✅ | ❌ | ❌ |
| Login to platform | ✅ | ✅ | ✅ |
| Tenant-scoped business CRUD | ❌ (default) | ✅ (same company only) | Limited own-scope |
| Read company files via `/api/files` | ❌ (default) | ✅ (same company rules) | ✅ (ownership/delivery rules) |
| Cross-tenant access | ❌ | ❌ | ❌ |
| Break-glass support access | Planned JIT only | N/A | N/A |

## Notes

- `superadmin` is intentionally excluded from normal tenant data flows.
- `admin` and `worker` operations require backend-enforced company scope.
- `403` vs `404` behavior may vary by endpoint to minimize information leakage.
- New endpoints must include tenant-scope checks and isolation tests before merge.
