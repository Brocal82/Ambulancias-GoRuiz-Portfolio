/**
 * Tests de integración para Praemien - monthly-summary / monthly-history (IDOR fix).
 * Requiere .env.test con MONGODB_URI_TEST y JWT_SECRET.
 * Usa una DB real dedicada para tests (ej: ambulancias_test).
 */
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import MonthlyPraemie from "../modules/praemien/models/monthly-praemie.model";
import {
  createTestAdminWithCompany,
  createTestWorkerInCompany,
} from "./test-helpers";

const API = "/api";

describe("Praemien - monthly-summary / monthly-history (IDOR fix)", () => {
  let adminToken: string;
  let workerToken: string;
  let workerId: string;
  let adminId: string;
  let companyOid: mongoose.Types.ObjectId;

  const ambulanceId = new mongoose.Types.ObjectId();
  const minimalTrip = {
    auftragNumber: "T1",
    patientName: "P1",
    fromAddress: "A",
    toAddress: "B",
    timeWarning: "08:00",
    wasCancelled: false,
    countsTrip: 1 as const,
  };

  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
    const { adminId: aid, adminToken: aTok, company } =
      await createTestAdminWithCompany();
    adminId = aid;
    adminToken = aTok;
    companyOid = company._id as mongoose.Types.ObjectId;

    const worker = await createTestWorkerInCompany(companyOid);
    workerId = String(worker._id);
    const workerRes = await request(app)
      .post(`${API}/users/login`)
      .send({ email: worker.email, password: "password123" });
    workerToken = workerRes.body.token;

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const dateStr = `${year}-${month}-01`;

    const WorkdaySummary = mongoose.model("WorkdaySummary");
    await WorkdaySummary.create({
      date: dateStr,
      assignmentId: `assign-praemien-${Date.now()}`,
      driver: adminId,
      medic: adminId,
      ambulanceId,
      ambulanceNumber: "1",
      initialKm: 0,
      totalDienstKm: 10,
      trips: [minimalTrip],
      totalEffectivePatients: 10,
      totalRealTrips: 1,
      companyId: companyOid,
      isFinalClosure: true,
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("GET /api/praemien/monthly-summary sin token devuelve 401", async () => {
    await request(app)
      .get(`${API}/praemien/monthly-summary`)
      .expect(401);
  });

  it("worker sin userId recibe sus propios datos (o vacío)", async () => {
    const res = await request(app)
      .get(`${API}/praemien/monthly-summary`)
      .set("Authorization", `Bearer ${workerToken}`)
      .expect(200);
    expect(res.body).toHaveProperty("monthlyData");
    expect(res.body).toHaveProperty("averagePatients");
    expect(Array.isArray(res.body.monthlyData)).toBe(true);
  });

  it("worker con ?userId=adminId ignora el query y recibe sus propios datos (IDOR fix)", async () => {
    const resWorker = await request(app)
      .get(`${API}/praemien/monthly-summary`)
      .set("Authorization", `Bearer ${workerToken}`)
      .expect(200);

    const resWorkerWithAdminId = await request(app)
      .get(`${API}/praemien/monthly-summary?userId=${adminId}`)
      .set("Authorization", `Bearer ${workerToken}`)
      .expect(200);

    expect(resWorkerWithAdminId.body).toEqual(resWorker.body);
  });

  it("admin con ?userId=workerId recibe datos del worker", async () => {
    const res = await request(app)
      .get(`${API}/praemien/monthly-summary?userId=${workerId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body).toHaveProperty("monthlyData");
    expect(res.body).toHaveProperty("averagePatients");
  });

  it("admin sin userId recibe sus propios datos", async () => {
    const res = await request(app)
      .get(`${API}/praemien/monthly-summary`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body).toHaveProperty("monthlyData");
    expect(res.body.monthlyData.length).toBeGreaterThan(0);
    expect(res.body.averagePatients).toBe(10);
  });

  it("admin con ?userId inválido devuelve 400", async () => {
    const res = await request(app)
      .get(`${API}/praemien/monthly-summary?userId=id-invalido`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(400);
    expect(res.body).toHaveProperty("message");
    expect(res.body.message).toBe("userId inválido");
  });

  it("GET /api/praemien/monthly-history incluye meses solo-manual al estar la empresa en automático", async () => {
    const histYear = 2018;
    const histMonth = 9;
    await MonthlyPraemie.create({
      userId: workerId,
      companyId: companyOid,
      year: histYear,
      month: histMonth,
      averagePatients: 11.5,
      premieLevel: "B",
      snapshotSource: "manual",
    });
    try {
      const res = await request(app)
        .get(`${API}/praemien/monthly-history`)
        .set("Authorization", `Bearer ${workerToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const hit = res.body.find(
        (x: { year: number; month: number }) =>
          x.year === histYear && x.month === histMonth,
      );
      expect(hit).toBeDefined();
      expect(hit.averagePatients).toBe(11.5);
    } finally {
      await MonthlyPraemie.deleteOne({
        userId: workerId,
        year: histYear,
        month: histMonth,
      });
    }
  });

  it("GET /api/praemien/monthly-history worker con ?userId=adminId ignora query (IDOR fix)", async () => {
    const resWorker = await request(app)
      .get(`${API}/praemien/monthly-history`)
      .set("Authorization", `Bearer ${workerToken}`)
      .expect(200);

    const resWorkerWithAdminId = await request(app)
      .get(`${API}/praemien/monthly-history?userId=${adminId}`)
      .set("Authorization", `Bearer ${workerToken}`)
      .expect(200);

    expect(resWorkerWithAdminId.body).toEqual(resWorker.body);
  });
});

describe("Praemien hardening — automatic aggregation", () => {
  let adminToken: string;
  let adminId: string;
  let companyOid: mongoose.Types.ObjectId;
  let otherAdminId: string;
  let otherAdminToken: string;
  let otherCompanyOid: mongoose.Types.ObjectId;
  const HARDEN_YEAR = 2031;
  const HARDEN_MONTH = 6;
  const hardenDate = `${HARDEN_YEAR}-${String(HARDEN_MONTH).padStart(2, "0")}-15`;
  const assignmentPartial = `assign-praem-partial-${Date.now()}`;
  const assignmentFinal = `assign-praem-final-${Date.now()}`;
  const assignmentOtherCo = `assign-praem-otherco-${Date.now()}`;
  const assignmentLegacyNull = `assign-praem-legacy-${Date.now()}`;
  const ambulanceId = new mongoose.Types.ObjectId();

  const minimalTrip = {
    auftragNumber: "H1",
    patientName: "P1",
    fromAddress: "A",
    toAddress: "B",
    timeWarning: "08:00",
    wasCancelled: false,
    countsTrip: 1 as const,
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(env.MONGODB_URI);
    }
    const { adminId: aid, adminToken: aTok, company } =
      await createTestAdminWithCompany();
    adminId = aid;
    adminToken = aTok;
    companyOid = company._id as mongoose.Types.ObjectId;

    const other = await createTestAdminWithCompany();
    otherAdminId = other.adminId;
    otherCompanyOid = other.company._id as mongoose.Types.ObjectId;
    otherAdminToken = other.adminToken;

    const WorkdaySummary = mongoose.model("WorkdaySummary");

    await WorkdaySummary.create({
      date: hardenDate,
      assignmentId: assignmentPartial,
      driver: adminId,
      medic: adminId,
      ambulanceId,
      ambulanceNumber: "1",
      initialKm: 0,
      totalDienstKm: 5,
      trips: [minimalTrip],
      totalEffectivePatients: 99,
      totalRealTrips: 1,
      companyId: companyOid,
      isFinalClosure: false,
    });

    await WorkdaySummary.create({
      date: hardenDate,
      assignmentId: assignmentFinal,
      driver: adminId,
      medic: adminId,
      ambulanceId,
      ambulanceNumber: "1",
      initialKm: 0,
      totalDienstKm: 5,
      trips: [minimalTrip],
      totalEffectivePatients: 7,
      totalRealTrips: 1,
      companyId: companyOid,
      isFinalClosure: true,
      isReviewed: false,
    });

    await WorkdaySummary.create({
      date: hardenDate,
      assignmentId: assignmentOtherCo,
      driver: otherAdminId,
      medic: otherAdminId,
      ambulanceId,
      ambulanceNumber: "1",
      initialKm: 0,
      totalDienstKm: 5,
      trips: [minimalTrip],
      totalEffectivePatients: 50,
      totalRealTrips: 1,
      companyId: otherCompanyOid,
      isFinalClosure: true,
    });

    await WorkdaySummary.create({
      date: hardenDate,
      assignmentId: assignmentLegacyNull,
      driver: adminId,
      medic: adminId,
      ambulanceId,
      ambulanceNumber: "1",
      initialKm: 0,
      totalDienstKm: 5,
      trips: [minimalTrip],
      totalEffectivePatients: 3,
      totalRealTrips: 1,
      companyId: null,
      isFinalClosure: true,
    });
  });

  afterAll(async () => {
    const WorkdaySummary = mongoose.model("WorkdaySummary");
    await WorkdaySummary.deleteMany({
      assignmentId: {
        $in: [
          assignmentPartial,
          assignmentFinal,
          assignmentOtherCo,
          assignmentLegacyNull,
        ],
      },
    });
  });

  it("monthly-summary sums partial and final closures per calendar day", async () => {
    const WorkdaySummary = mongoose.model("WorkdaySummary");
    const finalRow = await WorkdaySummary.findOne({
      assignmentId: assignmentFinal,
    }).lean();
    expect((finalRow as { isReviewed?: boolean } | null)?.isReviewed).not.toBe(true);

    const res = await request(app)
      .post(`${API}/praemien/save-monthly`)
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ year: HARDEN_YEAR, month: HARDEN_MONTH })
      .expect(200);

    expect(res.body.data).toBeDefined();
    // partial 99 + final 7 on same day (legacy null 3 excluded by companyId filter)
    expect(res.body.data.averagePatients).toBe(106);
  });

  it("automatic aggregation ignores cross-tenant WorkdaySummary rows", async () => {
    const resOwn = await request(app)
      .post(`${API}/praemien/save-monthly`)
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ year: HARDEN_YEAR, month: HARDEN_MONTH })
      .expect(200);

    expect(resOwn.body.data?.averagePatients).toBe(106);

    const resOther = await request(app)
      .post(`${API}/praemien/save-monthly`)
      .set("Authorization", `Bearer ${otherAdminToken}`)
      .query({ year: HARDEN_YEAR, month: HARDEN_MONTH })
      .expect(200);

    expect(resOther.body.data?.averagePatients).toBe(50);
  });

  it("automatic aggregation ignores legacy companyId:null summaries", async () => {
    const res = await request(app)
      .post(`${API}/praemien/save-monthly`)
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ year: HARDEN_YEAR, month: HARDEN_MONTH })
      .expect(200);

    expect(res.body.data?.averagePatients).toBe(106);
  });

  it("same assignment: multiple partials + final sum totalEffectivePatients for the day", async () => {
    const SAME_TEAM_YEAR = 2031;
    const SAME_TEAM_MONTH = 7;
    const assignmentSameTeam = `assign-praem-same-team-${Date.now()}`;
    const teamDate = `${SAME_TEAM_YEAR}-${String(SAME_TEAM_MONTH).padStart(2, "0")}-10`;
    const WorkdaySummary = mongoose.model("WorkdaySummary");

    await WorkdaySummary.create([
      {
        date: teamDate,
        assignmentId: assignmentSameTeam,
        driver: adminId,
        medic: adminId,
        ambulanceId,
        ambulanceNumber: "1",
        initialKm: 0,
        totalDienstKm: 5,
        trips: [minimalTrip],
        totalEffectivePatients: 4,
        totalRealTrips: 1,
        companyId: companyOid,
        isFinalClosure: false,
      },
      {
        date: teamDate,
        assignmentId: assignmentSameTeam,
        driver: adminId,
        medic: adminId,
        ambulanceId,
        ambulanceNumber: "1",
        initialKm: 0,
        totalDienstKm: 5,
        trips: [minimalTrip],
        totalEffectivePatients: 2,
        totalRealTrips: 1,
        companyId: companyOid,
        isFinalClosure: false,
      },
      {
        date: teamDate,
        assignmentId: assignmentSameTeam,
        driver: adminId,
        medic: adminId,
        ambulanceId,
        ambulanceNumber: "1",
        initialKm: 0,
        totalDienstKm: 5,
        trips: [minimalTrip],
        totalEffectivePatients: 1.5,
        totalRealTrips: 1,
        companyId: companyOid,
        isFinalClosure: true,
      },
    ]);

    try {
      const res = await request(app)
        .post(`${API}/praemien/save-monthly`)
        .set("Authorization", `Bearer ${adminToken}`)
        .query({ year: SAME_TEAM_YEAR, month: SAME_TEAM_MONTH })
        .expect(200);

      expect(res.body.data?.averagePatients).toBe(7.5);
    } finally {
      await WorkdaySummary.deleteMany({ assignmentId: assignmentSameTeam });
    }
  });
});
