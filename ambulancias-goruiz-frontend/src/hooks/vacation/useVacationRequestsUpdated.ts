// frontend/src/hooks/vacation/useVacationRequestsUpdated.ts
import { useEffect } from "react";
import {
  subscribeVacationRequestsUpdated,
  type VacationRequestsUpdatedDetail,
} from "../../utils/vacation/vacationRequestEvents";

/**
 * Hook: escucha cambios en requests (accepted/cancelled/deleted)
 * en la misma pestaña + entre pestañas, y ejecuta el handler.
 */
export function useVacationRequestsUpdated(
  handler: (detail: VacationRequestsUpdatedDetail) => void,
) {
  useEffect(() => {
    return subscribeVacationRequestsUpdated(handler);
  }, [handler]);
}
