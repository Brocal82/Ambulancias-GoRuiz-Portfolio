import mongoose from "mongoose";
import PraemienManualDailyEntry from "../models/praemien-manual-daily-entry.model";
import MonthlyPraemie from "../models/monthly-praemie.model";
import { getPremieLevelFromAverage } from "../utils/premieLevelFromAverage";
import { calendarMonthKey } from "./resolve-effective-manual-praemien.service";
import { parseCalendarDateLocal } from "./assert-manual-praemien-phase.service";

function monthRangeStrings(year: number, month1to12: number): {
  start: string;
  end: string;
} {
  const start = new Date(year, month1to12 - 1, 1);
  const end = new Date(year, month1to12, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  const startStr = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
  const endStr = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
  return { start: startStr, end: endStr };
}

function approvedDayValue(doc: {
  adminFinalValue?: unknown;
  workerSubmittedValue?: unknown;
}): number {
  if (doc.adminFinalValue != null && Number.isFinite(Number(doc.adminFinalValue))) {
    return Number(doc.adminFinalValue);
  }
  return Number(doc.workerSubmittedValue ?? 0);
}

/**
 * Recomputes and upserts `MonthlyPraemie` for one closed calendar month from
 * **approved** manual daily rows (admin-final value). Idempotent on read.
 * Deletes the manual snapshot row if there are no approved days in range.
 */
export async function ensureManualMonthCloseSnapshot(params: {
  userId: string;
  year: number;
  month: number;
  companyObjectId: mongoose.Types.ObjectId;
}): Promise<void> {
  const now = new Date();
  const nowYm = calendarMonthKey(now.getFullYear(), now.getMonth() + 1);
  const targetYm = calendarMonthKey(params.year, params.month);
  if (targetYm >= nowYm) {
    return;
  }

  const { start, end } = monthRangeStrings(params.year, params.month);
  const userOid = new mongoose.Types.ObjectId(params.userId);

  const rows = await PraemienManualDailyEntry.find({
    companyId: params.companyObjectId,
    userId: userOid,
    date: { $gte: start, $lte: end },
    status: "approved",
  })
    .select("date adminFinalValue workerSubmittedValue")
    .lean();

  if (!rows.length) {
    await MonthlyPraemie.deleteOne({
      userId: params.userId,
      year: params.year,
      month: params.month,
      snapshotSource: "manual",
    });
    return;
  }

  let total = 0;
  for (const r of rows) {
    total += approvedDayValue(r as { adminFinalValue?: unknown; workerSubmittedValue?: unknown });
  }
  const averagePatients = Math.round((total / rows.length) * 2) / 2;
  const premieLevel = getPremieLevelFromAverage(averagePatients);

  await MonthlyPraemie.findOneAndUpdate(
    { userId: params.userId, year: params.year, month: params.month },
    {
      userId: params.userId,
      companyId: params.companyObjectId,
      year: params.year,
      month: params.month,
      averagePatients,
      premieLevel,
      snapshotSource: "manual",
      createdAt: new Date(),
    },
    { upsert: true, new: true },
  );
}

/** Parse YYYY-MM-DD → calendar month key, or null. */
export function ymKeyFromDateString(dateStr: string): number | null {
  const d = parseCalendarDateLocal(dateStr);
  if (!d) return null;
  return calendarMonthKey(d.getFullYear(), d.getMonth() + 1);
}
