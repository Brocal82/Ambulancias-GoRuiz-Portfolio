import mongoose from "mongoose";
import { Dienst } from "../../diensts";
import type { IDienst, IDienstAssignment } from "../../diensts";
import WorkdaySummary from "../../workday-summary/models/workday-summary.model";
import { Trip } from "../models/trip.model";
import { TripSetup } from "../models/trip-setup.model";
import { getAmbulanceById } from "../../ambulances/services/ambulances.service";

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

/** Resuelve el assignment por assignmentId dentro del tenant. Lanza 404 si no existe. */
async function resolveAssignmentByAssignmentId(
  assignmentId: string,
  companyId: string,
): Promise<{
  dienst: IDienst;
  assignment: IDienstAssignment;
}> {
  const raw = String(companyId).trim();
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) {
    throw new TripError("No autorizado para crear viajes en este assignment", 403);
  }
  const assignmentObjectId = new mongoose.Types.ObjectId(assignmentId);
  const companyOid = new mongoose.Types.ObjectId(raw);
  const dienst = await Dienst.findOne({
    "assignments._id": assignmentObjectId,
    companyId: companyOid,
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

async function resolveAssignmentForSetup(
  assignmentId: string,
  companyId: string,
): Promise<{
  dienst: IDienst;
  assignment: IDienstAssignment;
}> {
  return resolveAssignmentByAssignmentId(assignmentId, companyId);
}

/** Verifica que el usuario pueda crear trips en este assignment. Admin: dienst mismo companyId. Worker: participante y mismo companyId. */
function assertUserCanCreateTripInAssignment(
  dienst: { companyId?: unknown },
  assignment: { driver?: mongoose.Types.ObjectId; medic?: mongoose.Types.ObjectId },
  userId: string,
  userRole: string,
  userCompanyId?: string | null,
): void {
  const callerCo =
    userCompanyId != null && String(userCompanyId).trim() !== ""
      ? String(userCompanyId).trim()
      : "";
  if (!callerCo || !mongoose.Types.ObjectId.isValid(callerCo)) {
    throw new TripError("No autorizado para crear viajes en este assignment", 403);
  }
  const dienstCompanyStr = dienst.companyId ? String(dienst.companyId) : "";
  if (!dienstCompanyStr || dienstCompanyStr !== callerCo) {
    throw new TripError("No autorizado para crear viajes en este assignment", 403);
  }

  if (userRole === "admin") {
    return;
  }

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
  userCompanyId?: string | null,
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

  const scopeCo =
    userCompanyId != null && String(userCompanyId).trim() !== ""
      ? String(userCompanyId).trim()
      : "";
  const { dienst, assignment } = await resolveAssignmentByAssignmentId(
    assignmentId as string,
    scopeCo,
  );
  assertUserCanCreateTripInAssignment(
    dienst as any,
    assignment,
    userId,
    userRole,
    userCompanyId,
  );

  const assignmentIdStr = new mongoose.Types.ObjectId(
    assignmentId as string,
  ).toString();
  const dateStr = String(date);
  const finalClosureFilter: mongoose.FilterQuery<Record<string, unknown>> = {
    assignmentId: assignmentIdStr,
    date: dateStr,
    isFinalClosure: true,
  };
  const dienstCoForClosure = (dienst as { companyId?: unknown }).companyId;
  if (dienstCoForClosure) {
    finalClosureFilter.companyId = new mongoose.Types.ObjectId(
      String(dienstCoForClosure),
    );
  }
  const existingFinal = await WorkdaySummary.findOne(finalClosureFilter)
    .select("_id")
    .lean();
  if (existingFinal) {
    throw new TripError(
      "Ya existe un cierre final para este día y asignación; no se pueden crear más viajes.",
      409,
    );
  }

  /* driver y medic del body se IGNORAN; usamos siempre los del assignment real */
  const driver = assignment.driver;
  const medic = assignment.medic;

  if (!driver || !medic) {
    throw new TripError(
      "El assignment no tiene driver y medic asignados",
      400,
    );
  }

  const dienstCompanyId = (dienst as any).companyId;

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
    ...(dienstCompanyId && { companyId: dienstCompanyId }),
  });

  return await newTrip.save();
}

/* ─────────────────────────────
 * GET /api/trips/date/:date
 * Admin: trips de su empresa. Worker: solo donde participa y misma empresa.
 * ───────────────────────────── */
export async function getTripsByDate(
  date: string,
  userId?: string,
  userRole?: string,
  userCompanyId?: string | null,
) {
  const raw = typeof userCompanyId === "string" ? userCompanyId.trim() : "";
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) {
    return [];
  }
  const companyFilter = { companyId: new mongoose.Types.ObjectId(raw) };

  const filter: mongoose.FilterQuery<any> = {
    date,
    sentInSummary: false,
    ...companyFilter,
  };

  if (userRole === "admin") {
    return await Trip.find(filter).sort({ timeWarning: 1 });
  }

  if (!userId) {
    return [];
  }

  const objectUserId = new mongoose.Types.ObjectId(userId);
  const workerFilter: mongoose.FilterQuery<any> = {
    date,
    sentInSummary: false,
    ...companyFilter,
    $and: [{ $or: [{ driver: objectUserId }, { medic: objectUserId }] }],
  };

  return await Trip.find(workerFilter).sort({ timeWarning: 1 });
}

export async function upsertTripSetup(
  assignmentId: string,
  payload: {
    ambulanceId?: string;
    ambulanceNumber: string;
    initialKm: number;
  },
  userId: string,
  userRole: string,
  userCompanyId?: string | null,
) {
  const scopeCo =
    userCompanyId != null && String(userCompanyId).trim() !== ""
      ? String(userCompanyId).trim()
      : "";
  const { dienst, assignment } = await resolveAssignmentForSetup(assignmentId, scopeCo);
  assertUserCanCreateTripInAssignment(
    dienst as any,
    assignment,
    userId,
    userRole,
    userCompanyId,
  );
  if (payload.ambulanceId) {
    const ambulance = await getAmbulanceById(payload.ambulanceId, scopeCo);
    if (!ambulance) {
      throw new TripError("La ambulancia no pertenece a tu empresa", 403);
    }
  }
  const assignmentObjectId = new mongoose.Types.ObjectId(assignmentId);
  const update: Record<string, unknown> = {
    assignmentId: assignmentObjectId,
    date: assignment.date,
    ambulanceNumber: payload.ambulanceNumber,
    initialKm: payload.initialKm,
    updatedBy: userId && mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null,
    companyId: (dienst as any).companyId ?? null,
  };
  if (payload.ambulanceId) {
    update.ambulanceId = payload.ambulanceId;
  }
  return TripSetup.findOneAndUpdate(
    { assignmentId: assignmentObjectId },
    { $set: update },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
}

export async function getTripSetup(
  assignmentId: string,
  userId: string,
  userRole: string,
  userCompanyId?: string | null,
) {
  const scopeCo =
    userCompanyId != null && String(userCompanyId).trim() !== ""
      ? String(userCompanyId).trim()
      : "";
  const { dienst, assignment } = await resolveAssignmentForSetup(assignmentId, scopeCo);
  assertUserCanCreateTripInAssignment(
    dienst as any,
    assignment,
    userId,
    userRole,
    userCompanyId,
  );
  return TripSetup.findOne({
    assignmentId: new mongoose.Types.ObjectId(assignmentId),
  }).lean();
}
