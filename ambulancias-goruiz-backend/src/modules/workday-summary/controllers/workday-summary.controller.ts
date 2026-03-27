import { Request, Response } from "express";
import mongoose from "mongoose";
import { requireCompanyForAdmin } from "../../../utils/requireCompany";
import {
  WorkdaySummaryError,
  createWorkdaySummary as svcCreateWorkdaySummary,
  submitPartialClosure as svcSubmitPartialClosure,
  getAllWorkdaySummaries as svcGetAllWorkdaySummaries,
  reportIssue as svcReportIssue,
  getAllIssueReports as svcGetAllIssueReports,
  deleteIssueReport as svcDeleteIssueReport,
  markIssueSeen as svcMarkIssueSeen,
  getIssuesCount as svcGetIssuesCount,
  getSummariesCountByStatus as svcGetSummariesCountByStatus,
  markSummaryReviewed as svcMarkSummaryReviewed,
} from "../services/workday-summary.service";

function handleError(
  error: unknown,
  res: Response,
  fallbackMsg: string,
  logLabel: string,
): void {
  if (error instanceof WorkdaySummaryError) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }
  console.error(logLabel, error);
  res.status(500).json({ message: fallbackMsg });
}

/* ─────────────────────────────
 * CIERRE COMPLETO DEL DÍA
 * Admin: puede si dienst misma empresa. Worker: solo si participa.
 * Servicio valida companyId cuando aplica.
 * ───────────────────────────── */
export const createWorkdaySummary = async (
  req: Request,
  res: Response,
): Promise<void> => {
  if (req.userRole === "worker" && !req.userId) {
    res.status(401).json({ message: "No autorizado" });
    return;
  }
  try {
    const newSummary = await svcCreateWorkdaySummary(
      req.body,
      req.userId ?? "",
      req.userRole ?? "",
      req.companyId ?? null,
    );
    res.status(201).json(newSummary);
  } catch (error) {
    handleError(
      error,
      res,
      "Error al guardar el resumen del día",
      "❌ Error al guardar resumen del día:",
    );
  }
};

/* ─────────────────────────────
 * CIERRE PARCIAL DEL DÍA
 * Admin: puede si dienst misma empresa. Worker: solo si participa.
 * ───────────────────────────── */
export const submitPartialClosure = async (
  req: Request,
  res: Response,
): Promise<void> => {
  if (req.userRole === "worker" && !req.userId) {
    res.status(401).json({ message: "No autorizado" });
    return;
  }
  try {
    const result = await svcSubmitPartialClosure(
      req.body,
      req.userId ?? "",
      req.userRole ?? "",
      req.companyId ?? null,
    );
    res.status(201).json(result);
  } catch (error) {
    handleError(
      error,
      res,
      "Error al guardar el cierre parcial.",
      "❌ Error al guardar cierre parcial:",
    );
  }
};

/* ─────────────────────────────
 * GET TODOS LOS RESÚMENES
 * Admin: filtra por companyId si tiene; legacy si no. Worker: solo donde participa.
 * ───────────────────────────── */
export const getAllWorkdaySummaries = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const rawCompanyId =
    typeof req.companyId === "string" ? req.companyId.trim() : "";
  if (!rawCompanyId || !mongoose.Types.ObjectId.isValid(rawCompanyId)) {
    res.status(403).json({
      message: "No tienes permiso. Se requiere un contexto de empresa válido.",
    });
    return;
  }

  const filterByUserId =
    req.userRole === "admin" ? undefined : (req.userId ?? undefined);

  if (req.userRole === "worker" && !filterByUserId) {
    res.status(401).json({ message: "No autorizado" });
    return;
  }

  try {
    const enriched = await svcGetAllWorkdaySummaries(filterByUserId, rawCompanyId);
    res.status(200).json(enriched);
  } catch (error) {
    handleError(
      error,
      res,
      "Error al obtener los resúmenes.",
      "❌ Error al obtener resúmenes:",
    );
  }
};

/* ─────────────────────────────
 * AVERÍAS
 * ───────────────────────────── */
export const reportIssue = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const newIssue = await svcReportIssue(
      req.body,
      req.userId ?? "",
      req.userRole ?? "",
      req.companyId ?? null,
    );
    res.status(201).json(newIssue);
  } catch (error) {
    handleError(
      error,
      res,
      "Error interno al generar reporte de avería.",
      "❌ Error reportIssue:",
    );
  }
};

