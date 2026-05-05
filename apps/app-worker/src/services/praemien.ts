import { apiRequest } from "./http";

export type MonthlyPraemienSummaryDay = {
  date: string;
  totalCountedPatients: number;
};

export type MonthlyPraemienSummaryResponse = {
  monthlyData: MonthlyPraemienSummaryDay[];
  averagePatients: number;
};

export type MonthlyPraemieHistoryItem = {
  year: number;
  month: number;
  averagePatients: number;
};

export type PraemienManualDailyStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "reopened";

export type ManualDailyEntryDto = {
  date: string;
  originalWorkerValue: number;
  workerSubmittedValue: number;
  workerSubmittedAt: string;
  adminFinalValue: number | null;
  status: PraemienManualDailyStatus;
  rejectionReason: string | null;
  adminReviewedAt: string | null;
  adminReviewedBy: string | null;
  adminReviewedByName: string | null;
  reopenedAt: string | null;
  reopenedBy: string | null;
  reopenNote: string | null;
};

export async function getMonthlyPraemienSummary(): Promise<MonthlyPraemienSummaryResponse> {
  return apiRequest<MonthlyPraemienSummaryResponse>("/praemien/monthly-summary", {
    method: "GET",
    requiresAuth: true,
  });
}

export async function getPraemienMonthlyHistory(): Promise<MonthlyPraemieHistoryItem[]> {
  return apiRequest<MonthlyPraemieHistoryItem[]>("/praemien/monthly-history", {
    method: "GET",
    requiresAuth: true,
  });
}

export async function putMyManualDailyEntry(body: {
  date: string;
  workerSubmittedValue: number;
  status?: "draft" | "submitted";
}): Promise<ManualDailyEntryDto> {
  return apiRequest<ManualDailyEntryDto>("/praemien/manual-daily", {
    method: "PUT",
    requiresAuth: true,
    body: JSON.stringify(body),
  });
}

export async function getMyManualDailyEntriesForMonth(
  year: number,
  month: number,
): Promise<ManualDailyEntryDto[]> {
  const params = new URLSearchParams({
    year: String(year),
    month: String(month),
  });
  return apiRequest<ManualDailyEntryDto[]>(`/praemien/manual-daily/month?${params.toString()}`, {
    method: "GET",
    requiresAuth: true,
  });
}

export async function getMyFinalClosureDatesForMonth(
  year: number,
  month: number,
): Promise<string[]> {
  const params = new URLSearchParams({
    year: String(year),
    month: String(month),
  });
  const response = await apiRequest<{ dates: string[] }>(
    `/praemien/manual-daily/final-closure-dates?${params.toString()}`,
    {
      method: "GET",
      requiresAuth: true,
    },
  );
  return Array.isArray(response.dates) ? response.dates : [];
}

export async function getMyManualDailyEntryForDay(
  date: string,
): Promise<ManualDailyEntryDto | null> {
  const params = new URLSearchParams({ date });
  return apiRequest<ManualDailyEntryDto | null>(`/praemien/manual-daily/day?${params.toString()}`, {
    method: "GET",
    requiresAuth: true,
  });
}
