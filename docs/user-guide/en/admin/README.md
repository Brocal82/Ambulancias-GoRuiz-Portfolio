# Administrator manual

Using the **web administration panel** (role `admin`). After signing in, the home page is usually `/admin`.

---

## Before you start

1. [Getting started](./PRIMEROS-PASOS.md) — access, invitations, language
2. Check which modules are active for your company (side menu). Only contracted modules are shown.

---

## Guides by module

| Guide | Route in the app | When to use |
|-------|------------------|-------------|
| [Getting started](./PRIMEROS-PASOS.md) | `/login`, `/admin/invitations` | User onboarding and initial setup |
| [Users](./USUARIOS.md) | `/admin/users`, `/admin/user/:id` | Manage workers and profiles |
| [Invitations](./INVITACIONES.md) | `/admin/invitations` | Send registration links |
| [Shifts (scheduling)](./TURNOS.md) | `/admin/diensts`, `/admin/dienst-templates` | Templates, weeks, and assignments |
| [Excel planning](./PLANIFICACION-EXCEL.md) | `/admin/excel-planning` | Import schedule from Excel (if active) |
| [Catalogs](./CATALOGOS.md) | Hospitals, ambulances, teams | Master data |
| [Workdays](./JORNADA.md) | `/admin/summaries` | Review and close workdays |
| [Vacation](./VACACIONES.md) | `/admin/vacations` | Approve or propose dates |
| [Sick leave](./BAJAS.md) | `/admin/sick-leaves` | Manage sick leave |
| [Messages](./MENSAJES.md) | `/admin/messages` | Internal communication |
| [Appointments](./CITAS.md) | `/admin/appointments` | Appointments with workers |
| [Mechanics](./MECANICA.md) | `/admin/mechanics` | Breakdowns and work orders |
| [Bonuses](./PRIMAS.md) | `/admin/praemien` | Review and confirm bonuses |
| [Payroll](./NOMINAS.md) | `/admin/payroll` | Upload and assign payroll PDFs |
| [Documents](./DOCUMENTOS.md) | `/admin` (documents module) | Publish and deliver documents |

---

## Guides for your team (workers)

As an administrator, it helps to know the worker experience:

| Guide | Link |
|-------|------|
| Getting started in the app | [../worker/INICIO.md](../worker/INICIO.md) |
| Schedule and shifts | [../worker/AGENDA.md](../worker/AGENDA.md) |
| Daily workday | [../worker/JORNADA.md](../worker/JORNADA.md) |
| All worker guides | [../worker/README.md](../worker/README.md) |

---

## Profile and sign out

- **Profile:** `/profile` — personal details, P-Schein, photo (depending on configuration).
- **Sign out:** user menu. The session is stored in the browser until you close the tab or the token expires.

---

## Common issues

| Symptom | What to check |
|---------|---------------|
| A menu item from the manual is missing | Module not active for your company |
| "Module not enabled" | Same case; contact GoRuiz |
| Worker cannot sign in | User active, invitation accepted, correct credentials |
| A shift does not appear in the app | Week generated, assignment saved, module `scheduling` active |
