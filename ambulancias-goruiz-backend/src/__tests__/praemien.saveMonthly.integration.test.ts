/**
 * POST /api/praemien/save-monthly — admin write, role y contexto empresa.
 * No cubre GET monthly-summary/history (ya cubierto en praemien.integration.test.ts).
 */
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import {
  createTestAdminWithCompany,
  createTestAdminUser,
  createTestWorkerInCompany,
  issueTestJwt,
} from "./test-helpers";
import WorkdaySummary from "../modules/workday-summary/models/workday-summary.model";
import MonthlyPraemie from "../modules/praemien/models/monthly-praemie.model";
import User from "../modules/users/models/user.model";
import Company from "../modules/companies/models/company.model";

const API = "/api";

const SAVE_YEAR = 2033;
const SAVE_MONTH = 4;
/** Mes distinto para probar protección de snapshot manual sin chocar con el guardado automático del primer test. */
const SAVE_MONTH_PROTECT = 5;

describe("Praemien save-monthly (integration)", () => {
  let adminToken: string;
  let adminId: string;
  let companyOid: mongoose.Types.ObjectId;
  let assignmentKey: string;
  let assignmentKeyProtect: string;
  let ambulanceOid: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);

    const data = await createTestAdminWithCompany();
    adminToken = data.adminToken;
    adminId = data.adminId;
    companyOid = data.company._id as mongoose.Types.ObjectId;
    ambulanceOid = new mongoose.Types.ObjectId();
    assignmentKey = `assign-save-praem-${Date.now()}`;
    assignmentKeyProtect = `assign-save-praem-prot-${Date.now()}`;

    const minimalTrip = {
      auftragNumber: "S1",
      patientName: "P1",
      fromAddress: "A",
      toAddress: "B",
      timeWarning: "08:00",
      wasCancelled: false,
      countsTrip: 1 as const,
    };

    await WorkdaySummary.create({
      date: `${SAVE_YEAR}-${String(SAVE_MONTH).padStart(2, "0")}-10`,
      assignmentId: assignmentKey,
      driver: new mongoose.Types.ObjectId(adminId),
      medic: new mongoose.Types.ObjectId(adminId),
      ambulanceId: ambulanceOid,
      ambulanceNumber: "1",
      initialKm: 0,
      totalDienstKm: 5,
      trips: [minimalTrip],
      totalEffectivePatients: 8,
      totalRealTrips: 1,
      companyId: companyOid,
      isFinalClosure: true,
    });

    await WorkdaySummary.create({
      date: `${SAVE_YEAR}-${String(SAVE_MONTH_PROTECT).padStart(2, "0")}-11`,
      assignmentId: assignmentKeyProtect,
      driver: new mongoose.Types.ObjectId(adminId),
      medic: new mongoose.Types.ObjectId(adminId),
      ambulanceId: ambulanceOid,
      ambulanceNumber: "1",
      initialKm: 0,
      totalDienstKm: 5,
      trips: [minimalTrip],
      totalEffectivePatients: 6,
      totalRealTrips: 1,
      companyId: companyOid,
      isFinalClosure: true,
    });
  });

  afterAll(async () => {
    await WorkdaySummary.deleteMany({
      assignmentId: { $in: [assignmentKey, assignmentKeyProtect] },
    });
    await MonthlyPraemie.deleteMany({ userId: adminId });
    await User.deleteOne({ _id: adminId });
    await Company.deleteOne({ _id: companyOid });
    await mongoose.disconnect();
  });

  it("admin con empresa y datos del mes => 200 y guarda prämie", async () => {
    const res = await request(app)
      .post(`${API}/praemien/save-monthly`)
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ year: SAVE_YEAR, month: SAVE_MONTH })
      .expect(200);

    expect(res.body.message).toMatch(/pr|premium|guardad|mensual/i);
    expect(res.body.data).toBeDefined();
    const row = await MonthlyPraemie.findOne({
      userId: adminId,
      year: SAVE_YEAR,
      month: SAVE_MONTH,
    }).lean();
    expect(row).not.toBeNull();
    expect(typeof row?.averagePatients).toBe("number");
  });

  it("no sobrescribe MonthlyPraemie con snapshotSource manual (empresa en automático)", async () => {
    await MonthlyPraemie.create({
      userId: adminId,
      companyId: companyOid,
      year: SAVE_YEAR,
      month: SAVE_MONTH_PROTECT,
      averagePatients: 99,
      premieLevel: "A",
      snapshotSource: "manual",
    });

    const res = await request(app)
      .post(`${API}/praemien/save-monthly`)
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ year: SAVE_YEAR, month: SAVE_MONTH_PROTECT })
      .expect(200);

    expect(String(res.body.message)).toMatch(/manual|sobrescribir/i);
    expect(res.body.data).toBeUndefined();

    const row = await MonthlyPraemie.findOne({
      userId: adminId,
      year: SAVE_YEAR,
      month: SAVE_MONTH_PROTECT,
    }).lean();
    expect(row?.averagePatients).toBe(99);
    expect(row?.snapshotSource).toBe("manual");
  });

  it("worker => 403 rol insuficiente", async () => {
    const worker = await createTestWorkerInCompany(companyOid, Date.now() + 99);
    const workerJwt = issueTestJwt(String(worker._id), "worker", String(companyOid));

    const res = await request(app)
      .post(`${API}/praemien/save-monthly`)
      .set("Authorization", `Bearer ${workerJwt}`)
      .query({ year: SAVE_YEAR, month: SAVE_MONTH });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/rol|acceso/i);

    await User.deleteOne({ _id: worker._id });
  });

  it("sin autenticación => 401", async () => {
    const res = await request(app)
      .post(`${API}/praemien/save-monthly`)
      .query({ year: SAVE_YEAR, month: SAVE_MONTH });

    expect(res.status).toBe(401);
  });

  it("admin sin companyId en usuario => 403 (praemien requiere empresa)", async () => {
    const legacyAdmin = await createTestAdminUser(
      `praem-noco-${Date.now()}@example.com`,
      "password123",
    );
    try {
      const token = issueTestJwt(String(legacyAdmin._id), "admin");
      const res = await request(app)
        .post(`${API}/praemien/save-monthly`)
        .set("Authorization", `Bearer ${token}`)
        .query({ year: SAVE_YEAR, month: SAVE_MONTH });

      expect(res.status).toBe(403);
      expect(String(res.body.message)).toMatch(/empresa|asociado/i);
    } finally {
      await User.deleteOne({ _id: legacyAdmin._id });
    }
  });

  it("year/month ausentes o inválidos => 400 (sin fallback silencioso)", async () => {
    const cases = [
      {},
      { year: SAVE_YEAR },
      { month: SAVE_MONTH },
      { year: "abc", month: SAVE_MONTH },
      { year: SAVE_YEAR, month: 0 },
      { year: SAVE_YEAR, month: 13 },
    ];

    for (const query of cases) {
      const res = await request(app)
        .post(`${API}/praemien/save-monthly`)
        .set("Authorization", `Bearer ${adminToken}`)
        .query(query);
      expect(res.status).toBe(400);
      expect(String(res.body.message)).toMatch(/year|month|año|mes|obligatorio|inválido|rango/i);
    }
  });
});
