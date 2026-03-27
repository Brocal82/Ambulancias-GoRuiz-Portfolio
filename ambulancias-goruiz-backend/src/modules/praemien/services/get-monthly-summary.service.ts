import { endOfMonth, startOfMonth } from "date-fns";
import mongoose from "mongoose";
import { WorkdaySummary } from "../../workday-summary";
import { MonthlyPraemienSummaryResponse } from "../types/praemien.types";
import { getCompanyObjectIdForPraemienUser } from "./resolvePraemienUserCompany";

/**
 * Misma lógica que el GET mensual: suma por día (incluye parciales y finales),
 * media = total / número de días con datos.
 */
export async function computeMonthlyPraemienStatsForUser(
  userId: string,
  monthStart: Date,
  monthEnd: Date,
): Promise<MonthlyPraemienSummaryResponse> {
  const objectUserId = new mongoose.Types.ObjectId(userId);
  const companyOid = await getCompanyObjectIdForPraemienUser(userId);

  const summaries = await WorkdaySummary.find({
    date: {
      $gte: monthStart.toISOString().split("T")[0],
      $lte: monthEnd.toISOString().split("T")[0],
    },
    $or: [{ driver: objectUserId }, { medic: objectUserId }],
    companyId: companyOid,
  }).select("date totalEffectivePatients");

  if (!summaries.length) {
    return {
      monthlyData: [],
      averagePatients: 0,
    };
  }

  const groupedByDate: Record<string, number> = {};

  summaries.forEach((summary) => {
    const dateKey = summary.date.toString().split("T")[0];
    if (!groupedByDate[dateKey]) groupedByDate[dateKey] = 0;
    groupedByDate[dateKey] += summary.totalEffectivePatients || 0;
  });

  const monthlyData = Object.entries(groupedByDate).map(
    ([date, totalCountedPatients]) => ({
      date,
      totalCountedPatients,
    }),
  );

  const totalPatients = monthlyData.reduce(
    (acc, day) => acc + day.totalCountedPatients,
    0,
  );
  const averagePatients = totalPatients / monthlyData.length;

  return {
    monthlyData,
    averagePatients: Math.round(averagePatients * 2) / 2,
  };
}

export async function getMonthlySummaryForUser(
  userId: string,
): Promise<MonthlyPraemienSummaryResponse> {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  return computeMonthlyPraemienStatsForUser(userId, monthStart, monthEnd);
}
