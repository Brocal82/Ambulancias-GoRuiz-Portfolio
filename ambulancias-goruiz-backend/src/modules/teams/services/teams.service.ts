import mongoose from "mongoose";
import { Team } from "../models/team.model";
import User from "../../users/models/user.model";
import Dienst from "../../diensts/models/dienst.model";
import VacationRequest from "../../vacation/models/vacation-request.model";
import { DateTime } from "luxon";
import { Ambulance } from "../../ambulances";
import { MODULE_KEYS } from "../../companies/constants/modules.constants";
import { companyHasEnabledModule } from "../../../utils/companyEnabledModules";
import { entitiesBelongToSameCompany } from "../../../utils/requireCompany";
import { isAmbulanceRoleValidForSlot } from "../../diensts/utils/dienstValidation";
import {
  findTeamReferences,
  TeamInUseError,
} from "../utils/teamReferences";

/** Error con código HTTP para mapeo en controller */
export class TeamError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = "TeamError";
  }
}

const ZONE = "Europe/Berlin";

const isObjectId = (s: unknown) =>
  typeof s === "string" && mongoose.Types.ObjectId.isValid(s);

async function getTodayVacationInfo(userId?: mongoose.Types.ObjectId | string | null) {
  if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
    return {
      isOnVacation: false as const,
      vacationUntil: undefined as string | undefined,
    };
  }

  const now = DateTime.now().setZone(ZONE);
  const startOfToday = now.startOf("day").toJSDate();
  const endOfToday = now.endOf("day").toJSDate();

  const vac = await VacationRequest.findOne({
    user: userId,
    status: "accepted",
    startDate: { $lte: endOfToday },
    endDate: { $gte: startOfToday },
  })
    .select("endDate")
    .lean();

  if (!vac) {
    return { isOnVacation: false as const, vacationUntil: undefined };
  }

  return {
    isOnVacation: true as const,
    vacationUntil: new Date(vac.endDate).toISOString(),
  };
}

/** Alineado con requireCompanyForAdmin: operaciones de teams requieren empresa. */
function assertCompanyIdForTeamOps(companyId?: string | null): asserts companyId is string {
  if (companyId == null || String(companyId).trim() === "") {
    throw new TeamError(
      "No tienes permiso. Se requiere pertenecer a una empresa.",
      403,
    );
  }
}

function assertTeamMemberAmbulanceRoles(
  driverUser: { ambulanceRole?: string },
  medicUser: { ambulanceRole?: string },
): void {
  const driverRole = driverUser.ambulanceRole as
    | "driver"
    | "medic"
    | "both"
    | undefined;
  const medicRole = medicUser.ambulanceRole as
    | "driver"
    | "medic"
    | "both"
    | undefined;
  if (!isAmbulanceRoleValidForSlot(driverRole, "driver")) {
    throw new TeamError(
      "El conductor debe tener rol de ambulancia driver o both",
      400,
    );
  }
  if (!isAmbulanceRoleValidForSlot(medicRole, "medic")) {
    throw new TeamError(
      "El sanitario debe tener rol de ambulancia medic o both",
      400,
    );
  }
}

export async function listTeams(companyId?: string | null) {
  assertCompanyIdForTeamOps(companyId);
  const companyOid = new mongoose.Types.ObjectId(companyId);

  const teams = await Team.find({ companyId: companyOid })
    .populate("driver", "name lastName ambulanceRole pscheinExpiry")
    .populate("medic", "name lastName ambulanceRole pscheinExpiry")
    .populate("ambulanceId", "ambulanceNumber brand modelName licensePlate")
    .lean();

  await Promise.all(
    teams.map(async (t: any) => {
      if (t?.driver?._id) {
        const info = await getTodayVacationInfo(t.driver._id);
        t.driver.isOnVacation = info.isOnVacation;
        t.driver.vacationUntil = info.vacationUntil;
      }
      if (t?.medic?._id) {
        const info = await getTodayVacationInfo(t.medic._id);
        t.medic.isOnVacation = info.isOnVacation;
        t.medic.vacationUntil = info.vacationUntil;
      }
    }),
  );

  const ambModuleOn = await companyHasEnabledModule(
    companyId,
    MODULE_KEYS.AMBULANCES,
  );
  if (!ambModuleOn) {
    for (const t of teams as { ambulanceId?: unknown }[]) {
      if ("ambulanceId" in t) delete t.ambulanceId;
    }
  }

  return teams;
}

