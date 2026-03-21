import { useEffect, useRef } from "react";
import {
  subscribeMessagesChanged,
  type MessagesChangedDetail,
} from "../utils/messageEvents";

/**
 * Hook de infraestructura:
 * - Se suscribe UNA sola vez a messages-changed
 * - Ejecuta siempre el handler más reciente
 */
export function useMessagesChanged(
  handler: (detail: MessagesChangedDetail) => void,
) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    return subscribeMessagesChanged((detail) => {
      handlerRef.current(detail);
    });
  }, []);
}
