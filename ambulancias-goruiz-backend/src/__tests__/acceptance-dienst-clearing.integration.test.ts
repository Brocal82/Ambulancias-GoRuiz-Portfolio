import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import {
  createTestAdminWithCompany,
  createTestWorkerInCompany,
} from "./test-helpers";
import Dienst from "../modules/diensts/models/dienst.model";
import VacationRequest from "../modules/vacation/models/vacation-request.model";
import { Ambulance } from "../modules/ambulances/models/ambulance.model";
import SickLeave from "../modules/sick-leaves/models/sick-leave.model";

const API = "/api";

describe("Acceptance clears Dienst assignments", () => {
  let adminToken: string;
  let adminId: string;
  let workerId: string;
  let companyId: string;
  let workerToken: string;
  let ambulanceId: string;

  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
    const data = await createTestAdminWithCompany();
    adminToken = data.adminToken;
    adminId = data.adminId;
    companyId = data.companyId;

    const worker = await createTestWorkerInCompany(
      new mongoose.Types.ObjectId(companyId),
      Date.now(),
    );
    workerId = String(worker._id);

    const loginRes = await request(app)
      .post(`${API}/users/login`)
      .send({ email: worker.email, password: "password123" });
    workerToken = loginRes.body.token;

    const ambRes = await request(app)
      .post(`${API}/ambulances`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        brand: "Test",
        modelName: "Clearing",
        licensePlate: `CLR-${Date.now()}`,
        ambulanceNumber: `CLR-N-${Date.now()}`,
      })
      .expect(201);
    ambulanceId = ambRes.body._id ?? ambRes.body.id;
  });

  afterAll(async () => {
    await VacationRequest.deleteMany({ user: workerId });
    await SickLeave.deleteMany({ user: workerId });
    await Dienst.deleteMany({
      companyId: new mongoose.Types.ObjectId(companyId),
    });
    await Ambulance.deleteMany({
      companyId: new mongoose.Types.ObjectId(companyId),
    });
    await mongoose.disconnect();
  });

  it("admin vacation accept clears worker assignment on Dienst", async () => {
    const VACATION_START = "2042-01-10";
    const VACATION_END = "2042-01-20";
    const ASSIGNMENT_DATE = "2042-01-15";
    const WEEK_START = "2042-01-11";
    const WEEK_END = "2042-01-17";

    const vacRes = await request(app)
      .post(`${API}/vacations`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({
        startDate: VACATION_START,
        endDate: VACATION_END,
      })
      .expect(201);
    const vacationId = vacRes.body._id ?? vacRes.body.id;

    const dienstRes = await request(app)
      .post(`${API}/diensts`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        dienstNumber: Date.now(),
        weekStartDate: WEEK_START,
        weekEndDate: WEEK_END,
        assignments: [
          {
            date: ASSIGNMENT_DATE,
            startTime: "08:00",
            endTime: "16:00",
            ambulanceId: ambulanceId,
            driver: workerId,
            medic: adminId,
          },
        ],
      })
      .expect(201);
    const dienstId = dienstRes.body._id ?? dienstRes.body.id;

    const patchRes = await request(app)
      .patch(`${API}/vacations/${vacationId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "accepted" })
      .expect(200);

    expect(patchRes.body.status).toBe("accepted");

    const vacDoc = await VacationRequest.findById(vacationId).lean();
    expect(vacDoc?.status).toBe("accepted");

    const dienstGet = await request(app)
      .get(`${API}/diensts/${dienstId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const assignments = dienstGet.body.assignments as Array<{
      date: string;
      driver?: { _id?: string } | string;
      medic?: { _id?: string } | string;
    }>;
    const slot = assignments.find((a) => a.date === ASSIGNMENT_DATE);
    expect(slot).toBeDefined();

    const driverId =
      slot!.driver == null
        ? ""
        : typeof slot!.driver === "object" && "_id" in slot!.driver
          ? String((slot!.driver as { _id: string })._id)
          : String(slot!.driver);

    expect(driverId).not.toBe(workerId);
  });

  it("worker alternative accept clears worker assignment on Dienst", async () => {
    const ORIGINAL_START = "2042-02-01";
    const ORIGINAL_END = "2042-02-05";
    const ALT_START = "2042-02-10";
    const ALT_END = "2042-02-20";
    const ASSIGNMENT_DATE = "2042-02-15";
    const WEEK_START = "2042-02-10";
    const WEEK_END = "2042-02-16";

    const vacRes = await request(app)
      .post(`${API}/vacations`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({
        startDate: ORIGINAL_START,
        endDate: ORIGINAL_END,
      })
      .expect(201);
    const vacationId = vacRes.body._id ?? vacRes.body.id;

    await request(app)
      .patch(`${API}/vacations/${vacationId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        status: "option_sent",
        adminOptionStartDate: ALT_START,
        adminOptionEndDate: ALT_END,
      })
      .expect(200);

    const dienstRes = await request(app)
      .post(`${API}/diensts`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        dienstNumber: Date.now(),
        weekStartDate: WEEK_START,
        weekEndDate: WEEK_END,
        assignments: [
          {
            date: ASSIGNMENT_DATE,
            startTime: "08:00",
            endTime: "16:00",
            ambulanceId: ambulanceId,
            driver: workerId,
            medic: adminId,
          },
        ],
      })
      .expect(201);
    const dienstId = dienstRes.body._id ?? dienstRes.body.id;

    const respondRes = await request(app)
      .post(`${API}/vacations/${vacationId}/respond`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ accept: true })
      .expect(200);

    expect(respondRes.body.status).toBe("accepted");

    const vacDoc = await VacationRequest.findById(vacationId).lean();
    expect(vacDoc?.status).toBe("accepted");
    expect(
      vacDoc?.startDate
        ? new Date(vacDoc.startDate as Date).toISOString().slice(0, 10)
        : "",
    ).toBe(ALT_START);
    expect(
      vacDoc?.endDate
        ? new Date(vacDoc.endDate as Date).toISOString().slice(0, 10)
        : "",
    ).toBe(ALT_END);

    const dienstGet = await request(app)
      .get(`${API}/diensts/${dienstId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const assignments = dienstGet.body.assignments as Array<{
      date: string;
      driver?: { _id?: string } | string;
      medic?: { _id?: string } | string;
    }>;
    const slot = assignments.find((a) => a.date === ASSIGNMENT_DATE);
    expect(slot).toBeDefined();

    const driverId =
      slot!.driver == null
        ? ""
        : typeof slot!.driver === "object" && "_id" in slot!.driver
          ? String((slot!.driver as { _id: string })._id)
          : String(slot!.driver);

    expect(driverId).not.toBe(workerId);
  });

  it("admin sick accept clears worker assignment on Dienst", async () => {
    const SICK_START = "2042-03-10";
    const SICK_END = "2042-03-20";
    const ASSIGNMENT_DATE = "2042-03-15";
    const WEEK_START = "2042-03-10";
    const WEEK_END = "2042-03-16";

    const sickRes = await request(app)
      .post(`${API}/sick-leaves`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({
        startDate: SICK_START,
        endDate: SICK_END,
      })
      .expect(201);
    const sickLeaveId = sickRes.body._id ?? sickRes.body.id;

    const dienstRes = await request(app)
      .post(`${API}/diensts`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        dienstNumber: Date.now(),
        weekStartDate: WEEK_START,
        weekEndDate: WEEK_END,
        assignments: [
          {
            date: ASSIGNMENT_DATE,
            startTime: "08:00",
            endTime: "16:00",
            ambulanceId: ambulanceId,
            driver: workerId,
            medic: adminId,
          },
        ],
      })
      .expect(201);
    const dienstId = dienstRes.body._id ?? dienstRes.body.id;

    await request(app)
      .post(`${API}/sick-leaves/${sickLeaveId}/accept`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const sickDoc = await SickLeave.findById(sickLeaveId).lean();
    expect(sickDoc?.status).toBe("accepted");

    const dienstGet = await request(app)
      .get(`${API}/diensts/${dienstId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const assignments = dienstGet.body.assignments as Array<{
      date: string;
      driver?: { _id?: string } | string;
      medic?: { _id?: string } | string;
    }>;
    const slot = assignments.find((a) => a.date === ASSIGNMENT_DATE);
    expect(slot).toBeDefined();

    const driverId =
      slot!.driver == null
        ? ""
        : typeof slot!.driver === "object" && "_id" in slot!.driver
          ? String((slot!.driver as { _id: string })._id)
          : String(slot!.driver);

    expect(driverId).not.toBe(workerId);
  });
});
