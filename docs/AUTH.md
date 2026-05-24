# Autenticación y Autorización — Ambulancias GoRuiz

## Visión general

El sistema usa **JWT (Bearer token)** para autenticación. La autorización combina:
- **Roles** de usuario (control de acceso por nivel)
- **companyId** (aislamiento multi-tenant)
- **Feature gating** por módulo habilitado en la empresa
- **Step-up MFA** para operaciones críticas de superadmin

Todos los mecanismos se aplican como middlewares de Express, **en orden**:

```
authenticateToken → requireModule(key) → authorizeRole(rol) → [requireStepUp] → controller
```

---

## Roles del sistema

| Rol | Descripción | Tiene `companyId` | Puede acceder a |
|-----|-------------|-------------------|-----------------|
| `worker` | Trabajador de campo | Sí | Sus propios datos, agenda, jornada, app móvil |
| `admin` | Administrador de empresa | Sí | Todos los recursos de su empresa |
| `mecanico` | Mecánico | Sí | Módulo mechanics (averías) |
| `jefe_mecanicos` | Jefe de mecánicos | Sí | Módulo mechanics + mutaciones de ambulancias |
| `jefe_logistica` | Jefe de logística | Sí | Acceso extendido a planificación (por configurar) |
| `superadmin` | Administrador global | No | Todo el sistema, sin restricción de empresa |

### Regla crítica de autorización por rol

`authorizeRole("admin")` usa **igualdad estricta** (`===`). Esto significa que `superadmin !== admin`. El superadmin está **bloqueado** intencionalmente de las rutas de admin de empresa. Tiene sus propias rutas exclusivas.

**No cambiar este comportamiento** sin un requisito explícito.

```typescript
// src/middlewares/roleMiddleware.ts
export const authorizeRole = (requiredRole: AppRole | AppRole[]) => {
  return (req, res, next) => {
    const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (userRole && requiredRoles.includes(userRole)) {
      next();
    } else {
      res.status(403).json({ message: "Acceso denegado: Rol insuficiente" });
    }
  };
};
```

---

## Flujo de autenticación (login)

```
POST /api/users/login
  → rateLimitLogin (5 intentos / 15 min por IP)
  → validateBody(loginUserSchema)
  → loginUser (controller)
    → users.service: busca user por email, compara password (bcrypt)
    → Verifica user.isActive === true
    → Si superadmin y SUPERADMIN_MFA_REQUIRED=true: requiere código TOTP
    → Genera JWT con:
        { userId, role, companyId?, tokenVersion }
    → Devuelve { token, user }
```

El JWT se almacena en el cliente (localStorage en frontend, AsyncStorage en app móvil) y se envía como `Authorization: Bearer <token>` en cada request.

---

## Estructura del JWT

```json
{
  "userId": "ObjectId del usuario",
  "role": "admin | worker | mecanico | ...",
  "companyId": "ObjectId de la empresa (ausente en superadmin)",
  "tokenVersion": 0,
  "iat": 1234567890,
  "exp": 1234571490
}
```

TTL por defecto:
- Usuarios normales: `JWT_EXPIRES_IN` (default `"1h"`)
- Operaciones privilegiadas (superadmin): `JWT_EXPIRES_IN_PRIVILEGED` (default `"15m"`)

---

## Middleware `authenticateToken`

Archivo: `src/middlewares/authMiddleware.ts`

Ejecuta en **cada request** autenticado. Pasos:

1. Lee el header `Authorization: Bearer <token>`
2. Verifica la firma JWT con `JWT_SECRET`
3. Carga el usuario desde MongoDB: verifica que exista y que `isActive === true`
4. **Verifica `tokenVersion`**: carga `UserSessionState.tokenVersion` y compara con el del JWT. Si no coinciden → 401 (token revocado)
5. **Verifica consistencia de rol**: el rol del JWT debe coincidir con el rol actual en DB
6. Inyecta en el request: `req.userId`, `req.userRole`, `req.companyId`, `req.user`
7. **Verifica empresa activa**: si el usuario tiene empresa, comprueba que `Company.isActive === true`. Si la empresa está desactivada → 403 con código `COMPANY_INACTIVE`

```typescript
// Lo que queda disponible para los middlewares y controladores siguientes:
req.userId      // string — ObjectId del usuario
req.userRole    // string — rol del usuario
req.companyId   // string | undefined — companyId (ausente en superadmin)
req.user        // { id, email, role, companyId? }
```

---

## Revocación de sesiones (token versioning)

El sistema implementa revocación sin blacklist mediante `UserSessionState`:

```
MongoDB: UserSessionState { userId, tokenVersion, updatedAt }
```

Cuando el usuario llama a `POST /api/users/sessions/revoke-all`, el servicio incrementa `tokenVersion` en `UserSessionState`. El siguiente request con el JWT anterior falla en el paso 4 de `authenticateToken`.

Este mecanismo invalida **todos los tokens activos** del usuario de forma inmediata, sin necesidad de una blacklist.

---

## MFA TOTP (solo superadmin)

El superadmin puede habilitar TOTP (Time-based One-Time Password) mediante speakeasy.

### Endpoints MFA (solo `authorizeSuperadmin`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/users/me/mfa/status` | Estado de MFA del superadmin |
| `POST` | `/api/users/me/mfa/totp/enroll` | Inicia enrolamiento: devuelve QR y secret temporal |
| `POST` | `/api/users/me/mfa/totp/confirm` | Confirma enrolamiento con código TOTP |
| `POST` | `/api/users/me/mfa/totp/disable` | Desactiva MFA con código TOTP |