export async function createTeam(
  body: {
    driver?: string;
    medic?: string;
    rotationMode?: "rotating" | "fixed" | "none";
    fixedDienstNumber?: number | string | null;
    ambulanceId?: string | null;
  },
  companyId?: string | null,
) {
  assertCompanyIdForTeamOps(companyId);
  const companyOid = new mongoose.Types.ObjectId(companyId);
  const { driver, medic, rotationMode, fixedDienstNumber, ambulanceId } = body;

  if (!isObjectId(driver) || !isObjectId(medic)) {
    throw new TeamError("driver y medic deben ser ObjectId válidos", 400);
  }
  if (driver === medic) {
    throw new TeamError("driver y medic no pueden ser la misma persona", 400);
  }

  const [driverUser, medicUser] = await Promise.all([
    User.findById(driver).select("companyId ambulanceRole").lean(),
    User.findById(medic).select("companyId ambulanceRole").lean(),
  ]);
  if (!driverUser || !medicUser) {
    throw new TeamError("Usuario driver o medic inexistente", 400);
  }
  assertTeamMemberAmbulanceRoles(
    driverUser as { ambulanceRole?: string },
    medicUser as { ambulanceRole?: string },
  );
  const drvCo = (driverUser as { companyId?: unknown }).companyId;
  const medCo = (medicUser as { companyId?: unknown }).companyId;
  if (!entitiesBelongToSameCompany(drvCo, medCo)) {
    throw new TeamError("driver y medic deben pertenecer a la misma empresa", 403);
  }
  const targetCo = String(companyId);
  if (!entitiesBelongToSameCompany(drvCo, targetCo)) {
    throw new TeamError("El equipo debe pertenecer a tu empresa", 403);
  }

  let normalizedAmbulanceId: string | null = null;
  const ambModuleOnCreate = await companyHasEnabledModule(
    targetCo,
    MODULE_KEYS.AMBULANCES,
  );
  if (ambulanceId) {
    if (!ambModuleOnCreate) {
      throw new TeamError(
        "El módulo de ambulancias no está habilitado para esta empresa.",
        403,
      );
    }
    if (!isObjectId(ambulanceId)) {
      throw new TeamError("ambulanceId debe ser un ObjectId válido", 400);
    }
    const amb = await Ambulance.findOne({
      _id: ambulanceId,
      companyId: companyOid,
    })
      .select("companyId")
      .lean();
    if (!amb) {
      throw new TeamError("Ambulancia no encontrada", 400);
    }
    normalizedAmbulanceId = ambulanceId;
  }

  let normalizedRotation: "rotating" | "fixed" | "none" = "rotating";
  if (
    rotationMode === "fixed" ||
    rotationMode === "none" ||
    rotationMode === "rotating"
  ) {
    normalizedRotation = rotationMode;
  }

  let normalizedFixedDienst: number | null = null;
  if (normalizedRotation === "fixed") {
    const num =
      typeof fixedDienstNumber === "string"
        ? Number(fixedDienstNumber)
        : fixedDienstNumber;

    if (!Number.isInteger(num) || num == null || num < 1) {
      throw new TeamError(
        'fixedDienstNumber debe ser un número entero ≥ 1 cuando rotationMode es "fixed"',
        400,
      );
    }
    normalizedFixedDienst = num;
  }

  const exists = await Team.findOne({ companyId: companyOid, driver, medic }).lean();
  if (exists) {
    throw new TeamError("Ya existe un team con esa pareja", 409);
  }

  const [driverConflict, medicConflict] = await Promise.all([
    Team.findOne({
      companyId: companyOid,
      $or: [{ driver }, { medic: driver }],
    }).lean(),
    Team.findOne({
      companyId: companyOid,
      $or: [{ driver: medic }, { medic }],
    }).lean(),
  ]);

  if (driverConflict) {
    throw new TeamError(
      "El conductor seleccionado ya pertenece a un equipo. Elimínalo de su equipo actual antes de crear otro.",
      409,
    );
  }
  if (medicConflict) {
    throw new TeamError(
      "El sanitario seleccionado ya pertenece a un equipo. Elimínalo de su equipo actual antes de crear otro.",
      409,
    );
  }

  const team = await Team.create({
    driver,
    medic,
    rotationMode: normalizedRotation,
    fixedDienstNumber: normalizedFixedDienst,
    ambulanceId: normalizedAmbulanceId,
    companyId: companyOid,
  });

  return Team.findById(team._id)
    .populate("driver", "name lastName ambulanceRole pscheinExpiry")
    .populate("medic", "name lastName ambulanceRole pscheinExpiry")
    .populate("ambulanceId", "ambulanceNumber brand modelName licensePlate");
}

