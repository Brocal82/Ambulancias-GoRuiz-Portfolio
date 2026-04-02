// modules/diensts/utils/dienstValidation.ts
import mongoose from "mongoose";
import Dienst from "../models/dienst.model";
import {
  findOverlappingSickLeaveQuery as findOverlappingSickLeave,
  isOnSickDayQuery as isOnSickDay,
} from "../../sick-leaves";
import VacationRequest from "../../vacation/models/vacation-request.model";
import { getPscheinStatus } from "../../../utils/pscheinUtils";
import { DateTime } from "luxon";

export { isOnSickDay, findOverlappingSickLeave };

const ZONE = "Europe/Berlin";

export type DayBlockMap = Record<string, { driver: boolean; medic: boolean }>;

/** Flags reales por rol (para resúmenes sin adivinar vacaciones vs baja). */
export type TeamDayAbsenceReasons = {
  driver: { vacation: boolean; sick: boolean };
  medic: { vacation: boolean; sick: boolean };
};

export type TeamDayAbsenceData = {
  blockMap: DayBlockMap;
  /** Misma clave de fecha que en blockMap (entrada del array `dates`). */
  reasonByDate: Record<string, TeamDayAbsenceReasons>;
};

/**
 * Vacaciones y baja por día y rol, más el mapa booleano usado por la lógica de asignación.
 */
export async function computeTeamDayAbsenceData(params: {
  driverId: string | undefined;
  medicId: string | undefined;
  dates: string[];
}): Promise<TeamDayAbsenceData> {
  const { driverId, medicId, dates } = params;
  const blockMap: DayBlockMap = {};
  const reasonByDate: Record<string, TeamDayAbsenceReasons> = {};

  if (dates.length === 0) return { blockMap, reasonByDate };

  for (const dateISO of dates) {
    if (!driverId && !medicId) {
      blockMap[dateISO] = { driver: false, medic: false };
      reasonByDate[dateISO] = {
        driver: { vacation: false, sick: false },
        medic: { vacation: false, sick: false },
      };
      continue;
    }

    const [drvVac, medVac, drvSick, medSick] = await Promise.all([
      driverId
        ? isOnVacationDay({ userId: driverId, dateISO })
        : Promise.resolve(false),
      medicId
        ? isOnVacationDay({ userId: medicId, dateISO })
        : Promise.resolve(false),
      driverId
        ? isOnSickDay({ userId: driverId, dateISO })
        : Promise.resolve(false),
      medicId
        ? isOnSickDay({ userId: medicId, dateISO })
        : Promise.resolve(false),
    ]);

    reasonByDate[dateISO] = {
      driver: { vacation: Boolean(drvVac), sick: Boolean(drvSick) },
      medic: { vacation: Boolean(medVac), sick: Boolean(medSick) },
    };
    blockMap[dateISO] = {
      driver: Boolean(drvVac || drvSick),
      medic: Boolean(medVac || medSick),
    };
  }

  return { blockMap, reasonByDate };
}

/**
 * Calcula por cada fecha si driver y medic están bloqueados (vacaciones o baja).
 */
export async function computeDayBlockMapForTeam(params: {
  driverId: string | undefined;
  medicId: string | undefined;
  dates: string[];
}): Promise<DayBlockMap> {
  const { blockMap } = await computeTeamDayAbsenceData(params);
  return blockMap;
}

/**
 * Vacaciones aceptadas en un día concreto (maneja TZ/DST en Europe/Berlin).
 */
export async function isOnVacationDay(params: {
  userId: string;
  dateISO: string;
}): Promise<boolean> {
  const { userId, dateISO } = params;
  if (
    !mongoose.Types.ObjectId.isValid(userId) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)
  ) {
    return false;
  }

  const startBER = DateTime.fromISO(dateISO, { zone: ZONE }).startOf("day");
  const endBER = DateTime.fromISO(dateISO, { zone: ZONE }).endOf("day");

  const count = await VacationRequest.countDocuments({
    user: userId,
    status: "accepted",
    startDate: { $lte: endBER.toJSDate() },
    endDate: { $gte: startBER.toJSDate() },
  });

  return count > 0;
}

/**
 * Normaliza el estado del P-Schein de un conductor.
 */
export function getDriverPscheinState(
  pscheinExpiry?: string,
): "expired" | "warning" | "valid" | "no-date" {
  const st = getPscheinStatus(pscheinExpiry);
  if (st === "expired") return "expired";
  if (st === "warning") return "warning";
  if (st === "valid") return "valid";
  return "no-date";
}

