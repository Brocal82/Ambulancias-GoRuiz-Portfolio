import mongoose from "mongoose";
import { Dienst } from "../../diensts";
import { Trip } from "../../trips";
import WorkdaySummary from "../models/workday-summary.model";
import type { IWorkdaySummary } from "../models/workday-summary.model";
import { sendPushNotification, voidEmitWorkdayAdminSideEffects, voidEmitWorkdayWorkerRefresh } from "../../notifications";
import { calculateEffectivePatients } from "../utils/calculateEffectivePatients";
import {
  WorkdaySummaryError,
  resolveAssignmentByAssignmentId,
  assertUserCanCloseAssignment,
} from "../../../utils/assignmentClosure";
import { getAmbulanceById } from "../../ambulances/services/ambulances.service";
import { validateClosureKm } from "../utils/kmValidation";
import {
  extractTripIdsFromBody,
  loadTripsForClosure,
} from "../utils/loadTripsForClosure";
import { assertNoFinalClosureExists } from "../utils/closureGuards";
import type {
  FinalClosureBody,
  PartialClosureBody,
} from "../schemas/workday-summary.schema";

export { WorkdaySummaryError } from "../../../utils/assignmentClosure";

function isMongoDuplicateKeyError(err: unknown): boolean {
  let e: unknown = err;
  for (let i = 0; i < 5 && e; i++) {
    if (
      e !== null &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code?: number }).code === 11000
    ) {
      return true;
    }
    const next =
      e !== null &&
      typeof e === "object" &&
      "cause" in e &&
      (e as { cause?: unknown }).cause;
    e = next;
  }
  return false;
}

/* ─────────────────────────────
 * CIERRE COMPLETO DEL DÍA
 * Admin: puede continuar (mismo companyId). Worker: solo si participa.
 * ───────────────────────────── */
export async function createWorkdaySummary(
  body: FinalClosureBody,
  userId: string,
  userRole: string,
  userCompanyId?: string | null,
) {
  const {
    date,
    assignmentId,
    ambulanceId,
    ambulanceNumber,
    initialKm,
    finalKm,
    trips: clientTrips,
    extraNote,
    checklistItems,
    o2Level,
  } = body;

  validateClosureKm(initialKm, finalKm);

  const scopeCo =
    userCompanyId != null && String(userCompanyId).trim() !== ""
      ? String(userCompanyId).trim()
      : "";
  const { dienst, assignment } = await resolveAssignmentByAssignmentId(
    assignmentId,
    scopeCo,
  );
  assertUserCanCloseAssignment(dienst as any, assignment, userId, userRole, userCompanyId);

  const ambulance = await getAmbulanceById(ambulanceId, scopeCo);
  if (!ambulance) {
    throw new WorkdaySummaryError("La ambulancia no pertenece a tu empresa", 403);
  }

  const dienstCompanyId = (dienst as { companyId?: mongoose.Types.ObjectId }).companyId;
  if (!dienstCompanyId) {
    throw new WorkdaySummaryError("No autorizado para cerrar este assignment", 403);
  }
  const companyOid = new mongoose.Types.ObjectId(String(dienstCompanyId));

  await assertNoFinalClosureExists(assignmentId, date, companyOid);

  const tripIds = extractTripIdsFromBody(clientTrips);
  const { summaryTrips, tripObjectIds } = await loadTripsForClosure({
    tripIds,
    assignmentId,
    companyId: companyOid,
    clientTrips,
  });

  const dienstNumber = dienst?.dienstNumber ?? null;
  const startTime = assignment?.startTime ?? null;
  const endTime = assignment?.endTime ?? null;
  const { driver, medic } = assignment;

  const totalEffectivePatients = calculateEffectivePatients(summaryTrips, date);
  const totalDienstKm = finalKm - initialKm;
  const totalRealTrips = summaryTrips.filter((t) => t.countsTrip === 1).length;

  const summaryDoc = {
    date,
    assignmentId,
    ambulanceId,
    ambulanceNumber,
    driver,
    medic,
    initialKm,
    finalKm,
    totalDienstKm,
    trips: summaryTrips,
    extraNote,
    isFinalClosure: true,
    totalEffectivePatients,
    totalRealTrips,
    dienstNumber,
    startTime,
    endTime,
    ...(checklistItems != null && { checklistItems }),
    ...(o2Level != null && typeof o2Level === "number" && !Number.isNaN(o2Level) && { o2Level }),
    companyId: companyOid,
  };

  const session = await mongoose.startSession();
  try {
    const result = await session.withTransaction(async () => {
      const created = await WorkdaySummary.create([summaryDoc], { session });
      const newSummary = created[0] as IWorkdaySummary;
      if (tripObjectIds.length > 0) {
        await Trip.updateMany(
          { _id: { $in: tripObjectIds } },
          { $set: { sentInSummary: true } },
          { session },
        );
      }
      return newSummary;
    });
    voidEmitWorkdayAdminSideEffects(String(companyOid));
    return result;
  } catch (err: unknown) {
    if (isMongoDuplicateKeyError(err)) {
      throw new WorkdaySummaryError(
        "Ya existe un cierre final para este día y asignación.",
        409,
      );
    }
    throw err;
  } finally {
    await session.endSession();
  }
}

