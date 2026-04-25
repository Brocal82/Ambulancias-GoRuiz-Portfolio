/**
 * Excel de semana publicada: solo admin de la misma empresa vía /api/files;
 * trabajador autenticado no (plan completo / PII).
 */
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import {
  createTestAdminWithCompany,
  createTestWorkerInCompany,
  issueTestJwt,
  writeTestUploadFile,
  removeTestUploadFile,
} from "./test-helpers";
import ExcelPlanningWeek from "../modules/excel-planning/models/excel-planning-week.model";

describe("Excel planning file access via /api/files", () => {
  let companyId: string;
  let adminToken: string;
  let workerId: string;
  let basename: string;
  const weekStart = new Date(Date.UTC(2032, 5, 14, 0, 0, 0, 0));

  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
    const data = await createTestAdminWithCompany();
    companyId = data.companyId;
    adminToken = data.adminToken;

    const worker = await createTestWorkerInCompany(
      new mongoose.Types.ObjectId(companyId),
    );
    workerId = String(worker._id);

    basename = `excel-week-test-${Date.now()}.xlsx`;
    await writeTestUploadFile(basename, "dummy");

    await ExcelPlanningWeek.create({
      companyId: new mongoose.Types.ObjectId(companyId),
      weekStart,
      rows: [
        {
          dayIndex: 0,
          dayDate: weekStart,
          dienstNumber: "1",
          rawCellText: "t",
          matchMethod: "employee_number",
          matchedUserId: worker._id,
        },
      ],
      sourceStoredFilename: basename,
      sourceFileUrl: `/uploads/${basename}`,
      publishedAt: new Date(),
    });
  });

  afterAll(async () => {
    await ExcelPlanningWeek.deleteMany({
      companyId: new mongoose.Types.ObjectId(companyId),
    });
    await removeTestUploadFile(basename);
    await mongoose.disconnect();
  });

  it("trabajador de la empresa recibe 403 al pedir el Excel de la semana", async () => {
    const workerToken = issueTestJwt(workerId, "worker", companyId);
    await request(app)
      .get(`/api/files/${encodeURIComponent(basename)}`)
      .set("Authorization", `Bearer ${workerToken}`)
      .expect(403);
  });

  it("admin de la empresa puede descargar el mismo archivo", async () => {
    await request(app)
      .get(`/api/files/${encodeURIComponent(basename)}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
  });
});
