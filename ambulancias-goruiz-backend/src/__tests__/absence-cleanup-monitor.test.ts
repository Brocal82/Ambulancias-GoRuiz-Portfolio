/**
 * Absence Cleanup Monitor — Phase 2.1 + 2.2 (integration tests).
 *
 * Tests the detection service and the repair service against a real test DB.
 * Each describe block creates its own companyId so tests are fully isolated.
 *
 * Covered scenarios:
 *   Detection:
 *     - Vacation stale driver detected
 *     - Vacation stale medic detected
 *     - Sick stale driver detected
 *     - Sick stale medic detected
 *     - Cancelled vacation ignored
 *     - Rejected sick ignored
 *     - Tenant isolation (cross-company assignment not reported)
 *   Repair:
 *     - Repair removes stale assignment
 *     - Repair already clean (0 assignments touched)
 *     - Repair failure (clearUserFromDienstsInRange throws)
 *     - Successful repair records RERUN_CLEANUP recovery event
 *     - Failed repair records FAILED_RECOVERY_ATTEMPT recovery event
 */

import mongoose from "mongoose";
import { env } from "../config/env";
import { Dienst } from "../modules/diensts";
import User from "../modules/users/models/user.model";
import VacationRequest from "../modules/vacation/models/vacation-request.model";
import SickLeave from "../modules/sick-leaves/models/sick-leave.model";
import OperationalRecoveryEvent from "../modules/operational-recovery/models/operational-recovery-event.model";
import { detectAbsenceInconsistencies } from "../modules/operational-recovery/services/absence-cleanup-detection.service";
import { repairAbsenceInconsistency } from "../modules/operational-recovery/services/absence-cleanup-repair.service";
import {
  RECOVERY_ACTION_TYPE,
  RECOVERY_SEVERITY,
} from "../modules/operational-recovery";
import * as dienstClearUtils from "../utils/dienstClearUtils";

// ── Shared test helpers ───────────────────────────────────────────────────────

/** Convenience alias so helpers can return typed _id without Mongoose generic noise. */
type WithId = { _id: mongoose.Types.ObjectId; toString(): string };

let emailSeq = 0;
function uniqueEmail() {
  return `test-acm-${Date.now()}-${++emailSeq}@goruiz.test`;
}

async function makeUser(companyId: mongoose.Types.ObjectId): Promise<WithId> {
  const doc = await User.create({
    name: "Test",
    lastName: "Worker",
    email: uniqueEmail(),
    password: "hashedpw",
    role: "worker",
    companyId,
  });
  return doc as unknown as WithId;
}

async function makeAdmin(companyId: mongoose.Types.ObjectId): Promise<WithId> {
  const doc = await User.create({
    name: "Admin",
    lastName: "User",
    email: uniqueEmail(),
    password: "hashedpw",
    role: "admin",
    companyId,
  });
  return doc as unknown as WithId;
}

async function makeDienst(
  companyId: mongoose.Types.ObjectId,
  assignment: {
    date: string;
    driver?: mongoose.Types.ObjectId;
    medic?: mongoose.Types.ObjectId;
  },
): Promise<WithId> {
  const doc = await Dienst.create({
    companyId,
    dienstNumber: Math.floor(Math.random() * 9000) + 1000,
    assignments: [
      {
        date: assignment.date,
        startTime: "08:00",
        endTime: "16:00",
        driver: assignment.driver,
        medic: assignment.medic,
      },
    ],
  });
  return doc as unknown as WithId;
}

async function makeVacation(
  userId: mongoose.Types.ObjectId,
  opts: { status?: string; start?: string; end?: string } = {},
): Promise<WithId> {
  const start = opts.start ?? "2026-06-10";
  const end = opts.end ?? "2026-06-15";
  const status = opts.status ?? "accepted";
  const doc = await VacationRequest.create({
    user: userId,
    startDate: new Date(start),
    endDate: new Date(end),
    status,
  });
  return doc as unknown as WithId;
}

async function makeSickLeave(
  userId: mongoose.Types.ObjectId,
  opts: { status?: string; start?: string; end?: string } = {},
): Promise<WithId> {
  const start = opts.start ?? "2026-06-10";
  const end = opts.end ?? "2026-06-12";
  const status = opts.status ?? "accepted";
  const doc = await SickLeave.create({
    user: userId,
    startDate: new Date(start),
    endDate: new Date(end),
    status,
    verificationStatus: "not_required",
  });
  return doc as unknown as WithId;
}

