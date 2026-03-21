import { useEffect, useRef } from "react";
import {
  subscribeSickLeavesChanged,
  type SickLeavesChangedDetail,
} from "../utils/sickEvents";

/**
 * Hook de infraestructura:
 * - Se suscribe UNA sola vez a sick-leaves-changed
 * - Ejecuta siempre el handler más reciente
 */
export function useSickLeavesChanged(
  handler: (detail: SickLeavesChangedDetail) => void,
) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    return subscribeSickLeavesChanged((detail) => {
      handlerRef.current(detail);
    });
  }, []);
}
