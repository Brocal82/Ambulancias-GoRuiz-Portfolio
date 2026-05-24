# Domain — Documents (Documentos de empresa)

Documentación del dominio de documentos de empresa: publicación, entrega automática en upload, confirmación de recepción y descarga segura.

---

## Módulo backend

| Recurso | Ruta API | MODULE_KEY |
|---------|----------|------------|
| Documentos | `/api/documents` | `documents` |

Todas las rutas requieren `authenticateToken` + `requireModule("documents")` + rol (`admin` o `worker`).

---

## Modelos

### `CompanyDocument`

Documento publicado por el admin para los workers de la empresa.

```
companyId              ObjectId (required)
uploadedBy             ObjectId (admin)
targetWorkerId         ObjectId | null  — destino único opcional en upload single
uploadBatchId          ObjectId | null  — agrupa subidas batch
originalName           string
filename               string
mimeType               string  — application/pdf
fileUrl                string  — /uploads/<filename>
requiresAcknowledgment boolean — false = informativo; ausente en legacy = requiere ack
deletedAt              Date | null  — soft delete
```

### `DocumentDelivery`

Registro de entrega creado **automáticamente en el upload** (no hay endpoint `/deliver` separado).

```
documentId       ObjectId
workerId         ObjectId
companyId        ObjectId
sentAt           Date
readAt           Date | null
acknowledgedAt   Date | null
```

Índice único: `{ documentId, workerId }`.

---

## Lifecycle

```
[Admin sube PDF]
         │
         ▼
  POST /api/documents/upload  (single + targetWorkerId opcional)
  POST /api/documents/upload/batch  (hasta 50 PDF)
  multer uploadPdfOnly (10 MB) + validación MIME/extensión
  → CompanyDocument { deletedAt: null }
  → DocumentDelivery para todos los workers activos (o un targetWorkerId válido)
  → Si falla validación/DB/distribución: fichero eliminado del disco
         │
         ▼
  WORKER ACCEDE
  GET /api/documents/mine
  GET /api/files/<filename>  — JWT + DocumentDelivery + doc no borrado
  PATCH /api/documents/deliveries/:id/read
         │
         ▼
  [Opcional] CONFIRMACIÓN
  POST /api/documents/deliveries/:id/acknowledge  (+ password)
  → requiresAcknowledgment !== false, readAt obligatorio
         │
         ▼
  [Admin] SOFT DELETE
  DELETE /api/documents/:id  o  DELETE /api/documents/batch/:uploadBatchId
  → deletedAt = now; fichero permanece en disco; acceso denegado en canAccessFile
```

---

## Política PDF-only

- **Upload:** solo `application/pdf` con extensión `.pdf` alineada (MIME mismatch → 400).
- **Multer:** `uploadPdfOnly` en rutas de documentos (no imágenes).
- **Público `/uploads`:** PDFs devuelven 403; acceso vía `GET /api/files/:filename` autenticado.
- **Frontend / mobile admin:** `accept=".pdf,application/pdf"`.

---

## Endpoints

### Admin

| Método | Ruta | Acción |
|--------|------|--------|
| `GET` | `/api/documents` | Listar documentos + métricas ack/read |
| `POST` | `/api/documents/upload` | Subir un PDF (+ targetWorkerId, requiresAcknowledgment) |
| `POST` | `/api/documents/upload/batch` | Subir lote PDF |
| `DELETE` | `/api/documents/:id` | Soft delete |
| `DELETE` | `/api/documents/batch/:uploadBatchId` | Soft delete lote |

### Worker

| Método | Ruta | Acción |
|--------|------|--------|
| `GET` | `/api/documents/mine` | Mis entregas (excluye docs soft-deleted) |
| `PATCH` | `/api/documents/deliveries/:deliveryId/read` | Marcar leído |
| `POST` | `/api/documents/deliveries/:deliveryId/acknowledge` | Confirmar con contraseña |
| `GET` | `/api/files/:filename` | Descargar PDF autenticado |

---

## Autorización de archivos

`canAccessFile()` ramas 7 / 7b — admin por `companyId`; worker solo con `DocumentDelivery` activo y `deletedAt: null`.

---

## Multi-tenant

`companyId` obligatorio en `CompanyDocument` y `DocumentDelivery`. `targetWorkerId` debe ser worker activo de la misma empresa.

---

## Rate limiting

`POST /api/documents/upload*` — `rateLimitUpload` (10 req / 5 min / IP).

---

## Frontend

`src/modules/documents/domain/api.ts` — HTTP en módulo; PDFs con `openSecureFile()`.

Rutas envueltas en `<RequireModule name="documents" />`.

---

## Mobile (app-worker)

Pestaña Documentos visible si `documents` **o** `payroll`. Las APIs de documentos de empresa (`/documents/*`) solo se llaman cuando el módulo `documents` está habilitado.

OpenAPI: `/api/docs` — paths bajo tag **Documents**.
