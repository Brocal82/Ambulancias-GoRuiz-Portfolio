# Visión general de módulos — Ambulancias GoRuiz

## Concepto: feature gating por módulo

Cada empresa (tenant) tiene una lista de módulos habilitados en `Company.enabledModules`. Las rutas del backend protegidas con `requireModule(key)` solo son accesibles si ese módulo está activo para la empresa del usuario.

```typescript
// Ejemplo de uso en rutas:
router.get("/", authenticateToken, requireModule("hospitals"), authorizeRole("admin"), handler);
//                                  ↑ falla con 403 si "hospitals" no está en enabledModules
```

El **superadmin bypassa** todos los checks de módulo. Los módulos listados como "siempre activos" no usan `requireModule`.

---

## MODULE_KEYS — Referencia completa

Definidos en `src/modules/companies/constants/modules.constants.ts`:

```typescript
export const MODULE_KEYS = {
  HOSPITALS:      "hospitals",
  AMBULANCES:     "ambulances",
  TEAMS:          "teams",
  SCHEDULING:     "scheduling",
  WORKDAY:        "workday",
  MECHANICS:      "mechanics",
  APPOINTMENTS:   "appointments",
  MESSAGES:       "messages",
  VACATION:       "vacation",
  SICK_LEAVES:    "sick-leaves",
  PRAEMIEN:       "praemien",
  PAYROLL:        "payroll",
  DOCUMENTS:      "documents",
  EXCEL_PLANNING: "excel-planning",
} as const;
```

### Módulos siempre activos (sin gating)

Estos módulos no tienen guard `requireModule` porque son infraestructura base:

| Módulo | Por qué siempre activo |
|--------|----------------------|
| `users` | Auth, perfil, MFA — necesarios para cualquier operación |
| `companies` | Gestión de empresas (solo superadmin) |
| `invitations` | Onboarding de nuevos usuarios |
| `notifications` | WebSocket y push (infraestructura transversal) |
| `support-access` | Acceso de soporte (superadmin, no por empresa) |

---

## Descripción detallada de cada módulo

### `hospitals` — Hospitales

**Qué hace:** Catálogo de hospitales destino para los viajes de ambulancias. Operaciones CRUD por empresa.

**Quién puede usarlo:** `admin` (CRUD), `worker`/`mecanico` (solo lectura — para seleccionar destino en viaje).

**Relaciones:** Referenciado en los viajes (`Trip.hospitalId`).

**Estado de documentación:** Sin doc de dominio. Sin complejidad crítica.

---

### `ambulances` — Ambulancias

**Qué hace:** Catálogo de ambulancias de la empresa. CRUD y asignación a turnos (Diensts).

**Quién puede usarlo:** `admin` y `jefe_mecanicos` (CRUD), `worker` (lectura — para seleccionar ambulancia en jornada).

**Relaciones:** `Dienst.ambulanceId`, `Trip.ambulanceId`.

**Estado de documentación:** Sin doc de dominio.

---

### `teams` — Equipos

**Qué hace:** Gestión de equipos de trabajo (grupos de trabajadores). Los equipos se asignan a turnos.

**Quién puede usarlo:** `admin` (CRUD).

**Relaciones:** `Dienst.teamId`, rotación de equipos via `teamRotation.ts`.

**Estado de documentación:** Sin doc de dominio.

---

### `scheduling` — Planificación de turnos (Diensts)

**Qué hace:** Planificación de turnos semanales. Este módulo key cubre dos sub-módulos:
- `dienst-templates/`: CRUD de plantillas reutilizables (define la estructura de una semana)
- `diensts/`: Generación de turnos reales a partir de plantillas, calendario y asignación de recursos

**Complejidad:** ALTA. Tiene lifecycle propio, sub-módulos separados, cron de limpieza, overlap detection y complejidad de companyId legacy. **Leer `ambulancias-goruiz-backend/docs/DOMAIN-diensts.md` antes de cualquier modificación.**

**Quién puede usarlo:** `admin` (todas las operaciones), `worker` (solo lectura de su agenda).

**Relaciones:** Referenciado por `workday-summary`, `praemien`, `payroll`, `trips`.

**Sub-módulos del backend:**

