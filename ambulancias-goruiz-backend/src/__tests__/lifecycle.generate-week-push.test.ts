/**
 * Push notifications after generate-week (lifecycle.service).
 */
import mongoose from "mongoose";
import { MODULE_KEYS } from "../modules/companies/constants/modules.constants";
import * as notifications from "../modules/notifications";
import * as wsNotify from "../modules/notifications/utils/ws-notify";
import {
  generateDienstTemplatesForWeek,
  notifyGeneratedWeekAssignedWorkers,
} from "../modules/diensts/templates/services/lifecycle.service";

const mockDienstFind = jest.fn();
const mockInsertMany = jest.fn();
const mockTemplateFind = jest.fn();
const mockTeamFind = jest.fn();
const mockComputeAbsence = jest.fn();
const mockDriverEligible = jest.fn();
const mockCompanyHasModule = jest.fn();

jest.mock("../modules/diensts/models/dienst.model", () => ({
  __esModule: true,
  default: {
    find: (...args: unknown[]) => mockDienstFind(...args),
    insertMany: (...args: unknown[]) => mockInsertMany(...args),
  },
}));

jest.mock("../modules/dienst-templates/models", () => ({
  DienstTemplate: {
    find: (...args: unknown[]) => mockTemplateFind(...args),
  },
}));

jest.mock("../modules/teams", () => ({
  Team: {
    find: (...args: unknown[]) => mockTeamFind(...args),
  },
}));

jest.mock("../modules/diensts/utils/dienstValidation", () => ({
  computeTeamDayAbsenceData: (...args: unknown[]) => mockComputeAbsence(...args),
  isDriverEligibleForAssignmentDate: (...args: unknown[]) =>
    mockDriverEligible(...args),
}));

jest.mock("../utils/companyEnabledModules", () => ({
  companyHasEnabledModule: (...args: unknown[]) => mockCompanyHasModule(...args),
}));

function chainLean<T>(value: T) {
  return {
    sort: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(value),
  };
}

function fixedTeam(driverId: mongoose.Types.ObjectId, medicId: mongoose.Types.ObjectId) {
  return {
    _id: new mongoose.Types.ObjectId(),
    rotationMode: "fixed",
    fixedDienstNumber: 1,
    driver: { _id: driverId, name: "A", lastName: "Driver", ambulanceRole: "driver" },
    medic: { _id: medicId, name: "B", lastName: "Medic", ambulanceRole: "medic" },
    ambulanceId: null,
  };
}

