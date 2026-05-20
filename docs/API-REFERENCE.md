# API Reference

Referencia de todos los endpoints de la API REST. Base URL: `/api`.

Auth requerida salvo indicación contraria. Formato de auth: `Authorization: Bearer <jwt>`.

---

## Autenticación — `/api/users`

| Método | Ruta | Auth | Rol | Descripción |
|--------|------|------|-----|-------------|
| `POST` | `/users/login` | No | — | Login. Rate limit: 5/15min. Devuelve `{ token, user }` |
| `GET` | `/users` | Sí | admin | Listar workers de la empresa |
| `GET` | `/users/available` | Sí | admin | Workers disponibles por fecha/rol |
| `GET` | `/users/:id` | Sí | self/admin | Perfil de usuario |
| `PATCH` | `/users/:id` | Sí | self/admin | Actualizar perfil |
| `DELETE` | `/users/:id` | Sí | admin | Eliminar usuario |
| `POST` | `/users/me/upload` | Sí | self | Subir P-Schein / foto perfil |
| `POST` | `/users/:id/upload` | Sí | admin | Admin sube docs de worker |
| `DELETE` | `/users/me/document` | Sí | self | Eliminar propio P-Schein |
| `DELETE` | `/users/:id/document` | Sí | admin | Admin elimina doc de worker |
| `POST` | `/users/sessions/revoke-all` | Sí | self | Invalidar todos los JWT activos |
| `GET` | `/users/me/mfa/status` | Sí | superadmin | Estado MFA TOTP |
| `POST` | `/users/me/mfa/totp/enroll` | Sí | superadmin | Iniciar enrollment TOTP |
| `POST` | `/users/me/mfa/totp/confirm` | Sí | superadmin | Confirmar TOTP |
| `POST` | `/users/me/mfa/totp/disable` | Sí | superadmin | Desactivar TOTP |
| `POST` | `/users/me/step-up-session` | Sí | superadmin | Emitir token step-up |

---

## Empresas — `/api/companies`

| Método | Ruta | Auth | Rol | Descripción |
|--------|------|------|-----|-------------|
| `GET` | `/companies/metrics/global` | Sí | superadmin | KPIs globales: empresas, usuarios, onboarding pendiente |
| `GET` | `/companies` | Sí | superadmin | Listar empresas activas (`?includeDeleted=true` incluye archivadas) |
| `POST` | `/companies` | Sí | superadmin | Crear empresa |
| `GET` | `/companies/:id` | Sí | superadmin | Detalle empresa (no archivadas) |
| `GET` | `/companies/:id/metrics` | Sí | superadmin | Métricas por módulo habilitado (`scheduling`, `workday`, `vacation`, `mechanics`; resto `null`) |
| `GET` | `/companies/:id/summary` | Sí | superadmin | Resumen: `usersByRole`, flags onboarding |
| `GET` | `/companies/:id/users` | Sí | superadmin | Usuarios del tenant (`?role=`, `?isActive=`, `?limit=`, `?skip=`) |
| `GET` | `/companies/:id/admins` | Sí | superadmin | Solo administradores |
| `PATCH` | `/companies/:id` | Sí | superadmin + step-up | Actualizar empresa |
| `DELETE` | `/companies/:id` | Sí | superadmin + step-up | Soft-delete (`deletedAt`, `isActive: false`) |
| `GET` | `/companies/me` | Sí | admin/worker | Datos de la propia empresa |
| `POST` | `/companies/:id/admin` | Sí | superadmin + step-up | Crear admin para empresa |

Listado: `workerCount` = rol `worker`; `adminCount` = rol `admin`; `userCount` = total; `usersByRole` = desglose completo.

---

## Turnos — `/api/diensts`

| Método | Ruta | Auth | Rol | Descripción |
|--------|------|------|-----|-------------|
| `GET` | `/diensts/calendar/week` | Sí | admin/worker | Vista semanal |
| `GET` | `/diensts/calendar/month` | Sí | admin/worker | Vista mensual |
| `GET` | `/diensts/templates` | Sí | admin | Listar plantillas |
| `POST` | `/diensts/templates` | Sí | admin | Crear plantilla |
| `PUT` | `/diensts/templates/:id` | Sí | admin | Actualizar plantilla |
| `DELETE` | `/diensts/templates/:id` | Sí | admin | Eliminar plantilla |
| `POST` | `/diensts/templates/generate-week` | Sí | admin | Generar semana de turnos |
| `DELETE` | `/diensts/templates/delete-week` | Sí | admin | Eliminar semana generada |
| `POST` | `/diensts/:id/assignments/user` | Sí | admin | Asignar worker a turno |
| `POST` | `/diensts/:id/assignments/team` | Sí | admin | Asignar equipo a turno |
| `POST` | `/diensts/:id/assignments/ambulance` | Sí | admin | Asignar ambulancia |
| `DELETE` | `/diensts/:id/assignments/:aId` | Sí | admin | Eliminar asignación |
| `PATCH` | `/diensts/:id/assignments/:aId` | Sí | admin | Actualizar asignación |

