/**
 * Phase 2.2 — Absence Cleanup Repair Service.
 *
 * Removes stale Dienst assignments for a single accepted absence by delegating
 * to the existing clearUserFromDienstsInRange() utility.  Does NOT duplicate
 * cleanup logic; does NOT restore assignments after cancellation.
 *
 * Records OperationalRecoveryEvent on success (RERUN_CLEANUP) and on failure
 * (FAILED_RECOVERY_ATTEMPT).  Reuses the realtime websocket already emitted
 * by clearUserFromDienstsInRange() — no new socket events.
 *
 * Multi-tenant: all lookups are scoped by companyId.
 */

import mongoose from "mongoose";
import { DateTime } from "luxon";
import User from "../../users/models/user.model";
import VacationRequest from "../../vacation/models/vacation-request.model";
import SickLeave from "../../sick-leaves/models/sick-leave.model";
import { clearUserFromDienstsInRange } from "../../../utils/dienstClearUtils";
import { recordRecoveryEvent } from "./operational-recovery.service";
import {
  RECOVERY_ACTION_TYPE,
  RECOVERY_ENTITY_TYPE,
  RECOVERY_SEVERITY,
} from "../constants/operational-recovery.constants";
import { detectAbsenceInconsistencies } from "./absence-cleanup-detection.service";
import type {
  AbsenceType,
  RepairAbsenceInconsistencyInput,
  RepairResult,
} from "../types/absence-cleanup.types";

const ZONE = "Europe/Berlin";
const MODULE_KEY = "absence_cleanup_monitor";

// ── Internal helpers ──────────────────────────────────────────────────────────

type LoadedAbsence = {
  userId: string;
  startISO: string;
  endISO: string;
  status: string;
};

async function loadAbsence(
  absenceType: AbsenceType,
  absenceId: string,
): Promise<LoadedAbsence | null> {
  if (!mongoose.Types.ObjectId.isValid(absenceId)) return null;

  const toISO = (d: Date) =>
    DateTime.fromJSDate(d, { zone: ZONE }).startOf("day").toISODate()!;

  if (absenceType === "vacation") {
    const doc = await VacationRequest.findById(absenceId)
      .select("user startDate endDate status")
      .lean();
    if (!doc) return null;
    return {
      userId: String(doc.user),
      startISO: toISO(doc.startDate as Date),
      endISO: toISO(doc.endDate as Date),
      status: String(doc.status),
    };
  }

  if (absenceType === "sick") {
    const doc = await SickLeave.findById(absenceId)
      .select("user startDate endDate status")
      .lean();
    if (!doc) return null;
    return {
      userId: String(doc.user),
      startISO: toISO(doc.startDate as Date),
      endISO: toISO(doc.endDate as Date),
      status: String(doc.status),
    };
  }

  return null;
}

function failedResult(errorMessage: string): RepairResult {
  return {
    assignmentsTouched: 0,
    dienstsTouched: 0,
    alreadyClean: false,
    repairFailed: true,
    errorMessage,
    remainingInconsistencies: [],
  };
}

