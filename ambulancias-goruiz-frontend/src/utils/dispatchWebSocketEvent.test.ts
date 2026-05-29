import { describe, it, expect, vi, beforeEach } from "vitest";
import { WS_EVENTS } from "./wsEvents";
import { dispatchWebSocketEvent } from "./dispatchWebSocketEvent";
import { emitDienstsChanged } from "../modules/diensts/utils/dienstEvents";
import { emitWorkdaySummariesChanged } from "../modules/workday/utils/workdayEvents";
import { emitAdminDashboardCountsRefresh } from "../modules/admin-dashboard/utils/adminDashboardCountsEvents";
import { emitVacationRequestsUpdated } from "../modules/vacation/utils/vacationEvents";
import { emitSickLeavesChanged } from "../modules/sick/utils/sickEvents";
import { emitAppointmentsChanged } from "../modules/appointments/utils/appointmentEvents";
import { emitMechanicsIssuesChanged } from "../modules/mechanics/utils/mechanicsEvents";

vi.mock("../modules/diensts/utils/dienstEvents", () => ({
  emitDienstsChanged: vi.fn(),
}));

vi.mock("../modules/messages/utils/messageEvents", () => ({
  emitMessagesChanged: vi.fn(),
}));

vi.mock("../modules/workday/utils/workdayEvents", () => ({
  emitWorkdaySummariesChanged: vi.fn(),
}));

vi.mock("../modules/admin-dashboard/utils/adminDashboardCountsEvents", () => ({
  emitAdminDashboardCountsRefresh: vi.fn(),
}));

vi.mock("../modules/vacation/utils/vacationEvents", () => ({
  emitVacationRequestsUpdated: vi.fn(),
}));

vi.mock("../modules/sick/utils/sickEvents", () => ({
  emitSickLeavesChanged: vi.fn(),
}));

vi.mock("../modules/appointments/utils/appointmentEvents", () => ({
  emitAppointmentsChanged: vi.fn(),
}));

vi.mock("../modules/mechanics/utils/mechanicsEvents", () => ({
  emitMechanicsIssuesChanged: vi.fn(),
}));

describe("dispatchWebSocketEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps dienst_changed and agenda_changed to dienst local refresh", () => {
    dispatchWebSocketEvent({ event: WS_EVENTS.DIENST_CHANGED });
    dispatchWebSocketEvent({ event: WS_EVENTS.AGENDA_CHANGED });
    expect(emitDienstsChanged).toHaveBeenCalledTimes(2);
  });

  it("maps workday_summary_changed to workday local refresh", () => {
    dispatchWebSocketEvent({ event: WS_EVENTS.WORKDAY_SUMMARY_CHANGED });
    expect(emitWorkdaySummariesChanged).toHaveBeenCalledTimes(1);
  });

  it("maps admin_counts_changed to coalesced dashboard refresh signal", () => {
    dispatchWebSocketEvent({ event: WS_EVENTS.ADMIN_COUNTS_CHANGED });
    expect(emitAdminDashboardCountsRefresh).toHaveBeenCalledTimes(1);
  });

  it("maps P0 vacation, sick, and appointment events to local refresh emitters", () => {
    dispatchWebSocketEvent({ event: WS_EVENTS.VACATION_REQUEST_CHANGED });
    dispatchWebSocketEvent({ event: WS_EVENTS.SICK_LEAVE_CHANGED });
    dispatchWebSocketEvent({ event: WS_EVENTS.APPOINTMENT_CHANGED });
    expect(emitVacationRequestsUpdated).toHaveBeenCalledWith({ type: "updated", id: "ws-sync" });
    expect(emitSickLeavesChanged).toHaveBeenCalledTimes(1);
    expect(emitAppointmentsChanged).toHaveBeenCalledTimes(1);
  });

  it("maps mechanics_changed to mechanics local refresh (admin dashboard counts path)", () => {
    dispatchWebSocketEvent({ event: WS_EVENTS.MECHANICS_CHANGED });
    expect(emitMechanicsIssuesChanged).toHaveBeenCalledTimes(1);
  });

  it("ignores unknown events", () => {
    dispatchWebSocketEvent({ event: "unknown_event" });
    expect(emitDienstsChanged).not.toHaveBeenCalled();
    expect(emitWorkdaySummariesChanged).not.toHaveBeenCalled();
    expect(emitAdminDashboardCountsRefresh).not.toHaveBeenCalled();
  });
});
