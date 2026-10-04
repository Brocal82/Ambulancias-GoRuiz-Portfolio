# Despliegue y configuración — Ambulancias GoRuiz

## Requisitos del sistema (backend)

| Requisito | Versión mínima |
|-----------|---------------|
| Node.js | 20.x (especificado en `engines.node` del `package.json`) |
| MongoDB | 6.x recomendado (sin versión fija en app, usa Mongoose 8.x) |
| Zona horaria del servidor | `Europe/Berlin` (los cron jobs usan esta TZ explícitamente) |

---

## Variables de entorno

El backend valida todas las variables al arrancar usando **Zod**. Si falta alguna crítica, el proceso termina con error. Archivo: `src/config/env.ts`.

### Variables obligatorias

| Variable | Descripción |
|----------|-------------|
| `MONGODB_URI` | URI de conexión a MongoDB (requerido en dev y producción) |
| `JWT_SECRET` | Secret para firmar y verificar JWT. Mínimo 32 caracteres aleatorios. **Nunca en código.** |

### Variables opcionales con defaults

| Variable | Default | Descripción |
|----------|---------|-------------|
| `PORT` | `5000` | Puerto HTTP del servidor |
| `NODE_ENV` | — | `"production"` activa morgan combined y fail-fast en crashes |
| `FRONTEND_URL` | — | URL del frontend SPA. Se añade automáticamente a CORS allowed origins |
| `ALLOWED_ORIGINS` | — | Lista separada por comas de orígenes CORS adicionales permitidos |
| `JWT_EXPIRES_IN` | `"1h"` | TTL de tokens JWT estándar |
| `JWT_EXPIRES_IN_PRIVILEGED` | `"15m"` | TTL de tokens JWT para superadmin (login con MFA activo) |
| `PSCHEIN_WARNING_MONTHS` | `6` | Meses de antelación para alertar sobre P-Schein próximo a vencer |

### Variables de MFA y step-up (superadmin)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `SUPERADMIN_MFA_REQUIRED` | `false` | Si `true`, el superadmin debe tener MFA activo para hacer login |
| `SUPERADMIN_MFA_ISSUER` | `"AmbulanciasGoRuiz"` | Nombre del emisor que aparece en la app TOTP |
| `STEP_UP_SESSION_TTL_SECONDS` | `300` | Duración en segundos de una sesión step-up pre-emitida (60–1800) |

**Producción (superadmin):** configurar `SUPERADMIN_MFA_REQUIRED=true`, MFA TOTP activo en todas las cuentas superadmin, y al menos **dos** superadmins distintos para aprobación JIT en cuatro ojos. Sin MFA, las operaciones con step-up devuelven `STEP_UP_REQUIRED` / `MFA_NOT_ENROLLED`.

### Variables de seguridad y monitorización

| Variable | Default | Descripción |
|----------|---------|-------------|
| `SECURITY_MONITORING_ENABLED` | `true` | Activa el cron de security monitoring |
| `SECURITY_MONITORING_CRON` | `"0 7 * * *"` | Schedule cron del reporte de seguridad (diario a las 07:00 Berlin) |
| `SECURITY_MONITORING_DENIED_THRESHOLD` | `3` | Nº de accesos denegados que activa alerta en el reporte |
| `SECURITY_AUDIT_LOG_RETENTION_DAYS` | `180` | Días de retención de logs de auditoría |
| `SECURITY_ALERT_WEBHOOK_URL` | — | URL opcional (HTTPS) que recibe POST JSON en alertas (`support_access_approved`, umbrales de monitoring, etc.) |
| `SUPPORT_ACCESS_APPROVALS_REQUIRED` | `1` | Aprobaciones JIT para activar acceso: `1` = operador único (pero distinto al solicitante); `2` = dos superadmins distintos |
| `SUPPORT_ACCESS_EXPIRATION_CRON` | `*/15 * * * *` | Cron para expirar solicitudes `approved` vencidas |
| `RATE_LIMIT_SUPPORT_ACCESS_CREATE_MAX` | `12` | Máx. solicitudes JIT por IP / ventana |
| `RATE_LIMIT_SUPPORT_ACCESS_REVIEW_MAX` | `20` | Máx. revisiones JIT por IP / ventana |
| `RATE_LIMIT_SUPPORT_ACCESS_REVOKE_MAX` | `10` | Máx. revocaciones JIT por IP / ventana |

