/**
 * Payroll identity readiness API — Phase 1 (visibility only).
 */
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import User from "../modules/users/models/user.model";
import Company from "../modules/companies/models/company.model";
import {
  createTestAdminWithCompany,
  createTestWorkerInCompany,
} from "./test-helpers";

const API = "/api";

describe("Payroll — identity readiness (integration)", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  async function cleanupCompany(
    companyId: string,
    adminId: string,
    workerIds: Array<mongoose.Types.ObjectId | string> = [],
  ) {
    if (workerIds.length > 0) {
      await User.deleteMany({ _id: { $in: workerIds } });
    }
    await User.deleteOne({ _id: new mongoose.Types.ObjectId(adminId) });
    await Company.deleteOne({ _id: new mongoose.Types.ObjectId(companyId) });
  }

  it("returns READY for a clean company", async () => {
    const { companyId, adminId, adminToken } = await createTestAdminWithCompany();
    const companyOid = new mongoose.Types.ObjectId(companyId);

    const worker1 = await createTestWorkerInCompany(companyOid, Date.now() + 1001);
    const worker2 = await createTestWorkerInCompany(companyOid, Date.now() + 1002);
    await User.updateOne(
      { _id: worker1._id },
      { $set: { employeeNumber: "EMP1001", isActive: true } },
    );
    await User.updateOne(
      { _id: worker2._id },
      { $set: { employeeNumber: "EMP1002", isActive: true } },
    );

    const res = await request(app)
      .get(`${API}/payroll/readiness`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      payrollWorkers: 2,
      missingEmployeeNumbers: 0,
      duplicateEmployeeNumbers: 0,
      readiness: "READY",
    });

    await cleanupCompany(companyId, adminId, [
      String(worker1._id),
      String(worker2._id),
    ]);
  });

  it("counts missing employee numbers among active payroll workers", async () => {
    const { companyId, adminId, adminToken } = await createTestAdminWithCompany();
    const companyOid = new mongoose.Types.ObjectId(companyId);

    const worker1 = await createTestWorkerInCompany(companyOid, Date.now() + 1101);
    const worker2 = await createTestWorkerInCompany(companyOid, Date.now() + 1102);
    await User.updateOne(
      { _id: worker1._id },
      { $set: { employeeNumber: "EMP1101", isActive: true } },
    );
    await User.updateOne(
      { _id: worker2._id },
      { $set: { employeeNumber: "", isActive: true } },
    );

    const res = await request(app)
      .get(`${API}/payroll/readiness`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.payrollWorkers).toBe(2);
    expect(res.body.missingEmployeeNumbers).toBe(1);
    expect(res.body.duplicateEmployeeNumbers).toBe(0);
    expect(res.body.readiness).toBe("WARNING");

    await cleanupCompany(companyId, adminId, [
      String(worker1._id),
      String(worker2._id),
    ]);
  });

  it("counts duplicate employee numbers within the company", async () => {
    const { companyId, adminId, adminToken } = await createTestAdminWithCompany();
    const companyOid = new mongoose.Types.ObjectId(companyId);

    const worker1 = await createTestWorkerInCompany(companyOid, Date.now() + 1201);
    const worker2 = await createTestWorkerInCompany(companyOid, Date.now() + 1202);
    await User.updateMany(
      { _id: { $in: [worker1._id, worker2._id] } },
      { $set: { employeeNumber: "EMP1200", isActive: true } },
    );

    const res = await request(app)
      .get(`${API}/payroll/readiness`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.payrollWorkers).toBe(2);
    expect(res.body.missingEmployeeNumbers).toBe(0);
    expect(res.body.duplicateEmployeeNumbers).toBe(1);
    expect(res.body.readiness).toBe("WARNING");

    await cleanupCompany(companyId, adminId, [
      String(worker1._id),
      String(worker2._id),
    ]);
  });

  it("excludes inactive workers and scopes metrics to the admin company", async () => {
    const companyA = await createTestAdminWithCompany();
    const companyB = await createTestAdminWithCompany();
    const companyAOid = new mongoose.Types.ObjectId(companyA.companyId);
    const companyBOid = new mongoose.Types.ObjectId(companyB.companyId);

    const activeA = await createTestWorkerInCompany(companyAOid, Date.now() + 1301);
    const inactiveA = await createTestWorkerInCompany(companyAOid, Date.now() + 1302);
    const workerB = await createTestWorkerInCompany(companyBOid, Date.now() + 1303);

    await User.updateOne(
      { _id: activeA._id },
      { $set: { employeeNumber: "EMP1301", isActive: true } },
    );
    await User.updateOne(
      { _id: inactiveA._id },
      { $set: { employeeNumber: "", isActive: false } },
    );
    await User.updateOne(
      { _id: workerB._id },
      { $set: { employeeNumber: "", isActive: true } },
    );

    const res = await request(app)
      .get(`${API}/payroll/readiness`)
      .set("Authorization", `Bearer ${companyA.adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      payrollWorkers: 1,
      missingEmployeeNumbers: 0,
      duplicateEmployeeNumbers: 0,
      readiness: "READY",
    });

    await User.deleteMany({
      _id: { $in: [String(activeA._id), String(inactiveA._id), String(workerB._id)] },
    });
    await User.deleteMany({
      _id: {
        $in: [
          new mongoose.Types.ObjectId(companyA.adminId),
          new mongoose.Types.ObjectId(companyB.adminId),
        ],
      },
    });
    await Company.deleteMany({
      _id: {
        $in: [
          new mongoose.Types.ObjectId(companyA.companyId),
          new mongoose.Types.ObjectId(companyB.companyId),
        ],
      },
    });
  });
});
