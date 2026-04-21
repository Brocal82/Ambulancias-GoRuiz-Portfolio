import { endOfMonth, startOfMonth } from "date-fns";
import MonthlyPraemie from "../models/monthly-praemie.model";
import { computeMonthlyPraemienStatsForUser } from "./get-monthly-summary.service";
import { getCompanyObjectIdForPraemienUser } from "./resolvePraemienUserCompany";
import { getEffectiveManualPraemienContextForUser } from "./resolve-effective-manual-praemien.service";
import { getPremieLevelFromAverage } from "../utils/premieLevelFromAverage";

export async function saveMonthlyPraemieForUser(
  userId: string,
  yearQuery: unknown,
  monthQuery: unknown,
) {
  const year = Number(yearQuery) || new Date().getFullYear();
  const month = Number(monthQuery) || new Date().getMonth() + 1;

  const manualCtx = await getEffectiveManualPraemienContextForUser(userId);
  if (manualCtx.isEffectiveManual) {
    return {
      hasData: false as const,
      skippedManualMode: true as const,
    };
  }

  const companyId = await getCompanyObjectIdForPraemienUser(userId);

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

  const premieLevel = getPremieLevelFromAverage(averagePatients);

  const updated = await MonthlyPraemie.findOneAndUpdate(
    { userId, year, month },
    {
      userId,
      companyId,
      year,
      month,
      averagePatients,
      premieLevel,
      snapshotSource: "automatic",
      createdAt: new Date(),
    },
    { upsert: true, new: true },
  );

  return {
    hasData: true as const,
    updated,
  };
}
