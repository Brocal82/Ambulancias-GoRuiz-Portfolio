# Flujo SuperAdmin — estado actual (auditoría)

Referencia del comportamiento **real en código** a mayo 2026. Plan por fases (1–6) completado; mejoras futuras (gráficos, invitaciones admin, wizard) se documentan en issues/PRs aparte.

---

## 1. Rol y alcance

| Propiedad | Valor |
|-----------|--------|
| Rol | `superadmin` |
| `companyId` | `null` / ausente |
| Rutas de empresa (`authorizeRole("admin")`) | **Bloqueadas** (igualdad estricta) |
| Rutas dedicadas | `/api/companies/*`, `/api/support-access/*`, MFA/step-up en `/api/users/me/*` |
| `requireModule` | Bypass automático (no aplica gating por empresa) |

El superadmin gestiona **plataforma** (empresas, módulos, bootstrap de admins, seguridad). No opera el día a día del tenant vía panel admin.

---

## 2. Autenticación

### Login

```
POST /api/users/login
  → rate limit 5 / 15 min por IP
  → user.isActive === true
  → si role !== superadmin y company.isActive === false → error
  → si SUPERADMIN_MFA_REQUIRED=true y role=superadmin → exige mfaCode TOTP
  → JWT: userId, role, tokenVersion [, companyId]
  → TTL: 15m (superadmin/admin privilegiados) vs JWT_EXPIRES_IN (resto)
```

Archivos: `users.service.ts` (`loginUserService`), `authMiddleware.ts`.

### Sesión

- `authenticateToken` valida JWT, `tokenVersion`, rol en BD.
- Superadmin **no** se bloquea por `Company.isActive`.
- Tokens `typ: step_up` rechazados como Bearer de sesión.

### MFA y step-up (solo superadmin)

| Endpoint | Uso |
|----------|-----|
| `GET /api/users/me/mfa/status` | Estado TOTP |
| `POST /api/users/me/mfa/totp/enroll` | Iniciar enrollment |
| `POST /api/users/me/mfa/totp/confirm` | Activar TOTP |
| `POST /api/users/me/mfa/totp/disable` | Desactivar (con código) |
| `POST /api/users/me/step-up-session` | Emitir `stepUpToken` (TTL ~300s) |

Frontend: `SuperadminMfaSettingsPage`, hook `useStepUpSession`.

### Step-up en operaciones de empresa

Headers: `x-step-up-token` o `x-step-up-code` (o body `stepUpCode` / `stepUpToken`).

| Action key | Operación |
|------------|-----------|
| `company.create` | `POST /api/companies` |
| `company.delete` | `DELETE /api/companies/:id` |
| `company.sensitive_update` | `PATCH` si body incluye `isActive`, `emailDomain`, `enabledModules`, `praemienMode`, `praemienModeEffectiveFrom` |
| `company.admin.create` | `POST /api/companies/:id/admin` |
| `support_access.approve` | `POST /api/support-access/requests/:id/review` con `approve: true` |

**No requiere step-up:** denegar JIT (`approve: false`), patch solo de `name`.

---

## 3. API — Empresas (`/api/companies`)

Middleware en bloque (salvo `GET /me`): `authenticateToken` + `authorizeSuperadmin`.

| Método | Ruta | Step-up | Descripción |
|--------|------|---------|-------------|
| `GET` | `/me` | — | Empresa del usuario con `companyId` (admin/worker) |
| `POST` | `/` | Sí | Crear empresa |
| `GET` | `/` | No | Listar empresas + `adminCount` + `workerCount`* |
| `GET` | `/:id` | No | Detalle |
| `PATCH` | `/:id` | Condicional | Actualizar |
| `DELETE` | `/:id` | Sí | Eliminar documento `Company` |
| `GET` | `/:id/admins` | No | Lista admins (name, email) |
| `POST` | `/:id/admin` | Sí | Crear usuario `role: admin` con password |

