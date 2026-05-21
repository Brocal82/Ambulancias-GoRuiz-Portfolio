# Catálogos: hospitales, ambulancias y equipos (admin)

Estos datos maestros alimentan turnos, jornadas y mecánica.

---

## Hospitales

**Ruta:** `/admin/hospitals`  
**Módulo:** `hospitals`

- Alta, edición y baja de hospitales destino.
- Las actualizaciones admiten **PUT** (cuerpo completo) y **PATCH** (campos parciales).
- La baja se bloquea (HTTP 409) si el nombre o la dirección del hospital aparecen como destino en viajes o jornadas.

---

## Ambulancias

**Ruta:** `/admin/ambulances`  
**Módulo:** `ambulances`

- Matrícula, número de ambulancia, datos identificativos.
- Se asignan en **turnos** y en **viajes**.

---

## Equipos

**Ruta:** `/admin/teams`  
**Módulo:** `teams`

- Define parejas o grupos (conductor + sanitario).
- Modos de rotación (rotativo, fijo, manual) según configuración de tu empresa.
- Opcional: ambulancia fija del equipo.

Asignación masiva en [Turnos](./TURNOS.md).

---

## Orden sugerido

1. Hospitales y ambulancias  
2. Equipos  
3. Plantillas y semanas de turnos
