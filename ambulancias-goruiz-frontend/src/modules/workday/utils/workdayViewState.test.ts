import { describe, it, expect } from "vitest";
import { getWorkdayViewState } from "./workdayViewState";

const mockAssignedDay = { startTime: "08:00", endTime: "16:00" };

describe("getWorkdayViewState", () => {
  describe("closed - prioridad máxima", () => {
    it("retorna closed cuando isClosingDay es true", () => {
      const result = getWorkdayViewState({
        isClosingDay: true,
        assignedDay: mockAssignedDay,
        canStartWork: true,
      });
      expect(result).toBe("closed");
    });

    it("retorna closed aunque assignedDay exista y canStartWork sea true", () => {
      const result = getWorkdayViewState({
        isClosingDay: true,
        assignedDay: mockAssignedDay,
        canStartWork: true,
      });
      expect(result).toBe("closed");
    });

    it("retorna closed aunque assignedDay sea null", () => {
      const result = getWorkdayViewState({
        isClosingDay: true,
        assignedDay: null,
        canStartWork: false,
      });
      expect(result).toBe("closed");
    });
  });

  describe("no_assignment", () => {
    it("retorna no_assignment cuando assignedDay es null", () => {
      const result = getWorkdayViewState({
        isClosingDay: false,
        assignedDay: null,
        canStartWork: false,
      });
      expect(result).toBe("no_assignment");
    });

    it("retorna no_assignment cuando assignedDay es undefined", () => {
      const result = getWorkdayViewState({
        isClosingDay: false,
        assignedDay: undefined,
        canStartWork: false,
      });
      expect(result).toBe("no_assignment");
    });
  });

  describe("cant_start", () => {
    it("retorna cant_start cuando hay assignedDay pero canStartWork es false", () => {
      const result = getWorkdayViewState({
        isClosingDay: false,
        assignedDay: mockAssignedDay,
        canStartWork: false,
      });
      expect(result).toBe("cant_start");
    });
  });

  describe("ready", () => {
    it("retorna ready cuando hay assignedDay y canStartWork es true", () => {
      const result = getWorkdayViewState({
        isClosingDay: false,
        assignedDay: mockAssignedDay,
        canStartWork: true,
      });
      expect(result).toBe("ready");
    });

    it("retorna ready con assignedDay como objeto completo", () => {
      const fullAssignedDay = {
        assignmentId: "a1",
        startTime: "08:00",
        endTime: "16:00",
      };
      const result = getWorkdayViewState({
        isClosingDay: false,
        assignedDay: fullAssignedDay,
        canStartWork: true,
      });
      expect(result).toBe("ready");
    });
  });
});
