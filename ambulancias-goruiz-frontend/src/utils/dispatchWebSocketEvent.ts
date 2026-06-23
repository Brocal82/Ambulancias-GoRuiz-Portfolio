import { emitAppointmentsChanged } from "../modules/appointments/utils/appointmentEvents";
import { emitDienstsChanged } from "../modules/diensts/utils/dienstEvents";
import { emitDocumentsChanged } from "../modules/documents/utils/documentsEvents";
import { emitPayrollChanged } from "../modules/payroll/utils/payrollEvents";
import { emitMessagesChanged } from "../modules/messages/utils/messageEvents";
import { emitSickLeavesChanged } from "../modules/sick/utils/sickEvents";
import { emitVacationRequestsUpdated } from "../modules/vacation/utils/vacationEvents";
import { emitWorkdaySummariesChanged } from "../modules/workday/utils/workdayEvents";
import { emitMechanicsIssuesChanged } from "../modules/mechanics/utils/mechanicsEvents";
import { dispatchPraemienManualPendingChanged } from "../modules/praemien/utils/praemienManualPendingEvents";
import { emitAdminDashboardCountsRefresh } from "../modules/admin-dashboard/utils/adminDashboardCountsEvents";
import {
  emitAuthAccountChanged,
  emitAuthCompanyChanged,
  emitAuthModulesChanged,
} from "./authSessionEvents";
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
    case WS_EVENTS.VACATION_REQUEST_CHANGED:
      emitVacationRequestsUpdated({ type: "updated", id: "ws-sync" });
      return;
    case WS_EVENTS.SICK_LEAVE_CHANGED:
      emitSickLeavesChanged();
      return;
    case WS_EVENTS.APPOINTMENT_CHANGED:
      emitAppointmentsChanged();
      return;
    case WS_EVENTS.DIENST_CHANGED:
    case WS_EVENTS.AGENDA_CHANGED:
      emitDienstsChanged();
      return;
    case WS_EVENTS.WORKDAY_SUMMARY_CHANGED:
      emitWorkdaySummariesChanged();
      return;
    case WS_EVENTS.MECHANICS_CHANGED:
      emitMechanicsIssuesChanged();
      return;
    case WS_EVENTS.PRAEMIEN_CHANGED:
      dispatchPraemienManualPendingChanged();
      return;
    case WS_EVENTS.ADMIN_COUNTS_CHANGED:
      emitAdminDashboardCountsRefresh();
      return;
    case WS_EVENTS.MODULES_CHANGED:
      emitAuthModulesChanged();
      return;
    case WS_EVENTS.COMPANY_CHANGED:
      emitAuthCompanyChanged();
      return;
    case WS_EVENTS.ACCOUNT_CHANGED:
      emitAuthAccountChanged();
      return;
    case WS_EVENTS.DOCUMENTS_CHANGED:
      emitDocumentsChanged();
      return;
    case WS_EVENTS.PAYROLL_CHANGED:
      emitPayrollChanged();
      return;
    default:
      return;
  }
}
