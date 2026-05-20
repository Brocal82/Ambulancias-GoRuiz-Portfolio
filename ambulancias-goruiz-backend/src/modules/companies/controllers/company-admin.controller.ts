import { Request, Response } from "express";
import mongoose from "mongoose";
import * as companyAdminService from "../services/company-admin.service";
import { createCompanyAdminSchema } from "../schemas/create-admin.schema";
import { createCompanyAdminInvitationSchema } from "../schemas/create-admin-invitation.schema";
import { CompanyAdminError } from "../services/company-admin.service";
import { createInvitationService } from "../../invitations/services/invitations.service";
import { getCompanyById } from "../services/companies.service";
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

export const createCompanyAdminInvitation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const auditContext = buildAuditContextFromRequest(req);
  const invitedBy = req.userId;
  if (!invitedBy) {
    res.status(401).json({ message: "No autorizado" });
    return;
  }
  try {
    const company = await getCompanyById(req.params.id);
    if (!company) {
      res.status(404).json({ message: "Empresa no encontrada" });
      return;
    }
    const parsed = createCompanyAdminInvitationSchema.parse(req.body);
    const result = await createInvitationService({
      email: parsed.email,
      role: "admin",
      expiresInDays: parsed.expiresInDays,
      companyId: new mongoose.Types.ObjectId(req.params.id),
      invitedBy: new mongoose.Types.ObjectId(invitedBy),
    });
    emitAuditLog(AUDIT_EVENT.COMPANY_ADMIN_CREATED, "success", {
      ...auditContext,
      resourceType: "company",
      resourceId: req.params.id,
      statusCode: 201,
      meta: {
        invitationId: result.invitationId,
        invitedEmail: parsed.email,
        via: "invitation",
      },
    });
    res.status(201).json({
      invitationId: result.invitationId,
      token: result.token,
      expiresAt: result.expiresAt,
      email: parsed.email,
      role: "admin" as const,
    });
  } catch (error) {
    const err = error as { message?: string; errors?: unknown[] };
    if (err.errors) {
      res.status(400).json({ message: "Datos inválidos", errors: err.errors });
      return;
    }
    const msg = String(err.message ?? "");
    if (msg.includes("Empresa no encontrada")) {
      res.status(404).json({ message: msg });
      return;
    }
    emitAuditLog(AUDIT_EVENT.COMPANY_ADMIN_CREATED, "error", {
      ...auditContext,
      resourceType: "company",
      resourceId: req.params.id,
      statusCode: 500,
      reason: msg || "create_admin_invitation_error",
    });
    res.status(500).json({ message: msg || "Error al crear invitación de admin" });
  }
};
