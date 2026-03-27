/**
 * Contrato removeAssignment: exige companyId de caller y Dienst con companyId coincidente.
 */
import mongoose from "mongoose";
import { env } from "../config/env";
import Dienst from "../modules/diensts/models/dienst.model";
import { removeAssignment } from "../modules/diensts/assignments/services/assignments.service";

describe("assignments.service removeAssignment (company contract)", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("devuelve null si companyId del caller falta o está en blanco", async () => {
    const id = new mongoose.Types.ObjectId().toString();
    await expect(removeAssignment(id, "2031-01-01", undefined)).resolves.toBeNull();
    await expect(removeAssignment(id, "2031-01-01", null)).resolves.toBeNull();
    await expect(removeAssignment(id, "2031-01-01", "")).resolves.toBeNull();
    await expect(removeAssignment(id, "2031-01-01", "   ")).resolves.toBeNull();
  });

  it("devuelve null si el Dienst no existe (caller con empresa)", async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const co = new mongoose.Types.ObjectId().toString();
    await expect(removeAssignment(id, "2031-01-01", co)).resolves.toBeNull();
  });

  it("devuelve null para Dienst sin companyId aunque el caller tenga empresa", async () => {
    const legacy = await Dienst.create({
      dienstNumber: 92001,
      assignments: [
        { date: "2031-06-01", startTime: "08:00", endTime: "16:00" },
      ],
      companyId: null,
    });
    const callerCo = new mongoose.Types.ObjectId().toString();
    await expect(
      removeAssignment(String(legacy._id), "2031-06-01", callerCo),
    ).resolves.toBeNull();
    const still = await Dienst.findById(legacy._id).lean();
    expect(still?.assignments?.length).toBe(1);
    await Dienst.deleteOne({ _id: legacy._id });
  });

  it("elimina el assignment cuando companyId coincide", async () => {
    const co = new mongoose.Types.ObjectId().toString();
    const created = await Dienst.create({
      dienstNumber: 92002,
      assignments: [
        { date: "2031-06-02", startTime: "08:00", endTime: "16:00" },
      ],
      companyId: new mongoose.Types.ObjectId(co),
    });
    const id = String(created._id);
    const out = await removeAssignment(id, "2031-06-02", co);
    expect(out).not.toBeNull();
    const after = await Dienst.findById(id).lean();
    expect(after?.assignments?.some((a) => a.date === "2031-06-02")).toBe(false);
    await Dienst.deleteOne({ _id: created._id });
  });

  it("devuelve null si companyId del caller no coincide con el del Dienst", async () => {
    const coA = new mongoose.Types.ObjectId().toString();
    const coB = new mongoose.Types.ObjectId().toString();
    const created = await Dienst.create({
      dienstNumber: 92003,
      assignments: [
        { date: "2031-06-03", startTime: "08:00", endTime: "16:00" },
      ],
      companyId: new mongoose.Types.ObjectId(coA),
    });
    await expect(
      removeAssignment(String(created._id), "2031-06-03", coB),
    ).resolves.toBeNull();
    const still = await Dienst.findById(created._id).lean();
    expect(still?.assignments?.length).toBe(1);
    await Dienst.deleteOne({ _id: created._id });
  });
});
