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

Campos relevantes: `companyId` (required), `userId`, `date`, `workerSubmittedValue`, `adminFinalValue`, `status` (`draft` | `submitted` | `approved` | `rejected` | `reopened`), `submittedViaDienstPartnerSync` (opcional, `true` si el envío fue automático al sincronizar con el compañero de Dienst).

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

**Sync equipo Dienst (conductor ↔ médico):**

| Momento | Comportamiento |
|---------|----------------|
| Trabajador envía (`submitted`) | Crea o actualiza la fila del compañero con el mismo valor; marca `submittedViaDienstPartnerSync: true` en la fila del compañero. |
| Admin aprueba (`cascadeTeammate`, defecto `true`) | Aprueba al compañero pendiente con el mismo `adminFinalValue`. Respuesta: `{ entry, syncedTeammateUserIds }`. |

**Cola admin enriquecida:** `workdayReportsTotalPraemie` = suma de `totalEffectivePatients` de reportes **parcial + final** del mismo Dienst/día (referencia para confirmar; no sustituye el valor manual). Redondeo a múltiplos de 0,5.

**Política UI admin (producto):** el valor final debe introducirse explícitamente antes de aprobar. El backend aún acepta approve sin `adminFinalValue` (usa valor del trabajador); la web exige escribir el campo.

**Rechazo:** la API `POST .../reject` sigue activa para datos legacy, integraciones y tests. **Política admin (desde #117):** la cola global no muestra rechazo; el flujo preferido es **reabrir** (`POST .../reopen`) para que el trabajador corrija y reenvíe. Entradas ya rechazadas pueden volver a enviarse con `PUT /manual-daily`.

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
| `GET` | `/api/praemien/manual-daily/admin/pending-entries` | admin | Cola pendiente enriquecida (incl. `workdayReportsTotalPraemie`). |
| `GET` | `/api/praemien/manual-daily/admin/day-workday-summaries` | admin | Reportes parcial/final del Dienst para un día. |
| `GET` | `/api/praemien/manual-daily/admin/day-queue-row` | admin | Fila de cola para cualquier estado del día. |
| `POST` | `/api/praemien/manual-daily/admin/approve` | admin | Aprobar; body opcional `cascadeTeammate`; respuesta `{ entry, syncedTeammateUserIds }`. |
| `POST` | `/api/praemien/manual-daily/admin/reject` | admin | Rechazar (API; sin UI en cola global). |
| `POST` | `/api/praemien/manual-daily/admin/reopen` | admin | Reabrir. |

Todas las rutas admin de `manual-daily` validan que el `userId` objetivo pertenezca a la misma empresa que el admin (`403` cross-tenant).

---

## Tiempo real

Tras mutaciones exitosas (envío manual, approve/reject/reopen/correct, `save-monthly`, cierre final workday), el backend emite WebSocket `praemien_changed` (module-gated `PRAEMIEN`) y `admin_counts_changed` cuando aplica.

Frontend web: `praemien_changed` → evento local `praemien-manual-pending-changed` → refresco de cola, badge pendientes, calendarios worker/admin.

---

## Relación con payroll

Praemien calcula **promedio de pacientes efectivos** y nivel de prima (`premieLevel`). Payroll es un módulo separado; no hay integración contable automática. Los snapshots mensuales son la referencia histórica downstream.

---

## Multi-tenant

- Agregación automática: `companyId` estricto vía `getCompanyObjectIdForPraemienUser`.
- Helpers manuales workday: `legacyAwareWorkdayCompanyFilter` — `{ companyId: co } OR { companyId: null }` **siempre** combinado con filtro `driver`/`medic` = userId objetivo (ver `POLICY-multi-tenant-legacy-companyId.md`).
- `PraemienManualDailyEntry.companyId` es obligatorio.
- Escrituras admin (`approve`, `reject`, `reopen`, …): `assertAdminSameCompanyAsTarget` → `403` si el trabajador es de otra empresa.

---

## Frontend

- `src/modules/praemien/domain/api.ts` — summary/history
- `src/modules/praemien/domain/manualDailyApi.ts` — manual daily + admin review
- `src/modules/praemien/hooks/useAdminManualPraemieQueue.ts` — estado compartido cola admin
- `src/modules/praemien/components/AdminManualPraemieQueuePanel.tsx` — cola pendientes (`/admin/praemien` y filtro usuarios)
- Etiquetas UI: **pacientes efectivos** (conteo ponderado), no “viajes” crudos.
- `calculateEffectivePatients` redondea a múltiplos de 0.5 (paridad con backend workday-summary).
- **Workday + manual:** en modo manual efectivo, los modales de cierre parcial/final y el detalle admin de jornada ocultan columnas/totales Prämie (`usePraemienWorkdayUiActive` / `isPraemienWorkdayUiActive`). La entrada manual diaria sustituye el cálculo automático en jornada.

### App móvil (`apps/app-worker`)

- `WorkerPraemienScreen`: calendario manual, envío/actualización de valores, hint de sync compañero, estados rechazado/reabierto.
- Workday móvil: misma regla `isPraemienWorkdayUiActive` para ocultar Prämie en cierres cuando el modo manual está vigente.

---

## OpenAPI

Rutas legacy bajo tag `Praemien` en `src/openapi/openapi.json`. Las rutas `manual-daily/*` pueden no estar todas documentadas en OpenAPI; ver tabla de endpoints arriba.
