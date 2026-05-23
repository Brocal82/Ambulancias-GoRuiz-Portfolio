import { describe, it, expect } from "vitest";
import {
  canAdminAcceptCancellation,
  canAdminProposeSlots,
  canWorkerChooseSlot,
  canWorkerRequestCancellation,
  isWorkerActiveAppointment,
} from "./appointmentActionVisibility";

describe("appointmentActionVisibility", () => {
  describe("canWorkerChooseSlot", () => {
    it("true cuando proposed con slots", () => {
      expect(
        canWorkerChooseSlot({
          status: "proposed",
          proposedSlots: [{ start: "2030-01-01T10:00:00.000Z", end: "2030-01-01T11:00:00.000Z" }],
        }),
      ).toBe(true);
    });

    it("false cuando proposed sin slots", () => {
      expect(canWorkerChooseSlot({ status: "proposed", proposedSlots: [] })).toBe(false);
    });

    it("false cuando pending", () => {
      expect(canWorkerChooseSlot({ status: "pending", proposedSlots: [] })).toBe(false);
    });
  });

  describe("canWorkerRequestCancellation", () => {
    it("false cuando cancellation_requested", () => {
      expect(canWorkerRequestCancellation("cancellation_requested")).toBe(false);
    });

    it("true para confirmed", () => {
      expect(canWorkerRequestCancellation("confirmed")).toBe(true);
    });
  });

  describe("canAdminProposeSlots", () => {
    it("true solo en pending", () => {
      expect(canAdminProposeSlots("pending")).toBe(true);
      expect(canAdminProposeSlots("proposed")).toBe(false);
      expect(canAdminProposeSlots("cancellation_requested")).toBe(false);
    });
  });

  describe("canAdminAcceptCancellation", () => {
    it("true solo en cancellation_requested", () => {
      expect(canAdminAcceptCancellation("cancellation_requested")).toBe(true);
      expect(canAdminAcceptCancellation("pending")).toBe(false);
      expect(canAdminAcceptCancellation("confirmed")).toBe(false);
    });
  });

  describe("isWorkerActiveAppointment", () => {
    it("incluye pending, proposed y cancellation_requested", () => {
      expect(isWorkerActiveAppointment("pending")).toBe(true);
      expect(isWorkerActiveAppointment("proposed")).toBe(true);
      expect(isWorkerActiveAppointment("cancellation_requested")).toBe(true);
    });

    it("excluye confirmed y cancelled", () => {
      expect(isWorkerActiveAppointment("confirmed")).toBe(false);
      expect(isWorkerActiveAppointment("cancelled")).toBe(false);
    });
  });
});
