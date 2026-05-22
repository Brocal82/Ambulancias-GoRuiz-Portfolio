/**
 * Tests de integración para Ambulancias.
 * Requiere .env.test con MONGODB_URI_TEST y JWT_SECRET.
 */
import request from "supertest";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { app } from "../app";
import { env } from "../config/env";
import {
  createTestAdminWithCompany,
  createTestWorkerInCompany,
  issueTestJwt,
} from "./test-helpers";
import User from "../modules/users/models/user.model";
import Company from "../modules/companies/models/company.model";
import { MODULE_KEYS } from "../modules/companies/constants/modules.constants";
import { Dienst } from "../modules/diensts";
import { Team } from "../modules/teams/models/team.model";
import WorkdaySummary from "../modules/workday-summary/models/workday-summary.model";
import { TripSetup } from "../modules/trips/models/trip-setup.model";
import MechanicsIssue from "../modules/mechanics/models/mechanics-issue.model";
import MechanicsWorkOrder from "../modules/mechanics/models/mechanics-work-order.model";

const API = "/api";

function adminTokenFor(data: {
  adminId: string;
  companyId: string;
  adminToken?: string;
}): string {
  return (
    data.adminToken ??
    issueTestJwt(data.adminId, "admin", data.companyId)
  );
}

describe("Ambulances integration", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  describe("module gate and body validation", () => {
    let adminToken: string;
    let companyId: string;

    beforeAll(async () => {
      const data = await createTestAdminWithCompany();
      adminToken = adminTokenFor(data);
      companyId = data.companyId;
    });

    it("GET /api/ambulances devuelve 403 si ambulances está desactivado", async () => {
      await Company.findByIdAndUpdate(companyId, {
        $pull: { enabledModules: MODULE_KEYS.AMBULANCES },
      });
      try {
        const res = await request(app)
          .get(`${API}/ambulances`)
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(403);
        expect(res.body.message).toMatch(/ambulances/i);
      } finally {
        await Company.findByIdAndUpdate(companyId, {
          $addToSet: { enabledModules: MODULE_KEYS.AMBULANCES },
        });
      }
    });

    it("POST /api/ambulances con brand vacío devuelve 400", async () => {
      const res = await request(app)
        .post(`${API}/ambulances`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          brand: "   ",
          modelName: "Model",
          licensePlate: "PLATE-" + Date.now(),
          ambulanceNumber: "NUM-" + Date.now(),
        })
        .expect(400);
      expect(res.body.message).toMatch(/brand/i);
    });

    it("POST /api/ambulances con campo extra devuelve 400 (strict)", async () => {
      const res = await request(app)
        .post(`${API}/ambulances`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          brand: "Brand",
          modelName: "Model",
          licensePlate: "PLATE-STRICT-" + Date.now(),
          ambulanceNumber: "NUM-STRICT-" + Date.now(),
          companyId: "507f1f77bcf86cd799439011",
        })
        .expect(400);
      expect(res.body).toHaveProperty("message");
    });

    it("POST /api/ambulances rechaza companyId en body (schema strict)", async () => {
      const res = await request(app)
        .post(`${API}/ambulances`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          brand: "Brand",
          modelName: "Model",
          licensePlate: "PLATE-STRICT-CO-" + Date.now(),
          ambulanceNumber: "NUM-STRICT-CO-" + Date.now(),
          companyId: "507f1f77bcf86cd799439011",
        })
        .expect(400);
      expect(res.body).toHaveProperty("message");
    });

    it("POST /api/ambulances asigna companyId del admin (no del body)", async () => {
      const res = await request(app)
        .post(`${API}/ambulances`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          brand: "Brand",
          modelName: "Model",
          licensePlate: "PLATE-CO-" + Date.now(),
          ambulanceNumber: "NUM-CO-" + Date.now(),
        })
        .expect(201);
      expect(res.body.companyId?.toString?.() ?? res.body.companyId).toBe(companyId);
    });
  });

  describe("role matrix", () => {
    let adminToken: string;
    let workerToken: string;
    let jefeToken: string;
    let companyId: string;
    let ambulanceId: string;
    let fixtureWorkerId: string;
    let fixtureJefeId: string;

    beforeAll(async () => {
      const data = await createTestAdminWithCompany();
      adminToken = adminTokenFor(data);
      companyId = data.companyId;

      const worker = await createTestWorkerInCompany(
        new mongoose.Types.ObjectId(companyId),
        Date.now() + 700,
      );
      fixtureWorkerId = String(worker._id);
      workerToken = issueTestJwt(fixtureWorkerId, "worker", companyId);

      const jefe = await User.create({
        name: "Jefe",
        lastName: "Mecanicos",
        email: `jefe-mec-${Date.now()}@example.com`,
        password: await bcrypt.hash("password123", 10),
        role: "jefe_mecanicos",
        companyId: new mongoose.Types.ObjectId(companyId),
      });
      fixtureJefeId = String(jefe._id);
      jefeToken = issueTestJwt(fixtureJefeId, "jefe_mecanicos", companyId);

      const createRes = await request(app)
        .post(`${API}/ambulances`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          brand: "RoleBrand",
          modelName: "RoleModel",
          licensePlate: "ROLE-" + Date.now(),
          ambulanceNumber: "ROLE-N-" + Date.now(),
        });
      ambulanceId = createRes.body._id ?? createRes.body.id;
    });

    afterAll(async () => {
      await User.deleteOne({ _id: fixtureWorkerId });
      await User.deleteOne({ _id: fixtureJefeId });
    });

    it("worker puede listar ambulancias (GET)", async () => {
      await request(app)
        .get(`${API}/ambulances`)
        .set("Authorization", `Bearer ${workerToken}`)
        .expect(200);
    });

    it("worker no puede crear ambulancia (POST 403)", async () => {
      await request(app)
        .post(`${API}/ambulances`)
        .set("Authorization", `Bearer ${workerToken}`)
        .send({
          brand: "X",
          modelName: "X",
          licensePlate: "W-" + Date.now(),
          ambulanceNumber: "W-" + Date.now(),
        })
        .expect(403);
    });

    it("jefe_mecanicos puede crear ambulancia (POST 201)", async () => {
      const res = await request(app)
        .post(`${API}/ambulances`)
        .set("Authorization", `Bearer ${jefeToken}`)
        .send({
          brand: "JefeBrand",
          modelName: "JefeModel",
          licensePlate: "JEFE-" + Date.now(),
          ambulanceNumber: "JEFE-N-" + Date.now(),
        })
        .expect(201);
      expect(res.body.brand).toBe("JefeBrand");
    });

    it("jefe_mecanicos puede actualizar ambulancia (PUT 200)", async () => {
      const res = await request(app)
        .put(`${API}/ambulances/${ambulanceId}`)
        .set("Authorization", `Bearer ${jefeToken}`)
        .send({ brand: "JefeUpdated" })
        .expect(200);
      expect(res.body.brand).toBe("JefeUpdated");
    });
  });

  describe("duplicate constraints", () => {
    let adminToken: string;

    beforeAll(async () => {
      const data = await createTestAdminWithCompany();
      adminToken = adminTokenFor(data);
    });

    it("POST duplicado por licensePlate devuelve 400", async () => {
      const plate = "DUP-PLATE-" + Date.now();
      const num = "DUP-NUM-A-" + Date.now();
      await request(app)
        .post(`${API}/ambulances`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          brand: "A",
          modelName: "A",
          licensePlate: plate,
          ambulanceNumber: num,
        })
        .expect(201);

      const res = await request(app)
        .post(`${API}/ambulances`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          brand: "B",
          modelName: "B",
          licensePlate: plate,
          ambulanceNumber: "DUP-NUM-B-" + Date.now(),
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/matrícula|número/i);
    });
  });

  describe("delete protection", () => {
    let adminToken: string;
    let companyId: string;
    let workerId: string;

    beforeAll(async () => {
      const data = await createTestAdminWithCompany();
      adminToken = adminTokenFor(data);
      companyId = data.companyId;
      const worker = await createTestWorkerInCompany(
        new mongoose.Types.ObjectId(companyId),
        Date.now() + 800,
      );
      workerId = String(worker._id);
    });

    async function createAmbulance(suffix: string) {
      const res = await request(app)
        .post(`${API}/ambulances`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          brand: "Del",
          modelName: "Del",
          licensePlate: `DEL-${suffix}`,
          ambulanceNumber: `DEL-N-${suffix}`,
        });
      expect(res.status).toBe(201);
      return res.body._id ?? res.body.id;
    }

    it("DELETE bloquea si hay dienst assignment", async () => {
      const ambulanceId = await createAmbulance("dienst");
      await Dienst.create({
        dienstNumber: 9001,
        weekStartDate: "2036-01-01",
        weekEndDate: "2036-01-07",
        companyId: new mongoose.Types.ObjectId(companyId),
        assignments: [
          {
            date: "2036-01-02",
            startTime: "08:00",
            endTime: "16:00",
            ambulanceId: new mongoose.Types.ObjectId(ambulanceId),
            driver: new mongoose.Types.ObjectId(workerId),
            medic: new mongoose.Types.ObjectId(workerId),
          },
        ],
      });

      const res = await request(app)
        .delete(`${API}/ambulances/${ambulanceId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(409);
      expect(res.body.sources).toContain("dienst-assignments");
    });

    it("DELETE bloquea si hay team con ambulanceId", async () => {
      const ambulanceId = await createAmbulance("team");
      const driver = await createTestWorkerInCompany(
        new mongoose.Types.ObjectId(companyId),
        Date.now() + 801,
      );
      const medic = await createTestWorkerInCompany(
        new mongoose.Types.ObjectId(companyId),
        Date.now() + 802,
      );
      await Team.create({
        driver: driver._id,
        medic: medic._id,
        rotationMode: "none",
        ambulanceId: new mongoose.Types.ObjectId(ambulanceId),
        companyId: new mongoose.Types.ObjectId(companyId),
      });

      const res = await request(app)
        .delete(`${API}/ambulances/${ambulanceId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(409);
      expect(res.body.sources).toContain("teams");
    });

    it("DELETE bloquea si hay workday-summary", async () => {
      const ambulanceId = await createAmbulance("ws");
      await WorkdaySummary.create({
        date: "2036-02-01",
        assignmentId: String(new mongoose.Types.ObjectId()),
        driver: new mongoose.Types.ObjectId(workerId),
        medic: new mongoose.Types.ObjectId(workerId),
        ambulanceId: new mongoose.Types.ObjectId(ambulanceId),
        companyId: new mongoose.Types.ObjectId(companyId),
        ambulanceNumber: "1",
        initialKm: 0,
        totalDienstKm: 10,
        trips: [],
        totalEffectivePatients: 0,
        totalRealTrips: 0,
      });

      const res = await request(app)
        .delete(`${API}/ambulances/${ambulanceId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(409);
      expect(res.body.sources).toContain("workday-summary");
    });

    it("DELETE bloquea si hay mechanics work order", async () => {
      const ambulanceId = await createAmbulance("mwo");
      await MechanicsWorkOrder.create({
        companyId: new mongoose.Types.ObjectId(companyId),
        ambulanceId: new mongoose.Types.ObjectId(ambulanceId),
        ambulanceNumber: "MWO-1",
        title: "Revisión",
        status: "pending",
        createdBy: new mongoose.Types.ObjectId(workerId),
      });

      const res = await request(app)
        .delete(`${API}/ambulances/${ambulanceId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(409);
      expect(res.body.sources).toContain("mechanics-work-orders");
    });

    it("DELETE bloquea si hay mechanics issue", async () => {
      const ambulanceId = await createAmbulance("issue");
      await MechanicsIssue.create({
        dienstNumber: 1,
        date: "2036-03-01",
        ambulanceId,
        ambulanceNumber: "ISS-1",
        timestamp: new Date().toISOString(),
        issueText: "Avería test",
        driver: new mongoose.Types.ObjectId(workerId),
        medic: new mongoose.Types.ObjectId(workerId),
        companyId: new mongoose.Types.ObjectId(companyId),
      });

      const res = await request(app)
        .delete(`${API}/ambulances/${ambulanceId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(409);
      expect(res.body.sources).toContain("mechanics-issues");
    });

    it("DELETE bloquea si hay trip-setup", async () => {
      const ambulanceId = await createAmbulance("setup");
      await TripSetup.create({
        assignmentId: new mongoose.Types.ObjectId(),
        date: "2036-04-01",
        ambulanceId,
        ambulanceNumber: "TS-1",
        initialKm: 100,
        companyId: new mongoose.Types.ObjectId(companyId),
      });

      const res = await request(app)
        .delete(`${API}/ambulances/${ambulanceId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(409);
      expect(res.body.sources).toContain("trip-setup");
    });

    it("DELETE elimina cuando no hay referencias", async () => {
      const ambulanceId = await createAmbulance("free");
      const res = await request(app)
        .delete(`${API}/ambulances/${ambulanceId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.message).toMatch(/deleted|eliminad/i);
    });
  });

  describe("cross-tenant ambulanceId injection", () => {
    let adminTokenA: string;
    let workerTokenA: string;
    let workerIdA: string;
    let ambulanceIdB: string;
    let assignmentIdA: string;
    const TRIP_DATE = "2036-05-10";

    beforeAll(async () => {
      const [dataA, dataB] = await Promise.all([
        createTestAdminWithCompany(),
        createTestAdminWithCompany(),
      ]);
      adminTokenA = adminTokenFor(dataA);
      const adminTokenB = adminTokenFor(dataB);

      const workerA = await createTestWorkerInCompany(
        new mongoose.Types.ObjectId(dataA.companyId),
        Date.now() + 900,
      );
      workerIdA = String(workerA._id);
      workerTokenA = issueTestJwt(
        String(workerA._id),
        "worker",
        dataA.companyId,
      );

      const ambB = await request(app)
        .post(`${API}/ambulances`)
        .set("Authorization", `Bearer ${adminTokenB}`)
        .send({
          brand: "B",
          modelName: "B",
          licensePlate: "INJ-B-" + Date.now(),
          ambulanceNumber: "INJ-B-N-" + Date.now(),
        });
      ambulanceIdB = ambB.body._id ?? ambB.body.id;

      const ambA = await request(app)
        .post(`${API}/ambulances`)
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          brand: "A",
          modelName: "A",
          licensePlate: "INJ-A-" + Date.now(),
          ambulanceNumber: "INJ-A-N-" + Date.now(),
        });
      expect(ambA.status).toBe(201);
      const ambulanceIdA = ambA.body._id ?? ambA.body.id;

      const createDienst = await request(app)
        .post(`${API}/diensts`)
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          dienstNumber: 501,
          weekStartDate: "2036-05-05",
          weekEndDate: "2036-05-11",
          assignments: [
            {
              date: TRIP_DATE,
              startTime: "08:00",
              endTime: "16:00",
              ambulanceId: ambulanceIdA,
              driver: workerIdA,
              medic: workerIdA,
            },
          ],
        });
      expect(createDienst.status).toBe(201);
      assignmentIdA =
        createDienst.body.assignments?.[0]?._id?.toString?.() ??
        createDienst.body.assignments?.[0]?.id ??
        "";
    });

    it("POST workday-summary rechaza ambulanceId de otra empresa", async () => {
      const res = await request(app)
        .post(`${API}/workday-summary`)
        .set("Authorization", `Bearer ${adminTokenA}`)
        .send({
          date: TRIP_DATE,
          assignmentId: assignmentIdA,
          ambulanceId: ambulanceIdB,
          ambulanceNumber: "X",
          initialKm: 0,
          finalKm: 10,
          trips: [
            {
              auftragNumber: "INJ-1",
              patientName: "P",
              fromAddress: "A",
              toAddress: "B",
              timeWarning: "08:00",
              wasCancelled: false,
              countsTrip: 1,
            },
          ],
        });
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/ambulancia|empresa/i);
    });

    it("PUT trip-setup rechaza ambulanceId de otra empresa", async () => {
      const res = await request(app)
        .put(`${API}/trips/setup/${assignmentIdA}`)
        .set("Authorization", `Bearer ${workerTokenA}`)
        .send({
          ambulanceId: ambulanceIdB,
          ambulanceNumber: "HACK",
          initialKm: 50,
        });
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/ambulancia|empresa/i);
    });
  });
});