/** Rol de ambulancia suficiente para cubrir el puesto driver o medic en un Dienst. */
export function isAmbulanceRoleValidForSlot(
  ambulanceRole: "driver" | "medic" | "both" | undefined,
  slot: "driver" | "medic",
): boolean {
  if (!ambulanceRole) return false;
  if (slot === "driver") {
    return ambulanceRole === "driver" || ambulanceRole === "both";
  }
  return ambulanceRole === "medic" || ambulanceRole === "both";
}

/**
 * Comparación de fecha: con fecha de caducidad presente, el fin de día en Europe/Berlin
 * debe ser >= día del servicio. Si `pscheinExpiry` está vacío, devuelve true (uso interno
 * tras comprobar que el valor existe en `isDriverEligibleForAssignmentDate`).
 */
export function isDriverPscheinValidOnAssignmentDate(
  pscheinExpiry: string | undefined,
  assignmentDateISO: string,
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(assignmentDateISO)) return false;
  const dateObj = DateTime.fromISO(assignmentDateISO, { zone: ZONE }).startOf(
    "day",
  );
  const trimmed = typeof pscheinExpiry === "string" ? pscheinExpiry.trim() : "";
  if (!trimmed) return true;
  const exp = DateTime.fromISO(trimmed, { zone: ZONE });
  if (!exp.isValid) return true;
  return exp.endOf("day") >= dateObj;
}

export type DriverEligibilityInputs = {
  ambulanceRole: "driver" | "medic" | "both" | undefined;
  pscheinExpiry: string | undefined;
  pscheinConfirmedAt: Date | string | null | undefined;
  assignmentDateISO: string;
};

/**
 * Regla única de elegibilidad como conductor: rol driver/both, P-Schein confirmado,
 * caducidad presente y válida para la fecha del servicio.
 */
export function isDriverEligibleForAssignmentDate(
  params: DriverEligibilityInputs,
): boolean {
  const {
    ambulanceRole,
    pscheinExpiry,
    pscheinConfirmedAt,
    assignmentDateISO,
  } = params;
  if (!isAmbulanceRoleValidForSlot(ambulanceRole, "driver")) return false;
  if (pscheinConfirmedAt == null) return false;
  if (typeof pscheinConfirmedAt === "string" && !pscheinConfirmedAt.trim()) {
    return false;
  }
  const trimmed = typeof pscheinExpiry === "string" ? pscheinExpiry.trim() : "";
  if (!trimmed) return false;
  return isDriverPscheinValidOnAssignmentDate(trimmed, assignmentDateISO);
}

/**
 * Convierte "HH:MM" a minutos desde medianoche.
 * Devuelve 0 si el formato no es reconocible.
 */
function timeToMinutes(t: string): number {
  const parts = t.split(":");
  const h = parseInt(parts[0] ?? "0", 10);
  const m = parseInt(parts[1] ?? "0", 10);
  if (isNaN(h) || isNaN(m)) return 0;
  return h * 60 + m;
}

/**
 * Comprueba solapamiento de dos intervalos [start, end) usando minutos.
 * Normaliza turnos nocturnos (endTime < startTime) sumando 1440 al extremo final.
 *
 * Limitación conocida: si un turno nocturno ocupa dos fechas distintas en la BD
 * (p. ej. date=D con 22:00–06:00 vs date=D+1 con 00:00–08:00), esa comparación
 * queda fuera del alcance de esta función porque el query filtra por fecha exacta.
 */
function timesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  const aS = timeToMinutes(aStart);
  let aE = timeToMinutes(aEnd);
  const bS = timeToMinutes(bStart);
  let bE = timeToMinutes(bEnd);

  if (aE <= aS) aE += 1440; // turno nocturno: normalizar
  if (bE <= bS) bE += 1440;

  return aS < bE && bS < aE; // [start, end) overlap
}

/**
 * Convierte "YYYY-MM-DD" a "DD/MM/YYYY" para mensajes de error legibles por el admin.
 */
