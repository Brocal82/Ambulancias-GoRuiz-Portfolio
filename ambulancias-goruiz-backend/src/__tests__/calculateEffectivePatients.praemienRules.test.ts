import { calculateEffectivePatients } from "../modules/workday-summary/utils/calculateEffectivePatients";
import type { PraemienRuleConfig } from "../modules/praemien/types/praemien-rule-config";

describe("calculateEffectivePatients company Prämien rules", () => {
  it("preserves legacy defaults when no company rules are supplied", () => {
    const result = calculateEffectivePatients(
      [
        {
          wasCancelled: false,
          countsTrip: 1,
          kmStart: 0,
          kmEnd: 18,
          timePickup: "10:00",
        },
        {
          wasCancelled: false,
          countsTrip: 1,
          kmStart: 0,
          kmEnd: 21,
          timePickup: "10:00",
        },
        {
          wasCancelled: false,
          countsTrip: 1,
          kmStart: 0,
          kmEnd: 5,
          timePickup: "15:00",
        },
      ],
      "2031-03-15",
      undefined,
      "14:00",
    );

    expect(result).toBe(5);
  });

  it("applies dynamic company rules and keeps highest matching multiplier", () => {
    const rules: PraemienRuleConfig = {
      version: 1,
      rules: [
        {
          type: "km",
          enabled: true,
          minKm: 10,
          maxKm: 30,
          multiplier: 1.25,
        },
        {
          type: "km",
          enabled: true,
          minKm: 30,
          maxKm: null,
          multiplier: 3,
        },
        {
          type: "weekdayDienstStartTime",
          enabled: true,
          weekdays: [1],
          startTimeFrom: "12:00",
          startTimeTo: "14:00",
          multiplier: 1.5,
        },
      ],
      cancelledTripPolicy: "excludeUnlessCountsTrip",
    };

    const result = calculateEffectivePatients(
      [
        {
          wasCancelled: false,
          countsTrip: 1,
          kmStart: 0,
          kmEnd: 12,
          timePickup: "10:00",
        },
        {
          wasCancelled: false,
          countsTrip: 1,
          kmStart: 0,
          kmEnd: 35,
          timePickup: "10:00",
        },
        {
          wasCancelled: false,
          countsTrip: 1,
          kmStart: 0,
          kmEnd: 5,
          timePickup: "13:00",
        },
        {
          wasCancelled: true,
          countsTrip: 0,
          kmStart: 0,
          kmEnd: 99,
          timePickup: "13:00",
        },
      ],
      "2031-03-17",
      rules,
      "12:30",
    );

    expect(result).toBe(6);
  });

  it("ignores rules with a future effectiveFrom before start date", () => {
    const rules: PraemienRuleConfig = {
      version: 1,
      rules: [
        {
          type: "km",
          enabled: true,
          minKm: 10,
          maxKm: null,
          multiplier: 5,
          effectiveFrom: "2031-04-01",
        },
      ],
      cancelledTripPolicy: "excludeUnlessCountsTrip",
    };

    const result = calculateEffectivePatients(
      [{ wasCancelled: false, countsTrip: 1, kmStart: 0, kmEnd: 20 }],
      "2031-03-17",
      rules,
    );

    expect(result).toBe(1);
  });

  it("applies rule on exact effectiveFrom and effectiveTo (inclusive)", () => {
    const rules: PraemienRuleConfig = {
      version: 1,
      rules: [
        {
          type: "km",
          enabled: true,
          minKm: 10,
          maxKm: null,
          multiplier: 2,
          effectiveFrom: "2031-03-17",
          effectiveTo: "2031-03-17",
        },
      ],
      cancelledTripPolicy: "excludeUnlessCountsTrip",
    };

    const onStart = calculateEffectivePatients(
      [{ wasCancelled: false, countsTrip: 1, kmStart: 0, kmEnd: 15 }],
      "2031-03-17",
      rules,
    );
    const afterEnd = calculateEffectivePatients(
      [{ wasCancelled: false, countsTrip: 1, kmStart: 0, kmEnd: 15 }],
      "2031-03-18",
      rules,
    );

    expect(onStart).toBe(2);
    expect(afterEnd).toBe(1);
  });

  it("applies rule indefinitely when effectiveTo is omitted", () => {
    const rules: PraemienRuleConfig = {
      version: 1,
      rules: [
        {
          type: "km",
          enabled: true,
          minKm: 10,
          maxKm: null,
          multiplier: 3,
          effectiveFrom: "2030-01-01",
        },
      ],
      cancelledTripPolicy: "excludeUnlessCountsTrip",
    };

    const result = calculateEffectivePatients(
      [{ wasCancelled: false, countsTrip: 1, kmStart: 0, kmEnd: 12 }],
      "2035-12-31",
      rules,
    );

    expect(result).toBe(3);
  });
});
