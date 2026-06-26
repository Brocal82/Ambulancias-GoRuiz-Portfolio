/**
 * Operational Recovery — Phase 1 infrastructure (service contract + DB).
 */
import mongoose from "mongoose";
import { env } from "../config/env";
import {
  RECOVERY_ACTION_TYPE,
  RECOVERY_ENTITY_TYPE,
  RECOVERY_PAYROLL_IMPACT,
  RECOVERY_PRAEMIEN_IMPACT,
  RECOVERY_SEVERITY,
  OperationalRecoveryEvent,
  OperationalRecoveryError,
  assertRecoveryEventTenant,
  recordRecoveryEvent,
} from "../modules/operational-recovery";
import { CompanyValidationError } from "../utils/requireCompany";

function minimalInput(overrides: Record<string, unknown> = {}) {
  const companyId = new mongoose.Types.ObjectId().toString();
  const actorUserId = new mongoose.Types.ObjectId().toString();
  return {
    companyId,
    moduleKey: "workday",
    entityType: RECOVERY_ENTITY_TYPE.TRIP,
    entityId: new mongoose.Types.ObjectId().toString(),
    action: RECOVERY_ACTION_TYPE.CORRECTED,
    actorUserId,
    actorRole: "admin",
    ...overrides,
  };
}

describe("recordRecoveryEvent contract", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  afterEach(async () => {
    await OperationalRecoveryEvent.collection.deleteMany({});
  });

  it("rejects missing companyId", async () => {
    const input = minimalInput({ companyId: "" });
    await expect(recordRecoveryEvent(input)).rejects.toBeInstanceOf(
      OperationalRecoveryError,
    );
  });

  it("rejects invalid companyId", async () => {
    const input = minimalInput({ companyId: "not-an-object-id" });
    await expect(recordRecoveryEvent(input)).rejects.toMatchObject({
      message: expect.stringContaining("companyId"),
    });
  });

  it("rejects missing moduleKey, entityType, action, actor fields", async () => {
    await expect(
      recordRecoveryEvent(minimalInput({ moduleKey: "" })),
    ).rejects.toBeInstanceOf(OperationalRecoveryError);
    await expect(
      recordRecoveryEvent(
        minimalInput({ entityType: "INVALID" as typeof RECOVERY_ENTITY_TYPE.TRIP }),
      ),
    ).rejects.toBeInstanceOf(OperationalRecoveryError);
    await expect(
      recordRecoveryEvent(minimalInput({ action: "INVALID" as typeof RECOVERY_ACTION_TYPE.CORRECTED })),
    ).rejects.toBeInstanceOf(OperationalRecoveryError);
    await expect(
      recordRecoveryEvent(minimalInput({ actorUserId: "" })),
    ).rejects.toBeInstanceOf(OperationalRecoveryError);
    await expect(
      recordRecoveryEvent(minimalInput({ actorRole: "" })),
    ).rejects.toBeInstanceOf(OperationalRecoveryError);
  });

  it("writes an immutable event with defaults and redacted summaries", async () => {
    const input = minimalInput({
      entityLabel: "Trip #12",
      reason: "Clock-out correction",
      beforeSummary: {
        status: "open",
        patientName: "Must not persist",
        fileUrl: "/uploads/secret.pdf",
      },
      afterSummary: {
        status: "closed",
        address: "Hidden",
      },
      changedFields: ["status"],
      metadata: { attempt: 1, patientName: "hidden" },
      severity: RECOVERY_SEVERITY.WARNING,
      payrollImpact: RECOVERY_PAYROLL_IMPACT.POSSIBLE,
      praemienImpact: RECOVERY_PRAEMIEN_IMPACT.NONE,
    });

    const event = await recordRecoveryEvent(input);

    expect(String(event.companyId)).toBe(input.companyId);
    expect(event.moduleKey).toBe("workday");
    expect(event.entityType).toBe(RECOVERY_ENTITY_TYPE.TRIP);
    expect(event.action).toBe(RECOVERY_ACTION_TYPE.CORRECTED);
    expect(event.severity).toBe("warning");
    expect(event.payrollImpact).toBe("possible");
    expect(event.praemienImpact).toBe("none");
    expect(event.status).toBe("recorded");
    expect(event.beforeSummary).toEqual({ status: "open" });
    expect(event.afterSummary).toEqual({ status: "closed" });
    expect(event.metadata).toEqual({ attempt: 1 });
    expect(event.changedFields).toEqual(["status"]);
  });

  it("blocks update and delete mutations on persisted events", async () => {
    const event = await recordRecoveryEvent(minimalInput());
    const id = event._id;

    await expect(
      OperationalRecoveryEvent.updateOne({ _id: id }, { reason: "changed" }),
    ).rejects.toThrow("append-only and immutable");

    await expect(
      OperationalRecoveryEvent.deleteOne({ _id: id }),
    ).rejects.toThrow("append-only and immutable");
  });

  it("scopes events by companyId for tenant safety checks", async () => {
    const companyA = new mongoose.Types.ObjectId().toString();
    const companyB = new mongoose.Types.ObjectId().toString();
    const event = await recordRecoveryEvent(minimalInput({ companyId: companyA }));

    expect(() => assertRecoveryEventTenant(event, companyA)).not.toThrow();
    expect(() => assertRecoveryEventTenant(event, companyB)).toThrow(
      CompanyValidationError,
    );
    expect(() => assertRecoveryEventTenant(event, "")).toThrow(
      CompanyValidationError,
    );
  });

  it("stores related ObjectId references when provided", async () => {
    const workerId = new mongoose.Types.ObjectId().toString();
    const tripId = new mongoose.Types.ObjectId().toString();
    const event = await recordRecoveryEvent(
      minimalInput({
        relatedWorkerId: workerId,
        relatedTripId: tripId,
        relatedDate: "2026-06-26",
      }),
    );

    expect(String(event.relatedWorkerId)).toBe(workerId);
    expect(String(event.relatedTripId)).toBe(tripId);
    expect(event.relatedDate).toBeInstanceOf(Date);
  });
});