function formatDateDMY(dateISO: string): string {
  const parts = dateISO.split("-");
  if (parts.length !== 3) return dateISO;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export type AmbulanceTimeConflict = {
  dienstId: string;
  dienstNumber: number;
  date: string;
  conflictingStart: string;  // HH:MM del turno existente
  conflictingEnd: string;
  incomingStart: string;     // HH:MM del turno intentado
  incomingEnd: string;
};

/**
 * Genera un mensaje de error profesional a partir de un conflicto de ambulancia.
 * Incluye el Dienst existente, la fecha, el turno en conflicto y el turno intentado.
 */
export function formatAmbulanceConflictMessage(c: AmbulanceTimeConflict): string {
  const date = formatDateDMY(c.date);
  return (
    `La ambulancia ya está asignada en el Dienst #${c.dienstNumber} ` +
    `el ${date} de ${c.conflictingStart} a ${c.conflictingEnd}. ` +
    `No puede asignarse al nuevo horario ${c.incomingStart}–${c.incomingEnd} ` +
    `porque los horarios se solapan.`
  );
}

/**
 * Busca conflictos de tiempo para una ambulancia:
 * misma ambulancia, misma fecha, rango horario solapado, en otro Dienst de la misma empresa.
 *
 * Usa intervalos semiabiertos [start, end), por lo que 06:00–14:00 y 14:00–22:00 NO solapan.
 */
export async function findAmbulanceTimeConflicts(params: {
  ambulanceId: mongoose.Types.ObjectId;
  currentDienstId: mongoose.Types.ObjectId;
  assignments: Array<{ date: string; startTime: string; endTime: string }>;
  companyId: string;
}): Promise<AmbulanceTimeConflict[]> {
  const { ambulanceId, currentDienstId, assignments, companyId } = params;

  if (assignments.length === 0) return [];

  const dates = [...new Set(assignments.map((a) => a.date))];

  const candidates = await Dienst.find({
    _id: { $ne: currentDienstId },
    companyId: new mongoose.Types.ObjectId(companyId),
    "assignments.ambulanceId": ambulanceId,
    "assignments.date": { $in: dates },
  })
    .select(
      "dienstNumber assignments.date assignments.startTime assignments.endTime assignments.ambulanceId",
    )
    .lean();

  const out: AmbulanceTimeConflict[] = [];

  for (const otherDienst of candidates) {
    for (const otherA of otherDienst.assignments ?? []) {
      if (
        !otherA.ambulanceId ||
        otherA.ambulanceId.toString() !== ambulanceId.toString()
      ) {
        continue;
      }

      const incoming = assignments.find((a) => a.date === otherA.date);
      if (!incoming) continue;

      const aStart = incoming.startTime;
      const aEnd = incoming.endTime;
      const bStart = otherA.startTime;
      const bEnd = otherA.endTime;

      if (!aStart || !aEnd || !bStart || !bEnd) continue;

      if (timesOverlap(aStart, aEnd, bStart, bEnd)) {
        out.push({
          dienstId: String((otherDienst as any)._id),
          dienstNumber: otherDienst.dienstNumber,
          date: otherA.date,
          conflictingStart: bStart,
          conflictingEnd: bEnd,
          incomingStart: aStart,
          incomingEnd: aEnd,
        });
      }
    }
  }

  return out;
}

/**
 * Busca asignaciones de ese usuario en cualquier Dienst de la misma semana
 * y de la misma empresa (`companyId`). No incluye Dienst con `companyId` null.
 */
export async function findWeeklyConflicts(
  userId: mongoose.Types.ObjectId,
  weekStart: Date,
  companyId: string,
  currentDienstNumber?: number,
): Promise<
  Array<{
    dienstId: string;
    dienstNumber: number;
    date: string;
    role: "driver" | "medic";
  }>
> {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const dienste = await Dienst.find({
    companyId: new mongoose.Types.ObjectId(companyId),
    weekStartDate: { $gte: weekStart, $lte: weekEnd },
  })
    .select(
      "dienstNumber assignments.date assignments.driver assignments.medic",
    )
    .lean();

  const out: Array<{
    dienstId: string;
    dienstNumber: number;
    date: string;
    role: "driver" | "medic";
  }> = [];

  for (const d of dienste) {
    if (
      typeof currentDienstNumber === "number" &&
      d.dienstNumber === currentDienstNumber
    ) {
      continue;
    }

    for (const a of d.assignments ?? []) {
      const drv = a?.driver?.toString?.();
      const med = a?.medic?.toString?.();
      const uid = userId.toString();

      if (drv && drv === uid) {
        out.push({
          dienstId: String((d as any)._id),
          dienstNumber: d.dienstNumber,
          date: a.date,
          role: "driver",
        });
      }
      if (med && med === uid) {
        out.push({
          dienstId: String((d as any)._id),
          dienstNumber: d.dienstNumber,
          date: a.date,
          role: "medic",
        });
      }
    }
  }
  return out;
}
