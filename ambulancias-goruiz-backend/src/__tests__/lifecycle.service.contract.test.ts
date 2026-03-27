/**
 * Contrato de createDienst: exige companyId (alineado con requireCompanyForAdmin en HTTP).
 */
import mongoose from "mongoose";
import { env } from "../config/env";
import { createDienst } from "../modules/diensts/templates/services/lifecycle.service";
import { CompanyValidationError } from "../utils/requireCompany";

describe("lifecycle.service createDienst company contract", () => {
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
});
