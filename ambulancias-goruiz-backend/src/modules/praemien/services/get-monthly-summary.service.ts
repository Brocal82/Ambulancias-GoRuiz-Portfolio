import { endOfMonth, startOfMonth } from "date-fns";
import mongoose from "mongoose";
import WorkdaySummary from "../../../models/workdaySummary";
import { MonthlyPraemienSummaryResponse } from "../types/praemien.types";

export async function getMonthlySummaryForUser(
  userId: string,
): Promise<MonthlyPraemienSummaryResponse> {
  const objectUserId = new mongoose.Types.ObjectId(userId);

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const summaries = await WorkdaySummary.find({
    date: {
      $gte: monthStart.toISOString().split("T")[0],
      $lte: monthEnd.toISOString().split("T")[0],
    },
    $or: [{ driver: objectUserId }, { medic: objectUserId }],
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
