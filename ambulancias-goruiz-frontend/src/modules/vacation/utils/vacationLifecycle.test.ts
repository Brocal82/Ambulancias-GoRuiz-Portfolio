import { describe, it, expect } from "vitest";
import {
  canWorkerCancelVacation,
  canWorkerRespondToAlternative,
  isVacationCapacityExceededError,
} from "./vacationLifecycle";

describe("vacation lifecycle visibility", () => {
  it("allows respond only for option_sent with proposed dates", () => {
    expect(
      canWorkerRespondToAlternative({
        status: "option_sent",
        adminOptionStartDate: "2030-01-10",
        adminOptionEndDate: "2030-01-12",
      }),
    ).toBe(true);
    expect(
      canWorkerRespondToAlternative({
        status: "pending",
        adminOptionStartDate: "2030-01-10",
        adminOptionEndDate: "2030-01-12",
      }),
    ).toBe(false);
  });

  it("allows cancel for pending and option_sent only", () => {
    expect(canWorkerCancelVacation("pending")).toBe(true);
    expect(canWorkerCancelVacation("option_sent")).toBe(true);
    expect(canWorkerCancelVacation("accepted")).toBe(false);
  });

  it("detects capacity_exceeded API errors", () => {
    expect(
      isVacationCapacityExceededError({
        status: 409,
        body: { code: "capacity_exceeded" },
      }),
    ).toBe(true);
    expect(isVacationCapacityExceededError({ status: 400 })).toBe(false);
  });
});
