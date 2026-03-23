import mongoose from "mongoose";
import { Dienst } from "../../diensts";
import { Trip } from "../../trips";
import WorkdaySummary from "../models/workday-summary.model";
import WorkdayIssue from "../models/workday-issue.model";
import { calculateEffectivePatients } from "../utils/calculateEffectivePatients";

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

/* ─────────────────────────────
 * CIERRE COMPLETO DEL DÍA
 * ───────────────────────────── */
export async function createWorkdaySummary(body: Record<string, unknown>) {
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

  const assignmentObjectId = new mongoose.Types.ObjectId(assignmentId as string);
  const dienst = await Dienst.findOne({
    "assignments._id": assignmentObjectId,
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

  const dienstNumber = dienst?.dienstNumber ?? null;
  const startTime = assignment?.startTime ?? null;
  const endTime = assignment?.endTime ?? null;
  const { driver, medic } = assignment;

  const totalEffectivePatients = calculateEffectivePatients(
    sanitizedTrips,
    date as string,
  );
  const totalDienstKm = nFinalKm - nInitialKm;
  const totalRealTrips = sanitizedTrips.filter(
    (t: any) => !t.wasCancelled || t.cancelledAtPickup,
  ).length;

  const newSummary = await WorkdaySummary.create({
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
  });

  if (sanitizedTrips.length > 0) {
    const ids = sanitizedTrips.map((t: any) => t._id).filter(Boolean);
    if (ids.length > 0) {
      await Trip.updateMany(
        { _id: { $in: ids } },
        { $set: { sentInSummary: true } },
      );
    }
  }

  return newSummary;
}

/* ─────────────────────────────
 * CIERRE PARCIAL DEL DÍA
 * ───────────────────────────── */
export async function submitPartialClosure(body: Record<string, unknown>) {
  const {
    date,
    assignmentId,
    driver,
    medic,
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
  if (!driver) missing.push("driver");
  if (!medic) missing.push("medic");
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

  let dienstNumber: number | null = null;
  let startTime: string | null = null;
  let endTime: string | null = null;

  try {
    const assignmentObjectId = new mongoose.Types.ObjectId(assignmentId as string);
    const dienst = await Dienst.findOne({
      "assignments._id": assignmentObjectId,
    });
    const assignment = dienst?.assignments.find(
      (a) => a._id?.toString() === assignmentObjectId.toString(),
    );
    dienstNumber = dienst?.dienstNumber ?? null;
    startTime = assignment?.startTime ?? null;
    endTime = assignment?.endTime ?? null;
  } catch {
    // si no es ObjectId válido, seguimos sin bloquear
  }

  const totalEffectivePatients = calculateEffectivePatients(
    sanitizedTrips,
    date as string,
  );
  const totalDienstKm = nFinalKm - nInitialKm;
  const totalRealTrips = sanitizedTrips.filter(
    (t: any) => !t.wasCancelled || t.cancelledAtPickup,
  ).length;

  const summary = new WorkdaySummary({
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
  });

  await summary.save();

  if (sanitizedTrips.length > 0) {
    const ids = sanitizedTrips.map((t: any) => t._id).filter(Boolean);
    if (ids.length > 0) {
      await Trip.updateMany(
        { _id: { $in: ids } },
        { $set: { sentInSummary: true } },
      );
    }
  }

  return { message: "Cierre parcial guardado correctamente." };
}

/* ─────────────────────────────
 * GET TODOS LOS RESÚMENES
 * filterByUserId: si existe, filtra por driver o medic.
 * ───────────────────────────── */
export async function getAllWorkdaySummaries(filterByUserId?: string) {
  const filter: Record<string, unknown> = {};
  if (filterByUserId) {
    const userIdObj = new mongoose.Types.ObjectId(filterByUserId);
    filter.$or = [
      { driver: userIdObj },
      { medic: userIdObj },
    ];
  }

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

  const diensts = await Dienst.find().lean();

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
 * ───────────────────────────── */
export async function reportIssue(body: Record<string, unknown>) {
  const {
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
    driver,
    medic,
  } = body;

  if (
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

  if (driver && !mongoose.isValidObjectId(driver as string)) {
    throw new WorkdaySummaryError("driver no es un ObjectId válido", 400);
  }

  if (medic && !mongoose.isValidObjectId(medic as string)) {
    throw new WorkdaySummaryError("medic no es un ObjectId válido", 400);
  }

  const newIssue = await WorkdayIssue.create({
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
    driver,
    medic,
  });

  return newIssue;
}

export async function getAllIssueReports() {
  return await WorkdayIssue.find().sort({ timestamp: -1 });
}

export async function deleteIssueReport(id: string) {
  if (!mongoose.isValidObjectId(id)) {
    throw new WorkdaySummaryError("ID inválido", 400);
  }

  const deleted = await WorkdayIssue.findByIdAndDelete(id);
  if (!deleted) {
    throw new WorkdaySummaryError("Reporte no encontrado", 404);
  }

  return { message: "Reporte eliminado correctamente" };
}

export async function markIssueSeen(id: string) {
  if (!mongoose.isValidObjectId(id)) {
    throw new WorkdaySummaryError("ID inválido", 400);
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

export async function getIssuesCount(status?: string) {
  const rawStatus = typeof status === "string" ? status : "open";
  const normalizedStatus = rawStatus.toLowerCase();

  let filter: Record<string, unknown> = {};

  if (normalizedStatus === "open") {
    filter = { isSeen: { $ne: true } };
  } else if (normalizedStatus === "seen" || normalizedStatus === "closed") {
    filter = { isSeen: true };
  } else {
    filter = {};
  }

  const count = await WorkdayIssue.countDocuments(filter);
  return { count };
}

export async function getSummariesCountByStatus(status?: string) {
  const rawStatus = typeof status === "string" ? status : "pending";
  const normalizedStatus = rawStatus.toLowerCase();

  let count = 0;

  if (normalizedStatus === "pending") {
    count = await WorkdaySummary.countDocuments({
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
    });
  } else {
    count = await WorkdaySummary.countDocuments({
      $or: [{ status: normalizedStatus }, { reviewStatus: normalizedStatus }],
    });
  }

  return { count };
}

export async function markSummaryReviewed(id: string) {
  if (!mongoose.isValidObjectId(id)) {
    throw new WorkdaySummaryError("ID inválido", 400);
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
