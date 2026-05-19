# Vacaciones (admin)

**Ruta:** `/admin/vacations`  
**Módulo requerido:** `vacation`

---

## Qué puedes hacer

- Ver **solicitudes pendientes** de los trabajadores.
- **Aceptar** o **rechazar** fechas solicitadas.
- Enviar una **contrapropuesta** de fechas (el trabajador puede aceptar o cancelar).
- Consultar el calendario / disponibilidad del equipo (según pantallas activas).

---

## Flujo típico

1. El trabajador solicita vacaciones desde la app → [Vacaciones trabajador](../worker/VACACIONES.md).
2. Recibes la solicitud en estado **pendiente**.
3. Revisas solapamientos con turnos y con otras bajas/vacaciones.
4. Aceptas, rechazas o propones otras fechas.
5. El trabajador recibe el resultado en la app (y puede haber notificación push).

---

## Buenas prácticas

- Responde en plazo razonable para que el trabajador pueda planificar.
- Si propones fechas alternativas, indica **nota** o motivo en el campo previsto.
- Tras aceptar, verifica que la **planificación de turnos** no siga asignando al trabajador en esos días (ajusta en [Turnos](./TURNOS.md) si hace falta).
