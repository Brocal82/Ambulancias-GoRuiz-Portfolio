import mongoose from "mongoose";
import { DateTime } from "luxon";
import SickLeave from "../models/sick-leave.model";
import { formatBerlinYmd } from "../utils/sick-date.helpers";
import type { SickRangeFlags } from "../types/sick-leave.types";

const ZONE = "Europe/Berlin";

export async function isOnSickDayQuery(params: {
  userId: string;
  dateISO: string;
}): Promise<boolean> {
  const { userId, dateISO } = params;

  if (!mongoose.Types.ObjectId.isValid(userId)) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return false;

  const startBER = DateTime.fromISO(dateISO, { zone: ZONE }).startOf("day");
  const endBER = DateTime.fromISO(dateISO, { zone: ZONE }).endOf("day");

  const count = await SickLeave.countDocuments({
    user: userId,
    status: "accepted",
    startDate: { $lte: endBER.toJSDate() },
    endDate: { $gte: startBER.toJSDate() },
  });

  return count > 0;
}

export async function findOverlappingActiveSickLeave(params: {
  userId: string;
  startDate: Date;
  endDate: Date;
  excludingId?: string;
}) {
  const { userId, startDate, endDate, excludingId } = params;

  if (!mongoose.Types.ObjectId.isValid(userId)) return null;

  const query: Record<string, unknown> = {
    user: userId,
    status: { $in: ["pending", "accepted"] },
    startDate: { $lte: endDate },
    endDate: { $gte: startDate },
  };
  if (excludingId && mongoose.Types.ObjectId.isValid(excludingId)) {
    query._id = { $ne: new mongoose.Types.ObjectId(excludingId) };
  }

  return SickLeave.findOne(query)
    .select("_id status startDate endDate")
    .lean();
}

export async function findOverlappingSickLeaveQuery(params: {
  userId: string;
  dateISO: string;
}) {
  const { userId, dateISO } = params;

  if (!mongoose.Types.ObjectId.isValid(userId)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return null;

  const startBER = DateTime.fromISO(dateISO, { zone: ZONE }).startOf("day");
  const endBER = DateTime.fromISO(dateISO, { zone: ZONE }).endOf("day");

  return SickLeave.findOne({
    user: userId,
    status: "accepted",
    startDate: { $lte: endBER.toJSDate() },
    endDate: { $gte: startBER.toJSDate() },
  })
    .select(
      "_id startDate endDate status documentUrl requiresDocument verificationStatus documentDueAt",
    )
    .lean();
}

export async function checkSickInRangeService(params: {
  userIds: string[];
  fromISO: string;
  toISO: string;
  includeFullSpan?: boolean;
}): Promise<
  | { kind: "invalid_user_ids" }
  | { kind: "ok"; result: Record<string, SickRangeFlags> }
> {
  const { userIds, fromISO, toISO, includeFullSpan } = params;

  const fromStart = DateTime.fromISO(fromISO, { zone: ZONE }).startOf("day");
  const toEnd = DateTime.fromISO(toISO, { zone: ZONE }).endOf("day");

  const objectIds = userIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  if (objectIds.length === 0) {
    return { kind: "invalid_user_ids" };
  }

  const rows = await SickLeave.find({
    user: { $in: objectIds },
    status: "accepted",
    startDate: { $lte: toEnd.toJSDate() },
    endDate: { $gte: fromStart.toJSDate() },
  })
    .select("user startDate endDate")
    .lean();

  const result: Record<string, SickRangeFlags> = {};
  for (const id of userIds) {
    result[id] = { hasSickInRange: false };
  }

  const groupByUser = new Map<string, Array<{ startDate: Date; endDate: Date }>>();
  for (const r of rows) {
    const uid = String(r.user);
    if (!groupByUser.has(uid)) groupByUser.set(uid, []);
    groupByUser.get(uid)!.push({ startDate: r.startDate, endDate: r.endDate });
  }

  for (const uid of userIds) {
    const segments = groupByUser.get(uid);
    if (!segments || segments.length === 0) continue;

    let inRangeMin: Date | null = null;
    let inRangeMax: Date | null = null;
    let fullMin: Date | null = null;
    let fullMax: Date | null = null;

    for (const s of segments) {
      const overlapStart = new Date(
        Math.max(s.startDate.getTime(), fromStart.toJSDate().getTime()),
      );
      const overlapEnd = new Date(
        Math.min(s.endDate.getTime(), toEnd.toJSDate().getTime()),
      );
      if (overlapStart <= overlapEnd) {
        if (!inRangeMin || overlapStart < inRangeMin) inRangeMin = overlapStart;
        if (!inRangeMax || overlapEnd > inRangeMax) inRangeMax = overlapEnd;
      }

      if (includeFullSpan) {
        if (!fullMin || s.startDate < fullMin) fullMin = s.startDate;
        if (!fullMax || s.endDate > fullMax) fullMax = s.endDate;
      }
    }

    if (inRangeMin && inRangeMax) {
      result[uid].hasSickInRange = true;
      result[uid].sickStartInRange = formatBerlinYmd(inRangeMin);
      result[uid].sickUntilInRange = formatBerlinYmd(inRangeMax);
    }

    if (includeFullSpan && fullMin && fullMax) {
      result[uid].sickStartFull = formatBerlinYmd(fullMin);
      result[uid].sickUntilFull = formatBerlinYmd(fullMax);
    }
  }

  return { kind: "ok", result };
}
