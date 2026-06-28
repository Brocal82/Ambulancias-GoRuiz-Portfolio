/**
 * Phase 3.4.1 — PraemienImpactResolution service.
 *
 * Manages the lifecycle of a Workday correction's impact on Praemien.
 *
 * Responsibilities (this phase only):
 *   - Track whether a Workday correction requires an operational Praemien review.
 *   - Lifecycle: pending → ignored | recalculated | adjusted | blocked
 *
 * Invariants:
 *   - Does NOT mutate MonthlyPraemie.
 *   - Does NOT recalculate Praemien.
 *   - Does NOT touch Payroll.
 *   - Strict multi-tenant: every query scoped by companyId; no legacy null fallback.
 *   - One PENDING resolution per (companyId, workerId, correctionId) — idempotent create.
 *   - Terminal resolutions cannot be resolved again.
 *   - Every lifecycle transition records an immutable OperationalRecoveryEvent.
 */
import mongoose from "mongoose";
import PraemienImpactResolution, {
  PRAEMIEN_RESOLUTION_STATUS,
  PRAEMIEN_RESOLUTION_TERMINAL_STATUSES,
} from "../models/praemien-impact-resolution.model";
import WorkdaySummaryCorrection from "../models/workday-summary-correction.model";
import {
  RECOVERY_ACTION_TYPE,
  RECOVERY_ENTITY_TYPE,
  RECOVERY_SEVERITY,
  type RecoveryActionType,
} from "../constants/operational-recovery.constants";
import { recordRecoveryEvent, OperationalRecoveryError } from "./operational-recovery.service";
import { MODULE_KEYS } from "../../companies/constants/modules.constants";
import type {
  CreatePraemienImpactResolutionInput,
  CreatePraemienImpactResolutionResult,
  GetActivePraemienImpactInput,
  ResolvePraemienImpactInput,
  ResolvePraemienImpactResult,
} from "../types/praemien-impact.types";
import type { IPraemienImpactResolution } from "../models/praemien-impact-resolution.model";

// ── Input validators ──────────────────────────────────────────────────────────

function requireValidObjectId(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new OperationalRecoveryError(`${field} is required`, 400);
  }
  const trimmed = value.trim();
  if (!mongoose.Types.ObjectId.isValid(trimmed)) {
    throw new OperationalRecoveryError(`${field} must be a valid ObjectId`, 400);
  }
  return trimmed;
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new OperationalRecoveryError(`${field} is required`, 400);
  }
  return value.trim();
}

function assertAdminRole(actorRole: unknown): void {
  if (actorRole !== "admin") {
    throw new OperationalRecoveryError(
      "Praemien impact resolution requires admin role",
      403,
    );
  }
}

function requirePositiveInteger(value: unknown, field: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 12) {
    throw new OperationalRecoveryError(`${field} must be a positive integer`, 400);
  }
  return n;
}

function requireYear(value: unknown): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 2000 || n > 2100) {
    throw new OperationalRecoveryError("year must be a valid calendar year (2000–2100)", 400);
  }
  return n;
}

// ── Date helpers ──────────────────────────────────────────────────────────────

/**
 * Extracts { year, month } from a YYYY-MM-DD string.
 * Month is 1-indexed.
 */
export function parseDateToYearMonth(date: string): { year: number; month: number } {
  const parts = date.split("-");
  if (parts.length < 2) {
    throw new OperationalRecoveryError(
      `Invalid date format: ${date}. Expected YYYY-MM-DD.`,
      400,
    );
  }
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  if (
    !Number.isInteger(year) || year < 2000 ||
    !Number.isInteger(month) || month < 1 || month > 12
  ) {
    throw new OperationalRecoveryError(
      `Invalid date: ${date}. Cannot derive year/month.`,
      400,
    );
  }
  return { year, month };
}

// ── Tenant verification ───────────────────────────────────────────────────────

