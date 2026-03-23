import mongoose from "mongoose";
import { Dienst } from "../../diensts";
import type { IDienst, IDienstAssignment } from "../../diensts";
import { Trip } from "../models/trip.model";

/** Error con código HTTP para mapeo en controller */
export class TripError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = "TripError";
  }
}

/** Resuelve el assignment por assignmentId. Lanza 404 si no existe. */
async function resolveAssignmentByAssignmentId(assignmentId: string): Promise<{
  dienst: IDienst;
  assignment: IDienstAssignment;
}> {
  const assignmentObjectId = new mongoose.Types.ObjectId(assignmentId);
  const dienst = await Dienst.findOne({
    "assignments._id": assignmentObjectId,
  });

  if (!dienst) {
    throw new TripError("Dienst no encontrado con ese assignmentId", 404);
  }

  const assignment = dienst.assignments.find(
    (a) => a._id?.toString() === assignmentObjectId.toString(),
  );
  if (!assignment) {
    throw new TripError("Asignación no encontrada", 404);
  }

  return { dienst, assignment };
}

/** Verifica que el usuario pueda crear trips en este assignment. Admin siempre. Worker solo si es driver o medic. */
function assertUserCanCreateTripInAssignment(
  assignment: { driver?: mongoose.Types.ObjectId; medic?: mongoose.Types.ObjectId },
  userId: string,
  userRole: string,
): void {
  if (userRole === "admin") return;

  const driverStr = assignment.driver?.toString();
  const medicStr = assignment.medic?.toString();
  const isParticipant = driverStr === userId || medicStr === userId;

  if (!isParticipant) {
    throw new TripError("No autorizado para crear viajes en este assignment", 403);
  }
}

export type CreateTripInput = Record<string, unknown>;

/* ─────────────────────────────
 * POST /api/trips
 * Admin: puede crear. Worker: solo si participa (driver/medic).
 * driver/medic del body se IGNORAN; se usan siempre los del assignment en BD.
 * ───────────────────────────── */
export async function createTrip(
  data: CreateTripInput,
  userId: string,
  userRole: string,
) {
  const {
    date,
    assignmentId,
    auftragNumber,
    patientName,
    fromAddress,
    toAddress,
    timeWarning,
    timeAtHome,
    timePickup,
    timeArrival,
    timeEnd,
    kmStart,
    kmEnd,
    wasCancelled,
    cancelledAtPickup,
    countsTrip,
    reports,
  } = data;

  const normalizedData = {
    ...data,
    countsTrip: countsTrip === undefined ? 1 : countsTrip,
  } as CreateTripInput & { countsTrip: number };

  let totalKm = 0;

  if (!normalizedData.wasCancelled) {
    if (
      typeof normalizedData.kmStart === "number" &&
      typeof normalizedData.kmEnd === "number"
    ) {
      totalKm = normalizedData.kmEnd - normalizedData.kmStart;
    }
  } else if (normalizedData.wasCancelled && normalizedData.countsTrip === 1) {
    totalKm = 0;
  } else {
    totalKm = 0;
  }

  const { assignment } = await resolveAssignmentByAssignmentId(
    assignmentId as string,
  );
  assertUserCanCreateTripInAssignment(assignment, userId, userRole);

  /* driver y medic del body se IGNORAN; usamos siempre los del assignment real */
  const driver = assignment.driver;
  const medic = assignment.medic;

  if (!driver || !medic) {
    throw new TripError(
      "El assignment no tiene driver y medic asignados",
      400,
    );
  }

  const newTrip = new Trip({
    date,
    assignmentId: new mongoose.Types.ObjectId(assignmentId as string),
    driver,
    medic,
    auftragNumber,
    patientName,
    fromAddress,
    toAddress,
    timeWarning,
    timeAtHome,
    timePickup,
    timeArrival,
    timeEnd,
    kmStart,
    kmEnd,
    totalKm,
    wasCancelled,
    cancelledAtPickup,
    countsTrip: normalizedData.countsTrip,
    reports,
  });

  return await newTrip.save();
}

/* ─────────────────────────────
 * GET /api/trips/date/:date
 * Admin: todos los trips de la fecha. Worker: solo donde participa (driver/medic).
 * ───────────────────────────── */
export async function getTripsByDate(
  date: string,
  userId?: string,
  userRole?: string,
) {
  const baseQuery: mongoose.FilterQuery<{ date: string; sentInSummary: boolean }> = {
    date,
    sentInSummary: false,
  };

  if (userRole === "admin") {
    return await Trip.find(baseQuery).sort({ timeWarning: 1 });
  }

  if (!userId) {
    return [];
  }

  const objectUserId = new mongoose.Types.ObjectId(userId);
  const filter = {
    ...baseQuery,
    $or: [{ driver: objectUserId }, { medic: objectUserId }],
  };

  return await Trip.find(filter).sort({ timeWarning: 1 });
}
