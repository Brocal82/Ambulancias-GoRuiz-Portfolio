/**
 * Contrato: getDienstById acota por companyId en servicio (defensa en profundidad).
 */
import mongoose from "mongoose";
import { env } from "../config/env";
import Dienst from "../modules/diensts/models/dienst.model";
import { getDienstById } from "../modules/diensts/calendar/services/calendar.service";
/** Registro de modelos para populate en getDienstById */
import "../modules/users/models/user.model";
import "../modules/ambulances/models/ambulance.model";

describe("calendar.service getDienstById (tenant scope)", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("devuelve null si companyId no coincide con el Dienst", async () => {
    const coA = new mongoose.Types.ObjectId();
    const coB = new mongoose.Types.ObjectId();
    const d = await Dienst.create({
      dienstNumber: 932101,
      weekStartDate: new Date("2035-01-07"),
      weekEndDate: new Date("2035-01-13"),
      companyId: coB,
      assignments: [
        { date: "2035-01-08", startTime: "08:00", endTime: "16:00" },
      ],
    });
    const out = await getDienstById(String(d._id), coA.toString());
    expect(out).toBeNull();
    await Dienst.deleteOne({ _id: d._id });
  });

  it("devuelve el documento cuando companyId coincide", async () => {
    const coA = new mongoose.Types.ObjectId();
    const d = await Dienst.create({
      dienstNumber: 932102,
      weekStartDate: new Date("2035-01-07"),
      weekEndDate: new Date("2035-01-13"),
      companyId: coA,
      assignments: [
        { date: "2035-01-08", startTime: "08:00", endTime: "16:00" },
      ],
    });
    const out = await getDienstById(String(d._id), coA.toString());
    expect(out).not.toBeNull();
    expect(String((out as { _id?: unknown })._id)).toBe(String(d._id));
    await Dienst.deleteOne({ _id: d._id });
  });

  it("devuelve null para Dienst legacy con companyId null", async () => {
    const d = await Dienst.create({
      dienstNumber: 932103,
      weekStartDate: new Date("2035-01-07"),
      weekEndDate: new Date("2035-01-13"),
      companyId: null,
      assignments: [
        { date: "2035-01-08", startTime: "08:00", endTime: "16:00" },
      ],
    });
    const co = new mongoose.Types.ObjectId().toString();
    const out = await getDienstById(String(d._id), co);
    expect(out).toBeNull();
    await Dienst.deleteOne({ _id: d._id });
  });

  it("devuelve null si companyId no es válido o no se pasa", async () => {
    const coA = new mongoose.Types.ObjectId();
    const d = await Dienst.create({
      dienstNumber: 932104,
      weekStartDate: new Date("2035-01-07"),
      weekEndDate: new Date("2035-01-13"),
      companyId: coA,
      assignments: [
        { date: "2035-01-08", startTime: "08:00", endTime: "16:00" },
      ],
    });
    expect(await getDienstById(String(d._id), "")).toBeNull();
    expect(await getDienstById(String(d._id), null)).toBeNull();
    expect(await getDienstById(String(d._id), undefined)).toBeNull();
    await Dienst.deleteOne({ _id: d._id });
  });
});
