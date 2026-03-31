/**
 * PDF P-Schein de usuario: rutas de subida + canAccessFile (User.pscheinDocument / admin misma empresa).
 * Complementa files.security.integration.test.ts (casos genéricos sin ruta de usuario).
 */
import path from "path";
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import User from "../modules/users/models/user.model";
import Company from "../modules/companies/models/company.model";
import {
  createTestAdminWithCompany,
  createTestWorkerInCompany,
  issueTestJwt,
  removeTestUploadFile,
} from "./test-helpers";

const API = "/api";

function basenameFromStoredUrl(stored: string): string {
  return path.basename(stored);
}

describe("User documents — upload + /api/files ownership (integration)", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  describe("POST /api/users/me/upload (worker)", () => {
    let adminToken: string;
    let adminId: string;
    let companyId: string;
    let companyBId: string;
    let adminBIdOther: string;
    let workerOtherId: string;
    let workerToken: string;
    let workerId: string;
    let otherWorkerToken: string;
    let basename: string;

    beforeAll(async () => {
      const data = await createTestAdminWithCompany();
      adminToken = data.adminToken;
      adminId = data.adminId;
      companyId = data.companyId;

      const worker = await createTestWorkerInCompany(
        new mongoose.Types.ObjectId(companyId),
        Date.now(),
      );
      workerId = String(worker._id);
      workerToken = issueTestJwt(workerId, "worker", companyId);

      const dataB = await createTestAdminWithCompany();
      companyBId = dataB.companyId;
      adminBIdOther = dataB.adminId;
      const workerOther = await createTestWorkerInCompany(
        new mongoose.Types.ObjectId(dataB.companyId),
        Date.now() + 7,
      );
      workerOtherId = String(workerOther._id);
      otherWorkerToken = issueTestJwt(workerOtherId, "worker", companyBId);

      const up = await request(app)
        .post(`${API}/users/me/upload`)
        .set("Authorization", `Bearer ${workerToken}`)
        .attach("documents", Buffer.from("%PDF-1.4 user-me"), {
          filename: "user-me-doc.pdf",
          contentType: "application/pdf",
        });

      expect(up.status).toBe(200);
      const storedPath = up.body.pscheinDocument as string | undefined;
      expect(typeof storedPath).toBe("string");
      expect(storedPath).toMatch(/^\/uploads\//);
      basename = basenameFromStoredUrl(storedPath as string);
    });

    afterAll(async () => {
      await removeTestUploadFile(basename);
      await User.deleteMany({
        _id: {
          $in: [
            new mongoose.Types.ObjectId(workerId),
            new mongoose.Types.ObjectId(adminId),
            new mongoose.Types.ObjectId(workerOtherId),
            new mongoose.Types.ObjectId(adminBIdOther),
          ],
        },
      });
      await Company.deleteMany({
        _id: {
          $in: [
            new mongoose.Types.ObjectId(companyId),
            new mongoose.Types.ObjectId(companyBId),
          ],
        },
      });
    });

    it("propietario worker lee el PDF vía /api/files", async () => {
      const res = await request(app)
        .get(`${API}/files/${basename}`)
        .set("Authorization", `Bearer ${workerToken}`);
      expect(res.status).toBe(200);
    });

    it("admin misma empresa lee el documento del worker", async () => {
      const res = await request(app)
        .get(`${API}/files/${basename}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });

    it("worker de otra empresa obtiene 403 en /api/files", async () => {
      const res = await request(app)
        .get(`${API}/files/${basename}`)
        .set("Authorization", `Bearer ${otherWorkerToken}`);
      expect(res.status).toBe(403);
    });

    it("worker no puede POST /users/:id/upload (solo admin)", async () => {
      const res = await request(app)
        .post(`${API}/users/${workerId}/upload`)
        .set("Authorization", `Bearer ${workerToken}`)
        .attach("documents", Buffer.from("x"), {
          filename: "forbidden.pdf",
          contentType: "application/pdf",
        });
      expect(res.status).toBe(403);
    });

    it("worker no puede DELETE /users/me/document (P-Schein)", async () => {
      const res = await request(app)
        .delete(`${API}/users/me/document`)
        .set("Authorization", `Bearer ${workerToken}`)
        .send({ filePath: `/uploads/${basename}` });
      expect(res.status).toBe(403);
      expect(res.body.message).toContain("P-Schein");
    });
  });

  describe("POST /api/users/:userId/upload (admin) + DELETE cruzado", () => {
    let adminAToken: string;
    let adminAId: string;
    let companyAId: string;
    let workerAId: string;
    let adminBId: string;
    let companyBId: string;
    let basename: string;
    let storedPath: string;
    let workerAJwt: string;

    beforeAll(async () => {
      const dataA = await createTestAdminWithCompany();
      adminAToken = dataA.adminToken;
      adminAId = dataA.adminId;
      companyAId = dataA.companyId;

      const workerA = await createTestWorkerInCompany(
        new mongoose.Types.ObjectId(companyAId),
        Date.now() + 21,
      );
      workerAId = String(workerA._id);
      workerAJwt = issueTestJwt(workerAId, "worker", companyAId);

      const dataB = await createTestAdminWithCompany();
      adminBId = dataB.adminId;
      companyBId = dataB.companyId;

      const up = await request(app)
        .post(`${API}/users/${workerAId}/upload`)
        .set("Authorization", `Bearer ${adminAToken}`)
        .attach("documents", Buffer.from("%PDF-1.4 admin-up"), {
          filename: "admin-uploaded.pdf",
          contentType: "application/pdf",
        });

      expect(up.status).toBe(200);
      storedPath = up.body.pscheinDocument as string;
      expect(storedPath).toMatch(/^\/uploads\//);
      basename = basenameFromStoredUrl(storedPath);
    });

    afterAll(async () => {
      await removeTestUploadFile(basename);
      await User.deleteMany({
        _id: {
          $in: [
            new mongoose.Types.ObjectId(workerAId),
            new mongoose.Types.ObjectId(adminAId),
            new mongoose.Types.ObjectId(adminBId),
          ],
        },
      });
      await Company.deleteMany({
        _id: {
          $in: [
            new mongoose.Types.ObjectId(companyAId),
            new mongoose.Types.ObjectId(companyBId),
          ],
        },
      });
    });

    it("worker destino puede leer el documento subido por su admin", async () => {
      const res = await request(app)
        .get(`${API}/files/${basename}`)
        .set("Authorization", `Bearer ${workerAJwt}`);
      expect(res.status).toBe(200);
    });

    it("admin de otra empresa no puede eliminar documento (DELETE .../document)", async () => {
      const crossAdminJwt = issueTestJwt(adminBId, "admin", companyBId);
      const res = await request(app)
        .delete(`${API}/users/${workerAId}/document`)
        .set("Authorization", `Bearer ${crossAdminJwt}`)
        .send({ filePath: storedPath });
      expect(res.status).toBe(403);
    });
  });

  describe("DELETE P-Schein: limpia pscheinExpiry y nueva subida", () => {
    let adminTokenW: string;
    let adminIdW: string;
    let companyWId: string;
    let workerWId: string;
    let firstPath: string;
    let firstBasename: string;

    beforeAll(async () => {
      const data = await createTestAdminWithCompany();
      adminTokenW = data.adminToken;
      adminIdW = data.adminId;
      companyWId = data.companyId;

      const worker = await createTestWorkerInCompany(
        new mongoose.Types.ObjectId(companyWId),
        Date.now() + 99,
      );
      workerWId = String(worker._id);

      const up = await request(app)
        .post(`${API}/users/${workerWId}/upload`)
        .set("Authorization", `Bearer ${adminTokenW}`)
        .attach("documents", Buffer.from("%PDF-1.4 exp-test"), {
          filename: "expiry-regression.pdf",
          contentType: "application/pdf",
        });
      expect(up.status).toBe(200);
      firstPath = up.body.pscheinDocument as string;
      firstBasename = basenameFromStoredUrl(firstPath);

      await User.updateOne(
        { _id: new mongoose.Types.ObjectId(workerWId) },
        { $set: { pscheinExpiry: "2031-05-15" } },
      );
    });

    afterAll(async () => {
      await removeTestUploadFile(firstBasename).catch(() => {});
      await User.deleteMany({
        _id: {
          $in: [
            new mongoose.Types.ObjectId(workerWId),
            new mongoose.Types.ObjectId(adminIdW),
          ],
        },
      });
      await Company.deleteMany({
        _id: { $in: [new mongoose.Types.ObjectId(companyWId)] },
      });
    });

    it("borra documento y elimina pscheinExpiry en BD; nueva subida deja fecha vacía", async () => {
      const del = await request(app)
        .delete(`${API}/users/${workerWId}/document`)
        .set("Authorization", `Bearer ${adminTokenW}`)
        .send({ filePath: firstPath });
      expect(del.status).toBe(200);
      expect(del.body.pscheinExpiry).toBeNull();

      let u = await User.findById(workerWId).lean();
      expect(u?.pscheinDocument).toBeFalsy();
      expect(u?.pscheinExpiry).toBeFalsy();

      const up2 = await request(app)
        .post(`${API}/users/${workerWId}/upload`)
        .set("Authorization", `Bearer ${adminTokenW}`)
        .attach("documents", Buffer.from("%PDF-1.4 exp-test2"), {
          filename: "after-delete.pdf",
          contentType: "application/pdf",
        });
      expect(up2.status).toBe(200);
      const secondPath = up2.body.pscheinDocument as string;
      expect(secondPath).toMatch(/^\/uploads\//);

      u = await User.findById(workerWId).lean();
      expect(u?.pscheinExpiry).toBeFalsy();

      await removeTestUploadFile(basenameFromStoredUrl(secondPath));
    });
  });
});
