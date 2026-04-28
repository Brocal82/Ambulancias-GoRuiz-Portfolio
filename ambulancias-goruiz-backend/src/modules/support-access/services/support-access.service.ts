import mongoose from "mongoose";
import Company from "../../companies/models/company.model";
import SupportAccessRequest, {
  type ISupportAccessRequest,
  type SupportAccessStatus,
} from "../models/support-access-request.model";
import { AUDIT_EVENT } from "../../../security/audit-events";
import { emitAuditLog, emitSecurityAlert } from "../../../security/audit-log";

function parseOid(value: string): mongoose.Types.ObjectId {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new Error("ID inválido");
  }
  return new mongoose.Types.ObjectId(value);
}

export async function ensureCompanyExists(companyId: string): Promise<void> {
  const oid = parseOid(companyId);
  const exists = await Company.findById(oid).select("_id").lean();
  if (!exists) {
    throw new Error("Empresa no encontrada");
  }
}

export async function createSupportAccessRequest(params: {
  companyId: string;
  requestedBy: string;
  reason: string;
  ticketId: string;
  durationMinutes: number;
}): Promise<ISupportAccessRequest> {
  const reason = params.reason.trim();
  const ticketId = params.ticketId.trim();
  const duration = Number(params.durationMinutes);
  if (!reason) throw new Error("reason es obligatorio");
  if (!ticketId) throw new Error("ticketId es obligatorio");
  if (!Number.isFinite(duration) || duration < 5 || duration > 240) {
    throw new Error("durationMinutes debe estar entre 5 y 240");
  }

  await ensureCompanyExists(params.companyId);
  const doc = await SupportAccessRequest.create({
    companyId: parseOid(params.companyId),
    requestedBy: parseOid(params.requestedBy),
    reason,
    ticketId,
    durationMinutes: duration,
    status: "pending",
    approvalActors: [],
    approvalsRequired: 2,
    approvalsCount: 0,
  });
  return doc;
}

export async function expireSupportAccessRequests(): Promise<number> {
  const now = new Date();
  const expiring = await SupportAccessRequest.find({
    status: "approved",
    expiresAt: { $lte: now },
  })
    .select("_id companyId requestedBy expiresAt")
    .lean();
  if (expiring.length === 0) {
    return 0;
  }
  const res = await SupportAccessRequest.updateMany(
    {
      status: "approved",
      expiresAt: { $lte: now },
    },
    { $set: { status: "expired" } },
  );
  const modified = res.modifiedCount ?? 0;
  if (modified > 0) {
    for (const request of expiring) {
      emitAuditLog(AUDIT_EVENT.SUPPORT_ACCESS_EXPIRED, "success", {
        resourceType: "support_access_request",
        resourceId: String(request._id),
        tenantCompanyId: String(request.companyId),
        meta: {
          requestedBy: String(request.requestedBy),
          expiredAt: request.expiresAt instanceof Date
            ? request.expiresAt.toISOString()
            : request.expiresAt ?? null,
        },
      });
      emitSecurityAlert("support_access_expired", {
        requestId: String(request._id),
        companyId: String(request.companyId),
        requestedBy: String(request.requestedBy),
        expiredAt: request.expiresAt instanceof Date
          ? request.expiresAt.toISOString()
          : request.expiresAt ?? null,
      });
    }
  }
  return modified;
}

export async function listSupportAccessRequests(status?: SupportAccessStatus) {
  await expireSupportAccessRequests();
  const query: Record<string, unknown> = {};
  if (status) query.status = status;
  return SupportAccessRequest.find(query)
    .sort({ createdAt: -1 })
    .lean();
}

export async function reviewSupportAccessRequest(params: {
  requestId: string;
  reviewerUserId: string;
  approve: boolean;
  reviewComment?: string;
}): Promise<ISupportAccessRequest> {
  const request = await SupportAccessRequest.findById(parseOid(params.requestId));
  if (!request) throw new Error("Solicitud no encontrada");
  if (request.status !== "pending") {
    throw new Error("Solo solicitudes pendientes pueden revisarse");
  }
  if (String(request.requestedBy) === String(params.reviewerUserId)) {
    throw new Error("La aprobación requiere un superadmin distinto al solicitante");
  }

  request.reviewedBy = parseOid(params.reviewerUserId);
  request.reviewedAt = new Date();
  request.reviewComment = params.reviewComment?.trim() || undefined;

  if (params.approve) {
    const reviewerOid = parseOid(params.reviewerUserId);
    const alreadyApproved = (request.approvalActors ?? []).some(
      (actor) => String(actor) === String(reviewerOid),
    );
    if (alreadyApproved) {
      throw new Error("Este superadmin ya aprobó esta solicitud");
    }
    request.approvalActors = [...(request.approvalActors ?? []), reviewerOid];
    request.approvalsCount = request.approvalActors.length;
    if (request.approvalsCount >= request.approvalsRequired) {
      request.status = "approved";
      request.expiresAt = new Date(
        Date.now() + request.durationMinutes * 60 * 1000,
      );
    }
  } else {
    request.status = "denied";
  }
  await request.save();
  return request;
}

export async function revokeSupportAccessRequest(params: {
  requestId: string;
  revokedByUserId: string;
  reason?: string;
}): Promise<ISupportAccessRequest> {
  const request = await SupportAccessRequest.findById(parseOid(params.requestId));
  if (!request) throw new Error("Solicitud no encontrada");
  if (request.status !== "approved") {
    throw new Error("Solo solicitudes aprobadas pueden revocarse");
  }
  request.status = "revoked";
  request.revokedBy = parseOid(params.revokedByUserId);
  request.revokedAt = new Date();
  request.revokeReason = params.reason?.trim() || undefined;
  await request.save();
  return request;
}

export async function hasActiveSupportAccess(params: {
  actorUserId: string;
  companyId: string;
}): Promise<boolean> {
  await expireSupportAccessRequests();
  const found = await SupportAccessRequest.findOne({
    status: "approved",
    requestedBy: parseOid(params.actorUserId),
    companyId: parseOid(params.companyId),
    expiresAt: { $gt: new Date() },
  })
    .select("_id")
    .lean();
  return !!found;
}
