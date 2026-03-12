import { useEffect, useRef } from "react";
import {
  subscribeAvailabilityInvalidated,
  type VacationAvailabilityInvalidatedDetail,
} from "../utils/vacationEvents";

/**
 * Hook de infraestructura:
 * - Se suscribe UNA sola vez a availability-invalidated
 * - Ejecuta siempre el handler más reciente
 * - Evita resuscripciones innecesarias
 */
export function useVacationAvailabilityInvalidation(
  handler: (p: VacationAvailabilityInvalidatedDetail) => void,
) {
  const handlerRef = useRef(handler);

  // Mantener siempre el handler más reciente
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    return subscribeAvailabilityInvalidated((detail) => {
      handlerRef.current(detail);
    });
  }, []);
}


