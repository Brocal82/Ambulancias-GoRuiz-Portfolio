/**
 * Tests de aislamiento multiempresa para teams.
 * Admin A no debe ver/modificar/eliminar teams de empresa B.
 */
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import {
  createTestAdminWithCompany,
  createTestWorkerInCompany,
} from "./test-helpers";
import { Team } from "../modules/teams/models/team.model";

const API = "/api";

let dataA: { adminToken: string; companyId: string; adminId: string };
let dataB: { adminToken: string; companyId: string; adminId: string };
let workerAId: string;
let workerBId: string;
let teamAId: string;
let teamBId: string;

describe("Teams isolation", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);

    const [resA, resB] = await Promise.all([
      createTestAdminWithCompany(),
      createTestAdminWithCompany(),
    ]);

    const [workerA, workerB] = await Promise.all([
      createTestWorkerInCompany(
        new mongoose.Types.ObjectId(resA.companyId),
        Date.now() + 1,
      ),
      createTestWorkerInCompany(
        new mongoose.Types.ObjectId(resB.companyId),
        Date.now() + 2,
      ),
    ]);

    dataA = { ...resA, adminId: resA.adminId };
    dataB = { ...resB, adminId: resB.adminId };
    workerAId = String(workerA._id);
    workerBId = String(workerB._id);

    const teamARes = await request(app)
      .post(`${API}/teams`)
      .set("Authorization", `Bearer ${dataA.adminToken}`)
      .send({
        driver: dataA.adminId,
        medic: workerAId,
        rotationMode: "none",
      })
      .expect(201);
    teamAId = teamARes.body?._id ?? teamARes.body?.id;

    const teamBRes = await request(app)
      .post(`${API}/teams`)
      .set("Authorization", `Bearer ${dataB.adminToken}`)
      .send({
        driver: dataB.adminId,
        medic: workerBId,
        rotationMode: "none",
      })
      .expect(201);
    teamBId = teamBRes.body?._id ?? teamBRes.body?.id;
  });

  afterAll(async () => {
    await Team.deleteMany({
      driver: { $in: [dataA.adminId, workerAId, dataB.adminId, workerBId] },
    });
    await mongoose.disconnect();
  });

  it("admin A solo ve teams de su empresa", async () => {
    const res = await request(app)
      .get(`${API}/teams`)
      .set("Authorization", `Bearer ${dataA.adminToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0]._id).toBe(teamAId);
  });

  it("admin A no puede borrar team de empresa B", async () => {
    const res = await request(app)
      .delete(`${API}/teams/${teamBId}`)
      .set("Authorization", `Bearer ${dataA.adminToken}`)
      .expect(403);
    expect(res.body.message).toContain("permiso");
  });

  it("admin A no puede actualizar team de empresa B", async () => {
    const res = await request(app)
      .patch(`${API}/teams/${teamBId}`)
      .set("Authorization", `Bearer ${dataA.adminToken}`)
      .send({ driver: dataA.adminId, medic: workerAId, rotationMode: "none" })
      .expect(403);
    expect(res.body.message).toContain("permiso");
  });

  it("getUsedTeamsForWeek no devuelve teams cross-company", async () => {
    const weekStart = "2030-01-06";
    const resA = await request(app)
      .get(`${API}/teams/used-for-week?weekStartDate=${weekStart}`)
      .set("Authorization", `Bearer ${dataA.adminToken}`)
      .expect(200);
    const resB = await request(app)
      .get(`${API}/teams/used-for-week?weekStartDate=${weekStart}`)
      .set("Authorization", `Bearer ${dataB.adminToken}`)
      .expect(200);
    expect(resA.body.usedTeamIds).toBeDefined();
    expect(resB.body.usedTeamIds).toBeDefined();
    const usedByA = resA.body.usedTeamIds as string[];
    const usedByB = resB.body.usedTeamIds as string[];
    if (usedByA.length > 0 && usedByB.length > 0) {
      const intersection = usedByA.filter((id: string) => usedByB.includes(id));
      expect(intersection).toEqual([]);
    }
  });
});
