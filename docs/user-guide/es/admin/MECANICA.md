# Mecánica y averías (admin)

**Ruta:** `/admin/mechanics`  
**Módulo requerido:** `mechanics`

---

## Qué puedes hacer

- Ver **averías reportadas** por trabajadores o mecánicos.
- Crear y actualizar **órdenes de trabajo**.
- Asignar estado (abierta, en curso, cerrada, etc. según pantallas).
- Gestionar relación con **ambulancias** afectadas.

---

## Origen de las averías

Los trabajadores pueden reportar desde la app → [Reportar avería](../worker/REPORTAR-AVERIA.md).

Los roles **mecánico** y **jefe de mecánicos** tienen pantallas propias en `/mechanics` (no cubiertas en detalle en este manual de admin de empresa; el flujo de revisión central para la empresa suele estar en `/admin/mechanics`).

---

## Buenas prácticas

- Cierra órdenes cuando la reparación esté verificada.
- Mantén actualizado el catálogo de [Ambulancias](./CATALOGOS.md) para asociar bien cada caso.
