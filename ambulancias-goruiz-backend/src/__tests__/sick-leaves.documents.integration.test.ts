/**
 * Sick-leave documentUrl + canAccessFile (rama SickLeave).
 * Usa POST .../attach-document con JSON (sin multipart) para estabilidad.
 * Complementa sick-leaves.roles.integration.test.ts (no duplica matriz de roles GET).
 */
import path from "path";
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import SickLeave from "../modules/sick-leaves/models/sick-leave.model";
import User from "../modules/users/models/user.model";
import Company from "../modules/companies/models/company.model";
import {
  createTestAdminWithCompany,
  createTestWorkerInCompany,
  issueTestJwt,
  uniqueUploadBasename,
  writeTestUploadFile,
  removeTestUploadFile,
} from "./test-helpers";

const API = "/api";

describe("Sick-leaves — attach-document URL + /api/files (integration)", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("adjunta URL, acceso worker y admin misma empresa; otro tenant y attach cruzado 403", async () => {
    const dataA = await createTestAdminWithCompany();
    const dataB = await createTestAdminWithCompany();

    const workerA = await createTestWorkerInCompany(
      new mongoose.Types.ObjectId(dataA.companyId),
      Date.now() + 31,
    );
    const workerB = await createTestWorkerInCompany(
      new mongoose.Types.ObjectId(dataB.companyId),
      Date.now() + 32,
    );

    const tokenA = issueTestJwt(String(workerA._id), "worker", dataA.companyId);
    const tokenB = issueTestJwt(String(workerB._id), "worker", dataB.companyId);

    const sickRes = await request(app)
      .post(`${API}/sick-leaves`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        startDate: "2034-05-01",
        endDate: "2034-05-02",
      })
      .expect(201);
    const sickId = sickRes.body._id ?? sickRes.body.id;

    const basename = uniqueUploadBasename("sick-doc");
    const storedPath = `/uploads/${basename}`;
    await writeTestUploadFile(basename, "%PDF-1.4 sick");

    try {
      const attach = await request(app)
        .post(`${API}/sick-leaves/${sickId}/attach-document`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ documentUrl: storedPath });
      expect(attach.status).toBe(200);

      const fileResOwner = await request(app)
        .get(`${API}/files/${path.basename(storedPath)}`)
        .set("Authorization", `Bearer ${tokenA}`);
      expect(fileResOwner.status).toBe(200);

      const fileResAdminA = await request(app)
        .get(`${API}/files/${path.basename(storedPath)}`)
        .set("Authorization", `Bearer ${dataA.adminToken}`);
      expect(fileResAdminA.status).toBe(200);

      const fileResWorkerB = await request(app)
        .get(`${API}/files/${path.basename(storedPath)}`)
        .set("Authorization", `Bearer ${tokenB}`);
      expect(fileResWorkerB.status).toBe(403);

      const crossAttach = await request(app)
        .post(`${API}/sick-leaves/${sickId}/attach-document`)
        .set("Authorization", `Bearer ${dataB.adminToken}`)
        .send({ documentUrl: "/uploads/other.pdf" });
      expect(crossAttach.status).toBe(403);
    } finally {
      await removeTestUploadFile(basename);
      await SickLeave.deleteMany({
        _id: new mongoose.Types.ObjectId(sickId),
      });
      await User.deleteMany({
        _id: {
          $in: [
            workerA._id,
            workerB._id,
            new mongoose.Types.ObjectId(dataA.adminId),
            new mongoose.Types.ObjectId(dataB.adminId),
          ],
        },
      });
      await Company.deleteMany({
        _id: {
          $in: [
            new mongoose.Types.ObjectId(dataA.companyId),
            new mongoose.Types.ObjectId(dataB.companyId),
          ],
        },
      });
    }
  });

  it("worker de otra empresa no puede adjuntar a baja ajena", async () => {
    const dataA = await createTestAdminWithCompany();
    const workerA = await createTestWorkerInCompany(
      new mongoose.Types.ObjectId(dataA.companyId),
      Date.now() + 41,
    );
    const workerB = await createTestWorkerInCompany(
      new mongoose.Types.ObjectId(dataA.companyId),
      Date.now() + 42,
    );

    const tokenA = issueTestJwt(String(workerA._id), "worker", dataA.companyId);
    const tokenB = issueTestJwt(String(workerB._id), "worker", dataA.companyId);

    const sickRes = await request(app)
      .post(`${API}/sick-leaves`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ startDate: "2034-06-01", endDate: "2034-06-02" })
      .expect(201);
    const sickId = sickRes.body._id ?? sickRes.body.id;

    try {
      const attach = await request(app)
        .post(`${API}/sick-leaves/${sickId}/attach-document`)
        .set("Authorization", `Bearer ${tokenB}`)
        .send({ documentUrl: "/uploads/x.pdf" });
      expect(attach.status).toBe(403);
    } finally {
      await SickLeave.deleteMany({ _id: new mongoose.Types.ObjectId(sickId) });
      await User.deleteMany({
        _id: {
          $in: [
            workerA._id,
            workerB._id,
            new mongoose.Types.ObjectId(dataA.adminId),
          ],
        },
      });
      await Company.deleteOne({ _id: dataA.companyId });
    }
  });
});
