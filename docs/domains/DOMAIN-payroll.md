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
workerId     ObjectId (ref User)
year         number
month        number (1-12)
fileUrl      string  — ruta relativa: /uploads/<filename>
uploadedBy   ObjectId (ref User admin)
uploadedAt   Date
deletedAt    Date | null  — null = activo; Date = invalidado
matchStatus  "matched" | "unmatched" | "conflict"
```

Índices:
- `{ companyId, workerId, year, month }` — lookup exacto de nómina por trabajador y periodo
- `{ companyId, matchStatus }` — dashboard admin de nóminas con conflictos

**Documentos invalidados:** `deletedAt != null` → el archivo no es accesible por nadie (ni worker ni admin). `canAccessFile()` filtra `{ deletedAt: null }` en todas sus ramas de payroll.

---

## Lifecycle

```
[Admin sube nómina]
      │
      ▼
  UPLOAD
  Admin: POST /api/payroll/upload
  multer (PDF, 10 MB) → file en /uploads/
  → PayrollDocument { deletedAt: null, matchStatus: "matched"|"unmatched" }
      │
      ▼
  WORKER ACCEDE
  Worker: GET /api/payroll/worker/me → lista sus nóminas
  Worker: GET /api/files/<filename>  → descarga autenticada via canAccessFile()
      │
      ▼
  [Opcional] INVALIDACIÓN
  Admin: DELETE /api/payroll/:id
  → deletedAt = Date.now()
  → archivo inaccesible (canAccessFile lo filtra)
      │
      ▼
  [Opcional] RE-UPLOAD
  Admin sube nueva versión → nuevo PayrollDocument
  El invalidado queda en BD para trazabilidad
```

---

## Match status

Al subir una nómina, el sistema intenta emparejarla automáticamente con un worker de la empresa:

| Estado | Significado |
|--------|-------------|
| `matched` | Nómina asociada correctamente a un worker |
| `unmatched` | No se encontró worker para el nombre del PDF |
| `conflict` | Múltiples workers posibles para el mismo nombre |

El admin puede resolver conflictos y asignaciones manuales desde el dashboard de nóminas.

---

## Endpoints

### Admin

| Método | Ruta | Acción |
|--------|------|--------|
| `POST` | `/api/payroll/upload` | Subir nómina(s) PDF |
| `GET` | `/api/payroll` | Listar nóminas empresa (con filtros) |
| `GET` | `/api/payroll/:year/:month` | Nóminas de un periodo |
| `PATCH` | `/api/payroll/:id/match` | Asignar nómina a worker manualmente |
| `DELETE` | `/api/payroll/:id` | Invalidar nómina |

### Worker

| Método | Ruta | Acción |
|--------|------|--------|
| `GET` | `/api/payroll/worker/me` | Mis nóminas activas |
| `GET` | `/api/files/:filename` | Descargar PDF (autenticado, via canAccessFile) |

---

## Seguridad de archivos

Las nóminas son PDFs servidos **exclusivamente** por `GET /api/files/:filename`. Nunca por `/uploads/` (que bloquea PDFs con 403).

`canAccessFile()` para payroll (ramas 6 y 6b):
- Worker: `{ workerId: userOid, fileUrl: storedPath, deletedAt: null }`
- Admin: `{ companyId: companyOid, fileUrl: storedPath, deletedAt: null }`

Ambas ramas excluyen documentos invalidados.

---

## Multi-tenant

`PayrollDocument.companyId` es obligatorio (`required: true`). No hay datos legacy con `companyId: null`. El índice `{ companyId, workerId, year, month }` garantiza aislamiento por empresa.

---

## Frontend

`src/modules/payroll/domain/api.ts` centraliza todas las llamadas HTTP del módulo. Los PDFs se abren con `openSecureFile()` de `src/utils/openSecureFile.ts`.
