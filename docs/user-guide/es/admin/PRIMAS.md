# Primas (admin)

**Ruta:** `/admin/praemien`  
**Módulo requerido:** `praemien`

---

## Modos de empresa

Tu empresa puede estar en modo:

| Modo | Comportamiento |
|------|----------------|
| **Automático** | El sistema calcula primas a partir de jornadas **revisadas**. |
| **Manual** | El admin introduce importes **día a día** por trabajador. |

El modo lo define la configuración de empresa (contacta con GoRuiz si no estás seguro).

---

## Modo automático

1. Asegúrate de que las **jornadas** del mes están revisadas → [Jornada](./JORNADA.md).
2. Entra en **Primas** y selecciona año/mes.
3. Revisa borradores generados (horas, importe).
4. **Confirma** la prima del trabajador o del mes.
5. Marca como **pagada** cuando se haya abonado (según tu proceso interno).

---

## Modo manual

1. Entra en la sección de **entradas diarias** (manual daily).
2. Por cada trabajador y día laborable, registra el importe acordado.
3. Al cerrar el mes, revisa el total y confirma/paga como en el flujo automático.

---

## Qué ve el trabajador

En la app puede consultar sus primas confirmadas o pagadas (pestaña o acceso desde Inicio según diseño).  
Guía: [Primas trabajador](../worker/PRIMAS.md).

---

## Errores frecuentes

| Problema | Causa probable |
|----------|----------------|
| Prima en cero | Jornadas no revisadas o mes sin registros |
| No aparece el módulo | `praemien` no activo para la empresa |
| Datos desactualizados | Cambio de modo de empresa con fecha de vigencia futura |
