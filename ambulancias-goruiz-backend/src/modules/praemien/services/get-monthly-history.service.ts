import mongoose from "mongoose";
import { WorkdaySummary } from "../../workday-summary";
import MonthlyPraemie from "../models/monthly-praemie.model";
import { PraemienMonthlyHistoryItem } from "../types/praemien.types";
import { getCompanyObjectIdForPraemienUser } from "./resolvePraemienUserCompany";
import {
  calendarMonthKey,
  getEffectiveManualPraemienContextForUser,
} from "./resolve-effective-manual-praemien.service";
import {
  ensureManualMonthCloseSnapshot,
  ymKeyFromDateString,
} from "./ensure-manual-month-close-snapshot.service";

function aggregateWorkdaySummariesToHistoryItems(
  summaries: { date: unknown; totalEffectivePatients?: number }[],
  excludeYmOnOrAfter: number | null,
  currentYear: number,
  currentMonth: number,
): PraemienMonthlyHistoryItem[] {
  if (!summaries.length) {
    return [];
  }

  const groupedByDate: Record<string, number> = {};

  summaries.forEach((summary) => {
    const dateKey = String(summary.date).split("T")[0];
    const ym = ymKeyFromDateString(dateKey);
    if (ym == null) return;
    if (excludeYmOnOrAfter != null && ym >= excludeYmOnOrAfter) {
      return;
    }
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
    );
}

export async function getMonthlyHistoryForUser(
  userId: string,
): Promise<PraemienMonthlyHistoryItem[]> {
  const manualCtx = await getEffectiveManualPraemienContextForUser(userId);
  const objectUserId = new mongoose.Types.ObjectId(userId);
  const companyOid = await getCompanyObjectIdForPraemienUser(userId);

  const summaries = await WorkdaySummary.find({
    $or: [{ driver: objectUserId }, { medic: objectUserId }],
    companyId: companyOid,
  }).select("date totalEffectivePatients");

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentYm = calendarMonthKey(currentYear, currentMonth);

  if (!manualCtx.isEffectiveManual) {
    if (!summaries.length) {
      return [];
    }
    return aggregateWorkdaySummariesToHistoryItems(
      summaries as { date: unknown; totalEffectivePatients?: number }[],
      null,
      currentYear,
      currentMonth,
    );
  }

  const effYm = calendarMonthKey(
    manualCtx.effectiveFrom.year,
    manualCtx.effectiveFrom.month,
  );

  const workdayPart = aggregateWorkdaySummariesToHistoryItems(
    summaries as { date: unknown; totalEffectivePatients?: number }[],
    effYm,
    currentYear,
    currentMonth,
  );

  let y = manualCtx.effectiveFrom.year;
  let m = manualCtx.effectiveFrom.month;
  while (calendarMonthKey(y, m) < currentYm) {
    await ensureManualMonthCloseSnapshot({
      userId,
      year: y,
      month: m,
      companyObjectId: manualCtx.companyObjectId,
    });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }

  const snapRows = await MonthlyPraemie.find({
    userId,
    snapshotSource: "manual",
  })
    .select("year month averagePatients")
    .lean();

  const manualPart: PraemienMonthlyHistoryItem[] = snapRows
    .filter((row) => {
      const rYm = calendarMonthKey(row.year, row.month);
      return rYm < currentYm && rYm >= effYm;
    })
    .map((row) => ({
      year: row.year,
      month: row.month,
      averagePatients: Math.round(Number(row.averagePatients) * 2) / 2,
    }));

  const merged = new Map<string, PraemienMonthlyHistoryItem>();
  for (const item of workdayPart) {
    merged.set(`${item.year}-${item.month}`, item);
  }
  for (const item of manualPart) {
    merged.set(`${item.year}-${item.month}`, item);
  }

  return Array.from(merged.values()).sort(
    (a, b) => b.year - a.year || b.month - a.month,
  );
}
