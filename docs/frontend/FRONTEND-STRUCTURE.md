# Frontend Structure — Admin SPA

Documentación de la estructura del frontend web admin. Stack: React 19, Vite 6, React Router 7, Tailwind 4, TypeScript 5.8.

---

## Arquitectura general

```
ambulancias-goruiz-frontend/src/
  api/           Instancia Axios compartida
  components/    Guards de ruta + componentes comunes + UI
  constants/     MODULE_KEYS y constantes compartidas
  context/       AuthContext + AuthProvider
  hooks/         Hooks transversales (useAuth, useModules, ...)
  i18n/          Configuración i18next
  layouts/       Wrappers de página por sección
  locales/       Traducciones (de, en, es)
  modules/       19 dominios de negocio (feature modules)
  pages/         Páginas raíz y dashboards
  utils/         Utilidades transversales
  App.tsx        Router principal con lazy loading
  main.tsx       Entry point React
```

---

## Routing — `App.tsx`

Todas las páginas se cargan con `React.lazy()` + `Suspense` (PR #66). Los layouts, guards y `AuthProvider` son imports estáticos.

### Rutas públicas (sin auth)

| Path | Componente |
|------|------------|
| `/` | `WelcomePage` |
| `/login` | `Login` |
| `/register` | `Register` |
| `/invitation/accept` | `AcceptInvitationPage` |

### Rutas worker y roles mixtos

Protegidas por `RequireAuth` + `AppLayout`:

| Path | Componente | Restricción extra |
|------|------------|-------------------|
| `/profile` | `ProfilePage` | — |
| `/worker` | `WorkerDashboard` | — |
| `/dienst` | `WorkerDienstPage` | `RequireModule("scheduling")` |
| `/worker/hospitals` | `WorkerHospitalsPage` | `RequireModule("hospitals")` |
| `/worker/praemien` | `WorkerPraemienPage` | `RequireModule("praemien")` |
| `/worker/vacations` | `WorkerVacationsPage` | `RequireModule("vacation")` |
| `/worker/sick-leaves` | `WorkerSickLeavesPage` | `RequireModule("sick_leaves")` |
| `/worker/messages` | `WorkerMessagesPage` | — |
| `/my-workday` | `WorkdayPage` | `RequireModule("workday")` |
| `/worker/report-issue` | `WorkerReportIssuePage` | — |
| `/mechanics/dashboard` | `MechanicsDashboardPage` | `RequireRole(["jefe_mecanicos"])` |
| `/mechanics` | `MechanicsPage` | `RequireRole(["mecanico","jefe_mecanicos"])` |
| `/mechanics/ambulances` | `MechanicsAmbulancesPage` | `RequireRole(["jefe_mecanicos"])` |
| `/worker/appointments` | `WorkerAppointmentsPage` | `RequireModule("appointments")` |
| `/worker/payroll` | `WorkerPayrollPage` | `RequireModule("payroll")` |
| `/worker/documents` | `WorkerDocumentsPage` | — |
| `/worker/excel-planning` | `WorkerExcelPlanningPage` | `RequireModule("excel_planning")` |

### Rutas superadmin

Protegidas por `RequireAuth` + `authorizeSuperadmin`:

| Path | Componente |
|------|------------|
| `/superadmin` | `SuperadminDashboard` |
| `/superadmin/companies` | `SuperadminCompaniesPage` |
| `/superadmin/companies/new` | `SuperadminCreateCompanyPage` |
| `/superadmin/companies/:id` | `SuperadminCompanyDetailPage` |
| `/superadmin/companies/:id/admin` | `SuperadminCreateAdminPage` |
| `/superadmin/security-monitoring` | `SuperadminSecurityMonitoringPage` |
| `/superadmin/security-mfa` | `SuperadminMfaPage` |

### Rutas admin

Protegidas por `RequireAuth` + `RequireRole("admin")` + `AdminAppLayout` + `AdminSidebarLayout`:

| Path | Componente | Module key |
|------|------------|------------|
| `/admin` | `AdminDashboard` | — |
| `/admin/users` | `AdminUsersPage` | — |
| `/admin/invitations` | `AdminInvitationsPage` | — |
| `/admin/diensts` | `AdminDienstsPage` | `scheduling` |
| `/admin/dienst-templates` | `AdminDienstTemplatesPage` | `scheduling` |
| `/admin/hospitals` | `AdminHospitalsPage` | `hospitals` |
| `/admin/vacations` | `AdminVacationsPage` | `vacation` |
| `/admin/messages` | `AdminMessagesPage` | — |
| `/admin/messages/sent` | `AdminSentMessagesPage` | — |
| `/admin/summaries` | `AdminSummariesPage` | `workday` |
| `/admin/ambulances` | `AdminAmbulancesPage` | — |
| `/admin/user/:userId` | `AdminUserDetailPage` | — |
| `/admin/mechanics` | `AdminMechanicsPage` | `mechanics` |
| `/admin/appointments` | `AdminAppointmentsPage` | `appointments` |
| `/admin/teams` | `AdminTeamsPage` | — |
| `/admin/sick-leaves` | `AdminSickLeavesPage` | `sick_leaves` |
| `/admin/praemien` | `AdminPraemienPage` | `praemien` |
| `/admin/payroll` | `AdminPayrollPage` | `payroll` |
| `/admin/payroll/nominas` | `AdminPayrollNominasPage` | `payroll` |
| `/admin/payroll/month/:year/:month` | `AdminPayrollMonthPage` | `payroll` |
| `/admin/payroll/docs` | `AdminPayrollDocsPage` | `payroll` |
| `/admin/excel-planning` | `AdminExcelPlanningPage` | `excel_planning` |

---

## Guards de ruta

Archivos en `src/components/`:

### `RequireAuth`

Espera a que `isAuthReady` sea `true` (hidratación de sessionStorage). Si no hay token, redirige a `/`. Muestra spinner i18n (`guards.loadingSession`) mientras espera.

### `RequireModule`

Bloquea la ruta si el `MODULE_KEY` no está en `Company.enabledModules`. Superadmin tiene bypass automático. Muestra spinner mientras `enabledModules` es `null` (carga en background). Redirige al home del rol si el módulo no está habilitado.

### `RequireRole`

Acepta un rol o array de roles permitidos. Redirige a `homePathForRole(role)` si el rol del usuario no está en la lista.

### `roleHomePath`

```ts
"superadmin" → "/superadmin"
"admin"       → "/admin"
"jefe_mecanicos" → "/mechanics/dashboard"
"mecanico"    → "/mechanics"
default        → "/worker"
```

---

## Layouts

| Layout | Uso |
|--------|-----|
| `AppLayout` | Todas las rutas worker/roles mixtos. Header con nav y perfil. |
| `AdminAppLayout` | Wrapper raíz de rutas admin. Incluye sidebar. |
| `AdminSidebarLayout` | Sidebar con secciones, módulos gateados y badge de notificaciones. |
| `PublicLayout` | Welcome, Login, Register, AcceptInvitation. Sin auth. |

---

## Módulos (`src/modules/`)

Cada módulo sigue la convención:

```
src/modules/<name>/
  domain/
    api.ts          HTTP calls (usa instancia axios compartida)
    types.ts        Tipos TypeScript del dominio
    payloads.ts     Tipos de request/update
  pages/            Páginas del módulo
  components/       Componentes propios
  hooks/            Hooks con estado local (wrappean domain/api.ts)
```

**19 módulos presentes:** `ambulances`, `appointments`, `companies`, `diensts`, `dienstTemplates`, `documents`, `excel-planning`, `hospitals`, `invitations`, `mechanics`, `messages`, `payroll`, `praemien`, `sick`, `support-access`, `teams`, `users`, `vacation`, `workday`

---

## Internacionalización (i18n)

Tres idiomas: `es` (español), `en` (inglés), `de` (alemán). Todos los archivos `locales/<lang>/common.json` deben estar sincronizados. Una clave ausente en un idioma muestra la clave en la UI.

Idioma activo: `localStorage.getItem("lang")` (default `"es"`). El interceptor Axios lo inyecta en `Accept-Language` de cada request.

---

## Auth en frontend

### Sesión

`sessionStorage` (no `localStorage`): la sesión expira al cerrar el tab. Esto es intencional por seguridad.

### `AuthProvider`

Al montar: lee `sessionStorage` → pinta estado inmediatamente → refresca `GET /users/:id` y `GET /companies/me` en background.

Al cambiar de ventana (focus): refresca `enabledModules` desde `/companies/me` para reflejar cambios del superadmin en tiempo casi real.

Aviso de expiración: `setTimeout` a 1 minuto antes de la expiración del JWT.

### Axios interceptor (`src/api/axios.ts`)

- Añade `Authorization: Bearer <token>` desde `sessionStorage` en cada request
- Añade `Accept-Language` desde `localStorage`
- En 401 (excepto `/users/login` y ya en `/`): limpia `sessionStorage` y redirige a `/`

---

## Componentes comunes (`src/components/common/`)

| Componente | Descripción |
|------------|-------------|
| `PageShell` | Contenedor de página con título, subtítulo y ancho máximo configurable |
| `StatusBadge` | Chip de estado con colores semánticos |
| `FileUpload` | Widget reutilizable de subida de archivo |
| `actions/*` | ~18 botones e iconos de acción estándar (Save, Edit, Delete, Cancel, etc.) |

Usar estos primitivos antes de crear componentes nuevos de acción.

---

## Hooks transversales (`src/hooks/`)

| Hook | Descripción |
|------|-------------|
| `useAuth()` | Acceso al AuthContext. Requiere estar dentro de `AuthProvider`. |
| `useModules()` | `hasModule(key)` con bypass superadmin y optimismo mientras carga. |
| `usePraemienWorkdayUiActive()` | Decide qué flujo UI mostrar según `praemienMode` de la empresa. |

---

## Tiempo casi real — web admin

El frontend web **no usa WebSocket**. El servidor WS solo tiene cliente en la app móvil.

La web usa dos patrones para sincronización sin refresh:

1. **Polling periódico:** hooks como `useUnreadMessagesCount` consultan la API cada 30s + en foco de ventana.
2. **BroadcastChannel + CustomEvent:** cuando una acción en un tab produce un cambio (nuevo mensaje, baja, vacación, turno…), el módulo emite un evento. Otros tabs suscritos al mismo `BroadcastChannel` refrescan sus datos.

Ver `docs/frontend/WEBSOCKET.md` para la arquitectura completa.
