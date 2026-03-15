import VacationMonthConfig, {
  IVacationMonthConfig,
} from "../models/month-config.model";

export const DEFAULT_MAX_PER_DAY = Number(
  process.env.MAX_VACATIONS_PER_DAY ?? 2,
);

export function toMonthKey(year: number, month1to12: number) {
  return `${year}-${String(month1to12).padStart(2, "0")}`;
}

export async function getMaxPerDayForDate(date: Date): Promise<number> {
  const y = date.getFullYear();
  const m1 = date.getMonth() + 1;
  const key = toMonthKey(y, m1);
  const cfg = await VacationMonthConfig.findOne({ monthKey: key }).lean();
  return cfg?.maxPerDay ?? DEFAULT_MAX_PER_DAY;
}

export async function findMonthConfig(monthKey: string) {
  return VacationMonthConfig.findOne({ monthKey }).lean();
}

export async function getMonthConfigOrDefault(monthKey: string) {
  const cfg = await findMonthConfig(monthKey);
  return (
    cfg ?? {
      monthKey,
      maxPerDay: DEFAULT_MAX_PER_DAY,
      blackouts: [],
    }
  );
}

export async function upsertMonthConfigRecord(input: {
  monthKey: string;
  maxPerDay?: number;
  blackouts?: { startDate: string | Date; endDate: string | Date }[];
}) {
  const { monthKey, maxPerDay, blackouts } = input;

  const payload: Partial<IVacationMonthConfig> = { monthKey };
  if (typeof maxPerDay === "number" && maxPerDay >= 0) {
    payload.maxPerDay = maxPerDay;
  }
  if (Array.isArray(blackouts)) {
    payload.blackouts = blackouts.map((r) => ({
      startDate: new Date(r.startDate),
      endDate: new Date(r.endDate),
    }));
  }

  return VacationMonthConfig.findOneAndUpdate({ monthKey }, payload, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  });
}
