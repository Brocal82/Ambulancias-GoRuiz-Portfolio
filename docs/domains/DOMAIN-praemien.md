# Domain — Praemien (Primas)

Documentación del dominio de primas económicas: cálculo automático desde jornadas (`WorkdaySummary`) y entradas manuales diarias.

---

## Módulo backend

| Recurso | Ruta API base | MODULE_KEY |
|---------|---------------|------------|
| Resumen / historial / cierre mensual | `/api/praemien` | `praemien` |
| Entradas manuales diarias | `/api/praemien/manual-daily` | `praemien` |

---

## Modelos

### `MonthlyPraemie`

Snapshot mensual por trabajador (automático o manual).

Campos relevantes: `userId`, `companyId`, `year`, `month`, `averagePatients`, `premieLevel`, `snapshotSource` (`"automatic"` | `"manual"`), `createdAt`.

Índice único: `{ userId, year, month }`.

Los snapshots con `snapshotSource: "manual"` **no** pueden sobrescribirse con `POST /save-monthly` automático.

### `PraemienManualDailyEntry`

Entrada manual diaria cuando la empresa está en modo manual efectivo.

Campos relevantes: `companyId` (required), `userId`, `date`, `workerSubmittedValue`, `adminFinalValue`, `status` (`draft` | `submitted` | `approved` | `rejected` | `reopened`).

Índice único: `{ companyId, userId, date }`.

---

## Dos modos de operación

`Company.praemienMode` + `praemienModeEffectiveFrom` (`{ year, month }`) determinan el modo efectivo por trabajador (`getEffectiveManualPraemienContextForUser`).

### Modo `automatic` (efectivo)

- **Live view:** `GET /monthly-summary` agrega `WorkdaySummary` del mes calendario actual.
- **Historial:** `GET /monthly-history` deriva meses pasados desde summaries + snapshots manuales legacy.
- **Cierre:** `POST /save-monthly?year=&month=` (admin) persiste `MonthlyPraemie` con `snapshotSource: "automatic"`.

**Reglas de agregación automática (backend = fuente de verdad):**

| Filtro | ¿Aplica? |
|--------|----------|
| `isFinalClosure: true` | **Sí** — solo cierres finales; los parciales se excluyen para evitar doble conteo parcial+final. |
| `isReviewed: true` | **No** — la revisión admin de jornada es un paso de workflow workday; los totales Praemien incluyen finales aunque aún no estén marcados como revisados. |
| `companyId` del usuario | **Sí** — filtro estricto (sin fallback `null`) en agregación automática. |
| Suma por día | Se suman todos los finales del usuario (conductor o médico) ese día; puede haber varios Diensts el mismo día. |

### Modo `manual` (efectivo)

- Trabajador: `PUT/GET /manual-daily/*` — valores diarios; requiere cierre final workday cuando el módulo workday está activo (`isFinalClosure: true`, con fallback legacy `companyId: null` **solo** en helpers manuales y **siempre** acotado por `driver`/`medic` userId).
- Admin: `GET/POST /manual-daily/admin/*` — cola de revisión, approve/reject/reopen/correct-approve.
- **Live view:** `GET /monthly-summary` usa solo filas **aprobadas** del mes actual.
- **Historial:** meses ≥ effective manual usan snapshots `MonthlyPraemie` con `snapshotSource: "manual"` (`ensureManualMonthCloseSnapshot`).

---

## Endpoints principales (implementados)

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `GET` | `/api/praemien/monthly-summary` | worker/admin | Mes calendario actual; `?userId=` solo admin (misma empresa). |
| `GET` | `/api/praemien/monthly-history` | worker/admin | Historial mensual (excluye mes en curso). |
| `POST` | `/api/praemien/save-monthly` | admin | `year` y `month` query **obligatorios** (400 si faltan o inválidos; sin fallback a fecha actual). |
| `PUT` | `/api/praemien/manual-daily` | worker | Upsert entrada manual diaria. |
| `GET` | `/api/praemien/manual-daily/month` | worker | Entradas del mes (`year`, `month` requeridos). |
| `GET` | `/api/praemien/manual-daily/final-closure-dates` | worker | Días con cierre final workday en el mes. |
| `GET` | `/api/praemien/manual-daily/admin/pending-*` | admin | Cola pendiente. |
| `POST` | `/api/praemien/manual-daily/admin/approve` | admin | Aprobar (opcional cascade compañero Dienst). |
| `POST` | `/api/praemien/manual-daily/admin/reject` | admin | Rechazar. |
| `POST` | `/api/praemien/manual-daily/admin/reopen` | admin | Reabrir. |

---

## Relación con payroll

Praemien calcula **promedio de pacientes efectivos** y nivel de prima (`premieLevel`). Payroll es un módulo separado; no hay integración contable automática. Los snapshots mensuales son la referencia histórica downstream.

---

## Multi-tenant

- Agregación automática: `companyId` estricto vía `getCompanyObjectIdForPraemienUser`.
- Helpers manuales workday: `legacyAwareWorkdayCompanyFilter` — `{ companyId: co } OR { companyId: null }` **siempre** combinado con filtro `driver`/`medic` = userId objetivo (ver `POLICY-multi-tenant-legacy-companyId.md`).
- `PraemienManualDailyEntry.companyId` es obligatorio.

---

## Frontend

- `src/modules/praemien/domain/api.ts` — summary/history
- `src/modules/praemien/domain/manualDailyApi.ts` — manual daily + admin review
- `src/modules/praemien/domain/historyApi.ts` — legacy save helper
- Etiquetas UI: **pacientes efectivos** (conteo ponderado), no “viajes” crudos.
- `calculateEffectivePatients` redondea a múltiplos de 0.5 (paridad con backend workday-summary).

---

## OpenAPI

Rutas documentadas en `src/openapi/openapi.json` bajo tag `Praemien`.
