/**
 * Tests de integración para Teams: módulo, tenant, roles y delete protection.
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
import Company from "../modules/companies/models/company.model";
import { MODULE_KEYS } from "../modules/companies/constants/modules.constants";
import { Team } from "../modules/teams/models/team.model";
import { Dienst } from "../modules/diensts";
import { Ambulance } from "../modules/ambulances";
import User from "../modules/users/models/user.model";

const API = "/api";

function adminTokenFor(data: {
  adminId: string;
  companyId: string;
  adminToken?: string;
}): string {
  return data.adminToken ?? issueTestJwt(data.adminId, "admin", data.companyId);
}

describe("Teams integration", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  describe("module gate", () => {
    let adminToken: string;
    let companyId: string;

    beforeAll(async () => {
      const data = await createTestAdminWithCompany();
      adminToken = adminTokenFor(data);
      companyId = data.companyId;
    });

    it("GET /api/teams devuelve 403 si teams está desactivado", async () => {
      await Company.findByIdAndUpdate(companyId, {
        $pull: { enabledModules: MODULE_KEYS.TEAMS },
      });
      try {
        const res = await request(app)
          .get(`${API}/teams`)
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(403);
        expect(res.body.message).toMatch(/teams/i);
      } finally {
        await Company.findByIdAndUpdate(companyId, {
          $addToSet: { enabledModules: MODULE_KEYS.TEAMS },
        });
      }
    });
  });

  describe("tenant and validation", () => {
    let adminA: { adminToken: string; companyId: string; adminId: string };
    let adminB: { adminToken: string; companyId: string; adminId: string };
    let workerAId: string;
    let medicOnlyId: string;
    let teamAId: string;
    let ambBId: string;

    beforeAll(async () => {
      const [resA, resB] = await Promise.all([
        createTestAdminWithCompany(),
        createTestAdminWithCompany(),
      ]);
      adminA = { ...resA, adminId: resA.adminId };
      adminB = { ...resB, adminId: resB.adminId };

      const workerA = await createTestWorkerInCompany(
        new mongoose.Types.ObjectId(adminA.companyId),
        Date.now() + 11,
      );
      workerAId = String(workerA._id);

      const medicOnly = await User.create({
        name: "Med",
        lastName: "Only",
        email: `med-only-${Date.now()}@test.local`,
        password: await bcrypt.hash("password123", 10),
        role: "worker",
        companyId: new mongoose.Types.ObjectId(adminA.companyId),
        ambulanceRole: "medic",
      });
      medicOnlyId = String(medicOnly._id);

      const teamRes = await request(app)
        .post(`${API}/teams`)
        .set("Authorization", `Bearer ${adminTokenFor(adminA)}`)
        .send({
          driver: adminA.adminId,
          medic: workerAId,
          rotationMode: "none",
        })
        .expect(201);
      teamAId = teamRes.body._id;

      const ambB = await Ambulance.create({
        brand: "B",
        modelName: "X",
        licensePlate: `PL-${Date.now()}`,
        ambulanceNumber: `N-${Date.now()}`,
        companyId: new mongoose.Types.ObjectId(adminB.companyId),
      });
      ambBId = String(ambB._id);
    });

    afterAll(async () => {
      await Team.deleteMany({
        _id: { $in: [teamAId].filter(Boolean) },
      });
      await User.deleteMany({ _id: medicOnlyId });
      await Ambulance.deleteMany({ _id: ambBId });
    });

    it("POST /api/teams rechaza medic como driver (rol inválido)", async () => {
      const res = await request(app)
        .post(`${API}/teams`)
        .set("Authorization", `Bearer ${adminTokenFor(adminA)}`)
        .send({
          driver: medicOnlyId,
          medic: workerAId,
          rotationMode: "none",
        })
        .expect(400);
      expect(res.body.message).toMatch(/conductor|driver|both/i);
    });

    it("POST /api/teams rechaza ambulanceId de otra empresa", async () => {
      const res = await request(app)
        .post(`${API}/teams`)
        .set("Authorization", `Bearer ${adminTokenFor(adminA)}`)
        .send({
          driver: adminA.adminId,
          medic: workerAId,
          rotationMode: "none",
          ambulanceId: ambBId,
        })
        .expect(400);
      expect(res.body.message).toMatch(/ambulancia|encontrada/i);
    });

    it("assign-team-to-week rechaza teamId de otra empresa", async () => {
      const weekStart = "2035-06-03";
      await Dienst.create({
        dienstNumber: 1,
        weekStartDate: new Date(weekStart),
        companyId: new mongoose.Types.ObjectId(adminA.companyId),
        assignments: [],
      });

      const workerB = await createTestWorkerInCompany(
        new mongoose.Types.ObjectId(adminB.companyId),
        Date.now() + 22,
      );
      const teamBRes = await request(app)
        .post(`${API}/teams`)
        .set("Authorization", `Bearer ${adminTokenFor(adminB)}`)
        .send({
          driver: adminB.adminId,
          medic: String(workerB._id),
          rotationMode: "none",
        })
        .expect(201);
      const teamBId = teamBRes.body._id;

      try {
        const res = await request(app)
          .post(`${API}/diensts/assign-team-to-week`)
          .set("Authorization", `Bearer ${adminTokenFor(adminA)}`)
          .send({
            dienstNumber: 1,
            weekStartDate: weekStart,
            teamId: teamBId,
          })
          .expect(404);
        expect(res.body.message || res.body.error).toBeDefined();
      } finally {
        await Team.findByIdAndDelete(teamBId);
        await Dienst.deleteMany({
          companyId: adminA.companyId,
          weekStartDate: new Date(weekStart),
        });
      }
    });

    it("DELETE /api/teams/:id devuelve 409 si weekTeamId referencia el equipo", async () => {
      const weekStart = "2035-07-01";
      await Dienst.create({
        dienstNumber: 2,
        weekStartDate: new Date(weekStart),
        companyId: new mongoose.Types.ObjectId(adminA.companyId),
        weekTeamId: new mongoose.Types.ObjectId(teamAId),
        assignments: [],
      });

      try {
        const res = await request(app)
          .delete(`${API}/teams/${teamAId}`)
          .set("Authorization", `Bearer ${adminTokenFor(adminA)}`)
          .expect(409);
        expect(res.body.sources).toContain("dienst-week-team");
      } finally {
        await Dienst.deleteMany({
          companyId: adminA.companyId,
          weekTeamId: teamAId,
        });
      }
    });
  });

  describe("scheduling requires teams module", () => {
    let adminToken: string;
    let companyId: string;

    beforeAll(async () => {
      const data = await createTestAdminWithCompany();
      adminToken = adminTokenFor(data);
      companyId = data.companyId;
    });

    it("POST assign-team-to-week devuelve 403 si teams está desactivado", async () => {
      await Company.findByIdAndUpdate(companyId, {
        $pull: { enabledModules: MODULE_KEYS.TEAMS },
      });
      try {
        const res = await request(app)
          .post(`${API}/diensts/assign-team-to-week`)
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            dienstNumber: 1,
            weekStartDate: "2035-01-06",
            teamId: new mongoose.Types.ObjectId().toString(),
          })
          .expect(403);
        expect(res.body.message).toMatch(/teams/i);
      } finally {
        await Company.findByIdAndUpdate(companyId, {
          $addToSet: { enabledModules: MODULE_KEYS.TEAMS },
        });
      }
    });
  });
});
