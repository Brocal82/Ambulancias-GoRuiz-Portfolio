import SupportAccessRequest from "../modules/support-access/models/support-access-request.model";

export type TenantRiskRow = {
  tenantCompanyId: string;
  requested: number;
  denied: number;
  approvedFinal: number;
  revoked: number;
  expired: number;
  offHoursFinalApprovals: number;
  riskScore: number;
  riskLevel: "low" | "medium" | "high";
};

export async function buildTenantRiskRanking(params: {
  hours?: number;
  limit?: number;
  now?: Date;
}): Promise<{ windowHours: number; since: string; until: string; rows: TenantRiskRow[] }> {
  const safeHours = Number.isFinite(params.hours)
    ? Math.max(1, Math.min(168, Math.floor(Number(params.hours))))
    : 24;
  const safeLimit = Number.isFinite(params.limit)
    ? Math.max(1, Math.min(100, Math.floor(Number(params.limit))))
    : 20;
  const now = params.now ?? new Date();
  const since = new Date(now.getTime() - safeHours * 60 * 60 * 1000);

  const docs = await SupportAccessRequest.find({
    $or: [
      { createdAt: { $gte: since, $lte: now } },
      { reviewedAt: { $gte: since, $lte: now } },
      { revokedAt: { $gte: since, $lte: now } },
      { expiresAt: { $gte: since, $lte: now } },
    ],
  })
    .select("companyId status createdAt reviewedAt revokedAt expiresAt approvalsCount approvalsRequired")
    .lean();

  const byTenant = new Map<string, TenantRiskRow>();
  const getRow = (tenantCompanyId: string): TenantRiskRow => {
    const existing = byTenant.get(tenantCompanyId);
    if (existing) return existing;
    const created: TenantRiskRow = {
      tenantCompanyId,
      requested: 0,
      denied: 0,
      approvedFinal: 0,
      revoked: 0,
      expired: 0,
      offHoursFinalApprovals: 0,
      riskScore: 0,
      riskLevel: "low",
    };
    byTenant.set(tenantCompanyId, created);
    return created;
  };

  for (const doc of docs as any[]) {
    const tenantCompanyId = String(doc.companyId ?? "");
    if (!tenantCompanyId) continue;
    const row = getRow(tenantCompanyId);

    if (doc.createdAt && new Date(doc.createdAt) >= since) {
      row.requested += 1;
    }
    if (doc.status === "denied" && doc.reviewedAt && new Date(doc.reviewedAt) >= since) {
      row.denied += 1;
    }
    if (doc.status === "revoked" && doc.revokedAt && new Date(doc.revokedAt) >= since) {
      row.revoked += 1;
    }
    if (doc.status === "expired" && doc.expiresAt && new Date(doc.expiresAt) >= since) {
      row.expired += 1;
    }
    if (
      doc.status === "approved" &&
      doc.reviewedAt &&
      new Date(doc.reviewedAt) >= since &&
      Number(doc.approvalsCount ?? 0) >= Number(doc.approvalsRequired ?? 2)
    ) {
      row.approvedFinal += 1;
      const reviewedAt = new Date(doc.reviewedAt);
      const hour = reviewedAt.getHours();
      if (hour < 7 || hour >= 20) {
        row.offHoursFinalApprovals += 1;
      }
    }
  }

  const rows = Array.from(byTenant.values()).map((row) => {
    const riskScore =
      row.denied * 3 + row.offHoursFinalApprovals * 4 + row.approvedFinal - row.revoked;
    const riskLevel: TenantRiskRow["riskLevel"] =
      riskScore >= 8 || row.denied >= 3 || row.offHoursFinalApprovals > 0
        ? "high"
        : riskScore >= 4 || row.denied >= 2
          ? "medium"
          : "low";
    return { ...row, riskScore, riskLevel };
  });

  rows.sort((a, b) => b.riskScore - a.riskScore || b.denied - a.denied || b.requested - a.requested);

  return {
    windowHours: safeHours,
    since: since.toISOString(),
    until: now.toISOString(),
    rows: rows.slice(0, safeLimit),
  };
}
