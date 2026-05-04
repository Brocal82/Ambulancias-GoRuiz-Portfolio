import { apiRequest } from "./http";

export type MonthlyPraemienSummaryDay = {
  date: string;
  totalCountedPatients: number;
};

export type MonthlyPraemienSummaryResponse = {
  monthlyData: MonthlyPraemienSummaryDay[];
  averagePatients: number;
};

export async function getMonthlyPraemienSummary(): Promise<MonthlyPraemienSummaryResponse> {
  return apiRequest<MonthlyPraemienSummaryResponse>("/praemien/monthly-summary", {
    method: "GET",
    requiresAuth: true,
  });
}