| Sub-módulo | Path | Responsabilidad |
|------------|------|-----------------|
| Templates CRUD | `dienst-templates/` | Crear, editar, eliminar plantillas |
| Generación | `diensts/templates/` | Generar/eliminar Diensts para una semana ISO |
| Calendario | `diensts/calendar/` | Vistas semanales y mensuales (solo lectura) |
| Asignaciones | `diensts/assignments/` | Asignar/quitar usuario, ambulancia o equipo en un slot |

---

### `workday` — Jornada laboral

**Qué hace:** Registro de la jornada diaria del trabajador. Este módulo key cubre:
- `workday-summary/`: Registro de inicio/fin de jornada, estado general del día
- `trips/`: Viajes individuales registrados dentro de la jornada (origen, destino, ambulancia, hospital)

**Complejidad:** ALTA. Los viajes se registran desde la app móvil en tiempo real. El resumen de jornada es fuente de datos para Praemien automático.

**Quién puede usarlo:** `worker` (registro desde app), `admin` (lectura y supervisión).

**Relaciones:** `WorkdaySummary` → `Trip[]`, `Dienst` → `WorkdaySummary`.

---

### `mechanics` — Mecánicos y averías

**Qué hace:** Gestión de reportes de averías de ambulancias. Los mecánicos registran incidencias; los jefes de mecánicos las supervisan.

**Quién puede usarlo:** `mecanico` (reportar), `jefe_mecanicos` (gestión completa), `admin` (supervisión).

**Rate limiting:** `POST /api/mechanics/report-issue` tiene rate limit propio (10 req/min por IP).

---

### `appointments` — Citas médicas

**Qué hace:** Gestión de citas médicas de los trabajadores. Admin puede ver citas pendientes; existe contador de pendientes para el badge de admin.

**Quién puede usarlo:** `admin` (gestión), `worker` (sus propias citas).

---

### `messages` — Mensajería interna

**Qué hace:** Sistema de mensajes internos entre admin y trabajadores. Soporta adjuntos de archivos. La entrega en tiempo real usa WebSocket.

**Complejidad:** MEDIA. La entrega real-time depende del WebSocket server; los adjuntos van por `/api/files`.

**Quién puede usarlo:** `admin` y `worker`.

**Relaciones:** WebSocket (`ws-manager.ts`), `documents/` para adjuntos.

---

### `vacation` — Vacaciones

**Qué hace:** Gestión de solicitudes de vacaciones. Los trabajadores solicitan; los admins aprueban o rechazan. Existe flujo de alternativas (propuesta de slots).

**Quién puede usarlo:** `admin` (gestión), `worker` (solicitar sus vacaciones).

---

### `sick-leaves` — Bajas por enfermedad

**Qué hace:** Registro y gestión de bajas médicas. Los trabajadores pueden adjuntar documentos (partes de baja). Los admins supervisan.

**Quién puede usarlo:** `admin` (gestión), `worker` (sus propias bajas).

**Relaciones:** Adjuntos de documentos vía `/api/files`.

---

### `praemien` — Primas (Praemien)

**Qué hace:** Cálculo de primas mensuales por trabajador. Soporta dos modos, configurados por empresa:

- **Modo automático** (`praemienMode: "automatic"`): el sistema calcula las primas a partir de los datos de jornada y turnos. Los admins solo guardan el resumen mensual.
- **Modo manual** (`praemienMode: "manual"`): los trabajadores introducen valores diarios. Los admins revisan, aprueban, rechazan o corrigen.

**Complejidad:** MUY ALTA. Afecta datos de nómina reales. Tiene fases 1-4 de implementación, flujo de aprobación admin, fechas de cierre (closure dates) y pendientes de revisión. **Leer `docs/domains/DOMAIN-praemien.md` antes de cualquier modificación.**

**Quién puede usarlo:** `admin` (gestión, aprobación), `worker` (lectura de su historial, entrada manual si modo manual).

**Dependencias:** Requiere módulo `workday` para modo automático. Puede funcionar sin jornada digital en modo manual.

**Transición de modo:** `Company.praemienModeEffectiveFrom` define cuándo entra en vigor el modo configurado (para no afectar el mes en curso).

---

### `payroll` — Nóminas

**Qué hace:** Gestión de recibos de nómina (PDFs). El admin sube PDFs; el sistema los auto-asigna a trabajadores por nombre de archivo. Los trabajadores ven sus propias nóminas.