function verifyCorrectionTenant(
  correctionCompanyId: mongoose.Types.ObjectId,
  adminCompanyId: string,
): void {
  if (String(correctionCompanyId) !== adminCompanyId) {
    throw new OperationalRecoveryError(
      "WorkdaySummaryCorrection does not belong to your company",
      403,
    );
  }
}

function verifyWorkerInCorrection(
  correctionWorkerIds: mongoose.Types.ObjectId[] | undefined,
  workerId: string,
): void {
  if (!correctionWorkerIds || correctionWorkerIds.length === 0) {
    throw new OperationalRecoveryError(
      "WorkdaySummaryCorrection has no associated workers",
      400,
    );
  }
  const isPresent = correctionWorkerIds.some(
    (wid) => String(wid) === workerId,
  );
  if (!isPresent) {
    throw new OperationalRecoveryError(
      "Worker is not associated with this WorkdaySummaryCorrection",
      403,
    );
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Creates a PraemienImpactResolution for a worker affected by a Workday correction.
 *
 * IMPORTANT: Only call this when `praemienImpact = "possible"`.
 * Callers should NOT call this when `praemienImpact = "none"`.
 *
 * Idempotent: if a PENDING resolution already exists for the same
 * (companyId, workerId, correctionId), it is returned as-is.
 *
 * Multi-tenant: validates that the correction belongs to the admin's company
 * and that the worker is in the correction's workerIds.
 */
export async function createPraemienImpactResolution(
  input: CreatePraemienImpactResolutionInput,
): Promise<CreatePraemienImpactResolutionResult> {
  // ── 1. Validate input ─────────────────────────────────────────────────────
  const companyId = requireValidObjectId(input.companyId, "companyId");
  const workerId = requireValidObjectId(input.workerId, "workerId");
  const correctionId = requireValidObjectId(
    input.relatedWorkdaySummaryCorrectionId,
    "relatedWorkdaySummaryCorrectionId",
  );
  const summaryId = requireValidObjectId(
    input.relatedWorkdaySummaryId,
    "relatedWorkdaySummaryId",
  );
  requireYear(input.year);
  requirePositiveInteger(input.month, "month");
  requireNonEmptyString(input.reason, "reason");
  const actorUserId = requireValidObjectId(input.actorUserId, "actorUserId");
  assertAdminRole(input.actorRole);

  // ── 2. Load and validate the correction ───────────────────────────────────
  const correction = await WorkdaySummaryCorrection.findById(correctionId);
  if (!correction) {
    throw new OperationalRecoveryError("WorkdaySummaryCorrection not found", 404);
  }

  verifyCorrectionTenant(correction.companyId, companyId);
  verifyWorkerInCorrection(correction.workerIds, workerId);

  // ── 3. Idempotency: check for existing PENDING resolution ─────────────────
  const existing = await PraemienImpactResolution.findOne({
    companyId: new mongoose.Types.ObjectId(companyId),
    workerId: new mongoose.Types.ObjectId(workerId),
    relatedWorkdaySummaryCorrectionId: new mongoose.Types.ObjectId(correctionId),
    status: PRAEMIEN_RESOLUTION_STATUS.PENDING,
  });

  if (existing) {
    return { resolution: existing, alreadyExisted: true };
  }

  // ── 4. Compute delta if before/after provided ─────────────────────────────
  let delta: number | undefined;
  if (input.beforeValue !== undefined && input.afterValue !== undefined) {
    delta = input.afterValue - input.beforeValue;
  }

  // ── 5. Create resolution ──────────────────────────────────────────────────
  const resolution = await PraemienImpactResolution.create({
    companyId: new mongoose.Types.ObjectId(companyId),
    workerId: new mongoose.Types.ObjectId(workerId),
    year: input.year,
    month: input.month,
    relatedWorkdaySummaryId: new mongoose.Types.ObjectId(summaryId),
    relatedWorkdaySummaryCorrectionId: new mongoose.Types.ObjectId(correctionId),
    status: PRAEMIEN_RESOLUTION_STATUS.PENDING,
    beforeValue: input.beforeValue,
    afterValue: input.afterValue,
    delta,
    reason: input.reason.trim(),
  });

  // ── 6. Record immutable audit event ───────────────────────────────────────
  try {
    const recoveryEvent = await recordRecoveryEvent({
      companyId,
      moduleKey: MODULE_KEYS.WORKDAY,
      entityType: RECOVERY_ENTITY_TYPE.PRAEMIE,
      entityId: String(resolution._id),
      entityLabel: `PraemienImpactResolution for worker ${workerId} (${input.year}-${String(input.month).padStart(2, "0")})`,
      action: RECOVERY_ACTION_TYPE.PRAEMIEN_RESOLUTION_CREATED,
      actorUserId,
      actorRole: input.actorRole,
      reason: input.reason.trim(),
      metadata: {
        correctionId,
        summaryId,
        workerId,
        year: input.year,
        month: input.month,
        status: PRAEMIEN_RESOLUTION_STATUS.PENDING,
      },
      severity: RECOVERY_SEVERITY.INFO,
      relatedWorkdaySummaryId: summaryId,
      relatedWorkerId: workerId,
    });

    await PraemienImpactResolution.updateOne(
      { _id: resolution._id },
      { $set: { recoveryEventId: recoveryEvent._id } },
    );
    (resolution as IPraemienImpactResolution).recoveryEventId =
      recoveryEvent._id as mongoose.Types.ObjectId;
  } catch (eventErr) {
    // Audit event failure does not roll back the resolution.
    console.error(
      "[PraemienImpact] Failed to record OperationalRecoveryEvent for resolution",
      String(resolution._id),
      eventErr,
    );
  }

  const refreshed = (await PraemienImpactResolution.findById(
    resolution._id,
  )) as IPraemienImpactResolution;

  return { resolution: refreshed, alreadyExisted: false };
}

/**
 * Returns active (PENDING) PraemienImpactResolutions for a correction or summary.
 *
 * All results are scoped by companyId.
 * Returns an empty array when no resolutions match.
 */
export async function getActivePraemienImpact(
  input: GetActivePraemienImpactInput,
): Promise<IPraemienImpactResolution[]> {
  const companyId = requireValidObjectId(input.companyId, "companyId");

  const query: Record<string, unknown> = {
    companyId: new mongoose.Types.ObjectId(companyId),
    status: PRAEMIEN_RESOLUTION_STATUS.PENDING,
  };

  if (input.correctionId) {
    const correctionId = requireValidObjectId(input.correctionId, "correctionId");
    query.relatedWorkdaySummaryCorrectionId = new mongoose.Types.ObjectId(correctionId);
  } else if (input.summaryId) {
    const summaryId = requireValidObjectId(input.summaryId, "summaryId");
    query.relatedWorkdaySummaryId = new mongoose.Types.ObjectId(summaryId);
  }

  if (input.workerId) {
    const workerId = requireValidObjectId(input.workerId, "workerId");
    query.workerId = new mongoose.Types.ObjectId(workerId);
  }

  return PraemienImpactResolution.find(query);
}

/**
 * Transitions a PENDING PraemienImpactResolution to a terminal status.
 *
 * Allowed transitions from PENDING:
 *   pending → ignored       (admin dismissed — no recalculation needed)
 *   pending → recalculated  (Phase 3.4.2 — MonthlyPraemie was recalculated externally)
 *   pending → adjusted      (manually adjusted through the praemien admin workflow)
 *   pending → blocked       (period is closed/locked, cannot be recalculated)
 *
 * Multi-tenant: validates that the resolution belongs to the admin's company.
 * Idempotency: throws if resolution is already in a terminal state.
 *
 * Records an OperationalRecoveryEvent for every terminal transition.
 */
export async function resolvePraemienImpact(
  input: ResolvePraemienImpactInput,
): Promise<ResolvePraemienImpactResult> {
  // ── 1. Validate input ─────────────────────────────────────────────────────
  const companyId = requireValidObjectId(input.companyId, "companyId");
  const resolutionId = requireValidObjectId(input.resolutionId, "resolutionId");
  const actorUserId = requireValidObjectId(input.actorUserId, "actorUserId");
  assertAdminRole(input.actorRole);

  const allowedStatuses: string[] = ["ignored", "recalculated", "adjusted", "blocked"];
  if (!allowedStatuses.includes(input.newStatus)) {
    throw new OperationalRecoveryError(
      `Invalid newStatus: ${input.newStatus}. Allowed: ${allowedStatuses.join(", ")}`,
      400,
    );
  }

  // ── 2. Load resolution ────────────────────────────────────────────────────
  const resolution = await PraemienImpactResolution.findById(resolutionId);
  if (!resolution) {
    throw new OperationalRecoveryError("PraemienImpactResolution not found", 404);
  }

  // ── 3. Tenant check ───────────────────────────────────────────────────────
  if (String(resolution.companyId) !== companyId) {
    throw new OperationalRecoveryError(
      "PraemienImpactResolution does not belong to your company",
      403,
    );
  }

  // ── 4. Lifecycle guard — prevent double-resolution ────────────────────────
  if (PRAEMIEN_RESOLUTION_TERMINAL_STATUSES.includes(resolution.status)) {
    throw new OperationalRecoveryError(
      `PraemienImpactResolution is already in terminal status: ${resolution.status}`,
      409,
    );
  }

  const previousStatus = resolution.status;
  const now = new Date();

  // ── 5. Apply transition ───────────────────────────────────────────────────
  await PraemienImpactResolution.updateOne(
    { _id: resolution._id },
    {
      $set: {
        status: input.newStatus,
        resolvedBy: new mongoose.Types.ObjectId(actorUserId),
        resolvedAt: now,
      },
    },
  );

  // ── 6. Determine audit action type ────────────────────────────────────────
  const actionMap: Record<string, RecoveryActionType> = {
    ignored: RECOVERY_ACTION_TYPE.PRAEMIEN_RESOLUTION_IGNORED,
    recalculated: RECOVERY_ACTION_TYPE.PRAEMIEN_RESOLUTION_RESOLVED,
    adjusted: RECOVERY_ACTION_TYPE.PRAEMIEN_RESOLUTION_ADJUSTED,
    blocked: RECOVERY_ACTION_TYPE.PRAEMIEN_RESOLUTION_RESOLVED,
  };
  const auditAction: RecoveryActionType =
    actionMap[input.newStatus] ?? RECOVERY_ACTION_TYPE.PRAEMIEN_RESOLUTION_RESOLVED;

  // ── 7. Record immutable audit event ───────────────────────────────────────
  try {
    await recordRecoveryEvent({
      companyId,
      moduleKey: MODULE_KEYS.WORKDAY,
      entityType: RECOVERY_ENTITY_TYPE.PRAEMIE,
      entityId: String(resolution._id),
      entityLabel: `PraemienImpactResolution ${previousStatus} → ${input.newStatus}`,
      action: auditAction,
      actorUserId,
      actorRole: input.actorRole,
      reason: input.note?.trim() || `Resolution transitioned to ${input.newStatus}`,
      metadata: {
        resolutionId: String(resolution._id),
        previousStatus,
        newStatus: input.newStatus,
        workerId: String(resolution.workerId),
        year: resolution.year,
        month: resolution.month,
      },
      severity: RECOVERY_SEVERITY.INFO,
      relatedWorkdaySummaryId: String(resolution.relatedWorkdaySummaryId),
      relatedWorkerId: String(resolution.workerId),
    });
  } catch (eventErr) {
    console.error(
      "[PraemienImpact] Failed to record OperationalRecoveryEvent for resolution transition",
      String(resolution._id),
      eventErr,
    );
  }

  const updated = (await PraemienImpactResolution.findById(
    resolution._id,
  )) as IPraemienImpactResolution;

  return { resolution: updated, previousStatus };
}
