# Backend - Ambulancias GoRuiz

API REST para gestión de empresas de ambulancias. SaaS multi-tenant B2B.

## Variables de entorno

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `JWT_SECRET` | Sí | Clave para firmar tokens JWT |
| `MONGODB_URI` | Sí (prod/dev) | URI de conexión a MongoDB |
| `MONGODB_URI_TEST` | Sí (test) | URI de MongoDB para tests (ej: `mongodb://localhost/ambulancias_test`) |
| `FRONTEND_URL` | No | URL del frontend (CORS) |
| `ALLOWED_ORIGINS` | No | Orígenes permitidos separados por coma |
| `PORT` | No | Puerto (default: 5000) |
| `NODE_ENV` | No | `development` \| `production` \| `test` |

## Bootstrap

Para crear el primer superadmin (solo una vez por instalación):

```bash
npm run bootstrap:superadmin
```

Según el script, introducir email y contraseña cuando se solicite.

## Flujo completo SaaS

1. **Bootstrap superadmin** – Ejecutar `npm run bootstrap:superadmin`
2. **Crear company** – Superadmin: `POST /api/companies` con `{ name }`
3. **Crear primer admin** – Superadmin: `POST /api/companies/:id/admin` con email, name, lastName, password
4. **Crear invitación** – Admin (con companyId): `POST /api/invitations` con email, role
5. **Validar invitación** – Sin auth: `GET /api/invitations/validate?token=...`
6. **Aceptar invitación** – Sin auth: `POST /api/invitations/accept` con token, name, lastName, password
7. **Login** – `POST /api/users/login` con email, password

## Roles

| Rol | Descripción |
|-----|-------------|
| `superadmin` | Gestiona companies y crea primer admin. Sin companyId. |
| `admin` | Gestiona su empresa (users, diensts, vacaciones, etc.). Requiere companyId. |
| `worker` | Acceso a sus propios recursos y operaciones asignadas. |

## Notas importantes

- **Register público desactivado** – No hay `POST /api/users/register`. Acceso solo por invitación.
- **Multi-tenant** – Aislamiento por `companyId` en JWT y en los módulos.
- **Rate limiting** – Login, invitations/accept, invitations/validate, report-issue tienen límites por IP.

## Comandos útiles

```bash
npm run dev          # Desarrollo con hot-reload
npm run build        # Compilar TypeScript
npm run start        # Producción (node dist/index.js)
npm test             # Tests (usar --runInBand si hay flakiness)
npm run bootstrap:superadmin
```

## Tests

Requerido `.env.test` con `MONGODB_URI_TEST` y `JWT_SECRET`. Para mayor estabilidad en paralelo:

```bash
npm test -- --runInBand
```
