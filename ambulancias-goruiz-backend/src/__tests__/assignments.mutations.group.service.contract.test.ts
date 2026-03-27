/**
 * Contrato mutaciones assignments (clearPeopleForWeek, updateDienstPartial,
 * assignUserToWeek, assignTeamToWeek): exigen companyId de caller y Dienst con company.
 */
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { env } from "../config/env";
import Dienst from "../modules/diensts/models/dienst.model";
import User from "../modules/users/models/user.model";
import { Team } from "../modules/teams";
import {
  clearPeopleForWeek,
  updateDienstPartial,
  assignUserToWeek,
  assignTeamToWeek,
} from "../modules/diensts/assignments/services/assignments.service";
import { DienstAssignmentError } from "../modules/diensts/assignments/services/assignment-errors";

async function hashPw() {
  return bcrypt.hash("password123", 8);
}

describe("assignments.service mutations group (company contract)", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  describe("clearPeopleForWeek", () => {
    it("rechaza companyId ausente o en blanco (403)", async () => {
      await expect(
        clearPeopleForWeek(
          { dienstNumber: 1, weekStartDate: "2035-01-01" },
          undefined,
        ),
      ).rejects.toMatchObject({
        statusCode: 403,
        code: "forbidden",
      });
      await expect(
        clearPeopleForWeek({ dienstNumber: 1, weekStartDate: "2035-01-01" }, ""),
      ).rejects.toBeInstanceOf(DienstAssignmentError);
      await expect(
        clearPeopleForWeek({ dienstNumber: 1, weekStartDate: "2035-01-01" }, "   "),
      ).rejects.toBeInstanceOf(DienstAssignmentError);
    });

    it("no encuentra Dienst legacy sin companyId (404)", async () => {
      await Dienst.create({
        dienstNumber: 93110,
        weekStartDate: new Date("2035-01-06"),
        weekEndDate: new Date("2035-01-12"),
        assignments: [
          { date: "2035-01-07", startTime: "08:00", endTime: "16:00" },
        ],
        companyId: null,
      });
      const callerCo = new mongoose.Types.ObjectId().toString();
      await expect(
        clearPeopleForWeek(
          { dienstNumber: 93110, weekStartDate: "2035-01-06" },
          callerCo,
        ),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: "dienst_not_found",
      });
      await Dienst.deleteMany({ dienstNumber: 93110 });
    });

    it("limpia cuando companyId coincide", async () => {
      const co = new mongoose.Types.ObjectId().toString();
      const d = await Dienst.create({
        dienstNumber: 93111,
        weekStartDate: new Date("2035-01-13"),
        weekEndDate: new Date("2035-01-19"),
        assignments: [
          {
            date: "2035-01-14",
            startTime: "08:00",
            endTime: "16:00",
            driver: new mongoose.Types.ObjectId(),
          },
        ],
        companyId: new mongoose.Types.ObjectId(co),
      });
      const out = await clearPeopleForWeek(
        { dienstNumber: 93111, weekStartDate: "2035-01-13" },
        co,
      );
      expect(out.clearedCount).toBeGreaterThanOrEqual(1);
      expect(out.dienstId).toBe(String(d._id));
      await Dienst.deleteOne({ _id: d._id });
    });

    it("no encuentra Dienst de otra empresa (404)", async () => {
      const coA = new mongoose.Types.ObjectId().toString();
      const coB = new mongoose.Types.ObjectId().toString();
      await Dienst.create({
        dienstNumber: 93112,
        weekStartDate: new Date("2035-01-20"),
        weekEndDate: new Date("2035-01-26"),
        assignments: [
          { date: "2035-01-21", startTime: "08:00", endTime: "16:00" },
        ],
        companyId: new mongoose.Types.ObjectId(coA),
      });
      await expect(
        clearPeopleForWeek(
          { dienstNumber: 93112, weekStartDate: "2035-01-20" },
          coB,
        ),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: "dienst_not_found",
      });
      await Dienst.deleteMany({ dienstNumber: 93112 });
    });
  });

  describe("updateDienstPartial", () => {
    it("devuelve null si companyId ausente o en blanco", async () => {
      const id = new mongoose.Types.ObjectId().toString();
      await expect(
        updateDienstPartial(id, [], undefined),
      ).resolves.toBeNull();
      await expect(updateDienstPartial(id, [], null)).resolves.toBeNull();
      await expect(updateDienstPartial(id, [], "")).resolves.toBeNull();
      await expect(updateDienstPartial(id, [], "   ")).resolves.toBeNull();
    });

    it("devuelve null para Dienst sin companyId", async () => {
      const legacy = await Dienst.create({
        dienstNumber: 93120,
        assignments: [],
        companyId: null,
      });
      const callerCo = new mongoose.Types.ObjectId().toString();
      await expect(
        updateDienstPartial(
          String(legacy._id),
          [
            {
              date: "2035-02-01",
              startTime: "08:00",
              endTime: "16:00",
            },
          ],
          callerCo,
        ),
      ).resolves.toBeNull();
      await Dienst.deleteOne({ _id: legacy._id });
    });

    it("actualiza cuando companyId coincide", async () => {
      const co = new mongoose.Types.ObjectId().toString();
      const d = await Dienst.create({
        dienstNumber: 93121,
        assignments: [
          {
            date: "2035-02-02",
            startTime: "08:00",
            endTime: "16:00",
          },
        ],
        companyId: new mongoose.Types.ObjectId(co),
      });
      const out = await updateDienstPartial(
        String(d._id),
        [
          {
            date: "2035-02-02",
            startTime: "09:00",
            endTime: "17:00",
          },
        ],
        co,
      );
      expect(out).not.toBeNull();
      expect(
        (out as { assignments: { startTime: string }[] }).assignments.some(
          (a) => a.startTime === "09:00",
        ),
      ).toBe(true);
      await Dienst.deleteOne({ _id: d._id });
    });

    it("devuelve null si companyId no coincide", async () => {
      const coA = new mongoose.Types.ObjectId().toString();
      const coB = new mongoose.Types.ObjectId().toString();
      const d = await Dienst.create({
        dienstNumber: 93122,
        assignments: [
          {
            date: "2035-02-03",
            startTime: "08:00",
            endTime: "16:00",
          },
        ],
        companyId: new mongoose.Types.ObjectId(coA),
      });
      await expect(
        updateDienstPartial(
          String(d._id),
          [
            {
              date: "2035-02-03",
              startTime: "08:00",
              endTime: "16:00",
            },
          ],
          coB,
        ),
      ).resolves.toBeNull();
      await Dienst.deleteOne({ _id: d._id });
    });
  });

  describe("assignUserToWeek", () => {
    it("rechaza companyId ausente o en blanco (403)", async () => {
      const uid = new mongoose.Types.ObjectId().toString();
      await expect(
        assignUserToWeek(
          {
            dienstNumber: 1,
            weekStartDate: "2035-03-01",
            userId: uid,
            role: "medic",
          },
          undefined,
        ),
      ).rejects.toMatchObject({ statusCode: 403, code: "forbidden" });
      await expect(
        assignUserToWeek(
          {
            dienstNumber: 1,
            weekStartDate: "2035-03-01",
            userId: uid,
            role: "medic",
          },
          "",
        ),
      ).rejects.toBeInstanceOf(DienstAssignmentError);
    });

    it("no encuentra Dienst legacy sin companyId (404)", async () => {
      const co = new mongoose.Types.ObjectId().toString();
      const pw = await hashPw();
      const u = await User.create({
        name: "Med",
        lastName: "Test",
        email: `med-${Date.now()}@assign-user.test`,
        password: pw,
        role: "worker",
        companyId: new mongoose.Types.ObjectId(co),
        ambulanceRole: "medic",
      });
      await Dienst.create({
        dienstNumber: 93130,
        weekStartDate: new Date("2035-03-03"),
        weekEndDate: new Date("2035-03-09"),
        assignments: [
          { date: "2035-03-04", startTime: "08:00", endTime: "16:00" },
        ],
        companyId: null,
      });
      await expect(
        assignUserToWeek(
          {
            dienstNumber: 93130,
            weekStartDate: "2035-03-03",
            userId: String(u._id),
            role: "medic",
          },
          co,
        ),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: "dienst_not_found",
      });
      await User.deleteOne({ _id: u._id });
      await Dienst.deleteMany({ dienstNumber: 93130 });
    });

    it("asigna cuando usuario y Dienst comparten empresa", async () => {
      const co = new mongoose.Types.ObjectId().toString();
      const pw = await hashPw();
      const u = await User.create({
        name: "Med",
        lastName: "Ok",
        email: `med-ok-${Date.now()}@assign-user.test`,
        password: pw,
        role: "worker",
        companyId: new mongoose.Types.ObjectId(co),
        ambulanceRole: "medic",
      });
      const d = await Dienst.create({
        dienstNumber: 93131,
        weekStartDate: new Date("2035-03-10"),
        weekEndDate: new Date("2035-03-16"),
        assignments: [
          { date: "2035-03-11", startTime: "08:00", endTime: "16:00" },
          { date: "2035-03-12", startTime: "08:00", endTime: "16:00" },
        ],
        companyId: new mongoose.Types.ObjectId(co),
      });
      const out = await assignUserToWeek(
        {
          dienstNumber: 93131,
          weekStartDate: "2035-03-10",
          userId: String(u._id),
          role: "medic",
        },
        co,
      );
      expect(out.updatedCount).toBeGreaterThan(0);
      expect(out.dienstId).toBe(String(d._id));
      await User.deleteOne({ _id: u._id });
      await Dienst.deleteOne({ _id: d._id });
    });

    it("no encuentra Dienst de otra empresa (404)", async () => {
      const coA = new mongoose.Types.ObjectId().toString();
      const coB = new mongoose.Types.ObjectId().toString();
      const pw = await hashPw();
      const u = await User.create({
        name: "Med",
        lastName: "B",
        email: `med-b-${Date.now()}@assign-user.test`,
        password: pw,
        role: "worker",
        companyId: new mongoose.Types.ObjectId(coB),
        ambulanceRole: "medic",
      });
      await Dienst.create({
        dienstNumber: 93132,
        weekStartDate: new Date("2035-03-17"),
        weekEndDate: new Date("2035-03-23"),
        assignments: [
          { date: "2035-03-18", startTime: "08:00", endTime: "16:00" },
        ],
        companyId: new mongoose.Types.ObjectId(coA),
      });
      await expect(
        assignUserToWeek(
          {
            dienstNumber: 93132,
            weekStartDate: "2035-03-17",
            userId: String(u._id),
            role: "medic",
          },
          coB,
        ),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: "dienst_not_found",
      });
      await User.deleteOne({ _id: u._id });
      await Dienst.deleteMany({ dienstNumber: 93132 });
    });
  });

  describe("assignTeamToWeek", () => {
    it("rechaza companyId ausente o en blanco (403)", async () => {
      const tid = new mongoose.Types.ObjectId().toString();
      await expect(
        assignTeamToWeek(
          {
            dienstNumber: 1,
            weekStartDate: "2035-04-01",
            teamId: tid,
          },
          undefined,
        ),
      ).rejects.toMatchObject({ statusCode: 403, code: "forbidden" });
    });

    it("no encuentra Dienst legacy sin companyId (404)", async () => {
      const co = new mongoose.Types.ObjectId().toString();
      const pw = await hashPw();
      const driver = await User.create({
        name: "D",
        lastName: "R",
        email: `drv-${Date.now()}@team.test`,
        password: pw,
        role: "worker",
        companyId: new mongoose.Types.ObjectId(co),
        ambulanceRole: "driver",
        pscheinExpiry: "2040-12-31",
        pscheinConfirmedAt: new Date(),
      });
      const medic = await User.create({
        name: "M",
        lastName: "E",
        email: `med-${Date.now()}@team.test`,
        password: pw,
        role: "worker",
        companyId: new mongoose.Types.ObjectId(co),
        ambulanceRole: "medic",
      });
      const team = await Team.create({
        driver: driver._id,
        medic: medic._id,
        rotationMode: "none",
      });
      await Dienst.create({
        dienstNumber: 93140,
        weekStartDate: new Date("2035-04-07"),
        weekEndDate: new Date("2035-04-13"),
        assignments: [],
        companyId: null,
      });
      await expect(
        assignTeamToWeek(
          {
            dienstNumber: 93140,
            weekStartDate: "2035-04-07",
            teamId: String(team._id),
          },
          co,
        ),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: "dienst_not_found",
      });
      await Team.deleteOne({ _id: team._id });
      await User.deleteMany({ _id: { $in: [driver._id, medic._id] } });
      await Dienst.deleteMany({ dienstNumber: 93140 });
    });

    it("asigna cuando team y Dienst comparten empresa", async () => {
      const co = new mongoose.Types.ObjectId().toString();
      const pw = await hashPw();
      const driver = await User.create({
        name: "D",
        lastName: "R",
        email: `drv-ok-${Date.now()}@team.test`,
        password: pw,
        role: "worker",
        companyId: new mongoose.Types.ObjectId(co),
        ambulanceRole: "driver",
        pscheinExpiry: "2040-12-31",
        pscheinConfirmedAt: new Date(),
      });
      const medic = await User.create({
        name: "M",
        lastName: "E",
        email: `med-ok-${Date.now()}@team.test`,
        password: pw,
        role: "worker",
        companyId: new mongoose.Types.ObjectId(co),
        ambulanceRole: "medic",
      });
      const team = await Team.create({
        driver: driver._id,
        medic: medic._id,
        rotationMode: "none",
      });
      const d = await Dienst.create({
        dienstNumber: 93141,
        weekStartDate: new Date("2035-04-14"),
        weekEndDate: new Date("2035-04-20"),
        assignments: [],
        companyId: new mongoose.Types.ObjectId(co),
      });
      const out = await assignTeamToWeek(
        {
          dienstNumber: 93141,
          weekStartDate: "2035-04-14",
          teamId: String(team._id),
        },
        co,
      );
      expect(out).toHaveProperty("dienstId", String(d._id));
      await Team.deleteOne({ _id: team._id });
      await User.deleteMany({ _id: { $in: [driver._id, medic._id] } });
      await Dienst.deleteOne({ _id: d._id });
    });

    it("no encuentra Dienst de otra empresa (404)", async () => {
      const coA = new mongoose.Types.ObjectId().toString();
      const coB = new mongoose.Types.ObjectId().toString();
      const pw = await hashPw();
      const driver = await User.create({
        name: "D",
        lastName: "R",
        email: `drv-x-${Date.now()}@team.test`,
        password: pw,
        role: "worker",
        companyId: new mongoose.Types.ObjectId(coB),
        ambulanceRole: "driver",
        pscheinExpiry: "2040-12-31",
        pscheinConfirmedAt: new Date(),
      });
      const medic = await User.create({
        name: "M",
        lastName: "E",
        email: `med-x-${Date.now()}@team.test`,
        password: pw,
        role: "worker",
        companyId: new mongoose.Types.ObjectId(coB),
        ambulanceRole: "medic",
      });
      const team = await Team.create({
        driver: driver._id,
        medic: medic._id,
        rotationMode: "none",
      });
      await Dienst.create({
        dienstNumber: 93142,
        weekStartDate: new Date("2035-04-21"),
        weekEndDate: new Date("2035-04-27"),
        assignments: [],
        companyId: new mongoose.Types.ObjectId(coA),
      });
      await expect(
        assignTeamToWeek(
          {
            dienstNumber: 93142,
            weekStartDate: "2035-04-21",
            teamId: String(team._id),
          },
          coB,
        ),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: "dienst_not_found",
      });
      await Team.deleteOne({ _id: team._id });
      await User.deleteMany({ _id: { $in: [driver._id, medic._id] } });
      await Dienst.deleteMany({ dienstNumber: 93142 });
    });
  });
});
