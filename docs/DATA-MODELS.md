# Data Models

Referencia de los modelos MongoDB del sistema. Todos los modelos usan Mongoose 8 con TypeScript.

---

## Convenciones

- `companyId: ObjectId` — discriminador de tenant. Obligatorio en modelos nuevos; nullable en legacy (ver `MULTI-TENANT.md`).
- `timestamps: true` — todos los modelos tienen `createdAt` y `updatedAt` salvo indicación.
- Los índices están definidos como `Schema.index(...)` al final del schema o como `index: true` inline.

---

## User

Colección: `users`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `name` | String | Nombre |
| `lastName` | String | Apellido |
| `email` | String, unique | Email de acceso |
| `password` | String | Hash bcrypt |
| `role` | Enum | `admin`, `worker`, `mecanico`, `jefe_mecanicos`, `jefe_logistica`, `superadmin` |
| `ambulanceRole` | Enum? | `driver`, `medic`, `both` |
| `companyId` | ObjectId? | Empresa. Null para superadmin. |
| `isActive` | Boolean | Default `true`. False = no puede hacer login. |
| `pscheinDocument` | String? | Ruta `/uploads/<filename>` del P-Schein |
| `pscheinExpiry` | String? | Fecha expiración P-Schein (ISO) |
| `profileImage` | String? | Ruta imagen de perfil |
| `rotationMode` | Enum | `rotating`, `fixed`, `none` |
| `fixedDienstNumber` | Number? | Solo si `rotationMode: fixed` |
| `employeeNumber` | String? | Número de empleado |
| `invitationId` | ObjectId? | Invitación de origen |
| `mfaTotpEnabled` | Boolean | MFA TOTP activo |
| `mfaTotpSecret` | String? | Secret TOTP (select: false) |

Índices: `email` unique, `isActive`, `{ companyId, isActive }`

---

## Company

Colección: `companies`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `name` | String | Nombre de la empresa |
| `isActive` | Boolean | Empresa habilitada |
| `deletedAt` | Date? | Soft-delete superadmin; null = visible en listados |
| `enabledModules` | String[] | MODULE_KEYs habilitados |
| `praemienMode` | Enum | `automatic`, `manual` |
| `praemienModeEffectiveFrom` | `{ year, month }`? | Fecha de vigencia del modo |

---

## Dienst

Colección: `diensts` — Turnos de trabajo

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `companyId` | ObjectId? | Nullable (legacy) |
| `dienstNumber` | Number | Número de turno |
| `weekStartDate` | Date | Lunes de la semana |
| `dayOfWeek` | Enum | `monday`…`sunday` |
| `startTime`, `endTime` | String | Horario HH:MM |
| `assignments` | Array | Asignaciones (usuarios, equipos, ambulancia) |

Índices: `{ companyId, weekStartDate }`, `{ companyId, dienstNumber }`

---

## DienstTemplate

Colección: `dienst-templates` — Plantillas de turno

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `companyId` | ObjectId, required | Empresa (no legacy) |
| `dienstNumber` | Number | Número de plantilla |
| `dayOfWeek` | Enum | Día de la semana |
| `startTime`, `endTime` | String | Horario |
| `rotationCycle` | Number | Ciclo de rotación |

Índice: `{ companyId, dienstNumber }` unique

---

## Team

Colección: `teams`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `driver` | ObjectId (ref User) | Conductor |
| `medic` | ObjectId (ref User) | Sanitario |
| `companyId` | ObjectId, required | Empresa |
| `rotationMode` | Enum | `rotating`, `fixed`, `none` |
| `fixedDienstNumber` | Number? | Turno fijo si `rotationMode: fixed` |
| `ambulanceId` | ObjectId? | Ambulancia fija del equipo |

Índice: `{ driver, medic, companyId }` unique, `companyId`

---

## Trip

Colección: `trips` — Viajes/jornadas

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `assignmentId` | ObjectId | Asignación de Dienst |
| `date` | Date | Fecha del viaje |
| `workerId` | ObjectId (ref User) | Trabajador |
| `companyId` | ObjectId? | Nullable (legacy) |
| `startTime`, `endTime` | String | Horario real |
| `hospital` | ObjectId? | Hospital destino |
| `ambulanceId` | ObjectId? | Ambulancia usada |
| `status` | Enum | `open`, `closed` |
| `isFinalClosure` | Boolean | Cierre definitivo |

Índices: `{ assignmentId, date }`, `{ companyId, date }`

---

## WorkdaySummary

