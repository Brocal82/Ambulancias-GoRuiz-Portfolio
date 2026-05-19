# Arquitectura del sistema — Ambulancias GoRuiz

## Qué es este sistema

Plataforma de gestión operativa para empresas de servicios de ambulancias. Modelo SaaS multi-tenant: cada empresa (tenant) opera de forma completamente aislada dentro del mismo sistema.

Cubre las siguientes áreas de negocio:

| Área | Descripción |
|------|-------------|
| Planificación de turnos | Generación y asignación de Diensts (turnos) a trabajadores y ambulancias |
| Jornada laboral | Registro de apertura/cierre de jornada y viajes en app móvil |
| Primas (Praemien) | Cálculo automático o manual de primas mensuales por trabajador |
| Gestión documental | Nóminas, bajas médicas, documentos de empresa con ACK |
| Comunicación interna | Mensajes con adjuntos, notificaciones push, entrega WebSocket en tiempo real |
| App móvil de campo | Aplicación Expo para trabajadores: agenda, jornada, viajes, vacaciones, bajas |
| Seguridad y auditoría | Audit log, security monitoring, acceso de soporte temporal |

---

## Estructura del monorepo

```
/
├── ambulancias-goruiz-backend/   # API REST + WebSocket (Node.js/Express/MongoDB)
├── ambulancias-goruiz-frontend/  # SPA de administración (React/Vite)
├── apps/
│   └── app-worker/               # App móvil de trabajadores (React Native/Expo)
├── packages/
│   └── shared/                   # Paquete compartido (uso mínimo actualmente)
├── docs/                         # Documentación técnica (este directorio)
│   ├── domains/                  # Documentación por dominio de negocio
│   ├── frontend/                 # Documentación del frontend y app móvil
│   └── security/                 # Docs de seguridad (ya existentes)
└── CLAUDE.md                     # Reglas para asistentes de IA en este proyecto
```

Los tres proyectos se ejecutan de forma independiente y se comunican exclusivamente vía HTTP REST y WebSocket. No hay monorepo build compartido relevante (el paquete `shared/` está vacío en la práctica).

---

## Stack tecnológico

### Backend (`ambulancias-goruiz-backend/`)

| Tecnología | Versión | Uso |
|------------|---------|-----|
| Node.js | 20.x | Runtime |
| Express | 5.x | Framework HTTP |
| MongoDB | — | Base de datos (sin versión pinned en app) |
| Mongoose | 8.x | ODM |
| TypeScript | 5.x | Lenguaje |
| JWT (jsonwebtoken) | 9.x | Autenticación |
| bcrypt | 5.x | Hash de contraseñas |
| speakeasy | 2.x | TOTP/MFA |
| Zod | 3.x | Validación de esquemas |
| Jest + Supertest | 30.x / 7.x | Tests de integración |
| node-cron | 4.x | Cron jobs programados |
| ws | 8.x | WebSocket server |
| multer | 2.x | Upload de archivos |
| xlsx | 0.18 | Parsing de Excel (planificación semanal) |
| luxon + date-fns | — | Manejo de fechas |
| helmet | 8.x | Headers de seguridad HTTP |
| express-rate-limit | 8.x | Rate limiting |

### Frontend (`ambulancias-goruiz-frontend/`)

| Tecnología | Versión | Uso |
|------------|---------|-----|
| React | 19 | Framework UI |
| Vite | 6 | Build tool |
| TypeScript | 5.8 | Lenguaje |
| Tailwind CSS | 4.x | Estilos |
| react-router-dom | 7.x | Routing SPA |
| axios | 1.x | HTTP client |
| i18next + react-i18next | — | Internacionalización (ES, DE, EN) |
| react-select | 5.x | Selects complejos |
| react-date-range | 2.x | Selectores de fechas |
| react-toastify | 11.x | Notificaciones UI |
| Vitest | 4.x | Tests unitarios |

### App móvil (`apps/app-worker/`)

| Tecnología | Uso |
|------------|-----|
| React Native + Expo | Framework móvil (iOS/Android) |
| Expo Push Notifications | Push a dispositivos de trabajadores |
| WebSocket (ws nativo) | Entrega en tiempo real de mensajes |
| AsyncStorage | Persistencia local de sesión |

