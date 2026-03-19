// backend/src/utils/dienstValidation.ts
import mongoose from "mongoose";
import Dienst from "../models/Dienst";
import {
  findOverlappingSickLeaveQuery as findOverlappingSickLeave,
  isOnSickDayQuery as isOnSickDay,
} from "../modules/sick-leaves";
import VacationRequest from "../modules/vacation/models/vacation-request.model";
import { getPscheinStatus } from "./pscheinUtils";
import { DateTime } from "luxon";
export { isOnSickDay, findOverlappingSickLeave };

const ZONE = "Europe/Berlin";

export type DayBlockMap = Record<string, { driver: boolean; medic: boolean }>;

/**
 * Calcula por cada fecha si driver y medic están bloqueados (vacaciones o baja).
 * Usado en generateDienstTemplatesForWeek y assignTeamToWeek.
 */
export async function computeDayBlockMapForTeam(params: {
  driverId: string | undefined;
  medicId: string | undefined;
  dates: string[];
}): Promise<DayBlockMap> {
  const { driverId, medicId, dates } = params;
  const result: DayBlockMap = {};

  if (dates.length === 0) return result;

  for (const dateISO of dates) {
    if (!driverId && !medicId) {
      result[dateISO] = { driver: false, medic: false };
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

    result[dateISO] = {
      driver: Boolean(drvVac || drvSick),
      medic: Boolean(medVac || medSick),
    };
  }

  return result;
}

/**
 * Vacaciones aceptadas en un día concreto (maneja TZ/DST en Europe/Berlin).
 */
export async function isOnVacationDay(params: {
  userId: string;
  dateISO: string; // 'YYYY-MM-DD'
}): Promise<boolean> {
  const { userId, dateISO } = params;
  if (
    !mongoose.Types.ObjectId.isValid(userId) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)
  ) {
    return false;
  }

  // Límites del día en zona Berlin (corrige problemas de DST/off-by-one)
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
 * - 'expired' → no asignable
 * - 'warning' → asignable pero conviene avisar (lo usarás en UI si quieres)
 * - 'valid' | 'no-date' → asignable (según tu política)
 */
export function getDriverPscheinState(
  pscheinExpiry?: string,
): "expired" | "warning" | "valid" | "no-date" {
  const st = getPscheinStatus(pscheinExpiry); // reutiliza tu backend/utils/pscheinUtils
  if (st === "expired") return "expired";
  if (st === "warning") return "warning";
  if (st === "valid") return "valid";
  return "no-date";
}

// 🔎 Busca asignaciones de ese usuario en cualquier Dienst de la misma semana
export async function findWeeklyConflicts(
  userId: mongoose.Types.ObjectId,
  weekStart: Date,
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
