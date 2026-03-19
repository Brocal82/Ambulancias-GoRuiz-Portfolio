import { describe, it, expect } from "vitest";
import { checkTripLogic, parseHHMM } from "./tripValidators";

const validDraft = {
  timeWarning: "08:00",
  timeAtHome: "08:15",
  timePickup: "08:30",
  timeArrival: "09:00",
  timeEnd: "09:15",
  kmStart: 100,
  kmEnd: 120,
};

describe("parseHHMM", () => {
  it("converts HH:MM to minutes since midnight", () => {
    expect(parseHHMM("00:00")).toBe(0);
    expect(parseHHMM("01:30")).toBe(90);
    expect(parseHHMM("12:00")).toBe(720);
  });

  it("returns NaN for empty string", () => {
    expect(parseHHMM("")).toBeNaN();
  });
});

describe("checkTripLogic", () => {
  it("returns no error when valid and not cancelled", () => {
    const result = checkTripLogic(validDraft, false);
    expect(result.error).toBeNull();
    expect(result.badField).toBeNull();
  });

  it("returns no error when wasCancelled is true", () => {
    const bad = { ...validDraft, timeEnd: "07:00" };
    const result = checkTripLogic(bad, true);
    expect(result.error).toBeNull();
    expect(result.badField).toBeNull();
  });

  it("returns error when timeEnd is before timeArrival", () => {
    const bad = {
      ...validDraft,
      timeArrival: "09:00",
      timeEnd: "08:30",
    };
    const result = checkTripLogic(bad, false);
    expect(result.error).toContain("hora LIBRE");
    expect(result.badField).toBe("timeEnd");
  });

  it("returns error when timePickup is before timeAtHome", () => {
    const bad = {
      ...validDraft,
      timeAtHome: "08:30",
      timePickup: "08:15",
    };
    const result = checkTripLogic(bad, false);
    expect(result.error).toContain("hora CARGA");
    expect(result.badField).toBe("timePickup");
  });

  it("returns error when kmEnd < kmStart", () => {
    const bad = { ...validDraft, kmStart: 120, kmEnd: 100 };
    const result = checkTripLogic(bad, false);
    expect(result.error).toContain("KM");
    expect(result.badField).toBe("kmEnd");
  });

  it("returns error for Anschluss when kmStart < minKmStart", () => {
    const result = checkTripLogic(
      { ...validDraft, kmStart: 80, kmEnd: 100 },
      false,
      100,
    );
    expect(result.error).toContain("Anschluss");
    expect(result.badField).toBe("kmStart");
  });

  it("returns no error for Anschluss when kmStart >= minKmStart", () => {
    const result = checkTripLogic(
      { ...validDraft, kmStart: 100, kmEnd: 120 },
      false,
      100,
    );
    expect(result.error).toBeNull();
    expect(result.badField).toBeNull();
  });
});
