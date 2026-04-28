import mongoose from "mongoose";
import Company from "../../companies/models/company.model";
import SupportAccessRequest, {
  type ISupportAccessRequest,
  type SupportAccessStatus,
} from "../models/support-access-request.model";

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
  });
  return doc;
}

export async function expireSupportAccessRequests(): Promise<number> {
  const now = new Date();
  const res = await SupportAccessRequest.updateMany(
    {
      status: "approved",
      expiresAt: { $lte: now },
    },
    { $set: { status: "expired" } },
  );
  return res.modifiedCount ?? 0;
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
    request.status = "approved";
    request.expiresAt = new Date(
      Date.now() + request.durationMinutes * 60 * 1000,
    );
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
