import mongoose from "mongoose";
import path from "path";
import fs from "fs/promises";
import MechanicsIssue from "../models/mechanics-issue.model";
import {
  WorkdaySummaryError,
  resolveAssignmentByAssignmentId,
  assertUserCanCloseAssignment,
} from "../../../utils/assignmentClosure";
import { getAmbulanceById } from "../../ambulances/services/ambulances.service";
import { unlinkMulterFiles } from "../../../utils/unlinkUploadedFiles";

const uploadsDir = path.join(__dirname, "../../../../uploads");

type MechanicsAttachmentInput = {
  url: string;
  originalName: string;
  mimetype: string;
  size: number;
  storedFilename: string;
};

function buildAttachmentsFromFiles(
  files: Express.Multer.File[] | undefined,
): MechanicsAttachmentInput[] {
  if (!files?.length) return [];
  return files.map((file) => ({
    url: `/uploads/${file.filename}`,
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    storedFilename: file.filename,
  }));
}

async function unlinkIssueAttachments(
  attachments: MechanicsAttachmentInput[] | undefined,
): Promise<void> {
  if (!attachments?.length) return;
  for (const a of attachments) {
    const url = typeof a.url === "string" ? a.url : "";
    if (!url.startsWith("/uploads/")) continue;
    const basename = path.basename(url);
    if (!basename || basename.includes("..")) continue;
    const fullPath = path.join(uploadsDir, basename);
    try {
      await fs.unlink(fullPath);
    } catch (err: unknown) {
      const code = err && typeof err === "object" && "code" in err ? (err as { code?: string }).code : "";
      if (code !== "ENOENT") {
        console.warn("[mechanics] no se pudo borrar adjunto:", fullPath, err);
      }
    }
  }
}

function resolveCallerCompanyOid(
  companyId: string | null | undefined,
  forbiddenMessage: string,
): mongoose.Types.ObjectId {
  const callerCo =
    companyId != null && String(companyId).trim() !== ""
      ? String(companyId).trim()
      : "";
  if (!callerCo || !mongoose.Types.ObjectId.isValid(callerCo)) {
    throw new WorkdaySummaryError(forbiddenMessage, 403);
  }
  return new mongoose.Types.ObjectId(callerCo);
}

export async function reportIssue(
  body: Record<string, unknown>,
  files: Express.Multer.File[] | undefined,
  userId: string,
  userRole: string,
  userCompanyId?: string | null,
) {
  try {
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

    if (!assignmentId || !dienstNumber || !timestamp || !issueText) {
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

    let resolvedAmbulanceId: string | undefined;
    if (
      typeof ambulanceId === "string" &&
      mongoose.Types.ObjectId.isValid(ambulanceId)
    ) {
      resolvedAmbulanceId = ambulanceId;
    }
    if (!resolvedAmbulanceId && assignment.ambulanceId) {
      resolvedAmbulanceId = assignment.ambulanceId.toString();
    }

    if (resolvedAmbulanceId) {
      const ambulance = await getAmbulanceById(resolvedAmbulanceId, scopeCo);
      if (!ambulance) {
        throw new WorkdaySummaryError("La ambulancia no pertenece a tu empresa", 403);
      }
    }

    let resolvedAmbulanceNumber = String(ambulanceNumber ?? "").trim();
    if (!resolvedAmbulanceNumber) {
      resolvedAmbulanceNumber = "—";
    }

    const { driver, medic } = assignment;
    const dienstCompanyIdRaw = (dienst as { companyId?: unknown }).companyId;
    const dienstCompanyId =
      dienstCompanyIdRaw != null ? String(dienstCompanyIdRaw).trim() : "";
    if (!dienstCompanyId || !mongoose.Types.ObjectId.isValid(dienstCompanyId)) {
      throw new WorkdaySummaryError(
        "No se puede registrar la avería: el turno no tiene empresa asociada.",
        403,
      );
    }

    const attachments = buildAttachmentsFromFiles(files);

    const newIssue = await MechanicsIssue.create({
      dienstNumber: dienst.dienstNumber,
      date,
      startTime,
      endTime,
      team,
      ambulanceNumber: resolvedAmbulanceNumber,
      ...(resolvedAmbulanceId ? { ambulanceId: resolvedAmbulanceId } : {}),
      finalKm,
      timestamp,
      issueText,
      driver,
      medic,
      ...(attachments.length > 0 ? { attachments } : {}),
      companyId: new mongoose.Types.ObjectId(dienstCompanyId),
    });

    return newIssue;
  } catch (err) {
    await unlinkMulterFiles(files);
    throw err;
  }
}

export async function getAllIssueReports(companyId?: string | null) {
  const raw = typeof companyId === "string" ? companyId.trim() : "";
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) {
    return [];
  }
  const filter = { companyId: new mongoose.Types.ObjectId(raw) };
  return await MechanicsIssue.find(filter).sort({ timestamp: -1 });
}

