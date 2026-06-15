import mongoose from "mongoose";
import WorkdaySummary from "../../workday-summary/models/workday-summary.model";
import PraemienManualDailyEntry from "../models/praemien-manual-daily-entry.model";
import { legacyAwareWorkdayCompanyFilter } from "../utils/legacyWorkdayCompanyFilter";

export function sameMongoUserId(a: string, b: string): boolean {
  const as = String(a).trim();
  const bs = String(b).trim();
  if (as === bs) return true;
  if (
    mongoose.Types.ObjectId.isValid(as) &&
    mongoose.Types.ObjectId.isValid(bs)
  ) {
    try {
      return new mongoose.Types.ObjectId(as).equals(
        new mongoose.Types.ObjectId(bs),
      );
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Otros asientos del mismo cierre final (conductor / médico) distintos de `targetUserId`.
 */
export async function findDienstPartnerUserIdsForManualDay(params: {
  companyObjectId: mongoose.Types.ObjectId;
  targetUserId: string;
  date: string;
}): Promise<string[]> {
  const dateStr = typeof params.date === "string" ? params.date.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return [];
  }
  const primary = String(params.targetUserId).trim();
  if (!mongoose.Types.ObjectId.isValid(primary)) {
    return [];
  }
  const userOid = new mongoose.Types.ObjectId(primary);
  const co = params.companyObjectId;
  const ws = await WorkdaySummary.findOne({
    date: dateStr,
    isFinalClosure: true,
    $and: [
      legacyAwareWorkdayCompanyFilter(co),
      { $or: [{ driver: userOid }, { medic: userOid }] },
    ],
  })
    .select("driver medic")
    .lean();
  if (!ws) {
    return [];
  }
  const dRaw = (ws as { driver?: unknown }).driver;
  const mRaw = (ws as { medic?: unknown }).medic;
  const d = dRaw != null ? String(dRaw) : "";
  const m = mRaw != null ? String(mRaw) : "";
  const seats = [d, m].filter((x) => x.length > 0);
  const unique = [...new Set(seats)];
  return unique.filter((id) => !sameMongoUserId(id, primary));
}

/**
 * Cuando un trabajador envía (submitted), alinea al compañero de Dienst el mismo día:
 * crea fila submitted si no existe, o actualiza si no está aprobada/rechazada/reabierta.
 */
export async function syncDienstPartnersManualDailySubmitted(params: {
  companyObjectId: mongoose.Types.ObjectId;
  primaryUserId: string;
  dateStr: string;
  submittedValue: number;
}): Promise<void> {
  const partnerIds = await findDienstPartnerUserIdsForManualDay({
    companyObjectId: params.companyObjectId,
    targetUserId: params.primaryUserId,
    date: params.dateStr,
  });
  const now = new Date();
  const val = Math.round(params.submittedValue * 100) / 100;
  const co = params.companyObjectId;

  for (const partnerId of partnerIds) {
    if (!mongoose.Types.ObjectId.isValid(partnerId)) continue;
    const partnerOid = new mongoose.Types.ObjectId(partnerId);
    const existing = await PraemienManualDailyEntry.findOne({
      companyId: co,
      userId: partnerOid,
      date: params.dateStr,
    }).lean();

    if (!existing) {
      await PraemienManualDailyEntry.create({
        companyId: co,
        userId: partnerOid,
        date: params.dateStr,
        originalWorkerValue: val,
        workerSubmittedValue: val,
        workerSubmittedAt: now,
        status: "submitted",
        submittedViaDienstPartnerSync: true,
      });
      continue;
    }

    const st = String(existing.status ?? "");
    if (st === "approved" || st === "rejected" || st === "reopened") continue;

    const patch: Record<string, unknown> = {
      workerSubmittedValue: val,
      workerSubmittedAt: now,
      status: "submitted",
      submittedViaDienstPartnerSync: true,
    };
    if (existing.originalWorkerValue == null) {
      patch.originalWorkerValue = Number(existing.workerSubmittedValue ?? 0);
    }

    await PraemienManualDailyEntry.updateOne(
      { _id: existing._id },
      { $set: patch },
    );
  }
}
