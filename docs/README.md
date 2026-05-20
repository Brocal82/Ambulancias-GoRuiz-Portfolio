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

## Fase 2 — Módulos críticos (completada)

| Documento | Estado |
|-----------|--------|
| [MULTI-TENANT.md](./MULTI-TENANT.md) | Completado |
| [FILE-SECURITY.md](./FILE-SECURITY.md) | Completado |
| [SECURITY-LAYER.md](./SECURITY-LAYER.md) | Completado |
| [domains/DOMAIN-praemien.md](./domains/DOMAIN-praemien.md) | Completado |
| [domains/DOMAIN-workday.md](./domains/DOMAIN-workday.md) | Completado |

---

## Fase 3 — API y base de datos (completada)

| Documento | Estado |
|-----------|--------|
| [API-REFERENCE.md](./API-REFERENCE.md) | Completado |
| [DATA-MODELS.md](./DATA-MODELS.md) | Completado |
| [domains/DOMAIN-payroll.md](./domains/DOMAIN-payroll.md) | Completado |
| [domains/DOMAIN-documents.md](./domains/DOMAIN-documents.md) | Completado |

---

## Fase 4 — Frontend y app móvil (completada)

| Documento | Estado |
|-----------|--------|
| [frontend/FRONTEND-STRUCTURE.md](./frontend/FRONTEND-STRUCTURE.md) | Completado |
| [frontend/WORKER-APP.md](./frontend/WORKER-APP.md) | Completado |
| [frontend/WEBSOCKET.md](./frontend/WEBSOCKET.md) | Completado |

---

## Panel SuperAdmin SaaS (Fases 1–6 completadas)

| Documento | Descripción |
|-----------|-------------|
| [SUPERADMIN-FLOW.md](./SUPERADMIN-FLOW.md) | Flujo actual (API, UI, permisos, step-up, JIT) |
| [adr/ADR-superadmin-company-delete.md](./adr/ADR-superadmin-company-delete.md) | ADR borrado vs soft-delete de empresas |

---

## Documentación de seguridad (ya existente)

En `ambulancias-goruiz-backend/docs/security/`:

- `README.md` — Índice de docs de seguridad
- `architecture.md` — Modelo de permisos y audit events
- `operations.md` — Monitorización diaria, métricas, queries de auditoría
- `incident-response.md` — Runbook de incidencias y fugas de datos
- `governance.md` — Revisión mensual, riesgos residuales

## Guías de usuario (cliente)

Manuales para administradores y trabajadores en **español, alemán e inglés**:

→ [user-guide/README.md](./user-guide/README.md)

---

## Documentación de dominios de negocio (ya existente)

En `ambulancias-goruiz-backend/docs/`:

- `DOMAIN-diensts.md` — Lifecycle completo de turnos (Diensts) — **leer antes de modificar scheduling**
- `POLICY-multi-tenant-legacy-companyId.md` — Política de aislamiento multi-tenant
