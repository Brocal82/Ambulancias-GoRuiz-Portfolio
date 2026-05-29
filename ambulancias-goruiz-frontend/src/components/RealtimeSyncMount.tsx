import { useWebSocketSync } from "../hooks/useWebSocketSync";

/** Mounts authenticated websocket sync for all protected routes. */
export default function RealtimeSyncMount() {
  useWebSocketSync();
  return null;
}
