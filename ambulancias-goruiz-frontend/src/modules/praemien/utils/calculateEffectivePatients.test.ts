import { describe, expect, it } from "vitest";
import { calculateEffectivePatients } from "./calculateEffectivePatients";
import type { Trip } from "../../workday/domain/types/trip";

function trip(overrides: Partial<Trip> = {}): Trip {
  return {
    auftragNumber: "1",
    patientName: "P",
    fromAddress: "A",
    toAddress: "B",
    timeWarning: "08:00",
    wasCancelled: false,
    countsTrip: 1,
    ...overrides,
  } as Trip;
}

describe("calculateEffectivePatients", () => {
  it("counts one effective patient per standard trip", () => {
    expect(calculateEffectivePatients([trip()], "2026-05-12")).toBe(1);
  });

  it("applies km multiplier and rounds to nearest 0.5 (backend parity)", () => {
    const trips = [
      trip({ kmStart: 0, kmEnd: 16 }),
      trip({ kmStart: 0, kmEnd: 22 }),
    ];
    expect(calculateEffectivePatients(trips, "2026-05-12")).toBe(3.5);
  });

  it("skips cancelled trips unless countsTrip is 1", () => {
    expect(
      calculateEffectivePatients(
        [trip({ wasCancelled: true, countsTrip: 0 })],
        "2026-05-12",
      ),
    ).toBe(0);
  });
});