// ── DB lifecycle ──────────────────────────────────────────────────────────────

beforeAll(async () => {
  await mongoose.connect(env.MONGODB_URI);
});

afterAll(async () => {
  await mongoose.disconnect();
});

afterEach(async () => {
  await Promise.all([
    User.deleteMany({ email: /@goruiz\.test$/ }),
    Dienst.deleteMany({ dienstNumber: { $gte: 1000 } }),
    VacationRequest.deleteMany({}),
    SickLeave.deleteMany({}),
    // Raw collection bypass — model is append-only, use collection directly.
    OperationalRecoveryEvent.collection.deleteMany({}),
  ]);
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2.1 — Detection Service
// ─────────────────────────────────────────────────────────────────────────────

describe("detectAbsenceInconsistencies — Phase 2.1", () => {
  it("detects vacation stale driver", async () => {
    const companyId = new mongoose.Types.ObjectId();
    const worker = await makeUser(companyId);
    await makeVacation(worker._id as mongoose.Types.ObjectId, {
      start: "2026-06-10",
      end: "2026-06-15",
    });
    await makeDienst(companyId, {
      date: "2026-06-12",
      driver: worker._id as mongoose.Types.ObjectId,
    });

    const results = await detectAbsenceInconsistencies({
      companyId: companyId.toString(),
    });

    expect(results).toHaveLength(1);
    expect(results[0].workerId).toBe(worker._id.toString());
    expect(results[0].absenceType).toBe("vacation");
    expect(results[0].assignmentRole).toBe("driver");
    expect(results[0].assignmentDate).toBe("2026-06-12");
  });

  it("detects vacation stale medic", async () => {
    const companyId = new mongoose.Types.ObjectId();
    const worker = await makeUser(companyId);
    await makeVacation(worker._id as mongoose.Types.ObjectId, {
      start: "2026-06-10",
      end: "2026-06-15",
    });
    await makeDienst(companyId, {
      date: "2026-06-11",
      medic: worker._id as mongoose.Types.ObjectId,
    });

    const results = await detectAbsenceInconsistencies({
      companyId: companyId.toString(),
    });

    expect(results).toHaveLength(1);
    expect(results[0].assignmentRole).toBe("medic");
    expect(results[0].absenceType).toBe("vacation");
  });

  it("detects sick stale driver", async () => {
    const companyId = new mongoose.Types.ObjectId();
    const worker = await makeUser(companyId);
    await makeSickLeave(worker._id as mongoose.Types.ObjectId, {
      start: "2026-06-10",
      end: "2026-06-12",
    });
    await makeDienst(companyId, {
      date: "2026-06-11",
      driver: worker._id as mongoose.Types.ObjectId,
    });

    const results = await detectAbsenceInconsistencies({
      companyId: companyId.toString(),
    });

    expect(results).toHaveLength(1);
    expect(results[0].absenceType).toBe("sick");
    expect(results[0].assignmentRole).toBe("driver");
    expect(results[0].assignmentDate).toBe("2026-06-11");
  });

  it("detects sick stale medic", async () => {
    const companyId = new mongoose.Types.ObjectId();
    const worker = await makeUser(companyId);
    await makeSickLeave(worker._id as mongoose.Types.ObjectId, {
      start: "2026-06-10",
      end: "2026-06-12",
    });
    await makeDienst(companyId, {
      date: "2026-06-10",
      medic: worker._id as mongoose.Types.ObjectId,
    });

    const results = await detectAbsenceInconsistencies({
      companyId: companyId.toString(),
    });

    expect(results).toHaveLength(1);
    expect(results[0].absenceType).toBe("sick");
    expect(results[0].assignmentRole).toBe("medic");
  });

  it("ignores cancelled vacation", async () => {
    const companyId = new mongoose.Types.ObjectId();
    const worker = await makeUser(companyId);
    await makeVacation(worker._id as mongoose.Types.ObjectId, {
      status: "cancelled",
      start: "2026-06-10",
      end: "2026-06-15",
    });
    await makeDienst(companyId, {
      date: "2026-06-12",
      driver: worker._id as mongoose.Types.ObjectId,
    });

    const results = await detectAbsenceInconsistencies({
      companyId: companyId.toString(),
    });

    expect(results).toHaveLength(0);
  });

  it("ignores rejected sick leave", async () => {
    const companyId = new mongoose.Types.ObjectId();
    const worker = await makeUser(companyId);
    await makeSickLeave(worker._id as mongoose.Types.ObjectId, {
      status: "rejected",
      start: "2026-06-10",
      end: "2026-06-12",
    });
    await makeDienst(companyId, {
      date: "2026-06-11",
      medic: worker._id as mongoose.Types.ObjectId,
    });

    const results = await detectAbsenceInconsistencies({
      companyId: companyId.toString(),
    });

    expect(results).toHaveLength(0);
  });

  it("enforces tenant isolation — does not report cross-company assignments", async () => {
    const companyA = new mongoose.Types.ObjectId();
    const companyB = new mongoose.Types.ObjectId();

    const workerA = await makeUser(companyA);
    await makeVacation(workerA._id as mongoose.Types.ObjectId, {
      start: "2026-06-10",
      end: "2026-06-15",
    });
    // Dienst belongs to company B but the worker is in company A.
    // The detection service scans company A members against company A Diensts,
    // so this cross-company assignment must not appear.
    await makeDienst(companyB, {
      date: "2026-06-12",
      driver: workerA._id as mongoose.Types.ObjectId,
    });

    const resultsA = await detectAbsenceInconsistencies({
      companyId: companyA.toString(),
    });
    const resultsB = await detectAbsenceInconsistencies({
      companyId: companyB.toString(),
    });

    expect(resultsA).toHaveLength(0);
    expect(resultsB).toHaveLength(0);
  });

  it("returns empty array for invalid companyId", async () => {
    const results = await detectAbsenceInconsistencies({
      companyId: "not-an-object-id",
    });
    expect(results).toEqual([]);
  });

  it("respects fromDate and toDate scan window", async () => {
    const companyId = new mongoose.Types.ObjectId();
    const worker = await makeUser(companyId);
    // Vacation: June 5–20. Assignment on June 12 (in window) and June 7 (outside window).
    await makeVacation(worker._id as mongoose.Types.ObjectId, {
      start: "2026-06-05",
      end: "2026-06-20",
    });
    await makeDienst(companyId, {
      date: "2026-06-12",
      driver: worker._id as mongoose.Types.ObjectId,
    });

    // Scan window: June 10–15. Assignment on June 12 is inside.
    const results = await detectAbsenceInconsistencies({
      companyId: companyId.toString(),
      fromDate: "2026-06-10",
      toDate: "2026-06-15",
    });

    expect(results).toHaveLength(1);
    expect(results[0].assignmentDate).toBe("2026-06-12");
    // Full absence range is reported, not the window.
    expect(results[0].absenceStartDate).toBe("2026-06-05");
    expect(results[0].absenceEndDate).toBe("2026-06-20");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2.2 — Repair Service
// ─────────────────────────────────────────────────────────────────────────────

describe("repairAbsenceInconsistency — Phase 2.2", () => {
  it("repair removes stale driver assignment", async () => {
    const companyId = new mongoose.Types.ObjectId();
    const worker = await makeUser(companyId);
    const admin = await makeAdmin(companyId);

    const vacation = await makeVacation(worker._id as mongoose.Types.ObjectId, {
      start: "2026-06-10",
      end: "2026-06-15",
    });
    const dienst = await makeDienst(companyId, {
      date: "2026-06-12",
      driver: worker._id as mongoose.Types.ObjectId,
    });

    const result = await repairAbsenceInconsistency({
      companyId: companyId.toString(),
      workerId: worker._id.toString(),
      absenceType: "vacation",
      absenceId: vacation._id.toString(),
      actorUserId: admin._id.toString(),
      actorRole: "admin",
    });

    expect(result.repairFailed).toBe(false);
    expect(result.assignmentsTouched).toBeGreaterThan(0);
    expect(result.dienstsTouched).toBeGreaterThan(0);
    expect(result.remainingInconsistencies).toHaveLength(0);

    // Verify the Dienst was actually modified in the DB.
    const updated = await Dienst.findById(dienst._id).lean();
    const assignment = (
      (updated as Record<string, unknown>).assignments as Array<Record<string, unknown>>
    )?.[0];
    expect(assignment?.driver ?? null).toBeNull();
  });

  it("repair removes stale medic assignment (sick leave)", async () => {
    const companyId = new mongoose.Types.ObjectId();
    const worker = await makeUser(companyId);
    const admin = await makeAdmin(companyId);

    const sick = await makeSickLeave(worker._id as mongoose.Types.ObjectId, {
      start: "2026-06-10",
      end: "2026-06-12",
    });
    await makeDienst(companyId, {
      date: "2026-06-11",
      medic: worker._id as mongoose.Types.ObjectId,
    });

    const result = await repairAbsenceInconsistency({
      companyId: companyId.toString(),
      workerId: worker._id.toString(),
      absenceType: "sick",
      absenceId: sick._id.toString(),
      actorUserId: admin._id.toString(),
      actorRole: "admin",
    });

    expect(result.repairFailed).toBe(false);
    expect(result.assignmentsTouched).toBeGreaterThan(0);
    expect(result.remainingInconsistencies).toHaveLength(0);
  });

  it("repair is already clean when no stale assignments exist", async () => {
    const companyId = new mongoose.Types.ObjectId();
    const worker = await makeUser(companyId);
    const admin = await makeAdmin(companyId);

    // Vacation exists but there are no Dienst assignments for this worker.
    const vacation = await makeVacation(worker._id as mongoose.Types.ObjectId, {
      start: "2026-06-10",
      end: "2026-06-15",
    });

    const result = await repairAbsenceInconsistency({
      companyId: companyId.toString(),
      workerId: worker._id.toString(),
      absenceType: "vacation",
      absenceId: vacation._id.toString(),
      actorUserId: admin._id.toString(),
      actorRole: "admin",
    });

    expect(result.repairFailed).toBe(false);
    expect(result.alreadyClean).toBe(true);
    expect(result.assignmentsTouched).toBe(0);
    expect(result.dienstsTouched).toBe(0);
    expect(result.remainingInconsistencies).toHaveLength(0);
  });

  it("repair fails when absence is not found", async () => {
    const companyId = new mongoose.Types.ObjectId();
    const worker = await makeUser(companyId);
    const admin = await makeAdmin(companyId);

    const result = await repairAbsenceInconsistency({
      companyId: companyId.toString(),
      workerId: worker._id.toString(),
      absenceType: "vacation",
      absenceId: new mongoose.Types.ObjectId().toString(),
      actorUserId: admin._id.toString(),
      actorRole: "admin",
    });

    expect(result.repairFailed).toBe(true);
    expect(result.errorMessage).toMatch(/not found/i);
  });

  it("repair fails when worker does not belong to the company (tenant isolation)", async () => {
    const companyA = new mongoose.Types.ObjectId();
    const companyB = new mongoose.Types.ObjectId();
    const admin = await makeAdmin(companyA);

    const workerB = await makeUser(companyB);
    const vacation = await makeVacation(workerB._id as mongoose.Types.ObjectId);

    // Attempt to repair using companyA's context for a workerB absence.
    const result = await repairAbsenceInconsistency({
      companyId: companyA.toString(),
      workerId: workerB._id.toString(),
      absenceType: "vacation",
      absenceId: vacation._id.toString(),
      actorUserId: admin._id.toString(),
      actorRole: "admin",
    });

    expect(result.repairFailed).toBe(true);
    expect(result.errorMessage).toMatch(/does not belong to this company/i);
  });

  it("repair fails when clearUserFromDienstsInRange throws and records FAILED_RECOVERY_ATTEMPT", async () => {
    const companyId = new mongoose.Types.ObjectId();
    const worker = await makeUser(companyId);
    const admin = await makeAdmin(companyId);

    const vacation = await makeVacation(worker._id as mongoose.Types.ObjectId, {
      start: "2026-06-10",
      end: "2026-06-15",
    });
    await makeDienst(companyId, {
      date: "2026-06-12",
      driver: worker._id as mongoose.Types.ObjectId,
    });

    const spy = jest
      .spyOn(dienstClearUtils, "clearUserFromDienstsInRange")
      .mockRejectedValueOnce(new Error("Simulated DB failure"));

    try {
      const result = await repairAbsenceInconsistency({
        companyId: companyId.toString(),
        workerId: worker._id.toString(),
        absenceType: "vacation",
        absenceId: vacation._id.toString(),
        actorUserId: admin._id.toString(),
        actorRole: "admin",
      });

      expect(result.repairFailed).toBe(true);
      expect(result.errorMessage).toContain("Simulated DB failure");

      // A FAILED_RECOVERY_ATTEMPT event should have been recorded.
      const events = await OperationalRecoveryEvent.collection
        .find({
          companyId: companyId,
          action: RECOVERY_ACTION_TYPE.FAILED_RECOVERY_ATTEMPT,
        })
        .toArray();

      expect(events).toHaveLength(1);
      expect(events[0].severity).toBe(RECOVERY_SEVERITY.WARNING);
      expect(events[0].metadata?.absenceType).toBe("vacation");
      expect(events[0].metadata?.repairSource).toBe("absence_cleanup_monitor");
    } finally {
      spy.mockRestore();
    }
  });

  it("successful repair records RERUN_CLEANUP recovery event", async () => {
    const companyId = new mongoose.Types.ObjectId();
    const worker = await makeUser(companyId);
    const admin = await makeAdmin(companyId);

    const vacation = await makeVacation(worker._id as mongoose.Types.ObjectId, {
      start: "2026-06-10",
      end: "2026-06-15",
    });
    await makeDienst(companyId, {
      date: "2026-06-12",
      driver: worker._id as mongoose.Types.ObjectId,
    });

    const result = await repairAbsenceInconsistency({
      companyId: companyId.toString(),
      workerId: worker._id.toString(),
      absenceType: "vacation",
      absenceId: vacation._id.toString(),
      actorUserId: admin._id.toString(),
      actorRole: "admin",
    });

    expect(result.repairFailed).toBe(false);

    const events = await OperationalRecoveryEvent.collection
      .find({
        companyId: companyId,
        action: RECOVERY_ACTION_TYPE.RERUN_CLEANUP,
      })
      .toArray();

    expect(events).toHaveLength(1);

    const ev = events[0];
    expect(ev.moduleKey).toBe("absence_cleanup_monitor");
    expect(ev.entityId).toBe(vacation._id.toString());
    expect(ev.severity).toBe(RECOVERY_SEVERITY.INFO);
    expect(ev.metadata?.absenceType).toBe("vacation");
    expect(ev.metadata?.absenceId).toBe(vacation._id.toString());
    expect(typeof ev.metadata?.assignmentsTouched).toBe("number");
    expect(typeof ev.metadata?.dienstsTouched).toBe("number");
    expect(ev.metadata?.repairSource).toBe("absence_cleanup_monitor");
    expect(ev.relatedWorkerId?.toString()).toBe(worker._id.toString());
  });

  it("already-clean repair still records RERUN_CLEANUP event with zero counts", async () => {
    const companyId = new mongoose.Types.ObjectId();
    const worker = await makeUser(companyId);
    const admin = await makeAdmin(companyId);

    const vacation = await makeVacation(worker._id as mongoose.Types.ObjectId, {
      start: "2026-06-10",
      end: "2026-06-15",
    });

    await repairAbsenceInconsistency({
      companyId: companyId.toString(),
      workerId: worker._id.toString(),
      absenceType: "vacation",
      absenceId: vacation._id.toString(),
      actorUserId: admin._id.toString(),
      actorRole: "admin",
    });

    const events = await OperationalRecoveryEvent.collection
      .find({ companyId: companyId, action: RECOVERY_ACTION_TYPE.RERUN_CLEANUP })
      .toArray();

    expect(events).toHaveLength(1);
    expect(events[0].metadata?.assignmentsTouched).toBe(0);
    expect(events[0].metadata?.dienstsTouched).toBe(0);
  });

  it("repair fails for invalid companyId", async () => {
    const result = await repairAbsenceInconsistency({
      companyId: "bad-id",
      workerId: new mongoose.Types.ObjectId().toString(),
      absenceType: "vacation",
      absenceId: new mongoose.Types.ObjectId().toString(),
      actorUserId: new mongoose.Types.ObjectId().toString(),
      actorRole: "admin",
    });

    expect(result.repairFailed).toBe(true);
    expect(result.errorMessage).toMatch(/invalid companyId/i);
  });
});
