import { useEffect, useRef } from "react";
import {
  subscribeVacationRequestsUpdated,
  type VacationRequestsUpdatedDetail,
} from "../../modules/vacation/utils/vacationEvents";

/**
 * Hook de infraestructura:
 * - Se suscribe UNA sola vez a vacation-requests-updated
 * - Ejecuta siempre el handler más reciente
 * - Evita resuscripciones innecesarias
 */
export function useVacationRequestsUpdated(
  handler: (detail: VacationRequestsUpdatedDetail) => void,
) {
  const handlerRef = useRef(handler);

  // Mantener siempre el handler más reciente
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    return subscribeVacationRequestsUpdated((detail) => {
      handlerRef.current(detail);
    });
  }, []);
}

