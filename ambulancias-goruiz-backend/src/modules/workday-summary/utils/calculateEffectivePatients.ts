import {
  DEFAULT_PRAEMIEN_RULE_CONFIG,
  normalizePraemienRuleConfig,
  type PraemienRuleConfig,
} from "../../praemien/types/praemien-rule-config";

/** Minimal trip shape needed for effective-patient multiplier calculation. */
export type EffectivePatientTripInput = {
  wasCancelled: boolean;
  countsTrip?: number;
  kmStart?: number;
  kmEnd?: number;
  timePickup?: string;
};

export function calculateEffectivePatients(
  trips: EffectivePatientTripInput[],
  dienstDate: string,
  ruleConfig?: PraemienRuleConfig,
  dienstStartTime?: string | null,
): number {
  const rules = normalizePraemienRuleConfig(
    ruleConfig ?? DEFAULT_PRAEMIEN_RULE_CONFIG,
  );
  const dienstWeekday = new Date(dienstDate).getDay();

  const total = trips.reduce((total, trip) => {
    if (trip.wasCancelled && trip.countsTrip !== 1) return total;

    let multiplier = 1;
    const km =
      trip.kmStart !== undefined && trip.kmEnd !== undefined
        ? trip.kmEnd - trip.kmStart
        : 0;

    for (const rule of rules.rules) {
      if (!rule.enabled) continue;

      if (rule.type === "km") {
        const underMax = rule.maxKm == null || km < rule.maxKm;
        if (km >= rule.minKm && underMax) {
          multiplier = Math.max(multiplier, rule.multiplier);
        }
        continue;
      }

      if (rule.type === "weekday") {
        if (rule.weekdays.includes(dienstWeekday)) {
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

      if (
        dienstStartTime &&
        rule.type === "weekdayDienstStartTime" &&
        rule.weekdays.includes(dienstWeekday) &&
        dienstStartTime >= rule.startTimeFrom &&
        dienstStartTime <= rule.startTimeTo
      ) {
        multiplier = Math.max(multiplier, rule.multiplier);
        continue;
      }

      if (
        trip.timePickup &&
        rule.type === "weekdayPickupTime" &&
        rule.weekdays.includes(dienstWeekday) &&
        trip.timePickup >= rule.pickupTimeFrom &&
        trip.timePickup <= rule.pickupTimeTo
      ) {
        multiplier = Math.max(multiplier, rule.multiplier);
      }
    }

    return total + multiplier;
  }, 0);

  return Math.round(total * 2) / 2;
}
