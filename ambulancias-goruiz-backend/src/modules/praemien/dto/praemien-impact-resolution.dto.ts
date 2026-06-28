/**
 * Phase 3.4.2 — PraemienImpactResolution HTTP DTOs.
 *
 * Safe public representation of PraemienImpactResolution.
 *
 * Deliberately excludes:
 *   - companyId     (tenant boundary — never expose to client)
 *   - recoveryEventId (internal audit link)
 *   - __v, _id (raw Mongoose internals — replaced by `id`)
 */
import type { IPraemienImpactResolution } from "../../operational-recovery/models/praemien-impact-resolution.model";
import type { PraemienResolutionStatus } from "../../operational-recovery/models/praemien-impact-resolution.model";

export interface PraemienImpactResolutionDTO {
  id: string;
  status: PraemienResolutionStatus;
  /** Worker whose praemien may be affected — ObjectId as string. */
  workerId: string;
  /** Resolved display name of the worker (name + lastName). */
  workerName?: string;
  year: number;
  month: number;
  beforeValue: number | undefined;
  afterValue: number | undefined;
  delta: number | undefined;
  /** Creation reason (copied from the correction reason). */
  reason: string;
  /** Note added by the admin when transitioning to a terminal status. */
  note: string | undefined;
  relatedWorkdaySummaryId: string;
  relatedWorkdaySummaryCorrectionId: string;
  /** Set once the resolution is linked to a recalculated MonthlyPraemie. */
  relatedMonthlyPraemieId: string | undefined;
  resolvedBy: string | undefined;
  resolvedAt: Date | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export function toPraemienImpactResolutionDTO(
  doc: IPraemienImpactResolution,
  workerName?: string,
): PraemienImpactResolutionDTO {
  return {
    id: String(doc._id),
    status: doc.status,
    workerId: String(doc.workerId),
    workerName: workerName ?? undefined,
    year: doc.year,
    month: doc.month,
    beforeValue: doc.beforeValue,
    afterValue: doc.afterValue,
    delta: doc.delta,
    reason: doc.reason,
    note: doc.note ?? undefined,
    relatedWorkdaySummaryId: String(doc.relatedWorkdaySummaryId),
    relatedWorkdaySummaryCorrectionId: String(doc.relatedWorkdaySummaryCorrectionId),
    relatedMonthlyPraemieId: doc.relatedMonthlyPraemieId
      ? String(doc.relatedMonthlyPraemieId)
      : undefined,
    resolvedBy: doc.resolvedBy ? String(doc.resolvedBy) : undefined,
    resolvedAt: doc.resolvedAt ?? undefined,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
