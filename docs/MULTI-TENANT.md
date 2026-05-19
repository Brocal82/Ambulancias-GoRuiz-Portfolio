# Multi-Tenant Isolation

Documentación del modelo de aislamiento multi-tenant del sistema. Para la política operativa completa, ver también `ambulancias-goruiz-backend/docs/POLICY-multi-tenant-legacy-companyId.md`.

---

## Modelo de aislamiento

Cada empresa (`Company`) es un tenant independiente. El campo `companyId` (ObjectId referencia a `Company`) es el discriminador de tenant en todos los modelos.

El `companyId` autoritativo en cada request viene **siempre de la base de datos** (no del claim JWT), inyectado por `authenticateToken` desde `userDoc.companyId`.

---

## Estado de `companyId` por modelo

### Obligatorio (required: true o enforcement estricto)

| Modelo | Módulo |
|--------|--------|
| `Hospital` | hospitals |
| `Ambulance` | ambulances |
| `Team` | teams |
| `DienstTemplate` | dienst-templates |
| `PayrollDocument` | payroll |
| `CompanyDocument` | documents |
| `DocumentDelivery` | documents |
| `Invitation` | invitations |
| `ExcelPlanningImport` | excel-planning |
| `ExcelPlanningWeek` | excel-planning |
| `PraemienManualDailyEntry` | praemien |
| `VacationMonthConfig` | vacation |
| `MechanicsIssue` | mechanics |
| `MechanicsWorkOrder` | mechanics |
| `SupportAccessRequest` | support-access |

### Legacy — nullable (`companyId` puede ser `null`)

Registros creados antes de la migración multi-tenant. El sistema los sigue soportando en lectura con fallback por `user.companyId`:

| Modelo | Módulo | Fallback |
|--------|--------|---------|
| `Dienst` | diensts | `isSameCompany(user.companyId, admin.companyId)` |
| `Trip` | trips | vía `assignmentId` → Dienst → companyId |
| `WorkdaySummary` | workday | vía `assignmentId` |
| `SickLeave` | sick-leaves | populate `user.companyId` + `isSameCompany` |
| `Message` | messages | campo nullable |
| `MonthlyPraemie` | praemien | campo nullable (backfill pendiente) |
| `Appointment` | appointments | campo nullable |

---

## Enforcement en servicios

El aislamiento se aplica en la **capa de servicio**, no solo en controladores o rutas.

### Utilidades de enforcement

Archivo: `src/utils/requireCompany.ts`

| Función | Uso |
|---------|-----|
| `requireCompanyForAdmin(req)` | Extrae y valida `companyId` del admin en la request. Lanza `CompanyValidationError` si falta. Usar al inicio de operaciones admin de escritura. |
| `requireCompanyForWorker(req)` | Equivalente para workers. |
| `isSameCompany(targetId, adminId)` | Compara dos companyIds con soporte de ObjectId y string. Maneja legacy null. |
| `isResourceFromCompany(resourceId, companyId)` | Para recursos no-usuario (ambulancias, hospitales, etc.). |

### Patrón obligatorio para escrituras nuevas

```ts
// ✅ CORRECTO — enforcement en servicio
const companyId = requireCompanyForAdmin(req);
const newRecord = await Model.create({ ...data, companyId });

// ❌ INCORRECTO — confiar solo en el controlador o la ruta
const newRecord = await Model.create({ ...data });
```

### Patrón de lectura legacy

```ts
// Nuevos registros (companyId presente)
const records = await Model.find({ companyId });

// Legacy fallback (companyId puede ser null)
const legacyRecord = await Model.findOne({ companyId: null, ... })
  .populate("user", "companyId").lean();
if (isSameCompany(legacyRecord.user?.companyId, adminCompanyId)) {
  // acceso permitido
}
```

**No expandir** el patrón legacy a nuevos módulos. Solo se mantiene en los modelos ya listados.

---

## Índices MongoDB por tenant

Los índices de mayor impacto para el aislamiento y rendimiento multi-tenant:

| Modelo | Índice | Tipo |
|--------|--------|------|
| `User` | `{ companyId, isActive }` | Compuesto |
| `Dienst` | `{ companyId, weekStartDate }` | Compuesto |
| `Dienst` | `{ companyId, dienstNumber }` | Compuesto |
| `DienstTemplate` | `{ companyId, dienstNumber }` | Único compuesto |
| `Hospital` | `{ companyId, name }` | Compuesto |
| `Ambulance` | `{ companyId, licensePlate }` | Único compuesto |
| `Team` | `{ driver, medic, companyId }` | Único compuesto |
| `Trip` | `{ companyId, date }` | Compuesto |
| `PayrollDocument` | `{ companyId, workerId, year, month }` | Compuesto |
| `VacationRequest` | `{ companyId, status, startDate }` | Compuesto |
| `ExcelPlanningWeek` | `{ companyId, weekStart }` | Único compuesto |

---

## Superadmin — acceso cross-tenant

El superadmin tiene acceso a datos de todas las empresas a través de rutas dedicadas (`/api/companies/*`, `/api/support-access/*`). No usa las rutas de admin de empresa.

Regla de separación en `authorizeRole`:
- `authorizeRole("admin")` → igualdad estricta, superadmin **no pasa**
- `authorizeSuperadmin` → solo superadmin

Esta separación es intencional. No relajar sin requisito explícito.

---

## Support access — acceso temporal

Un superadmin puede otorgar acceso temporal a una empresa (módulo `support-access`). El acceso tiene TTL y se registra en audit log. Una vez expirado, el token de soporte deja de funcionar.

---

## Backfills pendientes

| Script | Estado | Urgencia |
|--------|--------|---------|
| `scripts/backfill-monthly-praemie-userid-to-objectid.ts` | Pendiente de ejecutar en producción | Alta — `populate()` falla silenciosamente sin este fix |
| `scripts/backfill-isActive.ts` | Pendiente | Media — necesario antes de activar filtros `isActive` estrictos en payroll |
