import api from "../../../api/axios";
import type {
  PayrollDocument,
  UploadPayrollPayload,
  UploadPayrollResponse,
  AssignPayrollResponse,
  WorkerPayrollDocument,
  BatchUploadPayload,
  BatchUploadResponse,
  CoverageCheckResponse,
  CoverageYearSummaryResponse,
  PayrollReadinessResponse,
} from "./types";

/** Admin: list all payroll documents scoped to their company. */
export const listPayrollDocuments = async (): Promise<PayrollDocument[]> => {
  const res = await api.get<PayrollDocument[]>("/payroll");
  return res.data;
};

/**
 * Admin: upload a payslip PDF.
 *  - With workerId → manual assignment.
 *  - Without workerId → conservative filename auto-match (Phase 2).
 * Multipart field name for the file: "payroll".
 */
export const uploadPayrollDocument = async (
  payload: UploadPayrollPayload,
): Promise<UploadPayrollResponse> => {
  const form = new FormData();
  form.append("payroll", payload.file);
  if (payload.workerId) form.append("workerId", payload.workerId);
  if (payload.year !== undefined) form.append("year", String(payload.year));
  if (payload.month !== undefined) form.append("month", String(payload.month));
  const { data } = await api.post<UploadPayrollResponse>("/payroll/upload", form);
  return data;
};

/**
 * Admin: batch-upload up to 20 payslip PDFs (Phase 5).
 * Multipart field name for the files: "payrolls".
 * Each file is auto-matched independently — no manual workerId path.
 * Returns a structured response with per-file results and a summary.
 * Partial success is intentional; check summary.failed for errors.
 */
export const uploadPayrollBatch = async (
  payload: BatchUploadPayload,
): Promise<BatchUploadResponse> => {
  const form = new FormData();
  for (const file of payload.files) {
    form.append("payrolls", file);
  }
  if (payload.year !== undefined) form.append("year", String(payload.year));
  if (payload.month !== undefined) form.append("month", String(payload.month));
  const { data } = await api.post<BatchUploadResponse>(
    "/payroll/upload/batch",
    form,
  );
  return data;
};

/** Admin: assign (or re-assign) an unmatched document to a specific worker. */
export const assignPayrollDocument = async (
  id: string,
  workerId: string,
): Promise<AssignPayrollResponse> => {
  const { data } = await api.patch<AssignPayrollResponse>(`/payroll/${id}/assign`, { workerId });
  return data;
};

/**
 * Admin: check which workers in the company have no confirmed payroll document
 * for the given period (Phase 6).
 * Both year and month are required.
 * "Missing" = no manual/matched document — unmatched documents do not count.
 * Includes all workers registered in the company; no active/inactive filtering.
 */
export const checkPayrollCoverage = async (
  year: number,
  month: number,
): Promise<CoverageCheckResponse> => {
  const { data } = await api.get<CoverageCheckResponse>("/payroll/missing", {
    params: { year, month },
  });
  return data;
};

/** Admin: yearly payroll coverage counters for the year hub grid. */
export const getPayrollCoverageYearSummary = async (
  year: number,
): Promise<CoverageYearSummaryResponse> => {
  const { data } = await api.get<CoverageYearSummaryResponse>(
    "/payroll/coverage/year",
    {
      params: { year },
    },
  );
  return data;
};

/** Admin: payroll identity readiness summary (Phase 1 — visibility only). */
export const getPayrollReadiness = async (): Promise<PayrollReadinessResponse> => {
  const { data } = await api.get<PayrollReadinessResponse>("/payroll/readiness");
  return data;
};

/** Worker: list own payroll documents (confirmed assigned only). */
export const listMyPayrollDocuments = async (): Promise<
  WorkerPayrollDocument[]
> => {
  const res = await api.get<WorkerPayrollDocument[]>("/payroll/mine");
  return res.data;
};

/**
 * Admin: soft-delete (invalidate) a payroll document.
 * Sets deletedAt on the DB record. File is retained on disk.
 * The document is immediately excluded from all listings and file access.
 */
export const invalidatePayrollDocument = async (
  id: string,
): Promise<{ payrollId: string }> => {
  const { data } = await api.patch<{ payrollId: string }>(
    `/payroll/${id}/invalidate`,
  );
  return data;
};