async function tryRecordFailedEvent(params: {
  companyId: string;
  absenceType: AbsenceType;
  absenceId: string;
  startISO: string;
  endISO: string;
  workerId: string;
  actorUserId: string;
  actorRole: string;
  errorMessage: string;
}): Promise<void> {
  try {
    await recordRecoveryEvent({
      companyId: params.companyId,
      moduleKey: MODULE_KEY,
      entityType: RECOVERY_ENTITY_TYPE.DIENST_ASSIGNMENT,
      entityId: params.absenceId,
      action: RECOVERY_ACTION_TYPE.FAILED_RECOVERY_ATTEMPT,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      severity: RECOVERY_SEVERITY.WARNING,
      metadata: {
        absenceType: params.absenceType,
        absenceId: params.absenceId,
        absenceStartDate: params.startISO,
        absenceEndDate: params.endISO,
        repairSource: MODULE_KEY,
        errorMessage: params.errorMessage,
      },
      relatedWorkerId: params.workerId,
      relatedDate: params.startISO,
    });
  } catch {
    // Swallow — do not let event-recording failure hide the original error.
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Repairs stale Dienst assignments for a single accepted absence.
 *
 * Flow:
 * 1. Verify the absence is still accepted and belongs to a member of companyId.
 * 2. Run clearUserFromDienstsInRange() (existing utility — no logic duplication).
 * 3. Re-scan the repaired period to confirm cleanup.
 * 4. Record RERUN_CLEANUP event (or FAILED_RECOVERY_ATTEMPT on error).
 *
 * NEVER restores assignments.  Restoration is always a dispatcher decision.
 */
export async function repairAbsenceInconsistency(
  input: RepairAbsenceInconsistencyInput,
): Promise<RepairResult> {
  const { companyId, workerId, absenceType, absenceId, actorUserId, actorRole } =
    input;

  // ── Validate required IDs ─────────────────────────────────────────────────
  if (!companyId || !mongoose.Types.ObjectId.isValid(companyId)) {
    return failedResult("Invalid companyId");
  }
  if (!workerId || !mongoose.Types.ObjectId.isValid(workerId)) {
    return failedResult("Invalid workerId");
  }
  if (!actorUserId || !mongoose.Types.ObjectId.isValid(actorUserId)) {
    return failedResult("Invalid actorUserId");
  }

  const companyOid = new mongoose.Types.ObjectId(companyId);

  // ── Load and validate absence ─────────────────────────────────────────────
  const absence = await loadAbsence(absenceType, absenceId);
  if (!absence) {
    return failedResult("Absence not found");
  }

  // Worker in the absence must match the supplied workerId.
  if (absence.userId !== workerId) {
    return failedResult("Worker does not match absence");
  }

  // Tenant isolation: worker must belong to companyId.
  const memberCheck = await User.findOne({
    _id: new mongoose.Types.ObjectId(workerId),
    companyId: companyOid,
  })
    .select("_id")
    .lean();
  if (!memberCheck) {
    return failedResult("Worker does not belong to this company");
  }

  // Absence must still be accepted (could have changed since the detection scan).
  if (absence.status !== "accepted") {
    return failedResult("Absence is no longer accepted");
  }

  const { startISO, endISO } = absence;

  // ── Run cleanup (delegate to existing utility) ────────────────────────────
  let cleanupStats: { assignmentsTouched: number; dienstsTouched: number };

  try {
    const raw = await clearUserFromDienstsInRange({
      userId: workerId,
      startISO,
      endISO,
    });
    cleanupStats = {
      assignmentsTouched: raw.assignmentsTouched,
      dienstsTouched: raw.diensteTouched,
    };
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Cleanup utility threw an unexpected error";

    await tryRecordFailedEvent({
      companyId,
      absenceType,
      absenceId,
      startISO,
      endISO,
      workerId,
      actorUserId,
      actorRole,
      errorMessage,
    });

    return {
      ...failedResult(errorMessage),
    };
  }

  // ── Re-scan to verify the period is now clean ─────────────────────────────
  const allInconsistencies = await detectAbsenceInconsistencies({
    companyId,
    fromDate: startISO,
    toDate: endISO,
  });
  // Filter to only inconsistencies that belong to this specific absence.
  const remainingInconsistencies = allInconsistencies.filter(
    (inc) => inc.workerId === workerId && inc.absenceId === absenceId,
  );

  const alreadyClean = cleanupStats.assignmentsTouched === 0;

  // ── Record successful recovery event ──────────────────────────────────────
  try {
    await recordRecoveryEvent({
      companyId,
      moduleKey: MODULE_KEY,
      entityType: RECOVERY_ENTITY_TYPE.DIENST_ASSIGNMENT,
      entityId: absenceId,
      action: RECOVERY_ACTION_TYPE.RERUN_CLEANUP,
      actorUserId,
      actorRole,
      severity: RECOVERY_SEVERITY.INFO,
      metadata: {
        absenceType,
        absenceId,
        absenceStartDate: startISO,
        absenceEndDate: endISO,
        assignmentsTouched: cleanupStats.assignmentsTouched,
        dienstsTouched: cleanupStats.dienstsTouched,
        repairSource: MODULE_KEY,
      },
      relatedWorkerId: workerId,
      relatedDate: startISO,
    });
  } catch {
    // Swallow — repair ran successfully; the audit event failure is non-fatal.
  }

  return {
    assignmentsTouched: cleanupStats.assignmentsTouched,
    dienstsTouched: cleanupStats.dienstsTouched,
    alreadyClean,
    repairFailed: false,
    remainingInconsistencies,
  };
}
