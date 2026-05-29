import { emitDienstsChanged } from "../modules/diensts/utils/dienstEvents";
import { emitMessagesChanged } from "../modules/messages/utils/messageEvents";
import { emitWorkdaySummariesChanged } from "../modules/workday/utils/workdayEvents";
import { emitAdminDashboardCountsRefresh } from "../modules/admin-dashboard/utils/adminDashboardCountsEvents";
import { WS_EVENTS, type WsFrame } from "./wsEvents";

/**
 * Maps backend websocket frames to existing local cross-tab refresh emitters.
 * Payload stays `{ event }` only — no entity synchronization.
 */
export function dispatchWebSocketEvent(frame: WsFrame): void {
  const event = frame.event?.trim();
  if (!event) return;

  switch (event) {
    case WS_EVENTS.NEW_MESSAGE:
      emitMessagesChanged();
      return;
    case WS_EVENTS.DIENST_CHANGED:
    case WS_EVENTS.AGENDA_CHANGED:
      emitDienstsChanged();
      return;
    case WS_EVENTS.WORKDAY_SUMMARY_CHANGED:
      emitWorkdaySummariesChanged();
      return;
    case WS_EVENTS.ADMIN_COUNTS_CHANGED:
      emitAdminDashboardCountsRefresh();
      return;
    default:
      return;
  }
}
