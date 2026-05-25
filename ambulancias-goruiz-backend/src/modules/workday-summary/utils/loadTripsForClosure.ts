import mongoose from "mongoose";
import { Trip } from "../../trips/models/trip.model";
import { WorkdaySummaryError } from "../../../utils/assignmentClosure";

export type SummaryTripEntry = {
  auftragNumber: string;
  patientName: string;
  fromAddress: string;
  toAddress: string;
  timeWarning: string;
  timeAtHome?: string;
  timePickup?: string;
  timeArrival?: string;
  timeEnd?: string;
  kmStart?: number;
  kmEnd?: number;
  wasCancelled: boolean;
  cancelledAtPickup?: boolean;
  countsTrip: 0 | 1;
  reports?: string;
};

const hex24 = /^[0-9a-fA-F]{24}$/;

function mapTripDocToSummaryEntry(trip: Record<string, unknown>): SummaryTripEntry {
  return {
    auftragNumber: String(trip.auftragNumber ?? ""),
    patientName: String(trip.patientName ?? ""),
    fromAddress: String(trip.fromAddress ?? ""),
    toAddress: String(trip.toAddress ?? ""),
    timeWarning: String(trip.timeWarning ?? ""),
    timeAtHome: trip.timeAtHome != null ? String(trip.timeAtHome) : undefined,
    timePickup: trip.timePickup != null ? String(trip.timePickup) : undefined,
    timeArrival: trip.timeArrival != null ? String(trip.timeArrival) : undefined,
    timeEnd: trip.timeEnd != null ? String(trip.timeEnd) : undefined,
    kmStart: typeof trip.kmStart === "number" ? trip.kmStart : undefined,
    kmEnd: typeof trip.kmEnd === "number" ? trip.kmEnd : undefined,
    wasCancelled: !!trip.wasCancelled,
    cancelledAtPickup: !!trip.cancelledAtPickup,
    countsTrip: trip.countsTrip === 1 ? 1 : 0,
    reports: trip.reports != null ? String(trip.reports) : "",
  };
}

/** Extracts trip ObjectId strings from client body (only `_id` is trusted). */
export function extractTripIdsFromBody(trips: unknown): string[] {
  if (!Array.isArray(trips)) return [];
  const ids: string[] = [];
  for (const t of trips) {
    if (t && typeof t === "object" && "_id" in t && t._id != null) {
      const id = String((t as { _id: unknown })._id).trim();
      if (hex24.test(id)) ids.push(id);
    }
  }
  return ids;
}

/**
 * Rejects tampered client snapshots when client sends `_id` plus fields that differ from DB.
 */
export function assertNoStaleClientTripSnapshot(
  clientTrips: unknown[],
  dbTripsById: Map<string, Record<string, unknown>>,
): void {
  const compareFields = ["kmStart", "kmEnd", "countsTrip", "wasCancelled"] as const;
  for (const clientTrip of clientTrips) {
    if (!clientTrip || typeof clientTrip !== "object" || !("_id" in clientTrip)) continue;
    const id = String((clientTrip as { _id: unknown })._id).trim();
    if (!hex24.test(id)) continue;
    const dbTrip = dbTripsById.get(id);
    if (!dbTrip) continue;
    for (const field of compareFields) {
      const clientVal = (clientTrip as Record<string, unknown>)[field];
      if (clientVal === undefined) continue;
      const dbVal = dbTrip[field];
      if (field === "countsTrip") {
        const cNorm = clientVal === 1 ? 1 : 0;
        const dNorm = dbVal === 1 ? 1 : 0;
        if (cNorm !== dNorm) {
          throw new WorkdaySummaryError(
            "Los datos de viaje enviados no coinciden con el servidor; recarga la jornada.",
            409,
          );
        }
      } else if (field === "wasCancelled") {
        if (!!clientVal !== !!dbVal) {
          throw new WorkdaySummaryError(
            "Los datos de viaje enviados no coinciden con el servidor; recarga la jornada.",
            409,
          );
        }
      } else if (typeof clientVal === "number" && clientVal !== dbVal) {
        throw new WorkdaySummaryError(
          "Los datos de viaje enviados no coinciden con el servidor; recarga la jornada.",
          409,
        );
      }
    }
  }
}

export async function loadTripsForClosure(args: {
  tripIds: string[];
  assignmentId: string;
  companyId: mongoose.Types.ObjectId;
  clientTrips?: unknown[];
}): Promise<{
  summaryTrips: SummaryTripEntry[];
  tripObjectIds: mongoose.Types.ObjectId[];
}> {
  const { tripIds, assignmentId, companyId, clientTrips = [] } = args;

  if (tripIds.length === 0) {
    return { summaryTrips: [], tripObjectIds: [] };
  }

  const invalid = tripIds.filter((id) => !hex24.test(String(id).trim()));
  if (invalid.length > 0) {
    throw new WorkdaySummaryError("Uno o más tripIds no son válidos", 400);
  }

  const uniqueIds = [...new Set(tripIds.map((id) => id.trim()))];
  if (uniqueIds.length !== tripIds.length) {
    throw new WorkdaySummaryError("tripIds duplicados en la solicitud", 400);
  }

  const assignmentObjId = new mongoose.Types.ObjectId(assignmentId);
  const objectIds = uniqueIds.map((id) => new mongoose.Types.ObjectId(id));

  const dbTrips = await Trip.find({
    _id: { $in: objectIds },
    assignmentId: assignmentObjId,
    companyId,
    sentInSummary: false,
  }).lean();

  if (dbTrips.length !== uniqueIds.length) {
    throw new WorkdaySummaryError(
      "Uno o más viajes no están disponibles para el cierre (no existen, ya fueron enviados o no pertenecen a esta jornada).",
      400,
    );
  }

  const dbTripsById = new Map(
    dbTrips.map((t) => [String(t._id), t as Record<string, unknown>]),
  );
  assertNoStaleClientTripSnapshot(clientTrips, dbTripsById);

  const summaryTrips = uniqueIds.map((id) => {
    const doc = dbTripsById.get(id)!;
    return mapTripDocToSummaryEntry(doc);
  });

  return { summaryTrips, tripObjectIds: objectIds };
}
