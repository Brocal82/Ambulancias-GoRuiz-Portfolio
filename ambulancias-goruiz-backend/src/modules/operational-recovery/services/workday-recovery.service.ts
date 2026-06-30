/**
 * Phase 3.1 — Workday Recovery service.
 *
 * Responsibilities:
 *   - createWorkdaySummaryCorrection: validates, creates correction, records audit event
 *   - getEffectiveWorkdaySummary: resolves effective (original or corrected) values
 *
 * Invariants:
 *   - Original WorkdaySummary is NEVER mutated.
 *   - Corrections are append/replace: new correction supersedes the previous active one.
 *   - Every correction writes an immutable OperationalRecoveryEvent.
 *   - Multi-tenant: every lookup and write is scoped by the admin's companyId.
 *
 * Phase 3.4.1: createPraemienImpactResolution is called when praemienImpact = "possible"
 *   AND a saved MonthlyPraemie snapshot already exists for the worker/period.
 *   Open months (no saved snapshot) are skipped — praemien are still live/dynamic.
 * TODO Phase 3.4.2: propagate recalculated status once MonthlyPraemie recalculation is wired.
 * TODO Phase 3.4: propagate payrollImpact to payroll pipeline when impact != "none".
 */
import mongoose from "mongoose";
import WorkdaySummary, {
  type IWorkdaySummary,
} from "../../workday-summary/models/workday-summary.model";
import WorkdaySummaryCorrection, {
  CORRECTION_STATUS,
  type IWorkdaySummaryCorrection,
} from "../models/workday-summary-correction.model";
import {
  RECOVERY_ACTION_TYPE,
  RECOVERY_ENTITY_TYPE,
  RECOVERY_SEVERITY,
  RECOVERY_PAYROLL_IMPACTS,
  RECOVERY_PRAEMIEN_IMPACTS,
} from "../constants/operational-recovery.constants";
import type { PayrollImpact, PraemienImpact } from "../constants/operational-recovery.constants";
import { recordRecoveryEvent, OperationalRecoveryError } from "./operational-recovery.service";
import { createPraemienImpactResolution, parseDateToYearMonth } from "./praemien-impact-resolution.service";
import MonthlyPraemie from "../../praemien/models/monthly-praemie.model";
import { MODULE_KEYS } from "../../companies/constants/modules.constants";
import type {
  CreateWorkdaySummaryCorrectionInput,
  CreateWorkdaySummaryCorrectionResult,
  EffectiveWorkdaySummary,
  GetEffectiveWorkdaySummaryInput,
  OriginalWorkdayValues,
} from "../types/workday-recovery.types";

// ── Input validators ─────────────────────────────────────────────────────────

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
      "Workday corrections require admin role",
      403,
    );
  }
}

function assertEnumImpact<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new OperationalRecoveryError(`${field} has an invalid value`, 400);
  }
  return value as T;
}

function assertHasAtLeastOneCorrectedField(
  input: Pick<
    CreateWorkdaySummaryCorrectionInput,
    | "correctedFinalKm"
    | "correctedTotalDienstKm"
    | "correctedTotalEffectivePatients"
    | "correctedTotalRealTrips"
  >,
): void {
  const hasAny =
    input.correctedFinalKm !== undefined ||
    input.correctedTotalDienstKm !== undefined ||
    input.correctedTotalEffectivePatients !== undefined ||
    input.correctedTotalRealTrips !== undefined;
  if (!hasAny) {
    throw new OperationalRecoveryError(
      "At least one corrected field must be provided",
      400,
    );
  }
}

// ── Tenant verification ──────────────────────────────────────────────────────

function verifyWorkdaySummaryTenant(
  summaryCompanyId: mongoose.Types.ObjectId | null | undefined,
  adminCompanyId: string,
): void {
  if (summaryCompanyId == null) {
    // Reject legacy null-companyId summaries — no safe tenant boundary can be
    // established without cross-checking the driver/medic user records.
    // TODO Phase 3.x: relax by verifying driver.companyId === adminCompanyId for
    // legacy data access if a migration path is required.
    throw new OperationalRecoveryError(
      "WorkdaySummary has no company scope (legacy record). Cannot be corrected via this API.",
      403,
    );
  }
  if (String(summaryCompanyId) !== adminCompanyId) {
    throw new OperationalRecoveryError(
      "WorkdaySummary does not belong to your company",
      403,
    );
  }
}

// ── Snapshot helpers ─────────────────────────────────────────────────────────

