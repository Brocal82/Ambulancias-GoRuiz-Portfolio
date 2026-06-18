import type { PraemienRuleConfig } from "../domain/api";
import { isPraemienRuleEffectiveOnDate } from "./praemienRuleValidity";

export type PraemienPreviewTrip = {
  wasCancelled?: boolean;
  countsTrip?: number;
  kmStart?: number;
  kmEnd?: number;
  timePickup?: string;
};

export const DEFAULT_PRAEMIEN_RULES: PraemienRuleConfig = {
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

function kmForTrip(trip: PraemienPreviewTrip): number {
  if (
    typeof trip.kmStart !== "number" ||
    typeof trip.kmEnd !== "number" ||
    Number.isNaN(trip.kmStart) ||
    Number.isNaN(trip.kmEnd)
  ) {
    return 0;
  }
  return Math.max(0, trip.kmEnd - trip.kmStart);
}

export function getPraemienPreviewMultiplier(params: {
  trip: PraemienPreviewTrip;
  dienstDate: string;
  dienstStartTime?: string | null;
  rules?: PraemienRuleConfig | null;
}): number {
  const { trip, dienstDate, dienstStartTime } = params;
  const config = params.rules ?? DEFAULT_PRAEMIEN_RULES;
  if (trip.wasCancelled && trip.countsTrip !== 1) return 0;
  if (trip.countsTrip === 0) return 0;

  const km = kmForTrip(trip);
  const weekday = new Date(dienstDate).getDay();
  let multiplier = 1;

  for (const rule of config.rules) {
    if (!rule.enabled) continue;
    if (!isPraemienRuleEffectiveOnDate(rule, dienstDate)) continue;
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

export function calculatePraemienPreviewTotal(params: {
  trips: PraemienPreviewTrip[];
  dienstDate: string;
  dienstStartTime?: string | null;
  rules?: PraemienRuleConfig | null;
}): number {
  const total = params.trips.reduce(
    (sum, trip) =>
      sum +
      getPraemienPreviewMultiplier({
        trip,
        dienstDate: params.dienstDate,
        dienstStartTime: params.dienstStartTime,
        rules: params.rules,
      }),
    0,
  );
  return Math.round(total * 2) / 2;
}
