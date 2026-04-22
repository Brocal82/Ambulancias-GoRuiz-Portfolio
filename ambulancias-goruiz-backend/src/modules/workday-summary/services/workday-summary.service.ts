import mongoose from "mongoose";
import { Dienst } from "../../diensts";
import type { IDienst, IDienstAssignment } from "../../diensts";
import { Trip } from "../../trips";
import WorkdaySummary from "../models/workday-summary.model";
import type { IWorkdaySummary } from "../models/workday-summary.model";
import WorkdayIssue from "../models/workday-issue.model";
import { calculateEffectivePatients } from "../utils/calculateEffectivePatients";

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

/** Error con código HTTP para mapeo en controller */
export class WorkdaySummaryError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = "WorkdaySummaryError";
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
    throw new WorkdaySummaryError("No autorizado para cerrar este assignment", 403);
  }
  const assignmentObjectId = new mongoose.Types.ObjectId(assignmentId);
  const companyOid = new mongoose.Types.ObjectId(raw);
  const dienst = await Dienst.findOne({
    "assignments._id": assignmentObjectId,
    companyId: companyOid,
  });

  if (!dienst) {
    throw new WorkdaySummaryError(
      "Dienst no encontrado con ese assignmentId",
      404,
    );
  }

  const assignment = dienst.assignments.find(
    (a) => a._id?.toString() === assignmentObjectId.toString(),
  );
  if (!assignment) {
    throw new WorkdaySummaryError("Asignación no encontrada", 404);
  }

  return { dienst, assignment };
}

/** Verifica que el usuario pueda cerrar este assignment. Admin: mismo companyId. Worker: participante y mismo companyId. */
function assertUserCanCloseAssignment(
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
    throw new WorkdaySummaryError("No autorizado para cerrar este assignment", 403);
  }
  const dienstCompanyStr = dienst.companyId ? String(dienst.companyId) : "";
  if (!dienstCompanyStr || dienstCompanyStr !== callerCo) {
    throw new WorkdaySummaryError("No autorizado para cerrar este assignment", 403);
  }

  if (userRole === "admin") {
    return;
  }

  const driverStr = assignment.driver?.toString();
  const medicStr = assignment.medic?.toString();
  const isParticipant = driverStr === userId || medicStr === userId;
  if (!isParticipant) {
    throw new WorkdaySummaryError("No autorizado para cerrar este assignment", 403);
  }
}

/** Valida que todos los trips pertenecen al assignment. Lanza si no. */
async function validateTripsBelongToAssignment(
  tripIds: string[],
  assignmentId: string,
): Promise<void> {
  if (!tripIds || tripIds.length === 0) return;

  const assignmentObjId = new mongoose.Types.ObjectId(assignmentId);
  const hex24 = /^[0-9a-fA-F]{24}$/;
  const validIds = tripIds.filter(
    (id) => typeof id === "string" && hex24.test(String(id).trim()),
  );
  if (validIds.length !== tripIds.length) {
    throw new WorkdaySummaryError("Uno o más tripIds no son válidos", 400);
  }

  const objectIds = validIds.map((id) => new mongoose.Types.ObjectId(id));
  const trips = await Trip.find({ _id: { $in: objectIds } })
    .select("_id assignmentId")
    .lean();

  if (trips.length !== tripIds.length) {
    throw new WorkdaySummaryError("Algún trip no existe", 404);
  }

  for (const trip of trips) {
    const tripAssignmentId =
      (trip.assignmentId as mongoose.Types.ObjectId)?.toString?.() ??
      String(trip.assignmentId);
    if (tripAssignmentId !== assignmentObjId.toString()) {
      throw new WorkdaySummaryError(
        `Trip ${trip._id} no pertenece a este assignment`,
        403,
      );
    }
  }
}

/* ─────────────────────────────
 * CIERRE COMPLETO DEL DÍA
 * Admin: puede continuar (mismo companyId). Worker: solo si participa.
 * ───────────────────────────── */
