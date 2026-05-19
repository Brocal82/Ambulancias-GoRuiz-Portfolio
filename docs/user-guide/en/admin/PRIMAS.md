# Bonuses (admin)

**Route:** `/admin/praemien`  
**Required module:** `praemien`

---

## Company modes

Your company may be in one of these modes:

| Mode | Behavior |
|------|----------|
| **Automatic** | The system calculates bonuses from **reviewed** workdays. |
| **Manual** | The admin enters amounts **day by day** per worker. |

The mode is set in company configuration (contact GoRuiz if unsure).

---

## Automatic mode

1. Make sure the month's **workdays** are reviewed → [Workday](./JORNADA.md).
2. Open **Bonuses** and select year/month.
3. Review generated drafts (hours, amount).
4. **Confirm** the worker's or month's bonus.
5. Mark as **paid** when disbursed (per your internal process).

---

## Manual mode

1. Open the **daily entries** section (manual daily).
2. For each worker and working day, enter the agreed amount.
3. At month end, review the total and confirm/pay as in automatic mode.

---

## What the worker sees

In the app they can view confirmed or paid bonuses (tab or access from Home depending on design).  
Guide: [Worker bonuses](../worker/PRIMAS.md).

---

## Common errors

| Issue | Likely cause |
|-------|--------------|
| Bonus is zero | Workdays not reviewed or month with no records |
| Module does not appear | `praemien` not active for the company |
| Outdated data | Company mode change with future effective date |
