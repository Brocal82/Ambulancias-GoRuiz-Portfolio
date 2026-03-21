import { useEffect, useRef } from "react";
import {
  subscribeDienstsChanged,
  type DienstsChangedDetail,
} from "../utils/dienstEvents";

/**
 * Hook: se suscribe a diensts-changed (cross-tab).
 */
export function useDienstsChanged(
  handler: (detail: DienstsChangedDetail) => void,
) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    return subscribeDienstsChanged((detail) => {
      handlerRef.current(detail);
    });
  }, []);
}
