import { Request, Response } from "express";
import mongoose from "mongoose";
import { requireCompanyForAdmin } from "../../../utils/requireCompany";
import { WorkdaySummaryError } from "../../../utils/assignmentClosure";
import {
  reportIssue as svcReportIssue,
  getAllIssueReports as svcGetAllIssueReports,
  deleteIssueReport as svcDeleteIssueReport,
  markIssueSeen as svcMarkIssueSeen,
  getIssuesCount as svcGetIssuesCount,
} from "../services/mechanics.service";

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

export const reportIssue = async (req: Request, res: Response): Promise<void> => {
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
      "❌ Error reportIssue (mechanics):",
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

export const deleteIssueReport = async (
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
    const { id } = req.params;
    const result = await svcDeleteIssueReport(id, rawCompanyId);
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

export const markIssueSeen = async (req: Request, res: Response): Promise<void> => {
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
    const { id } = req.params;
    const updated = await svcMarkIssueSeen(id, rawCompanyId);
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

export const getIssuesCount = async (req: Request, res: Response): Promise<void> => {
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
