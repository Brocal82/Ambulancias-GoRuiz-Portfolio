# File Security

Documentación del sistema de seguridad de archivos: dos capas diferenciadas según el tipo de archivo y audiencia.

---

## Arquitectura en dos capas

```
/uploads/*          → Público (solo imágenes)
/api/files/:filename → Autenticado + autorizado por ownership
```

### Capa 1 — `/uploads/*` (público, solo imágenes)

Montado en `src/app.ts` con el middleware `servePublicImages` antes del static handler:

```ts
const ALLOWED_PUBLIC_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const servePublicImages: RequestHandler = (req, res, next) => {
  const ext = path.extname(req.path).toLowerCase();
  if (!ALLOWED_PUBLIC_IMAGE_EXTENSIONS.has(ext)) {
    res.status(403).json({ message: "Acceso no autorizado" });
    return;
  }
  next();
};

app.use("/uploads", servePublicImages, express.static(uploadsDist));
app.use("/uploads", servePublicImages, express.static(uploadsRoot));
```

**Permite:** `.jpg`, `.jpeg`, `.png`, `.webp`

**Bloquea con 403:** cualquier otro tipo, incluyendo `.pdf`, `.xlsx`, `.doc`

**Uso válido:** fotos de perfil (`profileImage`), imágenes de mecánica

**Mensajes — adjuntos (política explícita):**

| Tipo de adjunto | Almacenamiento en disco | Acceso web |
|-----------------|----------------------|------------|
| Imagen (JPG/PNG/WEBP) | `uploads/<filename>` | Público vía `/uploads/*` **solo si** la extensión es imagen; en la UI web/mobile se abre igualmente con `openSecureFile()` → `GET /api/files/:filename` |
| PDF | `uploads/<filename>` | **Nunca** público; solo `GET /api/files/:filename` (sender o recipient explícito) |

Los metadatos del mensaje guardan `url: /uploads/<filename>`. Aunque una imagen podría resolverse por `/uploads`, el producto trata los adjuntos de mensaje como documentos sensibles: el frontend y la app worker usan `openSecureFile()` / equivalente autenticado, no enlaces directos a `/uploads` para PDFs ni para descargas en producción.

**Limpieza de huérfanos:** si falla la validación del body, no hay destinatarios válidos en la empresa, o falla la creación del mensaje, Multer elimina los ficheros subidos. Al borrar un mensaje (admin, `DELETE /api/messages/:id`), se eliminan del disco los adjuntos que ya no estén referenciados por otro mensaje.

### Capa 2 — `GET /api/files/:filename` (autenticado + autorizado)

Requiere:
1. `authenticateToken` → JWT válido, empresa activa, `tokenVersion` correcto
2. `canAccessFile(filename, userId, role, companyId)` → ownership por tipo de documento
3. Audit log de cada acceso (concedido o denegado)

---

## `canAccessFile()` — lógica de autorización

Archivo: `src/utils/fileOwnership.ts`

La función es **deny-by-default**: si ninguna rama hace match, devuelve `false`.

### Ramas de autorización (en orden de evaluación)

| Rama | Tipo de archivo | Quién puede acceder |
|------|-----------------|---------------------|
| 1 | `User.pscheinDocument` | El propio usuario (ownership directo) |
| 2 | `User.pscheinDocument` | Admin de la misma empresa |
| 3 | `SickLeave.documents[]` / `documentUrl` | El trabajador que generó la baja |
| 4 | `SickLeave.documents[]` / `documentUrl` | Admin misma empresa (nuevos + legacy companyId=null) |
| 5 | `Message.attachments[].url` | Solo sender o recipient explícito |
| 6 | `PayrollDocument.fileUrl` | Worker propietario (excluye `deletedAt != null`) |
| 6b | `PayrollDocument.fileUrl` | Admin misma empresa (excluye `deletedAt != null`) |
| 7 | `CompanyDocument.fileUrl` | Admin misma empresa (excluye `deletedAt != null`) |
| 7b | `CompanyDocument.fileUrl` | Worker con `DocumentDelivery` activo |
| 8 | `ExcelPlanningImport.fileUrl` | Solo admin misma empresa |
| 8b | `ExcelPlanningWeek.sourceFileUrl` | Solo admin misma empresa |
| — | Cualquier otro caso | `return false` (denegado) |

### Legacy `companyId = null` en SickLeave (rama 4)

Registros creados antes de la migración multi-tenant tienen `companyId: null`. En este caso se hace populate del usuario y se compara `user.companyId` con `admin.companyId` via `isSameCompany()`:

```ts
const legacySickLeave = await SickLeave.findOne({
  companyId: null,
  $or: [{ documents: storedPath }, { documentUrl: storedPath }],
}).populate<{ user: { companyId?: unknown } }>("user", "companyId").lean();

if (legacySickLeave) {
  if (isSameCompany(userDoc?.companyId, companyId)) return true;
}
```

---

## Upload — configuración Multer

Archivo: `src/middlewares/uploadMiddleware.ts`

| Middleware | Tipos permitidos | Límite |
|------------|-----------------|--------|
| `upload` (general) | JPG, PNG, WEBP, PDF | 10 MB |
| `uploadImages` | JPG, PNG, WEBP | 10 MB |
| `uploadExcel` | XLSX, XLS | 15 MB |

La validación ocurre en `fileFilter`: se comprueban tanto el `mimetype` como la extensión real del archivo. Un archivo `.pdf` con `Content-Type: image/jpeg` sería rechazado.

---

## Rate limiting en uploads

A partir de PR #69 (Fase 3), los endpoints de subida tienen su propio limiter además del global:

| Endpoint | Limiter | Límite |
|----------|---------|--------|
| `POST /api/users/me/upload` | `rateLimitUpload` | 10 req / 5 min / IP |
| `POST /api/users/:userId/upload` | `rateLimitUpload` | 10 req / 5 min / IP |
| `POST /api/documents/upload/*` | `rateLimitUpload` | 10 req / 5 min / IP |
| `POST /api/messages` | `rateLimitMessages` | 30 req / min / IP |
| Todos los `/api/*` | `rateLimitGlobal` | 300 req / min / IP |

---

## Frontend — regla de acceso seguro

**Nunca** usar `<a href="/uploads/...">` para documentos sensibles.

**Siempre** usar `openSecureFile()` de `src/utils/openSecureFile.ts` para:
- PDFs de bajas médicas
- Nóminas (`PayrollDocument`)
- Documentos de empresa (`CompanyDocument`)
- Adjuntos de mensajes
- Archivos Excel de planificación

`openSecureFile()` llama a `GET /api/files/:filename` con el token Bearer en cabecera y abre el blob en una nueva pestaña.

---

## Audit log

Cada acceso a `/api/files/:filename` emite un evento en `SecurityAuditLog`:

| Evento | Cuándo |
|--------|--------|
| `FILE_ACCESS_GRANTED` | Acceso concedido, archivo enviado |
| `FILE_ACCESS_DENIED` | 403 (no autorizado) o 404 (no encontrado) |
| `FILE_ACCESS_DENIED` (error) | Error interno en `canAccessFile()` o al enviar |

Los registros tienen TTL configurable vía `SECURITY_AUDIT_LOG_TTL_DAYS`.
