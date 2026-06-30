/**
 * Phase 3.4.1 — PraemienImpactResolution service tests.
 *
 * Covers:
 *   createPraemienImpactResolution:
 *     - creates pending resolution when called (caller passes praemienImpact=possible)
 *     - idempotent: returns existing PENDING resolution without creating duplicate
 *     - rejects invalid companyId
 *     - rejects correction not found
 *     - rejects cross-company correction (tenant isolation)
 *     - rejects workerId not in correction.workerIds
 *     - creates OperationalRecoveryEvent on creation
 *     - computes delta when beforeValue and afterValue are provided
 *
 *   getActivePraemienImpact:
 *     - returns pending resolutions for a correction
 *     - returns empty array when no resolutions
 *     - does NOT return resolutions from another company
 *     - filters by workerId when provided
 *
 *   resolvePraemienImpact:
 *     - transitions pending → ignored
 *     - transitions pending → adjusted
 *     - transitions pending → blocked
 *     - sets resolvedBy and resolvedAt
 *     - records OperationalRecoveryEvent on transition
 *     - rejects resolution not found
 *     - rejects cross-company resolution (tenant isolation)
 *     - rejects double-resolution (already in terminal status)
 *     - rejects invalid newStatus
 *
 *   integration with workday-recovery.service:
 *     - createWorkdaySummaryCorrection with praemienImpact=possible triggers resolution creation
 *     - createWorkdaySummaryCorrection with praemienImpact=none does NOT trigger resolution
 *
 *   parseDateToYearMonth:
 *     - parses valid YYYY-MM-DD string
 *     - throws on invalid format
 */
import mongoose from "mongoose";
import { env } from "../config/env";
import WorkdaySummary from "../modules/workday-summary/models/workday-summary.model";
import MonthlyPraemie from "../modules/praemien/models/monthly-praemie.model";
import {
  WorkdaySummaryCorrection,
  OperationalRecoveryEvent,
  CORRECTION_STATUS,
  RECOVERY_PRAEMIEN_IMPACT,
  RECOVERY_PAYROLL_IMPACT,
  OperationalRecoveryError,
  createWorkdaySummaryCorrection,
  PraemienImpactResolution,
  PRAEMIEN_RESOLUTION_STATUS,
  createPraemienImpactResolution,
  getActivePraemienImpact,
  resolvePraemienImpact,
  parseDateToYearMonth,
} from "../modules/operational-recovery";

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeObjectId() {
  return new mongoose.Types.ObjectId();
}

/** Use "2026-07-01" as the fixture date to avoid collision with Phase 3.1 suite ("2026-06-01"). */
const FIXTURE_DATE = "2026-07-01";

function makeSummaryFixture(overrides: Record<string, unknown> = {}) {
  const companyId = makeObjectId();
  const driver = makeObjectId();
  const medic = makeObjectId();
  return {
    companyId,
    driver,
    medic,
    ambulanceId: makeObjectId(),
    ambulanceNumber: "AMB-002",
    date: FIXTURE_DATE,
    assignmentId: makeObjectId().toString(),
    initialKm: 20000,
    finalKm: 20300,
    totalDienstKm: 300,
    trips: [],
    isFinalClosure: true,
    totalEffectivePatients: 4,
    totalRealTrips: 3,
    isReviewed: false,
    ...overrides,
  };
}

async function createSummaryAndCorrection(companyId: mongoose.Types.ObjectId) {
  const driver = makeObjectId();
  const medic = makeObjectId();
  const summary = await WorkdaySummary.create({
    ...makeSummaryFixture(),
    companyId,
    driver,
    medic,
  });
  const correction = await WorkdaySummaryCorrection.create({
    originalSummaryId: summary._id,
    companyId,
    assignmentId: summary.assignmentId,
    date: FIXTURE_DATE,
    workerIds: [driver, medic],
    correctedTotalEffectivePatients: 6,
    correctionReason: "Correction reason",
    correctedBy: makeObjectId(),
    correctedAt: new Date(),
    praemienImpact: "possible",
    payrollImpact: "none",
    status: CORRECTION_STATUS.ACTIVE,
  });
  return { summary, correction, driver, medic };
}

async function createAdditionalCorrection(
  companyId: mongoose.Types.ObjectId,
  summary: { _id: unknown; assignmentId: string },
  driver: mongoose.Types.ObjectId,
  medic: mongoose.Types.ObjectId,
  overrides: Record<string, unknown> = {},
) {
  return WorkdaySummaryCorrection.create({
    originalSummaryId: summary._id,
    companyId,
    assignmentId: summary.assignmentId,
    date: FIXTURE_DATE,
    workerIds: [driver, medic],
    correctedTotalEffectivePatients: 7,
    correctionReason: "Second correction",
    correctedBy: makeObjectId(),
    correctedAt: new Date(),
    praemienImpact: "possible",
    payrollImpact: "none",
    status: CORRECTION_STATUS.ACTIVE,
    ...overrides,
  });
}

