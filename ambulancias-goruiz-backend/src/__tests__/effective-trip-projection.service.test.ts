/**
 * Phase 4.2 — Effective trip projection unit tests.
 */
import { calculateEffectivePatients } from "../modules/workday-summary/utils/calculateEffectivePatients";
import {
  projectEffectiveTripAggregates,
  sumProjectableTripKm,
} from "../modules/operational-recovery/services/effective-trip-projection.service";

const BASE_CONTEXT = {
  date: "2026-08-15",
  baselineTotalDienstKm: 200,
  baselineFinalKm: 10200,
  baselineTripKmTotal: 50,
  dienstStartTime: "08:00",
};

describe("sumProjectableTripKm", () => {
  it("sums km for counting trips only", () => {
    const total = sumProjectableTripKm([
      { countsTrip: 1, wasCancelled: false, kmStart: 100, kmEnd: 125 },
      { countsTrip: 0, wasCancelled: true, kmStart: 200, kmEnd: 210 },
      { countsTrip: 1, wasCancelled: false, isEffectivelyVoided: true, kmStart: 0, kmEnd: 99 },
    ]);
    expect(total).toBe(25);
  });
});

describe("projectEffectiveTripAggregates", () => {
  it("aggregates normal trips correctly", () => {
    const trips = [
      { countsTrip: 1 as const, wasCancelled: false, kmStart: 10000, kmEnd: 10025, timePickup: "09:00" },
      { countsTrip: 1 as const, wasCancelled: false, kmStart: 10025, kmEnd: 10050, timePickup: "11:00" },
    ];

    const result = projectEffectiveTripAggregates(trips, BASE_CONTEXT);

    expect(result.totalRealTrips).toBe(2);
    expect(result.tripKmTotal).toBe(50);
    expect(result.tripKmDelta).toBe(0);
    expect(result.totalDienstKm).toBe(200);
    expect(result.finalKm).toBe(10200);
  });

  it("excludes voided trips from counts", () => {
    const trips = [
      { countsTrip: 1 as const, wasCancelled: false, kmStart: 10000, kmEnd: 10025, timePickup: "09:00" },
      {
        countsTrip: 0 as const,
        wasCancelled: false,
        isEffectivelyVoided: true,
        kmStart: 10025,
        kmEnd: 10050,
        timePickup: "11:00",
      },
    ];

    const result = projectEffectiveTripAggregates(trips, BASE_CONTEXT);

    expect(result.totalRealTrips).toBe(1);
    expect(result.tripKmTotal).toBe(25);
    expect(result.tripKmDelta).toBe(-25);
    expect(result.totalDienstKm).toBe(175);
    expect(result.finalKm).toBe(10175);
  });

  it("respects corrected countsTrip", () => {
    const trips = [
      { countsTrip: 0 as const, wasCancelled: false, kmStart: 10000, kmEnd: 10025, timePickup: "09:00" },
    ];

    const result = projectEffectiveTripAggregates(trips, BASE_CONTEXT);
    expect(result.totalRealTrips).toBe(0);
  });

  it("respects corrected wasCancelled with countsTrip", () => {
    const trips = [
      { countsTrip: 1 as const, wasCancelled: true, kmStart: 10000, kmEnd: 10025, timePickup: "09:00" },
    ];

    const directPatients = calculateEffectivePatients(
      [{ wasCancelled: true, countsTrip: 1, kmStart: 10000, kmEnd: 10025, timePickup: "09:00" }],
      BASE_CONTEXT.date,
      undefined,
      BASE_CONTEXT.dienstStartTime,
    );

    const result = projectEffectiveTripAggregates(trips, BASE_CONTEXT);
    expect(result.totalEffectivePatients).toBe(directPatients);
    expect(result.totalRealTrips).toBe(1);
  });

  it("includes add_forgotten trips when they count", () => {
    const trips = [
      { countsTrip: 1 as const, wasCancelled: false, kmStart: 10000, kmEnd: 10020, timePickup: "08:30" },
      { countsTrip: 1 as const, wasCancelled: false, kmStart: 10020, kmEnd: 10040, timePickup: "10:00" },
    ];

    const baseline = { ...BASE_CONTEXT, baselineTripKmTotal: 20 };
    const result = projectEffectiveTripAggregates(trips, baseline);

    expect(result.totalRealTrips).toBe(2);
    expect(result.tripKmTotal).toBe(40);
    expect(result.tripKmDelta).toBe(20);
    expect(result.totalDienstKm).toBe(220);
  });

  it("uses effective patient calculation consistently", () => {
    const trips = [
      { countsTrip: 1 as const, wasCancelled: false, kmStart: 0, kmEnd: 18, timePickup: "10:00" },
      { countsTrip: 1 as const, wasCancelled: false, kmStart: 0, kmEnd: 21, timePickup: "10:00" },
    ];

    const expected = calculateEffectivePatients(
      trips,
      BASE_CONTEXT.date,
      undefined,
      BASE_CONTEXT.dienstStartTime,
    );

    const result = projectEffectiveTripAggregates(trips, {
      ...BASE_CONTEXT,
      baselineTripKmTotal: 39,
    });

    expect(result.totalEffectivePatients).toBe(expected);
  });
});
