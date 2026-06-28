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
        relatedWorkdaySummaryCorrectionId: correction._id,
        workerId: driver,
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

  // ── Integration with workday-recovery.service ──────────────────────────────

  describe("integration: createWorkdaySummaryCorrection triggers resolution", () => {
    it("creates PraemienImpactResolution when praemienImpact=possible", async () => {
      const companyId = makeObjectId();
      const driver = makeObjectId();
      const medic = makeObjectId();
      const summary = await WorkdaySummary.create({
        ...makeSummaryFixture(),
        companyId,
        driver,
        medic,
      });

      await createWorkdaySummaryCorrection({
        companyId: String(companyId),
        workdaySummaryId: String(summary._id),
        actorUserId: makeObjectId().toString(),
        actorRole: "admin",
        correctedTotalEffectivePatients: 6,
        correctionReason: "Integration test",
        praemienImpact: RECOVERY_PRAEMIEN_IMPACT.POSSIBLE,
        payrollImpact: RECOVERY_PAYROLL_IMPACT.NONE,
      });

      // Allow async resolution creation to settle
      await new Promise((r) => setTimeout(r, 200));

      const resolutions = await PraemienImpactResolution.find({ companyId });
      expect(resolutions.length).toBeGreaterThanOrEqual(1);
      expect(resolutions.every((r) => r.status === PRAEMIEN_RESOLUTION_STATUS.PENDING)).toBe(true);
    });

    it("does NOT create PraemienImpactResolution when praemienImpact=none", async () => {
      const companyId = makeObjectId();
      const summary = await WorkdaySummary.create({
        ...makeSummaryFixture(),
        companyId,
      });

      await createWorkdaySummaryCorrection({
        companyId: String(companyId),
        workdaySummaryId: String(summary._id),
        actorUserId: makeObjectId().toString(),
        actorRole: "admin",
        correctedTotalEffectivePatients: 6,
        correctionReason: "Impact none test",
        praemienImpact: RECOVERY_PRAEMIEN_IMPACT.NONE,
        payrollImpact: RECOVERY_PAYROLL_IMPACT.NONE,
      });

      await new Promise((r) => setTimeout(r, 200));

      const resolutions = await PraemienImpactResolution.find({ companyId });
      expect(resolutions).toHaveLength(0);
    });
  });
});
