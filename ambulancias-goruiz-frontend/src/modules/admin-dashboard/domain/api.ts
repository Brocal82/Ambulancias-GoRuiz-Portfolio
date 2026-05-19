import axiosInstance from "../../../api/axios";

export type AdminDashboardCounts = {
  vacations: number;
  summaries: number;
  appointments: number;
  mechanics: number;
  sickLeaves: number;
  praemienManual: number;
};

export async function getAdminDashboardCounts(): Promise<AdminDashboardCounts> {
  const { data } = await axiosInstance.get<AdminDashboardCounts>(
    "/api/admin/dashboard-counts",
  );
  return data;
}
