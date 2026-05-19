# Bajas médicas (admin)

**Ruta:** `/admin/sick-leaves`  
**Módulo requerido:** `sick-leaves`

---

## Qué puedes hacer

- Ver **todas las bajas** de la empresa (activas y cerradas).
- Abrir el detalle de una baja: fechas, trabajador, documentos adjuntos.
- Gestionar estados según el flujo de tu empresa (pendiente, activa, cerrada).
- Descargar o visualizar **justificantes** (PDF/imagen) de forma segura desde el panel.

---

## Flujo típico

1. El trabajador reporta la baja desde la app → [Bajas trabajador](../worker/BAJAS.md).
2. Puede adjuntar documentación médica.
3. El admin revisa en `/admin/sick-leaves`.
4. Ajustas planificación de turnos si la baja afecta a días ya publicados.

---

## Privacidad

Los documentos de baja son **confidenciales**. Solo el trabajador y los admins autorizados de la misma empresa pueden abrirlos a través del sistema (no enlaces públicos).

---

## Indicadores en listados

En algunas vistas verás **contadores de documentos** o estado visual de la baja. Úsalos para priorizar revisiones pendientes.