### Variables de rate limiting

| Variable | Default | Descripción |
|----------|---------|-------------|
| `RATE_LIMIT_LOGIN_MAX` | `5` | Máximo de intentos de login por IP en la ventana |
| `RATE_LIMIT_LOGIN_WINDOW_MS` | `900000` (15 min) | Ventana de tiempo para rate limit de login |
| `RATE_LIMIT_REPORT_ISSUE_MAX` | `10` | Máximo reportes de avería por IP por minuto |
| `RATE_LIMIT_REPORT_ISSUE_WINDOW_MS` | `60000` (1 min) | Ventana de rate limit para report-issue |

### Variables de test (solo `NODE_ENV=test`)

| Variable | Descripción |
|----------|-------------|
| `MONGODB_URI_TEST` | URI de la DB dedicada a tests. **Obligatorio en test.** Nunca usar la DB de desarrollo. |

---

## Configuración de CORS

El backend permite orígenes en este orden:

1. `http://localhost:5173` (siempre permitido — desarrollo local de frontend)
2. El valor de `FRONTEND_URL` (si está definido)
3. Cualquier origen en `ALLOWED_ORIGINS` (lista separada por comas)

Origenes no en esta lista reciben error de CORS.

---

## Estructura de archivos de upload

```
uploads/               # Directorio raíz de archivos subidos
  *.jpg, *.png, *.webp # Servidos públicamente vía /uploads/*
  *.pdf, *.doc, ...    # Solo accesibles vía /api/files/:filename (autenticado)
```

El backend busca el directorio `uploads/` en dos rutas (para compatibilidad dev/prod):
- `dist/uploads/` (cuando se ejecuta el build compilado)
- `uploads/` (relativo a la raíz del proyecto)

En producción, se recomienda servir `/uploads` desde el proxy inverso (nginx) para mejor rendimiento, aunque funciona servido directamente por Express.

---

## Scripts disponibles (`npm run ...`)

### Desarrollo y producción

| Script | Comando | Descripción |
|--------|---------|-------------|
| `dev` | `ts-node-dev --respawn` | Servidor de desarrollo con hot-reload |
| `build` | `tsc -p tsconfig.json` | Compila TypeScript a `dist/` |
| `start` | `node dist/index.js` | Inicia el servidor compilado (producción) |
| `test` | `jest` | Ejecuta todos los tests |
| `test:watch` | `jest --watch` | Tests en modo watch |
| `test:security:isolation` | `jest --runInBand ...` | Suite de tests de aislamiento de seguridad |
| `test:security:isolation:ci` | `jest --ci --runInBand ...` | Misma suite, modo CI |

### Scripts de datos de base de datos

> Estos scripts tocan datos reales. Ejecutar **siempre con cautela** y **nunca en producción sin revisión previa**.

| Script | Descripción |
|--------|-------------|
| `bootstrap:superadmin` | Crea el primer superadmin del sistema (`EMAIL=… PASSWORD=…`) |
| `create:superadmin` | Crea el superadmin inicial si no existe (`SUPERADMIN_PASSWORD` obligatorio, `SUPERADMIN_EMAIL` opcional) |
| `create:hospitals` | Crea hospitales de ejemplo |
| `create:ambulances` | Crea ambulancias de ejemplo |
| `seed:test-workers` | Crea trabajadores de prueba para dev (`COMPANY_ID`, `SEED_WORKER_PASSWORD` opcional) |
| `cleanup:test-data` | Limpia datos de prueba de entorno de dev |

