import type { Request, Response } from "express";
import {
  createSupportAccessRequest,
  hasActiveSupportAccess,
  listSupportAccessRequests,
  reviewSupportAccessRequest,
  revokeSupportAccessRequest,
} from "../services/support-access.service";
import { AUDIT_EVENT } from "../../../security/audit-events";
import {
  buildAuditContextFromRequest,
  emitAuditLog,
  emitSecurityAlert,
} from "../../../security/audit-log";
import { buildSecurityMonitoringSnapshot } from "../../../security/security-monitoring";
import { querySecurityAuditLogs } from "../../../security/security-audit-log.service";
import { buildSecurityMonitoringOperationalHealth } from "../../../security/security-monitoring-health.service";
import { buildTenantRiskRanking } from "../../../security/security-tenant-risk.service";
import { buildSecurityMonthlyReviewSnapshot } from "../../../security/security-monthly-review.service";

export async function createSupportAccess(req: Request, res: Response): Promise<void> {
  const auditContext = buildAuditContextFromRequest(req);
  try {
    const actorUserId = req.userId;
    if (!actorUserId) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }
    const { companyId, reason, ticketId, durationMinutes } = req.body ?? {};
    const created = await createSupportAccessRequest({
      companyId: String(companyId ?? ""),
      requestedBy: actorUserId,
      reason: String(reason ?? ""),
      ticketId: String(ticketId ?? ""),
      durationMinutes: Number(durationMinutes),
    });
    emitAuditLog(AUDIT_EVENT.SUPPORT_ACCESS_REQUESTED, "success", {
      ...auditContext,
      statusCode: 201,
      resourceType: "support_access_request",
      resourceId: String(created._id),
      meta: {
        companyId: String(created.companyId),
        durationMinutes: created.durationMinutes,
        ticketId: created.ticketId,
      },
    });
    res.status(201).json(created);
  } catch (error: any) {
    const msg = String(error?.message ?? "Error al crear solicitud");
    emitAuditLog(AUDIT_EVENT.SUPPORT_ACCESS_REQUESTED, "denied", {
      ...auditContext,
      statusCode: 400,
      resourceType: "support_access_request",
      reason: msg,
    });
    res.status(400).json({ message: msg });
  }
}

export async function getSupportAccessRequests(
  req: Request,
  res: Response,
): Promise<void> {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const allowedStatuses = ["pending", "approved", "denied", "revoked", "expired"];
  if (status && !allowedStatuses.includes(status)) {
    res.status(400).json({ message: "status inválido" });
    return;
  }
  const rows = await listSupportAccessRequests(status as any);
  res.status(200).json(rows);
}

export async function reviewSupportAccess(req: Request, res: Response): Promise<void> {
  const auditContext = buildAuditContextFromRequest(req);
  try {
    const reviewerUserId = req.userId;
    if (!reviewerUserId) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }
    const approve = Boolean(req.body?.approve);
    const reviewed = await reviewSupportAccessRequest({
      requestId: req.params.id,
      reviewerUserId,
      approve,
      reviewComment:
        typeof req.body?.reviewComment === "string" ? req.body.reviewComment : undefined,
    });
    const isFullyApproved = approve && reviewed.status === "approved";
    const event = approve
      ? (isFullyApproved
        ? AUDIT_EVENT.SUPPORT_ACCESS_APPROVED
        : AUDIT_EVENT.SUPPORT_ACCESS_APPROVAL_RECORDED)
      : AUDIT_EVENT.SUPPORT_ACCESS_DENIED;
    emitAuditLog(event, "success", {
      ...auditContext,
      statusCode: 200,
      resourceType: "support_access_request",
      resourceId: String(reviewed._id),
      meta: {
        companyId: String(reviewed.companyId),
        expiresAt: reviewed.expiresAt?.toISOString() ?? null,
        approvalsCount: (reviewed as any).approvalsCount ?? 0,
        approvalsRequired: (reviewed as any).approvalsRequired ?? 2,
      },
    });
    if (isFullyApproved) {
      emitSecurityAlert("support_access_approved", {
        requestId: String(reviewed._id),
        companyId: String(reviewed.companyId),
        requestedBy: String(reviewed.requestedBy),
        reviewedBy: reviewerUserId,
        expiresAt: reviewed.expiresAt?.toISOString() ?? null,
      });
    }
    res.status(200).json(reviewed);
  } catch (error: any) {
    const msg = String(error?.message ?? "Error al revisar solicitud");
    emitAuditLog(AUDIT_EVENT.SUPPORT_ACCESS_DENIED, "denied", {
      ...auditContext,
      statusCode: 400,
      resourceType: "support_access_request",
      resourceId: req.params.id,
      reason: msg,
    });
    res.status(400).json({ message: msg });
  }
}

