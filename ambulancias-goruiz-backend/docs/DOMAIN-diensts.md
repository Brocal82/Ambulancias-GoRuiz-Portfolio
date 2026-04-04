# Domain: Diensts (Scheduled Shifts)

**Scope:** `src/modules/diensts/` and `src/modules/dienst-templates/`

---

## What a Dienst is

A Dienst is a single scheduled shift. It records a date, a start and end time, and the assigned
worker(s), ambulance, and team for that slot. Diensts are generated in bulk for a calendar week
from reusable DienstTemplates — they are not created one at a time by hand.

---

## Sub-module responsibilities

| Sub-module | Path | Role |
|---|---|---|
| Templates (CRUD) | `dienst-templates/` | Create, update, and delete the reusable shift templates |
| Generation | `diensts/templates/` | Generate or delete Dienst records for a given ISO week from templates |
| Calendar | `diensts/calendar/` | Read-only: weekly and monthly aggregated views |
| Assignments | `diensts/assignments/` | Mutate slot assignments: assign or remove user, ambulance, or team on an existing Dienst |

Assignment mutations belong exclusively in `diensts/assignments/`. Do not add slot-assignment
logic to the generation or calendar sub-modules.

---

## Lifecycle sequence

```
DienstTemplate (admin creates, reusable)
        │
        ▼
generate-diensts-for-week   → creates Dienst documents for the target ISO week
        │
        ▼
assignments/*               → admin assigns workers, ambulances, and teams to slots
        │
        ▼
cleanupOldDiensts (cron)    → removes stale unassigned Diensts on a schedule
```

This sequence is a one-way flow. Generating again for the same week must be idempotent (check
for existing records before inserting). Deleting a DienstTemplate does not retroactively delete
already-generated Dienst records for past weeks.

---

## Files that require lifecycle awareness before modification

Changes to any of the following files affect the entire lifecycle above and may have downstream
impact on calendar rendering, workday-summary, and payroll:

- `diensts/templates/controllers/generate-diensts-for-week.controller.ts`
- `diensts/templates/controllers/delete-diensts-for-week.controller.ts`
- `diensts/templates/services/lifecycle.service.ts`
- `src/utils/cleanupOldDiensts.ts` (cron registered in `src/index.ts`)

---

## companyId in Dienst records

Existing Dienst documents may have `companyId: null` — this is expected legacy data.

- **Read paths** may use legacy-tolerant filters where they already exist.
- **New generated Diensts** must have `companyId` set from the authenticated admin's context.

For the full companyId policy and the legacy-null decision logic, see:
`ambulancias-goruiz-backend/docs/POLICY-multi-tenant-legacy-companyId.md`

---

## Overlap detection

Time-conflict checks between Dienst slots use `src/utils/overlap.ts`.
This is the single source of truth for overlap logic. Do not implement custom time-overlap
checks elsewhere in this domain.
