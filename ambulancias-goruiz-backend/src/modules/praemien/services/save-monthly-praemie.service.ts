import { endOfMonth, startOfMonth } from "date-fns";
import MonthlyPraemie from "../models/monthly-praemie.model";
import { computeMonthlyPraemienStatsForUser } from "./get-monthly-summary.service";

function getPremieLevel(averagePatients: number): string {
  let premieLevel = "\u274c No alcanza m\u00ednimo";
  if (averagePatients >= 10) premieLevel = "\ud83c\udfc6 Pr\u00e4mie 10";
  else if (averagePatients >= 9) premieLevel = "\ud83c\udf96 Pr\u00e4mie 9";
  else if (averagePatients >= 8) premieLevel = "\ud83e\udd48 Pr\u00e4mie 8";
  else if (averagePatients >= 7) premieLevel = "\ud83e\udd49 Pr\u00e4mie 7";

  return premieLevel;
}

export async function saveMonthlyPraemieForUser(
  userId: string,
  yearQuery: unknown,
  monthQuery: unknown,
) {
  const year = Number(yearQuery) || new Date().getFullYear();
  const month = Number(monthQuery) || new Date().getMonth() + 1;

  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(new Date(year, month - 1));

  const { monthlyData, averagePatients } = await computeMonthlyPraemienStatsForUser(
    userId,
    monthStart,
    monthEnd,
  );

  if (!monthlyData.length) {
    return { hasData: false as const };
  }

  const premieLevel = getPremieLevel(averagePatients);

  const updated = await MonthlyPraemie.findOneAndUpdate(
    { userId, year, month },
    {
      userId,
      year,
      month,
      averagePatients,
      premieLevel,
      createdAt: new Date(),
    },
    { upsert: true, new: true },
  );

  return {
    hasData: true as const,
    updated,
  };
}
