# Security Layer

Documentación de todas las capas de seguridad del backend: middlewares, rate limiting, helmet, audit log, y step-up sessions.

---

## Stack de middlewares (orden de ejecución)

```
Request
  │
  ├─ helmet()              — HTTP security headers
  ├─ cors()                — CORS whitelist (ALLOWED_ORIGINS + FRONTEND_URL)
  ├─ compression()
  ├─ morgan()              — (solo producción)
  ├─ express.json({ limit: "100kb" })
  │
  ├─ /uploads → servePublicImages → static    (imágenes públicas)
  ├─ /health                                  (sin auth)
  │
  ├─ rateLimitGlobal       — 300 req/min/IP en /api/*
  ├─ rateLimitLogin        — 5 req/15min/IP en POST /api/users/login
  ├─ rateLimitMessages     — 30 req/min/IP en /api/messages
  ├─ rateLimitUpload       — 10 req/5min/IP en /api/users/*/upload, /api/documents/upload
  ├─ rateLimitReportIssue  — 10 req/min/IP en POST /api/mechanics/report-issue
  ├─ rateLimitInvitation*  — 8/25 req/15min-1min en /api/invitations/*
  │
  ├─ [rutas API]
  │    ├─ authenticateToken     — JWT Bearer, tokenVersion, empresa activa
  │    ├─ authorizeRole(...)    — igualdad estricta de rol
  │    ├─ requireModule(...)    — feature gating por empresa
  │    ├─ requireStepUp(...)    — MFA/step-up para acciones críticas
  │    └─ validateBody(schema)  — Zod body validation
  │
  ├─ GET /api/files/:filename → authenticateToken → canAccessFile() → audit log
  │
  ├─ notFoundHandler
  └─ errorHandler
```

---

## Rate limiting

Archivo: `src/middlewares/rateLimit.ts` + montaje en `src/app.ts`

| Limiter | Ruta | Límite | Skip en test |
|---------|------|--------|--------------|
| `rateLimitGlobal` | `app.use("/api", ...)` | 300 req / 1 min / IP | Sí |
| `rateLimitLogin` | `POST /api/users/login` | 5 req / 15 min / IP | No |
| `rateLimitMessages` | `POST /api/messages` | 30 req / 1 min / IP | Sí |
| `rateLimitUpload` | `/api/users/*/upload`, `/api/documents/upload` | 10 req / 5 min / IP | Sí |
| `rateLimitReportIssue` | `POST /api/mechanics/report-issue` | 10 req / 1 min / IP | No |
| `rateLimitInvitationAccept` | `POST /api/invitations/accept` | 8 req / 15 min / IP | Sí |
| `rateLimitInvitationValidate` | `POST /api/invitations/validate` | 25 req / 1 min / IP | Sí |
| `rateLimitExcelPlanningImport` | `POST /api/excel-planning/imports` | 25 req / 10 min / IP | Sí |

Los límites globales son configurables via env: `RATE_LIMIT_GLOBAL_MAX` (default 300), `RATE_LIMIT_GLOBAL_WINDOW_MS` (default 60000 ms).

---

## Autenticación — `authenticateToken`

Archivo: `src/middlewares/authMiddleware.ts`

Pasos de validación:
1. Extrae Bearer token del header `Authorization`
2. Verifica firma JWT con `JWT_SECRET`
3. Rechaza tokens con `typ: step_up` (no son tokens de sesión)
4. Busca el usuario en BD: debe existir y estar activo (`isActive: true`)
5. Verifica `tokenVersion`: el del token debe coincidir con `UserSessionState.tokenVersion`
6. Verifica consistencia de rol (token vs BD)
7. Verifica empresa activa si el usuario tiene `companyId`
8. Inyecta en `req`: `userId`, `userRole`, `companyId` (desde BD, no del JWT)

El `companyId` autoritativo viene de BD (`userDoc.companyId`), no del claim JWT (podría ser obsoleto tras cambios de empresa).

---

## Roles y autorización

Archivo: `src/middlewares/roleMiddleware.ts`

| Middleware | Comportamiento |
|------------|----------------|
| `authorizeRole("admin")` | Igualdad estricta: `role === "admin"`. Superadmin no pasa. |
| `authorizeRole("worker")` | Solo workers. |
| `authorizeRole("mecanico")` | Solo mecánicos. |
| `authorizeSuperadmin` | Solo superadmin. |
| `authorizeSelfOrAdmin` | Worker accede a sus propios recursos; admin accede a todos de su empresa. |

**Separación superadmin / admin:** las rutas de superadmin y admin son distintas. Un superadmin no puede usar rutas de admin y viceversa. Esta separación es intencional y no debe relajarse.

---

## Feature gating — `requireModule`

Archivo: `src/middlewares/requireModule.ts`

Verifica que el `MODULE_KEY` esté en `Company.enabledModules` antes de permitir acceso. Superadmin hace bypass automático.

```ts
router.use(authenticateToken, requireModule("workday"), workdayController);
```

Si el módulo no está habilitado: 403 `{ message: "Módulo no habilitado para esta empresa" }`.

---

## Step-up sessions (MFA para acciones críticas)

Archivo: `src/middlewares/requireStepUp.ts` + `src/security/step-up-policy.ts`

Para acciones de alto riesgo (eliminar empresa, actualizar datos sensibles, crear admin), el superadmin debe presentar:
- `x-step-up-code`: código TOTP en tiempo real, **o**
- `x-step-up-token`: token JWT de tipo `step_up` emitido previamente

Acciones que requieren step-up definidas en `step-up-policy.ts`.

---

## JWT — configuración

| Campo | Valor |
|-------|-------|
| Algoritmo | HS256 (jsonwebtoken) |
| Secret | `JWT_SECRET` (env, requerido) |
| TTL admin/superadmin | `"15m"` (hardcoded en servicio de login) |
| TTL worker/otros | `JWT_EXPIRES_IN` (env, default `"1h"`) |
| Payload | `userId`, `role`, `companyId?`, `tokenVersion` |
| Revocación | `POST /api/users/sessions/revoke-all` incrementa `tokenVersion` |

### Token step-up

TTL corto (minutos). Payload con `typ: "step_up"`. El middleware `authenticateToken` rechaza este tipo en rutas normales.

---

## Audit log

Archivos: `src/security/audit-log.ts`, `src/security/audit-events.ts`

Emite eventos a la colección `SecurityAuditLog` en MongoDB con TTL.

Eventos registrados actualmente:
- `auth.login_succeeded`, `auth.login_failed`
- `file.access_granted`, `file.access_denied`
- `session.revoked`
- Eventos de soporte: `support.access_granted`, `support.access_expired`

Campos por evento: `event`, `outcome`, `at`, `actorUserId`, `actorRole`, `tenantCompanyId`, `httpMethod`, `path`, `ip`, `statusCode`, `resourceType`, `resourceId?`, `reason?`

Monitorización activa: `src/security/monitoring.ts` — cron configurable con alertas si se superan umbrales de eventos sospechosos.

---

## Helmet

Headers de seguridad HTTP aplicados globalmente vía `helmet()`:
- `Content-Security-Policy`
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security` (HSTS en producción)
- `X-XSS-Protection`

---

## CORS

Solo orígenes en `ALLOWED_ORIGINS` (env, separados por coma) + `FRONTEND_URL` + `http://localhost:5173` (desarrollo).

Cabeceras permitidas: `Content-Type`, `Authorization`, `Accept-Language`, `x-step-up-token`, `x-step-up-code`.
