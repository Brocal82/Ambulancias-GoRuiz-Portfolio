# Domain — Payroll (Nóminas)

Documentación del dominio de nóminas: subida, entrega, invalidación y descarga segura de documentos PDF.

---

## Módulo backend

| Recurso | Ruta API | MODULE_KEY |
|---------|----------|------------|
| Nóminas | `/api/payroll` | `payroll` |

---

## Modelos

### `PayrollDocument`

```
companyId    ObjectId (required)
workerId     ObjectId | null (ref User; null solo si unmatched)
year         number
month        number (1-12)
filename     string  — basename en disco (sanitizado, compatible con /api/files)
originalName string  — nombre original del cliente (solo auto-match)
fileUrl      string  — ruta relativa: /uploads/<filename> (interno, no expuesto)
uploadedBy   ObjectId (ref User admin)
matchStatus  "manual" | "matched" | "unmatched"
matchReason  string (opcional, unmatched)
parsedEmployeeNumber string (opcional)
deletedAt    Date | null  — null = activo; Date = invalidado
```

Índices:
- `{ companyId, workerId, year, month }` — lookup exacto de nómina por trabajador y periodo
- `{ companyId, matchStatus }` — dashboard admin de nóminas sin asignar

**Documentos invalidados:** `deletedAt != null` → el archivo no es accesible por nadie (ni worker ni admin). `canAccessFile()` filtra `{ deletedAt: null }` en todas sus ramas de payroll. El fichero permanece en disco para posible restauración futura.

---

## Lifecycle

```
[Admin sube nómina PDF]
      │
      ▼
  UPLOAD (uploadPdfOnly — solo PDF, max 10 MB)
  multer sanitiza basename → file en /uploads/
  → PayrollDocument { deletedAt: null, matchStatus: "matched"|"unmatched"|"manual" }
      │
      ▼
  [Si matched/manual con workerId] REEMPLAZO
  Nóminas activas anteriores del mismo worker+periodo → deletedAt = now
      │
      ▼
  EMPLEADO ACCEDE
  GET /api/payroll/mine → lista sus nóminas (filtrado por companyId si JWT lo incluye)
  GET /api/files/<filename>  → descarga autenticada via canAccessFile()
      │
      ▼
  [Opcional] INVALIDACIÓN
  Admin: PATCH /api/payroll/:id/invalidate
  → deletedAt = Date.now()
  → archivo inaccesible (canAccessFile lo filtra)
```

**Limpieza en fallo:** si la validación del worker, MIME mismatch, resolución de filename, creación en BD o invalidación de reemplazo falla, el fichero subido se elimina del disco (y el registro parcial en BD se revierte).

---

## Match status

Al subir una nómina sin `workerId`, el sistema intenta emparejarla automáticamente con un worker activo (`role: "worker"`) de la empresa del admin:

| Estado | Significado |
|--------|-------------|
| `matched` | Exactamente un worker activo coincide por `employeeNumber` en el filename |
| `unmatched` | Cero coincidencias, ambigüedad, o número demasiado corto |
| `manual` | Admin proporcionó `workerId` o asignó vía PATCH /assign |

El admin resuelve unmatched con `PATCH /api/payroll/:id/assign`.

---

## Roles con acceso a nóminas propias

`GET /api/payroll/mine` y descarga segura están disponibles para:

- `worker`
- `mecanico`
- `jefe_mecanicos`
- `jefe_logistica`

Requisitos: módulo `payroll` habilitado + JWT válido. Solo ven documentos con su `workerId` y, cuando el JWT incluye `companyId`, solo de su empresa actual.

**Nota:** la subida y asignación manual (`POST /upload`, `PATCH /assign`) solo aceptan destinatarios con `role: "worker"`. Los roles mecánico/jefe pueden recibir nóminas si un admin les asigna explícitamente su userId como worker (no soportado hoy) o si fueron creados como worker previamente.

Operaciones admin (`GET /`, upload, assign, invalidate, coverage) requieren `role: "admin"`.

---

## Endpoints

### Admin

| Método | Ruta | Acción |
|--------|------|--------|
| `POST` | `/api/payroll/upload` | Subir nómina PDF (manual o auto-match) |
| `POST` | `/api/payroll/upload/batch` | Subir hasta 20 PDFs (auto-match por archivo) |
| `GET` | `/api/payroll` | Listar nóminas activas de la empresa |
| `PATCH` | `/api/payroll/:id/assign` | Asignar nómina unmatched a worker |
| `PATCH` | `/api/payroll/:id/invalidate` | Invalidar nómina (soft-delete) |
| `GET` | `/api/payroll/missing?year&month` | Cobertura: workers sin nómina confirmada |
| `GET` | `/api/payroll/coverage/year?year` | Resumen anual por mes |

### Empleados (worker, mecanico, jefe_mecanicos, jefe_logistica)

| Método | Ruta | Acción |
|--------|------|--------|
| `GET` | `/api/payroll/mine` | Mis nóminas activas |
| `GET` | `/api/files/:filename` | Descargar PDF (autenticado, via canAccessFile) |

---

## Seguridad de archivos

- **Upload:** `uploadPdfOnly` en middleware + validación MIME/extensión en controller.
- **Almacenamiento:** basename sanitizado (`sanitizeMulterBasename`) compatible con `validateSecureUploadFilename`.
- **Descarga:** exclusivamente `GET /api/files/:filename`. Nunca por `/uploads/` (403 para PDF).

`canAccessFile()` para payroll (ramas 6 y 6b):
- Worker: `{ workerId: userOid, fileUrl, deletedAt: null }` + `companyId` cuando el JWT lo incluye
- Admin: `{ companyId: companyOid, fileUrl, deletedAt: null }`

---

## Multi-tenant

`PayrollDocument.companyId` es obligatorio (`required: true`). No hay datos legacy con `companyId: null`. Todas las operaciones admin usan `requireCompanyForAdmin`. Auto-match y asignación verifican `companyId` del worker destino.

---

## Frontend

`src/modules/payroll/domain/api.ts` centraliza todas las llamadas HTTP del módulo. Los PDFs se abren con `openSecureFile()` de `src/utils/openSecureFile.ts`. Uploads aceptan solo `.pdf,application/pdf` (`PAYROLL_PDF_ACCEPT`).
