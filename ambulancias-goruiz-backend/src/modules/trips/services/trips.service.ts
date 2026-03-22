import { Trip } from "../models/trip.model";

export type CreateTripInput = Record<string, unknown>;

export async function createTrip(data: CreateTripInput) {
  const normalizedData = {
    ...data,
    countsTrip: data.countsTrip === undefined ? 1 : data.countsTrip,
  } as CreateTripInput & { countsTrip: number };

  let totalKm = 0;

  if (!normalizedData.wasCancelled) {
    if (
      typeof normalizedData.kmStart === "number" &&
      typeof normalizedData.kmEnd === "number"
    ) {
      totalKm = normalizedData.kmEnd - normalizedData.kmStart;
    }
  } else if (
    normalizedData.wasCancelled &&
    normalizedData.countsTrip === 1
  ) {
    totalKm = 0;
  } else {
    totalKm = 0;
  }

  const newTrip = new Trip({
    ...normalizedData,
    totalKm,
  });

  return await newTrip.save();
}

export async function getTripsByDate(date: string) {
  return await Trip.find({
    date,
    sentInSummary: false,
  }).sort({ timeWarning: 1 });
}
