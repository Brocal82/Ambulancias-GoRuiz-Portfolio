import { DateTime } from "luxon";
import mongoose from "mongoose";
import VacationRequest from "../../../models/vacationRequest";

const ZONE = "Europe/Berlin";

type VacationRangeFlags = {
  hasVacationInRange: boolean;
  vacationStartInRange?: string;
  vacationUntilInRange?: string;
  vacationStartFull?: string;
  vacationUntilFull?: string;
};

export async function checkVacationsInRangeService(params: {
  userIds: string[];
  fromISO: string;
  toISO: string;
}) {
  const fmtYmdBerlin = (d: DateTime): string =>
    d.setZone(ZONE).toFormat("yyyy-LL-dd");

  const { userIds, fromISO, toISO } = params;

  const fromDT = DateTime.fromISO(fromISO, { zone: ZONE }).startOf("day");
  const toDT = DateTime.fromISO(toISO, { zone: ZONE }).endOf("day");

  const userObjectIds = userIds.map((id) => new mongoose.Types.ObjectId(id));

  const requests = await VacationRequest.find({
    status: "accepted",
    user: { $in: userObjectIds },
    startDate: { $lte: toDT.toJSDate() },
    endDate: { $gte: fromDT.toJSDate() },
  })
    .select("user startDate endDate")
    .lean();

  const result: Record<string, VacationRangeFlags> = {};
  for (const id of userIds) {
    result[id] = { hasVacationInRange: false };
  }

  for (const r of requests) {
    const uid = String(r.user);

    const reqStart = DateTime.fromJSDate(r.startDate as Date, {
      zone: ZONE,
    }).startOf("day");
    const reqEnd = DateTime.fromJSDate(r.endDate as Date, {
      zone: ZONE,
    }).endOf("day");

    const overlapStart = reqStart < fromDT ? fromDT : reqStart;
    const overlapEnd = reqEnd > toDT ? toDT : reqEnd;
    if (overlapStart > overlapEnd) continue;

    const prev = result[uid];

    if (!prev || !prev.hasVacationInRange) {
      result[uid] = {
        hasVacationInRange: true,
        vacationStartInRange: fmtYmdBerlin(overlapStart),
        vacationUntilInRange: fmtYmdBerlin(overlapEnd),
        vacationStartFull: fmtYmdBerlin(reqStart),
        vacationUntilFull: fmtYmdBerlin(reqEnd),
      };
    } else {
      const prevInStart = DateTime.fromISO(prev.vacationStartInRange!, {
        zone: ZONE,
      }).startOf("day");
      const prevInEnd = DateTime.fromISO(prev.vacationUntilInRange!, {
        zone: ZONE,
      }).endOf("day");

      const newInStart =
        prevInStart < overlapStart ? prevInStart : overlapStart;
      const newInEnd = prevInEnd > overlapEnd ? prevInEnd : overlapEnd;

      const prevFullStart = prev.vacationStartFull
        ? DateTime.fromISO(prev.vacationStartFull, { zone: ZONE }).startOf(
            "day",
          )
        : reqStart;
      const prevFullEnd = prev.vacationUntilFull
        ? DateTime.fromISO(prev.vacationUntilFull, { zone: ZONE }).endOf("day")
        : reqEnd;

      const newFullStart =
        prevFullStart < reqStart ? prevFullStart : reqStart;
      const newFullEnd = prevFullEnd > reqEnd ? prevFullEnd : reqEnd;

      result[uid] = {
        hasVacationInRange: true,
        vacationStartInRange: fmtYmdBerlin(newInStart),
        vacationUntilInRange: fmtYmdBerlin(newInEnd),
        vacationStartFull: fmtYmdBerlin(newFullStart),
        vacationUntilFull: fmtYmdBerlin(newFullEnd),
      };
    }
  }

  return result;
}