export async function getUsedTeamsForWeek(
  weekStartDate?: string,
  companyId?: string | null,
) {
  if (!weekStartDate) {
    throw new TeamError(
      "Parámetro weekStartDate requerido (YYYY-MM-DD)",
      400,
    );
  }

  const startDate = new Date(weekStartDate);
  if (isNaN(startDate.getTime())) {
    throw new TeamError("weekStartDate inválida", 400);
  }

  assertCompanyIdForTeamOps(companyId);

  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);

  const companyOid = new mongoose.Types.ObjectId(companyId);
  const teams = await Team.find(
    { companyId: companyOid },
    { driver: 1, medic: 1 },
  ).lean();

  if (!teams || teams.length === 0) {
    return { usedTeamIds: [] };
  }

  const pairToTeamId = new Map<string, string>();
  for (const t of teams) {
    const dId = (t as any).driver?.toString?.();
    const mId = (t as any).medic?.toString?.();
    if (!dId || !mId) continue;
    const key = `${dId}::${mId}`;
    pairToTeamId.set(key, (t as any)._id.toString());
  }

  if (pairToTeamId.size === 0) {
    return { usedTeamIds: [] };
  }

  const dienstFilter: Record<string, unknown> = {
    weekStartDate: { $gte: startDate, $lte: endDate },
    companyId: new mongoose.Types.ObjectId(companyId),
  };
  const diensts = await Dienst.find(dienstFilter, { assignments: 1 }).lean();

  if (!diensts || diensts.length === 0) {
    return { usedTeamIds: [] };
  }

  const usedTeamIds = new Set<string>();
  for (const d of diensts) {
    const assignments = (d as any).assignments ?? [];
    for (const a of assignments) {
      const drv = a?.driver?.toString?.();
      const med = a?.medic?.toString?.();
      if (!drv || !med) continue;
      const key = `${drv}::${med}`;
      const teamId = pairToTeamId.get(key);
      if (teamId) usedTeamIds.add(teamId);
    }
  }

  return { usedTeamIds: Array.from(usedTeamIds) };
}

