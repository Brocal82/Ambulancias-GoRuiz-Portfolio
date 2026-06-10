/**
 * Phase 3: manual daily Prämien entries — worker API + mode gate.
 * Requiere .env.test con MONGODB_URI (o MONGODB_URI_TEST si el proyecto lo usa).
 */
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import Company from "../modules/companies/models/company.model";
import { MODULE_KEYS } from "../modules/companies/constants/modules.constants";
import MonthlyPraemie from "../modules/praemien/models/monthly-praemie.model";
import PraemienManualDailyEntry from "../modules/praemien/models/praemien-manual-daily-entry.model";
import User from "../modules/users/models/user.model";
import WorkdaySummary from "../modules/workday-summary/models/workday-summary.model";
import {
  createTestAdminWithCompany,
  createTestWorkerInCompany,
} from "./test-helpers";

const API = "/api";

describe("Praemien - manual-daily (Phase 3 + 4)", () => {
  let workerToken: string;
  let adminToken: string;
  let workerId: string;
  let companyId: mongoose.Types.ObjectId;

  const pad = (n: number) => String(n).padStart(2, "0");
  const dateKeyFrom = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const daysAgoDateKey = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return dateKeyFrom(d);
  };

  /** PUT manual-daily exige cierre final de jornada ese día (WorkdaySummary). */
  async function seedWorkerFinalClosureDay(
    dateStr: string,
    assignmentId: string,
  ): Promise<void> {
    await WorkdaySummary.create({
      date: dateStr,
      assignmentId,
      driver: new mongoose.Types.ObjectId(workerId),
      medic: new mongoose.Types.ObjectId(workerId),
      ambulanceId: new mongoose.Types.ObjectId(),
      ambulanceNumber: "99",
      initialKm: 0,
      totalDienstKm: 1,
      trips: [
        {
          auftragNumber: "MT",
          patientName: "P",
          fromAddress: "A",
          toAddress: "B",
          timeWarning: "08:00",
          wasCancelled: false,
          countsTrip: 1 as const,
        },
      ],
      totalEffectivePatients: 1,
      totalRealTrips: 1,
      companyId,
      isFinalClosure: true,
    });
  }

  async function seedWorkerPartialClosureDay(
    dateStr: string,
    assignmentId: string,
    totalRealTrips: number,
  ): Promise<void> {
    await WorkdaySummary.create({
      date: dateStr,
      assignmentId,
      driver: new mongoose.Types.ObjectId(workerId),
      medic: new mongoose.Types.ObjectId(workerId),
      ambulanceId: new mongoose.Types.ObjectId(),
      ambulanceNumber: "99",
      initialKm: 0,
      totalDienstKm: 1,
      trips: [
        {
          auftragNumber: "PT",
          patientName: "P",
          fromAddress: "A",
          toAddress: "B",
          timeWarning: "08:00",
          wasCancelled: false,
          countsTrip: 1 as const,
        },
      ],
      totalEffectivePatients: Math.max(totalRealTrips, 1),
      totalRealTrips,
      companyId,
      isFinalClosure: false,
      partialClosureReason: "test",
    });
  }

  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
    const { adminToken: aTok, company } = await createTestAdminWithCompany();
    adminToken = aTok;
    companyId = company._id as mongoose.Types.ObjectId;

    const worker = await createTestWorkerInCompany(companyId);
    workerId = String(worker._id);
    const workerRes = await request(app)
      .post(`${API}/users/login`)
      .send({ email: worker.email, password: "password123" });
    workerToken = workerRes.body.token;
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("PUT /api/praemien/manual-daily rechaza en modo automático (403)", async () => {
    await Company.updateOne(
      { _id: companyId },
      {
        $set: {
          praemienMode: "automatic",
          praemienModeEffectiveFrom: null,
        },
      },
    );

    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const res = await request(app)
      .put(`${API}/praemien/manual-daily`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ date: dateStr, workerSubmittedValue: 5 })
      .expect(403);
    expect(res.body.message).toBeDefined();
  });

  it("PUT /api/praemien/manual-daily rechaza si manual aún no vigente (403)", async () => {
    const now = new Date();
    let fy = now.getFullYear();
    let fm = now.getMonth() + 3;
    if (fm > 12) {
      fm -= 12;
      fy += 1;
    }
    await Company.updateOne(
      { _id: companyId },
      {
        $set: {
          praemienMode: "manual",
          praemienModeEffectiveFrom: { year: fy, month: fm },
        },
      },
    );

    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const res = await request(app)
      .put(`${API}/praemien/manual-daily`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ date: dateStr, workerSubmittedValue: 3 })
      .expect(403);
    expect(res.body.message).toBeDefined();
  });

  it("worker: PUT luego GET month en modo manual vigente (200)", async () => {
    const now = new Date();
    const eff = { year: now.getFullYear(), month: now.getMonth() + 1 };
    await Company.updateOne(
      { _id: companyId },
      {
        $set: {
          praemienMode: "manual",
          praemienModeEffectiveFrom: eff,
        },
      },
    );

    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const assignmentKey = `ws-put-month-${Date.now()}`;
    await seedWorkerFinalClosureDay(dateStr, assignmentKey);
    await seedWorkerPartialClosureDay(dateStr, `${assignmentKey}-partial`, 2);

    try {
      const putRes = await request(app)
        .put(`${API}/praemien/manual-daily`)
        .set("Authorization", `Bearer ${workerToken}`)
        .send({ date: dateStr, workerSubmittedValue: 7, status: "submitted" })
        .expect(200);

      expect(putRes.body).toMatchObject({
        date: dateStr,
        workerSubmittedValue: 9,
        status: "submitted",
      });

      const listRes = await request(app)
        .get(
          `${API}/praemien/manual-daily/month?year=${now.getFullYear()}&month=${now.getMonth() + 1}`,
        )
        .set("Authorization", `Bearer ${workerToken}`)
        .expect(200);

      expect(Array.isArray(listRes.body)).toBe(true);
      const found = listRes.body.find((x: { date: string }) => x.date === dateStr);
      expect(found).toBeDefined();
      expect(found.workerSubmittedValue).toBe(9);
    } finally {
      await WorkdaySummary.deleteMany({ assignmentId: { $in: [assignmentKey, `${assignmentKey}-partial`] } });
      await PraemienManualDailyEntry.deleteMany({
        companyId,
        userId: new mongoose.Types.ObjectId(workerId),
        date: dateStr,
      });
    }
  });

  it("worker: sin módulo workday puede registrar manual daily y ver días elegibles del mes", async () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    await Company.updateOne(
      { _id: companyId },
      {
        $set: {
          praemienMode: "manual",
          praemienModeEffectiveFrom: { year: y, month: m },
          enabledModules: [MODULE_KEYS.PRAEMIEN],
        },
      },
    );

    try {
      const putRes = await request(app)
        .put(`${API}/praemien/manual-daily`)
        .set("Authorization", `Bearer ${workerToken}`)
        .send({ date: dateStr, workerSubmittedValue: 8, status: "submitted" })
        .expect(200);

      expect(putRes.body).toMatchObject({
        date: dateStr,
        workerSubmittedValue: 8,
        status: "submitted",
      });

      const datesRes = await request(app)
        .get(`${API}/praemien/manual-daily/final-closure-dates?year=${y}&month=${m}`)
        .set("Authorization", `Bearer ${workerToken}`)
        .expect(200);

      expect(Array.isArray(datesRes.body?.dates)).toBe(true);
      expect(datesRes.body.dates).toContain(dateStr);
    } finally {
      await PraemienManualDailyEntry.deleteMany({
        companyId,
        userId: new mongoose.Types.ObjectId(workerId),
        date: dateStr,
      });
      await Company.updateOne(
        { _id: companyId },
        { $set: { enabledModules: Object.values(MODULE_KEYS) } },
      );
    }
  });

  it("admin no puede usar PUT manual-daily (403 rol)", async () => {
    const now = new Date();
    await Company.updateOne(
      { _id: companyId },
      {
        $set: {
          praemienMode: "manual",
          praemienModeEffectiveFrom: {
            year: now.getFullYear(),
            month: now.getMonth() + 1,
          },
        },
      },
    );

    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    await request(app)
      .put(`${API}/praemien/manual-daily`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ date: dateStr, workerSubmittedValue: 1 })
      .expect(403);
  });

  it("Phase 4: admin list + approve + worker bloqueado + reopen + worker sigue bloqueado; admin corrige", async () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const dateStr = daysAgoDateKey(2);
    const assignmentKey = `ws-phase4-18-${Date.now()}`;
    await seedWorkerFinalClosureDay(dateStr, assignmentKey);

    try {
    await request(app)
      .put(`${API}/praemien/manual-daily`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ date: dateStr, workerSubmittedValue: 4 })
      .expect(200);

    const list = await request(app)
      .get(`${API}/praemien/manual-daily/admin/month?userId=${workerId}&year=${y}&month=${m}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body.some((e: { date: string }) => e.date === dateStr)).toBe(true);

    await request(app)
      .post(`${API}/praemien/manual-daily/admin/approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ userId: workerId, date: dateStr })
      .expect(200);

    await request(app)
      .put(`${API}/praemien/manual-daily`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ date: dateStr, workerSubmittedValue: 9 })
      .expect(403);

    await request(app)
      .post(`${API}/praemien/manual-daily/admin/reopen`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ userId: workerId, date: dateStr, note: "fix" })
      .expect(200);

    const workerMonthAfterReopen = await request(app)
      .get(`${API}/praemien/manual-daily/month?year=${y}&month=${m}`)
      .set("Authorization", `Bearer ${workerToken}`)
      .expect(200);
    const rowAfterReopen = workerMonthAfterReopen.body.find(
      (e: { date: string }) => e.date === dateStr,
    );
    expect(rowAfterReopen?.status).toBe("approved");

    await request(app)
      .put(`${API}/praemien/manual-daily`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ date: dateStr, workerSubmittedValue: 9 })
      .expect(403);

    const cap = await request(app)
      .post(`${API}/praemien/manual-daily/admin/correct-approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ userId: workerId, date: dateStr, adminFinalValue: 11 })
      .expect(200);
    expect(cap.body.status).toBe("approved");
    expect(cap.body.adminFinalValue).toBe(11);
    expect(cap.body.originalWorkerValue).toBe(4);
    } finally {
      await WorkdaySummary.deleteMany({ assignmentId: assignmentKey });
      await PraemienManualDailyEntry.deleteMany({
        companyId,
        userId: new mongoose.Types.ObjectId(workerId),
        date: dateStr,
      });
    }
  });

  it("Dienst: al enviar el conductor, el médico recibe fila submitted sin haber enviado", async () => {
    const now = new Date();
    const ref = new Date(now.getFullYear(), now.getMonth() - 1, 16);
    const y = ref.getFullYear();
    const m = ref.getMonth() + 1;
    const dateStr = `${y}-${pad(m)}-16`;
    const assignmentKey = `ws-teammate-submit-${Date.now()}`;
    const ambulanceOid = new mongoose.Types.ObjectId();

    await Company.updateOne(
      { _id: companyId },
      {
        $set: {
          praemienMode: "manual",
          praemienModeEffectiveFrom: { year: y, month: m },
        },
      },
    );

    const medic = await createTestWorkerInCompany(companyId, Date.now() + 30411);
    const medicId = String(medic._id);
    const medicLogin = await request(app)
      .post(`${API}/users/login`)
      .send({ email: medic.email, password: "password123" });
    expect(medicLogin.body.token).toBeDefined();
    const medicToken = medicLogin.body.token as string;

    const minimalTrip = {
      auftragNumber: "TS2",
      patientName: "P",
      fromAddress: "A",
      toAddress: "B",
      timeWarning: "08:00",
      wasCancelled: false,
      countsTrip: 1 as const,
    };

    await WorkdaySummary.create({
      date: dateStr,
      assignmentId: assignmentKey,
      driver: new mongoose.Types.ObjectId(workerId),
      medic: new mongoose.Types.ObjectId(medicId),
      ambulanceId: ambulanceOid,
      ambulanceNumber: "TS-99",
      initialKm: 0,
      totalDienstKm: 1,
      trips: [minimalTrip],
      totalEffectivePatients: 1,
      totalRealTrips: 1,
      companyId,
      isFinalClosure: true,
    });

    try {
      await request(app)
        .put(`${API}/praemien/manual-daily`)
        .set("Authorization", `Bearer ${workerToken}`)
        .send({ date: dateStr, workerSubmittedValue: 5, status: "submitted" })
        .expect(200);

      const medicMonth = await request(app)
        .get(`${API}/praemien/manual-daily/month?year=${y}&month=${m}`)
        .set("Authorization", `Bearer ${medicToken}`)
        .expect(200);

      const medicRow = medicMonth.body.find(
        (x: { date: string }) => x.date === dateStr,
      );
      expect(medicRow).toBeDefined();
      expect(medicRow.status).toBe("submitted");
      expect(medicRow.workerSubmittedValue).toBe(5);

      const pending = await request(app)
        .get(`${API}/praemien/manual-daily/admin/pending-entries`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      const medicPending = (pending.body.items as { userId: string; date: string; workerSubmittedValue: number }[]).find(
        (x) => x.userId === medicId && x.date === dateStr,
      );
      expect(medicPending).toBeDefined();
      expect(medicPending!.workerSubmittedValue).toBe(5);
    } finally {
      await WorkdaySummary.deleteMany({ assignmentId: assignmentKey });
      await PraemienManualDailyEntry.deleteMany({ companyId, date: dateStr });
      await User.deleteOne({ _id: medic._id });
    }
  });

  it("Dienst: al aprobar al conductor con valor rectificado, el médico recibe la misma fila aprobada", async () => {
    const now = new Date();
    /** Mes calendario anterior: siempre ≤ hoy y sin colisión con otros casos del fichero. */
    const ref = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    const y = ref.getFullYear();
    const m = ref.getMonth() + 1;
    const dateStr = `${y}-${pad(m)}-15`;
    const assignmentKey = `ws-teammate-manual-${Date.now()}`;
    const ambulanceOid = new mongoose.Types.ObjectId();

    await Company.updateOne(
      { _id: companyId },
      {
        $set: {
          praemienMode: "manual",
          praemienModeEffectiveFrom: { year: y, month: m },
        },
      },
    );

    const medic = await createTestWorkerInCompany(companyId, Date.now() + 20411);
    const medicId = String(medic._id);
    const medicLogin = await request(app)
      .post(`${API}/users/login`)
      .send({ email: medic.email, password: "password123" });
    expect(medicLogin.body.token).toBeDefined();
    const medicToken = medicLogin.body.token as string;

    const minimalTrip = {
      auftragNumber: "TS1",
      patientName: "P",
      fromAddress: "A",
      toAddress: "B",
      timeWarning: "08:00",
      wasCancelled: false,
      countsTrip: 1 as const,
    };

    await WorkdaySummary.create({
      date: dateStr,
      assignmentId: assignmentKey,
      driver: new mongoose.Types.ObjectId(workerId),
      medic: new mongoose.Types.ObjectId(medicId),
      ambulanceId: ambulanceOid,
      ambulanceNumber: "TS-99",
      initialKm: 0,
      totalDienstKm: 1,
      trips: [minimalTrip],
      totalEffectivePatients: 1,
      totalRealTrips: 1,
      companyId,
      isFinalClosure: true,
    });

    try {
      await request(app)
        .put(`${API}/praemien/manual-daily`)
        .set("Authorization", `Bearer ${workerToken}`)
        .send({ date: dateStr, workerSubmittedValue: 3, status: "submitted" })
        .expect(200);

      await request(app)
        .post(`${API}/praemien/manual-daily/admin/approve`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ userId: workerId, date: dateStr, adminFinalValue: 8 })
        .expect(200);

      const medicMonth = await request(app)
        .get(
          `${API}/praemien/manual-daily/month?year=${y}&month=${m}`,
        )
        .set("Authorization", `Bearer ${medicToken}`)
        .expect(200);

      const medicRow = medicMonth.body.find(
        (x: { date: string }) => x.date === dateStr,
      );
      expect(medicRow).toBeDefined();
      expect(medicRow.status).toBe("approved");
      expect(medicRow.adminFinalValue).toBe(8);
      expect(medicRow.workerSubmittedValue).toBe(8);
    } finally {
      await WorkdaySummary.deleteMany({ assignmentId: assignmentKey });
      await PraemienManualDailyEntry.deleteMany({ companyId, date: dateStr });
      await User.deleteOne({ _id: medic._id });
    }
  });

  it("Phase 4: admin reject luego worker puede reenviar", async () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const dateStr = daysAgoDateKey(3);
    const assignmentKey = `ws-phase4-19-${Date.now()}`;
    await seedWorkerFinalClosureDay(dateStr, assignmentKey);

    try {
    await request(app)
      .put(`${API}/praemien/manual-daily`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ date: dateStr, workerSubmittedValue: 2 })
      .expect(200);

    await request(app)
      .post(`${API}/praemien/manual-daily/admin/reject`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ userId: workerId, date: dateStr, reason: "no" })
      .expect(200);

    const res = await request(app)
      .put(`${API}/praemien/manual-daily`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ date: dateStr, workerSubmittedValue: 5 })
      .expect(200);
    expect(res.body.status).toBe("submitted");
    } finally {
      await WorkdaySummary.deleteMany({ assignmentId: assignmentKey });
      await PraemienManualDailyEntry.deleteMany({
        companyId,
        userId: new mongoose.Types.ObjectId(workerId),
        date: dateStr,
      });
    }
  });

  it("Phase 5: monthly-history incluye mes cerrado manual desde snapshot", async () => {
    const now = new Date();
    const curYm0 = now.getFullYear() * 12 + now.getMonth();
    const prevYm0 = curYm0 - 1;
    const py = Math.floor(prevYm0 / 12);
    const pm = (prevYm0 % 12) + 1;

    await Company.updateOne(
      { _id: companyId },
      {
        $set: {
          praemienMode: "manual",
          praemienModeEffectiveFrom: { year: py, month: pm },
        },
      },
    );

    const dateStr = `${py}-${String(pm).padStart(2, "0")}-05`;
    const assignmentKey = `ws-phase5-hist-${Date.now()}`;
    await seedWorkerFinalClosureDay(dateStr, assignmentKey);

    try {
    await request(app)
      .put(`${API}/praemien/manual-daily`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ date: dateStr, workerSubmittedValue: 6 })
      .expect(200);

    await request(app)
      .post(`${API}/praemien/manual-daily/admin/approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ userId: workerId, date: dateStr })
      .expect(200);

    const hist = await request(app)
      .get(`${API}/praemien/monthly-history`)
      .set("Authorization", `Bearer ${workerToken}`)
      .expect(200);

    expect(Array.isArray(hist.body)).toBe(true);
    const hit = hist.body.find(
      (x: { year: number; month: number }) => x.year === py && x.month === pm,
    );
    expect(hit).toBeDefined();
    expect(hit.averagePatients).toBe(6);
    } finally {
      await WorkdaySummary.deleteMany({ assignmentId: assignmentKey });
      await PraemienManualDailyEntry.deleteMany({
        companyId,
        userId: new mongoose.Types.ObjectId(workerId),
        date: dateStr,
      });
      await MonthlyPraemie.deleteMany({
        userId: workerId,
        year: py,
        month: pm,
      });
    }
  });

  it("hardening: no se puede aprobar ni rechazar una fila en borrador", async () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const dateStr = daysAgoDateKey(4);
    const assignmentKey = `ws-hard-draft-${Date.now()}`;
    await seedWorkerFinalClosureDay(dateStr, assignmentKey);

    try {
    await request(app)
      .put(`${API}/praemien/manual-daily`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ date: dateStr, workerSubmittedValue: 3, status: "draft" })
      .expect(200);

    await request(app)
      .post(`${API}/praemien/manual-daily/admin/approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ userId: workerId, date: dateStr })
      .expect(400);

    await request(app)
      .post(`${API}/praemien/manual-daily/admin/reject`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ userId: workerId, date: dateStr, reason: "x" })
      .expect(400);

    await request(app)
      .post(`${API}/praemien/manual-daily/admin/correct-approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ userId: workerId, date: dateStr, adminFinalValue: 5 })
      .expect(400);
    } finally {
      await WorkdaySummary.deleteMany({ assignmentId: assignmentKey });
      await PraemienManualDailyEntry.deleteMany({
        companyId,
        userId: new mongoose.Types.ObjectId(workerId),
        date: dateStr,
      });
    }
  });

  it("hardening: trabajador no puede volver a borrador tras enviar", async () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const dateStr = daysAgoDateKey(5);
    const assignmentKey = `ws-hard-submit-${Date.now()}`;
    await seedWorkerFinalClosureDay(dateStr, assignmentKey);

    try {
    await request(app)
      .put(`${API}/praemien/manual-daily`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ date: dateStr, workerSubmittedValue: 4, status: "submitted" })
      .expect(200);

    await request(app)
      .put(`${API}/praemien/manual-daily`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ date: dateStr, workerSubmittedValue: 4, status: "draft" })
      .expect(400);
    } finally {
      await WorkdaySummary.deleteMany({ assignmentId: assignmentKey });
      await PraemienManualDailyEntry.deleteMany({
        companyId,
        userId: new mongoose.Types.ObjectId(workerId),
        date: dateStr,
      });
    }
  });

  it("Phase 5: save-monthly no escribe en modo manual efectivo", async () => {
    const now = new Date();
    await Company.updateOne(
      { _id: companyId },
      {
        $set: {
          praemienMode: "manual",
          praemienModeEffectiveFrom: {
            year: now.getFullYear(),
            month: now.getMonth() + 1,
          },
        },
      },
    );

    const res = await request(app)
      .post(`${API}/praemien/save-monthly`)
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ year: now.getFullYear(), month: now.getMonth() + 1 })
      .expect(200);

    expect(String(res.body.message)).toMatch(/manual|aprobadas/i);
  });
});
