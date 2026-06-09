import type { WorkdaySummaryTrip } from "../services/workday";

function isWeekendLateDienst(dienstDate: string, startTime?: string): boolean {
  const day = new Date(dienstDate).getDay();
  if (day !== 0 && day !== 6) return false;
  if (!startTime?.trim()) return false;
  const h = Number(startTime.split(":")[0]);
  return !Number.isNaN(h) && h >= 14 && h <= 17;
}

export function calcWorkdayTripKm(trip: WorkdaySummaryTrip): number {
  const ks = trip.kmStart;
  const ke = trip.kmEnd;
  if (typeof ks !== "number" || typeof ke !== "number" || Number.isNaN(ks) || Number.isNaN(ke)) {
    return 0;
  }
  return Math.max(0, ke - ks);
}

/** Same rules as web `ReviewSummary.getMultiplier`. */
export function getWorkdayTripPraemieMultiplier(
  trip: WorkdaySummaryTrip,
  dienstDate: string,
  dienstStartTime?: string,
): number {
  const diff = calcWorkdayTripKm(trip);
  const weekendLate = isWeekendLateDienst(dienstDate, dienstStartTime);
  if (trip.countsTrip === 0) return 0;
  if (trip.countsTrip === 1) {
    if (diff >= 20) return 2;
    if (diff >= 15 || weekendLate) return 1.5;
    return 1;
  }
  if (diff >= 20) return 2;
  if (diff >= 15 || weekendLate) return 1.5;
  return 1;
}

export function calculateEffectivePatientsFromSummaryTrips(
  trips: WorkdaySummaryTrip[],
  dienstDate: string,
  dienstStartTime?: string,
): number {
  const total = trips.reduce((sum, trip) => {
    if (trip.wasCancelled && trip.countsTrip !== 1) return sum;
    return sum + getWorkdayTripPraemieMultiplier(trip, dienstDate, dienstStartTime);
  }, 0);
  return Math.round(total * 2) / 2;
}

export function formatPraemieValue(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}
