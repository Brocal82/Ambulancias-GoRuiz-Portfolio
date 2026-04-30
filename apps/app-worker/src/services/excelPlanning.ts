import { apiRequest } from "./http";

export type ExcelPlanRow = {
  dayIndex?: number;
  dayDate?: string;
  dienstNumber?: string;
  timeText?: string;
  vehicleCode?: string;
  displayNameFromExcel?: string;
  displayPartnerNameFromExcel?: string;
  primaryAmbulanceRole?: "driver" | "medic" | "both";
  partnerAmbulanceRole?: "driver" | "medic" | "both";
};

export async function getMyExcelPlanningWeek(weekStart?: string): Promise<{
  weekStart: string;
  rows: ExcelPlanRow[];
  published: boolean;
}> {
  const query = weekStart ? `?weekStart=${encodeURIComponent(weekStart)}` : "";
  return apiRequest(`/excel-planning/me${query}`, {
    method: "GET",
    requiresAuth: true,
  });
}