function buildWorkdaySnapshot(values: {
  date: string;
  isFinalClosure: boolean;
  finalKm: number | undefined;
  totalDienstKm: number;
  totalEffectivePatients: number;
  totalRealTrips: number;
}): Record<string, unknown> {
  return {
    date: values.date,
    isFinalClosure: values.isFinalClosure,
    finalKm: values.finalKm ?? null,
    totalDienstKm: values.totalDienstKm,
    totalEffectivePatients: values.totalEffectivePatients,
    totalRealTrips: values.totalRealTrips,
  };
}

function computeChangedFields(
  before: OriginalWorkdayValues,
  input: Pick<
    CreateWorkdaySummaryCorrectionInput,
    | "correctedFinalKm"
    | "correctedTotalDienstKm"
    | "correctedTotalEffectivePatients"
    | "correctedTotalRealTrips"
  >,
): string[] {
  const changed: string[] = [];
  if (
    input.correctedFinalKm !== undefined &&
    input.correctedFinalKm !== before.finalKm
  ) {
    changed.push("finalKm");
  }
  if (
    input.correctedTotalDienstKm !== undefined &&
    input.correctedTotalDienstKm !== before.totalDienstKm
  ) {
    changed.push("totalDienstKm");
  }
  if (
    input.correctedTotalEffectivePatients !== undefined &&
    input.correctedTotalEffectivePatients !== before.totalEffectivePatients
  ) {
    changed.push("totalEffectivePatients");
  }
  if (
    input.correctedTotalRealTrips !== undefined &&
    input.correctedTotalRealTrips !== before.totalRealTrips
  ) {
    changed.push("totalRealTrips");
  }
  return changed;
}

// ── Effective summary builder ─────────────────────────────────────────────────