---

## Diagrama de arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER / DEVICE                        │
│                                                                 │
│  ┌─────────────────────┐      ┌──────────────────────────────┐  │
│  │  Frontend (React)   │      │    App Worker (Expo/RN)      │  │
│  │  SPA de admin       │      │    App de trabajadores       │  │
│  └────────┬────────────┘      └────────────┬─────────────────┘  │
│           │ HTTPS + axios                   │ HTTPS + WS         │
└───────────┼─────────────────────────────────┼────────────────────┘
            │                                 │
            ▼                                 ▼
┌───────────────────────────────────────────────────────────────────┐
│                     BACKEND (Express + Node 20)                   │
│                                                                   │
│  ┌────────────────┐  ┌───────────────┐  ┌──────────────────────┐  │
│  │   REST API     │  │  WebSocket    │  │   Cron Jobs          │  │
│  │  /api/*        │  │  server (ws)  │  │  - cleanupOldDiensts  │  │
│  │  20 módulos    │  │  notificaciones│  │  - securityMonitoring │  │
│  └───────┬────────┘  └───────┬───────┘  └──────────────────────┘  │
│          │                   │                                     │
│  ┌───────▼───────────────────▼───────────────────────────────────┐ │
│  │                  Middlewares stack                             │ │
│  │  helmet · cors · authenticateToken · requireModule            │ │
│  │  authorizeRole · requireStepUp · rateLimit · validateBody     │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                          │                                         │
└──────────────────────────┼─────────────────────────────────────────┘
                           │
                           ▼
              ┌──────────────────────────┐
              │       MongoDB            │
              │  (Mongoose schemas)      │
              │  - User, Company         │
              │  - Dienst, DienstTemplate│
              │  - Trip, WorkdaySummary  │
              │  - Praemie, Payroll      │
              │  - Document, SickLeave   │
              │  - ... (20+ colecciones) │
              └──────────────────────────┘
```

---

## Principios arquitectónicos

### 1. Multi-tenancy por `companyId`

Cada recurso (usuarios, turnos, documentos, etc.) pertenece a una empresa mediante `companyId` (ObjectId de MongoDB). El aislamiento se aplica en la **capa de servicio** usando utilidades de `src/utils/requireCompany.ts`.

Existe deuda técnica de registros legacy con `companyId: null` (principalmente Diensts). Ver `docs/MULTI-TENANT.md`.

### 2. Feature gating por módulo

Las funcionalidades están desactivadas/activadas por empresa mediante `Company.enabledModules`. El middleware `requireModule(key)` protege las rutas. El superadmin bypassa todos los checks de módulo.

Ver `docs/MODULES-OVERVIEW.md`.

### 3. Separación estricta de capas en el backend

```
Router (routes.ts)
  → Middlewares (auth, role, module, validate)
    → Controller (parsea request, llama servicio, devuelve JSON)
      → Service (lógica de negocio + enforcement de companyId)
        → Modelo Mongoose (acceso a MongoDB)
```

**Regla clave:** los controladores no contienen lógica de negocio ni queries directas. Los servicios son la única capa que puede hacer enforcement de tenant.

### 4. Seguridad de archivos en dos niveles

- `/uploads` (público): solo imágenes (`.jpg`, `.jpeg`, `.png`, `.webp`). PDFs bloqueados con 403.
- `/api/files/:filename` (autenticado): cualquier archivo, verificación de propiedad vía `canAccessFile()`.

Ver `docs/FILE-SECURITY.md`.

### 5. Autenticación JWT con token versioning

Los tokens JWT incluyen un `tokenVersion`. En cada request se verifica contra `UserSessionState.tokenVersion` en MongoDB. Si el usuario revoca sesiones, `tokenVersion` se incrementa e invalida todos los tokens emitidos anteriormente.

Ver `docs/AUTH.md`.

---

## Módulos del backend

El backend tiene 20 módulos bajo `src/modules/`. Cada módulo sigue la convención:

```
src/modules/[nombre]/
  routes.ts          # Define las rutas Express del módulo
  index.ts           # Re-exporta el router (o nombrado)
  models/            # Esquemas Mongoose
  services/          # Lógica de negocio
  controllers/       # Handlers de Express
  schemas/           # Esquemas Zod de validación de body
  types/             # Tipos TypeScript del módulo
  utils/             # Utilidades específicas del módulo
```

| Módulo | Ruta base | Notas |
|--------|-----------|-------|
| users | `/api/users` | Auth, perfil, MFA, documentos de usuario |
| diensts | `/api/diensts` | Turnos: generación, calendario, asignaciones |
| dienst-templates | `/api/diensts/templates` | Plantillas de turno reutilizables |
| hospitals | `/api/hospitals` | Catálogo de hospitales por empresa |
| trips | `/api/trips` | Viajes registrados durante jornada |
| workday-summary | `/api/workday-summary` | Resumen de jornada laboral diaria |
| mechanics | `/api/mechanics` | Reportes de averías, gestión de mecánicos |
| praemien | `/api/praemien` | Cálculo de primas (automático/manual) |
| vacation | `/api/vacations` | Gestión de vacaciones |
| ambulances | `/api/ambulances` | Catálogo de ambulancias |
| messages | `/api/messages` | Mensajería interna con adjuntos |
| appointments | `/api/appointments` | Citas médicas |
| teams | `/api/teams` | Equipos de trabajo |
| sick-leaves | `/api/sick-leaves` | Bajas por enfermedad |
| invitations | `/api/invitations` | Invitaciones de onboarding |
| companies | `/api/companies` | Gestión de empresas (superadmin) |
| payroll | `/api/payroll` | Nóminas (upload, auto-match, cobertura) |
| documents | `/api/documents` | Documentos empresa con distribución y ACK |
| excel-planning | `/api/excel-planning` | Planificación semanal importada desde Excel |
| support-access | `/api/support-access` | Acceso temporal de soporte |
| notifications | `/api/notifications` | Tokens push, historial, WebSocket |

---

## Rutas globales del backend

Además de los módulos, el backend expone:

| Ruta | Auth | Descripción |
|------|------|-------------|
| `GET /health` | No | Estado del servidor y DB (para monitorización) |
| `GET /api/files/:filename` | Sí | Descarga segura de archivos (comprueba propiedad) |
| `GET /uploads/*` | No (solo imágenes) | Archivos estáticos públicos |

---

## Patrones frontend

El frontend está organizado por módulos bajo `src/modules/[nombre]/` con la convención:

```
src/modules/[nombre]/
  domain/
    api.ts           # Todas las llamadas HTTP del módulo (axios)
    index.ts         # Re-exporta
  pages/             # Componentes de página (ruteados)
  components/        # Componentes específicos del módulo
  hooks/             # Custom hooks del módulo
  utils/             # Utilidades específicas
```

**Regla:** las llamadas HTTP pertenecen exclusivamente a `domain/api.ts` del módulo. No se usan `fetch` o `axios` directamente en componentes.

---

## Cron jobs del servidor

| Cron | Schedule | Timezone | Qué hace |
|------|----------|----------|----------|
| `cleanupOldDiensts` | `0 0 * * 1` (lunes 00:00) | Europe/Berlin | Elimina Diensts sin asignar de semanas pasadas. Skippea los que tienen `companyId: null` |
| `securityMonitoring` | `0 7 * * *` (07:00 diario) | Europe/Berlin | Emite reporte de seguridad (configurable vía env) |

---

## Consideraciones para nuevos desarrolladores

1. **Lee `docs/AUTH.md` antes de tocar cualquier ruta.** La cadena de middlewares es crítica.
2. **Lee `docs/MULTI-TENANT.md` antes de cualquier servicio.** Un check de `companyId` mal hecho puede exponer datos entre empresas.
3. **Los Diensts son el módulo más complejo.** Lee `ambulancias-goruiz-backend/docs/DOMAIN-diensts.md` antes de modificarlo.
4. **El módulo Praemien afecta nóminas reales.** Lee `docs/domains/DOMAIN-praemien.md` antes de tocarlo.
5. **Los tests de integración son fuente de verdad del comportamiento.** Antes de cambiar un comportamiento, busca el test que lo cubre.
