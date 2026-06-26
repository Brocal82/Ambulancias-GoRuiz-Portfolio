/**
 * Operational Recovery — Phase 1 infrastructure (unit tests).
 */
import {
  RECOVERY_ACTION_TYPE,
  RECOVERY_ENTITY_TYPE,
  RECOVERY_SEVERITY,
} from "../modules/operational-recovery/constants/operational-recovery.constants";
import {
  FORBIDDEN_RECOVERY_KEYS,
  sanitizeRecoveryMetadata,
  sanitizeRecoverySnapshot,
} from "../modules/operational-recovery/utils/sanitize-recovery-snapshot.helper";

describe("sanitizeRecoverySnapshot", () => {
  it("keeps only allow-listed primitive fields for TRIP", () => {
    const result = sanitizeRecoverySnapshot(RECOVERY_ENTITY_TYPE.TRIP, {
      status: "completed",
      tripNumber: 42,
      patientName: "John Doe",
      address: "Secret St",
      fileUrl: "/uploads/payroll.pdf",
      nested: { foo: "bar" },
      unknownField: "drop me",
    });

    expect(result).toEqual({
      status: "completed",
      tripNumber: 42,
    });
  });

  it("returns undefined for empty or invalid snapshots", () => {
    expect(sanitizeRecoverySnapshot(RECOVERY_ENTITY_TYPE.TRIP, null)).toBeUndefined();
    expect(sanitizeRecoverySnapshot(RECOVERY_ENTITY_TYPE.TRIP, [])).toBeUndefined();
    expect(
      sanitizeRecoverySnapshot(RECOVERY_ENTITY_TYPE.TRIP, { patientName: "x" }),
    ).toBeUndefined();
  });

  it("uses entity-specific allow lists", () => {
    const payroll = sanitizeRecoverySnapshot(RECOVERY_ENTITY_TYPE.PAYROLL, {
      period: "2026-06",
      status: "draft",
      documentCount: 3,
      tripNumber: 99,
    });

    expect(payroll).toEqual({
      period: "2026-06",
      status: "draft",
      documentCount: 3,
    });
    expect(payroll).not.toHaveProperty("tripNumber");
  });
});

describe("sanitizeRecoveryMetadata", () => {
  it("keeps flat primitives and drops forbidden keys", () => {
    const result = sanitizeRecoveryMetadata({
      attempt: 1,
      source: "admin",
      patientName: "hidden",
      nested: { a: 1 },
    });

    expect(result).toEqual({
      attempt: 1,
      source: "admin",
    });
  });

  it("covers all forbidden recovery keys", () => {
    for (const key of FORBIDDEN_RECOVERY_KEYS) {
      const result = sanitizeRecoveryMetadata({ [key]: "value", safeKey: "ok" });
      expect(result).toEqual({ safeKey: "ok" });
    }
  });
});

describe("operational recovery enums", () => {
  it("exposes expected entity and action values", () => {
    expect(RECOVERY_ENTITY_TYPE.TRIP).toBe("TRIP");
    expect(RECOVERY_ACTION_TYPE.VOIDED).toBe("VOIDED");
    expect(RECOVERY_SEVERITY.CRITICAL).toBe("critical");
  });
});
