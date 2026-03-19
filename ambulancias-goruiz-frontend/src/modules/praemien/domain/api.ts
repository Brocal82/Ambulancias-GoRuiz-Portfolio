// src/modules/praemien/domain/api.ts
import axios from "../../../api/axios";

export interface MonthlyPraemienDay {
  date: string;
  totalCountedPatients: number;
}

export interface MonthlyPraemienResponse {
  monthlyData: MonthlyPraemienDay[];
  averagePatients: number;
}

export interface MonthlyPraemieHistoryItem {
  year: number;
  month: number;
  averagePatients: number;
}

// Obtener resumen mensual (actual)
export async function getMonthlyPraemienSummary(
  userId?: string,
): Promise<MonthlyPraemienResponse> {
  const params = userId ? { userId } : undefined;
  const response = await axios.get<MonthlyPraemienResponse>(
    "/praemien/monthly-summary",
    { params },
  );
  return response.data;
}

// Obtener historial mensual (prämien anteriores)
export async function getPraemienMonthlyHistory(
  userId?: string,
): Promise<MonthlyPraemieHistoryItem[]> {
  const params = userId ? { userId } : undefined;
  const response = await axios.get<MonthlyPraemieHistoryItem[]>(
    "/praemien/monthly-history",
    { params },
  );
  return response.data;
}