**Operaciones:**
- Upload individual o en batch (hasta 20 PDFs en una solicitud)
- Auto-matching por nombre de archivo (conservador: sin asignación incorrecta)
- Reasignación manual si el matching falla
- Soft-delete (invalidación) — el archivo se retiene para posible restauración
- Coverage check: qué trabajadores no tienen nómina confirmada para un período

**Quién puede usarlo:** `admin` (upload, gestión), `worker` (ver sus propias nóminas).

**Seguridad:** Los PDFs se sirven exclusivamente vía `/api/files/:filename` (autenticado). Nunca por `/uploads`.

---

### `documents` — Documentos de empresa

**Qué hace:** Distribución de documentos de empresa a trabajadores. El admin sube un documento (PDF) y lo distribuye a uno o varios trabajadores. Los trabajadores deben acusar recibo (ACK). El admin puede ver métricas de entrega y ACK.

**Complejidad:** MEDIA-ALTA. Tiene sistema de delivery tracking por worker, timestamps de lectura y ACK, y tests específicos de aislamiento de archivos.

**Quién puede usarlo:** `admin` (upload y distribución), `worker` (recibir y acusar recibo).

**Seguridad:** Todos los documentos son PDFs servidos vía `/api/files` (autenticado).

---

### `excel-planning` — Planificación desde Excel

**Qué hace:** Importación de planificación semanal desde archivos Excel. Independiente del módulo `scheduling` (Diensts). Las empresas que planifican externamente en Excel pueden importar el resultado sin usar el sistema de Diensts.

**Quién puede usarlo:** `admin` (upload y publicación), `worker` (lectura de su planificación).

**Independencia:** Este módulo puede estar activo aunque `scheduling` esté desactivado, y viceversa.

**Rate limiting:** `POST /api/excel-planning/imports` tiene rate limit (25 req / 10 min por IP).

---

### `support-access` (siempre activo, solo superadmin)

**Qué hace:** Permite al superadmin conceder acceso temporal a un agente de soporte para ver los datos de una empresa específica. El acceso tiene duración limitada y deja audit trail.

**Quién puede usarlo:** Exclusivamente `superadmin`.

---

## Módulos compuestos: qué MODULE_KEY cubre qué código

| MODULE_KEY | Módulos de backend cubiertos |
|------------|------------------------------|
| `scheduling` | `diensts/` + `dienst-templates/` |
| `workday` | `workday-summary/` + `trips/` |
| `mechanics` | `mechanics/` (averías + gestión) |
| `excel-planning` | `excel-planning/` (independiente de `scheduling`) |

---

## Lista completa de módulos habilitados por defecto (V1)

Cuando se crea una empresa nueva o se hace backfill, se habilitan todos los módulos de `V1_DEFAULT_MODULES`:

```typescript
// src/modules/companies/constants/modules.constants.ts
export const V1_DEFAULT_MODULES: ModuleKey[] = Object.values(MODULE_KEYS);
// = todos los 14 MODULE_KEYS definidos arriba
```

> **Atención para nuevos módulos:** Si añades un guard `requireModule(key)` a una ruta existente (no nueva), ejecuta el script de backfill antes de desplegar, o las empresas existentes perderán acceso.
>
> ```bash
> npm run backfill:company-modules
> ```

---

## Cómo consultar los módulos habilitados de una empresa

Vía API (superadmin):

```
GET /api/companies/:id
→ { enabledModules: ["hospitals", "ambulances", ...] }
```

Vía MongoDB directa (para scripts/migrations):

```javascript
db.companies.findOne({ _id: ObjectId("...") }, { enabledModules: 1 })
```

---

## Estado de documentación por módulo

| Módulo | Doc de dominio | Prioridad doc |
|--------|---------------|---------------|
| `scheduling` (diensts) | `ambulancias-goruiz-backend/docs/DOMAIN-diensts.md` — ampliar | ALTA |
| `praemien` | Pendiente: `docs/domains/DOMAIN-praemien.md` | MEDIA |
| `workday` | Pendiente: `docs/domains/DOMAIN-workday.md` | MEDIA |
| `payroll` | Pendiente: `docs/domains/DOMAIN-payroll.md` | MEDIA |
| `documents` | Pendiente: `docs/domains/DOMAIN-documents.md` | MEDIA |
| resto | Pendiente: Fase 4+ del plan | BAJA |
