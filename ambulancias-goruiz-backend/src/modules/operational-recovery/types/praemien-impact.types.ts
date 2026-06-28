/**
 * Phase 3.4.1 — PraemienImpactResolution service I/O types.
 */
import type { IPraemienImpactResolution, PraemienResolutionStatus } from "../models/praemien-impact-resolution.model";

// ── createPraemienImpactResolution ────────────────────────────────────────────

export interface CreatePraemienImpactResolutionInput {
  /** Admin's company — service validates all records against this. */
  companyId: string;
  /** Worker whose Praemien may be affected. Must be present in the correction's workerIds. */
  workerId: string;
  /** Calendar year derived from the correction's date. */
  year: number;
  /** Calendar month (1–12) derived from the correction's date. */
  month: number;
  /** The WorkdaySummary that was corrected. */
  relatedWorkdaySummaryId: string;
  /** The WorkdaySummaryCorrection that triggered this resolution. */
  relatedWorkdaySummaryCorrectionId: string;
  /** Optional: effective patient count before correction (from correction's beforeValue). */
  beforeValue?: number;
  /** Optional: effective patient count after correction (from correction's afterValue). */
  afterValue?: number;
  /** Reason copied from the correction reason. */
  reason: string;
  /** Admin actor (used for OperationalRecoveryEvent). */
  actorUserId: string;
  actorRole: string;
}

export interface CreatePraemienImpactResolutionResult {
  resolution: IPraemienImpactResolution;
  /** True when a PENDING resolution already existed and was returned as-is. */
  alreadyExisted: boolean;
}

// ── listPraemienImpactResolutions ────────────────────────────────────────────

export interface ListPraemienImpactResolutionsInput {
  companyId: string;
  /** Filter by status. Defaults to "pending" when omitted. */
  status?: string;
  workerId?: string;
  year?: number;
  month?: number;
}

// ── getActivePraemienImpact ───────────────────────────────────────────────────

export interface GetActivePraemienImpactInput {
  companyId: string;
  /** Filter by correction ID (primary key). */
  correctionId?: string;
  /** Alternatively filter by summary ID. */
  summaryId?: string;
  /** Optionally narrow to a single worker. */
  workerId?: string;
}

// ── resolvePraemienImpact ─────────────────────────────────────────────────────

export type ResolvableStatus =
  | "ignored"
  | "recalculated"
  | "adjusted"
  | "blocked";

export interface ResolvePraemienImpactInput {
  companyId: string;
  resolutionId: string;
  /** Target terminal status. */
  newStatus: ResolvableStatus;
  actorUserId: string;
  actorRole: string;
  /** Optional resolution note (stored in the OperationalRecoveryEvent reason). */
  note?: string;
}

export interface ResolvePraemienImpactResult {
  resolution: IPraemienImpactResolution;
  previousStatus: PraemienResolutionStatus;
}
