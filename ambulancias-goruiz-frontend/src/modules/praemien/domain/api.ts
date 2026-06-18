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

export type PraemienRuleValidity = {
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
};

export type PraemienRule =
  | (PraemienRuleValidity & {
      id?: string;
      label?: string;
      enabled: boolean;
      multiplier: number;
      type: "km";
      minKm: number;
      maxKm?: number | null;
    })
  | (PraemienRuleValidity & {
      id?: string;
      label?: string;
      enabled: boolean;
      multiplier: number;
      type: "weekday";
      weekdays: number[];
    })
  | (PraemienRuleValidity & {
      id?: string;
      label?: string;
      enabled: boolean;
      multiplier: number;
      type: "dienstStartTime";
      startTimeFrom: string;
      startTimeTo: string;
    })
  | (PraemienRuleValidity & {
      id?: string;
      label?: string;
      enabled: boolean;
      multiplier: number;
      type: "weekdayDienstStartTime";
      weekdays: number[];
      startTimeFrom: string;
      startTimeTo: string;
    })
  | (PraemienRuleValidity & {
      id?: string;
      label?: string;
      enabled: boolean;
      multiplier: number;
      type: "weekdayPickupTime";
      weekdays: number[];
      pickupTimeFrom: string;
      pickupTimeTo: string;
    });

export type PraemienRuleConfig = {
  version: 1;
  rules: PraemienRule[];
  cancelledTripPolicy: "excludeUnlessCountsTrip";
};

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

export async function getPraemienRules(): Promise<PraemienRuleConfig> {
  const response = await axios.get<PraemienRuleConfig>("/praemien/rules");
  return response.data;
}

export async function updatePraemienRules(
  rules: PraemienRuleConfig,
): Promise<PraemienRuleConfig> {
  const response = await axios.patch<PraemienRuleConfig>("/praemien/rules", rules);
  return response.data;
}
