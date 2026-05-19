# Turnos y planificación (admin)

**Rutas:** `/admin/dienst-templates`, `/admin/diensts`  
**Módulo requerido:** `scheduling`

---

## Conceptos

| Concepto | Qué es |
|----------|--------|
| **Plantilla** | Modelo reutilizable de la semana (qué turnos existen y a qué hora). |
| **Semana generada** | Turnos reales (Diensts) creados para una semana concreta. |
| **Asignación** | Persona, equipo o ambulancia vinculados a un turno y día. |

---

## Flujo habitual

### 1. Crear o editar plantillas

1. Entra en **Plantillas** (`/admin/dienst-templates`).
2. Define los turnos (número de Dienst, horarios, días).
3. Guarda los cambios.

### 2. Generar la semana

1. En **Planificación** (`/admin/diensts`), elige la semana (fecha de inicio).
2. Usa **Generar semana** a partir de la plantilla.
3. Revisa el calendario semanal.

### 3. Asignar recursos

En la vista de semana puedes:

- Asignar **trabajadores** a franjas.
- Asignar **equipos** (si usas equipos).
- Asignar **ambulancias** (si el módulo está activo).

El sistema avisa si hay **solapamientos** (misma persona en dos turnos incompatibles).

### 4. Publicar para los trabajadores

Cuando la semana esté lista, los trabajadores la ven en:

- App móvil → pestaña **Agenda**
- Web worker → `/dienst` (si usan el navegador)

Guía trabajador: [Agenda](../worker/AGENDA.md).

---

## Eliminar o regenerar una semana

- Puedes **eliminar la semana generada** y volver a generarla desde plantilla.
- Ten cuidado si ya hay **jornadas o viajes** registrados sobre esos turnos; consulta con tu responsable antes de borrar semanas en curso.

---

## Planificación por Excel

Si tu empresa usa **Excel** en lugar de (o además de) plantillas manuales, ver [Planificación Excel](./PLANIFICACION-EXCEL.md).

---

## Consejos

- Mantén plantillas estables y solo ajusta excepciones en la semana concreta.
- Revisa conflictos de horario antes de cerrar la semana.
- Los trabajadores solo ven **sus** asignaciones, no toda la planificación interna salvo lo que el panel permita.