/* ─────────────────────────────
 * CIERRE PARCIAL DEL DÍA
 * Admin: puede continuar (mismo companyId). Worker: solo si participa.
 * ───────────────────────────── */
export async function submitPartialClosure(
  body: PartialClosureBody,
  userId: string,
  userRole: string,
  userCompanyId?: string | null,
) {
  const {
    date,
    assignmentId,
    ambulanceId,
    ambulanceNumber,
    initialKm,
    finalKm,
    trips: clientTrips,
    partialClosureReason,
  } = body;

  validateClosureKm(initialKm, finalKm);

  const scopeCo =
    userCompanyId != null && String(userCompanyId).trim() !== ""
      ? String(userCompanyId).trim()
      : "";
  const { dienst, assignment } = await resolveAssignmentByAssignmentId(
    assignmentId,
    scopeCo,
  );
  assertUserCanCloseAssignment(dienst as any, assignment, userId, userRole, userCompanyId);

  const ambulance = await getAmbulanceById(ambulanceId, scopeCo);
  if (!ambulance) {
    throw new WorkdaySummaryError("La ambulancia no pertenece a tu empresa", 403);
  }

  const dienstCompanyId = (dienst as { companyId?: mongoose.Types.ObjectId }).companyId;
  if (!dienstCompanyId) {
    throw new WorkdaySummaryError("No autorizado para cerrar este assignment", 403);
  }
  const companyOid = new mongoose.Types.ObjectId(String(dienstCompanyId));

  await assertNoFinalClosureExists(assignmentId, date, companyOid);

  const tripIds = extractTripIdsFromBody(clientTrips);
  const { summaryTrips, tripObjectIds } = await loadTripsForClosure({
    tripIds,
    assignmentId,
    companyId: companyOid,
    clientTrips,
  });

  const dienstNumber = dienst?.dienstNumber ?? null;
  const startTime = assignment?.startTime ?? null;
  const endTime = assignment?.endTime ?? null;
  const { driver, medic } = assignment;

  const totalEffectivePatients = calculateEffectivePatients(summaryTrips, date);
  const totalDienstKm = finalKm - initialKm;
  const totalRealTrips = summaryTrips.filter((t) => t.countsTrip === 1).length;

  const summaryDoc = {
    date,
    assignmentId,
    driver,
    medic,
    ambulanceId,
    ambulanceNumber,
    initialKm,
    finalKm,
    totalDienstKm,
    trips: summaryTrips,
    partialClosureReason,
    isFinalClosure: false,
    totalEffectivePatients,
    totalRealTrips,
    dienstNumber,
    startTime,
    endTime,
    companyId: companyOid,
  };

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const summary = new WorkdaySummary(summaryDoc);
      await summary.save({ session });
      if (tripObjectIds.length > 0) {
        await Trip.updateMany(
          { _id: { $in: tripObjectIds } },
          { $set: { sentInSummary: true } },
          { session },
        );
      }
    });
    voidEmitWorkdayAdminSideEffects(String(companyOid));
  } finally {
    await session.endSession();
  }

  return { message: "Cierre parcial guardado correctamente." };
}

/* ─────────────────────────────
 * GET TODOS LOS RESÚMENES
 * filterByUserId: si existe, filtra por driver o medic.
 * companyId: filtra por empresa.
 * ───────────────────────────── */
