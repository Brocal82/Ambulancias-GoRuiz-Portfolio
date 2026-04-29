import { Request, Response } from "express";
import * as companyAdminService from "../services/company-admin.service";
import { createCompanyAdminSchema } from "../schemas/create-admin.schema";
import { CompanyAdminError } from "../services/company-admin.service";
import { AUDIT_EVENT } from "../../../security/audit-events";
import {
  buildAuditContextFromRequest,
  emitAuditLog,
} from "../../../security/audit-log";

export const createFirstAdmin = async (req: Request, res: Response): Promise<void> => {
  const auditContext = buildAuditContextFromRequest(req);
  try {
    const parsed = createCompanyAdminSchema.parse(req.body);
    const user = await companyAdminService.createFirstAdminForCompany(
      req.params.id,
      parsed,
    );
    emitAuditLog(AUDIT_EVENT.COMPANY_ADMIN_CREATED, "success", {
      ...auditContext,
      resourceType: "company",
      resourceId: req.params.id,
      statusCode: 201,
      meta: { createdAdminId: String(user._id), createdAdminEmail: user.email },
    });
    res.status(201).json({
      message: "Admin de empresa creado correctamente",
      user: {
        _id: user._id,
        name: user.name,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
      },
    });
  } catch (error) {
    if (error instanceof CompanyAdminError) {
      emitAuditLog(AUDIT_EVENT.COMPANY_ADMIN_CREATED, "denied", {
        ...auditContext,
        resourceType: "company",
        resourceId: req.params.id,
        statusCode: error.statusCode,
        reason: error.message,
      });
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    const err = error as { message?: string; errors?: unknown[] };
    if (err.errors) {
      emitAuditLog(AUDIT_EVENT.COMPANY_ADMIN_CREATED, "denied", {
        ...auditContext,
        resourceType: "company",
        resourceId: req.params.id,
        statusCode: 400,
        reason: "invalid_payload",
      });
      res.status(400).json({ message: "Datos inválidos", errors: err.errors });
      return;
    }
    emitAuditLog(AUDIT_EVENT.COMPANY_ADMIN_CREATED, "error", {
      ...auditContext,
      resourceType: "company",
      resourceId: req.params.id,
      statusCode: 500,
      reason: err.message ?? "create_company_admin_error",
    });
    res.status(500).json({ message: "Error al crear admin de empresa" });
  }
};
