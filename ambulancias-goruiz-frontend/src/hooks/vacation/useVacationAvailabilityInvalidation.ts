import { useEffect } from "react";
import { subscribeAvailabilityInvalidated } from "../../utils/vacation/vacationAvailabilityEvents";


type Payload = { year: number; month: number }; // month 1..12

/**
 * Escucha invalidaciones de disponibilidad (misma pestaña + otras pestañas)
 * y ejecuta `handler` con { year, month }.
 */
export function useVacationAvailabilityInvalidation(
  handler: (p: Payload) => void,
) {
  useEffect(() => {
    return subscribeAvailabilityInvalidated(handler);
  }, [handler]);
}