export async function updateTeam(
  id: string,
  body: {
    driver?: string;
    medic?: string;
    rotationMode?: "rotating" | "fixed" | "none";
    fixedDienstNumber?: number | string | null;
    ambulanceId?: string | null;
  },
  companyId?: string | null,
) {
  if (!isObjectId(id)) {
    throw new TeamError("ID de team inválido", 400);
  }

  assertCompanyIdForTeamOps(companyId);
  const companyOid = new mongoose.Types.ObjectId(companyId);

  const existing = await Team.findOne({
    _id: id,
    companyId: companyOid,
  })
    .select("driver")
    .lean();
  if (!existing) {
    throw new TeamError("Team no encontrado", 404);
  }

  const { driver, medic, rotationMode, fixedDienstNumber, ambulanceId } = body;

  if (!driver || !medic) {
    throw new TeamError("driver y medic son obligatorios", 400);
  }
  if (!isObjectId(driver) || !isObjectId(medic)) {
    throw new TeamError("driver y medic deben ser ObjectId válidos", 400);
  }
  if (driver === medic) {
    throw new TeamError("driver y medic no pueden ser la misma persona", 400);
  }

  const [driverUser, medicUser] = await Promise.all([
    User.findById(driver).select("companyId ambulanceRole").lean(),
    User.findById(medic).select("companyId ambulanceRole").lean(),
  ]);
  if (!driverUser || !medicUser) {
    throw new TeamError("Usuario driver o medic inexistente", 400);
  }
  assertTeamMemberAmbulanceRoles(
    driverUser as { ambulanceRole?: string },
    medicUser as { ambulanceRole?: string },
  );
  const drvCo = (driverUser as { companyId?: unknown }).companyId;
  const medCo = (medicUser as { companyId?: unknown }).companyId;
  if (!entitiesBelongToSameCompany(drvCo, medCo)) {
    throw new TeamError("driver y medic deben pertenecer a la misma empresa", 403);
  }
  const targetCo = String(companyId);
  if (!entitiesBelongToSameCompany(drvCo, targetCo)) {
    throw new TeamError("El equipo debe pertenecer a tu empresa", 403);
  }

  let normalizedRotation: "rotating" | "fixed" | "none" = "rotating";
  if (
    rotationMode === "fixed" ||
    rotationMode === "none" ||
    rotationMode === "rotating"
  ) {
    normalizedRotation = rotationMode;
  }

  let normalizedFixedDienst: number | null = null;
  if (normalizedRotation === "fixed") {
    const num =
      typeof fixedDienstNumber === "string"
        ? Number(fixedDienstNumber)
        : fixedDienstNumber;

    if (!Number.isInteger(num) || num == null || num < 1) {
      throw new TeamError(
        'fixedDienstNumber debe ser un número entero ≥ 1 cuando rotationMode es "fixed"',
        400,
      );
    }
    normalizedFixedDienst = num;
  }

  const duplicated = await Team.findOne({
    companyId: companyOid,
    driver,
    medic,
    _id: { $ne: id },
  }).lean();

  if (duplicated) {
    throw new TeamError("Ya existe otro team con esa pareja driver+medic", 409);
  }

  const [driverConflict, medicConflict] = await Promise.all([
    Team.findOne({
      companyId: companyOid,
      _id: { $ne: id },
      $or: [{ driver }, { medic: driver }],
    }).lean(),
    Team.findOne({
      companyId: companyOid,
      _id: { $ne: id },
      $or: [{ driver: medic }, { medic }],
    }).lean(),
  ]);

  if (driverConflict) {
    throw new TeamError(
      "El conductor seleccionado ya pertenece a otro equipo. Elimínalo de su equipo actual antes de asignarlo aquí.",
      409,
    );
  }
  if (medicConflict) {
    throw new TeamError(
      "El sanitario seleccionado ya pertenece a otro equipo. Elimínalo de su equipo actual antes de asignarlo aquí.",
      409,
    );
  }

  let normalizedAmbulance: mongoose.Types.ObjectId | null | undefined;
  if (ambulanceId === undefined) {
    normalizedAmbulance = undefined;
  } else if (ambulanceId === null || ambulanceId === "") {
    normalizedAmbulance = null;
  } else {
    const amb = await Ambulance.findOne({
      _id: ambulanceId,
      companyId: companyOid,
    })
      .select("companyId")
      .lean();
    if (!amb) throw new TeamError("Ambulancia no encontrada", 400);
    normalizedAmbulance = new mongoose.Types.ObjectId(ambulanceId);
  }

  const ambModuleOnUpdate = await companyHasEnabledModule(
    targetCo,
    MODULE_KEYS.AMBULANCES,
  );
  if (!ambModuleOnUpdate) {
    if (
      normalizedAmbulance !== undefined &&
      normalizedAmbulance !== null
    ) {
      throw new TeamError(
        "El módulo de ambulancias no está habilitado para esta empresa.",
        403,
      );
    }
    normalizedAmbulance = null;
  }

  const updateDoc: any = {
    driver,
    medic,
    rotationMode: normalizedRotation,
    fixedDienstNumber: normalizedFixedDienst,
  };
  if (!ambModuleOnUpdate) {
    updateDoc.ambulanceId = null;
  } else if (normalizedAmbulance !== undefined) {
    updateDoc.ambulanceId = normalizedAmbulance;
  }

  const updated = await Team.findOneAndUpdate(
    { _id: id, companyId: companyOid },
    updateDoc,
    {
      new: true,
      runValidators: true,
    },
  )
    .populate("driver", "name lastName ambulanceRole pscheinExpiry")
    .populate("medic", "name lastName ambulanceRole pscheinExpiry")
    .populate("ambulanceId", "ambulanceNumber licensePlate");

  if (!updated) {
    throw new TeamError("Team no encontrado", 404);
  }

  return updated;
}

export async function deleteTeam(id: string, companyId?: string | null) {
  if (!isObjectId(id)) {
    throw new TeamError("ID inválido", 400);
  }
  assertCompanyIdForTeamOps(companyId);
  const companyOid = new mongoose.Types.ObjectId(companyId);

  const refs = await findTeamReferences(id, companyId);
  if (refs.inUse) {
    throw new TeamInUseError(refs.sources);
  }

  const deleted = await Team.findOneAndDelete({ _id: id, companyId: companyOid });
  if (!deleted) {
    throw new TeamError("Team no encontrado", 404);
  }
  return { message: "Team eliminado" };
}
