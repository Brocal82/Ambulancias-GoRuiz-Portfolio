import { useEffect, useRef } from "react";
import {
  subscribeWorkdaySummariesChanged,
  type WorkdaySummariesChangedDetail,
} from "../utils/workdayEvents";

/**
 * Hook: se suscribe UNA sola vez a workday-summaries-changed.
 * Ejecuta siempre el handler más reciente.
 */
export function useWorkdaySummariesChanged(
  handler: (detail: WorkdaySummariesChangedDetail) => void,
) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    return subscribeWorkdaySummariesChanged((detail) => {
      handlerRef.current(detail);
    });
  }, []);
}