export async function createWorkdaySummary(
  body: Record<string, unknown>,
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
    trips,
    extraNote,
  } = body;

  const missing: string[] = [];
  if (!date) missing.push("date");
  if (!assignmentId) missing.push("assignmentId");
  if (!ambulanceId) missing.push("ambulanceId");
  if (initialKm === undefined) missing.push("initialKm");
  if (finalKm === undefined) missing.push("finalKm");
  if (!Array.isArray(trips)) missing.push("trips (debe ser array)");

  if (missing.length) {
    throw new WorkdaySummaryError(
      `Faltan campos obligatorios: ${missing.join(", ")}`,
      400,
    );
  }

  const nInitialKm: number =
    typeof initialKm === "string" ? Number(initialKm) : (initialKm as number);
  const nFinalKm: number =
    typeof finalKm === "string" ? Number(finalKm) : (finalKm as number);

  const sanitizedTrips = (trips as any[]).map((t) => ({
    ...t,
    wasCancelled: !!t.wasCancelled,
    cancelledAtPickup: !!t.cancelledAtPickup,
    countsTrip:
      typeof t.countsTrip === "number" ? (t.countsTrip === 1 ? 1 : 0) : 1,
  }));

  const scopeCo =
    userCompanyId != null && String(userCompanyId).trim() !== ""
      ? String(userCompanyId).trim()
      : "";
  const { dienst, assignment } = await resolveAssignmentByAssignmentId(
    assignmentId as string,
    scopeCo,
  );
  assertUserCanCloseAssignment(dienst as any, assignment, userId, userRole, userCompanyId);

  const tripIds = sanitizedTrips.map((t: { _id?: unknown }) => t._id).filter(Boolean);
  const tripIdStrs = tripIds.map((id: unknown) => String(id));
  await validateTripsBelongToAssignment(tripIdStrs, assignmentId as string);

  const dienstNumber = dienst?.dienstNumber ?? null;
  const startTime = assignment?.startTime ?? null;
  const endTime = assignment?.endTime ?? null;
  const { driver, medic } = assignment;
  const dienstCompanyId = (dienst as any).companyId;

  const totalEffectivePatients = calculateEffectivePatients(
    sanitizedTrips,
    date as string,
  );
  const totalDienstKm = nFinalKm - nInitialKm;
  /** Viajes que cuentan: `countsTrip === 1` (incl. storno/cancelados marcados como que cuentan). */
  const totalRealTrips = sanitizedTrips.filter(
    (t: { countsTrip?: unknown }) => t.countsTrip === 1,
  ).length;

  const summaryDoc = {
    date,
    assignmentId,
    ambulanceId,
    ambulanceNumber,
    driver,
    medic,
    initialKm: nInitialKm,
    finalKm: nFinalKm,
    totalDienstKm,
    trips: sanitizedTrips,
    extraNote,
    isFinalClosure: true,
    totalEffectivePatients,
    totalRealTrips,
    dienstNumber,
    startTime,
    endTime,
    ...(dienstCompanyId && { companyId: dienstCompanyId }),
  };

  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const created = await WorkdaySummary.create([summaryDoc], { session });
      const newSummary = created[0] as IWorkdaySummary;
      if (sanitizedTrips.length > 0) {
        const ids = sanitizedTrips.map((t: any) => t._id).filter(Boolean);
        if (ids.length > 0) {
          await Trip.updateMany(
            { _id: { $in: ids } },
            { $set: { sentInSummary: true } },
            { session },
          );
        }
      }
      return newSummary;
    });
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
  body: Record<string, unknown>,
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
    trips,
    partialClosureReason,
  } = body;

  const missing: string[] = [];
  if (!date) missing.push("date");
  if (!assignmentId) missing.push("assignmentId");
  if (!ambulanceId) missing.push("ambulanceId");
  if (initialKm === undefined) missing.push("initialKm");
  if (finalKm === undefined) missing.push("finalKm");
  if (!Array.isArray(trips)) missing.push("trips (debe ser array)");
  if (
    !partialClosureReason ||
    (typeof partialClosureReason === "string" &&
      partialClosureReason.trim() === "")
  ) {
    missing.push("partialClosureReason");
  }
  if (missing.length) {
    throw new WorkdaySummaryError(
      `Faltan campos: ${missing.join(", ")}`,
      400,
    );
  }

  const nInitialKm: number =
    typeof initialKm === "string" ? Number(initialKm) : (initialKm as number);
  const nFinalKm: number =
    typeof finalKm === "string" ? Number(finalKm) : (finalKm as number);

  const sanitizedTrips = (trips as any[]).map((t) => ({
    ...t,
    wasCancelled: !!t.wasCancelled,
    cancelledAtPickup: !!t.cancelledAtPickup,
    countsTrip:
      typeof t.countsTrip === "number" ? (t.countsTrip === 1 ? 1 : 0) : 1,
  }));

  const scopeCo =
    userCompanyId != null && String(userCompanyId).trim() !== ""
      ? String(userCompanyId).trim()
      : "";
  const { dienst, assignment } = await resolveAssignmentByAssignmentId(
    assignmentId as string,
    scopeCo,
  );
  assertUserCanCloseAssignment(dienst as any, assignment, userId, userRole, userCompanyId);

  const tripIds = sanitizedTrips.map((t: { _id?: unknown }) => t._id).filter(Boolean);
  const tripIdStrs = tripIds.map((id: unknown) => String(id));
  await validateTripsBelongToAssignment(tripIdStrs, assignmentId as string);

  const dienstNumber = dienst?.dienstNumber ?? null;
  const startTime = assignment?.startTime ?? null;
  const endTime = assignment?.endTime ?? null;
  const { driver, medic } = assignment;
  const dienstCompanyId = (dienst as any).companyId;

  const totalEffectivePatients = calculateEffectivePatients(
    sanitizedTrips,
    date as string,
  );
  const totalDienstKm = nFinalKm - nInitialKm;
  const totalRealTrips = sanitizedTrips.filter(
    (t: { countsTrip?: unknown }) => t.countsTrip === 1,
  ).length;

  const summaryDoc = {
    date,
    assignmentId,
    driver,
    medic,
    ambulanceId,
    ambulanceNumber,
    initialKm: nInitialKm,
    finalKm: nFinalKm,
    totalDienstKm,
    trips: sanitizedTrips,
    partialClosureReason:
      typeof partialClosureReason === "string"
        ? partialClosureReason.trim()
        : partialClosureReason,
    isFinalClosure: false,
    totalEffectivePatients,
    totalRealTrips,
    dienstNumber,
    startTime,
    endTime,
    ...(dienstCompanyId && { companyId: dienstCompanyId }),
  };

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const summary = new WorkdaySummary(summaryDoc);
      await summary.save({ session });
      if (sanitizedTrips.length > 0) {
        const ids = sanitizedTrips.map((t: any) => t._id).filter(Boolean);
        if (ids.length > 0) {
          await Trip.updateMany(
            { _id: { $in: ids } },
            { $set: { sentInSummary: true } },
            { session },
          );
        }
      }
    });
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
    .populate({
      path: "trips",
      select:
        "auftragNumber wasCancelled cancelledAtPickup countsTrip kmStart kmEnd timeWarning timeAtHome timePickup timeArrival timeEnd fromAddress toAddress patientName reports",
    })
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