async function createPraemienResolutionForWorker(opts: {
  companyId: mongoose.Types.ObjectId;
  workerId: mongoose.Types.ObjectId;
  summaryId: string;
  correctionId: string;
  beforeValue?: number;
  afterValue?: number;
  reason?: string;
  year?: number;
  month?: number;
}) {
  return createPraemienImpactResolution({
    companyId: String(opts.companyId),
    workerId: String(opts.workerId),
    year: opts.year ?? 2026,
    month: opts.month ?? 7,
    relatedWorkdaySummaryId: opts.summaryId,
    relatedWorkdaySummaryCorrectionId: opts.correctionId,
    beforeValue: opts.beforeValue,
    afterValue: opts.afterValue,
    reason: opts.reason ?? "Correction reason",
    actorUserId: makeObjectId().toString(),
    actorRole: "admin",
  });
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("PraemienImpactResolution service", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  afterEach(async () => {
    // Scoped cleanup: only delete fixture docs for the "2026-07-01" date to
    // avoid interfering with concurrent test workers sharing the same DB.
    await WorkdaySummary.deleteMany({ date: FIXTURE_DATE });
    await WorkdaySummaryCorrection.deleteMany({ date: FIXTURE_DATE });
    await PraemienImpactResolution.collection.deleteMany({});
    await MonthlyPraemie.deleteMany({ year: 2026, month: { $in: [6, 7] } });
    await OperationalRecoveryEvent.collection.deleteMany({
      entityType: "PRAEMIE",
    });
  });

  // ── parseDateToYearMonth ────────────────────────────────────────────────────

  describe("parseDateToYearMonth", () => {
    it("parses valid YYYY-MM-DD string", () => {
      const result = parseDateToYearMonth("2026-07-15");
      expect(result.year).toBe(2026);
      expect(result.month).toBe(7);
    });

    it("throws on malformed date string", () => {
      expect(() => parseDateToYearMonth("invalid")).toThrow(OperationalRecoveryError);
    });

    it("throws on out-of-range month", () => {
      expect(() => parseDateToYearMonth("2026-13-01")).toThrow(OperationalRecoveryError);
    });
  });

  // ── createPraemienImpactResolution ─────────────────────────────────────────

  describe("createPraemienImpactResolution", () => {
    it("creates a PENDING resolution for a valid correction + worker", async () => {
      const companyId = makeObjectId();
      const { correction, driver } = await createSummaryAndCorrection(companyId);

      const result = await createPraemienImpactResolution({
        companyId: String(companyId),
        workerId: String(driver),
        year: 2026,
        month: 7,
        relatedWorkdaySummaryId: String(correction.originalSummaryId),
        relatedWorkdaySummaryCorrectionId: String(correction._id),
        reason: "Correction reason",
        actorUserId: makeObjectId().toString(),
        actorRole: "admin",
      });

      expect(result.alreadyExisted).toBe(false);
      expect(result.resolution.status).toBe(PRAEMIEN_RESOLUTION_STATUS.PENDING);
      expect(String(result.resolution.companyId)).toBe(String(companyId));
      expect(String(result.resolution.workerId)).toBe(String(driver));
      expect(result.resolution.year).toBe(2026);
      expect(result.resolution.month).toBe(7);
    });

    it("computes delta when beforeValue and afterValue are provided", async () => {
      const companyId = makeObjectId();
      const { correction, driver } = await createSummaryAndCorrection(companyId);

      const result = await createPraemienImpactResolution({
        companyId: String(companyId),
        workerId: String(driver),
        year: 2026,
        month: 7,
        relatedWorkdaySummaryId: String(correction.originalSummaryId),
        relatedWorkdaySummaryCorrectionId: String(correction._id),
        beforeValue: 4,
        afterValue: 6,
        reason: "Patient count corrected",
        actorUserId: makeObjectId().toString(),
        actorRole: "admin",
      });

      expect(result.resolution.beforeValue).toBe(4);
      expect(result.resolution.afterValue).toBe(6);
      expect(result.resolution.delta).toBe(2);
    });

    it("returns existing PENDING resolution without creating a duplicate", async () => {
      const companyId = makeObjectId();
      const { correction, driver } = await createSummaryAndCorrection(companyId);

      const input = {
        companyId: String(companyId),
        workerId: String(driver),
        year: 2026,
        month: 7,
        relatedWorkdaySummaryId: String(correction.originalSummaryId),
        relatedWorkdaySummaryCorrectionId: String(correction._id),
        reason: "Reason",
        actorUserId: makeObjectId().toString(),
        actorRole: "admin",
      };

      const first = await createPraemienImpactResolution(input);
      const second = await createPraemienImpactResolution(input);

      expect(first.alreadyExisted).toBe(false);
      expect(second.alreadyExisted).toBe(true);
      expect(String(second.resolution._id)).toBe(String(first.resolution._id));

      const count = await PraemienImpactResolution.countDocuments({
        companyId,
        workerId: driver,
        year: 2026,
        month: 7,
        status: PRAEMIEN_RESOLUTION_STATUS.PENDING,
      });
      expect(count).toBe(1);
    });

    it("rejects when correction is not found", async () => {
      const companyId = makeObjectId();
      const { summary, driver } = await createSummaryAndCorrection(companyId);

      await expect(
        createPraemienImpactResolution({
          companyId: String(companyId),
          workerId: String(driver),
          year: 2026,
          month: 7,
          relatedWorkdaySummaryId: String(summary._id),
          relatedWorkdaySummaryCorrectionId: makeObjectId().toString(),
          reason: "Reason",
          actorUserId: makeObjectId().toString(),
          actorRole: "admin",
        }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("rejects cross-company correction (tenant isolation)", async () => {
      const companyA = makeObjectId();
      const companyB = makeObjectId();
      const { correction, driver } = await createSummaryAndCorrection(companyA);

      await expect(
        createPraemienImpactResolution({
          companyId: String(companyB),
          workerId: String(driver),
          year: 2026,
          month: 7,
          relatedWorkdaySummaryId: String(correction.originalSummaryId),
          relatedWorkdaySummaryCorrectionId: String(correction._id),
          reason: "Reason",
          actorUserId: makeObjectId().toString(),
          actorRole: "admin",
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("rejects workerId not in correction.workerIds", async () => {
      const companyId = makeObjectId();
      const { correction } = await createSummaryAndCorrection(companyId);
      const outsider = makeObjectId();

      await expect(
        createPraemienImpactResolution({
          companyId: String(companyId),
          workerId: String(outsider),
          year: 2026,
          month: 7,
          relatedWorkdaySummaryId: String(correction.originalSummaryId),
          relatedWorkdaySummaryCorrectionId: String(correction._id),
          reason: "Reason",
          actorUserId: makeObjectId().toString(),
          actorRole: "admin",
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("rejects invalid companyId", async () => {
      await expect(
        createPraemienImpactResolution({
          companyId: "not-an-id",
          workerId: makeObjectId().toString(),
          year: 2026,
          month: 7,
          relatedWorkdaySummaryId: makeObjectId().toString(),
          relatedWorkdaySummaryCorrectionId: makeObjectId().toString(),
          reason: "Reason",
          actorUserId: makeObjectId().toString(),
          actorRole: "admin",
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("requires admin role", async () => {
      await expect(
        createPraemienImpactResolution({
          companyId: makeObjectId().toString(),
          workerId: makeObjectId().toString(),
          year: 2026,
          month: 7,
          relatedWorkdaySummaryId: makeObjectId().toString(),
          relatedWorkdaySummaryCorrectionId: makeObjectId().toString(),
          reason: "Reason",
          actorUserId: makeObjectId().toString(),
          actorRole: "worker",
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("creates an OperationalRecoveryEvent on resolution creation", async () => {
      const companyId = makeObjectId();
      const { correction, driver } = await createSummaryAndCorrection(companyId);

      const result = await createPraemienImpactResolution({
        companyId: String(companyId),
        workerId: String(driver),
        year: 2026,
        month: 7,
        relatedWorkdaySummaryId: String(correction.originalSummaryId),
        relatedWorkdaySummaryCorrectionId: String(correction._id),
        reason: "Event test",
        actorUserId: makeObjectId().toString(),
        actorRole: "admin",
      });

      // Allow async event recording to complete
      await new Promise((r) => setTimeout(r, 100));

      const event = await OperationalRecoveryEvent.findOne({
        entityType: "PRAEMIE",
        entityId: String(result.resolution._id),
        action: "PRAEMIEN_RESOLUTION_CREATED",
      });
      expect(event).not.toBeNull();
      expect(String(event!.companyId)).toBe(String(companyId));
    });
  });

  // ── getActivePraemienImpact ────────────────────────────────────────────────

  describe("getActivePraemienImpact", () => {
    it("returns pending resolutions for a correction", async () => {
      const companyId = makeObjectId();
      const { correction, driver } = await createSummaryAndCorrection(companyId);

      await createPraemienImpactResolution({
        companyId: String(companyId),
        workerId: String(driver),
        year: 2026,
        month: 7,
        relatedWorkdaySummaryId: String(correction.originalSummaryId),
        relatedWorkdaySummaryCorrectionId: String(correction._id),
        reason: "Test",
        actorUserId: makeObjectId().toString(),
        actorRole: "admin",
      });

      const results = await getActivePraemienImpact({
        companyId: String(companyId),
        correctionId: String(correction._id),
      });

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe(PRAEMIEN_RESOLUTION_STATUS.PENDING);
    });

    it("returns empty array when no resolutions exist", async () => {
      const results = await getActivePraemienImpact({
        companyId: makeObjectId().toString(),
        correctionId: makeObjectId().toString(),
      });
      expect(results).toHaveLength(0);
    });

    it("does not return resolutions from another company", async () => {
      const companyA = makeObjectId();
      const companyB = makeObjectId();
      const { correction, driver } = await createSummaryAndCorrection(companyA);

      await createPraemienImpactResolution({
        companyId: String(companyA),
        workerId: String(driver),
        year: 2026,
        month: 7,
        relatedWorkdaySummaryId: String(correction.originalSummaryId),
        relatedWorkdaySummaryCorrectionId: String(correction._id),
        reason: "Tenant test",
        actorUserId: makeObjectId().toString(),
        actorRole: "admin",
      });

      const resultsForB = await getActivePraemienImpact({
        companyId: String(companyB),
        correctionId: String(correction._id),
      });
      expect(resultsForB).toHaveLength(0);
    });

    it("filters by workerId when provided", async () => {
      const companyId = makeObjectId();
      const { correction, driver, medic } =
        await createSummaryAndCorrection(companyId);

      await createPraemienImpactResolution({
        companyId: String(companyId),
        workerId: String(driver),
        year: 2026,
        month: 7,
        relatedWorkdaySummaryId: String(correction.originalSummaryId),
        relatedWorkdaySummaryCorrectionId: String(correction._id),
        reason: "Driver resolution",
        actorUserId: makeObjectId().toString(),
        actorRole: "admin",
      });
      await createPraemienImpactResolution({
        companyId: String(companyId),
        workerId: String(medic),
        year: 2026,
        month: 7,
        relatedWorkdaySummaryId: String(correction.originalSummaryId),
        relatedWorkdaySummaryCorrectionId: String(correction._id),
        reason: "Medic resolution",
        actorUserId: makeObjectId().toString(),
        actorRole: "admin",
      });

      const driverOnly = await getActivePraemienImpact({
        companyId: String(companyId),
        correctionId: String(correction._id),
        workerId: String(driver),
      });
      expect(driverOnly).toHaveLength(1);
      expect(String(driverOnly[0].workerId)).toBe(String(driver));
    });
  });

  // ── resolvePraemienImpact ──────────────────────────────────────────────────

  describe("resolvePraemienImpact", () => {
    async function createPendingResolution(
      companyId: mongoose.Types.ObjectId,
    ) {
      const { correction, driver } = await createSummaryAndCorrection(companyId);
      const { resolution } = await createPraemienImpactResolution({
        companyId: String(companyId),
        workerId: String(driver),
        year: 2026,
        month: 7,
        relatedWorkdaySummaryId: String(correction.originalSummaryId),
        relatedWorkdaySummaryCorrectionId: String(correction._id),
        reason: "Resolution test",
        actorUserId: makeObjectId().toString(),
        actorRole: "admin",
      });
      return { resolution, correction, driver };
    }

    it("transitions pending → ignored", async () => {
      const companyId = makeObjectId();
      const { resolution } = await createPendingResolution(companyId);
      const actorUserId = makeObjectId().toString();

      const result = await resolvePraemienImpact({
        companyId: String(companyId),
        resolutionId: String(resolution._id),
        newStatus: "ignored",
        actorUserId,
        actorRole: "admin",
      });

      expect(result.previousStatus).toBe(PRAEMIEN_RESOLUTION_STATUS.PENDING);
      expect(result.resolution.status).toBe(PRAEMIEN_RESOLUTION_STATUS.IGNORED);
      expect(result.resolution.resolvedBy).toBeDefined();
      expect(result.resolution.resolvedAt).toBeDefined();
    });

    it("transitions pending → adjusted", async () => {
      const companyId = makeObjectId();
      const { resolution } = await createPendingResolution(companyId);

      const result = await resolvePraemienImpact({
        companyId: String(companyId),
        resolutionId: String(resolution._id),
        newStatus: "adjusted",
        actorUserId: makeObjectId().toString(),
        actorRole: "admin",
        note: "Manually adjusted in praemien admin flow",
      });

      expect(result.resolution.status).toBe(PRAEMIEN_RESOLUTION_STATUS.ADJUSTED);
    });

    it("transitions pending → blocked", async () => {
      const companyId = makeObjectId();
      const { resolution } = await createPendingResolution(companyId);

      const result = await resolvePraemienImpact({
        companyId: String(companyId),
        resolutionId: String(resolution._id),
        newStatus: "blocked",
        actorUserId: makeObjectId().toString(),
        actorRole: "admin",
      });

      expect(result.resolution.status).toBe(PRAEMIEN_RESOLUTION_STATUS.BLOCKED);
    });

    it("sets resolvedBy and resolvedAt on transition", async () => {
      const companyId = makeObjectId();
      const { resolution } = await createPendingResolution(companyId);
      const actorUserId = makeObjectId().toString();

      const result = await resolvePraemienImpact({
        companyId: String(companyId),
        resolutionId: String(resolution._id),
        newStatus: "ignored",
        actorUserId,
        actorRole: "admin",
      });

      expect(String(result.resolution.resolvedBy)).toBe(actorUserId);
      expect(result.resolution.resolvedAt).toBeInstanceOf(Date);
    });

    it("records OperationalRecoveryEvent on status transition", async () => {
      const companyId = makeObjectId();
      const { resolution } = await createPendingResolution(companyId);

      await resolvePraemienImpact({
        companyId: String(companyId),
        resolutionId: String(resolution._id),
        newStatus: "ignored",
        actorUserId: makeObjectId().toString(),
        actorRole: "admin",
        note: "Reviewed and dismissed",
      });

      await new Promise((r) => setTimeout(r, 100));

      const event = await OperationalRecoveryEvent.findOne({
        entityType: "PRAEMIE",
        entityId: String(resolution._id),
        action: "PRAEMIEN_RESOLUTION_IGNORED",
      });
      expect(event).not.toBeNull();
    });

    it("rejects when resolution is not found", async () => {
      await expect(
        resolvePraemienImpact({
          companyId: makeObjectId().toString(),
          resolutionId: makeObjectId().toString(),
          newStatus: "ignored",
          actorUserId: makeObjectId().toString(),
          actorRole: "admin",
        }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("rejects cross-company resolution (tenant isolation)", async () => {
      const companyA = makeObjectId();
      const companyB = makeObjectId();
      const { resolution } = await createPendingResolution(companyA);

      await expect(
        resolvePraemienImpact({
          companyId: String(companyB),
          resolutionId: String(resolution._id),
          newStatus: "ignored",
          actorUserId: makeObjectId().toString(),
          actorRole: "admin",
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("rejects double-resolution (already in terminal status)", async () => {
      const companyId = makeObjectId();
      const { resolution } = await createPendingResolution(companyId);

      await resolvePraemienImpact({
        companyId: String(companyId),
        resolutionId: String(resolution._id),
        newStatus: "ignored",
        actorUserId: makeObjectId().toString(),
        actorRole: "admin",
      });

      await expect(
        resolvePraemienImpact({
          companyId: String(companyId),
          resolutionId: String(resolution._id),
          newStatus: "adjusted",
          actorUserId: makeObjectId().toString(),
          actorRole: "admin",
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("rejects invalid newStatus", async () => {
      const companyId = makeObjectId();
      const { resolution } = await createPendingResolution(companyId);

      await expect(
        resolvePraemienImpact({
          companyId: String(companyId),
          resolutionId: String(resolution._id),
          newStatus: "pending" as never,
          actorUserId: makeObjectId().toString(),
          actorRole: "admin",
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  // ── Integration with workday-recovery.service (Monthly snapshot guard) ────

  describe("integration: MonthlyPraemie snapshot guard", () => {
    /** Creates a WorkdaySummary with driver + medic for the given company. */
    async function makeSummaryWithWorkers(companyId: mongoose.Types.ObjectId) {
      const driver = makeObjectId();
      const medic = makeObjectId();
      const summary = await WorkdaySummary.create({
        ...makeSummaryFixture(),
        companyId,
        driver,
        medic,
      });
      return { summary, driver, medic };
    }

    /** Creates a saved MonthlyPraemie snapshot (closed month). */
    async function makeSavedPraemie(opts: {
      companyId: mongoose.Types.ObjectId;
      userId: mongoose.Types.ObjectId;
      year: number;
      month: number;
    }) {
      return MonthlyPraemie.create({
        userId: opts.userId,
        companyId: opts.companyId,
        year: opts.year,
        month: opts.month,
        averagePatients: 5,
        premieLevel: "gold",
        snapshotSource: "automatic",
      });
    }

    async function makeCorrection(
      companyId: mongoose.Types.ObjectId,
      summaryId: string,
      praemienImpact: "none" | "possible",
    ) {
      return createWorkdaySummaryCorrection({
        companyId: String(companyId),
        workdaySummaryId: summaryId,
        actorUserId: makeObjectId().toString(),
        actorRole: "admin",
        correctedTotalEffectivePatients: 6,
        correctionReason: "Test correction",
        praemienImpact,
        payrollImpact: RECOVERY_PAYROLL_IMPACT.NONE,
      });
    }

    // Test 1 — praemienImpact=possible + NO MonthlyPraemie → no resolution
    it("does NOT create resolution when praemienImpact=possible and no MonthlyPraemie exists (open month)", async () => {
      const companyId = makeObjectId();
      const { summary } = await makeSummaryWithWorkers(companyId);

      await makeCorrection(companyId, String(summary._id), "possible");
      await new Promise((r) => setTimeout(r, 200));

      const resolutions = await PraemienImpactResolution.find({ companyId });
      expect(resolutions).toHaveLength(0);
    });

    // Test 2 — praemienImpact=possible + MonthlyPraemie EXISTS → resolution created
    it("creates resolution when praemienImpact=possible and saved MonthlyPraemie exists (closed month)", async () => {
      const companyId = makeObjectId();
      const { summary, driver, medic } = await makeSummaryWithWorkers(companyId);

      // Create saved snapshots for both workers
      await makeSavedPraemie({ companyId, userId: driver, year: 2026, month: 7 });
      await makeSavedPraemie({ companyId, userId: medic, year: 2026, month: 7 });

      await makeCorrection(companyId, String(summary._id), "possible");
      await new Promise((r) => setTimeout(r, 300));

      const resolutions = await PraemienImpactResolution.find({ companyId });
      expect(resolutions.length).toBeGreaterThanOrEqual(1);
      expect(resolutions.every((r) => r.status === PRAEMIEN_RESOLUTION_STATUS.PENDING)).toBe(true);
    });

    // Test 3 — praemienImpact=none + MonthlyPraemie EXISTS → no resolution
    it("does NOT create resolution when praemienImpact=none even if MonthlyPraemie exists", async () => {
      const companyId = makeObjectId();
      const { summary, driver, medic } = await makeSummaryWithWorkers(companyId);

      await makeSavedPraemie({ companyId, userId: driver, year: 2026, month: 7 });
      await makeSavedPraemie({ companyId, userId: medic, year: 2026, month: 7 });

      await makeCorrection(companyId, String(summary._id), "none");
      await new Promise((r) => setTimeout(r, 200));

      const resolutions = await PraemienImpactResolution.find({ companyId });
      expect(resolutions).toHaveLength(0);
    });

    // Test 4 — MonthlyPraemie from ANOTHER company → no resolution
    it("does NOT create resolution when MonthlyPraemie belongs to a different company", async () => {
      const companyA = makeObjectId();
      const companyB = makeObjectId();
      const { summary, driver } = await makeSummaryWithWorkers(companyA);

      // Save praemie under companyB instead of companyA
      await makeSavedPraemie({ companyId: companyB, userId: driver, year: 2026, month: 7 });

      await makeCorrection(companyA, String(summary._id), "possible");
      await new Promise((r) => setTimeout(r, 200));

      const resolutions = await PraemienImpactResolution.find({ companyId: companyA });
      expect(resolutions).toHaveLength(0);
    });

    // Test 5 — MonthlyPraemie for ANOTHER worker → no resolution for that worker
    it("does NOT create resolution when MonthlyPraemie exists for a different worker", async () => {
      const companyId = makeObjectId();
      const { summary, driver } = await makeSummaryWithWorkers(companyId);
      const unrelatedWorker = makeObjectId();

      // Save praemie for an unrelated worker, not for driver or medic
      await makeSavedPraemie({ companyId, userId: unrelatedWorker, year: 2026, month: 7 });

      await makeCorrection(companyId, String(summary._id), "possible");
      await new Promise((r) => setTimeout(r, 200));

      const resolutions = await PraemienImpactResolution.find({ companyId });
      expect(resolutions).toHaveLength(0);

      // The driver-specific praemie is indeed absent
      const driverPraemie = await MonthlyPraemie.findOne({ userId: driver, year: 2026, month: 7 });
      expect(driverPraemie).toBeNull();
    });

    // Test 6 — MonthlyPraemie for ANOTHER month → no resolution
    it("does NOT create resolution when MonthlyPraemie exists for a different month", async () => {
      const companyId = makeObjectId();
      const { summary, driver, medic } = await makeSummaryWithWorkers(companyId);

      // Save praemie for month 6, not month 7 (which is the summary's month)
      await MonthlyPraemie.create({
        userId: driver,
        companyId,
        year: 2026,
        month: 6,
        averagePatients: 5,
        premieLevel: "gold",
      });
      await MonthlyPraemie.create({
        userId: medic,
        companyId,
        year: 2026,
        month: 6,
        averagePatients: 5,
        premieLevel: "gold",
      });

      await makeCorrection(companyId, String(summary._id), "possible");
      await new Promise((r) => setTimeout(r, 200));

      const resolutions = await PraemienImpactResolution.find({ companyId });
      expect(resolutions).toHaveLength(0);
    });

    // Test 7 — Correction still succeeds even when resolution cannot be created
    it("Workday correction succeeds even when no MonthlyPraemie exists", async () => {
      const companyId = makeObjectId();
      const { summary } = await makeSummaryWithWorkers(companyId);

      // No MonthlyPraemie — resolution check will silently skip
      const result = await makeCorrection(companyId, String(summary._id), "possible");

      expect(result.correction).toBeDefined();
      expect(result.effective).toBeDefined();
      // Resolution was skipped but the correction stands
      const corrections = await WorkdaySummaryCorrection.find({
        originalSummaryId: summary._id,
      });
      expect(corrections).toHaveLength(1);
    });

    // Test 8 — MonthlyPraemie is NEVER mutated
    it("MonthlyPraemie values are not mutated by the correction flow", async () => {
      const companyId = makeObjectId();
      const { summary, driver } = await makeSummaryWithWorkers(companyId);

      const praemie = await makeSavedPraemie({
        companyId,
        userId: driver,
        year: 2026,
        month: 7,
      });
      const praemieIdBefore = String(praemie._id);
      const averagePatientsBefore = praemie.averagePatients;
      const premieLevelBefore = praemie.premieLevel;

      await makeCorrection(companyId, String(summary._id), "possible");
      await new Promise((r) => setTimeout(r, 200));

      const praemieAfter = await MonthlyPraemie.findById(praemieIdBefore);
      expect(praemieAfter).not.toBeNull();
      expect(praemieAfter!.averagePatients).toBe(averagePatientsBefore);
      expect(praemieAfter!.premieLevel).toBe(premieLevelBefore);
    });
  });

  // ── Phase 4.5.1 — pending coalescing hardening ─────────────────────────────

  describe("Phase 4.5.1 — pending coalescing", () => {
    it("updates existing pending resolution for same worker/month instead of creating duplicate", async () => {
      const companyId = makeObjectId();
      const { summary, correction, driver, medic } =
        await createSummaryAndCorrection(companyId);
      const correction2 = await createAdditionalCorrection(
        companyId,
        summary,
        driver,
        medic,
      );

      const first = await createPraemienResolutionForWorker({
        companyId,
        workerId: driver,
        summaryId: String(summary._id),
        correctionId: String(correction._id),
        beforeValue: 4,
        afterValue: 6,
        reason: "First correction",
      });

      const second = await createPraemienResolutionForWorker({
        companyId,
        workerId: driver,
        summaryId: String(summary._id),
        correctionId: String(correction2._id),
        beforeValue: 6,
        afterValue: 8,
        reason: "Second correction",
      });

      expect(first.alreadyExisted).toBe(false);
      expect(second.alreadyExisted).toBe(true);
      expect(second.coalesced).toBe(true);
      expect(String(second.resolution._id)).toBe(String(first.resolution._id));
      expect(String(second.resolution.relatedWorkdaySummaryCorrectionId)).toBe(
        String(correction2._id),
      );
      expect(second.resolution.afterValue).toBe(8);
      expect(second.resolution.delta).toBe(2);

      const pendingCount = await PraemienImpactResolution.countDocuments({
        companyId,
        workerId: driver,
        year: 2026,
        month: 7,
        status: PRAEMIEN_RESOLUTION_STATUS.PENDING,
      });
      expect(pendingCount).toBe(1);
    });

    it("creates a new pending resolution when prior resolution is terminal", async () => {
      const companyId = makeObjectId();
      const { summary, correction, driver, medic } =
        await createSummaryAndCorrection(companyId);
      const correction2 = await createAdditionalCorrection(
        companyId,
        summary,
        driver,
        medic,
      );
      const actorUserId = makeObjectId().toString();

      const first = await createPraemienResolutionForWorker({
        companyId,
        workerId: driver,
        summaryId: String(summary._id),
        correctionId: String(correction._id),
      });

      await resolvePraemienImpact({
        companyId: String(companyId),
        resolutionId: String(first.resolution._id),
        newStatus: "ignored",
        actorUserId,
        actorRole: "admin",
        note: "Dismissed",
      });

      const second = await createPraemienResolutionForWorker({
        companyId,
        workerId: driver,
        summaryId: String(summary._id),
        correctionId: String(correction2._id),
        beforeValue: 6,
        afterValue: 9,
        reason: "New operational fact",
      });

      expect(second.alreadyExisted).toBe(false);
      expect(second.coalesced).toBe(false);
      expect(String(second.resolution._id)).not.toBe(String(first.resolution._id));

      const pendingCount = await PraemienImpactResolution.countDocuments({
        companyId,
        workerId: driver,
        year: 2026,
        month: 7,
        status: PRAEMIEN_RESOLUTION_STATUS.PENDING,
      });
      expect(pendingCount).toBe(1);

      const terminal = await PraemienImpactResolution.findById(first.resolution._id);
      expect(terminal?.status).toBe(PRAEMIEN_RESOLUTION_STATUS.IGNORED);
    });

    it("creates separate pending resolutions for different workers", async () => {
      const companyId = makeObjectId();
      const { summary, correction, driver, medic } =
        await createSummaryAndCorrection(companyId);

      await createPraemienResolutionForWorker({
        companyId,
        workerId: driver,
        summaryId: String(summary._id),
        correctionId: String(correction._id),
      });
      await createPraemienResolutionForWorker({
        companyId,
        workerId: medic,
        summaryId: String(summary._id),
        correctionId: String(correction._id),
      });

      const pendingCount = await PraemienImpactResolution.countDocuments({
        companyId,
        status: PRAEMIEN_RESOLUTION_STATUS.PENDING,
      });
      expect(pendingCount).toBe(2);
    });

    it("creates separate pending resolutions for different months", async () => {
      const companyId = makeObjectId();
      const { summary, correction, driver } =
        await createSummaryAndCorrection(companyId);

      await createPraemienResolutionForWorker({
        companyId,
        workerId: driver,
        summaryId: String(summary._id),
        correctionId: String(correction._id),
        month: 7,
      });
      await createPraemienResolutionForWorker({
        companyId,
        workerId: driver,
        summaryId: String(summary._id),
        correctionId: String(correction._id),
        month: 6,
      });

      const pendingCount = await PraemienImpactResolution.countDocuments({
        companyId,
        workerId: driver,
        status: PRAEMIEN_RESOLUTION_STATUS.PENDING,
      });
      expect(pendingCount).toBe(2);
    });

    it("creates separate pending resolutions for different companies", async () => {
      const companyA = makeObjectId();
      const companyB = makeObjectId();
      const { summary: summaryA, correction: correctionA, driver: driverA } =
        await createSummaryAndCorrection(companyA);
      const { summary: summaryB, correction: correctionB, driver: driverB } =
        await createSummaryAndCorrection(companyB);

      await createPraemienResolutionForWorker({
        companyId: companyA,
        workerId: driverA,
        summaryId: String(summaryA._id),
        correctionId: String(correctionA._id),
      });
      await createPraemienResolutionForWorker({
        companyId: companyB,
        workerId: driverB,
        summaryId: String(summaryB._id),
        correctionId: String(correctionB._id),
      });

      const pendingA = await PraemienImpactResolution.countDocuments({
        companyId: companyA,
        status: PRAEMIEN_RESOLUTION_STATUS.PENDING,
      });
      const pendingB = await PraemienImpactResolution.countDocuments({
        companyId: companyB,
        status: PRAEMIEN_RESOLUTION_STATUS.PENDING,
      });
      expect(pendingA).toBe(1);
      expect(pendingB).toBe(1);
    });

    it("does not mutate MonthlyPraemie when coalescing pending resolution", async () => {
      const companyId = makeObjectId();
      const { summary, correction, driver, medic } =
        await createSummaryAndCorrection(companyId);
      const correction2 = await createAdditionalCorrection(
        companyId,
        summary,
        driver,
        medic,
      );

      const praemie = await MonthlyPraemie.create({
        userId: driver,
        companyId,
        year: 2026,
        month: 7,
        averagePatients: 5,
        premieLevel: "gold",
        snapshotSource: "automatic",
      });

      await createPraemienResolutionForWorker({
        companyId,
        workerId: driver,
        summaryId: String(summary._id),
        correctionId: String(correction._id),
        beforeValue: 4,
        afterValue: 6,
      });
      await createPraemienResolutionForWorker({
        companyId,
        workerId: driver,
        summaryId: String(summary._id),
        correctionId: String(correction2._id),
        beforeValue: 6,
        afterValue: 8,
      });

      const praemieAfter = await MonthlyPraemie.findById(praemie._id);
      expect(praemieAfter!.averagePatients).toBe(5);
      expect(praemieAfter!.premieLevel).toBe("gold");
    });

    it("appends OperationalRecoveryEvent when coalescing pending resolution", async () => {
      const companyId = makeObjectId();
      const { summary, correction, driver, medic } =
        await createSummaryAndCorrection(companyId);
      const correction2 = await createAdditionalCorrection(
        companyId,
        summary,
        driver,
        medic,
      );

      const first = await createPraemienResolutionForWorker({
        companyId,
        workerId: driver,
        summaryId: String(summary._id),
        correctionId: String(correction._id),
      });

      await createPraemienResolutionForWorker({
        companyId,
        workerId: driver,
        summaryId: String(summary._id),
        correctionId: String(correction2._id),
        beforeValue: 6,
        afterValue: 8,
      });

      await new Promise((r) => setTimeout(r, 100));

      const createdEvent = await OperationalRecoveryEvent.findOne({
        entityType: "PRAEMIE",
        entityId: String(first.resolution._id),
        action: "PRAEMIEN_RESOLUTION_CREATED",
      });
      const coalescedEvent = await OperationalRecoveryEvent.findOne({
        entityType: "PRAEMIE",
        entityId: String(first.resolution._id),
        action: "PRAEMIEN_RESOLUTION_COALESCED",
      });

      expect(createdEvent).not.toBeNull();
      expect(coalescedEvent).not.toBeNull();
      expect(String(coalescedEvent!.metadata?.correctionId)).toBe(
        String(correction2._id),
      );
    });
  });
});
