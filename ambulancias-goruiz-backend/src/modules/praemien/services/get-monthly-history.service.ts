import mongoose from "mongoose";
import WorkdaySummary from "../../../models/workdaySummary";
import { PraemienMonthlyHistoryItem } from "../types/praemien.types";

export async function getMonthlyHistoryForUser(
  userId: string,
): Promise<PraemienMonthlyHistoryItem[]> {
  const objectUserId = new mongoose.Types.ObjectId(userId);

  const summaries = await WorkdaySummary.find({
    $or: [{ driver: objectUserId }, { medic: objectUserId }],
  }).select("date totalEffectivePatients");

  if (!summaries.length) {
    return [];
  }

  const groupedByDate: Record<string, number> = {};

  summaries.forEach((summary) => {
    const dateKey = summary.date.toString().split("T")[0];
    if (!groupedByDate[dateKey]) groupedByDate[dateKey] = 0;
    groupedByDate[dateKey] += summary.totalEffectivePatients || 0;
  });

  const monthlyGroups: Record<string, { totalPatients: number; days: number }> =
    {};

  Object.entries(groupedByDate).forEach(([dateStr, totalPatients]) => {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    const key = `${year}-${month}`;

    if (!monthlyGroups[key]) {
      monthlyGroups[key] = { totalPatients: 0, days: 0 };
    }
    monthlyGroups[key].totalPatients += totalPatients;
    monthlyGroups[key].days += 1;
  });

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  return Object.entries(monthlyGroups)
    .map(([key, value]) => {
      const [yearStr, monthStr] = key.split("-");
      const year = Number(yearStr);
      const month = Number(monthStr);
      const averagePatients = value.totalPatients / value.days;

      return {
        year,
        month,
        averagePatients: Math.round(averagePatients * 2) / 2,
      };
    })
    .filter(
      ({ year, month }) => !(year === currentYear && month === currentMonth),
    )
    .sort((a, b) => b.year - a.year || b.month - a.month);
}
