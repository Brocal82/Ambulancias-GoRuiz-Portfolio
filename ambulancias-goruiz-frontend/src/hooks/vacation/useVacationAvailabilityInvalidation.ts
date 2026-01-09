//src/hooks/vacation/useVacationAvailabilityInvalidation.ts
import { useEffect } from "react";
import {
  subscribeAvailabilityInvalidated,
  type VacationAvailabilityInvalidatedDetail,
} from "../../utils/vacation/vacationEvents";


/**
 * Escucha invalidaciones de disponibilidad (misma pestaña + otras pestañas)
 * y ejecuta `handler` con { year, month, ts? }.
 */
export function useVacationAvailabilityInvalidation(
  handler: (p: VacationAvailabilityInvalidatedDetail) => void,
) {
  useEffect(() => subscribeAvailabilityInvalidated(handler), [handler]);
}
