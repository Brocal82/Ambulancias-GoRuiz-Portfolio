import type { MonthlyPraemienDay } from "../domain/api";
import type { ManualDailyEntryDto } from "../domain/manualDailyApi";

/** Misma lógica que WorkerPraemienPage en fase manual: días del mes + media. */
export function manualMonthSummaryFromEntries(
  entries: ManualDailyEntryDto[],
): { days: MonthlyPraemienDay[]; averagePatients: number } {
  const days = entries.map((entry) => ({
    date: entry.date,
    totalCountedPatients:
      entry.status === "approved" && entry.adminFinalValue != null
        ? entry.adminFinalValue
        : entry.workerSubmittedValue,
  }));
  const avg =
    days.length > 0
      ? days.reduce((acc, day) => acc + day.totalCountedPatients, 0) / days.length
      : 0;
  return { days, averagePatients: Math.round(avg * 2) / 2 };
}