describe("notifyGeneratedWeekAssignedWorkers", () => {
  let pushSpy: jest.SpyInstance;

  beforeEach(() => {
    pushSpy = jest
      .spyOn(notifications, "sendPushNotification")
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("sends one push call with deduped worker ids and scheduling module gating", () => {
    const companyId = new mongoose.Types.ObjectId().toString();
    notifyGeneratedWeekAssignedWorkers(companyId, "2030-01-06", [
      "worker-a",
      "worker-a",
      "worker-b",
    ]);

    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy).toHaveBeenCalledWith(
      ["worker-a", "worker-b"],
      "Nueva semana de turnos",
      "Se han generado nuevas asignaciones en tu agenda para la semana del 2030-01-06.",
      { screen: "agenda", date: "2030-01-06" },
      { moduleKey: MODULE_KEYS.SCHEDULING, actingCompanyId: companyId },
    );
  });

  it("does not send push when there are no workers", () => {
    notifyGeneratedWeekAssignedWorkers("co", "2030-01-06", []);
    expect(pushSpy).not.toHaveBeenCalled();
  });
});

describe("generateDienstTemplatesForWeek push + websocket", () => {
  const companyId = new mongoose.Types.ObjectId().toString();
  const weekStart = "2030-01-06";
  let pushSpy: jest.SpyInstance;
  let wsSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    pushSpy = jest
      .spyOn(notifications, "sendPushNotification")
      .mockResolvedValue(undefined);
    wsSpy = jest
      .spyOn(wsNotify, "voidEmitSchedulingMutationRealtime")
      .mockImplementation(() => undefined);

    mockDienstFind.mockImplementation(() => chainLean([]));
    mockInsertMany.mockResolvedValue([]);
    mockTemplateFind.mockImplementation(() =>
      chainLean([
        {
          dienstNumber: 1,
          startTime: "08:00",
          endTime: "16:00",
          daysOff: [],
        },
      ]),
    );
    mockComputeAbsence.mockResolvedValue({ blockMap: {}, reasonByDate: {} });
    mockDriverEligible.mockReturnValue(true);
    mockCompanyHasModule.mockResolvedValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("fixed team: one push per assigned driver and medic", async () => {
    const driverId = new mongoose.Types.ObjectId();
    const medicId = new mongoose.Types.ObjectId();
    mockTeamFind.mockImplementation(() => chainLean([fixedTeam(driverId, medicId)]));

    await generateDienstTemplatesForWeek(weekStart, companyId);

    expect(mockInsertMany).toHaveBeenCalledTimes(1);
    expect(pushSpy).toHaveBeenCalledTimes(1);
    const recipientIds = pushSpy.mock.calls[0][0] as string[];
    expect(recipientIds).toHaveLength(2);
    expect(recipientIds).toEqual(
      expect.arrayContaining([driverId.toString(), medicId.toString()]),
    );
    expect(wsSpy).toHaveBeenCalledTimes(1);
    const wsWorkers = wsSpy.mock.calls[0][1] as Set<string>;
    expect(wsWorkers.has(driverId.toString())).toBe(true);
    expect(wsWorkers.has(medicId.toString())).toBe(true);
  });

  it("same worker on multiple days still receives one push", async () => {
    const driverId = new mongoose.Types.ObjectId();
    const medicId = new mongoose.Types.ObjectId();
    mockTeamFind.mockImplementation(() => chainLean([fixedTeam(driverId, medicId)]));

    await generateDienstTemplatesForWeek(weekStart, companyId);

    const recipientIds = pushSpy.mock.calls[0][0] as string[];
    expect(new Set(recipientIds).size).toBe(2);
  });

  it("rotating team assignment still notifies only actually assigned workers", async () => {
    const driverId = new mongoose.Types.ObjectId();
    const medicId = new mongoose.Types.ObjectId();
    const rotatingTeam = {
      _id: new mongoose.Types.ObjectId(),
      rotationMode: "rotating",
      fixedDienstNumber: null,
      driver: { _id: driverId, name: "R", lastName: "Drv", ambulanceRole: "driver" },
      medic: { _id: medicId, name: "R", lastName: "Med", ambulanceRole: "medic" },
      ambulanceId: null,
      createdAt: new Date(),
    };

    mockTemplateFind.mockImplementation(() =>
      chainLean([
        { dienstNumber: 1, startTime: "08:00", endTime: "16:00", daysOff: [] },
        { dienstNumber: 2, startTime: "08:00", endTime: "16:00", daysOff: [] },
      ]),
    );

    const prevWeekDienst = {
      dienstNumber: 1,
      weekTeamId: rotatingTeam._id,
      assignments: [
        {
          driver: driverId,
          medic: medicId,
          date: "2029-12-30",
        },
      ],
    };

    let findCall = 0;
    mockDienstFind.mockImplementation(() => {
      findCall += 1;
      if (findCall === 1) return chainLean([]);
      return chainLean([prevWeekDienst]);
    });

    mockTeamFind.mockImplementation(() => chainLean([rotatingTeam]));

    await generateDienstTemplatesForWeek(weekStart, companyId);

    expect(pushSpy).toHaveBeenCalledTimes(1);
    const recipientIds = pushSpy.mock.calls[0][0] as string[];
    expect(recipientIds).toEqual(
      expect.arrayContaining([driverId.toString(), medicId.toString()]),
    );
  });

  it("does not push when no workers are assigned (empty team slots)", async () => {
    mockTeamFind.mockImplementation(() => chainLean([]));

    await generateDienstTemplatesForWeek(weekStart, companyId);

    expect(mockInsertMany).toHaveBeenCalledTimes(1);
    expect(pushSpy).not.toHaveBeenCalled();
    expect(wsSpy).toHaveBeenCalledWith(companyId, expect.any(Set));
    expect((wsSpy.mock.calls[0][1] as Set<string>).size).toBe(0);
  });

  it("does not push when insertMany fails", async () => {
    const driverId = new mongoose.Types.ObjectId();
    const medicId = new mongoose.Types.ObjectId();
    mockTeamFind.mockImplementation(() => chainLean([fixedTeam(driverId, medicId)]));
    mockInsertMany.mockRejectedValueOnce(new Error("insert failed"));

    await expect(
      generateDienstTemplatesForWeek(weekStart, companyId),
    ).rejects.toThrow("insert failed");

    expect(pushSpy).not.toHaveBeenCalled();
    expect(wsSpy).not.toHaveBeenCalled();
  });

  it("does not push workers blocked by absence or invalid P-Schein", async () => {
    const driverId = new mongoose.Types.ObjectId();
    const medicId = new mongoose.Types.ObjectId();
    mockTeamFind.mockImplementation(() => chainLean([fixedTeam(driverId, medicId)]));

    mockComputeAbsence.mockResolvedValue({
      blockMap: {
        "2030-01-06": { driver: true, medic: true },
        "2030-01-07": { driver: true, medic: true },
        "2030-01-08": { driver: true, medic: true },
        "2030-01-09": { driver: true, medic: true },
        "2030-01-10": { driver: true, medic: true },
        "2030-01-11": { driver: true, medic: true },
        "2030-01-12": { driver: true, medic: true },
      },
      reasonByDate: {},
    });
    mockDriverEligible.mockReturnValue(false);

    await generateDienstTemplatesForWeek(weekStart, companyId);

    expect(pushSpy).not.toHaveBeenCalled();
    expect((wsSpy.mock.calls[0][1] as Set<string>).size).toBe(0);
  });
});