export async function revokeSupportAccess(req: Request, res: Response): Promise<void> {
  const auditContext = buildAuditContextFromRequest(req);
  try {
    const actorUserId = req.userId;
    if (!actorUserId) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }
    const revoked = await revokeSupportAccessRequest({
      requestId: req.params.id,
      revokedByUserId: actorUserId,
      reason: typeof req.body?.reason === "string" ? req.body.reason : undefined,
    });
    emitAuditLog(AUDIT_EVENT.SUPPORT_ACCESS_REVOKED, "success", {
      ...auditContext,
      statusCode: 200,
      resourceType: "support_access_request",
      resourceId: String(revoked._id),
      meta: { companyId: String(revoked.companyId) },
    });
    emitSecurityAlert("support_access_revoked", {
      requestId: String(revoked._id),
      companyId: String(revoked.companyId),
      revokedBy: actorUserId,
    });
    res.status(200).json(revoked);
  } catch (error: any) {
    const msg = String(error?.message ?? "Error al revocar solicitud");
    emitAuditLog(AUDIT_EVENT.SUPPORT_ACCESS_REVOKED, "denied", {
      ...auditContext,
      statusCode: 400,
      resourceType: "support_access_request",
      resourceId: req.params.id,
      reason: msg,
    });
    res.status(400).json({ message: msg });
  }
}

export async function checkMyActiveSupportAccess(
  req: Request,
  res: Response,
): Promise<void> {
  const auditContext = buildAuditContextFromRequest(req);
  try {
    const actorUserId = req.userId;
    const companyId = typeof req.query.companyId === "string" ? req.query.companyId : "";
    if (!actorUserId) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }
    if (!companyId) {
      res.status(400).json({ message: "companyId es obligatorio" });
      return;
    }
    const active = await hasActiveSupportAccess({ actorUserId, companyId });
    emitAuditLog(AUDIT_EVENT.SUPPORT_ACCESS_ACTIVE_CHECKED, "success", {
      ...auditContext,
      statusCode: 200,
      tenantCompanyId: companyId,
      resourceType: "support_access_request",
      meta: { active, companyId },
    });
    res.status(200).json({ active });
  } catch (error: any) {
    const msg = String(error?.message ?? "Error de validación");
    emitAuditLog(AUDIT_EVENT.SUPPORT_ACCESS_ACTIVE_CHECKED, "error", {
      ...auditContext,
      statusCode: 400,
      reason: msg,
    });
    res.status(400).json({ message: msg });
  }
}

export async function getSecurityMonitoringSummary(
  req: Request,
  res: Response,
): Promise<void> {
  const auditContext = buildAuditContextFromRequest(req);
  const hoursRaw = typeof req.query.hours === "string" ? Number(req.query.hours) : 24;
  const hours = Number.isFinite(hoursRaw) ? Math.max(1, Math.min(168, Math.floor(hoursRaw))) : 24;
  try {
    const snapshot = await buildSecurityMonitoringSnapshot(hours);
    emitAuditLog(AUDIT_EVENT.SECURITY_MONITORING_QUERIED, "success", {
      ...auditContext,
      statusCode: 200,
      resourceType: "security_monitoring",
      meta: { endpoint: "daily-summary", hours },
    });
    res.status(200).json(snapshot);
  } catch (error: any) {
    res.status(500).json({ message: String(error?.message ?? "Error interno") });
  }
}

