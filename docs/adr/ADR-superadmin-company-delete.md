# ADR: Borrado de empresas por SuperAdmin

**Estado:** Propuesto (pendiente aprobación)  
**Fecha:** 2026-05-20  
**Fase de implementación:** 2

## Contexto

`DELETE /api/companies/:id` ejecuta `Company.findByIdAndDelete` sin eliminar usuarios, turnos, viajes, documentos ni ficheros en `/uploads`. Los usuarios conservan `companyId` apuntando a un tenant inexistente.

## Decisión propuesta

1. **API pública:** dejar de exponer hard-delete; usar desactivación (`isActive: false`) como mecanismo operativo principal.
2. **Opcional Fase 2:** campo `deletedAt` en `Company` para soft-delete y filtrar del listado superadmin.
3. **Hard-delete:** solo script de operaciones con lista de colecciones a purgar, ejecutado manualmente, nunca desde el panel sin revisión legal/DPO.

## Consecuencias

- Menor riesgo de pérdida accidental de datos médicos/laborales.
- Panel superadmin: botón "Desactivar" prominente; "Eliminar definitivamente" retirado o solo en script.
- Migración: empresas ya borradas con hard-delete histórico no recuperables.

## Alternativas consideradas

| Opción | Pros | Contras |
|--------|------|---------|
| Hard-delete + cascade en API | Limpieza total en un click | Muy riesgoso, difícil de revertir, muchas colecciones |
| Mantener DELETE actual | Sin trabajo | Huérfanos, incumplimiento posible |
| **Soft-delete (elegida)** | Reversible, alinea con `isActive` login | Datos ocupan storage hasta purge programado |

## Aprobación

- [ ] Producto / negocio
- [ ] Responsable técnico

Cuando esté aprobado, actualizar estado a **Aceptado** e implementar en `feature/superadmin-phase-2-backend`.
