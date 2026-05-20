# Plan de implementación — Panel SuperAdmin SaaS

Documento **temporal** de seguimiento por fases (rama + PR por fase). No mezclar UI avanzada con backend base.

**Limpieza al cerrar Fase 6:** eliminar este archivo; actualizar `SUPERADMIN-FLOW.md` como referencia única; mantener ADR si sigue vigente; quitar enlaces obsoletos en `docs/README.md`.

**Estado global:** Fase 4 en rama `feature/superadmin-phase-4-metrics` (PR pendiente). Siguiente tras merge: Fase 5.

---

## Resumen por fases

| Fase | Rama sugerida | Objetivo | Entregable principal | Estado |
|------|----------------|----------|----------------------|--------|
| **1** | `docs/superadmin-phase-1-audit` | Auditoría y documentación del flujo actual | `SUPERADMIN-FLOW.md`, docs alineadas, ADR delete empresa | Completada (PR #75) |
| **2** | `feature/superadmin-phase-2-backend` | Backend mínimo (summary, usuarios read-only, conteos correctos) | Endpoints summary/users, soft-delete | Completada (PR #76) |
| **3** | `feature/superadmin-phase-3-frontend` | Panel usable (layout, company detail, support-access UI) | `SuperadminLayout`, rutas nuevas | Completada (PR #77) |
| **4** | `feature/superadmin-phase-4-metrics` | Métricas agregadas y dashboard global | Dashboard + APIs agregación por tenant | Pendiente |
| **5** | `feature/superadmin-phase-5-ux` | UX avanzada (gráficos, invitaciones admin, onboarding) | Wizard onboarding, exports | Pendiente |
| **6** | `feature/superadmin-phase-6-hardening` | Seguridad y audit (step-up ampliado, MFA prod, SIEM) | Políticas + alertas | Pendiente |

---

## Fase 1 — Auditoría y documentación

**Rama:** `docs/superadmin-phase-1-audit`

### Objetivos
- Dejar por escrito el flujo real (rutas, permisos, step-up, JIT).
- Alinear `API-REFERENCE.md` y `FRONTEND-STRUCTURE.md` con el código.
- Decisión explícita sobre borrado de empresa (ADR).

### Tareas
- [x] Crear `docs/SUPERADMIN-FLOW.md`
- [x] Crear este plan (`SUPERADMIN-IMPLEMENTATION-PLAN.md`)
- [x] Corregir sección support-access en `API-REFERENCE.md`
- [x] Corregir nombres de componentes en `FRONTEND-STRUCTURE.md`
- [x] Enlazar desde `docs/README.md`
- [x] ADR borrador: `docs/adr/ADR-superadmin-company-delete.md`
- [ ] Revisión humana / sign-off ADR (bloquea implementación delete en Fase 2)

### Criterios de done
- Un desarrollador nuevo puede entender qué puede hacer el superadmin sin leer el código.
- Docs API/frontend coinciden con rutas reales.
- No hay cambios de comportamiento en runtime.

### Reglas
- Solo markdown en esta fase.
- No tocar `ambulancias-goruiz-backend` ni `frontend` salvo docs.

---

## Fase 2 — Backend mínimo

**Rama:** `feature/superadmin-phase-2-backend`

### Objetivos
- Endpoints read-only para operar el panel sin reutilizar rutas `admin`.
- Corregir semántica de conteos en listado de empresas.
- Acotar o cambiar `DELETE /companies/:id` según ADR Fase 1.

### Tareas propuestas
1. `GET /api/companies/:id/summary` — conteos por rol, flags onboarding (`hasAdmin`, `hasWorkers`, `modulesCount`).
2. Renombrar o documentar `workerCount` → agregación por rol (`usersByRole`).
3. `GET /api/companies/:id/users` — listado read-only superadmin (paginado, sin datos médicos innecesarios).
4. ADR implementado: soft-delete `Company` **o** deshabilitar DELETE hasta cascade diseñado.
5. Tests de integración superadmin para nuevos endpoints.

### Criterios de done
- Tests verdes en `companies.integration.test.ts` (+ nuevos).
- Ninguna ruta admin relajada para superadmin.
- `companyId` no filtra datos de otro tenant.

### No incluir en Fase 2
- Dashboard UI.
- Métricas de diensts/trips (Fase 4).
- Suscripciones/billing.

---

## Fase 3 — Frontend básico usable

**Rama:** `feature/superadmin-phase-3-frontend`

### Objetivos
- Shell propio superadmin (sidebar), sin `AdminAppLayout`.
- Vista detalle empresa (overview) separada del formulario de edición.
- UI para support-access (API ya existe).

### Tareas propuestas
1. `SuperadminLayout` + navegación: Dashboard, Companies, Security, Settings (MFA).
2. `SuperadminCompanyDetailPage` — overview desde `/:id/summary`.
3. Mantener `SuperadminCompanyForm` en `/:id/edit` y `/:id/new`.
4. `SuperadminSupportAccessPage` — crear, listar, aprobar, revocar.
5. i18n `es` / `en` / `de` para cadenas nuevas.

### Criterios de done
- Flujo completo: login superadmin → listar empresas → ver detalle → editar módulos (step-up).
- Support-access operable sin Postman.

---

## Fase 4 — Métricas y dashboard

**Rama:** `feature/superadmin-phase-4-metrics`

### Objetivos
- KPIs globales y por empresa relevantes para ambulancias.

### Tareas propuestas (backend primero)
1. `GET /api/companies/metrics/global` — empresas activas, usuarios activos, alertas onboarding.
2. `GET /api/companies/:id/metrics` — diensts, trips, workday closures, vacation pending, mechanics open (según módulos habilitados).
3. `SuperadminDashboard` con tarjetas (sin librerías de gráficos pesadas aún).

### Criterios de done
- Agregaciones solo lectura, indexadas por `companyId`.
- Métricas de módulo deshabilitado omitidas o `null`, no error 500.

---

## Fase 5 — UX avanzada

**Rama:** `feature/superadmin-phase-5-ux`

### Tareas propuestas
- Gráficos de actividad, export CSV audit por tenant.
- Invitación admin inicial (reutilizar `invitations`) vs contraseña manual.
- Wizard onboarding nueva empresa.
- Company detail con tabs (Users, Modules, Security, Metrics).

---

## Fase 6 — Hardening seguridad

**Rama:** `feature/superadmin-phase-6-hardening`

### Tareas propuestas
- Step-up en crear empresa y aprobar JIT.
- `SUPERADMIN_MFA_REQUIRED=true` documentado para producción.
- Conectar JIT a política de soporte real (si se decide impersonación/proxy).
- Export audit externo / alertas (según `governance.md`).

---

## Reglas transversales (todas las fases)

1. **PR pequeños** — una preocupación por PR cuando sea posible.
2. **No romper** flujos `admin` / `worker` / app móvil.
3. **Reutilizar** `authenticateToken`, `authorizeSuperadmin`, `requireStepUp`, audit log.
4. **Multi-tenant:** lecturas agregadas siempre acotadas por `companyId`; superadmin no usa rutas `authorizeRole("admin")`.
5. **Legacy** `companyId: null` — no eliminar fallbacks en otros módulos.
6. **Sin refactors grandes** ni renombrado masivo de carpetas.

---

## Referencias

- Flujo actual detallado: [SUPERADMIN-FLOW.md](./SUPERADMIN-FLOW.md)
- Auth y step-up: [AUTH.md](./AUTH.md)
- Multi-tenant: [MULTI-TENANT.md](./MULTI-TENANT.md)
- Seguridad backend: `ambulancias-goruiz-backend/docs/security/architecture.md`
