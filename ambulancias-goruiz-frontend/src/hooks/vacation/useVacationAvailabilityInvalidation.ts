import { useEffect } from "react";
import {
  subscribeAvailabilityInvalidated,
  type VacationAvailabilityInvalidatedDetail,
} from "../../utils/vacation/vacationAvailabilityEvents";

/**
 * Escucha invalidaciones de disponibilidad (misma pestaña + otras pestañas)
 * y ejecuta `handler` con { year, month, ts? }.
 */
export function useVacationAvailabilityInvalidation(
  handler: (p: VacationAvailabilityInvalidatedDetail) => void,
) {
  useEffect(() => subscribeAvailabilityInvalidated(handler), [handler]);
}