export async function getAllWorkdaySummaries(
  filterByUserId?: string,
  companyId?: string | null,
) {
  const raw = typeof companyId === "string" ? companyId.trim() : "";
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) {
    return [];
  }
  const companyOid = new mongoose.Types.ObjectId(raw);
  const parts: Record<string, unknown>[] = [];
  if (filterByUserId) {
    const userIdObj = new mongoose.Types.ObjectId(filterByUserId);
    parts.push({ $or: [{ driver: userIdObj }, { medic: userIdObj }] });
  }
  parts.push({ companyId: companyOid });
  const filter = parts.length > 1 ? { $and: parts } : parts[0] || {};

  const summaries = await WorkdaySummary.find(filter)
    .sort({ date: -1 })
    .populate("driver", "name lastName")
    .populate("medic", "name lastName")
    .lean();

  const diensts = await Dienst.find({ companyId: companyOid }).lean();

  const enriched = summaries.map((s: any) => {
    const dienst = diensts.find((d) =>
      d.assignments.some(
        (a) => a._id && a._id.toString() === s.assignmentId.toString(),
      ),
    );

    const assignment = dienst?.assignments.find(
      (a) => a._id && a._id.toString() === s.assignmentId.toString(),
    );

    return {
      ...s,
      dienstId: dienst?._id ?? null,
      dienstNumber: s.dienstNumber ?? dienst?.dienstNumber ?? null,
      startTime: s.startTime ?? assignment?.startTime ?? null,
      endTime: s.endTime ?? assignment?.endTime ?? null,
    };
  });

  return enriched;
}

/**
 * Mutación por id (summaries): aislamiento multiempresa.
 */
function assertCanMutateWorkdayEntityByCompany(
  documentCompanyId: unknown,
  callerCompanyId: string | null | undefined,
  forbiddenMessage: string,
): void {
  const callerCo =
    callerCompanyId != null && String(callerCompanyId).trim() !== ""
      ? String(callerCompanyId).trim()
      : "";
  if (!callerCo || !mongoose.Types.ObjectId.isValid(callerCo)) {
    throw new WorkdaySummaryError(forbiddenMessage, 403);
  }
  const docCoRaw = documentCompanyId != null ? String(documentCompanyId) : "";
  const docCo = docCoRaw !== "" ? docCoRaw : "";
  if (!docCo || docCo !== callerCo) {
    throw new WorkdaySummaryError(forbiddenMessage, 403);
  }
}

export async function getSummariesCountByStatus(status?: string, companyId?: string | null) {
  const rawStatus = typeof status === "string" ? status : "pending";
  const normalizedStatus = rawStatus.toLowerCase();

  const rawCo = typeof companyId === "string" ? companyId.trim() : "";
  if (!rawCo || !mongoose.Types.ObjectId.isValid(rawCo)) {
    return { count: 0 };
  }
  const companyFilter = { companyId: new mongoose.Types.ObjectId(rawCo) };

  let count = 0;

  if (normalizedStatus === "pending") {
    count = await WorkdaySummary.countDocuments({
      $and: [
        companyFilter,
        {
          $or: [
            { status: "pending" },
            { reviewStatus: "pending" },
            { isReviewed: false },
            {
              $and: [
                { reviewStatus: { $exists: false } },
                { isReviewed: { $exists: false } },
              ],
            },
          ],
        },
      ],
    });
  } else {
    count = await WorkdaySummary.countDocuments({
      $and: [
        companyFilter,
        { $or: [{ status: normalizedStatus }, { reviewStatus: normalizedStatus }] },
      ],
    });
  }

  return { count };
}

export async function markSummaryReviewed(id: string, companyId?: string | null) {
  if (!mongoose.isValidObjectId(id)) {
    throw new WorkdaySummaryError("ID inválido", 400);
  }
  const summary = await WorkdaySummary.findById(id).select("companyId driver medic date").lean();
  if (summary) {
    assertCanMutateWorkdayEntityByCompany(
      (summary as { companyId?: unknown }).companyId,
      companyId,
      "No tienes permiso para revisar este resumen",
    );
  }
  const updated = await WorkdaySummary.findByIdAndUpdate(
    id,
    { $set: { isReviewed: true, reviewedAt: new Date() } },
    { new: true },
  );

  if (!updated) {
    throw new WorkdaySummaryError("Resumen no encontrado", 404);
  }

  const recipientIds = [updated.driver?.toString(), updated.medic?.toString()].filter(
    (uid): uid is string => Boolean(uid),
  );
  if (recipientIds.length > 0) {
    void sendPushNotification(
      recipientIds,
      "Cierre de jornada revisado",
      `Tu cierre del ${updated.date} ha sido revisado por el administrador.`,
      { screen: "workday" },
    );
    const summaryCompanyId = (updated as { companyId?: unknown }).companyId;
    if (summaryCompanyId) {
      voidEmitWorkdayWorkerRefresh(recipientIds, String(summaryCompanyId));
    }
  }

  return updated;
}