### Scripts de backfill (migraciones)

Ejecutar cuando se activa un nuevo guard `requireModule` en rutas existentes:

| Script | Cuándo ejecutar |
|--------|-----------------|
| `backfill:company-modules` | Al activar `requireModule` en rutas que antes no lo tenían |
| `backfill:excel-planning-module` | Al activar el guard del módulo `excel-planning` |

### Scripts de seguridad

| Script | Descripción |
|--------|-------------|
| `security:report:daily` | Genera manualmente el reporte de security monitoring |

### Scripts de Excel planning (dev/pruebas)

| Script | Descripción |
|--------|-------------|
| `generate:excel-planning-real` | Genera Excels de planning con trabajadores reales de dev |
| `sample:excels-villanos-avengers` | Genera Excels de ejemplo con datos ficticios |
| `cleanup:excel-planning-discarded` | Limpia importaciones de Excel descartadas |

---

## Cron jobs del servidor

Los cron jobs se registran en `src/index.ts` al arrancar el servidor, una vez establecida la conexión a MongoDB.

| Job | Schedule | Timezone | Descripción |
|-----|----------|----------|-------------|
| `cleanupOldDiensts` | `0 0 * * 1` | Europe/Berlin | Cada lunes a las 00:00. Elimina Diensts sin asignar de semanas pasadas. **Nunca toca Diensts con `companyId: null`** (datos legacy). |
| `securityMonitoring` | `SECURITY_MONITORING_CRON` | Europe/Berlin | Emite reporte de seguridad. Solo si `SECURITY_MONITORING_ENABLED=true`. |

---

## WebSocket server

El servidor WebSocket se inicializa en el mismo proceso HTTP:

```typescript
// src/index.ts
const httpServer = http.createServer(app);
setupWebSocketServer(httpServer);  // src/modules/notifications/
httpServer.listen(PORT, "0.0.0.0");
```

El WebSocket comparte puerto con el REST API. El cliente (app móvil) se conecta a `ws://host:PORT`.

---

## Graceful shutdown

El servidor maneja `SIGINT` y `SIGTERM` con un shutdown ordenado:

1. Cierra el servidor HTTP (espera requests en vuelo)
2. Cierra la conexión a MongoDB
3. Sale con código 0

En caso de error durante el shutdown, sale con código 1.

```typescript
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
```

Crashes no capturados (`uncaughtException`, `unhandledRejection`) en `NODE_ENV=production` llaman a `process.exit(1)`. En desarrollo, solo loggean.

---

## Inicialización del sistema (primera vez)

1. Instalar dependencias: `npm install`
2. Crear `.env` con las variables obligatorias (`MONGODB_URI`, `JWT_SECRET`)
3. Crear el superadmin: `npm run bootstrap:superadmin`
4. (Opcional) Crear datos iniciales: hospitales, ambulancias, usuarios de prueba
5. Iniciar servidor de desarrollo: `npm run dev`

### Para un tenant nuevo (empresa)

1. El superadmin crea la empresa vía `POST /api/companies`
2. El superadmin crea el primer admin de la empresa (requiere step-up)
3. El admin invita a los trabajadores vía `POST /api/invitations`
4. Si la empresa tenía datos previos, ejecutar backfill de módulos

---

## Estructura del directorio de producción (build)

```
dist/
  index.js          # Entry point compilado
  app.js            # App Express compilada
  modules/          # Módulos compilados
  ...
  uploads/          # Archivos estáticos (si no se usa proxy)
```

---

## Archivos `.env` requeridos

| Archivo | Cuándo se usa |
|---------|---------------|
| `.env` | Desarrollo y producción |
| `.env.test` | Tests de integración (`NODE_ENV=test`). Requiere `MONGODB_URI_TEST`. |

> El archivo `.env.test` nunca debe apuntar a la misma DB que `.env`. Los tests de integración crean y destruyen datos en la DB de test.
