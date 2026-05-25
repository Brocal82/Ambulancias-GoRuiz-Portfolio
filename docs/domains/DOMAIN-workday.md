# Domain — Workday

Documentación del dominio de jornada laboral: viajes, cierre parcial/final y revisión admin.

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

Viaje operativo ligado a un assignment de Dienst.

Campos relevantes: `assignmentId`, `date`, `driver`, `medic`, `companyId`, datos de paciente/horas/km, `countsTrip`, `sentInSummary`.

Índices:
- `{ assignmentId, date }` — consultas de jornada por turno
- `{ companyId, date }` — historial admin por empresa y fecha

### `TripSetup`

Configuración inicial de jornada por assignment (ambulancia, km inicial). Lectura/escritura filtrada por `{ assignmentId, companyId }` tras resolver el assignment en tenant.

### `WorkdaySummary`

Resumen embebido de viajes + km de servicio al cierre parcial o final.

Campos relevantes: `assignmentId`, `date`, `companyId`, `initialKm`, `finalKm`, `totalDienstKm`, `trips[]` (subdocumentos), `isFinalClosure`, `partialClosureReason`, `totalEffectivePatients`, `totalRealTrips`, `isReviewed`, `reviewedAt`.

Índice único partial: `{ assignmentId, date }` donde `isFinalClosure: true` — solo un cierre final por turno y día.

---

## Lifecycle de la jornada

```
[Turno asignado — Dienst assignment]
      │
      ▼
  TRIP SETUP (opcional)
  PUT /api/trips/setup/:assignmentId
      │
      ▼
  VIAJES
  POST /api/trips  (múltiples viajes por assignment+día)
  GET  /api/trips/date/:date  (solo sentInSummary: false)
      │
      ▼
  CIERRE PARCIAL (opcional, repetible)
  POST /api/workday-summary/partial
  → isFinalClosure: false
  → marca viajes incluidos sentInSummary: true
  → bloqueado si ya existe cierre final
      │
      ▼
  CIERRE FINAL
  POST /api/workday-summary
  → isFinalClosure: true
  → totales calculados en servidor desde trips en BD
  → 409 si cierre final duplicado
  → bloquea nuevos POST /api/trips para ese assignment+date
      │
      ▼
  REVISIÓN ADMIN
  PATCH /api/workday-summary/:id/review
  → isReviewed: true, reviewedAt
      │
      ▼
  DOWNSTREAM PRAEMIEN
  Manual daily / final-closure-dates consumen summaries con isFinalClosure: true
```

### Reglas de cierre (backend = fuente de verdad)

- El body de cierre **no confía** en snapshots embebidos de viajes: solo se usan los `_id` para recargar trips abiertos (`sentInSummary: false`, mismo `assignmentId` y `companyId`).
- Totales, pacientes efectivos y km se calculan **solo** desde documentos Trip en BD.
- Si el cliente envía campos de viaje que no coinciden con BD → **409** (snapshot obsoleto).
- `finalKm >= initialKm` obligatorio en cierre parcial y final.
- Cierre parcial **rechazado** si ya existe cierre final para assignment+date.
- Cierre final duplicado → **409** (índice unique + pre-check).

---

## Endpoints principales

### Worker / admin en assignment

| Método | Ruta | Acción |
|--------|------|--------|
| `PUT` | `/api/trips/setup/:assignmentId` | Upsert trip setup (tenant) |
| `GET` | `/api/trips/setup/:assignmentId` | Leer trip setup |
| `POST` | `/api/trips` | Crear viaje |
| `GET` | `/api/trips/date/:date` | Viajes abiertos del día |
| `POST` | `/api/workday-summary/partial` | Cierre parcial |
| `POST` | `/api/workday-summary` | Cierre final |

### Admin

| Método | Ruta | Acción |
|--------|------|--------|
| `GET` | `/api/workday-summary` | Listado summaries empresa |
| `GET` | `/api/workday-summary/count?status=` | Contador pendientes |
| `PATCH` | `/api/workday-summary/:id/review` | Marcar revisado |

---

## Multi-tenant

- Assignment resolution exige `companyId` del caller en el Dienst.
- Trips y summaries nuevos llevan `companyId` del Dienst.
- TripSetup read/upsert filtra por `{ assignmentId, companyId }`.
- Review de summary: match estricto de `companyId` (sin fallback legacy null).

---

## Integración con Praemien

`WorkdaySummary` con `isFinalClosure: true` alimenta APIs de cierre final y entrada manual diaria de Prämien. Los cierres parciales no sustituyen al cierre final para downstream Praemien.

Ver `DOMAIN-praemien.md` para detalle.