export async function getIssueReportsByWorker(
  userId: string,
  companyId?: string | null,
  date?: string,
) {
  const raw = typeof companyId === "string" ? companyId.trim() : "";
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) {
    return [];
  }
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return [];
  }
  const baseFilter: Record<string, unknown> = {
    companyId: new mongoose.Types.ObjectId(raw),
    $or: [
      { driver: new mongoose.Types.ObjectId(userId) },
      { medic: new mongoose.Types.ObjectId(userId) },
    ],
  };
  if (typeof date === "string" && date.trim() !== "") {
    baseFilter.date = date.trim();
  }
  return await MechanicsIssue.find(baseFilter).sort({ timestamp: -1 });
}

export async function deleteIssueReport(id: string, companyId?: string | null) {
  if (!mongoose.isValidObjectId(id)) {
    throw new WorkdaySummaryError("ID inválido", 400);
  }
  const companyOid = resolveCallerCompanyOid(
    companyId,
    "No tienes permiso para eliminar este reporte",
  );

  const deleted = await MechanicsIssue.findOneAndDelete({
    _id: id,
    companyId: companyOid,
  });
  if (deleted) {
    const rawAtt = (deleted as { attachments?: MechanicsAttachmentInput[] })
      .attachments;
    await unlinkIssueAttachments(rawAtt);
    return { message: "Reporte eliminado correctamente" };
  }

  const exists = await MechanicsIssue.findById(id).select("companyId").lean();
  if (exists) {
    throw new WorkdaySummaryError(
      "No tienes permiso para eliminar este reporte",
      403,
    );
  }
  throw new WorkdaySummaryError("Reporte no encontrado", 404);
}

export async function markIssueSeen(id: string, companyId?: string | null) {
  if (!mongoose.isValidObjectId(id)) {
    throw new WorkdaySummaryError("ID inválido", 400);
  }
  const companyOid = resolveCallerCompanyOid(
    companyId,
    "No tienes permiso para marcar este reporte",
  );

  const updated = await MechanicsIssue.findOneAndUpdate(
    { _id: id, companyId: companyOid },
    { $set: { isSeen: true, seenAt: new Date() } },
    { new: true },
  );

  if (updated) {
    return updated;
  }

  const exists = await MechanicsIssue.findById(id).select("companyId").lean();
  if (exists) {
    throw new WorkdaySummaryError(
      "No tienes permiso para marcar este reporte",
      403,
    );
  }
  throw new WorkdaySummaryError("Avería no encontrada", 404);
}

export async function getIssuesCount(
  status?: string,
  companyId?: string | null,
) {
  const rawStatus = typeof status === "string" ? status.trim().toLowerCase() : "open";
  const allowedStatuses = new Set(["open", "seen", "closed"]);
  if (!allowedStatuses.has(rawStatus)) {
    throw new WorkdaySummaryError(
      "status inválido; valores permitidos: open, seen, closed",
      400,
    );
  }

  let statusFilter: Record<string, unknown> = {};
  if (rawStatus === "open") {
    statusFilter = { isSeen: { $ne: true } };
  } else {
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

  const count = await MechanicsIssue.countDocuments(filter);
  return { count };
}
