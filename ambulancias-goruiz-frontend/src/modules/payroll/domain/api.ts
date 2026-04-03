import api from "../../../api/axios";
import type {
  PayrollDocument,
  UploadPayrollPayload,
  WorkerPayrollDocument,
  BatchUploadPayload,
  BatchUploadResponse,
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
): Promise<void> => {
  const form = new FormData();
  form.append("payroll", payload.file);
  if (payload.workerId) form.append("workerId", payload.workerId);
  if (payload.year !== undefined) form.append("year", String(payload.year));
  if (payload.month !== undefined) form.append("month", String(payload.month));
  await api.post("/payroll/upload", form);
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
): Promise<void> => {
  await api.patch(`/payroll/${id}/assign`, { workerId });
};

/** Worker: list own payroll documents (confirmed assigned only). */
export const listMyPayrollDocuments = async (): Promise<
  WorkerPayrollDocument[]
> => {
  const res = await api.get<WorkerPayrollDocument[]>("/payroll/mine");
  return res.data;
};
