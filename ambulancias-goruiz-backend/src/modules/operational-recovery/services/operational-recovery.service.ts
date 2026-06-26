import mongoose from "mongoose";
import {
  RECOVERY_ACTION_TYPES,
  RECOVERY_ENTITY_TYPES,
  RECOVERY_PAYROLL_IMPACTS,
  RECOVERY_PRAEMIEN_IMPACTS,
  RECOVERY_SEVERITIES,
  RECOVERY_STATUS,
} from "../constants/operational-recovery.constants";
import OperationalRecoveryEvent, {
  type IOperationalRecoveryEvent,
} from "../models/operational-recovery-event.model";
import type { RecordRecoveryEventInput } from "../types/operational-recovery.types";
import {
  sanitizeRecoveryMetadata,
  sanitizeRecoverySnapshot,
} from "../utils/sanitize-recovery-snapshot.helper";
import { CompanyValidationError } from "../../../utils/requireCompany";

export class OperationalRecoveryError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = "OperationalRecoveryError";
  }
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new OperationalRecoveryError(`${field} is required`);
  }
  return value.trim();
}

function requireObjectId(value: unknown, field: string): mongoose.Types.ObjectId {
  const str = requireNonEmptyString(value, field);
  if (!mongoose.Types.ObjectId.isValid(str)) {
    throw new OperationalRecoveryError(`${field} must be a valid ObjectId`);
  }
  return new mongoose.Types.ObjectId(str);
}

function optionalObjectId(
  value: unknown,
  field: string,
): mongoose.Types.ObjectId | undefined {
  if (value == null || value === "") return undefined;
  return requireObjectId(value, field);
}

function optionalDate(value: unknown): Date | undefined {
  if (value == null || value === "") return undefined;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new OperationalRecoveryError("relatedDate must be a valid date");
    }
    return value;
  }
  const parsed = new Date(value as string);
  if (Number.isNaN(parsed.getTime())) {
    throw new OperationalRecoveryError("relatedDate must be a valid date");
  }
  return parsed;
}

function assertEnumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new OperationalRecoveryError(`${field} has an invalid value`);
  }
  return value as T;
}

/**
 * Records an immutable operational recovery event.
 * Internal-only — no HTTP routes expose this service.
 *
 * Multi-tenant: companyId is required and stored on every event.
 */
export async function recordRecoveryEvent(
  input: RecordRecoveryEventInput,
): Promise<IOperationalRecoveryEvent> {
  const companyId = requireObjectId(input.companyId, "companyId");
  const moduleKey = requireNonEmptyString(input.moduleKey, "moduleKey");
  const entityType = assertEnumValue(
    input.entityType,
    RECOVERY_ENTITY_TYPES,
    "entityType",
  );
  const entityId = requireNonEmptyString(input.entityId, "entityId");
  const action = assertEnumValue(input.action, RECOVERY_ACTION_TYPES, "action");
  const actorUserId = requireObjectId(input.actorUserId, "actorUserId");
  const actorRole = requireNonEmptyString(input.actorRole, "actorRole");

  const severity = input.severity
    ? assertEnumValue(input.severity, RECOVERY_SEVERITIES, "severity")
    : "info";
  const payrollImpact = input.payrollImpact
    ? assertEnumValue(input.payrollImpact, RECOVERY_PAYROLL_IMPACTS, "payrollImpact")
    : "none";
  const praemienImpact = input.praemienImpact
    ? assertEnumValue(input.praemienImpact, RECOVERY_PRAEMIEN_IMPACTS, "praemienImpact")
    : "none";

  const beforeSummary = sanitizeRecoverySnapshot(entityType, input.beforeSummary);
  const afterSummary = sanitizeRecoverySnapshot(entityType, input.afterSummary);
  const metadata = sanitizeRecoveryMetadata(input.metadata);

  const changedFields =
    input.changedFields?.map((f) => f.trim()).filter((f) => f.length > 0) ??
    undefined;

  try {
    return await OperationalRecoveryEvent.create({
      companyId,
      moduleKey,
      entityType,
      entityId,
      entityLabel: input.entityLabel?.trim() || undefined,
      action,
      actorUserId,
      actorRole,
      reason: input.reason?.trim() || undefined,
      beforeSummary,
      afterSummary,
      changedFields: changedFields?.length ? changedFields : undefined,
      metadata,
      severity,
      relatedWorkerId: optionalObjectId(input.relatedWorkerId, "relatedWorkerId"),
      relatedDate: optionalDate(input.relatedDate),
      relatedAssignmentId: input.relatedAssignmentId?.trim() || undefined,
      relatedDienstId: optionalObjectId(input.relatedDienstId, "relatedDienstId"),
      relatedWorkdaySummaryId: optionalObjectId(
        input.relatedWorkdaySummaryId,
        "relatedWorkdaySummaryId",
      ),
      relatedTripId: optionalObjectId(input.relatedTripId, "relatedTripId"),
      payrollImpact,
      praemienImpact,
      status: RECOVERY_STATUS.RECORDED,
    });
  } catch (err) {
    if (err instanceof mongoose.Error.ValidationError) {
      throw new OperationalRecoveryError(err.message);
    }
    throw err;
  }
}

/**
 * Ensures a recovery event belongs to the expected tenant.
 * Future read paths should call this before returning event data.
 */
export function assertRecoveryEventTenant(
  event: { companyId: unknown },
  expectedCompanyId: string,
): void {
  if (!expectedCompanyId || !mongoose.Types.ObjectId.isValid(expectedCompanyId)) {
    throw new CompanyValidationError(
      "No tienes permiso. Se requiere pertenecer a una empresa.",
    );
  }
  if (String(event.companyId) !== String(expectedCompanyId)) {
    throw new CompanyValidationError("Evento de recuperación no pertenece a esta empresa.");
  }
}
