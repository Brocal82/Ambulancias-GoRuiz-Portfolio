import { apiRequest } from "./http";

export type WorkerPayrollDocument = {
  _id: string;
  filename: string;
  originalName: string;
  year?: number;
  month?: number;
  matchStatus: "manual" | "matched" | "unmatched";
  createdAt: string;
};

export async function getMyPayrollDocuments(): Promise<WorkerPayrollDocument[]> {
  return apiRequest<WorkerPayrollDocument[]>("/payroll/mine", {
    method: "GET",
    requiresAuth: true,
  });
}
