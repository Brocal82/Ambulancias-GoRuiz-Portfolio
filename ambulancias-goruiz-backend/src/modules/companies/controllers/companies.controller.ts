import { Request, Response } from "express";
import * as companiesService from "../services/companies.service";
import { createCompanySchema, updateCompanySchema } from "../schemas/company.schema";
import {
  verifySuperadminStepUpSessionToken,
  verifySuperadminTotpCode,
} from "../../users/services/users.service";
import { AUDIT_EVENT } from "../../../security/audit-events";
import {
  buildAuditContextFromRequest,
  emitAuditLog,
} from "../../../security/audit-log";

function readStepUpCode(req: Request): string {
  const fromBody = typeof req.body?.stepUpCode === "string" ? req.body.stepUpCode : "";
  const fromHeader = typeof req.headers["x-step-up-code"] === "string"
    ? req.headers["x-step-up-code"]
    : "";
  return String(fromBody || fromHeader || "").trim();
}

function readStepUpToken(req: Request): string {
  const fromHeader = typeof req.headers["x-step-up-token"] === "string"
    ? req.headers["x-step-up-token"]
    : "";
  const fromBody = typeof req.body?.stepUpToken === "string" ? req.body.stepUpToken : "";
  return String(fromHeader || fromBody || "").trim();
}

async function ensureStepUpForCriticalCompanyAction(
  req: Request,
  auditContext: ReturnType<typeof buildAuditContextFromRequest>,
  action: "delete_company" | "sensitive_update",
  resourceId: string,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  try {
    const actorUserId = req.userId;
    if (!actorUserId) {
      return { ok: false, status: 401, message: "No autorizado" };
    }
    const stepUpToken = readStepUpToken(req);
    if (stepUpToken) {
      await verifySuperadminStepUpSessionToken(actorUserId, stepUpToken);
      return { ok: true };
    }
    await verifySuperadminTotpCode(actorUserId, readStepUpCode(req));
    return { ok: true };
  } catch (error: any) {
    const msg = String(error?.message ?? "MFA_INVALID");
    const reason =
      msg === "STEP_UP_INVALID"
        ? "step_up_token_invalid"
        : msg === "MFA_NOT_ENROLLED"
        ? "step_up_mfa_not_enrolled"
        : msg === "MFA_REQUIRED"
          ? "step_up_mfa_required"
          : "step_up_mfa_invalid";
    emitAuditLog(
      action === "delete_company" ? AUDIT_EVENT.COMPANY_DELETED : AUDIT_EVENT.COMPANY_UPDATED,
      "denied",
      {
        ...auditContext,
        resourceType: "company",
        resourceId,
        statusCode: 403,
        reason,
      },
    );
    if (msg === "MFA_NOT_ENROLLED") {
      return {
        ok: false,
        status: 403,
        message: "Debes activar MFA para ejecutar esta acción crítica.",
      };
    }
    if (msg === "MFA_REQUIRED") {
      return { ok: false, status: 401, message: "Se requiere código MFA de 6 dígitos." };
    }
    if (msg === "STEP_UP_INVALID") {
      return { ok: false, status: 401, message: "Sesión step-up inválida o expirada." };
    }
    return { ok: false, status: 401, message: "Código MFA inválido." };
  }
}

export const createCompany = async (req: Request, res: Response): Promise<void> => {
  const auditContext = buildAuditContextFromRequest(req);
  try {
    const parsed = createCompanySchema.parse(req.body);
    const company = await companiesService.createCompany(
      parsed,
      req.userId ?? undefined,
    );
    emitAuditLog(AUDIT_EVENT.COMPANY_CREATED, "success", {
      ...auditContext,
      resourceType: "company",
      resourceId: String(company._id),
      statusCode: 201,
      meta: { companyName: company.name },
    });
    res.status(201).json(company);
  } catch (error) {
    const err = error as { message?: string; errors?: unknown[] };
    if (err.errors) {
      emitAuditLog(AUDIT_EVENT.COMPANY_CREATED, "denied", {
        ...auditContext,
        resourceType: "company",
        statusCode: 400,
        reason: "invalid_payload",
      });
      res.status(400).json({ message: "Datos inválidos", errors: err.errors });
      return;
    }
    emitAuditLog(AUDIT_EVENT.COMPANY_CREATED, "error", {
      ...auditContext,
      resourceType: "company",
      statusCode: 400,
      reason: err.message ?? "create_company_error",
    });
    res.status(400).json({ message: err.message ?? "Error al crear empresa" });
  }
};

export const getAllCompanies = async (_req: Request, res: Response): Promise<void> => {
  try {
    const companies = await companiesService.getAllCompanies();
    res.status(200).json(companies);
  } catch {
    res.status(500).json({ message: "Error al obtener empresas" });
  }
};

