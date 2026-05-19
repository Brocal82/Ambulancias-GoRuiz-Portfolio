# Shifts and scheduling (admin)

**Routes:** `/admin/dienst-templates`, `/admin/diensts`  
**Required module:** `scheduling`

---

## Concepts

| Concept | What it is |
|---------|------------|
| **Template** | Reusable model of the week (which shifts exist and at what times). |
| **Generated week** | Actual shifts (Diensts) created for a specific week. |
| **Assignment** | Person, team, or ambulance linked to a shift and day. |

---

## Typical workflow

### 1. Create or edit templates

1. Open **Templates** (`/admin/dienst-templates`).
2. Define shifts (Dienst number, times, days).
3. Save your changes.

### 2. Generate the week

1. In **Scheduling** (`/admin/diensts`), choose the week (start date).
2. Use **Generate week** from the template.
3. Review the weekly calendar.

### 3. Assign resources

In the week view you can:

- Assign **workers** to time slots.
- Assign **teams** (if you use teams).
- Assign **ambulances** (if the module is active).

The system warns about **overlaps** (same person in two incompatible shifts).

### 4. Publish for workers

When the week is ready, workers see it in:

- Mobile app → **Schedule** tab
- Worker web → `/dienst` (if using the browser)

Worker guide: [Schedule](../worker/AGENDA.md).

---

## Delete or regenerate a week

- You can **delete the generated week** and regenerate it from the template.
- Be careful if **workdays or trips** are already recorded for those shifts; check with your manager before deleting weeks in progress.

---

## Excel planning

If your company uses **Excel** instead of (or in addition to) manual templates, see [Excel planning](./PLANIFICACION-EXCEL.md).

---

## Tips

- Keep templates stable and only adjust exceptions in the specific week.
- Review schedule conflicts before closing the week.
- Workers only see **their** assignments, not the full internal schedule unless the panel allows it.
