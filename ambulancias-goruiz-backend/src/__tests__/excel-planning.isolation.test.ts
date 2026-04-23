/**
 * Aislamiento multiempresa: planning Excel publicado no es legible por admin de otra empresa.
 */
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import { createTestAdminWithCompany } from "./test-helpers";
import ExcelPlanningWeek from "../modules/excel-planning/models/excel-planning-week.model";

const API = "/api/excel-planning";

let dataA: { adminToken: string; companyId: string };
let dataB: { adminToken: string; companyId: string };
const weekStart = new Date(Date.UTC(2031, 5, 9, 0, 0, 0, 0)); // lunes 9 jun 2031 UTC

describe("Excel planning isolation", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
    const [a, b] = await Promise.all([
      createTestAdminWithCompany(),
      createTestAdminWithCompany(),
    ]);
    dataA = { adminToken: a.adminToken, companyId: a.companyId };
    dataB = { adminToken: b.adminToken, companyId: b.companyId };

    await ExcelPlanningWeek.create({
      companyId: new mongoose.Types.ObjectId(dataA.companyId),
      weekStart,
      rows: [
        {
          dayIndex: 0,
          dayDate: weekStart,
          dienstNumber: "1",
          rawCellText: "test",
          matchMethod: "none",
        },
      ],
      publishedAt: new Date(),
    });
  });

  afterAll(async () => {
    await ExcelPlanningWeek.deleteMany({
      companyId: {
        $in: [
          new mongoose.Types.ObjectId(dataA.companyId),
          new mongoose.Types.ObjectId(dataB.companyId),
        ],
      },
    });
    await mongoose.disconnect();
  });

  it("admin A ve la semana publicada de su empresa", async () => {
    const ymd = weekStart.toISOString().slice(0, 10);
    const res = await request(app)
      .get(`${API}/weeks/${ymd}`)
      .set("Authorization", `Bearer ${dataA.adminToken}`)
      .expect(200);
    expect(res.body.rows?.length).toBe(1);
  });

  it("admin B no ve la semana de la empresa A (404)", async () => {
    const ymd = weekStart.toISOString().slice(0, 10);
    await request(app)
      .get(`${API}/weeks/${ymd}`)
      .set("Authorization", `Bearer ${dataB.adminToken}`)
      .expect(404);
  });
});
