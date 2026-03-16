export interface MonthlyPraemienSummaryDay {
  date: string;
  totalCountedPatients: number;
}

export interface MonthlyPraemienSummaryResponse {
  monthlyData: MonthlyPraemienSummaryDay[];
  averagePatients: number;
}

export interface PraemienMonthlyHistoryItem {
  year: number;
  month: number;
  averagePatients: number;
}
