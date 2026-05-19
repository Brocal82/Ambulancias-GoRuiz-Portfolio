# Domain — Workday

Documentación del dominio de jornada laboral: apertura, viajes, cierre y revisión admin.

---

## Módulos implicados

| Módulo backend | Ruta API | MODULE_KEY |
|----------------|----------|------------|
| `trips` | `/api/trips` | `workday` |
| `workday-summary` | `/api/workday-summary` | `workday` |

Ambos módulos están agrupados bajo el MODULE_KEY `workday`. Si el módulo está deshabilitado para una empresa, ambas rutas devuelven 403.

---

## Modelos

### `Trip`

```
assignmentId   ObjectId (ref Dienst assignment)
date           Date
workerId       ObjectId (ref User)
companyId      ObjectId | null  (legacy nullable)
startTime      string
endTime        string?
hospital       ObjectId? (ref Hospital)
ambulanceId    ObjectId? (ref Ambulance)
notes          string?
status         "open" | "closed"
isFinalClosure boolean
```

Índices:
- `{ assignmentId, date }` — consultas de jornada por turno
- `{ companyId, date }` — historial admin por empresa y fecha

### `WorkdaySummary`

```
assignmentId   ObjectId
date           Date
workerId       ObjectId
companyId      ObjectId | null
totalHours     number
status         "pending_review" | "reviewed"
isFinalClosure boolean
reviewedAt     Date?
reviewedBy     ObjectId? (ref User admin)
```

Índice único partial: `{ assignmentId, date }` donde `isFinalClosure: true`

Este índice garantiza que solo puede existir **un cierre final** por turno por día.

---

## Lifecycle de la jornada

```
[Turno asignado]
      │
      ▼
  APERTURA
  Worker: POST /api/trips
  { date, startTime, assignmentId, ... }
      │
      ▼
  VIAJE(S)
  Worker: PATCH /api/trips/:id
  (actualiza hospital, ambulancia, notas)
      │ (pueden ser múltiples trips en una jornada)
      ▼
  CIERRE WORKER
  Worker: PATCH /api/trips/:id/close
  { endTime }
  → status: "closed"
      │
      ▼
  RESUMEN AUTOMÁTICO
  WorkdaySummary creado/actualizado
  { totalHours, status: "pending_review" }
      │
      ▼
  REVISIÓN ADMIN
  Admin: PATCH /api/workday-summary/:id/review
  → status: "reviewed", reviewedAt, reviewedBy
      │
      ▼
  CIERRE FINAL
  Admin: POST /api/workday-summary/:id/final-close
  → isFinalClosure: true
  (índice unique partial previene duplicados)
```

### Restricciones del lifecycle

- Un worker solo puede cerrar su propia jornada (`authorizeSelfOrAdmin`)
- El cierre final lo hace el admin; solo puede existir uno por `{ assignmentId, date }` gracias al índice partial unique
- El admin puede reabrir un cierre no-final si hay error de datos
- Una jornada con `isFinalClosure: true` no puede modificarse (guard en servicio)

---

## Endpoints principales

### Worker

| Método | Ruta | Acción |
|--------|------|--------|
| `POST` | `/api/trips` | Abrir jornada / nuevo viaje |
| `GET` | `/api/trips/me` | Mis viajes (filtro por fecha) |
| `PATCH` | `/api/trips/:id` | Actualizar viaje |
| `PATCH` | `/api/trips/:id/close` | Cerrar viaje |

### Admin

| Método | Ruta | Acción |
|--------|------|--------|
| `GET` | `/api/workday-summary` | Listado jornadas empresa |
| `GET` | `/api/workday-summary/:id` | Detalle jornada |
| `PATCH` | `/api/workday-summary/:id/review` | Marcar como revisado |
| `POST` | `/api/workday-summary/:id/final-close` | Cierre final |
| `GET` | `/api/trips/admin` | Viajes de toda la empresa |

---

## Multi-tenant

- `Trip.companyId` es nullable (legacy). Queries admin filtran siempre por `companyId` usando `requireCompanyForAdmin`.
- `WorkdaySummary.companyId` es nullable (legacy). Mismo patrón.
- El cron de cleanup de Diensts (`cleanupOldDiensts`) no toca registros con `companyId: null`.

---

## Relación con Diensts

Cada `Trip` referencia a un `assignmentId` que es un Dienst asignado. La jornada no puede existir sin un turno asignado. Si el Dienst se elimina (cron cleanup), los Trips asociados quedan huérfanos — el servicio de workday debe validar la existencia del Dienst al crear viajes nuevos.

---

## Integración con Praemien

`WorkdaySummary` es input para el cálculo de primas automático (`MonthlyPraemie`). El módulo `praemien` lee las jornadas revisadas (`status: "reviewed"`) para calcular horas y primas del mes. Ver `DOMAIN-praemien.md` para el detalle.
