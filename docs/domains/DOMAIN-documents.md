# Domain — Documents (Documentos de empresa)

Documentación del dominio de documentos de empresa: publicación, entrega controlada y descarga segura.

---

## Módulo backend

| Recurso | Ruta API | MODULE_KEY |
|---------|----------|------------|
| Documentos | `/api/documents` | siempre activo (sin MODULE_KEY) |

---

## Modelos

### `CompanyDocument`

Documento publicado por el admin para los workers de la empresa.

```
companyId    ObjectId (required)
title        string
description  string?
fileUrl      string  — ruta relativa: /uploads/<filename>
fileType     "pdf" | "image" | "other"
uploadedBy   ObjectId (ref User admin)
createdAt    Date
deletedAt    Date | null
```

Índice: `{ companyId, createdAt: -1 }` — listado por empresa ordenado cronológicamente.

### `DocumentDelivery`

Registro de entrega: qué workers han recibido (y potencialmente confirmado) un documento.

```
documentId   ObjectId (ref CompanyDocument)
workerId     ObjectId (ref User)
companyId    ObjectId
deliveredAt  Date
acknowledgedAt Date?
```

Índice único: `{ documentId, workerId }` — un registro de entrega por documento y worker.

---

## Lifecycle

```
[Admin crea documento]
         │
         ▼
  UPLOAD Y PUBLICACIÓN
  Admin: POST /api/documents/upload/batch
  multer (PDF/img, 10 MB) + metadata
  → CompanyDocument { deletedAt: null }
         │
         ▼
  ENTREGA A WORKERS
  Admin: POST /api/documents/:id/deliver
  { workerIds: [...] }
  → DocumentDelivery por cada worker seleccionado
         │
         ▼
  WORKER ACCEDE
  Worker: GET /api/documents/worker/me → documentos entregados
  Worker: GET /api/files/<filename>    → descarga autenticada
         │
         ▼
  [Opcional] ACK / CONFIRMACIÓN
  Worker: PATCH /api/documents/delivery/:id/acknowledge
  → acknowledgedAt = Date.now()
         │
         ▼
  [Opcional] ELIMINACIÓN
  Admin: DELETE /api/documents/:id
  → deletedAt = Date.now()
  → inaccesible en canAccessFile({ deletedAt: null })
```

---

## Endpoints

### Admin

| Método | Ruta | Acción |
|--------|------|--------|
| `GET` | `/api/documents` | Listar documentos empresa |
| `POST` | `/api/documents/upload/batch` | Subir documento(s) |
| `POST` | `/api/documents/:id/deliver` | Entregar a workers seleccionados |
| `DELETE` | `/api/documents/:id` | Eliminar/invalidar documento |
| `DELETE` | `/api/documents/batch` | Eliminación masiva |
| `GET` | `/api/documents/:id/deliveries` | Ver estado de entregas |

### Worker

| Método | Ruta | Acción |
|--------|------|--------|
| `GET` | `/api/documents/worker/me` | Mis documentos entregados |
| `PATCH` | `/api/documents/delivery/:id/acknowledge` | Confirmar recepción |
| `GET` | `/api/files/:filename` | Descargar documento (autenticado) |

---

## Autorización de archivos

`canAccessFile()` para documentos de empresa (ramas 7 y 7b):

**Admin (rama 7):**
```ts
CompanyDocument.findOne({ companyId, fileUrl, deletedAt: null })
```

**Worker (rama 7b):**
```ts
const doc = await CompanyDocument.findOne({ companyId, fileUrl, deletedAt: null });
if (doc) {
  const delivery = await DocumentDelivery.findOne({
    companyId,
    documentId: doc._id,
    workerId: userOid,
  });
  if (delivery) return true;
}
```

Un worker solo puede acceder a un documento si tiene un `DocumentDelivery` activo. El mero hecho de pertenecer a la empresa no es suficiente.

---

## Multi-tenant

`CompanyDocument.companyId` y `DocumentDelivery.companyId` son obligatorios. No hay datos legacy. El índice `{ documentId, workerId }` en `DocumentDelivery` es cross-tenant intencionalmente (un ObjectId de documento es ya único a nivel global en MongoDB).

---

## Rate limiting

`POST /api/documents/upload/*` tiene `rateLimitUpload` (10 req / 5 min / IP) además del límite global.

---

## Frontend

`src/modules/documents/domain/api.ts` expone:
- `listAdminDocuments()` — listado admin
- `uploadDocumentsBatch(formData)` — subida
- `deleteDocument(id)` — eliminación individual
- `deleteDocumentBatch(ids)` — eliminación masiva

Los documentos PDF se abren con `openSecureFile()`.
