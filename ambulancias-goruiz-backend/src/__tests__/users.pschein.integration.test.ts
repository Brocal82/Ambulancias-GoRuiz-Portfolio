/**
 * P-Schein profile validation: expiry format, confirmation invariants, worker/admin boundaries.
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

describe("P-Schein profile validation (integration)", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  describe("PATCH /api/users/:id — admin confirmation rules", () => {
    let adminToken: string;
    let adminId: string;
    let companyId: string;
    let workerId: string;
    let companyBId: string;
    let adminBId: string;
    let docBasename: string;
    let docPath: string;

    beforeAll(async () => {
      const data = await createTestAdminWithCompany();
      adminToken = data.adminToken;
      adminId = data.adminId;
      companyId = data.companyId;

      const worker = await createTestWorkerInCompany(
        new mongoose.Types.ObjectId(companyId),
        Date.now() + 501,
      );
      workerId = String(worker._id);

      const dataB = await createTestAdminWithCompany();
      companyBId = dataB.companyId;
      adminBId = dataB.adminId;

      const up = await request(app)
        .post(`${API}/users/${workerId}/upload`)
        .set("Authorization", `Bearer ${adminToken}`)
        .attach("documents", Buffer.from("%PDF-1.4 pschein-val"), {
          filename: "pschein-val.pdf",
          contentType: "application/pdf",
        });
      expect(up.status).toBe(200);
      docPath = up.body.pscheinDocument as string;
      docBasename = path.basename(docPath);
    });

    afterAll(async () => {
      await removeTestUploadFile(docBasename).catch(() => {});
      await User.deleteMany({
        _id: {
          $in: [
            new mongoose.Types.ObjectId(workerId),
            new mongoose.Types.ObjectId(adminId),
            new mongoose.Types.ObjectId(adminBId),
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

    it("rejects invalid pscheinExpiry format", async () => {
      const res = await request(app)
        .patch(`${API}/users/${workerId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          pscheinExpiry: "2025-02-30",
          pscheinDocument: docPath,
          pscheinConfirmedAt: new Date().toISOString(),
          pscheinConfirmedBy: adminId,
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/no es válid/i);
    });

    it("rejects confirmation without document", async () => {
      await User.updateOne(
        { _id: new mongoose.Types.ObjectId(workerId) },
        {
          $unset: {
            pscheinDocument: 1,
            pscheinConfirmedAt: 1,
            pscheinConfirmedBy: 1,
            pscheinExpiry: 1,
          },
        },
      );

      const res = await request(app)
        .patch(`${API}/users/${workerId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          pscheinExpiry: "2032-01-15",
          pscheinConfirmedAt: new Date().toISOString(),
          pscheinConfirmedBy: adminId,
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/documento/i);
    });

    it("accepts valid expiry + document confirmation", async () => {
      await User.updateOne(
        { _id: new mongoose.Types.ObjectId(workerId) },
        { $set: { pscheinDocument: docPath } },
      );

      const res = await request(app)
        .patch(`${API}/users/${workerId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          pscheinExpiry: "2032-01-15",
          pscheinDocument: docPath,
          pscheinConfirmedAt: new Date().toISOString(),
          pscheinConfirmedBy: adminId,
        });
      expect(res.status).toBe(200);
      expect(res.body.pscheinExpiry).toBe("2032-01-15");
      expect(res.body.pscheinConfirmedAt).toBeTruthy();
    });

    it("cross-company admin cannot confirm P-Schein", async () => {
      const crossAdminJwt = issueTestJwt(adminBId, "admin", companyBId);
      const res = await request(app)
        .patch(`${API}/users/${workerId}`)
        .set("Authorization", `Bearer ${crossAdminJwt}`)
        .send({
          pscheinExpiry: "2033-05-01",
          pscheinDocument: docPath,
          pscheinConfirmedAt: new Date().toISOString(),
          pscheinConfirmedBy: adminBId,
        });
      expect(res.status).toBe(403);
    });
  });

  describe("PATCH /api/users/me — worker cannot set expiry", () => {
    let workerToken: string;
    let workerId: string;
    let adminId: string;
    let companyId: string;

    beforeAll(async () => {
      const data = await createTestAdminWithCompany();
      adminId = data.adminId;
      companyId = data.companyId;
      const worker = await createTestWorkerInCompany(
        new mongoose.Types.ObjectId(companyId),
        Date.now() + 601,
      );
      workerId = String(worker._id);
      workerToken = issueTestJwt(workerId, "worker", companyId);
    });

    afterAll(async () => {
      await User.deleteMany({
        _id: {
          $in: [
            new mongoose.Types.ObjectId(workerId),
            new mongoose.Types.ObjectId(adminId),
          ],
        },
      });
      await Company.deleteOne({ _id: new mongoose.Types.ObjectId(companyId) });
    });

    it("ignores pscheinExpiry in worker self PATCH", async () => {
      await User.updateOne(
        { _id: new mongoose.Types.ObjectId(workerId) },
        { $unset: { pscheinExpiry: 1 } },
      );

      const res = await request(app)
        .patch(`${API}/users/me`)
        .set("Authorization", `Bearer ${workerToken}`)
        .send({ pscheinExpiry: "2035-12-31", name: "Worker" });

      expect(res.status).toBe(200);

      const u = await User.findById(workerId).lean();
      expect(u?.pscheinExpiry).toBeFalsy();
    });
  });

  describe("stale token + protected P-Schein file access", () => {
    let adminId: string;
    let companyId: string;
    let workerId: string;
    let workerToken: string;
    let basename: string;

    beforeAll(async () => {
      const data = await createTestAdminWithCompany();
      adminId = data.adminId;
      companyId = data.companyId;

      const worker = await createTestWorkerInCompany(
        new mongoose.Types.ObjectId(companyId),
        Date.now() + 701,
      );
      workerId = String(worker._id);
      workerToken = issueTestJwt(workerId, "worker", companyId, 0);

      const up = await request(app)
        .post(`${API}/users/me/upload`)
        .set("Authorization", `Bearer ${workerToken}`)
        .attach("documents", Buffer.from("%PDF-1.4 stale"), {
          filename: "stale-token.pdf",
          contentType: "application/pdf",
        });
      expect(up.status).toBe(200);
      basename = path.basename(up.body.pscheinDocument as string);
    });

    afterAll(async () => {
      await removeTestUploadFile(basename).catch(() => {});
      await User.deleteMany({
        _id: {
          $in: [
            new mongoose.Types.ObjectId(workerId),
            new mongoose.Types.ObjectId(adminId),
          ],
        },
      });
      await Company.deleteOne({ _id: new mongoose.Types.ObjectId(companyId) });
    });

    it("rejects stale token on protected P-Schein download", async () => {
      await request(app)
        .post(`${API}/users/sessions/revoke-all`)
        .set("Authorization", `Bearer ${workerToken}`)
        .expect(200);

      const res = await request(app)
        .get(`${API}/files/${basename}`)
        .set("Authorization", `Bearer ${workerToken}`);
      expect(res.status).toBe(401);
    });

    it("rejects non-PDF upload for P-Schein documents field", async () => {
      const freshToken = issueTestJwt(workerId, "worker", companyId, 1);
      const res = await request(app)
        .post(`${API}/users/me/upload`)
        .set("Authorization", `Bearer ${freshToken}`)
        .attach("documents", Buffer.from("fake-image"), {
          filename: "not-pschein.jpg",
          contentType: "image/jpeg",
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/PDF/i);
    });

    it("owner can still read P-Schein with fresh token", async () => {
      const freshToken = issueTestJwt(workerId, "worker", companyId, 1);
      const res = await request(app)
        .get(`${API}/files/${basename}`)
        .set("Authorization", `Bearer ${freshToken}`);
      expect(res.status).toBe(200);
    });
  });
});