export const getAllIssueReports = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const companyResult = requireCompanyForAdmin(req);
    if (!companyResult.ok) {
      res.status(companyResult.statusCode).json({ message: companyResult.message });
      return;
    }
    const rawCompanyId = companyResult.companyId.trim();
    if (!rawCompanyId || !mongoose.Types.ObjectId.isValid(rawCompanyId)) {
      res.status(403).json({
        message: "No tienes permiso. Se requiere un contexto de empresa válido.",
      });
      return;
    }
    const issues = await svcGetAllIssueReports(rawCompanyId);
    res.status(200).json(issues);
  } catch (error) {
    handleError(
      error,
      res,
      "Error al obtener reportes técnicos",
      "❌ Error al obtener reportes técnicos:",
    );
  }
};

/* ─────────────────────────────
 * AVERÍAS: BORRAR REPORTE
 * ───────────────────────────── */
export const deleteIssueReport = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await svcDeleteIssueReport(id, req.companyId ?? null);
    res.status(200).json(result);
  } catch (error) {
    handleError(
      error,
      res,
      "Error al eliminar el reporte técnico",
      "❌ Error al eliminar reporte técnico:",
    );
  }
};

/* ─────────────────────────────
 * AVERÍAS: MARCAR COMO VISTAS
 * ───────────────────────────── */
export const markIssueSeen = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const updated = await svcMarkIssueSeen(id, req.companyId ?? null);
    res.status(200).json(updated);
  } catch (error) {
    handleError(
      error,
      res,
      "Error al marcar la avería como vista",
      "❌ Error al marcar avería como vista:",
    );
  }
};

/* ─────────────────────────────
 * AVERÍAS: CONTADOR (redefinido con isSeen)
 * ───────────────────────────── */
export const getIssuesCount = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const companyResult = requireCompanyForAdmin(req);
    if (!companyResult.ok) {
      res.status(companyResult.statusCode).json({ message: companyResult.message });
      return;
    }
    const rawCompanyId = companyResult.companyId.trim();
    if (!rawCompanyId || !mongoose.Types.ObjectId.isValid(rawCompanyId)) {
      res.status(403).json({
        message: "No tienes permiso. Se requiere un contexto de empresa válido.",
      });
      return;
    }
    const status =
      typeof req.query.status === "string" ? req.query.status : undefined;
    const result = await svcGetIssuesCount(status, rawCompanyId);
    res.status(200).json(result);
  } catch (error) {
    handleError(
      error,
      res,
      "Error al contar averías",
      "❌ Error al contar averías:",
    );
  }
};

/* ─────────────────────────────
 * SUMMARIES: CONTADOR POR ESTADO (se mantiene igual)
 * ───────────────────────────── */
export const getSummariesCountByStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const companyResult = requireCompanyForAdmin(req);
    if (!companyResult.ok) {
      res.status(companyResult.statusCode).json({ message: companyResult.message });
      return;
    }
    const rawCompanyId = companyResult.companyId.trim();
    if (!rawCompanyId || !mongoose.Types.ObjectId.isValid(rawCompanyId)) {
      res.status(403).json({
        message: "No tienes permiso. Se requiere un contexto de empresa válido.",
      });
      return;
    }
    const status =
      typeof req.query.status === "string" ? req.query.status : undefined;
    const result = await svcGetSummariesCountByStatus(
      status,
      rawCompanyId,
    );
    res.status(200).json(result);
  } catch (error) {
    handleError(
      error,
      res,
      "Error al contar resúmenes",
      "❌ Error al contar summaries por estado:",
    );
  }
};

/**
 * PATCH /workday-summary/:id/review
 * Marca el resumen como revisado (isReviewed=true) y setea reviewedAt=now.
 * Responde el documento actualizado.
 */
export const markSummaryReviewed = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const updated = await svcMarkSummaryReviewed(id, req.companyId ?? null);
    res.status(200).json(updated);
  } catch (error) {
    handleError(
      error,
      res,
      "Error al marcar resumen como revisado",
      "❌ Error al marcar resumen como revisado:",
    );
  }
};
