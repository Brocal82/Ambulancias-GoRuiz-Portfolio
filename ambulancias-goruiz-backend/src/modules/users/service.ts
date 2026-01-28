// backend/src/modules/users/service.ts
import User from "../../models/User";
import Dienst from "../../models/Dienst";
import { DateTime } from "luxon";

const ZONE = "Europe/Berlin";

export type DesiredRole = "driver" | "medic" | "both";

export interface GetAvailableUsersParams {
  date: string; // YYYY-MM-DD
  desiredRole: DesiredRole;
  startTime?: string; // "HH:mm"
  endTime?: string; // "HH:mm"
  includeExpired?: boolean; // incluir P-Schein caducados en respuesta (driver)
}

function toMin(hhmm?: string): number | null {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function overlap(
  aStartMin: number | null,
  aEndMin: number | null,
  bStartMin: number | null,
  bEndMin: number | null,
) {
  const Astart = aStartMin ?? 0;
  const Aend = aEndMin ?? 24 * 60;
  const Bstart = bStartMin ?? 0;
  const Bend = bEndMin ?? 24 * 60;
  return Astart < Bend && Bstart < Aend;
}

export async function getAvailableUsersForDateService(
  params: GetAvailableUsersParams,
) {
  const { date, desiredRole, startTime, endTime, includeExpired } = params;

  const allowedRoles =
    desiredRole === "driver"
      ? ["driver", "both"]
      : desiredRole === "medic"
        ? ["medic", "both"]
        : ["driver", "medic", "both"];

  const sReq = toMin(startTime);
  const eReq = toMin(endTime);

  const diensts = await Dienst.find(
    { "assignments.date": date },
    { assignments: 1 },
  ).lean();

  const busyUserIds = new Set<string>();

  for (const d of diensts as any[]) {
    for (const a of d.assignments ?? []) {
      if (a.date !== date) continue;

      const aStart = toMin(a.startTime);
      const aEnd = toMin(a.endTime);

      const shouldBlock =
        sReq === null || eReq === null ? true : overlap(aStart, aEnd, sReq, eReq);

      if (shouldBlock) {
        if (a.driver) busyUserIds.add(String(a.driver));
        if (a.medic) busyUserIds.add(String(a.medic));
      }
    }
  }

  const baseUsers = await User.find({
    _id: { $nin: Array.from(busyUserIds) },
    ambulanceRole: { $in: allowedRoles },
  })
    .sort({ lastName: 1 })
    .lean();

  const dateObj = DateTime.fromISO(date, { zone: ZONE }).startOf("day");

  const available = (baseUsers as any[]).filter((u) => {
    if (desiredRole !== "driver") return true;
    if (includeExpired) return true;

    const exp = u.pscheinExpiry
      ? DateTime.fromISO(u.pscheinExpiry, { zone: ZONE })
      : null;

    return !exp || exp.endOf("day") >= dateObj;
  });

  return available;
}
