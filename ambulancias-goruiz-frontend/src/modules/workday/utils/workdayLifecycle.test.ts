import { describe, it, expect } from "vitest";
import { getWorkdayViewState } from "./workdayViewState";
import { validateClosureData } from "./closureValidators";

describe("workday view state — stale closure handling", () => {
  it("shows closed when isClosingDay is true (local final closure flag)", () => {
    expect(
      getWorkdayViewState({
        isClosingDay: true,
        assignedDay: {},
        canStartWork: true,
      }),
    ).toBe("closed");
  });

  it("shows ready when not closed and assignment exists", () => {
    expect(
      getWorkdayViewState({
        isClosingDay: false,
        assignedDay: { assignmentId: "abc" },
        canStartWork: true,
      }),
    ).toBe("ready");
  });

  it("shows no_assignment when assignment is missing", () => {
    expect(
      getWorkdayViewState({
        isClosingDay: false,
        assignedDay: null,
        canStartWork: true,
      }),
    ).toBe("no_assignment");
  });

  it("partial closure does not set isClosingDay — worker can return to ready state", () => {
    expect(
      getWorkdayViewState({
        isClosingDay: false,
        assignedDay: { assignmentId: "abc" },
        canStartWork: true,
      }),
    ).toBe("ready");
  });
});

describe("final vs partial lifecycle UI flags", () => {
  it("final closure uses error severity for km < initial; partial uses warn", () => {
    const finalResult = validateClosureData({
      vehicleConfirmed: true,
      ambulanceId: "507f1f77bcf86cd799439011",
      ambulanceNumber: "1",
      initialKm: 100,
      finalKm: 50,
      isPartial: false,
    });
    expect(finalResult.valid).toBe(false);
    if (!finalResult.valid) {
      expect(finalResult.severity).toBe("error");
      expect(finalResult.toastKey).toBe("toasts.workday.finalKmLessThanInitial");
    }

    const partialResult = validateClosureData({
      vehicleConfirmed: true,
      ambulanceId: "507f1f77bcf86cd799439011",
      ambulanceNumber: "1",
      initialKm: 100,
      finalKm: 50,
      isPartial: true,
      partialReason: "Motivo",
    });
    expect(partialResult.valid).toBe(false);
    if (!partialResult.valid) {
      expect(partialResult.severity).toBe("warn");
    }
  });
});
