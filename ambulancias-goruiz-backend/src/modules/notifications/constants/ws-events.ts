/** Canonical websocket event names — payload is always `{ event: string }`. */
export const WS_EVENTS = {
  NEW_MESSAGE: "new_message",
  DIENST_CHANGED: "dienst_changed",
  AGENDA_CHANGED: "agenda_changed",
  WORKDAY_SUMMARY_CHANGED: "workday_summary_changed",
  ADMIN_COUNTS_CHANGED: "admin_counts_changed",
} as const;

export type WsEventName = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];
