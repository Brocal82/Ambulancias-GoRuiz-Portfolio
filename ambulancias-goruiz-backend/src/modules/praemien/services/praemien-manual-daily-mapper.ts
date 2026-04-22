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
  /** Nombre resuelto en API (no se persiste en Mongo). */
  adminReviewedByName: string | null;
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
    rejectionReason: (() => {
      const raw = doc.rejectionReason;
      if (raw == null || raw === "") return null;
      const s = String(raw).trim();
      return s === "" ? null : s;
    })(),
    adminReviewedAt: doc.adminReviewedAt
      ? (doc.adminReviewedAt as Date).toISOString()
      : null,
    adminReviewedBy: doc.adminReviewedBy
      ? String(doc.adminReviewedBy)
      : null,
    adminReviewedByName: null,
    reopenedAt: doc.reopenedAt
      ? (doc.reopenedAt as Date).toISOString()
      : null,
    reopenedBy: doc.reopenedBy ? String(doc.reopenedBy) : null,
    reopenNote: (() => {
      const raw = doc.reopenNote;
      if (raw == null || raw === "") return null;
      const s = String(raw).trim();
      return s === "" ? null : s;
    })(),
  };
}

/**
 * Vista trabajador: "reopened" es solo para que el admin corrija en su panel.
 * El trabajador sigue viendo el día como aprobado (solo lectura, tick verde).
 */
export function toWorkerFacingManualDailyDto(
  dto: ManualDailyEntryDto,
): ManualDailyEntryDto {
  if (dto.status !== "reopened") return dto;
  return {
    ...dto,
    status: "approved",
    reopenedAt: null,
    reopenedBy: null,
    reopenNote: null,
  };
}
