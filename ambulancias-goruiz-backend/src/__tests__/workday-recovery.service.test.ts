/**
 * Phase 3.1 — Workday Recovery service tests.
 *
 * Covers:
 *   - create correction for same-company WorkdaySummary
 *   - reject correction for other-company summary
 *   - require reason
 *   - require at least one corrected field
 *   - require admin role
 *   - original WorkdaySummary is never mutated
 *   - active correction returned as effective state
 *   - no correction returns original effective state
 *   - second correction supersedes previous correction
 *   - OperationalRecoveryEvent is created
 *   - recovery event uses sanitized before/after summaries (no PII)
 *   - invalid summary id fails
 *   - missing companyId fails
 *   - praemien/payroll impact fields stored
 *   - tenant isolation (cross-company rejected)
 *   - non-final summary rejected
 */
import mongoose from "mongoose";
import { env } from "../config/env";
import WorkdaySummary, {
  type IWorkdaySummary,
} from "../modules/workday-summary/models/workday-summary.model";
import {
  WorkdaySummaryCorrection,
  OperationalRecoveryEvent,
  CORRECTION_STATUS,
  RECOVERY_PAYROLL_IMPACT,
  RECOVERY_PRAEMIEN_IMPACT,
  OperationalRecoveryError,
  createWorkdaySummaryCorrection,
  getEffectiveWorkdaySummary,
} from "../modules/operational-recovery";

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeObjectId() {
  return new mongoose.Types.ObjectId();
}

function makeSummaryFixture(overrides: Record<string, unknown> = {}) {
  const companyId = makeObjectId();
  const driver = makeObjectId();
  const medic = makeObjectId();
  const ambulanceId = makeObjectId();
  return {
    companyId,
    driver,
    medic,
    ambulanceId,
    ambulanceNumber: "AMB-001",
    date: "2026-06-01",
    assignmentId: new mongoose.Types.ObjectId().toString(),
    initialKm: 10000,
    finalKm: 10200,
    totalDienstKm: 200,
    trips: [],
    isFinalClosure: true,
    totalEffectivePatients: 5,
    totalRealTrips: 4,
    isReviewed: false,
    ...overrides,
  };
}

