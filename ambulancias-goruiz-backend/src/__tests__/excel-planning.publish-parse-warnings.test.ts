/**
 * No publicar un borrador cuyo análisis del Excel registró avisos (parseErrors).
 */
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import { createTestAdminWithCompany, createTestWorkerInCompany } from "./test-helpers";
import ExcelPlanningTemplate from "../modules/excel-planning/models/excel-planning-template.model";
import ExcelPlanningImport from "../modules/excel-planning/models/excel-planning-import.model";
import { excelPlanningMappingSchema } from "../modules/excel-planning/schemas/excel-planning.schemas";

const API = "/api/excel-planning";

describe("Excel planning publish vs parse warnings", () => {
  let adminToken: string;
  let companyId: string;
  let importId: string;
  const monday = new Date(Date.UTC(2030, 0, 6, 0, 0, 0, 0));

  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
    const data = await createTestAdminWithCompany();
    adminToken = data.adminToken;
    companyId = data.companyId;

    const mapping = excelPlanningMappingSchema.parse({
      sheetIndex: 0,
      dataStartRow: 2,
      dienstNumberColumn: 0,
      dayColumns: [1, 2, 3, 4, 5, 6, 7],
      cellLineOrder: [
        "time",
        "vehicle",
        "employeeNumber",
        "name",
        "partnerName",
        "partnerEmployeeNumber",
      ],
    });

    const tpl = await ExcelPlanningTemplate.create({
      companyId: new mongoose.Types.ObjectId(companyId),
      name: "Test template",
      mapping: mapping as unknown as Record<string, unknown>,
    });

    const worker = await createTestWorkerInCompany(
      new mongoose.Types.ObjectId(companyId),
    );

    const imp = await ExcelPlanningImport.create({
      companyId: new mongoose.Types.ObjectId(companyId),
      templateId: tpl._id,
      status: "draft",
      storedFilename: "test-parse-warn.xlsx",
      originalFilename: "test.xlsx",
      fileUrl: "/uploads/test-parse-warn.xlsx",
      weekStartDetected: monday,
      parseErrors: ["Aviso simulado: análisis del Excel con incidencia."],
      previewRows: [
        {
          dayIndex: 0,
          dayDate: monday,
          dienstNumber: "1",
          rawCellText: "x",
          matchMethod: "employee_number" as const,
          matchedUserId: worker._id,
        },
      ],
      stats: {
        totalCells: 1,
        matchedByNumber: 1,
        matchedByName: 0,
        unmatched: 0,
        numberKeyCollisions: 0,
      },
    });
    importId = String(imp._id);
  });

  afterAll(async () => {
    await ExcelPlanningImport.deleteMany({
      companyId: new mongoose.Types.ObjectId(companyId),
    });
    await ExcelPlanningTemplate.deleteMany({
      companyId: new mongoose.Types.ObjectId(companyId),
    });
    await mongoose.disconnect();
  });

  it("rechaza publicar si el import tiene parseErrors", async () => {
    const res = await request(app)
      .post(`${API}/imports/${importId}/publish`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ weekStart: "2030-01-06" })
      .expect(400);
    expect(res.body?.code).toBe("EXCEL_PARSE_WARNINGS_PUBLISH");
    expect(String(res.body?.message || "")).toMatch(/publicar|avisos|análisis/i);
  });
});