function buildEffectiveWorkdaySummary(
  summary: IWorkdaySummary,
  activeCorrection: IWorkdaySummaryCorrection | null,
): EffectiveWorkdaySummary {
  if (!summary) {
    throw new OperationalRecoveryError("WorkdaySummary not found", 404);
  }

  const originalValues: OriginalWorkdayValues = {
    finalKm: summary.finalKm,
    totalDienstKm: summary.totalDienstKm,
    totalEffectivePatients: summary.totalEffectivePatients,
    totalRealTrips: summary.totalRealTrips,
  };

  if (!activeCorrection) {
    return {
      summaryId: String(summary._id),
      date: summary.date,
      assignmentId: summary.assignmentId,
      companyId: summary.companyId ? String(summary.companyId) : null,
      driver: String(summary.driver),
      medic: String(summary.medic),
      isFinalClosure: summary.isFinalClosure,
      isReviewed: summary.isReviewed,
      finalKm: summary.finalKm,
      totalDienstKm: summary.totalDienstKm,
      totalEffectivePatients: summary.totalEffectivePatients,
      totalRealTrips: summary.totalRealTrips,
      hasCorrectedValues: false,
      activeCorrection: null,
      originalValues: null,
    };
  }

  return {
    summaryId: String(summary._id),
    date: summary.date,
    assignmentId: summary.assignmentId,
    companyId: summary.companyId ? String(summary.companyId) : null,
    driver: String(summary.driver),
    medic: String(summary.medic),
    isFinalClosure: summary.isFinalClosure,
    isReviewed: summary.isReviewed,
    finalKm: activeCorrection.correctedFinalKm ?? summary.finalKm,
    totalDienstKm:
      activeCorrection.correctedTotalDienstKm ?? summary.totalDienstKm,
    totalEffectivePatients:
      activeCorrection.correctedTotalEffectivePatients ??
      summary.totalEffectivePatients,
    totalRealTrips:
      activeCorrection.correctedTotalRealTrips ?? summary.totalRealTrips,
    hasCorrectedValues: true,
    activeCorrection,
    originalValues,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Creates a WorkdaySummaryCorrection for a final WorkdaySummary.
 *
 * Multi-tenant: validates that the WorkdaySummary belongs to the admin's company.
 * Immutability: the original WorkdaySummary is never modified.
 * Audit: writes an OperationalRecoveryEvent alongside the correction.
 */
export async function createWorkdaySummaryCorrection(
  input: CreateWorkdaySummaryCorrectionInput,
): Promise<CreateWorkdaySummaryCorrectionResult> {
  // ── 1. Validate input ─────────────────────────────────────────────────────
  const companyId = requireValidObjectId(input.companyId, "companyId");
  const workdaySummaryId = requireValidObjectId(
    input.workdaySummaryId,
    "workdaySummaryId",
  );
  const actorUserId = requireValidObjectId(input.actorUserId, "actorUserId");
  assertAdminRole(input.actorRole);
  requireNonEmptyString(input.correctionReason, "correctionReason");
  assertHasAtLeastOneCorrectedField(input);

  const praemienImpact = assertEnumImpact(
    input.praemienImpact,
    RECOVERY_PRAEMIEN_IMPACTS,
    "praemienImpact",
  ) as PraemienImpact;
  const payrollImpact = assertEnumImpact(
    input.payrollImpact,
    RECOVERY_PAYROLL_IMPACTS,
    "payrollImpact",
  ) as PayrollImpact;

  // ── 2. Load WorkdaySummary ────────────────────────────────────────────────
  const summary = await WorkdaySummary.findById(workdaySummaryId);
  if (!summary) {
    throw new OperationalRecoveryError(
      "WorkdaySummary not found",
      404,
    );
  }

  // ── 3. Tenant verification ────────────────────────────────────────────────
  verifyWorkdaySummaryTenant(summary.companyId, companyId);

  // ── 4. Eligibility check ──────────────────────────────────────────────────
  if (!summary.isFinalClosure) {
    throw new OperationalRecoveryError(
      "Only final WorkdaySummaries are eligible for correction",
      400,
    );
  }

  // ── 5. Find existing active correction ───────────────────────────────────
  const existingActiveCorrection =
    await WorkdaySummaryCorrection.findOne({
      originalSummaryId: new mongoose.Types.ObjectId(workdaySummaryId),
      companyId: new mongoose.Types.ObjectId(companyId),
      status: CORRECTION_STATUS.ACTIVE,
    });

  // ── 6. Compute before/after snapshots for audit event ────────────────────
  const prevEffectiveValues: OriginalWorkdayValues = {
    finalKm:
      existingActiveCorrection?.correctedFinalKm ?? summary.finalKm,
    totalDienstKm:
      existingActiveCorrection?.correctedTotalDienstKm ?? summary.totalDienstKm,
    totalEffectivePatients:
      existingActiveCorrection?.correctedTotalEffectivePatients ??
      summary.totalEffectivePatients,
    totalRealTrips:
      existingActiveCorrection?.correctedTotalRealTrips ?? summary.totalRealTrips,
  };

  const newEffectiveValues: OriginalWorkdayValues = {
    finalKm: input.correctedFinalKm ?? prevEffectiveValues.finalKm,
    totalDienstKm:
      input.correctedTotalDienstKm ?? prevEffectiveValues.totalDienstKm,
    totalEffectivePatients:
      input.correctedTotalEffectivePatients ??
      prevEffectiveValues.totalEffectivePatients,
    totalRealTrips:
      input.correctedTotalRealTrips ?? prevEffectiveValues.totalRealTrips,
  };

  const changedFields = computeChangedFields(prevEffectiveValues, input);

  const beforeSnapshot = buildWorkdaySnapshot({
    date: summary.date,
    isFinalClosure: summary.isFinalClosure,
    ...prevEffectiveValues,
  });
  const afterSnapshot = buildWorkdaySnapshot({
    date: summary.date,
    isFinalClosure: summary.isFinalClosure,
    ...newEffectiveValues,
  });

  // ── 7. Supersede previous active correction ───────────────────────────────
  let superseded = false;
  if (existingActiveCorrection) {
    await WorkdaySummaryCorrection.updateOne(
      { _id: existingActiveCorrection._id },
      { $set: { status: CORRECTION_STATUS.SUPERSEDED } },
    );
    superseded = true;
  }

  // ── 8. Create new correction ──────────────────────────────────────────────
  const workerIds: mongoose.Types.ObjectId[] = [];
  if (summary.driver) {
    workerIds.push(new mongoose.Types.ObjectId(String(summary.driver)));
  }
  if (summary.medic) {
    workerIds.push(new mongoose.Types.ObjectId(String(summary.medic)));
  }

  const correction = await WorkdaySummaryCorrection.create({
    originalSummaryId: new mongoose.Types.ObjectId(workdaySummaryId),
    companyId: new mongoose.Types.ObjectId(companyId),
    assignmentId: summary.assignmentId,
    date: summary.date,
    workerIds: workerIds.length > 0 ? workerIds : undefined,
    correctedFinalKm: input.correctedFinalKm,
    correctedTotalDienstKm: input.correctedTotalDienstKm,
    correctedTotalEffectivePatients: input.correctedTotalEffectivePatients,
    correctedTotalRealTrips: input.correctedTotalRealTrips,
    correctionReason: input.correctionReason.trim(),
    correctionNote: input.correctionNote?.trim() || undefined,
    correctedBy: new mongoose.Types.ObjectId(actorUserId),
    correctedAt: new Date(),
    praemienImpact,
    payrollImpact,
    status: CORRECTION_STATUS.ACTIVE,
  });

  // ── 9. Record immutable audit event ───────────────────────────────────────
  let recoveryEvent = null;
  try {
    recoveryEvent = await recordRecoveryEvent({
      companyId,
      moduleKey: MODULE_KEYS.WORKDAY,
      entityType: RECOVERY_ENTITY_TYPE.WORKDAY_SUMMARY,
      entityId: workdaySummaryId,
      entityLabel: `WorkdaySummary ${summary.date} (${summary.assignmentId})`,
      action: RECOVERY_ACTION_TYPE.CORRECTED,
      actorUserId,
      actorRole: input.actorRole,
      reason: input.correctionReason.trim(),
      beforeSummary: beforeSnapshot,
      afterSummary: afterSnapshot,
      changedFields: changedFields.length > 0 ? changedFields : undefined,
      metadata: {
        source: "workday_recovery",
        correctionId: String(correction._id),
        supersededPreviousCorrection: superseded,
      },
      severity: RECOVERY_SEVERITY.WARNING,
      relatedWorkdaySummaryId: workdaySummaryId,
      relatedAssignmentId: summary.assignmentId,
      relatedDate: summary.date,
      relatedWorkerId:
        workerIds.length > 0 ? String(workerIds[0]) : undefined,
      praemienImpact,
      payrollImpact,
    });

    // ── 10. Link recoveryEventId back to correction ────────────────────────
    await WorkdaySummaryCorrection.updateOne(
      { _id: correction._id },
      { $set: { recoveryEventId: recoveryEvent._id } },
    );
    (correction as IWorkdaySummaryCorrection).recoveryEventId =
      recoveryEvent._id as mongoose.Types.ObjectId;
  } catch (eventErr) {
    // Recovery event failure does not roll back the correction.
    // The correction stands; the audit trail gap is acceptable over data loss.
    // TODO Phase 3.x: consider compensation / retry queue for event recording failures.
    console.error(
      "[WorkdayRecovery] Failed to record OperationalRecoveryEvent for correction",
      String(correction._id),
      eventErr,
    );
  }

  // ── 11. Create PraemienImpactResolution when praemienImpact = "possible" ────
  // Only when a saved MonthlyPraemie snapshot already exists for the worker/period.
  // Open months (no snapshot) are skipped — praemien are still live/dynamic.
  // Failures are non-fatal: the correction is already committed.
  if (praemienImpact === "possible" && workerIds.length > 0) {
    const { year, month } = parseDateToYearMonth(summary.date);
    for (const wid of workerIds) {
      MonthlyPraemie.findOne({
        companyId: new mongoose.Types.ObjectId(companyId),
        userId: wid,
        year,
        month,
      })
        .then((savedPraemie) => {
          if (!savedPraemie) {
            // Open month — praemien are still live. No resolution needed.
            return null;
          }
          return createPraemienImpactResolution({
            companyId,
            workerId: String(wid),
            year,
            month,
            relatedWorkdaySummaryId: workdaySummaryId,
            relatedWorkdaySummaryCorrectionId: String(correction._id),
            beforeValue: prevEffectiveValues.totalEffectivePatients,
            afterValue: newEffectiveValues.totalEffectivePatients,
            reason: input.correctionReason.trim(),
            actorUserId,
            actorRole: input.actorRole,
          });
        })
        .catch((err: unknown) => {
          console.error(
            "[WorkdayRecovery] Failed to create PraemienImpactResolution for worker",
            String(wid),
            err,
          );
        });
    }
  }

  // ── 12. Build effective summary ───────────────────────────────────────────
  const refreshedCorrection = (await WorkdaySummaryCorrection.findById(
    correction._id,
  )) as IWorkdaySummaryCorrection;

  const effective = buildEffectiveWorkdaySummary(summary, refreshedCorrection);

  return { correction: refreshedCorrection, effective, superseded };
}

/**
 * Returns the effective view of a WorkdaySummary.
 *
 * - If no active correction exists: returns original values.
 * - If an active correction exists: returns corrected/effective values.
 * - Never mutates the original WorkdaySummary.
 */
export async function getEffectiveWorkdaySummary(
  input: GetEffectiveWorkdaySummaryInput,
): Promise<EffectiveWorkdaySummary> {
  const companyId = requireValidObjectId(input.companyId, "companyId");
  const workdaySummaryId = requireValidObjectId(
    input.workdaySummaryId,
    "workdaySummaryId",
  );

  const summary = await WorkdaySummary.findById(workdaySummaryId);
  if (!summary) {
    throw new OperationalRecoveryError("WorkdaySummary not found", 404);
  }

  verifyWorkdaySummaryTenant(summary.companyId, companyId);

  const activeCorrection = await WorkdaySummaryCorrection.findOne({
    originalSummaryId: new mongoose.Types.ObjectId(workdaySummaryId),
    companyId: new mongoose.Types.ObjectId(companyId),
    status: CORRECTION_STATUS.ACTIVE,
  });

  return buildEffectiveWorkdaySummary(summary, activeCorrection);
}
