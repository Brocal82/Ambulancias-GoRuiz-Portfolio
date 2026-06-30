/**
 * Phase 4.2 — Effective trip aggregate projection.
 *
 * Pure calculation helper: effective trips → operational Workday totals.
 * No HTTP, no DB, no Praemien side effects.
 */
import { calculateEffectivePatients } from "../../workday-summary/utils/calculateEffectivePatients";
import type {
  EffectiveTripProjectionContext,
  EffectiveTripProjectionResult,
  ProjectableEffectiveTrip,
} from "../types/effective-trip-projection.types";

function isVoidedTrip(trip: ProjectableEffectiveTrip): boolean {
  return trip.isEffectivelyVoided === true;
}

function countsForRealTrips(trip: ProjectableEffectiveTrip): boolean {
  if (isVoidedTrip(trip)) return false;
  if (trip.isIncludedInEffectiveCount !== undefined) {
    return trip.isIncludedInEffectiveCount;
  }
  return trip.countsTrip === 1;
}

/** Sums per-trip km (kmEnd - kmStart) for trips that count operationally. */
export function sumProjectableTripKm(trips: ProjectableEffectiveTrip[]): number {
  return trips.reduce((sum, trip) => {
    if (!countsForRealTrips(trip)) return sum;
    if (trip.kmStart == null || trip.kmEnd == null) return sum;
    return sum + (trip.kmEnd - trip.kmStart);
  }, 0);
}

function toPatientTripInput(trip: ProjectableEffectiveTrip) {
  return {
    wasCancelled: trip.wasCancelled,
    countsTrip: trip.countsTrip,
    kmStart: trip.kmStart,
    kmEnd: trip.kmEnd,
    timePickup: trip.timePickup,
  };
}

/**
 * Projects effective trip aggregates for Workday correction.
 *
 * Rules:
 * - voided trips excluded from counts and patient calculation
 * - add_forgotten / corrected countsTrip respected
 * - totalDienstKm / finalKm adjusted by trip km delta vs baseline when derivable
 */
export function projectEffectiveTripAggregates(
  effectiveTrips: ProjectableEffectiveTrip[],
  context: EffectiveTripProjectionContext,
): EffectiveTripProjectionResult {
  const operationalTrips = effectiveTrips.filter((t) => !isVoidedTrip(t));

  const totalRealTrips = operationalTrips.filter((t) => t.countsTrip === 1).length;

  const totalEffectivePatients = calculateEffectivePatients(
    operationalTrips.map(toPatientTripInput),
    context.date,
    context.praemienRulesSnapshot,
    context.dienstStartTime,
  );

  const tripKmTotal = sumProjectableTripKm(operationalTrips);
  const tripKmDelta = tripKmTotal - context.baselineTripKmTotal;
  const totalDienstKm = context.baselineTotalDienstKm + tripKmDelta;
  const finalKm =
    context.baselineFinalKm != null
      ? context.baselineFinalKm + tripKmDelta
      : undefined;

  return {
    totalRealTrips,
    totalEffectivePatients,
    totalDienstKm,
    finalKm,
    tripKmTotal,
    tripKmDelta,
  };
}
