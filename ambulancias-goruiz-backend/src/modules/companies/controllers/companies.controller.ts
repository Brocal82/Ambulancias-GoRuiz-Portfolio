import { Request, Response } from "express";
import * as companiesService from "../services/companies.service";
import { createCompanySchema, updateCompanySchema } from "../schemas/company.schema";
import { AUDIT_EVENT } from "../../../security/audit-events";
import {
  buildAuditContextFromRequest,
  emitAuditLog,
} from "../../../security/audit-log";

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

export const getAllCompanies = async (req: Request, res: Response): Promise<void> => {
  try {
    const includeDeleted =
      String(req.query.includeDeleted ?? "").toLowerCase() === "true";
    const companies = await companiesService.getAllCompanies({ includeDeleted });
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
    res.status(200).json({
      message: "Empresa archivada correctamente (soft-delete)",
      company: deleted,
    });
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

export const getCompanySummary = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const summary = await companiesService.getCompanySummary(req.params.id);
    if (!summary) {
      res.status(404).json({ message: "Empresa no encontrada" });
      return;
    }
    res.status(200).json(summary);
  } catch {
    res.status(500).json({ message: "Error al obtener resumen de empresa" });
  }
};

export const getCompanyUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const role =
      typeof req.query.role === "string" ? req.query.role : undefined;
    const isActiveRaw = req.query.isActive;
    let isActive: boolean | undefined;
    if (isActiveRaw === "true") isActive = true;
    if (isActiveRaw === "false") isActive = false;
    const limit =
      typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
    const skip =
      typeof req.query.skip === "string" ? Number(req.query.skip) : undefined;

    const result = await companiesService.getCompanyUsers(req.params.id, {
      role,
      isActive,
      limit: Number.isFinite(limit) ? limit : undefined,
      skip: Number.isFinite(skip) ? skip : undefined,
    });
    if (!result) {
      res.status(404).json({ message: "Empresa no encontrada" });
      return;
    }
    res.status(200).json(result);
  } catch {
    res.status(500).json({ message: "Error al obtener usuarios de empresa" });
  }
};

export const updateCompany = async (req: Request, res: Response): Promise<void> => {
  const auditContext = buildAuditContextFromRequest(req);
  try {
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
