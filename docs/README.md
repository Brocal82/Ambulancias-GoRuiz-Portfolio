# Documentación técnica — Ambulancias GoRuiz

Documentación técnica del sistema completo (monorepo: backend, frontend, app móvil).

Para documentación específica del backend (dominio de negocio, seguridad), ver también `ambulancias-goruiz-backend/docs/`.

---

## Fase 1 — Base del sistema (completada)

| Documento | Descripción |
|-----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Arquitectura global, stack, diagrama, principios |
| [AUTH.md](./AUTH.md) | Autenticación JWT, roles, MFA, step-up sessions, feature gating |
| [MODULES-OVERVIEW.md](./MODULES-OVERVIEW.md) | Todos los MODULE_KEYS, qué hace cada módulo, gating por empresa |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Variables de entorno, scripts, cron jobs, WebSocket, graceful shutdown |

---

## Fase 2 — Módulos críticos (pendiente)

| Documento | Estado |
|-----------|--------|
| `MULTI-TENANT.md` | Pendiente (ampliar `ambulancias-goruiz-backend/docs/POLICY-multi-tenant-legacy-companyId.md`) |
| `FILE-SECURITY.md` | Pendiente |
| `domains/DOMAIN-praemien.md` | Pendiente |
| `domains/DOMAIN-workday.md` | Pendiente |
| `SECURITY-LAYER.md` | Pendiente |

---

## Fase 3 — API y base de datos (pendiente)

`API-REFERENCE.md`, `DATA-MODELS.md`, `domains/DOMAIN-payroll.md`, `domains/DOMAIN-documents.md`

---

## Fase 4 — Frontend y app móvil (pendiente)

`frontend/FRONTEND-STRUCTURE.md`, `frontend/WORKER-APP.md`, `frontend/WEBSOCKET.md`

---

## Documentación de seguridad (ya existente)

En `ambulancias-goruiz-backend/docs/security/`:

- `README.md` — Índice de docs de seguridad
- `architecture.md` — Modelo de permisos y audit events
- `operations.md` — Monitorización diaria, métricas, queries de auditoría
- `incident-response.md` — Runbook de incidencias y fugas de datos
- `governance.md` — Revisión mensual, riesgos residuales

## Documentación de dominios de negocio (ya existente)

En `ambulancias-goruiz-backend/docs/`:

- `DOMAIN-diensts.md` — Lifecycle completo de turnos (Diensts) — **leer antes de modificar scheduling**
- `POLICY-multi-tenant-legacy-companyId.md` — Política de aislamiento multi-tenant
