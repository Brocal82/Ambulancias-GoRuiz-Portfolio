import mongoose from "mongoose";
import VacationMonthConfig from "../models/month-config.model";

export const DEFAULT_MAX_PER_DAY = Number(
  process.env.MAX_VACATIONS_PER_DAY ?? 2,
);

export function toMonthKey(year: number, month1to12: number) {
  return `${year}-${String(month1to12).padStart(2, "0")}`;
}

function companyObjectId(companyId: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(companyId);
}

const monthConfigSelect =
  "monthKey maxPerDay blackouts" as const;

export async function getMaxPerDayForDate(
  date: Date,
  companyId: string,
): Promise<number> {
  const y = date.getFullYear();
  const m1 = date.getMonth() + 1;
  const key = toMonthKey(y, m1);
  const cfg = await VacationMonthConfig.findOne({
    companyId: companyObjectId(companyId),
    monthKey: key,
  })
    .select("maxPerDay")
    .lean();
  return cfg?.maxPerDay ?? DEFAULT_MAX_PER_DAY;
}

export async function findMonthConfig(monthKey: string, companyId: string) {
  return VacationMonthConfig.findOne({
    companyId: companyObjectId(companyId),
    monthKey,
  })
    .select(monthConfigSelect)
    .lean();
}

export async function getMonthConfigOrDefault(
  monthKey: string,
  companyId: string,
) {
  const cfg = await findMonthConfig(monthKey, companyId);
  return (
    cfg ?? {
      monthKey,
      maxPerDay: DEFAULT_MAX_PER_DAY,
      blackouts: [],
    }
  );
}

export async function upsertMonthConfigRecord(input: {
  companyId: string;
  monthKey: string;
  maxPerDay?: number;
  blackouts?: { startDate: string | Date; endDate: string | Date }[];
}) {
  const { companyId, monthKey, maxPerDay, blackouts } = input;

  const co = companyObjectId(companyId);

  const $set: Record<string, unknown> = { monthKey };
  if (typeof maxPerDay === "number" && maxPerDay >= 0) {
    $set.maxPerDay = maxPerDay;
  }
  if (Array.isArray(blackouts)) {
    $set.blackouts = blackouts.map((r) => ({
      startDate: new Date(r.startDate),
      endDate: new Date(r.endDate),
    }));
  }

  return VacationMonthConfig.findOneAndUpdate(
    { companyId: co, monthKey },
    { $set },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  ).select(monthConfigSelect);
}
