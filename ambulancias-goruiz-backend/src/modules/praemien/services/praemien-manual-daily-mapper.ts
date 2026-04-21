import type { PraemienManualDailyStatus } from "../models/praemien-manual-daily-entry.model";

/** Shared API shape for worker + admin manual daily entries (Phase 4). */
export interface ManualDailyEntryDto {
  date: string;
  originalWorkerValue: number;
  workerSubmittedValue: number;
  workerSubmittedAt: string;
  adminFinalValue: number | null;
  status: PraemienManualDailyStatus;
  rejectionReason: string | null;
  adminReviewedAt: string | null;
  adminReviewedBy: string | null;
  reopenedAt: string | null;
  reopenedBy: string | null;
  reopenNote: string | null;
}

export function mapManualDailyDocToDto(
  doc: Record<string, unknown> | null,
): ManualDailyEntryDto | null {
  if (!doc) return null;
  const w = Number(doc.workerSubmittedValue ?? 0);
  const orig =
    doc.originalWorkerValue != null ? Number(doc.originalWorkerValue) : w;
  return {
    date: String(doc.date),
    originalWorkerValue: orig,
    workerSubmittedValue: w,
    workerSubmittedAt: (doc.workerSubmittedAt as Date | undefined)?.toISOString?.() ??
      new Date((doc.updatedAt as Date) ?? Date.now()).toISOString(),
    adminFinalValue:
      doc.adminFinalValue != null &&
      doc.adminFinalValue !== "" &&
      Number.isFinite(Number(doc.adminFinalValue))
        ? Number(doc.adminFinalValue)
        : null,
    status: doc.status as PraemienManualDailyStatus,
    rejectionReason:
      doc.rejectionReason != null ? String(doc.rejectionReason) : null,
    adminReviewedAt: doc.adminReviewedAt
      ? (doc.adminReviewedAt as Date).toISOString()
      : null,
    adminReviewedBy: doc.adminReviewedBy
      ? String(doc.adminReviewedBy)
      : null,
    reopenedAt: doc.reopenedAt
      ? (doc.reopenedAt as Date).toISOString()
      : null,
    reopenedBy: doc.reopenedBy ? String(doc.reopenedBy) : null,
    reopenNote: doc.reopenNote != null ? String(doc.reopenNote) : null,
  };
}
