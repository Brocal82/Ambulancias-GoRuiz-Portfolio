import { Trip } from "../types/trip.types";

export function calculateEffectivePatients(
  trips: Trip[],
  dienstDate: string,
): number {
  const total = trips.reduce((total, trip) => {
    if (trip.wasCancelled && trip.countsTrip !== 1) return total;

    let multiplier = 1;
    const km =
      trip.kmStart !== undefined && trip.kmEnd !== undefined
        ? trip.kmEnd - trip.kmStart
        : 0;

    if (km >= 15 && km < 20) multiplier = 1.5;
    else if (km >= 20) multiplier = 2;

    const pickupHour = trip.timePickup
      ? parseInt(trip.timePickup.split(":")[0])
      : null;
    const pickupDay = new Date(dienstDate).getDay(); // 0 = domingo, 6 = sábado

    const isWeekend = pickupDay === 0 || pickupDay === 6;
    const isAfternoon =
      pickupHour !== null && pickupHour >= 14 && pickupHour <= 17;

    if (isWeekend && isAfternoon) {
      multiplier = Math.max(multiplier, 1.5); // si ya era 2x, no se baja
    }

    return total + multiplier;
  }, 0);

  return Math.round(total * 2) / 2; // ✅ Redondeo final a múltiplo de 0.5
}
