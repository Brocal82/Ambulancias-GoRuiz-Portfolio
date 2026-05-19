# Revisión de jornadas (admin)

**Ruta:** `/admin/summaries`  
**Módulo requerido:** `workday`

---

## Qué es una jornada

Cuando un trabajador hace su día operativo, registra **viajes** (inicio, hospital, ambulancia, cierre). El sistema agrupa eso en un **resumen de jornada** que el admin puede revisar.

Guía del trabajador: [Jornada](../worker/JORNADA.md).

---

## Qué puedes hacer

- Ver jornadas **pendientes de revisión**.
- Revisar horas, viajes y datos registrados.
- Marcar como **revisada**.
- Realizar el **cierre final** cuando el proceso de tu empresa lo requiera (no hay dos cierres finales el mismo día para el mismo turno).

---

## Flujo recomendado

1. Trabajador cierra viajes en la app.
2. Aparece resumen en estado pendiente.
3. Admin comprueba coherencia con turno asignado y normativa interna.
4. Admin revisa y, si procede, cierra definitivamente.
5. Las horas revisadas alimentan **primas** (modo automático) → [Primas](./PRIMAS.md).

---

## Incidencias habituales

| Situación | Acción |
|-----------|--------|
| Jornada sin cerrar por el trabajador | Contactar al trabajador; revisar [Jornada](../worker/JORNADA.md) |
| Horas incorrectas | Coordinar corrección según política interna antes del cierre final |
| No aparece jornada | Comprobar módulo `workday`, asignación de turno ese día, y que el trabajador usó la app correcta |
