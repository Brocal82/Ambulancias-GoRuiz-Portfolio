import {
  RECOVERY_ENTITY_TYPE,
  type RecoveryEntityType,
} from "../constants/operational-recovery.constants";
import type { RecoverySnapshot } from "../types/operational-recovery.types";

/** Keys that must never appear in recovery snapshots or metadata. */
export const FORBIDDEN_RECOVERY_KEYS = new Set([
  "patientName",
  "patient",
  "firstName",
  "lastName",
  "fullName",
  "address",
  "street",
  "city",
  "zip",
  "postalCode",
  "fileName",
  "filename",
  "fileUrl",
  "filePath",
  "pdf",
  "documentUrl",
  "email",
  "phone",
  "phoneNumber",
]);

const ALLOWED_SNAPSHOT_FIELDS: Record<RecoveryEntityType, readonly string[]> = {
  [RECOVERY_ENTITY_TYPE.TRIP]: [
    "status",
    "tripNumber",
    "startTime",
    "endTime",
    "vehicleId",
    "workerCount",
    "isVoided",
  ],
  [RECOVERY_ENTITY_TYPE.WORKDAY_SUMMARY]: [
    "status",
    "date",
    "workerId",
    "totalHours",
    "shiftStatus",
    "isClosed",
  ],
  [RECOVERY_ENTITY_TYPE.DIENST_ASSIGNMENT]: [
    "assignmentId",
    "dienstNumber",
    "date",
    "role",
    "status",
    "workerId",
  ],
  [RECOVERY_ENTITY_TYPE.PRAEMIE]: [
    "amount",
    "date",
    "type",
    "status",
    "workerId",
  ],
  [RECOVERY_ENTITY_TYPE.PAYROLL]: [
    "period",
    "status",
    "documentCount",
    "workerId",
    "year",
    "month",
  ],
};

function isPrimitive(value: unknown): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

/**
 * Sanitizes a recovery snapshot to a small allow-listed subset.
 * Unknown properties and forbidden PII keys are dropped.
 */
export function sanitizeRecoverySnapshot(
  entityType: RecoveryEntityType,
  snapshot: unknown,
): RecoverySnapshot | undefined {
  if (snapshot == null) return undefined;
  if (typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return undefined;
  }

  const allowed = new Set(ALLOWED_SNAPSHOT_FIELDS[entityType]);
  const input = snapshot as Record<string, unknown>;
  const output: RecoverySnapshot = {};

  for (const [key, value] of Object.entries(input)) {
    if (FORBIDDEN_RECOVERY_KEYS.has(key)) continue;
    if (!allowed.has(key)) continue;
    if (!isPrimitive(value)) continue;
    output[key] = value;
  }

  return Object.keys(output).length > 0 ? output : undefined;
}

/**
 * Sanitizes optional metadata to flat primitive key/value pairs.
 * Nested objects and forbidden keys are rejected.
 */
export function sanitizeRecoveryMetadata(
  metadata: unknown,
): RecoverySnapshot | undefined {
  if (metadata == null) return undefined;
  if (typeof metadata !== "object" || Array.isArray(metadata)) {
    return undefined;
  }

  const input = metadata as Record<string, unknown>;
  const output: RecoverySnapshot = {};

  for (const [key, value] of Object.entries(input)) {
    if (FORBIDDEN_RECOVERY_KEYS.has(key)) continue;
    if (!isPrimitive(value)) continue;
    output[key] = value;
  }

  return Object.keys(output).length > 0 ? output : undefined;
}
