/**
 * Tras publicar planificación: GET /me devuelve solo filas del trabajador; otro de la misma empresa no ve sus filas.
 * Flujo: semana + filas en BD (equivalente a publicación) → worker.
 */
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import {
  createTestAdminWithCompany,
  createTestWorkerInCompany,
  issueTestJwt,
} from "./test-helpers";
import ExcelPlanningWeek from "../modules/excel-planning/models/excel-planning-week.model";

const API = "/api/excel-planning";

/** Lunes 9 jun 2031 UTC (misma convención que excel-planning.isolation.test) */
const weekStart = new Date(Date.UTC(2031, 5, 9, 0, 0, 0, 0));
const YMD = "2031-06-09";

describe("Excel planning worker GET /me", () => {
  let companyId: string;
  let workerAssignedId: string;
  let workerOtherId: string;

  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
    const data = await createTestAdminWithCompany();
    companyId = data.companyId;
    const co = new mongoose.Types.ObjectId(companyId);

    const wAssigned = await createTestWorkerInCompany(co);
    const wOther = await createTestWorkerInCompany(co);
    workerAssignedId = String(wAssigned._id);
    workerOtherId = String(wOther._id);

    await ExcelPlanningWeek.create({
      companyId: co,
      weekStart,
      rows: [
        {
          dayIndex: 0,
          dayDate: weekStart,
          dienstNumber: "1",
          rawCellText: "08:00 A 1 B 2",
          matchMethod: "employee_number",
          matchedUserId: wAssigned._id,
          displayNameFromExcel: "Zeta, A",
        },
      ],
      normalizeEmployeeNumber: "trim",
      publishedAt: new Date(),
    });
  });

  afterAll(async () => {
    await ExcelPlanningWeek.deleteMany({
      companyId: new mongoose.Types.ObjectId(companyId),
    });
    await mongoose.disconnect();
  });

  it("el trabajador asignado recibe al menos una fila y published true", async () => {
    const token = issueTestJwt(workerAssignedId, "worker", companyId);
    const res = await request(app)
      .get(`${API}/me`)
      .query({ weekStart: YMD })
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(res.body.published).toBe(true);
    expect(Array.isArray(res.body.rows)).toBe(true);
    expect(res.body.rows.length).toBe(1);
  });

  it("otro trabajador de la misma empresa no recibe filas ajenas (rows vacías, published true)", async () => {
    const token = issueTestJwt(workerOtherId, "worker", companyId);
    const res = await request(app)
      .get(`${API}/me`)
      .query({ weekStart: YMD })
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(res.body.published).toBe(true);
    expect(res.body.rows.length).toBe(0);
  });
});
