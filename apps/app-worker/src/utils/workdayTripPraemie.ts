import type { PraemienRuleConfig } from "../services/praemien";
import type { WorkdaySummaryTrip } from "../services/workday";

const DEFAULT_PRAEMIEN_RULES: PraemienRuleConfig = {
  version: 1,
  rules: [
    {
      id: "legacy-km-15-20",
      type: "km",
      label: "15 a 20 km",
      enabled: true,
      minKm: 15,
      maxKm: 20,
      multiplier: 1.5,
    },
    {
      id: "legacy-km-20-plus",
      type: "km",
      label: "20 km o mas",
      enabled: true,
      minKm: 20,
      maxKm: null,
      multiplier: 2,
    },
    {
      id: "legacy-weekend-dienst",
      type: "weekdayDienstStartTime",
      label: "Fin de semana Dienst 13-17",
      enabled: true,
      weekdays: [0, 6],
      startTimeFrom: "13:00",
      startTimeTo: "17:00",
      multiplier: 1.5,
    },
  ],
  cancelledTripPolicy: "excludeUnlessCountsTrip",
};

export function calcWorkdayTripKm(trip: WorkdaySummaryTrip): number {
  const ks = trip.kmStart;
  const ke = trip.kmEnd;
  if (typeof ks !== "number" || typeof ke !== "number" || Number.isNaN(ks) || Number.isNaN(ke)) {
    return 0;
  }
  return Math.max(0, ke - ks);
}

export function getWorkdayTripPraemieMultiplier(
  trip: WorkdaySummaryTrip,
  dienstDate: string,
  dienstStartTime?: string | null,
  rules: PraemienRuleConfig | null = null,
): number {
  if (trip.wasCancelled && trip.countsTrip !== 1) return 0;
  if (trip.countsTrip === 0) return 0;

  const config = rules ?? DEFAULT_PRAEMIEN_RULES;
  const km = calcWorkdayTripKm(trip);
  const weekday = new Date(dienstDate).getDay();
  let multiplier = 1;

  for (const rule of config.rules) {
    if (!rule.enabled) continue;
    if (rule.type === "km") {
      const underMax = rule.maxKm == null || km < rule.maxKm;
      if (km >= rule.minKm && underMax) {
        multiplier = Math.max(multiplier, rule.multiplier);
      }
      continue;
    }
    if (rule.type === "weekday") {
      if (rule.weekdays.includes(weekday)) {
        multiplier = Math.max(multiplier, rule.multiplier);
      }
      continue;
    }
    if (rule.type === "dienstStartTime") {
      if (
        dienstStartTime &&
        dienstStartTime >= rule.startTimeFrom &&
        dienstStartTime <= rule.startTimeTo
      ) {
        multiplier = Math.max(multiplier, rule.multiplier);
      }
      continue;
    }
    if (rule.type === "weekdayDienstStartTime") {
      if (
        dienstStartTime &&
        rule.weekdays.includes(weekday) &&
        dienstStartTime >= rule.startTimeFrom &&
        dienstStartTime <= rule.startTimeTo
      ) {
        multiplier = Math.max(multiplier, rule.multiplier);
      }
      continue;
    }
    if (rule.type === "weekdayPickupTime") {
      if (
        trip.timePickup &&
        rule.weekdays.includes(weekday) &&
        trip.timePickup >= rule.pickupTimeFrom &&
        trip.timePickup <= rule.pickupTimeTo
      ) {
        multiplier = Math.max(multiplier, rule.multiplier);
      }
    }
  }

  return multiplier;
}

export function calculateEffectivePatientsFromSummaryTrips(
  trips: WorkdaySummaryTrip[],
  dienstDate: string,
  dienstStartTime?: string | null,
  rules: PraemienRuleConfig | null = null,
): number {
  const total = trips.reduce((sum, trip) => {
    return sum + getWorkdayTripPraemieMultiplier(trip, dienstDate, dienstStartTime, rules);
  }, 0);
  return Math.round(total * 2) / 2;
}

export function formatPraemieValue(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}