/* ─────────────────────────────
 * AVERÍAS
 * driver/medic se obtienen del assignment en BD, nunca del body.
 * ───────────────────────────── */
export async function reportIssue(
  body: Record<string, unknown>,
  userId: string,
  userRole: string,
  userCompanyId?: string | null,
) {
  const {
    assignmentId,
    dienstNumber,
    date,
    startTime,
    endTime,
    team,
    ambulanceNumber,
    ambulanceId,
    finalKm,
    timestamp,
    issueText,
    driver: _bodyDriver,
    medic: _bodyMedic,
  } = body;
  if (_bodyDriver !== undefined || _bodyMedic !== undefined) {
    console.warn(
      "[report-issue] driver/medic del body ignorados; se usan los del assignment",
    );
  }

  if (
    !assignmentId ||
    !dienstNumber ||
    !ambulanceNumber ||
    !ambulanceId ||
    !timestamp ||
    !issueText
  ) {
    throw new WorkdaySummaryError(
      "Faltan datos obligatorios para reporte de avería.",
      400,
    );
  }

  const scopeCo =
    userCompanyId != null && String(userCompanyId).trim() !== ""
      ? String(userCompanyId).trim()
      : "";
  const { dienst, assignment } = await resolveAssignmentByAssignmentId(
    assignmentId as string,
    scopeCo,
  );
  assertUserCanCloseAssignment(dienst as any, assignment, userId, userRole, userCompanyId);

  const { driver, medic } = assignment;
  const dienstCompanyId = (dienst as any).companyId;

  const newIssue = await WorkdayIssue.create({
    dienstNumber: dienst.dienstNumber,
    date,
    startTime,
    endTime,
    team,
    ambulanceNumber,
    ambulanceId,
    finalKm,
    timestamp,
    issueText,
    driver,
    medic,
    ...(dienstCompanyId && { companyId: dienstCompanyId }),
  });

  return newIssue;
}

