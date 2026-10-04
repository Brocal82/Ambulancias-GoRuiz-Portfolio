# Backend - Ambulancias GoRuiz

API REST + WebSocket multi-tenant para la gestión operativa de empresas de ambulancias (Node.js 20, Express 5, TypeScript, MongoDB/Mongoose).

Proyecto archivado (no está en producción). Visión general: [../README.md](../README.md) · Guía completa de instalación y recuperación: [../docs/RECOVERY.md](../docs/RECOVERY.md)

## Requisitos

- Node.js 20 (`.nvmrc` en la raíz)
- MongoDB 6 ejecutándose como **replica set** (algunos servicios usan transacciones)

## Variables de entorno

Copia `.env.example` a `.env`. Las imprescindibles:

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `JWT_SECRET` | Sí | Clave para firmar tokens JWT (valor aleatorio largo, nuevo por entorno) |
| `MONGODB_URI` | Sí (dev/prod) | URI de MongoDB, p. ej. `mongodb://127.0.0.1:27017/ambulancias_dev?replicaSet=rs0` |
| `MONGODB_URI_TEST` | Sí (tests) | En `.env.test`; base de datos dedicada a tests |
| `FRONTEND_URL` / `ALLOWED_ORIGINS` | No | Orígenes CORS del panel web |
| `PORT` | No | Puerto (por defecto 5000) |
| `NODE_ENV` | No | `development` \| `production` \| `test` |

Lista completa (MFA, step-up, monitorización, rate limits…): `.env.example` y [../docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md). El entorno se valida con Zod al arrancar.

## Primer superadmin

```bash
SUPERADMIN_EMAIL=admin@example.com SUPERADMIN_PASSWORD='<contraseña segura>' npm run create:superadmin
```

No hace nada si ya existe un superadmin. Alternativa: `EMAIL=… PASSWORD=… npm run bootstrap:superadmin`.

## Flujo de alta

1. **Superadmin** inicia sesión y activa **MFA TOTP** (obligatorio para las acciones con step-up).
2. **Crear empresa** – `POST /api/companies` (step-up). Indica `emailDomain` y los `enabledModules`: **una empresa nueva no tiene ningún módulo activo**.
3. **Crear primer admin** – `POST /api/companies/:id/admin` (step-up) con name, lastName, email, password.
4. **Invitar usuarios** – Admin: `POST /api/invitations` con email y role; el panel muestra el enlace de invitación.
5. **Aceptar invitación** – Sin auth: `GET /api/invitations/validate?token=…` y `POST /api/invitations/accept`.
6. **Login** – `POST /api/users/login`.

Para planificar turnos, los trabajadores necesitan además un rol de ambulancia (driver/medic/both) y, como conductores, un P-Schein válido y confirmado. Paso a paso en [../docs/RECOVERY.md](../docs/RECOVERY.md) (A.9–A.10).

## Roles

| Rol | Descripción |
|-----|-------------|
| `superadmin` | Gestiona empresas, módulos y primer admin. Sin companyId. |
| `admin` | Gestiona su empresa (usuarios, turnos, ausencias, documentos…). Requiere companyId. |
| `worker` | Trabajador de campo: sus propios datos, agenda y jornada (app móvil). |
| `mecanico` / `jefe_mecanicos` | Módulo de averías; el jefe además gestiona ambulancias. |
| `jefe_logistica` | Definido en el modelo; acceso extendido pendiente de configurar. |

Detalle en [../docs/AUTH.md](../docs/AUTH.md).

## Notas importantes

- **Sin registro público** – Acceso solo por invitación.
- **Multi-tenant** – Aislamiento por `companyId` aplicado en la capa de servicios; el `companyId` se resuelve desde la base de datos, no solo desde el JWT. Ver [../docs/MULTI-TENANT.md](../docs/MULTI-TENANT.md).
- **Archivos** – Documentos y PDFs solo a través de `/api/files/:filename` (autenticado); `/uploads` público solo para imágenes. Ver [../docs/FILE-SECURITY.md](../docs/FILE-SECURITY.md).
- **Rate limiting** – Login, invitaciones, report-issue, acceso de soporte y límite global por IP.

## Comandos útiles

```bash
npm run dev          # Desarrollo con hot-reload (ts-node-dev)
npm run build        # Compilar TypeScript + copiar OpenAPI a dist/
npm run start        # Producción (node dist/index.js)
npm run typecheck    # Solo TypeScript
npm run test:full    # Suite completa de tests (recomendado)
npm run test:security:isolation   # Tests de aislamiento multi-tenant
```

Documentación de la API (OpenAPI): `/api/docs` y `/api/docs.json` con el servidor arrancado.

## Tests

Requiere `.env.test` con `MONGODB_URI_TEST` y `JWT_SECRET` (ver `.env.test.example`). Ejecuta la suite completa con `npm run test:full`; **no** uses `--runInBand` para toda la suite (se queda sin memoria). Detalles en [TESTING.md](TESTING.md).
