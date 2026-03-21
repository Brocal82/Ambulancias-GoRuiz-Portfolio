import { useEffect, useRef } from "react";
import {
  subscribeAppointmentsChanged,
  type AppointmentsChangedDetail,
} from "../utils/appointmentEvents";

/**
 * Hook de infraestructura:
 * - Se suscribe UNA sola vez a appointments-changed
 * - Ejecuta siempre el handler más reciente
 */
export function useAppointmentsChanged(
  handler: (detail: AppointmentsChangedDetail) => void,
) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    return subscribeAppointmentsChanged((detail) => {
      handlerRef.current(detail);
    });
  }, []);
}
