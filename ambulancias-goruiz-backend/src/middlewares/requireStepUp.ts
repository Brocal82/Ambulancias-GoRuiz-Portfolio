import type { Request, Response, NextFunction } from "express";
import type { AuditEventName } from "../security/audit-events";
import { buildAuditContextFromRequest, emitAuditLog } from "../security/audit-log";
import {
  verifySuperadminStepUpSessionToken,
  verifySuperadminTotpCode,
} from "../modules/users/services/users.service";
import type { StepUpAction } from "../security/step-up-policy";

type RequireStepUpOptions = {
  action: StepUpAction;
  event: AuditEventName;
  resourceType: string;
  resourceIdFromReq?: (req: Request) => string | undefined;
  when?: (req: Request) => boolean;
};

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

export function requireStepUp(options: RequireStepUpOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (options.when && !options.when(req)) {
      next();
      return;
    }

    const auditContext = buildAuditContextFromRequest(req);
    const actorUserId = req.userId;
    if (!actorUserId) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    const resourceId = options.resourceIdFromReq?.(req);
    try {
      const stepUpToken = readStepUpToken(req);
      if (stepUpToken) {
        await verifySuperadminStepUpSessionToken(actorUserId, stepUpToken);
      } else {
        await verifySuperadminTotpCode(actorUserId, readStepUpCode(req));
      }
      next();
      return;
    } catch (error: any) {
      const msg = String(error?.message ?? "MFA_INVALID");
      const reason =
        msg === "STEP_UP_INVALID"
          ? `step_up_token_invalid:${options.action}`
          : msg === "MFA_NOT_ENROLLED"
            ? `step_up_mfa_not_enrolled:${options.action}`
            : msg === "MFA_REQUIRED"
              ? `step_up_mfa_required:${options.action}`
              : `step_up_mfa_invalid:${options.action}`;

      emitAuditLog(options.event, "denied", {
        ...auditContext,
        resourceType: options.resourceType,
        resourceId,
        statusCode: 401,
        reason,
      });

      if (msg === "MFA_NOT_ENROLLED") {
        res.status(403).json({
          message: "Debes activar MFA para ejecutar esta acción crítica.",
          code: "STEP_UP_REQUIRED",
        });
        return;
      }
      if (msg === "STEP_UP_INVALID") {
        res.status(401).json({
          message: "Sesión step-up inválida o expirada.",
          code: "STEP_UP_REQUIRED",
        });
        return;
      }
      if (msg === "MFA_REQUIRED") {
        res.status(401).json({
          message: "Se requiere código MFA de 6 dígitos.",
          code: "STEP_UP_REQUIRED",
        });
        return;
      }
      res.status(401).json({ message: "Código MFA inválido.", code: "STEP_UP_REQUIRED" });
      return;
    }
  };
}

