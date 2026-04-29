import { Request, Response } from "express";
import * as companyAdminService from "../services/company-admin.service";
import { createCompanyAdminSchema } from "../schemas/create-admin.schema";
import { CompanyAdminError } from "../services/company-admin.service";
import {
  verifySuperadminStepUpSessionToken,
  verifySuperadminTotpCode,
} from "../../users/services/users.service";

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

export const createFirstAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const actorUserId = req.userId;
    if (!actorUserId) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }
    const stepUpToken = readStepUpToken(req);
    if (stepUpToken) {
      await verifySuperadminStepUpSessionToken(actorUserId, stepUpToken);
    } else {
      await verifySuperadminTotpCode(actorUserId, readStepUpCode(req));
    }

    const parsed = createCompanyAdminSchema.parse(req.body);
    const user = await companyAdminService.createFirstAdminForCompany(
      req.params.id,
      parsed,
    );
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
    const errMessage = String((error as any)?.message ?? "");
    if (errMessage === "STEP_UP_INVALID") {
      res.status(401).json({
        message: "Sesión step-up inválida o expirada.",
        code: "STEP_UP_REQUIRED",
      });
      return;
    }
    if (errMessage === "MFA_NOT_ENROLLED") {
      res.status(403).json({
        message: "Debes activar MFA para ejecutar esta acción crítica.",
        code: "STEP_UP_REQUIRED",
      });
      return;
    }
    if (errMessage === "MFA_REQUIRED" || errMessage === "MFA_INVALID") {
      res.status(401).json({
        message: "Código MFA inválido o ausente.",
        code: "STEP_UP_REQUIRED",
      });
      return;
    }
    if (error instanceof CompanyAdminError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    const err = error as { message?: string; errors?: unknown[] };
    if (err.errors) {
      res.status(400).json({ message: "Datos inválidos", errors: err.errors });
      return;
    }
    res.status(500).json({ message: "Error al crear admin de empresa" });
  }
};
