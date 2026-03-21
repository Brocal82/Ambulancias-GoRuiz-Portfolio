import { useEffect, useRef } from "react";
import {
  subscribeHospitalStatusChanged,
  type HospitalStatusChangedDetail,
} from "../utils/hospitalEvents";

/**
 * Hook: se suscribe a hospital-status-changed (cross-tab).
 */
export function useHospitalStatusChanged(
  handler: (detail: HospitalStatusChangedDetail) => void,
) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    return subscribeHospitalStatusChanged((detail) => {
      handlerRef.current(detail);
    });
  }, []);
}
