# Workday review (admin)

**Route:** `/admin/summaries`  
**Required module:** `workday`

---

## What a workday is

When a worker records their operational day, they log **trips** (start, hospital, ambulance, close). The system groups this into a **workday summary** that the admin can review.

Worker guide: [Workday](../worker/JORNADA.md).

---

## What you can do

- View workdays **pending review**.
- Review hours, trips, and recorded data.
- Mark as **reviewed**.
- Perform **final closure** when your company's process requires it (no second final closure on the same day for the same shift).

---

## Recommended workflow

1. Worker closes trips in the app.
2. Summary appears in pending status.
3. Admin checks consistency with assigned shift and internal rules.
4. Admin reviews and, if appropriate, closes definitively.
5. Reviewed hours feed **bonuses** (automatic mode) → [Bonuses](./PRIMAS.md).

---

## Common situations

| Situation | Action |
|-----------|--------|
| Workday not closed by worker | Contact the worker; review [Workday](../worker/JORNADA.md) |
| Incorrect hours | Coordinate correction per internal policy before final closure |
| Workday does not appear | Check module `workday`, shift assignment that day, and that the worker used the correct app |