\* `workerCount` en `companies.service.ts` cuenta **todos** los usuarios con ese `companyId`, no solo `role: worker`. Ver Fase 2 del plan.

### Modelo `Company`

- `name`, `isActive`, `emailDomain` (obligatorio, formato `@dominio`)
- `enabledModules: string[]` — vacío = ningún módulo gateado explícito
- `praemienMode`, `praemienModeEffectiveFrom`
- `createdBy` (opcional)

Reglas de negocio al actualizar módulos: Prämien automático exige `workday`; quitar `ambulances` limpia referencias en teams/diensts.

### Borrado de empresa — decisión pendiente (ADR)

**Comportamiento actual:** `Company.findByIdAndDelete` — **no** elimina usuarios, diensts, trips, ficheros, etc.

**Riesgo:** datos huérfanos y posible fuga de contexto en backups.

**Opciones para Fase 2** (elegir una en revisión):

1. **Soft-delete:** `isActive: false` + flag `deletedAt`; prohibir `DELETE` hard en API.
2. **Hard-delete con cascade** diseñado (script + transacción) — mayor esfuerzo.
3. **Deshabilitar** `DELETE` en API hasta tener cascade — UI solo desactiva.

→ Ver sección ADR al final de este documento.

### Audit events (empresas)

- `company.created`, `company.updated`, `company.deleted`, `company.admin_created`

---

## 4. API — Support access (`/api/support-access`)