---

## Hospitales — `/api/hospitals`

| Método | Ruta | Auth | Rol | Descripción |
|--------|------|------|-----|-------------|
| `GET` | `/hospitals` | Sí | admin/worker | Listar hospitales empresa |
| `POST` | `/hospitals` | Sí | admin | Crear hospital |
| `PUT` | `/hospitals/:id` | Sí | admin | Actualizar hospital |
| `DELETE` | `/hospitals/:id` | Sí | admin | Eliminar hospital |

---

## Ambulancias — `/api/ambulances`

| Método | Ruta | Auth | Rol | Descripción |
|--------|------|------|-----|-------------|
| `GET` | `/ambulances` | Sí | admin/worker | Listar ambulancias |
| `POST` | `/ambulances` | Sí | admin | Crear ambulancia |
| `PUT` | `/ambulances/:id` | Sí | admin | Actualizar ambulancia |
| `DELETE` | `/ambulances/:id` | Sí | admin | Eliminar ambulancia |

---

## Equipos — `/api/teams`

| Método | Ruta | Auth | Rol | Descripción |
|--------|------|------|-----|-------------|
| `GET` | `/teams` | Sí | admin | Listar equipos empresa |
| `POST` | `/teams` | Sí | admin | Crear equipo |
| `PUT` | `/teams/:id` | Sí | admin | Actualizar equipo |
| `DELETE` | `/teams/:id` | Sí | admin | Eliminar equipo |

---

## Jornada — `/api/trips` + `/api/workday-summary`

Ver `docs/domains/DOMAIN-workday.md` para el lifecycle completo.

| Módulo | Método | Ruta | Rol | Descripción |
|--------|--------|------|-----|-------------|
| trips | `POST` | `/trips` | worker | Abrir jornada |
| trips | `GET` | `/trips/me` | worker | Mis viajes |
| trips | `PATCH` | `/trips/:id` | worker | Actualizar viaje |
| trips | `PATCH` | `/trips/:id/close` | worker | Cerrar viaje |
| trips | `GET` | `/trips/admin` | admin | Todos los viajes empresa |
| workday | `GET` | `/workday-summary` | admin | Jornadas empresa |
| workday | `PATCH` | `/workday-summary/:id/review` | admin | Marcar revisado |
| workday | `POST` | `/workday-summary/:id/final-close` | admin | Cierre final |

---

## Primas — `/api/praemien`

Ver `docs/domains/DOMAIN-praemien.md` para el lifecycle completo.

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `GET` | `/praemien` | admin | Primas del mes |
| `PATCH` | `/praemien/:id/confirm` | admin | Confirmar prima |
| `PATCH` | `/praemien/:id/pay` | admin | Marcar pagada |
| `GET` | `/praemien/worker` | worker | Mis primas |
| `GET` | `/praemien/manual-daily` | admin | Entradas manuales |
| `POST` | `/praemien/manual-daily` | admin | Crear entrada manual |
| `PATCH` | `/praemien/manual-daily/:id` | admin | Editar entrada |
| `DELETE` | `/praemien/manual-daily/:id` | admin | Eliminar entrada |

---

## Nóminas — `/api/payroll`

Ver `docs/domains/DOMAIN-payroll.md`.

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `POST` | `/payroll/upload` | admin | Subir nómina PDF |
| `GET` | `/payroll` | admin | Listar nóminas |
| `PATCH` | `/payroll/:id/match` | admin | Asignar nómina a worker |
| `DELETE` | `/payroll/:id` | admin | Invalidar nómina |
| `GET` | `/payroll/worker/me` | worker | Mis nóminas |

---

## Documentos empresa — `/api/documents`

Ver `docs/domains/DOMAIN-documents.md`.

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `GET` | `/documents` | admin | Listar documentos |
| `POST` | `/documents/upload/batch` | admin | Subir documento(s) |
| `POST` | `/documents/:id/deliver` | admin | Entregar a workers |
| `DELETE` | `/documents/:id` | admin | Eliminar documento |
| `GET` | `/documents/worker/me` | worker | Mis documentos recibidos |
| `PATCH` | `/documents/delivery/:id/acknowledge` | worker | Confirmar recepción |

