/**
 * Contrato mutaciones assignments (clearPeopleForWeek, updateDienstPartial,
 * moveSlotSameWeek, dndCrossDienstSameWeek, assignUserToWeek (descanso mínimo), assignTeamToWeek (descanso mínimo, roles independientes)): exigen companyId de caller y Dienst con company.
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
  moveSlotSameWeek,
  dndCrossDienstSameWeek,
  assignUserToWeek,
  assignTeamToWeek,
  assignAmbulanceToWeek,
} from "../modules/diensts/assignments/services/assignments.service";
import { DienstAssignmentError } from "../modules/diensts/assignments/services/assignment-errors";
import { findWeeklyConflicts } from "../modules/diensts/utils/dienstValidation";
import { getWeekMongoDateRange } from "../utils/time";
import Company from "../modules/companies/models/company.model";
import { Ambulance } from "../modules/ambulances";
import { MODULE_KEYS } from "../modules/companies/constants/modules.constants";
import * as wsNotify from "../modules/notifications/utils/ws-notify";

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

    it("encuentra Dienst con weekStartDate anclado Berlin (estilo generate-week)", async () => {
      const co = new mongoose.Types.ObjectId().toString();
      const weekStartISO = "2035-05-05";
      const { start } = getWeekMongoDateRange(weekStartISO);
      const d = await Dienst.create({
        dienstNumber: 93113,
        weekStartDate: start,
        weekEndDate: new Date("2035-05-11"),
        assignments: [
          {
            date: "2035-05-05",
            startTime: "08:00",
            endTime: "16:00",
            driver: new mongoose.Types.ObjectId(),
          },
        ],
        companyId: new mongoose.Types.ObjectId(co),
      });
      const out = await clearPeopleForWeek(
        { dienstNumber: 93113, weekStartDate: weekStartISO },
        co,
      );
      expect(out.clearedCount).toBeGreaterThanOrEqual(1);
      expect(out.dienstId).toBe(String(d._id));
      await Dienst.deleteOne({ _id: d._id });
    });

    it("no emite websocket cuando dienst_not_found", async () => {
      const spy = jest
        .spyOn(wsNotify, "voidEmitSchedulingMutationRealtime")
        .mockImplementation(() => {});
      const co = new mongoose.Types.ObjectId().toString();
      await expect(
        clearPeopleForWeek(
          { dienstNumber: 99999, weekStartDate: "2035-05-12" },
          co,
        ),
      ).rejects.toMatchObject({ statusCode: 404, code: "dienst_not_found" });
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
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
      const doc = out!.dienst as unknown as { assignments: { startTime: string }[] };
      expect(doc.assignments.some((a) => a.startTime === "09:00")).toBe(true);
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

    it("permite guardado con aviso si el descanso está entre 10 y 11 h (minimum_rest_soft)", async () => {
      const co = new mongoose.Types.ObjectId().toString();
      const uid = new mongoose.Types.ObjectId().toString();
      const d = await Dienst.create({
        dienstNumber: 93124,
        weekStartDate: new Date("2035-01-07"),
        weekEndDate: new Date("2035-01-13"),
        assignments: [
          {
            date: "2035-01-07",
            startTime: "22:00",
            endTime: "06:00",
            driver: new mongoose.Types.ObjectId(uid),
          },
          {
            date: "2035-01-08",
            startTime: "12:00",
            endTime: "20:00",
            driver: new mongoose.Types.ObjectId(uid),
          },
        ],
        companyId: new mongoose.Types.ObjectId(co),
      });

      const out = await updateDienstPartial(
        String(d._id),
        [
          {
            date: "2035-01-08",
            startTime: "16:00",
            endTime: "20:00",
          },
        ],
        co,
      );
      expect(out).not.toBeNull();
      expect(out!.minimumRestWarning?.code).toBe("minimum_rest_soft");
      const doc = out!.dienst as unknown as { assignments: { startTime: string }[] };
      expect(doc.assignments.some((a) => a.startTime === "16:00")).toBe(true);
      await Dienst.deleteOne({ _id: d._id });
    });

    it("permite sin aviso si el descanso es >= 11 h (mismo escenario que soft)", async () => {
      const co = new mongoose.Types.ObjectId().toString();
      const uid = new mongoose.Types.ObjectId().toString();
      const d = await Dienst.create({
        dienstNumber: 93125,
        weekStartDate: new Date("2035-01-07"),
        weekEndDate: new Date("2035-01-13"),
        assignments: [
          {
            date: "2035-01-07",
            startTime: "22:00",
            endTime: "06:00",
            driver: new mongoose.Types.ObjectId(uid),
          },
          {
            date: "2035-01-08",
            startTime: "12:00",
            endTime: "20:00",
            driver: new mongoose.Types.ObjectId(uid),
          },
        ],
        companyId: new mongoose.Types.ObjectId(co),
      });

      const out = await updateDienstPartial(
        String(d._id),
        [
          {
            date: "2035-01-08",
            startTime: "17:00",
            endTime: "20:00",
          },
        ],
        co,
      );
      expect(out).not.toBeNull();
      expect(out!.minimumRestWarning).toBeUndefined();
      const doc = out!.dienst as unknown as { assignments: { startTime: string }[] };
      expect(doc.assignments.some((a) => a.startTime === "17:00")).toBe(true);
      await Dienst.deleteOne({ _id: d._id });
    });

    it("rechaza descanso < 10 h entre turnos del mismo trabajador (insufficient_rest)", async () => {
      const co = new mongoose.Types.ObjectId().toString();
      const uid = new mongoose.Types.ObjectId().toString();
      const d = await Dienst.create({
        dienstNumber: 93123,
        weekStartDate: new Date("2035-01-07"),
        weekEndDate: new Date("2035-01-13"),
        assignments: [
          {
            date: "2035-01-07",
            startTime: "22:00",
            endTime: "06:00",
            driver: new mongoose.Types.ObjectId(uid),
          },
          {
            date: "2035-01-08",
            startTime: "12:00",
            endTime: "20:00",
            driver: new mongoose.Types.ObjectId(uid),
          },
        ],
        companyId: new mongoose.Types.ObjectId(co),
      });

      await expect(
        updateDienstPartial(
          String(d._id),
          [
            {
              date: "2035-01-08",
              startTime: "08:00",
              endTime: "16:00",
            },
          ],
          co,
        ),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "insufficient_rest",
      });

      await Dienst.deleteOne({ _id: d._id });
    });
  });

  describe("moveSlotSameWeek (descanso mínimo)", () => {
    it("mueve sin minimumRestWarning cuando no hay vecino conflictivo", async () => {
      const coOid = new mongoose.Types.ObjectId();
      const co = coOid.toString();
      const uDriver = await User.create({
        name: "M",
        lastName: "D",
        email: `move-a-${Date.now()}@test.local`,
        password: await hashPw(),
        role: "worker",
        ambulanceRole: "driver",
        companyId: coOid,
        pscheinExpiry: "2040-12-31",
        pscheinConfirmedAt: new Date("2030-01-01"),
      });
      const uMedic = await User.create({
        name: "M",
        lastName: "E",
        email: `move-a2-${Date.now()}@test.local`,
        password: await hashPw(),
        role: "worker",
        ambulanceRole: "medic",
        companyId: coOid,
      });

      const d1 = await Dienst.create({
        dienstNumber: 94210,
        weekStartDate: new Date("2035-01-07"),
        weekEndDate: new Date("2035-01-13"),
        companyId: coOid,
        assignments: [
          {
            date: "2035-01-08",
            startTime: "08:00",
            endTime: "16:00",
            driver: uDriver._id,
            medic: uMedic._id,
          },
        ],
      });
      const d2 = await Dienst.create({
        dienstNumber: 94211,
        weekStartDate: new Date("2035-01-07"),
        weekEndDate: new Date("2035-01-13"),
        companyId: coOid,
        assignments: [
          {
            date: "2035-01-08",
            startTime: "08:00",
            endTime: "16:00",
            medic: uMedic._id,
          },
        ],
      });

      const out = await moveSlotSameWeek(
        {
          sourceDienstId: String(d1._id),
          sourceDate: "2035-01-08",
          targetDienstId: String(d2._id),
          targetDate: "2035-01-08",
          role: "driver",
          userId: String(uDriver._id),
        },
        co,
      );
      expect(out.minimumRestWarning).toBeUndefined();

      await Dienst.deleteMany({ dienstNumber: { $in: [94210, 94211] } });
      await User.deleteMany({ _id: { $in: [uDriver._id, uMedic._id] } });
    });

    it("aviso minimum_rest_soft cuando el hueco destino queda en franja 10–11 h", async () => {
      const coOid = new mongoose.Types.ObjectId();
      const co = coOid.toString();
      const uDriver = await User.create({
        name: "M",
        lastName: "F",
        email: `move-b-${Date.now()}@test.local`,
        password: await hashPw(),
        role: "worker",
        ambulanceRole: "driver",
        companyId: coOid,
        pscheinExpiry: "2040-12-31",
        pscheinConfirmedAt: new Date("2030-01-01"),
      });
      const uMedic = await User.create({
        name: "M",
        lastName: "G",
        email: `move-b2-${Date.now()}@test.local`,
        password: await hashPw(),
        role: "worker",
        ambulanceRole: "medic",
        companyId: coOid,
      });

      const d1 = await Dienst.create({
        dienstNumber: 94212,
        weekStartDate: new Date("2035-01-07"),
        weekEndDate: new Date("2035-01-13"),
        companyId: coOid,
        assignments: [
          {
            date: "2035-01-08",
            startTime: "08:00",
            endTime: "16:00",
            driver: uDriver._id,
            medic: uMedic._id,
          },
        ],
      });
      const d2 = await Dienst.create({
        dienstNumber: 94213,
        weekStartDate: new Date("2035-01-07"),
        weekEndDate: new Date("2035-01-13"),
        companyId: coOid,
        assignments: [
          {
            date: "2035-01-07",
            startTime: "22:00",
            endTime: "06:00",
            driver: uDriver._id,
            medic: uMedic._id,
          },
          {
            date: "2035-01-08",
            startTime: "16:00",
            endTime: "20:00",
            medic: uMedic._id,
          },
        ],
      });

      const out = await moveSlotSameWeek(
        {
          sourceDienstId: String(d1._id),
          sourceDate: "2035-01-08",
          targetDienstId: String(d2._id),
          targetDate: "2035-01-08",
          role: "driver",
          userId: String(uDriver._id),
        },
        co,
      );
      expect(out.minimumRestWarning?.code).toBe("minimum_rest_soft");

      await Dienst.deleteMany({ dienstNumber: { $in: [94212, 94213] } });
      await User.deleteMany({ _id: { $in: [uDriver._id, uMedic._id] } });
    });

    it("rechaza insufficient_rest al mover a hueco con <10 h respecto al turno previo", async () => {
      const coOid = new mongoose.Types.ObjectId();
      const co = coOid.toString();
      const uDriver = await User.create({
        name: "M",
        lastName: "H",
        email: `move-c-${Date.now()}@test.local`,
        password: await hashPw(),
        role: "worker",
        ambulanceRole: "driver",
        companyId: coOid,
        pscheinExpiry: "2040-12-31",
        pscheinConfirmedAt: new Date("2030-01-01"),
      });
      const uMedic = await User.create({
        name: "M",
        lastName: "I",
        email: `move-c2-${Date.now()}@test.local`,
        password: await hashPw(),
        role: "worker",
        ambulanceRole: "medic",
        companyId: coOid,
      });

      const d1 = await Dienst.create({
        dienstNumber: 94214,
        weekStartDate: new Date("2035-01-07"),
        weekEndDate: new Date("2035-01-13"),
        companyId: coOid,
        assignments: [
          {
            date: "2035-01-08",
            startTime: "08:00",
            endTime: "16:00",
            driver: uDriver._id,
            medic: uMedic._id,
          },
        ],
      });
      const d2 = await Dienst.create({
        dienstNumber: 94215,
        weekStartDate: new Date("2035-01-07"),
        weekEndDate: new Date("2035-01-13"),
        companyId: coOid,
        assignments: [
          {
            date: "2035-01-07",
            startTime: "22:00",
            endTime: "06:00",
            driver: uDriver._id,
            medic: uMedic._id,
          },
          {
            date: "2035-01-08",
            startTime: "07:00",
            endTime: "15:00",
            medic: uMedic._id,
          },
        ],
      });

      await expect(
        moveSlotSameWeek(
          {
            sourceDienstId: String(d1._id),
            sourceDate: "2035-01-08",
            targetDienstId: String(d2._id),
            targetDate: "2035-01-08",
            role: "driver",
            userId: String(uDriver._id),
          },
          co,
        ),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "insufficient_rest",
      });

      await Dienst.deleteMany({ dienstNumber: { $in: [94214, 94215] } });
      await User.deleteMany({ _id: { $in: [uDriver._id, uMedic._id] } });
    });
  });

  describe("dndCrossDienstSameWeek (descanso mínimo)", () => {
    it("DnD sin minimumRestWarning cuando no hay vecino conflictivo", async () => {
      const coOid = new mongoose.Types.ObjectId();
      const co = coOid.toString();
      const uDriver = await User.create({
        name: "D",
        lastName: "Nd",
        email: `dnd-a-${Date.now()}@test.local`,
        password: await hashPw(),
        role: "worker",
        ambulanceRole: "driver",
        companyId: coOid,
        pscheinExpiry: "2040-12-31",
        pscheinConfirmedAt: new Date("2030-01-01"),
      });
      const uMedic = await User.create({
        name: "M",
        lastName: "Nd",
        email: `dnd-a2-${Date.now()}@test.local`,
        password: await hashPw(),
        role: "worker",
        ambulanceRole: "medic",
        companyId: coOid,
      });

      const d1 = await Dienst.create({
        dienstNumber: 94320,
        weekStartDate: new Date("2035-01-07"),
        weekEndDate: new Date("2035-01-13"),
        companyId: coOid,
        assignments: [
          {
            date: "2035-01-08",
            startTime: "08:00",
            endTime: "16:00",
            driver: uDriver._id,
            medic: uMedic._id,
          },
        ],
      });
      const d2 = await Dienst.create({
        dienstNumber: 94321,
        weekStartDate: new Date("2035-01-07"),
        weekEndDate: new Date("2035-01-13"),
        companyId: coOid,
        assignments: [
          {
            date: "2035-01-08",
            startTime: "08:00",
            endTime: "16:00",
            medic: uMedic._id,
          },
        ],
      });

      const out = await dndCrossDienstSameWeek(
        {
          sourceDienstId: String(d1._id),
          sourceDate: "2035-01-08",
          targetDienstId: String(d2._id),
          targetDate: "2035-01-08",
          role: "driver",
          userId: String(uDriver._id),
        },
        co,
      );
      expect(out.minimumRestWarning).toBeUndefined();

      await Dienst.deleteMany({ dienstNumber: { $in: [94320, 94321] } });
      await User.deleteMany({ _id: { $in: [uDriver._id, uMedic._id] } });
    });

    it("DnD con aviso minimum_rest_soft (misma geometría que moveSlotSameWeek)", async () => {
      const coOid = new mongoose.Types.ObjectId();
      const co = coOid.toString();
      const uDriver = await User.create({
        name: "D",
        lastName: "Ne",
        email: `dnd-b-${Date.now()}@test.local`,
        password: await hashPw(),
        role: "worker",
        ambulanceRole: "driver",
        companyId: coOid,
        pscheinExpiry: "2040-12-31",
        pscheinConfirmedAt: new Date("2030-01-01"),
      });
      const uMedic = await User.create({
        name: "M",
        lastName: "Ne",
        email: `dnd-b2-${Date.now()}@test.local`,
        password: await hashPw(),
        role: "worker",
        ambulanceRole: "medic",
        companyId: coOid,
      });

      const d1 = await Dienst.create({
        dienstNumber: 94322,
        weekStartDate: new Date("2035-01-07"),
        weekEndDate: new Date("2035-01-13"),
        companyId: coOid,
        assignments: [
          {
            date: "2035-01-08",
            startTime: "08:00",
            endTime: "16:00",
            driver: uDriver._id,
            medic: uMedic._id,
          },
        ],
      });
      const d2 = await Dienst.create({
        dienstNumber: 94323,
        weekStartDate: new Date("2035-01-07"),
        weekEndDate: new Date("2035-01-13"),
        companyId: coOid,
        assignments: [
          {
            date: "2035-01-07",
            startTime: "22:00",
            endTime: "06:00",
            driver: uDriver._id,
            medic: uMedic._id,
          },
          {
            date: "2035-01-08",
            startTime: "16:00",
            endTime: "20:00",
            medic: uMedic._id,
          },
        ],
      });

      const out = await dndCrossDienstSameWeek(
        {
          sourceDienstId: String(d1._id),
          sourceDate: "2035-01-08",
          targetDienstId: String(d2._id),
          targetDate: "2035-01-08",
          role: "driver",
          userId: String(uDriver._id),
        },
        co,
      );
      expect(out.minimumRestWarning?.code).toBe("minimum_rest_soft");

      await Dienst.deleteMany({ dienstNumber: { $in: [94322, 94323] } });
      await User.deleteMany({ _id: { $in: [uDriver._id, uMedic._id] } });
    });

    it("DnD rechaza insufficient_rest con <10 h respecto al turno previo en destino", async () => {
      const coOid = new mongoose.Types.ObjectId();
      const co = coOid.toString();
      const uDriver = await User.create({
        name: "D",
        lastName: "Nf",
        email: `dnd-c-${Date.now()}@test.local`,
        password: await hashPw(),
        role: "worker",
        ambulanceRole: "driver",
        companyId: coOid,
        pscheinExpiry: "2040-12-31",
        pscheinConfirmedAt: new Date("2030-01-01"),
      });
      const uMedic = await User.create({
        name: "M",
        lastName: "Nf",
        email: `dnd-c2-${Date.now()}@test.local`,
        password: await hashPw(),
        role: "worker",
        ambulanceRole: "medic",
        companyId: coOid,
      });

      const d1 = await Dienst.create({
        dienstNumber: 94324,
        weekStartDate: new Date("2035-01-07"),
        weekEndDate: new Date("2035-01-13"),
        companyId: coOid,
        assignments: [
          {
            date: "2035-01-08",
            startTime: "08:00",
            endTime: "16:00",
            driver: uDriver._id,
            medic: uMedic._id,
          },
        ],
      });
      const d2 = await Dienst.create({
        dienstNumber: 94325,
        weekStartDate: new Date("2035-01-07"),
        weekEndDate: new Date("2035-01-13"),
        companyId: coOid,
        assignments: [
          {
            date: "2035-01-07",
            startTime: "22:00",
            endTime: "06:00",
            driver: uDriver._id,
            medic: uMedic._id,
          },
          {
            date: "2035-01-08",
            startTime: "07:00",
            endTime: "15:00",
            medic: uMedic._id,
          },
        ],
      });

      await expect(
        dndCrossDienstSameWeek(
          {
            sourceDienstId: String(d1._id),
            sourceDate: "2035-01-08",
            targetDienstId: String(d2._id),
            targetDate: "2035-01-08",
            role: "driver",
            userId: String(uDriver._id),
          },
          co,
        ),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "insufficient_rest",
      });

      await Dienst.deleteMany({ dienstNumber: { $in: [94324, 94325] } });
      await User.deleteMany({ _id: { $in: [uDriver._id, uMedic._id] } });
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

    it("encuentra Dienst con weekStartDate anclado Berlin (estilo generate-week)", async () => {
      const co = new mongoose.Types.ObjectId().toString();
      const weekStartISO = "2035-04-07";
      const { start } = getWeekMongoDateRange(weekStartISO);
      const pw = await hashPw();
      const u = await User.create({
        name: "Med",
        lastName: "Berlin",
        email: `med-berlin-${Date.now()}@assign-user.test`,
        password: pw,
        role: "worker",
        companyId: new mongoose.Types.ObjectId(co),
        ambulanceRole: "medic",
      });
      const d = await Dienst.create({
        dienstNumber: 93132,
        weekStartDate: start,
        weekEndDate: new Date("2035-04-13"),
        assignments: [
          { date: "2035-04-07", startTime: "08:00", endTime: "16:00" },
          { date: "2035-04-08", startTime: "08:00", endTime: "16:00" },
        ],
        companyId: new mongoose.Types.ObjectId(co),
      });

      const out = await assignUserToWeek(
        {
          dienstNumber: 93132,
          weekStartDate: weekStartISO,
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

  describe("assignUserToWeek (descanso mínimo)", () => {
    it("asignación semanal sin minimumRestWarning cuando no hay vecino conflictivo", async () => {
      const coOid = new mongoose.Types.ObjectId();
      const co = coOid.toString();
      const uDriver = await User.create({
        name: "A",
        lastName: "U1",
        email: `auw-a-${Date.now()}@test.local`,
        password: await hashPw(),
        role: "worker",
        ambulanceRole: "driver",
        companyId: coOid,
        pscheinExpiry: "2040-12-31",
        pscheinConfirmedAt: new Date("2030-01-01"),
      });
      const uMedic = await User.create({
        name: "A",
        lastName: "U2",
        email: `auw-a2-${Date.now()}@test.local`,
        password: await hashPw(),
        role: "worker",
        ambulanceRole: "medic",
        companyId: coOid,
      });

      await Dienst.create({
        dienstNumber: 94420,
        weekStartDate: new Date("2035-01-07"),
        weekEndDate: new Date("2035-01-13"),
        companyId: coOid,
        assignments: [
          {
            date: "2035-01-08",
            startTime: "08:00",
            endTime: "16:00",
            medic: uMedic._id,
          },
        ],
      });

      const out = await assignUserToWeek(
        {
          dienstNumber: 94420,
          weekStartDate: "2035-01-07",
          userId: String(uDriver._id),
          role: "driver",
        },
        co,
      );
      expect(out.minimumRestWarning).toBeUndefined();

      await Dienst.deleteMany({ dienstNumber: 94420 });
      await User.deleteMany({ _id: { $in: [uDriver._id, uMedic._id] } });
    });

    it("asignación semanal con aviso minimum_rest_soft (misma geometría que moveSlotSameWeek)", async () => {
      const coOid = new mongoose.Types.ObjectId();
      const co = coOid.toString();
      const uDriver = await User.create({
        name: "A",
        lastName: "V1",
        email: `auw-b-${Date.now()}@test.local`,
        password: await hashPw(),
        role: "worker",
        ambulanceRole: "driver",
        companyId: coOid,
        pscheinExpiry: "2040-12-31",
        pscheinConfirmedAt: new Date("2030-01-01"),
      });
      const uMedic = await User.create({
        name: "A",
        lastName: "V2",
        email: `auw-b2-${Date.now()}@test.local`,
        password: await hashPw(),
        role: "worker",
        ambulanceRole: "medic",
        companyId: coOid,
      });

      await Dienst.create({
        dienstNumber: 94421,
        weekStartDate: new Date("2035-01-07"),
        weekEndDate: new Date("2035-01-13"),
        companyId: coOid,
        assignments: [
          {
            date: "2035-01-07",
            startTime: "22:00",
            endTime: "06:00",
            driver: uDriver._id,
            medic: uMedic._id,
          },
          {
            date: "2035-01-08",
            startTime: "16:00",
            endTime: "20:00",
            medic: uMedic._id,
          },
        ],
      });

      const out = await assignUserToWeek(
        {
          dienstNumber: 94421,
          weekStartDate: "2035-01-07",
          userId: String(uDriver._id),
          role: "driver",
        },
        co,
      );
      expect(out.minimumRestWarning?.code).toBe("minimum_rest_soft");

      await Dienst.deleteMany({ dienstNumber: 94421 });
      await User.deleteMany({ _id: { $in: [uDriver._id, uMedic._id] } });
    });

    it("omite días con <10 h y asigna el resto (éxito parcial)", async () => {
      const coOid = new mongoose.Types.ObjectId();
      const co = coOid.toString();
      const uDriver = await User.create({
        name: "A",
        lastName: "W1",
        email: `auw-c-${Date.now()}@test.local`,
        password: await hashPw(),
        role: "worker",
        ambulanceRole: "driver",
        companyId: coOid,
        pscheinExpiry: "2040-12-31",
        pscheinConfirmedAt: new Date("2030-01-01"),
      });
      const uMedic = await User.create({
        name: "A",
        lastName: "W2",
        email: `auw-c2-${Date.now()}@test.local`,
        password: await hashPw(),
        role: "worker",
        ambulanceRole: "medic",
        companyId: coOid,
      });

      await Dienst.create({
        dienstNumber: 94422,
        weekStartDate: new Date("2035-01-07"),
        weekEndDate: new Date("2035-01-13"),
        companyId: coOid,
        assignments: [
          {
            date: "2035-01-07",
            startTime: "22:00",
            endTime: "06:00",
            driver: uDriver._id,
            medic: uMedic._id,
          },
          {
            date: "2035-01-08",
            startTime: "07:00",
            endTime: "15:00",
            medic: uMedic._id,
          },
        ],
      });

      const out = await assignUserToWeek(
        {
          dienstNumber: 94422,
          weekStartDate: "2035-01-07",
          userId: String(uDriver._id),
          role: "driver",
        },
        co,
      );
      expect(out.updatedCount).toBe(1);
      expect(out.skippedByMinimumRest).toContain("2035-01-08");

      await Dienst.deleteMany({ dienstNumber: 94422 });
      await User.deleteMany({ _id: { $in: [uDriver._id, uMedic._id] } });
    });

    it("no_assignable_days si el único día elegible incumple descanso mínimo", async () => {
      const coOid = new mongoose.Types.ObjectId();
      const co = coOid.toString();
      const uDriver = await User.create({
        name: "A",
        lastName: "X1",
        email: `auw-d-${Date.now()}@test.local`,
        password: await hashPw(),
        role: "worker",
        ambulanceRole: "both",
        companyId: coOid,
        pscheinExpiry: "2040-12-31",
        pscheinConfirmedAt: new Date("2030-01-01"),
      });
      const uOther = await User.create({
        name: "A",
        lastName: "X2",
        email: `auw-d2-${Date.now()}@test.local`,
        password: await hashPw(),
        role: "worker",
        ambulanceRole: "driver",
        companyId: coOid,
        pscheinExpiry: "2040-12-31",
        pscheinConfirmedAt: new Date("2030-01-01"),
      });
      const uMedic = await User.create({
        name: "A",
        lastName: "X3",
        email: `auw-d3-${Date.now()}@test.local`,
        password: await hashPw(),
        role: "worker",
        ambulanceRole: "medic",
        companyId: coOid,
      });

      await Dienst.create({
        dienstNumber: 94423,
        weekStartDate: new Date("2035-01-07"),
        weekEndDate: new Date("2035-01-13"),
        companyId: coOid,
        assignments: [
          {
            date: "2035-01-07",
            startTime: "22:00",
            endTime: "06:00",
            driver: uOther._id,
            medic: uDriver._id,
          },
          {
            date: "2035-01-08",
            startTime: "07:00",
            endTime: "15:00",
            medic: uMedic._id,
          },
        ],
      });

      await expect(
        assignUserToWeek(
          {
            dienstNumber: 94423,
            weekStartDate: "2035-01-07",
            userId: String(uDriver._id),
            role: "driver",
          },
          co,
        ),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "no_assignable_days_minimum_rest",
      });

      await Dienst.deleteMany({ dienstNumber: 94423 });
      await User.deleteMany({
        _id: { $in: [uDriver._id, uOther._id, uMedic._id] },
      });
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
        companyId: new mongoose.Types.ObjectId(co),
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
        companyId: new mongoose.Types.ObjectId(co),
      });
      const d = await Dienst.create({
        dienstNumber: 93141,
        weekStartDate: new Date("2035-04-14"),
        weekEndDate: new Date("2035-04-20"),
        assignments: [
          { date: "2035-04-15", startTime: "08:00", endTime: "16:00" },
        ],
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
      expect(out.updatedCount).toBeGreaterThan(0);
      await Team.deleteOne({ _id: team._id });
      await User.deleteMany({ _id: { $in: [driver._id, medic._id] } });
      await Dienst.deleteOne({ _id: d._id });
    });

    it("encuentra Dienst con weekStartDate anclado Berlin (estilo generate-week)", async () => {
      const co = new mongoose.Types.ObjectId().toString();
      const weekStartISO = "2035-04-21";
      const { start } = getWeekMongoDateRange(weekStartISO);
      const pw = await hashPw();
      const driver = await User.create({
        name: "D",
        lastName: "Berlin",
        email: `drv-berlin-${Date.now()}@team.test`,
        password: pw,
        role: "worker",
        companyId: new mongoose.Types.ObjectId(co),
        ambulanceRole: "driver",
        pscheinExpiry: "2040-12-31",
        pscheinConfirmedAt: new Date(),
      });
      const medic = await User.create({
        name: "M",
        lastName: "Berlin",
        email: `med-berlin-${Date.now()}@team.test`,
        password: pw,
        role: "worker",
        companyId: new mongoose.Types.ObjectId(co),
        ambulanceRole: "medic",
      });
      const team = await Team.create({
        driver: driver._id,
        medic: medic._id,
        rotationMode: "none",
        companyId: new mongoose.Types.ObjectId(co),
      });
      const d = await Dienst.create({
        dienstNumber: 93142,
        weekStartDate: start,
        weekEndDate: new Date("2035-04-27"),
        assignments: [
          { date: "2035-04-21", startTime: "08:00", endTime: "16:00" },
        ],
        companyId: new mongoose.Types.ObjectId(co),
      });
      const out = await assignTeamToWeek(
        {
          dienstNumber: 93142,
          weekStartDate: weekStartISO,
          teamId: String(team._id),
        },
        co,
      );
      expect(out.dienstId).toBe(String(d._id));
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
        companyId: new mongoose.Types.ObjectId(coB),
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

  describe("assignTeamToWeek (descanso mínimo, roles independientes)", () => {
    it("asigna todos los días elegibles sin aviso cuando no hay conflicto de descanso", async () => {
      const coOid = new mongoose.Types.ObjectId();
      const co = coOid.toString();
      const driver = await User.create({
        name: "TD",
        lastName: "1",
        email: `atw-full-${Date.now()}@test.local`,
        password: await hashPw(),
        role: "worker",
        companyId: coOid,
        ambulanceRole: "driver",
        pscheinExpiry: "2040-12-31",
        pscheinConfirmedAt: new Date("2030-01-01"),
      });
      const medic = await User.create({
        name: "TM",
        lastName: "1",
        email: `atw-fullm-${Date.now()}@test.local`,
        password: await hashPw(),
        role: "worker",
        companyId: coOid,
        ambulanceRole: "medic",
      });
      const team = await Team.create({
        driver: driver._id,
        medic: medic._id,
        rotationMode: "none",
        companyId: coOid,
      });
      await Dienst.create({
        dienstNumber: 94510,
        weekStartDate: new Date("2035-02-04"),
        weekEndDate: new Date("2035-02-10"),
        companyId: coOid,
        assignments: [
          {
            date: "2035-02-05",
            startTime: "08:00",
            endTime: "16:00",
          },
          {
            date: "2035-02-06",
            startTime: "09:00",
            endTime: "17:00",
          },
        ],
      });
      const out = await assignTeamToWeek(
        {
          dienstNumber: 94510,
          weekStartDate: "2035-02-04",
          teamId: String(team._id),
        },
        co,
      );
      expect(out.updatedCount).toBe(2);
      expect(out.daysAssignedFull?.length ?? 0).toBe(2);
      expect(out.skippedByMinimumRest?.length ?? 0).toBe(0);
      expect(out.minimumRestWarning).toBeUndefined();

      await Dienst.deleteMany({ dienstNumber: 94510 });
      await Team.deleteOne({ _id: team._id });
      await User.deleteMany({ _id: { $in: [driver._id, medic._id] } });
    });

    it("omite el día completo si menos de 10 h y asigna el resto (parcial)", async () => {
      const coOid = new mongoose.Types.ObjectId();
      const co = coOid.toString();
      const uDriver = await User.create({
        name: "A",
        lastName: "P1",
        email: `atw-p-${Date.now()}@test.local`,
        password: await hashPw(),
        role: "worker",
        ambulanceRole: "driver",
        companyId: coOid,
        pscheinExpiry: "2040-12-31",
        pscheinConfirmedAt: new Date("2030-01-01"),
      });
      const uMedic = await User.create({
        name: "A",
        lastName: "P2",
        email: `atw-p2-${Date.now()}@test.local`,
        password: await hashPw(),
        role: "worker",
        companyId: coOid,
        ambulanceRole: "medic",
      });
      const team = await Team.create({
        driver: uDriver._id,
        medic: uMedic._id,
        rotationMode: "none",
        companyId: coOid,
      });
      await Dienst.create({
        dienstNumber: 94511,
        weekStartDate: new Date("2035-01-07"),
        weekEndDate: new Date("2035-01-13"),
        companyId: coOid,
        assignments: [
          {
            date: "2035-01-07",
            startTime: "22:00",
            endTime: "06:00",
            driver: uDriver._id,
            medic: uMedic._id,
          },
          {
            date: "2035-01-08",
            startTime: "07:00",
            endTime: "15:00",
          },
        ],
      });
      const out = await assignTeamToWeek(
        {
          dienstNumber: 94511,
          weekStartDate: "2035-01-07",
          teamId: String(team._id),
        },
        co,
      );
      expect(out.updatedCount).toBe(1);
      expect(out.daysAssignedFull).toContain("2035-01-07");
      expect(out.skippedByMinimumRest).toContain("2035-01-08");

      await Dienst.deleteMany({ dienstNumber: 94511 });
      await Team.deleteOne({ _id: team._id });
      await User.deleteMany({ _id: { $in: [uDriver._id, uMedic._id] } });
    });

    it("asigna solo conductor si el sanitario no puede por descanso (otro rol puede pasar)", async () => {
      const coOid = new mongoose.Types.ObjectId();
      const co = coOid.toString();
      const uOther = await User.create({
        name: "O",
        lastName: "X",
        email: `atw-z0-${Date.now()}@test.local`,
        password: await hashPw(),
        role: "worker",
        ambulanceRole: "driver",
        companyId: coOid,
        pscheinExpiry: "2040-12-31",
        pscheinConfirmedAt: new Date("2030-01-01"),
      });
      const uTeamDriver = await User.create({
        name: "TD",
        lastName: "Z",
        email: `atw-zd-${Date.now()}@test.local`,
        password: await hashPw(),
        role: "worker",
        ambulanceRole: "driver",
        companyId: coOid,
        pscheinExpiry: "2040-12-31",
        pscheinConfirmedAt: new Date("2030-01-01"),
      });
      const uTeamMedic = await User.create({
        name: "TM",
        lastName: "Z",
        email: `atw-zm-${Date.now()}@test.local`,
        password: await hashPw(),
        role: "worker",
        companyId: coOid,
        ambulanceRole: "medic",
      });
      const team = await Team.create({
        driver: uTeamDriver._id,
        medic: uTeamMedic._id,
        rotationMode: "none",
        companyId: coOid,
      });
      await Dienst.create({
        dienstNumber: 94512,
        weekStartDate: new Date("2035-01-07"),
        weekEndDate: new Date("2035-01-13"),
        companyId: coOid,
        assignments: [
          {
            date: "2035-01-07",
            startTime: "22:00",
            endTime: "06:00",
            driver: uOther._id,
            medic: uTeamDriver._id,
          },
          {
            date: "2035-01-08",
            startTime: "07:00",
            endTime: "15:00",
          },
        ],
      });

      const out = await assignTeamToWeek(
        {
          dienstNumber: 94512,
          weekStartDate: "2035-01-07",
          teamId: String(team._id),
        },
        co,
      );
      expect(out.updatedCount).toBeGreaterThanOrEqual(1);
      expect(out.daysAssignedDriverOnly).toContain("2035-01-08");
      expect(
        (out.skippedByMinimumRestRoles ?? []).some(
          (r) => r.date === "2035-01-08" && r.role === "medic",
        ),
      ).toBe(true);

      await Dienst.deleteMany({ dienstNumber: 94512 });
      await Team.deleteOne({ _id: team._id });
      await User.deleteMany({
        _id: { $in: [uOther._id, uTeamDriver._id, uTeamMedic._id] },
      });
    });

    it("solo sanitario cuando el conductor está bloqueado por rol opuesto en la fila", async () => {
      const coOid = new mongoose.Types.ObjectId();
      const co = coOid.toString();
      const uTeamDriver = await User.create({
        name: "TD",
        lastName: "Mo",
        email: `atw-mo-${Date.now()}@test.local`,
        password: await hashPw(),
        role: "worker",
        ambulanceRole: "driver",
        companyId: coOid,
        pscheinExpiry: "2040-12-31",
        pscheinConfirmedAt: new Date("2030-01-01"),
      });
      const uTeamMedic = await User.create({
        name: "TM",
        lastName: "Mo",
        email: `atw-mo2-${Date.now()}@test.local`,
        password: await hashPw(),
        role: "worker",
        companyId: coOid,
        ambulanceRole: "medic",
      });
      const team = await Team.create({
        driver: uTeamDriver._id,
        medic: uTeamMedic._id,
        rotationMode: "none",
        companyId: coOid,
      });
      await Dienst.create({
        dienstNumber: 94514,
        weekStartDate: new Date("2035-03-04"),
        weekEndDate: new Date("2035-03-10"),
        companyId: coOid,
        assignments: [
          {
            date: "2035-03-05",
            startTime: "08:00",
            endTime: "16:00",
            medic: uTeamDriver._id,
          },
        ],
      });
      const out = await assignTeamToWeek(
        {
          dienstNumber: 94514,
          weekStartDate: "2035-03-04",
          teamId: String(team._id),
        },
        co,
      );
      expect(out.daysAssignedMedicOnly).toContain("2035-03-05");
      expect(out.daysAssignedFull?.length ?? 0).toBe(0);

      await Dienst.deleteMany({ dienstNumber: 94514 });
      await Team.deleteOne({ _id: team._id });
      await User.deleteMany({ _id: { $in: [uTeamDriver._id, uTeamMedic._id] } });
    });
  });

  describe("findWeeklyConflicts (tenant scope)", () => {
    it("no incluye Dienst de otra empresa en la misma semana", async () => {
      const coA = new mongoose.Types.ObjectId().toString();
      const coB = new mongoose.Types.ObjectId().toString();
      const uB = await User.create({
        name: "A",
        lastName: "B",
        email: `fwc-isol-${Date.now()}@test.local`,
        password: await hashPw(),
        role: "worker",
        ambulanceRole: "driver",
        companyId: new mongoose.Types.ObjectId(coB),
        pscheinExpiry: "2040-12-31",
        pscheinConfirmedAt: new Date("2030-01-01"),
      });
      const weekStart = new Date("2035-07-01");
      await Dienst.create({
        dienstNumber: 932001,
        weekStartDate: weekStart,
        weekEndDate: new Date("2035-07-07"),
        companyId: new mongoose.Types.ObjectId(coB),
        assignments: [
          {
            date: "2035-07-02",
            startTime: "08:00",
            endTime: "16:00",
            driver: uB._id,
          },
        ],
      });
      const out = await findWeeklyConflicts(
        new mongoose.Types.ObjectId(String(uB._id)),
        weekStart,
        coA,
      );
      expect(out).toEqual([]);
      await Dienst.deleteMany({ dienstNumber: 932001 });
      await User.deleteOne({ _id: uB._id });
    });

    it("excluye Dienst con companyId null", async () => {
      const coOid = new mongoose.Types.ObjectId();
      const coA = coOid.toString();
      const u = await User.create({
        name: "L",
        lastName: "G",
        email: `fwc-null-${Date.now()}@test.local`,
        password: await hashPw(),
        role: "worker",
        ambulanceRole: "driver",
        companyId: coOid,
        pscheinExpiry: "2040-12-31",
        pscheinConfirmedAt: new Date("2030-01-01"),
      });
      const weekStart = new Date("2035-08-05");
      await Dienst.create({
        dienstNumber: 932002,
        weekStartDate: weekStart,
        weekEndDate: new Date("2035-08-11"),
        companyId: null,
        assignments: [
          {
            date: "2035-08-06",
            startTime: "08:00",
            endTime: "16:00",
            driver: u._id,
          },
        ],
      });
      const out = await findWeeklyConflicts(
        new mongoose.Types.ObjectId(String(u._id)),
        weekStart,
        coA,
      );
      expect(out).toEqual([]);
      await Dienst.deleteMany({ dienstNumber: 932002 });
      await User.deleteOne({ _id: u._id });
    });
  });

  describe("assignAmbulanceToWeek", () => {
    it("encuentra Dienst con weekStartDate anclado Berlin (estilo generate-week)", async () => {
      const coOid = new mongoose.Types.ObjectId();
      const co = coOid.toString();
      await Company.create({
        _id: coOid,
        name: `Amb Co ${Date.now()}`,
        emailDomain: "@example.com",
        isActive: true,
        enabledModules: [MODULE_KEYS.SCHEDULING, MODULE_KEYS.AMBULANCES],
      });
      const weekStartISO = "2035-05-19";
      const { start } = getWeekMongoDateRange(weekStartISO);
      const amb = await Ambulance.create({
        brand: "Test",
        modelName: "Box",
        licensePlate: `PLT-${Date.now()}`,
        ambulanceNumber: `A-${Date.now()}`,
        companyId: coOid,
      });
      const d = await Dienst.create({
        dienstNumber: 93150,
        weekStartDate: start,
        weekEndDate: new Date("2035-05-25"),
        assignments: [
          { date: "2035-05-19", startTime: "08:00", endTime: "16:00" },
          { date: "2035-05-20", startTime: "08:00", endTime: "16:00" },
        ],
        companyId: coOid,
      });

      const spy = jest.spyOn(wsNotify, "voidEmitSchedulingMutationRealtime");

      const out = await assignAmbulanceToWeek(
        {
          dienstNumber: 93150,
          weekStartDate: weekStartISO,
          ambulanceId: String(amb._id),
        },
        co,
      );

      expect(out.dienstId).toBe(String(d._id));
      expect(out.updatedCount).toBeGreaterThan(0);
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();

      await Ambulance.deleteOne({ _id: amb._id });
      await Dienst.deleteOne({ _id: d._id });
      await Company.deleteOne({ _id: coOid });
    });

    it("no emite websocket cuando dienst_not_found", async () => {
      const coOid = new mongoose.Types.ObjectId();
      const co = coOid.toString();
      await Company.create({
        _id: coOid,
        name: `Amb Co 404 ${Date.now()}`,
        emailDomain: "@example.com",
        isActive: true,
        enabledModules: [MODULE_KEYS.SCHEDULING, MODULE_KEYS.AMBULANCES],
      });
      const spy = jest
        .spyOn(wsNotify, "voidEmitSchedulingMutationRealtime")
        .mockImplementation(() => {});
      await expect(
        assignAmbulanceToWeek(
          {
            dienstNumber: 99998,
            weekStartDate: "2035-05-26",
            ambulanceId: new mongoose.Types.ObjectId().toString(),
          },
          co,
        ),
      ).rejects.toMatchObject({ statusCode: 404, code: "dienst_not_found" });
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
      await Company.deleteOne({ _id: coOid });
    });
  });
});
