/**
 * Seguridad de ficheros: /uploads solo extensiones de imagen; /api/files con JWT + canAccessFile.
 */
import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import User from "../modules/users/models/user.model";
import Company from "../modules/companies/models/company.model";
import {
  createTestAdminWithCompany,
  createTestWorkerInCompany,
  uniqueUploadBasename,
  writeTestUploadFile,
  removeTestUploadFile,
} from "./test-helpers";

const API = "/api";

function issueTestJwt(userId: string, role: string, companyId?: string): string {
  const payload: Record<string, unknown> = { userId, role };
  if (companyId) payload.companyId = companyId;
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "1h" });
}

describe("Files security (integration)", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  describe("GET /uploads", () => {
    it("rejects non-image extensions such as PDF with 403", async () => {
      const res = await request(app).get("/uploads/any-name-unit.pdf");
      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/files/:filename", () => {
    let baseWorkerId: string;
    let baseWorkerToken: string;
    let baseAdminId: string;
    let baseCompanyId: string;

    beforeAll(async () => {
      const data = await createTestAdminWithCompany();
      baseCompanyId = data.companyId;
      baseAdminId = data.adminId;
      const worker = await createTestWorkerInCompany(
        new mongoose.Types.ObjectId(data.companyId),
        Date.now(),
      );
      baseWorkerId = String(worker._id);
      baseWorkerToken = issueTestJwt(baseWorkerId, "worker", baseCompanyId);
    });

    afterAll(async () => {
      await User.deleteMany({
        _id: {
          $in: [
            new mongoose.Types.ObjectId(baseWorkerId),
            new mongoose.Types.ObjectId(baseAdminId),
          ],
        },
      });
      await Company.deleteOne({ _id: baseCompanyId });
    });

    it("returns 401 without Authorization header", async () => {
      const res = await request(app).get(`${API}/files/not-used.pdf`);
      expect(res.status).toBe(401);
    });

    it("returns 404 when file does not exist on disk (authenticated)", async () => {
      const missingName = uniqueUploadBasename("absent");
      const res = await request(app)
        .get(`${API}/files/${missingName}`)
        .set("Authorization", `Bearer ${baseWorkerToken}`);
      expect(res.status).toBe(404);
    });

    it("returns 403 when file exists but has no DB ownership reference", async () => {
      const basename = uniqueUploadBasename("orphan");
      await writeTestUploadFile(basename);
      try {
        const res = await request(app)
          .get(`${API}/files/${basename}`)
          .set("Authorization", `Bearer ${baseWorkerToken}`);
        expect(res.status).toBe(403);
      } finally {
        await removeTestUploadFile(basename);
      }
    });

    it("returns 200 when file exists and path is on the same user pscheinDocument", async () => {
      const basename = uniqueUploadBasename("owned");
      const storedPath = `/uploads/${basename}`;
      await writeTestUploadFile(basename);
      await User.updateOne({ _id: baseWorkerId }, { $set: { pscheinDocument: storedPath } });
      try {
        const res = await request(app)
          .get(`${API}/files/${basename}`)
          .set("Authorization", `Bearer ${baseWorkerToken}`);
        expect(res.status).toBe(200);
      } finally {
        await removeTestUploadFile(basename);
        await User.updateOne({ _id: baseWorkerId }, { $unset: { pscheinDocument: 1 } });
      }
    });

    it("returns 403 when file is referenced only by a user in another company", async () => {
      const [dataA, dataB] = await Promise.all([
        createTestAdminWithCompany(),
        createTestAdminWithCompany(),
      ]);
      const workerA = await createTestWorkerInCompany(
        new mongoose.Types.ObjectId(dataA.companyId),
        Date.now() + 2,
      );
      const workerB = await createTestWorkerInCompany(
        new mongoose.Types.ObjectId(dataB.companyId),
        Date.now() + 3,
      );
      const basename = uniqueUploadBasename("cross");
      const storedPath = `/uploads/${basename}`;
      await writeTestUploadFile(basename);
      await User.updateOne({ _id: workerB._id }, { $set: { pscheinDocument: storedPath } });
      const tokenA = issueTestJwt(String(workerA._id), "worker", dataA.companyId);
      try {
        const res = await request(app)
          .get(`${API}/files/${basename}`)
          .set("Authorization", `Bearer ${tokenA}`);
        expect(res.status).toBe(403);
      } finally {
        await removeTestUploadFile(basename);
        await User.updateOne({ _id: workerB._id }, { $unset: { pscheinDocument: 1 } });
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
  });
});
