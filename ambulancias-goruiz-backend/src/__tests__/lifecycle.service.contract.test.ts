/**
 * Contrato lifecycle: createDienst / deleteDienstsForWeek exigen companyId
 * (alineado con requireCompanyForAdmin en HTTP).
 */
import mongoose from "mongoose";
import { env } from "../config/env";
import Dienst from "../modules/diensts/models/dienst.model";
import {
  createDienst,
  deleteDienst,
  deleteDienstsForWeek,
  updateDienst,
} from "../modules/diensts/templates/services/lifecycle.service";
import { CompanyValidationError } from "../utils/requireCompany";

describe("lifecycle.service company contract (createDienst, deleteDienstsForWeek)", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("createDienst rechaza companyId ausente o vacío (CompanyValidationError 403)", async () => {
    const minimal = {
      dienstNumber: 1,
      assignments: [] as [],
    };
    await expect(createDienst(minimal, undefined)).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringContaining("empresa"),
    });
    await expect(createDienst(minimal, "")).rejects.toBeInstanceOf(
      CompanyValidationError,
    );
    await expect(createDienst(minimal, "   ")).rejects.toBeInstanceOf(
      CompanyValidationError,
    );
  });

  it("deleteDienstsForWeek rechaza companyId ausente o vacío (CompanyValidationError 403)", async () => {
    const week = "2030-01-06";
    await expect(deleteDienstsForWeek(week, undefined)).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringContaining("empresa"),
    });
    await expect(deleteDienstsForWeek(week, "")).rejects.toBeInstanceOf(
      CompanyValidationError,
    );
    await expect(deleteDienstsForWeek(week, "   ")).rejects.toBeInstanceOf(
      CompanyValidationError,
    );
  });
});

describe("lifecycle.service updateDienst / deleteDienst (companyId requerido en documento)", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("updateDienst y deleteDienst devuelven null para Dienst sin companyId", async () => {
    const legacy = await Dienst.create({
      dienstNumber: 91001,
      assignments: [],
      companyId: null,
    });
    const callerCo = new mongoose.Types.ObjectId().toString();
    await expect(
      updateDienst(String(legacy._id), { dienstNumber: 91002 }, callerCo),
    ).resolves.toBeNull();
    await expect(deleteDienst(String(legacy._id), callerCo)).resolves.toBeNull();
    await Dienst.deleteOne({ _id: legacy._id });
  });

  it("updateDienst y deleteDienst permiten documento con companyId coincidente", async () => {
    const co = new mongoose.Types.ObjectId().toString();
    const created = await createDienst(
      { dienstNumber: 91003, assignments: [] },
      co,
    );
    const id = String(created._id);
    const updated = await updateDienst(id, { dienstNumber: 91004 }, co);
    expect(updated).not.toBeNull();
    expect((updated as { dienstNumber: number }).dienstNumber).toBe(91004);
    const deleted = await deleteDienst(id, co);
    expect(deleted).not.toBeNull();
  });

  it("updateDienst y deleteDienst devuelven null si companyId del caller no coincide", async () => {
    const coA = new mongoose.Types.ObjectId().toString();
    const coB = new mongoose.Types.ObjectId().toString();
    const created = await createDienst(
      { dienstNumber: 91005, assignments: [] },
      coA,
    );
    const id = String(created._id);
    await expect(updateDienst(id, { dienstNumber: 1 }, coB)).resolves.toBeNull();
    await expect(deleteDienst(id, coB)).resolves.toBeNull();
    await deleteDienst(id, coA);
  });
});