---

## Bajas — `/api/sick-leaves`

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `GET` | `/sick-leaves` | admin | Bajas empresa |
| `POST` | `/sick-leaves` | worker | Reportar baja |
| `GET` | `/sick-leaves/me` | worker | Mis bajas |
| `PATCH` | `/sick-leaves/:id` | admin/worker | Actualizar baja |
| `DELETE` | `/sick-leaves/:id` | admin | Eliminar baja |

---

## Vacaciones — `/api/vacations`

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `GET` | `/vacations` | admin | Solicitudes empresa |
| `POST` | `/vacations` | worker | Solicitar vacaciones |
| `GET` | `/vacations/me` | worker | Mis solicitudes |
| `PATCH` | `/vacations/:id/accept` | admin | Aceptar solicitud |
| `PATCH` | `/vacations/:id/cancel` | admin/worker | Cancelar solicitud |

---

## Mecánica — `/api/mechanics`

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `POST` | `/mechanics/report-issue` | worker | Reportar avería (rate limit: 10/min) |
| `GET` | `/mechanics/issues` | admin | Averías empresa |
| `POST` | `/mechanics/work-orders` | admin | Crear orden de trabajo |
| `PATCH` | `/mechanics/work-orders/:id` | admin | Actualizar orden |

---

## Mensajes — `/api/messages`

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `GET` | `/messages` | admin/worker | Mensajes recibidos |
| `POST` | `/messages` | admin/worker | Enviar mensaje (rate limit: 30/min) |
| `PATCH` | `/messages/:id/read` | admin/worker | Marcar como leído |
| `DELETE` | `/messages/:id` | admin/worker | Eliminar mensaje (soft) |

---

## Citas — `/api/appointments`

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `GET` | `/appointments` | admin | Citas empresa |
| `POST` | `/appointments` | worker | Solicitar cita |
| `GET` | `/appointments/me` | worker | Mis citas |
| `PATCH` | `/appointments/:id` | admin/worker | Actualizar cita |

---

## Invitaciones — `/api/invitations`

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/invitations` | admin | Crear invitación |
| `POST` | `/invitations/validate` | No | Validar token (25/min) |
| `POST` | `/invitations/accept` | No | Aceptar y crear cuenta (8/15min) |

---

## Notificaciones — `/api/notifications`

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `POST` | `/notifications/tokens` | worker | Registrar push token |
| `DELETE` | `/notifications/tokens` | worker | Eliminar push token |
| `GET` | `/notifications` | worker | Historial notificaciones |

---

## Excel Planning — `/api/excel-planning`

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `POST` | `/excel-planning/imports` | admin | Importar Excel (25/10min) |
| `GET` | `/excel-planning/imports` | admin | Historial importaciones |
| `POST` | `/excel-planning/publish` | admin | Publicar semana |
| `GET` | `/excel-planning/weeks` | admin/worker | Semanas publicadas |

---

## Acceso soporte — `/api/support-access`

Todas las rutas requieren auth + rol `superadmin` (`authorizeSuperadmin`).

### Solicitudes JIT (break-glass)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/support-access/requests` | Crear solicitud (`companyId`, `reason`, `ticketId`, `durationMinutes` 5–240) |
| `GET` | `/support-access/requests` | Listar solicitudes (`?status=pending\|approved\|denied\|revoked\|expired`) |
| `POST` | `/support-access/requests/:id/review` | Aprobar o denegar (`approve`, `reviewComment`) — requiere 2 aprobadores distintos |
| `POST` | `/support-access/requests/:id/revoke` | Revocar acceso aprobado (`reason`) |
| `GET` | `/support-access/active` | Comprobar acceso activo (`?companyId=`) |

### Monitorización (superadmin)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/support-access/monitoring/daily-summary` | Resumen ventana (`?hours=`, default 24, max 168) |
| `GET` | `/support-access/monitoring/audit-logs` | Consulta audit log persistente (filtros query) |
| `GET` | `/support-access/monitoring/health` | Salud operacional del monitoreo |
| `GET` | `/support-access/monitoring/tenant-risk` | Ranking riesgo por tenant (`?hours=`, `?limit=`) |
| `GET` | `/support-access/monitoring/monthly-review` | Snapshot revisión mensual (`?hours=`) |

---

## Archivos seguros y health

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/api/files/:filename` | Sí | Descargar archivo (con canAccessFile + audit) |
| `GET` | `/health` | No | Estado del servidor y MongoDB |
