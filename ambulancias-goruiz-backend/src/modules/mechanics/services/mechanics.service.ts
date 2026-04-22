import mongoose from "mongoose";
import WorkdayIssue from "../models/workday-issue.model";
import {
  WorkdaySummaryError,
  resolveAssignmentByAssignmentId,
  assertUserCanCloseAssignment,
} from "../../workday-summary/utils/closureAuthorization";

function assertCanMutateIssueByCompany(
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
    assertCanMutateIssueByCompany(
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
    assertCanMutateIssueByCompany(
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
