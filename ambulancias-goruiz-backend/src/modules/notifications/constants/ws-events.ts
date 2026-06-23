/** Canonical websocket event names — payload is always `{ event: string }`. */
export const WS_EVENTS = {
  NEW_MESSAGE: "new_message",
  VACATION_REQUEST_CHANGED: "vacation_request_changed",
  SICK_LEAVE_CHANGED: "sick_leave_changed",
  APPOINTMENT_CHANGED: "appointment_changed",
  DIENST_CHANGED: "dienst_changed",
  AGENDA_CHANGED: "agenda_changed",
  WORKDAY_SUMMARY_CHANGED: "workday_summary_changed",
  MECHANICS_CHANGED: "mechanics_changed",
  PRAEMIEN_CHANGED: "praemien_changed",
  ADMIN_COUNTS_CHANGED: "admin_counts_changed",
  COMPANY_CHANGED: "company_changed",
  MODULES_CHANGED: "modules_changed",
  ACCOUNT_CHANGED: "account_changed",
  DOCUMENTS_CHANGED: "documents_changed",
} as const;

export type WsEventName = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];
