import axios from './axios'; // Asegúrate de que axios esté configurado con baseURL y headers si hace falta

export interface MonthlyPraemienDay {
  date: string;
  totalCountedPatients: number;
}

export interface MonthlyPraemienResponse {
  monthlyData: MonthlyPraemienDay[];
  averagePatients: number;
}

export async function getMonthlyPraemienSummary(token: string): Promise<MonthlyPraemienResponse> {
  const response = await axios.get<MonthlyPraemienResponse>('/praemien/monthly-summary', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}