/**
 * Mutación por id (issues / summaries): aislamiento multiempresa.
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

export async function getAllIssueReports(companyId?: string | null) {
  const raw = typeof companyId === "string" ? companyId.trim() : "";
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) {
    return [];
  }
  const filter = { companyId: new mongoose.Types.ObjectId(raw) };
  return await WorkdayIssue.find(filter).sort({ timestamp: -1 });
}

export async function deleteIssueReport(id: string, companyId?: string | null) {
  if (!mongoose.isValidObjectId(id)) {
    throw new WorkdaySummaryError("ID inválido", 400);
  }
  const issue = await WorkdayIssue.findById(id).select("companyId").lean();
  if (issue) {
    assertCanMutateWorkdayEntityByCompany(
      (issue as { companyId?: unknown }).companyId,
      companyId,
      "No tienes permiso para eliminar este reporte",
    );
  }
  const deleted = await WorkdayIssue.findByIdAndDelete(id);
  if (!deleted) {
    throw new WorkdaySummaryError("Reporte no encontrado", 404);
  }

  return { message: "Reporte eliminado correctamente" };
}

export async function markIssueSeen(id: string, companyId?: string | null) {
  if (!mongoose.isValidObjectId(id)) {
    throw new WorkdaySummaryError("ID inválido", 400);
  }
  const issue = await WorkdayIssue.findById(id).select("companyId").lean();
  if (issue) {
    assertCanMutateWorkdayEntityByCompany(
      (issue as { companyId?: unknown }).companyId,
      companyId,
      "No tienes permiso para marcar este reporte",
    );
  }
  const updated = await WorkdayIssue.findByIdAndUpdate(
    id,
    { $set: { isSeen: true, seenAt: new Date() } },
    { new: true },
  );

  if (!updated) {
    throw new WorkdaySummaryError("Avería no encontrada", 404);
  }

  return updated;
}

export async function getIssuesCount(status?: string, companyId?: string | null) {
  const rawStatus = typeof status === "string" ? status : "open";
  const normalizedStatus = rawStatus.toLowerCase();

  let statusFilter: Record<string, unknown> = {};
  if (normalizedStatus === "open") {
    statusFilter = { isSeen: { $ne: true } };
  } else if (normalizedStatus === "seen" || normalizedStatus === "closed") {
    statusFilter = { isSeen: true };
  }
  const rawCo = typeof companyId === "string" ? companyId.trim() : "";
  if (!rawCo || !mongoose.Types.ObjectId.isValid(rawCo)) {
    return { count: 0 };
  }
  const companyFilter = { companyId: new mongoose.Types.ObjectId(rawCo) };
  const filter =
    Object.keys(statusFilter).length > 0
      ? { $and: [statusFilter, companyFilter] }
      : companyFilter;

  const count = await WorkdayIssue.countDocuments(filter);
  return { count };
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
  const summary = await WorkdaySummary.findById(id).select("companyId").lean();
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

  return updated;
}