El secret TOTP se almacena en `User.mfaTotpSecret` (campo `select: false` en Mongoose — no se devuelve en queries normales).

### Login con MFA

Cuando `SUPERADMIN_MFA_REQUIRED=true` y el superadmin tiene MFA activo, el login estándar devuelve un token de corta duración que requiere verificación TOTP antes de proceder.

---

## Step-up sessions (operaciones críticas de superadmin)

Para operaciones destructivas o sensibles del superadmin (eliminar empresa, crear admin, actualizar datos sensibles), se requiere una verificación adicional: **step-up**.

### Flujo step-up

```
Opción A (código TOTP directo):
  Request → requireStepUp → verifySuperadminTotpCode(userId, code) → continúa

Opción B (sesión step-up pre-emitida):
  POST /api/users/me/step-up-session (con código TOTP válido)
    → devuelve { stepUpToken, expiresAt } (TTL: STEP_UP_SESSION_TTL_SECONDS, default 300s)
  Request → requireStepUp → verifySuperadminStepUpSessionToken(userId, token) → continúa
```

El cliente envía el step-up mediante:
- Header `x-step-up-code` (código TOTP) o `x-step-up-token` (sesión pre-emitida)
- O en el body como `stepUpCode` / `stepUpToken`

### Acciones que requieren step-up

Definidas en `src/security/step-up-policy.ts`:

| Action key | Operación |
|------------|-----------|
| `company.create` | Crear empresa (nuevo tenant) |
| `company.delete` | Eliminar empresa |
| `company.sensitive_update` | Actualizar datos sensibles de empresa |
| `company.admin.create` | Crear administrador de empresa |
| `support_access.approve` | Aprobar solicitud JIT (solo `approve: true`) |
| `support_access.revoke` | Revocar acceso JIT aprobado |

---

## Feature gating (`requireModule`)

Archivo: `src/middlewares/requireModule.ts`

Middleware que verifica si un módulo está habilitado para la empresa del usuario:

```typescript
// Uso en rutas:
router.get("/", authenticateToken, requireModule("hospitals"), authorizeRole("admin"), handler);
```

Comportamiento:
- **Superadmin**: siempre bypassa (acceso global)
- **Usuarios con empresa**: busca `Company.enabledModules` en MongoDB. Si el módulo no está en el array → 403
- **Array vacío**: bloquea acceso (los tenants deben tener el array poblado)

> **Atención**: si una empresa tiene `enabledModules: []` (array vacío), todos los módulos gateados quedan bloqueados. Ejecutar `npm run backfill:company-modules` tras habilitar nuevos guards en rutas existentes.

Ver lista completa de módulos en `docs/MODULES-OVERVIEW.md`.

---

## Middleware de rutas especiales

### `authorizeSelfOrAdmin`

Permite acceso si el usuario es admin o si está accediendo a su propio recurso (`:id` === `req.userId`).

```typescript
router.get("/:id", authenticateToken, validateObjectId("id"), authorizeSelfOrAdmin, getUserById);
```

### `authorizeSuperadmin`

Solo permite acceso a `superadmin`. Ningún otro rol pasa.

```typescript
router.get("/me/mfa/status", authenticateToken, authorizeSuperadmin, getMyMfaStatus);
```

---

## Rate limiting aplicado a autenticación

| Ruta | Límite | Ventana | Notas |
|------|--------|---------|-------|
| `POST /api/users/login` | 5 intentos | 15 minutos | Protección brute force |
| `POST /api/invitations/accept` | 8 requests | 15 minutos | Evita abuso de creación de cuentas |
| `POST /api/invitations/validate` | 25 requests | 1 minuto | Evita enumeración de tokens |

Los límites son configurables vía variables de entorno (`RATE_LIMIT_LOGIN_MAX`, `RATE_LIMIT_LOGIN_WINDOW_MS`, etc.). Ver `docs/DEPLOYMENT.md`.

---

## companyId en el contexto de autorización

El `companyId` del JWT es la fuente de verdad para el aislamiento multi-tenant. En los servicios se usa `requireCompanyForAdmin(req)` como punto de entrada:

```typescript
// src/utils/requireCompany.ts — Patrón estándar en servicios de admin
const companyResult = requireCompanyForAdmin(req);
if (!companyResult.ok) {
  res.status(companyResult.statusCode).json({ message: companyResult.message });
  return;
}
const { companyId } = companyResult;  // string garantizado
```

Las funciones de comparación disponibles:

| Función | Uso |
|---------|-----|
| `isSameCompany(targetCompanyId, adminCompanyId)` | ¿El recurso pertenece a la empresa del admin? |
| `isResourceFromCompany(resourceCompanyId, companyId)` | Alias de `isDienstFromCompany` para cualquier recurso |
| `entitiesBelongToSameCompany(coA, coB)` | ¿Dos entidades pertenecen a la misma empresa? |
| `requireCompanyForWorker(req)` | Versión para rutas de trabajador |
| `requireCompanyForAmbulanceMutations(req)` | Para admin o jefe_mecanicos |

Ver `docs/MULTI-TENANT.md` para la política completa de companyId, incluyendo registros legacy con `companyId: null`.

---

## Registro de nuevos usuarios

El registro público está **deshabilitado**. `POST /api/users/register` siempre devuelve 403. Los nuevos usuarios solo pueden unirse mediante invitación de un admin de empresa.

Flujo de invitación: `docs/domains/DOMAIN-invitations.md`.

---

## Audit log de autenticación

Todos los eventos de acceso a archivos, errores de step-up, y operaciones críticas se registran en el audit log. Ver `docs/security/architecture.md` y `src/security/audit-log.ts`.