function makeMinimalCorrectionInput(
  companyId: string,
  workdaySummaryId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    companyId,
    workdaySummaryId,
    actorUserId: makeObjectId().toString(),
    actorRole: "admin",
    correctedTotalEffectivePatients: 6,
    correctionReason: "Miscounted patients after review",
    praemienImpact: RECOVERY_PRAEMIEN_IMPACT.POSSIBLE,
    payrollImpact: RECOVERY_PAYROLL_IMPACT.NONE,
    ...overrides,
  };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("createWorkdaySummaryCorrection", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  afterEach(async () => {
    await WorkdaySummary.collection.deleteMany({});
    await WorkdaySummaryCorrection.collection.deleteMany({});
    await OperationalRecoveryEvent.collection.deleteMany({});
  });

  // ── Input validation ───────────────────────────────────────────────────────

  it("rejects missing companyId", async () => {
    await expect(
      createWorkdaySummaryCorrection(
        makeMinimalCorrectionInput("", makeObjectId().toString()) as Parameters<typeof createWorkdaySummaryCorrection>[0],
      ),
    ).rejects.toBeInstanceOf(OperationalRecoveryError);
  });

  it("rejects invalid companyId", async () => {
    await expect(
      createWorkdaySummaryCorrection(
        makeMinimalCorrectionInput("not-an-objectid", makeObjectId().toString()) as Parameters<typeof createWorkdaySummaryCorrection>[0],
      ),
    ).rejects.toMatchObject({ message: expect.stringContaining("companyId") });
  });

  it("rejects invalid workdaySummaryId", async () => {
    const companyId = makeObjectId().toString();
    await expect(
      createWorkdaySummaryCorrection(
        makeMinimalCorrectionInput(companyId, "not-valid") as Parameters<typeof createWorkdaySummaryCorrection>[0],
      ),
    ).rejects.toMatchObject({
      message: expect.stringContaining("workdaySummaryId"),
    });
  });

  it("rejects non-existent workdaySummaryId", async () => {
    const companyId = makeObjectId().toString();
    await expect(
      createWorkdaySummaryCorrection(
        makeMinimalCorrectionInput(
          companyId,
          makeObjectId().toString(),
        ) as Parameters<typeof createWorkdaySummaryCorrection>[0],
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("requires correctionReason", async () => {
    const fixture = makeSummaryFixture();
    const summary = await WorkdaySummary.create(fixture);
    await expect(
      createWorkdaySummaryCorrection(
        makeMinimalCorrectionInput(
          String(fixture.companyId),
          String(summary._id),
          { correctionReason: "  " },
        ) as Parameters<typeof createWorkdaySummaryCorrection>[0],
      ),
    ).rejects.toBeInstanceOf(OperationalRecoveryError);
  });

  it("requires at least one corrected field", async () => {
    const fixture = makeSummaryFixture();
    const summary = await WorkdaySummary.create(fixture);
    await expect(
      createWorkdaySummaryCorrection({
        companyId: String(fixture.companyId),
        workdaySummaryId: String(summary._id),
        actorUserId: makeObjectId().toString(),
        actorRole: "admin",
        correctionReason: "Admin override",
        praemienImpact: RECOVERY_PRAEMIEN_IMPACT.NONE,
        payrollImpact: RECOVERY_PAYROLL_IMPACT.NONE,
      }),
    ).rejects.toBeInstanceOf(OperationalRecoveryError);
  });

  it("requires admin role", async () => {
    const fixture = makeSummaryFixture();
    const summary = await WorkdaySummary.create(fixture);
    await expect(
      createWorkdaySummaryCorrection(
        makeMinimalCorrectionInput(
          String(fixture.companyId),
          String(summary._id),
          { actorRole: "worker" },
        ) as Parameters<typeof createWorkdaySummaryCorrection>[0],
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects non-final WorkdaySummary", async () => {
    const fixture = makeSummaryFixture({ isFinalClosure: false });
    const summary = await WorkdaySummary.create(fixture);
    await expect(
      createWorkdaySummaryCorrection(
        makeMinimalCorrectionInput(
          String(fixture.companyId),
          String(summary._id),
        ) as Parameters<typeof createWorkdaySummaryCorrection>[0],
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  // ── Tenant isolation ───────────────────────────────────────────────────────

  it("rejects correction for other-company summary (tenant isolation)", async () => {
    const fixture = makeSummaryFixture();
    const summary = await WorkdaySummary.create(fixture);
    const otherCompanyId = makeObjectId().toString();

    await expect(
      createWorkdaySummaryCorrection(
        makeMinimalCorrectionInput(
          otherCompanyId,
          String(summary._id),
        ) as Parameters<typeof createWorkdaySummaryCorrection>[0],
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("does not leak corrections across companies", async () => {
    const fixtureA = makeSummaryFixture();
    const fixtureB = makeSummaryFixture();
    const summaryA = await WorkdaySummary.create(fixtureA);
    const summaryB = await WorkdaySummary.create(fixtureB);

    await createWorkdaySummaryCorrection(
      makeMinimalCorrectionInput(
        String(fixtureA.companyId),
        String(summaryA._id),
        { correctedTotalEffectivePatients: 7 },
      ) as Parameters<typeof createWorkdaySummaryCorrection>[0],
    );

    // Company B admin fetches effective summary for A's summary id → 403
    await expect(
      getEffectiveWorkdaySummary({
        workdaySummaryId: String(summaryA._id),
        companyId: String(fixtureB.companyId),
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    // Company B's own summary B has no correction
    const effectiveB = await getEffectiveWorkdaySummary({
      workdaySummaryId: String(summaryB._id),
      companyId: String(fixtureB.companyId),
    });
    expect(effectiveB.hasCorrectedValues).toBe(false);
  });

  // ── Correction creation ────────────────────────────────────────────────────

  it("creates correction and returns active status", async () => {
    const fixture = makeSummaryFixture();
    const summary = await WorkdaySummary.create(fixture);

    const result = await createWorkdaySummaryCorrection(
      makeMinimalCorrectionInput(
        String(fixture.companyId),
        String(summary._id),
        {
          correctedTotalEffectivePatients: 7,
          correctedTotalRealTrips: 6,
          correctionNote: "Reviewed dispatch log",
        },
      ) as Parameters<typeof createWorkdaySummaryCorrection>[0],
    );

    expect(result.correction.status).toBe(CORRECTION_STATUS.ACTIVE);
    expect(String(result.correction.originalSummaryId)).toBe(String(summary._id));
    expect(String(result.correction.companyId)).toBe(String(fixture.companyId));
    expect(result.correction.correctedTotalEffectivePatients).toBe(7);
    expect(result.correction.correctedTotalRealTrips).toBe(6);
    expect(result.correction.correctionNote).toBe("Reviewed dispatch log");
    expect(result.superseded).toBe(false);
  });

  it("stores praemienImpact and payrollImpact on correction", async () => {
    const fixture = makeSummaryFixture();
    const summary = await WorkdaySummary.create(fixture);

    const result = await createWorkdaySummaryCorrection(
      makeMinimalCorrectionInput(
        String(fixture.companyId),
        String(summary._id),
        {
          praemienImpact: RECOVERY_PRAEMIEN_IMPACT.POSSIBLE,
          payrollImpact: RECOVERY_PAYROLL_IMPACT.POSSIBLE,
        },
      ) as Parameters<typeof createWorkdaySummaryCorrection>[0],
    );

    expect(result.correction.praemienImpact).toBe("possible");
    expect(result.correction.payrollImpact).toBe("possible");
  });

  it("stores workerIds from driver and medic", async () => {
    const fixture = makeSummaryFixture();
    const summary = await WorkdaySummary.create(fixture);

    const result = await createWorkdaySummaryCorrection(
      makeMinimalCorrectionInput(
        String(fixture.companyId),
        String(summary._id),
      ) as Parameters<typeof createWorkdaySummaryCorrection>[0],
    );

    expect(result.correction.workerIds).toBeDefined();
    expect(result.correction.workerIds?.map(String)).toContain(
      String(fixture.driver),
    );
    expect(result.correction.workerIds?.map(String)).toContain(
      String(fixture.medic),
    );
  });

  // ── Immutability ───────────────────────────────────────────────────────────

  it("does NOT mutate the original WorkdaySummary", async () => {
    const fixture = makeSummaryFixture();
    const summary = await WorkdaySummary.create(fixture);
    const originalDoc = await WorkdaySummary.findById(summary._id).lean<IWorkdaySummary>();

    await createWorkdaySummaryCorrection(
      makeMinimalCorrectionInput(
        String(fixture.companyId),
        String(summary._id),
        { correctedTotalEffectivePatients: 99, correctedFinalKm: 99999 },
      ) as Parameters<typeof createWorkdaySummaryCorrection>[0],
    );

    const afterDoc = await WorkdaySummary.findById(summary._id).lean<IWorkdaySummary>();
    expect(afterDoc?.totalEffectivePatients).toBe(
      originalDoc?.totalEffectivePatients,
    );
    expect(afterDoc?.finalKm).toBe(originalDoc?.finalKm);
    expect(afterDoc?.totalDienstKm).toBe(originalDoc?.totalDienstKm);
    expect(afterDoc?.totalRealTrips).toBe(originalDoc?.totalRealTrips);
  });

  // ── Supersession ───────────────────────────────────────────────────────────

  it("second correction supersedes the previous active correction", async () => {
    const fixture = makeSummaryFixture();
    const summary = await WorkdaySummary.create(fixture);

    const result1 = await createWorkdaySummaryCorrection(
      makeMinimalCorrectionInput(
        String(fixture.companyId),
        String(summary._id),
        { correctedTotalEffectivePatients: 6 },
      ) as Parameters<typeof createWorkdaySummaryCorrection>[0],
    );
    expect(result1.superseded).toBe(false);
    expect(result1.correction.status).toBe(CORRECTION_STATUS.ACTIVE);

    const result2 = await createWorkdaySummaryCorrection(
      makeMinimalCorrectionInput(
        String(fixture.companyId),
        String(summary._id),
        { correctedTotalEffectivePatients: 7, correctionReason: "Updated count" },
      ) as Parameters<typeof createWorkdaySummaryCorrection>[0],
    );

    expect(result2.superseded).toBe(true);
    expect(result2.correction.status).toBe(CORRECTION_STATUS.ACTIVE);

    // First correction is now superseded
    const firstCorrectionReloaded = await WorkdaySummaryCorrection.findById(
      result1.correction._id,
    );
    expect(firstCorrectionReloaded?.status).toBe(CORRECTION_STATUS.SUPERSEDED);

    // Only one active correction exists for this summary
    const activeCount = await WorkdaySummaryCorrection.countDocuments({
      originalSummaryId: summary._id,
      status: CORRECTION_STATUS.ACTIVE,
    });
    expect(activeCount).toBe(1);
  });

  it("does not silently overwrite correction history — keeps superseded records", async () => {
    const fixture = makeSummaryFixture();
    const summary = await WorkdaySummary.create(fixture);

    await createWorkdaySummaryCorrection(
      makeMinimalCorrectionInput(
        String(fixture.companyId),
        String(summary._id),
        { correctedTotalEffectivePatients: 6 },
      ) as Parameters<typeof createWorkdaySummaryCorrection>[0],
    );
    await createWorkdaySummaryCorrection(
      makeMinimalCorrectionInput(
        String(fixture.companyId),
        String(summary._id),
        { correctedTotalEffectivePatients: 7, correctionReason: "Re-check" },
      ) as Parameters<typeof createWorkdaySummaryCorrection>[0],
    );

    const total = await WorkdaySummaryCorrection.countDocuments({
      originalSummaryId: summary._id,
    });
    expect(total).toBe(2); // active + superseded both kept
  });

  // ── OperationalRecoveryEvent ───────────────────────────────────────────────

  it("creates an OperationalRecoveryEvent when correction is created", async () => {
    const fixture = makeSummaryFixture();
    const summary = await WorkdaySummary.create(fixture);

    const result = await createWorkdaySummaryCorrection(
      makeMinimalCorrectionInput(
        String(fixture.companyId),
        String(summary._id),
      ) as Parameters<typeof createWorkdaySummaryCorrection>[0],
    );

    expect(result.correction.recoveryEventId).toBeDefined();

    const event = await OperationalRecoveryEvent.findById(
      result.correction.recoveryEventId,
    );
    expect(event).not.toBeNull();
    expect(event?.action).toBe("CORRECTED");
    expect(event?.entityType).toBe("WORKDAY_SUMMARY");
    expect(event?.entityId).toBe(String(summary._id));
    expect(String(event?.companyId)).toBe(String(fixture.companyId));
    expect(String(event?.relatedWorkdaySummaryId)).toBe(String(summary._id));
  });

  it("recovery event contains sanitized before/after summaries (no PII)", async () => {
    const fixture = makeSummaryFixture();
    const summary = await WorkdaySummary.create(fixture);

    const result = await createWorkdaySummaryCorrection(
      makeMinimalCorrectionInput(
        String(fixture.companyId),
        String(summary._id),
        { correctedTotalEffectivePatients: 8, correctedFinalKm: 10300 },
      ) as Parameters<typeof createWorkdaySummaryCorrection>[0],
    );

    const event = await OperationalRecoveryEvent.findById(
      result.correction.recoveryEventId,
    );

    // before/after contain only allow-listed numeric fields — no patient data
    expect(event?.beforeSummary).toBeDefined();
    expect(event?.afterSummary).toBeDefined();

    // PII fields are stripped
    expect(event?.beforeSummary).not.toHaveProperty("patientName");
    expect(event?.beforeSummary).not.toHaveProperty("address");
    expect(event?.afterSummary).not.toHaveProperty("patientName");

    // Numeric correction fields are captured
    expect(event?.afterSummary?.totalEffectivePatients).toBe(8);
    expect(event?.afterSummary?.finalKm).toBe(10300);
    // Before has original values
    expect(event?.beforeSummary?.totalEffectivePatients).toBe(5);
  });

  it("recovery event includes changedFields when values differ", async () => {
    const fixture = makeSummaryFixture();
    const summary = await WorkdaySummary.create(fixture);

    const result = await createWorkdaySummaryCorrection(
      makeMinimalCorrectionInput(
        String(fixture.companyId),
        String(summary._id),
        { correctedTotalEffectivePatients: 8, correctedTotalDienstKm: 250 },
      ) as Parameters<typeof createWorkdaySummaryCorrection>[0],
    );

    const event = await OperationalRecoveryEvent.findById(
      result.correction.recoveryEventId,
    );
    expect(event?.changedFields).toContain("totalEffectivePatients");
    expect(event?.changedFields).toContain("totalDienstKm");
  });

  it("recovery event stores praemienImpact and payrollImpact", async () => {
    const fixture = makeSummaryFixture();
    const summary = await WorkdaySummary.create(fixture);

    const result = await createWorkdaySummaryCorrection(
      makeMinimalCorrectionInput(
        String(fixture.companyId),
        String(summary._id),
        {
          praemienImpact: RECOVERY_PRAEMIEN_IMPACT.RECALCULATED,
          payrollImpact: RECOVERY_PAYROLL_IMPACT.POSSIBLE,
        },
      ) as Parameters<typeof createWorkdaySummaryCorrection>[0],
    );

    const event = await OperationalRecoveryEvent.findById(
      result.correction.recoveryEventId,
    );
    expect(event?.praemienImpact).toBe("recalculated");
    expect(event?.payrollImpact).toBe("possible");
  });
});

// ── getEffectiveWorkdaySummary ─────────────────────────────────────────────────

describe("getEffectiveWorkdaySummary", () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(env.MONGODB_URI);
    }
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  afterEach(async () => {
    await WorkdaySummary.collection.deleteMany({});
    await WorkdaySummaryCorrection.collection.deleteMany({});
    await OperationalRecoveryEvent.collection.deleteMany({});
  });

  it("returns original values when no correction exists", async () => {
    const fixture = makeSummaryFixture();
    const summary = await WorkdaySummary.create(fixture);

    const effective = await getEffectiveWorkdaySummary({
      workdaySummaryId: String(summary._id),
      companyId: String(fixture.companyId),
    });

    expect(effective.hasCorrectedValues).toBe(false);
    expect(effective.activeCorrection).toBeNull();
    expect(effective.originalValues).toBeNull();
    expect(effective.totalEffectivePatients).toBe(5);
    expect(effective.totalRealTrips).toBe(4);
    expect(effective.finalKm).toBe(10200);
    expect(effective.totalDienstKm).toBe(200);
  });

  it("returns corrected effective values when active correction exists", async () => {
    const fixture = makeSummaryFixture();
    const summary = await WorkdaySummary.create(fixture);

    await createWorkdaySummaryCorrection(
      makeMinimalCorrectionInput(
        String(fixture.companyId),
        String(summary._id),
        {
          correctedTotalEffectivePatients: 9,
          correctedFinalKm: 10400,
        },
      ) as Parameters<typeof createWorkdaySummaryCorrection>[0],
    );

    const effective = await getEffectiveWorkdaySummary({
      workdaySummaryId: String(summary._id),
      companyId: String(fixture.companyId),
    });

    expect(effective.hasCorrectedValues).toBe(true);
    expect(effective.totalEffectivePatients).toBe(9);
    expect(effective.finalKm).toBe(10400);
    // Uncorrected fields inherit from original
    expect(effective.totalRealTrips).toBe(4);
    expect(effective.totalDienstKm).toBe(200);
    // Original values preserved for audit
    expect(effective.originalValues?.totalEffectivePatients).toBe(5);
    expect(effective.originalValues?.finalKm).toBe(10200);
    expect(effective.activeCorrection).not.toBeNull();
  });

  it("reflects second correction after supersession", async () => {
    const fixture = makeSummaryFixture();
    const summary = await WorkdaySummary.create(fixture);

    await createWorkdaySummaryCorrection(
      makeMinimalCorrectionInput(
        String(fixture.companyId),
        String(summary._id),
        { correctedTotalEffectivePatients: 6 },
      ) as Parameters<typeof createWorkdaySummaryCorrection>[0],
    );

    await createWorkdaySummaryCorrection(
      makeMinimalCorrectionInput(
        String(fixture.companyId),
        String(summary._id),
        { correctedTotalEffectivePatients: 8, correctionReason: "Final count" },
      ) as Parameters<typeof createWorkdaySummaryCorrection>[0],
    );

    const effective = await getEffectiveWorkdaySummary({
      workdaySummaryId: String(summary._id),
      companyId: String(fixture.companyId),
    });

    expect(effective.totalEffectivePatients).toBe(8);
  });

  it("rejects cross-company access", async () => {
    const fixture = makeSummaryFixture();
    const summary = await WorkdaySummary.create(fixture);

    await expect(
      getEffectiveWorkdaySummary({
        workdaySummaryId: String(summary._id),
        companyId: makeObjectId().toString(),
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects invalid workdaySummaryId", async () => {
    await expect(
      getEffectiveWorkdaySummary({
        workdaySummaryId: "bad-id",
        companyId: makeObjectId().toString(),
      }),
    ).rejects.toBeInstanceOf(OperationalRecoveryError);
  });
});
