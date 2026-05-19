# Nóminas (admin)

**Rutas:** `/admin/payroll`, `/admin/payroll/nominas`, `/admin/payroll/month/:year/:month`  
**Módulo requerido:** `payroll`

---

## Qué puedes hacer

- **Subir** archivos PDF de nómina (uno o varios).
- El sistema intenta **emparejar** cada PDF con un trabajador (por nombre u otros criterios).
- Revisar nóminas **sin asignar** o con **conflicto** y asignarlas manualmente.
- **Invalidar** una nómina errónea (deja de ser visible para el trabajador).

---

## Flujo de subida

1. Ve a **Nóminas** → sección de carga o mes concreto.
2. Selecciona el **año y mes** del periodo.
3. Sube los PDF.
4. Revisa el estado de emparejamiento:
   - **Matched** — asignada correctamente.
   - **Unmatched** — requiere asignación manual.
   - **Conflict** — varios candidatos; elige el trabajador correcto.

---

## Qué ve el trabajador

Solo sus propias nóminas activas, en la app o en `/worker/payroll`.  
Guía: [Nóminas trabajador](../worker/NOMINAS.md).

---

## Seguridad

Las nóminas son documentos sensibles. Solo se descargan mediante acceso autenticado (no enlaces públicos en `/uploads`).

---

## Consejos

- Usa nombres de archivo coherentes si tu proceso lo permite (facilita el emparejamiento automático).
- Antes de subir de nuevo, invalida la versión incorrecta en lugar de duplicar sin control.
