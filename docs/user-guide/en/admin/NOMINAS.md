# Payroll (admin)

**Routes:** `/admin/payroll`, `/admin/payroll/nominas`, `/admin/payroll/month/:year/:month`  
**Required module:** `payroll`

---

## What you can do

- **Upload** payroll PDF files (one or several).
- The system tries to **match** each PDF to a worker (by name or other criteria).
- Review **unassigned** or **conflicting** payrolls and assign them manually.
- **Invalidate** an incorrect payroll (no longer visible to the worker).

---

## Upload workflow

1. Go to **Payroll** → upload section or specific month.
2. Select the **year and month** of the period.
3. Upload the PDFs.
4. Review matching status:
   - **Matched** — assigned correctly.
   - **Unmatched** — requires manual assignment.
   - **Conflict** — multiple candidates; choose the correct worker.

---

## What the worker sees

Only their own active payrolls, in the app or at `/worker/payroll`.  
Guide: [Worker payroll](../worker/NOMINAS.md).

---

## Security

Payrolls are sensitive documents. They are downloaded only through authenticated access (not public links on `/uploads`).

---

## Tips

- Use consistent file names if your process allows it (helps automatic matching).
- Invalidate the incorrect version before uploading again instead of duplicating without control.
