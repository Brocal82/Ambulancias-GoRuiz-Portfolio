import { useEffect, useRef } from "react";
import {
  subscribeMechanicsIssuesChanged,
  type MechanicsIssuesChangedDetail,
} from "../utils/mechanicsEvents";

/**
 * Hook: se suscribe a mechanics-issues-changed (cross-tab).
 */
export function useMechanicsIssuesChanged(
  handler: (detail: MechanicsIssuesChangedDetail) => void,
) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    return subscribeMechanicsIssuesChanged((detail) => {
      handlerRef.current(detail);
    });
  }, []);
}
