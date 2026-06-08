import { endOfMonth, startOfMonth } from "date-fns";
import mongoose from "mongoose";
import { WorkdaySummary } from "../../workday-summary";
import PraemienManualDailyEntry from "../models/praemien-manual-daily-entry.model";
import { MonthlyPraemienSummaryResponse } from "../types/praemien.types";
import { formatLocalYmd } from "../utils/localCalendarYmd";
import { getCompanyObjectIdForPraemienUser } from "./resolvePraemienUserCompany";
import { getEffectiveManualPraemienContextForUser } from "./resolve-effective-manual-praemien.service";
/**
 * Automatic monthly stats: sum per calendar day from **all** workday closures
 * (partial + final). Each closure stores only its tramo's trips (`sentInSummary`
 * on prior trips), so summing partials and the final for the same team/day is correct.
 *
 * `isReviewed` is intentionally NOT a gate — admin review is a workday workflow
 * step; workers see live totals before review. See DOMAIN-praemien.md.
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
      $gte: formatLocalYmd(monthStart),
      $lte: formatLocalYmd(monthEnd),
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
 * Current calendar month summary from **approved** manual daily rows only
 * (Phase 5 live view; closed months use snapshots via history).
 */
async function computeApprovedManualStatsCurrentMonth(
  userId: string,
  companyOid: mongoose.Types.ObjectId,
  monthStart: Date,
  monthEnd: Date,
): Promise<MonthlyPraemienSummaryResponse> {
  const start = formatLocalYmd(monthStart);
  const end = formatLocalYmd(monthEnd);
  const userOid = new mongoose.Types.ObjectId(userId);

  const rows = await PraemienManualDailyEntry.find({
    companyId: companyOid,
    userId: userOid,
    date: { $gte: start, $lte: end },
    status: "approved",
  })
    .select("date adminFinalValue workerSubmittedValue")
    .sort({ date: 1 })
    .lean();

  if (!rows.length) {
    return {
      monthlyData: [],
      averagePatients: 0,
    };
  }

  const byDate: Record<string, number> = {};
  for (const r of rows) {
    const dk = String((r as { date: unknown }).date).split("T")[0];
    byDate[dk] = approvedDayValue(
      r as { adminFinalValue?: unknown; workerSubmittedValue?: unknown },
    );
  }

  const monthlyData = Object.entries(byDate).map(([date, totalCountedPatients]) => ({
    date,
    totalCountedPatients,
  }));

  const totalPatients = monthlyData.reduce((acc, day) => acc + day.totalCountedPatients, 0);
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

  const manualCtx = await getEffectiveManualPraemienContextForUser(userId);
  if (manualCtx.isEffectiveManual) {
    return computeApprovedManualStatsCurrentMonth(
      userId,
      manualCtx.companyObjectId,
      monthStart,
      monthEnd,
    );
  }

  return computeMonthlyPraemienStatsForUser(userId, monthStart, monthEnd);
}
