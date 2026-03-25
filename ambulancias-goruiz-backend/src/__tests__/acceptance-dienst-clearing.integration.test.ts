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
});
