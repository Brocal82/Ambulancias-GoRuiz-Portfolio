/**
 * Hardening tests: tenant-scoped vacation capacity, alternative lifecycle,
 * alternative capacity re-check, sick overlap, document URL validation, orphan cleanup.
 */
import fs from "fs";
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import VacationRequest from "../modules/vacation/models/vacation-request.model";
import SickLeave from "../modules/sick-leaves/models/sick-leave.model";
import User from "../modules/users/models/user.model";
import Company from "../modules/companies/models/company.model";
import {
  createTestAdminWithCompany,
  createTestWorkerInCompany,
  getTestUploadsDir,
  issueTestJwt,
  listNewUploadFiles,
} from "./test-helpers";

const API = "/api";

describe("Vacation / sick leave hardening", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("capacity checks are tenant-scoped (company B accepts when company A is full)", async () => {
    const dataA = await createTestAdminWithCompany();
    const dataB = await createTestAdminWithCompany();

    const workerA1 = await createTestWorkerInCompany(
      new mongoose.Types.ObjectId(dataA.companyId),
      Date.now() + 101,
    );
    const workerA2 = await createTestWorkerInCompany(
      new mongoose.Types.ObjectId(dataA.companyId),
      Date.now() + 102,
    );
    const workerB1 = await createTestWorkerInCompany(
      new mongoose.Types.ObjectId(dataB.companyId),
      Date.now() + 103,
    );

    const tokenA1 = issueTestJwt(String(workerA1._id), "worker", dataA.companyId);
    const tokenA2 = issueTestJwt(String(workerA2._id), "worker", dataA.companyId);
    const tokenB1 = issueTestJwt(String(workerB1._id), "worker", dataB.companyId);

    await request(app)
      .post(`${API}/vacations/month-config`)
      .set("Authorization", `Bearer ${dataA.adminToken}`)
      .send({ monthKey: "2035-08", maxPerDay: 1 })
      .expect(200);

    const vacA1Res = await request(app)
      .post(`${API}/vacations`)
      .set("Authorization", `Bearer ${tokenA1}`)
      .send({ startDate: "2035-08-10", endDate: "2035-08-10" })
      .expect(201);
    const vacA1Id = vacA1Res.body._id ?? vacA1Res.body.id;

    await request(app)
      .patch(`${API}/vacations/${vacA1Id}`)
      .set("Authorization", `Bearer ${dataA.adminToken}`)
      .send({ status: "accepted" })
      .expect(200);

    const vacA2Res = await request(app)
      .post(`${API}/vacations`)
      .set("Authorization", `Bearer ${tokenA2}`)
      .send({ startDate: "2035-08-10", endDate: "2035-08-10" })
      .expect(201);
    const vacA2Id = vacA2Res.body._id ?? vacA2Res.body.id;

    const capA = await request(app)
      .patch(`${API}/vacations/${vacA2Id}`)
      .set("Authorization", `Bearer ${dataA.adminToken}`)
      .send({ status: "accepted" });
    expect(capA.status).toBe(409);
    expect(capA.body.code).toBe("capacity_exceeded");

    const vacB1Res = await request(app)
      .post(`${API}/vacations`)
      .set("Authorization", `Bearer ${tokenB1}`)
      .send({ startDate: "2035-08-10", endDate: "2035-08-10" })
      .expect(201);
    const vacB1Id = vacB1Res.body._id ?? vacB1Res.body.id;

    const acceptB = await request(app)
      .patch(`${API}/vacations/${vacB1Id}`)
      .set("Authorization", `Bearer ${dataB.adminToken}`)
      .send({ status: "accepted" });
    expect(acceptB.status).toBe(200);

    await VacationRequest.deleteMany({
      user: { $in: [workerA1._id, workerA2._id, workerB1._id] },
    });
    await User.deleteMany({
      _id: { $in: [workerA1._id, workerA2._id, workerB1._id] },
    });
    await Company.deleteMany({
      _id: {
        $in: [
          new mongoose.Types.ObjectId(dataA.companyId),
          new mongoose.Types.ObjectId(dataB.companyId),
        ],
      },
    });
  });

  it("rejects worker alternative response unless status is option_sent", async () => {
    const data = await createTestAdminWithCompany();
    const worker = await createTestWorkerInCompany(
      new mongoose.Types.ObjectId(data.companyId),
      Date.now() + 201,
    );
    const workerToken = issueTestJwt(String(worker._id), "worker", data.companyId);

    const vacRes = await request(app)
      .post(`${API}/vacations`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ startDate: "2035-09-01", endDate: "2035-09-03" })
      .expect(201);
    const vacId = vacRes.body._id ?? vacRes.body.id;

    const pendingRespond = await request(app)
      .post(`${API}/vacations/${vacId}/respond`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ accept: true });
    expect(pendingRespond.status).toBe(400);

    await request(app)
      .patch(`${API}/vacations/${vacId}`)
      .set("Authorization", `Bearer ${data.adminToken}`)
      .send({
        status: "option_sent",
        adminOptionStartDate: "2035-09-10",
        adminOptionEndDate: "2035-09-12",
      })
      .expect(200);

    const acceptAlt = await request(app)
      .post(`${API}/vacations/${vacId}/respond`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ accept: true });
    expect(acceptAlt.status).toBe(200);
    expect(acceptAlt.body.status).toBe("accepted");

    await VacationRequest.deleteMany({ _id: vacId });
    await User.deleteMany({ _id: worker._id });
    await Company.deleteOne({ _id: data.companyId });
  });

  it("re-checks capacity when worker accepts admin alternative", async () => {
    const data = await createTestAdminWithCompany();
    const [worker1, workerAlt] = await Promise.all([
      createTestWorkerInCompany(new mongoose.Types.ObjectId(data.companyId), Date.now() + 301),
      createTestWorkerInCompany(new mongoose.Types.ObjectId(data.companyId), Date.now() + 303),
    ]);

    const token1 = issueTestJwt(String(worker1._id), "worker", data.companyId);
    const tokenAlt = issueTestJwt(String(workerAlt._id), "worker", data.companyId);

    await request(app)
      .post(`${API}/vacations/month-config`)
      .set("Authorization", `Bearer ${data.adminToken}`)
      .send({ monthKey: "2035-10", maxPerDay: 1 })
      .expect(200);

    const vac1 = await request(app)
      .post(`${API}/vacations`)
      .set("Authorization", `Bearer ${token1}`)
      .send({ startDate: "2035-10-15", endDate: "2035-10-15" })
      .expect(201);
    await request(app)
      .patch(`${API}/vacations/${vac1.body._id}`)
      .set("Authorization", `Bearer ${data.adminToken}`)
      .send({ status: "accepted" })
      .expect(200);

    const vacAlt = await request(app)
      .post(`${API}/vacations`)
      .set("Authorization", `Bearer ${tokenAlt}`)
      .send({ startDate: "2035-10-01", endDate: "2035-10-05" })
      .expect(201);
    const vacAltId = vacAlt.body._id ?? vacAlt.body.id;

    await request(app)
      .patch(`${API}/vacations/${vacAltId}`)
      .set("Authorization", `Bearer ${data.adminToken}`)
      .send({
        status: "option_sent",
        adminOptionStartDate: "2035-10-15",
        adminOptionEndDate: "2035-10-15",
      })
      .expect(200);

    const capAlt = await request(app)
      .post(`${API}/vacations/${vacAltId}/respond`)
      .set("Authorization", `Bearer ${tokenAlt}`)
      .send({ accept: true });
    expect(capAlt.status).toBe(409);
    expect(capAlt.body.code).toBe("capacity_exceeded");

    await VacationRequest.deleteMany({
      user: { $in: [worker1._id, workerAlt._id] },
    });
    await User.deleteMany({ _id: { $in: [worker1._id, workerAlt._id] } });
    await Company.deleteOne({ _id: data.companyId });
  });

  it("rejects overlapping active sick leave on create and accept", async () => {
    const data = await createTestAdminWithCompany();
    const worker = await createTestWorkerInCompany(
      new mongoose.Types.ObjectId(data.companyId),
      Date.now() + 401,
    );
    const workerToken = issueTestJwt(String(worker._id), "worker", data.companyId);

    const first = await request(app)
      .post(`${API}/sick-leaves`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ startDate: "2035-11-01", endDate: "2035-11-05" })
      .expect(201);

    const overlapCreate = await request(app)
      .post(`${API}/sick-leaves`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ startDate: "2035-11-03", endDate: "2035-11-07" });
    expect(overlapCreate.status).toBe(409);

    await request(app)
      .post(`${API}/sick-leaves/${first.body._id}/accept`)
      .set("Authorization", `Bearer ${data.adminToken}`)
      .expect(200);

    const legacyPending = await SickLeave.create({
      user: worker._id,
      companyId: new mongoose.Types.ObjectId(data.companyId),
      startDate: new Date("2035-11-04T00:00:00.000Z"),
      endDate: new Date("2035-11-06T00:00:00.000Z"),
      status: "pending",
    });

    const overlapAccept = await request(app)
      .post(`${API}/sick-leaves/${legacyPending._id}/accept`)
      .set("Authorization", `Bearer ${data.adminToken}`);
    expect(overlapAccept.status).toBe(409);

    const badRange = await request(app)
      .post(`${API}/sick-leaves`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ startDate: "2035-12-10", endDate: "2035-12-05" });
    expect(badRange.status).toBe(400);

    await SickLeave.deleteMany({ user: worker._id });
    await User.deleteMany({ _id: worker._id });
    await Company.deleteOne({ _id: data.companyId });
  });

  it("rejects invalid documentUrl and cleans orphan multipart uploads", async () => {
    const data = await createTestAdminWithCompany();
    const worker = await createTestWorkerInCompany(
      new mongoose.Types.ObjectId(data.companyId),
      Date.now() + 501,
    );
    const workerToken = issueTestJwt(String(worker._id), "worker", data.companyId);

    const sickRes = await request(app)
      .post(`${API}/sick-leaves`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ startDate: "2035-12-20", endDate: "2035-12-21" })
      .expect(201);
    const sickId = sickRes.body._id ?? sickRes.body.id;

    const invalidAttach = await request(app)
      .post(`${API}/sick-leaves/${sickId}/attach-document`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ documentUrl: "https://evil.example.com/doc.pdf" });
    expect(invalidAttach.status).toBe(400);

    const before = new Set(await fs.promises.readdir(getTestUploadsDir()).catch(() => []));

    const orphanUpload = await request(app)
      .post(`${API}/sick-leaves/${new mongoose.Types.ObjectId()}/attach-document-file`)
      .set("Authorization", `Bearer ${workerToken}`)
      .attach("document", Buffer.from("%PDF-1.4 orphan"), {
        filename: "orphan-sick.pdf",
        contentType: "application/pdf",
      });

    expect(orphanUpload.status).toBe(404);
    const orphans = await listNewUploadFiles(before);
    expect(orphans.length).toBe(0);

    await SickLeave.deleteMany({ _id: sickId });
    await User.deleteMany({ _id: worker._id });
    await Company.deleteOne({ _id: data.companyId });
  });
});
