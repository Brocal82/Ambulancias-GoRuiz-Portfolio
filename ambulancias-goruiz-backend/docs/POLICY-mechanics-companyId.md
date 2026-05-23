# Policy: MechanicsIssue `companyId`

**Status:** Active  
**Scope:** `MechanicsIssue` documents and `/api/mechanics` issue mutations

## New records

- `POST /api/mechanics/report-issue` **requires** `dienst.companyId` on the resolved assignment.
- New issues are always persisted with `companyId` copied from the dienst (server-derived; never from the client body).
- If the dienst has no valid `companyId`, the report is rejected with `403`.

## Legacy records (`companyId = null`)

- Historical issues may exist without `companyId` (pre multi-tenant modeling).
- **Reads:** tenant-scoped list endpoints filter by admin/worker `companyId`; legacy rows without `companyId` are not returned in tenant lists.
- **Mutations (delete, mark seen):** use tenant-scoped queries `{ _id, companyId: callerCompanyId }`.
  - If a document exists but does not match the caller's company (including legacy null), the API returns **`403`** (not a cross-tenant update).
  - If no document exists, returns **`404`**.

## Attachments (images)

- Mechanic issue photos use `uploadImagesOnly` (JPG/PNG/WEBP) and are served via public `/uploads/` (images only policy).
- Uploaded files are removed when body validation, assignment validation, tenant validation, or ambulance validation fails after Multer.

## Work orders

- `MechanicsWorkOrder` always requires `companyId` on create.
- `assignedTo` must be a user with role `mecanico` or `jefe_mecanicos` in the same company.
