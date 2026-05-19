# Manual del administrador

Uso del **panel web de administración** (rol `admin`). Tras iniciar sesión, la página de inicio suele ser `/admin`.

---

## Antes de empezar

1. [Primeros pasos](./PRIMEROS-PASOS.md) — acceso, invitaciones, idioma
2. Comprueba qué módulos tiene activos tu empresa (menú lateral). Solo aparecen los contratados.

---

## Guías por módulo

| Guía | Ruta en la app | Cuándo usarla |
|------|----------------|---------------|
| [Primeros pasos](./PRIMEROS-PASOS.md) | `/login`, `/admin/invitations` | Alta de usuarios y configuración inicial |
| [Usuarios](./USUARIOS.md) | `/admin/users`, `/admin/user/:id` | Gestionar trabajadores y perfiles |
| [Invitaciones](./INVITACIONES.md) | `/admin/invitations` | Enviar enlaces de registro |
| [Turnos (planificación)](./TURNOS.md) | `/admin/diensts`, `/admin/dienst-templates` | Plantillas, semanas y asignaciones |
| [Planificación Excel](./PLANIFICACION-EXCEL.md) | `/admin/excel-planning` | Importar plan desde Excel (si está activo) |
| [Catálogos](./CATALOGOS.md) | Hospitales, ambulancias, equipos | Datos maestros |
| [Jornadas](./JORNADA.md) | `/admin/summaries` | Revisar y cerrar jornadas |
| [Vacaciones](./VACACIONES.md) | `/admin/vacations` | Aprobar o proponer fechas |
| [Bajas](./BAJAS.md) | `/admin/sick-leaves` | Gestionar bajas médicas |
| [Mensajes](./MENSAJES.md) | `/admin/messages` | Comunicación interna |
| [Citas](./CITAS.md) | `/admin/appointments` | Citas con trabajadores |
| [Mecánica](./MECANICA.md) | `/admin/mechanics` | Averías y órdenes de trabajo |
| [Primas](./PRIMAS.md) | `/admin/praemien` | Revisar y confirmar primas |
| [Nóminas](./NOMINAS.md) | `/admin/payroll` | Subir y asignar PDFs de nómina |
| [Documentos](./DOCUMENTOS.md) | `/admin` (módulo documentos) | Publicar y entregar documentos |

---

## Guías para tu equipo (trabajadores)

Como administrador conviene conocer la experiencia del trabajador:

| Guía | Enlace |
|------|--------|
| Inicio en la app | [../worker/INICIO.md](../worker/INICIO.md) |
| Agenda y turnos | [../worker/AGENDA.md](../worker/AGENDA.md) |
| Jornada diaria | [../worker/JORNADA.md](../worker/JORNADA.md) |
| Todas las guías worker | [../worker/README.md](../worker/README.md) |

---

## Perfil y cierre de sesión

- **Perfil:** `/profile` — datos personales, P-Schein, foto (según configuración).
- **Cerrar sesión:** menú de usuario. La sesión se guarda en el navegador hasta cerrar la pestaña o caducar el token.

---

## Problemas frecuentes

| Síntoma | Qué comprobar |
|---------|----------------|
| No veo un menú del manual | Módulo no activo para tu empresa |
| «Módulo no habilitado» | Mismo caso; contactar con GoRuiz |
| Trabajador no puede entrar | Usuario activo, invitación aceptada, credenciales correctas |
| No aparece un turno en la app | Semana generada, asignación guardada, módulo `scheduling` activo |