export async function getSecurityAuditLogs(req: Request, res: Response): Promise<void> {
  const auditContext = buildAuditContextFromRequest(req);
  try {
    const hoursRaw = typeof req.query.hours === "string" ? Number(req.query.hours) : undefined;
    const limitRaw = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
    const event = typeof req.query.event === "string" ? req.query.event : undefined;
    const outcome = typeof req.query.outcome === "string" ? req.query.outcome : undefined;
    const actorUserId = typeof req.query.actorUserId === "string" ? req.query.actorUserId : undefined;
    const tenantCompanyId =
      typeof req.query.tenantCompanyId === "string" ? req.query.tenantCompanyId : undefined;

    const data = await querySecurityAuditLogs({
      hours: hoursRaw,
      limit: limitRaw,
      event: event as any,
      outcome: outcome as any,
      actorUserId,
      tenantCompanyId,
    });
    emitAuditLog(AUDIT_EVENT.SECURITY_MONITORING_QUERIED, "success", {
      ...auditContext,
      statusCode: 200,
      resourceType: "security_monitoring",
      meta: { endpoint: "audit-logs", hours: hoursRaw ?? null, limit: limitRaw ?? null },
    });
    res.status(200).json(data);
  } catch (error: any) {
    res.status(500).json({ message: String(error?.message ?? "Error interno") });
  }
}

export async function getSecurityMonitoringOperationalHealth(
  req: Request,
  res: Response,
): Promise<void> {
  const auditContext = buildAuditContextFromRequest(req);
  try {
    const health = await buildSecurityMonitoringOperationalHealth();
    emitAuditLog(AUDIT_EVENT.SECURITY_MONITORING_QUERIED, "success", {
      ...auditContext,
      statusCode: 200,
      resourceType: "security_monitoring",
      meta: { endpoint: "health" },
    });
    res.status(200).json(health);
  } catch (error: any) {
    res.status(500).json({ message: String(error?.message ?? "Error interno") });
  }
}

export async function getSecurityTenantRisk(req: Request, res: Response): Promise<void> {
  const auditContext = buildAuditContextFromRequest(req);
  try {
    const hoursRaw = typeof req.query.hours === "string" ? Number(req.query.hours) : undefined;
    const limitRaw = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
    const ranking = await buildTenantRiskRanking({ hours: hoursRaw, limit: limitRaw });
    emitAuditLog(AUDIT_EVENT.SECURITY_MONITORING_QUERIED, "success", {
      ...auditContext,
      statusCode: 200,
      resourceType: "security_monitoring",
      meta: { endpoint: "tenant-risk", hours: hoursRaw ?? null, limit: limitRaw ?? null },
    });
    res.status(200).json(ranking);
  } catch (error: any) {
    res.status(500).json({ message: String(error?.message ?? "Error interno") });
  }
}

export async function getSecurityMonthlyReview(req: Request, res: Response): Promise<void> {
  const auditContext = buildAuditContextFromRequest(req);
  try {
    const hoursRaw = typeof req.query.hours === "string" ? Number(req.query.hours) : undefined;
    const snapshot = await buildSecurityMonthlyReviewSnapshot(hoursRaw);
    emitAuditLog(AUDIT_EVENT.SECURITY_MONITORING_QUERIED, "success", {
      ...auditContext,
      statusCode: 200,
      resourceType: "security_monitoring",
      meta: { endpoint: "monthly-review", hours: hoursRaw ?? null },
    });
    res.status(200).json(snapshot);
  } catch (error: any) {
    res.status(500).json({ message: String(error?.message ?? "Error interno") });
  }
}