Break-glass JIT: registro y gobernanza de acceso temporal a soporte sobre un tenant.

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/requests` | Crear solicitud (`companyId`, `reason`, `ticketId`, `durationMinutes` 5–240) |
| `GET` | `/requests` | Listar (`?status=pending|approved|...`) |
| `POST` | `/requests/:id/review` | Aprobar/denegar (`approve`, `reviewComment`) |
| `POST` | `/requests/:id/revoke` | Revocar activa |
| `GET` | `/active?companyId=` | ¿Hay acceso aprobado no expirado para ese tenant? |

### Reglas (tests + `support-access.service.ts`)

- Solicitante **no** puede aprobar su propia solicitud.
- Mismo revisor **no** puede aprobar dos veces.
- `approvalsRequired: 2` — primera aprobación sigue `pending`; segunda pasa a `approved` y fija `expiresAt`.
- Expiración automática vía job/consulta.

### Monitoring (solo superadmin)

| Método | Ruta |
|--------|------|
| `GET` | `/monitoring/daily-summary?hours=` |
| `GET` | `/monitoring/audit-logs?...` |
| `GET` | `/monitoring/health` |
| `GET` | `/monitoring/tenant-risk?hours=&limit=` |
| `GET` | `/monitoring/monthly-review?hours=` |

**Importante:** JIT **no** otorga acceso a rutas `authorizeRole("admin")`. Es trazabilidad y ventana de soporte acordada; la operación en datos del tenant sigue fuera del panel admin para superadmin (ver `ambulancias-goruiz-backend/docs/security/architecture.md`).

### UI actual

- `SuperadminSecurityMonitoringPage` — métricas y audit logs.
- **No hay** pantalla para crear/aprobar requests (Fase 3).

---

## 5. Frontend — Rutas

Protección: `RequireAuth` → `RequireRole("superadmin")` → `AppLayout`.

| Path | Componente | Archivo |
|------|------------|---------|
| `/superadmin` | Dashboard | `pages/SuperadminDashboard.tsx` |
| `/superadmin/companies` | Lista | `modules/companies/pages/SuperadminCompaniesList.tsx` |
| `/superadmin/companies/new` | Alta | `modules/companies/pages/SuperadminCompanyForm.tsx` |
| `/superadmin/companies/:id` | Edición | `SuperadminCompanyForm.tsx` |
| `/superadmin/companies/:id/admin` | Crear admin | `SuperadminCreateAdmin.tsx` |
| `/superadmin/security-monitoring` | Seguridad | `modules/support-access/pages/SuperadminSecurityMonitoringPage.tsx` |
| `/superadmin/security-mfa` | MFA | `modules/users/pages/SuperadminMfaSettingsPage.tsx` |

API cliente: `modules/companies/domain/api.ts`, `modules/support-access/domain/api.ts`, `modules/users/domain/api.ts` (MFA).

### Lo que el panel permite hoy

- CRUD empresas (delete con confirm + step-up en UI).
- Toggle módulos y `isActive`, dominio email, Prämien.
- Crear admin con contraseña (no vía invitación).
- Ver monitoring de seguridad y configurar MFA.

### Lo que el panel no tiene

- Layout/sidebar dedicado.
- Vista detalle empresa (solo formulario edición).
- Gestión UI de support-access.
- Listado usuarios/workers por empresa.
- Métricas de negocio (diensts, viajes, etc.).
- Invitaciones, suscripciones, storage.

---

## 6. Matriz de capacidades

| Capacidad | Backend | Frontend |
|-----------|---------|----------|
| Listar empresas | Sí | Sí |
| Crear/editar empresa | Sí | Sí |
| Activar/desactivar empresa | Sí | Sí |
| Módulos por empresa | Sí | Sí |
| Crear admin | Sí | Sí |
| Eliminar empresa | Sí (sin cascade) | Sí |
| Listar admins empresa | Sí | Parcial (solo en pantalla crear admin) |
| Invitaciones | No (solo admin) | No |
| Usuarios tenant | No | No |
| Métricas negocio | No | No |
| Support-access CRUD | Sí | No |
| Audit / monitoring | Sí | Sí |
| MFA / step-up | Sí | Sí |
| Plan / billing | No | No |

---

## 7. Diagrama de flujo (alto nivel)

```mermaid
flowchart TD
  Login[POST /users/login] --> MFA{SUPERADMIN_MFA_REQUIRED?}
  MFA -->|sí| TOTP[Código TOTP]
  MFA -->|no| JWT[JWT sesión]
  TOTP --> JWT
  JWT --> Panel[Panel /superadmin]
  Panel --> Companies[Gestión empresas]
  Panel --> SecMon[Security monitoring]
  Panel --> MfaPage[MFA settings]
  Companies --> StepUp{Acción crítica?}
  StepUp -->|sí| StepUpToken[step-up token / TOTP]
  StepUp -->|no| APICompanies[/api/companies]
  StepUpToken --> APICompanies
  SecMon --> APISupport[/api/support-access/monitoring/*]
```

---

## 8. ADR — Borrado de empresa (propuesta Fase 2)

**Contexto:** `DELETE /api/companies/:id` elimina solo el documento Company.

**Decisión recomendada para implementación Fase 2:** **Opción 1 — Soft-delete**

- Sustituir o complementar DELETE con `PATCH isActive: false` + campo `deletedAt` (opcional).
- Ocultar empresas `deletedAt != null` del listado superadmin por defecto.
- Mantener hard-delete solo vía script ops con cascade explícito, no desde API pública.

**Consecuencias:** usuarios de empresa inactiva ya no pueden login (`authMiddleware`); datos históricos conservados; cumplimiento y recuperación más simples.

**Alternativa rechazada por ahora:** hard-delete API sin cascade (estado actual) — riesgo operativo alto.

*Pendiente sign-off del responsable de producto antes de Fase 2.*

---

## 9. Bootstrap superadmin

Script manual (no endpoint público):

```bash
EMAIL=x@example.com PASSWORD=secret npx ts-node scripts/bootstrap-superadmin.ts
```

Ubicación: `ambulancias-goruiz-backend/scripts/bootstrap-superadmin.ts`.

Producción: `SUPERADMIN_MFA_REQUIRED=true`. JIT: `SUPPORT_ACCESS_APPROVALS_REQUIRED=1` si solo hay un superadmin; `=2` si hay dos o más (cuatro ojos). Invitar admin: `POST /companies/:id/admin/invitation` (preferido frente a contraseña manual).