Colección: `workday-summaries`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `assignmentId` | ObjectId | Asignación de Dienst |
| `date` | Date | Fecha |
| `workerId` | ObjectId | Trabajador |
| `companyId` | ObjectId? | Nullable (legacy) |
| `totalHours` | Number | Horas trabajadas |
| `status` | Enum | `pending_review`, `reviewed` |
| `isFinalClosure` | Boolean | Cierre definitivo |
| `reviewedAt` | Date? | Cuándo revisó el admin |
| `reviewedBy` | ObjectId? | Admin que revisó |

Índice: `{ assignmentId, date }` unique partial (`isFinalClosure: true`)

---

## MonthlyPraemie

Colección: `monthly-praemies`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `userId` | ObjectId (ref User) | Trabajador |
| `companyId` | ObjectId? | Nullable (legacy) |
| `year`, `month` | Number | Periodo |
| `totalHours` | Number | Horas del mes |
| `praemieAmount` | Number | Importe de la prima |
| `status` | Enum | `draft`, `confirmed`, `paid` |
| `confirmedAt` | Date? | — |
| `confirmedBy` | ObjectId? | Admin que confirmó |

Índice: `{ userId, year, month }` unique

---

## PayrollDocument

Colección: `payroll-documents`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `companyId` | ObjectId, required | Empresa |
| `workerId` | ObjectId | Trabajador |
| `year`, `month` | Number | Periodo |
| `fileUrl` | String | `/uploads/<filename>` |
| `uploadedBy` | ObjectId | Admin |
| `deletedAt` | Date? | Null = activo |
| `matchStatus` | Enum | `matched`, `unmatched`, `conflict` |

Índices: `{ companyId, workerId, year, month }`, `{ companyId, matchStatus }`

---

## CompanyDocument

Colección: `company-documents`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `companyId` | ObjectId, required | Empresa |
| `title` | String | Título |
| `fileUrl` | String | Ruta del archivo |
| `uploadedBy` | ObjectId | Admin |
| `deletedAt` | Date? | Null = activo |

Índice: `{ companyId, createdAt: -1 }`

---

## DocumentDelivery

Colección: `document-deliveries`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `documentId` | ObjectId (ref CompanyDocument) | Documento |
| `workerId` | ObjectId | Destinatario |
| `companyId` | ObjectId | Empresa |
| `deliveredAt` | Date | Cuándo se entregó |
| `acknowledgedAt` | Date? | Confirmación del worker |

Índice: `{ documentId, workerId }` unique

---

## SickLeave

Colección: `sick-leaves`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `user` | ObjectId (ref User) | Trabajador |
| `companyId` | ObjectId? | Nullable (legacy) |
| `startDate`, `endDate` | Date | Periodo de baja |
| `documents` | String[] | Rutas de documentos adjuntos |
| `documentUrl` | String? | (legacy, campo único) |
| `status` | Enum | `pending`, `active`, `closed` |

Índices: `{ user, startDate, endDate }`, `{ startDate, endDate }`, `companyId`

---

## VacationRequest

Colección: `vacation-requests`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `user` | ObjectId (ref User) | Trabajador |
| `companyId` | ObjectId? | Nullable (legacy) |
| `startDate`, `endDate` | Date | Fechas solicitadas |
| `status` | Enum | `pending`, `accepted`, `cancelled`, `option_sent`, `cancel_requested` |
| `adminOptionStartDate`, `adminOptionEndDate` | Date? | Contrapropuesta admin |
| `userResponse` | Enum? | `accepted`, `cancelled` |

Índices: `companyId`, `{ user, status }`, `{ companyId, status, startDate }`

---

## Message

Colección: `messages`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `sender` | ObjectId (ref User) | Remitente |
| `recipients` | ObjectId[] | Destinatarios |
| `companyId` | ObjectId? | Nullable (legacy) |
| `subject` | String | Asunto |
| `body` | String | Cuerpo del mensaje |
| `attachments` | Array | `{ url, filename, mimetype }` |
| `readBy` | ObjectId[] | Quién ha leído |
| `removedBy` | ObjectId[] | Quién lo eliminó (soft delete) |
| `sentAt` | Date | — |

Índices: `{ recipients, sentAt }`, `readBy`, `removedBy`, `companyId`

---

## SecurityAuditLog

Colección: `security-audit-logs`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `event` | String | Tipo de evento |
| `outcome` | Enum | `success`, `denied`, `error` |
| `at` | Date | Timestamp (TTL index) |
| `actorUserId` | ObjectId? | Usuario que realizó la acción |
| `actorRole` | String? | Rol en el momento |
| `tenantCompanyId` | ObjectId? | Empresa del actor |
| `httpMethod`, `path`, `ip` | String | Contexto HTTP |
| `resourceType`, `resourceId` | String? | Recurso afectado |
| `reason` | String? | Motivo si es denegado |

Índice TTL en `at` (retención configurable via `SECURITY_AUDIT_LOG_TTL_DAYS`).
