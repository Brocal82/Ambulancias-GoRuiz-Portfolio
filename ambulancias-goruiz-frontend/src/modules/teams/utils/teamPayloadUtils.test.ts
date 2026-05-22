import { describe, it, expect } from "vitest";
import {
  buildTeamPayload,
  getTeamApiErrorMessage,
  isTeamApiConflictError,
} from "./teamPayloadUtils";

describe("teamPayloadUtils", () => {
  it("incluye fixedDienstNumber solo en modo fixed", () => {
    const fixed = buildTeamPayload({
      driver: "d1",
      medic: "m1",
      rotationMode: "fixed",
      fixedDienstNumber: 3,
      ambulanceId: "",
      ambulancesModuleOn: true,
    });
    expect(fixed.rotationMode).toBe("fixed");
    expect(fixed.fixedDienstNumber).toBe(3);

    const rotating = buildTeamPayload({
      driver: "d1",
      medic: "m1",
      rotationMode: "rotating",
      fixedDienstNumber: 3,
      ambulanceId: "",
      ambulancesModuleOn: true,
    });
    expect(rotating.fixedDienstNumber).toBeNull();
  });

  it("omite ambulanceId si el módulo de ambulancias está desactivado", () => {
    const payload = buildTeamPayload({
      driver: "d1",
      medic: "m1",
      rotationMode: "none",
      fixedDienstNumber: "",
      ambulanceId: "amb1",
      ambulancesModuleOn: false,
    });
    expect(payload.ambulanceId).toBeUndefined();
  });

  it("expone mensaje de error de API y detecta conflictos", () => {
    const err = { response: { status: 409, data: { message: "En uso" } } };
    expect(isTeamApiConflictError(err)).toBe(true);
    expect(getTeamApiErrorMessage(err, "fallback")).toBe("En uso");
    expect(getTeamApiErrorMessage({}, "fallback")).toBe("fallback");
  });
});
