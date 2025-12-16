//src/api/praemienHistory.ts
import axios from "./axios";

export interface MonthlyPraemieSavePayload {
  month: string; // Ejemplo: '2025-07'
  averagePatients: number;
  premieLevel: string;
}

export async function saveMonthlyPraemie(
  token: string,
  payload: MonthlyPraemieSavePayload,
): Promise<void> {
  await axios.post("/praemien/save-monthly", payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
