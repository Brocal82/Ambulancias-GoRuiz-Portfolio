/**
 * Contrato del servicio de teams: operaciones orientadas a tenant exigen companyId.
 */
import mongoose from "mongoose";
import { env } from "../config/env";
import * as teamsService from "../modules/teams/services/teams.service";
import { TeamError } from "../modules/teams/services/teams.service";

describe("teams.service company contract", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("listTeams rechaza companyId ausente o vacío (403)", async () => {
    await expect(teamsService.listTeams(undefined)).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringContaining("empresa"),
    });
    await expect(teamsService.listTeams("")).rejects.toBeInstanceOf(TeamError);
    await expect(teamsService.listTeams("   ")).rejects.toBeInstanceOf(TeamError);
  });

  it("getUsedTeamsForWeek rechaza companyId ausente o vacío tras validar fecha (403)", async () => {
    await expect(
      teamsService.getUsedTeamsForWeek("2030-01-06", undefined),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringContaining("empresa"),
    });
    await expect(
      teamsService.getUsedTeamsForWeek("2030-01-06", ""),
    ).rejects.toBeInstanceOf(TeamError);
  });

  it("createTeam rechaza companyId ausente antes del resto de validación (403)", async () => {
    await expect(
      teamsService.createTeam(
        { driver: "x", medic: "y", rotationMode: "none" },
        undefined,
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringContaining("empresa"),
    });
  });

  it("updateTeam rechaza companyId ausente (403)", async () => {
    const id = new mongoose.Types.ObjectId().toString();
    await expect(
      teamsService.updateTeam(
        id,
        {
          driver: new mongoose.Types.ObjectId().toString(),
          medic: new mongoose.Types.ObjectId().toString(),
          rotationMode: "none",
        },
        undefined,
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringContaining("empresa"),
    });
  });

  it("deleteTeam rechaza companyId ausente (403)", async () => {
    const id = new mongoose.Types.ObjectId().toString();
    await expect(teamsService.deleteTeam(id, undefined)).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringContaining("empresa"),
    });
  });

  it("createTeam rechaza driver con rol medic (400)", async () => {
    const companyId = new mongoose.Types.ObjectId().toString();
    const driverId = new mongoose.Types.ObjectId().toString();
    const medicId = new mongoose.Types.ObjectId().toString();

    const User = (await import("../modules/users/models/user.model")).default;
    await User.create({
      name: "D",
      lastName: "MedicOnly",
      email: `drv-med-${Date.now()}@test.local`,
      password: "hashed",
      role: "worker",
      companyId: new mongoose.Types.ObjectId(companyId),
      ambulanceRole: "medic",
    });
    await User.create({
      name: "M",
      lastName: "Both",
      email: `med-both-${Date.now()}@test.local`,
      password: "hashed",
      role: "worker",
      companyId: new mongoose.Types.ObjectId(companyId),
      ambulanceRole: "both",
    });

    const users = await User.find({
      companyId: new mongoose.Types.ObjectId(companyId),
    })
      .select("_id ambulanceRole")
      .lean();
    const medicOnly = users.find((u) => u.ambulanceRole === "medic");
    const bothUser = users.find((u) => u.ambulanceRole === "both");
    if (!medicOnly || !bothUser) {
      throw new Error("test setup failed");
    }

    await expect(
      teamsService.createTeam(
        {
          driver: String(medicOnly._id),
          medic: String(bothUser._id),
          rotationMode: "none",
        },
        companyId,
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringMatching(/conductor|driver|both/i),
    });

    await User.deleteMany({
      _id: { $in: [medicOnly._id, bothUser._id] },
    });
  });
});
