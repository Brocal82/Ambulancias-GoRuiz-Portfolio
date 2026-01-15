// frontend/src/utils/vacation/invalidateAvailabilityForRange.ts
import { invalidateAvailabilityByRangeBerlin } from "./invalidateAvailabilityByRangeBerlin";


/**
 * Emite invalidación de disponibilidad para TODOS los meses afectados por un rango ISO,
 * interpretando meses/años en TZ Europe/Berlin (regla del dominio en Alemania).
 *
 * Regla del módulo:
 * - Nadie más calcula meses.
 * - Nadie más emite availability-invalidated suelto.
 *
 * Nota:
 * - Este módulo es el punto "oficial" (reexportado por vacationEvents.ts).
 * - La implementación concreta vive en invalidateAvailabilityByRangeBerlin.ts.
 */

export function invalidateAvailabilityForRange(startISO: string, endISO: string) {
  invalidateAvailabilityByRangeBerlin(startISO, endISO);
}