export const getCompanyById = async (req: Request, res: Response): Promise<void> => {
  try {
    const company = await companiesService.getCompanyById(req.params.id);
    if (!company) {
      res.status(404).json({ message: "Empresa no encontrada" });
      return;
    }
    res.status(200).json(company);
  } catch {
    res.status(500).json({ message: "Error al obtener empresa" });
  }
};

export const getMyCompany = async (req: Request, res: Response): Promise<void> => {
  const companyId = req.companyId;
  if (!companyId) {
    res.status(403).json({
      message: "No perteneces a una empresa o falta companyId en la sesión.",
    });
    return;
  }
  try {
    const company = await companiesService.getCompanyById(companyId);
    if (!company) {
      res.status(404).json({ message: "Empresa no encontrada" });
      return;
    }
    res.status(200).json(company);
  } catch {
    res.status(500).json({ message: "Error al obtener empresa" });
  }
};

export const deleteCompany = async (req: Request, res: Response): Promise<void> => {
  const auditContext = buildAuditContextFromRequest(req);
  const stepUp = await ensureStepUpForCriticalCompanyAction(
    req,
    auditContext,
    "delete_company",
    req.params.id,
  );
  if (!stepUp.ok) {
    res.status(stepUp.status).json({ message: stepUp.message, code: "STEP_UP_REQUIRED" });
    return;
  }
  try {
    const deleted = await companiesService.deleteCompany(req.params.id);
    if (!deleted) {
      emitAuditLog(AUDIT_EVENT.COMPANY_DELETED, "denied", {
        ...auditContext,
        resourceType: "company",
        resourceId: req.params.id,
        statusCode: 404,
        reason: "company_not_found",
      });
      res.status(404).json({ message: "Empresa no encontrada" });
      return;
    }
    emitAuditLog(AUDIT_EVENT.COMPANY_DELETED, "success", {
      ...auditContext,
      resourceType: "company",
      resourceId: req.params.id,
      statusCode: 200,
    });
    res.status(200).json({ message: "Empresa eliminada correctamente" });
  } catch {
    emitAuditLog(AUDIT_EVENT.COMPANY_DELETED, "error", {
      ...auditContext,
      resourceType: "company",
      resourceId: req.params.id,
      statusCode: 500,
      reason: "delete_company_error",
    });
    res.status(500).json({ message: "Error al eliminar la empresa" });
  }
};

export const getCompanyAdmins = async (req: Request, res: Response): Promise<void> => {
  try {
    const admins = await companiesService.getCompanyAdmins(req.params.id);
    res.status(200).json(admins);
  } catch {
    res.status(500).json({ message: "Error al obtener administradores" });
  }
};

export const updateCompany = async (req: Request, res: Response): Promise<void> => {
  const auditContext = buildAuditContextFromRequest(req);
  try {
    const sensitiveFields = [
      "isActive",
      "emailDomain",
      "enabledModules",
      "praemienMode",
      "praemienModeEffectiveFrom",
    ];
    const requiresStepUp = sensitiveFields.some((field) =>
      Object.prototype.hasOwnProperty.call(req.body ?? {}, field)
    );
    if (requiresStepUp) {
      const stepUp = await ensureStepUpForCriticalCompanyAction(
        req,
        auditContext,
        "sensitive_update",
        req.params.id,
      );
      if (!stepUp.ok) {
        res.status(stepUp.status).json({ message: stepUp.message, code: "STEP_UP_REQUIRED" });
        return;
      }
    }

    const parsed = updateCompanySchema.parse(req.body);
    const company = await companiesService.updateCompany(req.params.id, parsed);
    if (!company) {
      emitAuditLog(AUDIT_EVENT.COMPANY_UPDATED, "denied", {
        ...auditContext,
        resourceType: "company",
        resourceId: req.params.id,
        statusCode: 404,
        reason: "company_not_found",
      });
      res.status(404).json({ message: "Empresa no encontrada" });
      return;
    }
    emitAuditLog(AUDIT_EVENT.COMPANY_UPDATED, "success", {
      ...auditContext,
      resourceType: "company",
      resourceId: req.params.id,
      statusCode: 200,
      meta: { changedFields: Object.keys(parsed) },
    });
    res.status(200).json(company);
  } catch (error) {
    const err = error as { message?: string; errors?: unknown[] };
    if (err.errors) {
      emitAuditLog(AUDIT_EVENT.COMPANY_UPDATED, "denied", {
        ...auditContext,
        resourceType: "company",
        resourceId: req.params.id,
        statusCode: 400,
        reason: "invalid_payload",
      });
      res.status(400).json({ message: "Datos inválidos", errors: err.errors });
      return;
    }
    emitAuditLog(AUDIT_EVENT.COMPANY_UPDATED, "error", {
      ...auditContext,
      resourceType: "company",
      resourceId: req.params.id,
      statusCode: 400,
      reason: err.message ?? "update_company_error",
    });
    res.status(400).json({ message: err.message ?? "Error al actualizar empresa" });
  }
};
