# Domain — Praemien (Primas)

Documentación del dominio de primas económicas: cálculo automático basado en jornadas y entradas manuales diarias.

---

## Módulo backend

| Recurso | Ruta API | MODULE_KEY |
|---------|----------|------------|
| Primas automáticas (admin read) | `/api/praemien` | `praemien` |
| Primas manuales (daily entries) | `/api/praemien/manual-daily` | `praemien` |
| Primas worker (solo propias) | `/api/praemien/worker` | `praemien` |

---

## Modelos

### `MonthlyPraemie`

Prima mensual calculada automáticamente por el sistema.

```
userId         ObjectId (ref User)  — fue String hasta PR #65, backfill necesario
companyId      ObjectId | null      — legacy nullable
year           number
month          number (1-12)
totalHours     number
praemieAmount  number
status         "draft" | "confirmed" | "paid"
confirmedAt    Date?
confirmedBy    ObjectId? (ref User admin)
```

Índice único: `{ userId, year, month }` — una prima por trabajador por mes.

**Nota crítica:** El campo `userId` era de tipo `String` hasta PR #65. Se cambió a `ObjectId` para corregir fallos silenciosos en `populate()`. El script `backfill-monthly-praemie-userid-to-objectid.ts` debe ejecutarse en producción antes de que las queries con populate funcionen correctamente.

### `PraemienManualDailyEntry`

Entrada manual diaria de primas (modo `manual` de la empresa).

```
companyId   ObjectId (required)
userId      ObjectId (ref User)
date        Date
amount      number
notes       string?
createdBy   ObjectId (ref User admin)
```

Índice único: `{ companyId, userId, date }` — una entrada por trabajador por día por empresa.

---

## Dos modos de operación

El campo `Company.praemienMode` determina el comportamiento:

### Modo `automatic`

- El sistema calcula `MonthlyPraemie` a partir de `WorkdaySummary` (jornadas revisadas).
- El admin revisa y confirma la prima calculada.
- El worker ve su prima mensual en la app.

### Modo `manual`

- El admin introduce entradas diarias (`PraemienManualDailyEntry`) para cada trabajador.
- El sistema agrega las entradas del mes para calcular la prima total.
- Útil para empresas con estructuras de pago no estándar.

El modo puede cambiar con una fecha de vigencia (`praemienModeEffectiveFrom: { year, month }`). Los meses anteriores al cambio mantienen el modo anterior.

---

## Lifecycle — modo automático

```
[Jornadas del mes cerradas y revisadas]
         │
         ▼
  CÁLCULO AUTOMÁTICO
  Sistema: agrega WorkdaySummary del mes
  → MonthlyPraemie { status: "draft", totalHours, praemieAmount }
         │
         ▼
  REVISIÓN ADMIN
  Admin: GET /api/praemien → lista borradores del mes
  Admin: PATCH /api/praemien/:id/confirm
  → status: "confirmed", confirmedAt, confirmedBy
         │
         ▼
  PAGO
  Admin: PATCH /api/praemien/:id/pay
  → status: "paid"
         │
         ▼
  WORKER VE SU PRIMA
  Worker: GET /api/praemien/worker → sus primas confirmadas/pagadas
```

---

## Lifecycle — modo manual

```
[Día laboral]
      │
      ▼
  ENTRADA DIARIA
  Admin: POST /api/praemien/manual-daily
  { userId, date, amount, notes }
  → PraemienManualDailyEntry creado
      │ (una por trabajador por día)
      ▼
  AGREGADO MENSUAL
  Sistema: suma entries del mes → MonthlyPraemie
      │
      ▼
  (mismo flujo de revisión/pago que modo automático)
```

---

## Endpoints principales

### Admin

| Método | Ruta | Acción |
|--------|------|--------|
| `GET` | `/api/praemien` | Lista primas del mes (por empresa) |
| `GET` | `/api/praemien/:year/:month` | Primas de un mes específico |
| `PATCH` | `/api/praemien/:id/confirm` | Confirmar prima |
| `PATCH` | `/api/praemien/:id/pay` | Marcar como pagada |
| `GET` | `/api/praemien/manual-daily` | Entradas manuales del día/mes |
| `POST` | `/api/praemien/manual-daily` | Crear entrada manual |
| `PATCH` | `/api/praemien/manual-daily/:id` | Editar entrada manual |
| `DELETE` | `/api/praemien/manual-daily/:id` | Eliminar entrada manual |

### Worker

| Método | Ruta | Acción |
|--------|------|--------|
| `GET` | `/api/praemien/worker` | Mis primas (propias, confirmadas/pagadas) |
| `GET` | `/api/praemien/worker/:year/:month` | Mi prima de un mes |

---

## Multi-tenant

- `MonthlyPraemie.companyId` es nullable (legacy). Las queries admin filtran por `requireCompanyForAdmin`.
- `PraemienManualDailyEntry.companyId` es obligatorio (required).
- El índice único de `PraemienManualDailyEntry` incluye `companyId` para garantizar aislamiento.

---

## Frontend

El módulo frontend de praemien está fragmentado en tres archivos de API siguiendo la complejidad del dominio:

- `src/modules/praemien/domain/api.ts` — primas automáticas admin
- `src/modules/praemien/domain/manualDailyApi.ts` — entradas manuales
- `src/modules/praemien/domain/historyApi.ts` — historial

La configuración del modo praemien se carga en `AuthProvider` al hacer login y se refresca en foco de ventana.
