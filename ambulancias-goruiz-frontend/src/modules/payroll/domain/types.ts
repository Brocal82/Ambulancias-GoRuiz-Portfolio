export type PayrollMatchStatus = "manual" | "matched" | "unmatched";

/** Populated worker embedded in admin list responses. */
export interface PopulatedWorker {
  _id: string;
  name: string;
  lastName: string;
  email: string;
  employeeNumber?: string;
}

/** Populated uploader embedded in admin list responses. */
export interface PopulatedUploader {
  _id: string;
  name: string;
  lastName: string;
}

/**
 * Payroll document as returned by GET /api/payroll (admin).
 * fileUrl is intentionally absent — it is never sent by the backend.
 * Use `filename` with openSecureFile() to open the file securely.
 */
export interface PayrollDocument {
  _id: string;
  /** Null only for unmatched documents pending review. */
  workerId: PopulatedWorker | null;
  companyId: string;
  uploadedBy: PopulatedUploader | null;
  filename: string;
  originalName: string;
  year?: number;
  month?: number;
  matchStatus: PayrollMatchStatus;
  /** Employee number extracted from filename (if auto-match was attempted). */
  parsedEmployeeNumber?: string;
  /** Human-readable reason for unmatched state (admin review). */
  matchReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UploadPayrollPayload {
  file: File;
  workerId?: string;
  year?: number;
  month?: number;
}

// ── Batch upload (Phase 5) ────────────────────────────────────────────────────

export interface BatchUploadPayload {
  files: File[];
  year?: number;
  month?: number;
}

/** Per-file status in a batch upload response. */
export type BatchResultStatus = "matched" | "unmatched" | "failed";

export interface BatchResultItem {
  originalName: string;
  status: BatchResultStatus;
  /** Present for matched and unmatched (a document was created). */
  payrollId?: string;
  workerId?: string;
  matchStatus?: PayrollMatchStatus;
  parsedEmployeeNumber?: string;
  matchReason?: string;
  /** Present only when status is "failed" (no document created). */
  error?: string;
  year?: number;
  month?: number;
}

export interface BatchUploadSummary {
  total: number;
  matched: number;
  unmatched: number;
  failed: number;
}

export interface BatchUploadResponse {
  summary: BatchUploadSummary;
  results: BatchResultItem[];
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Payroll document as returned by GET /api/payroll/mine (worker).
 * Only the fields the backend selects for the worker are present.
 * fileUrl is intentionally absent — never sent by the backend.
 */
export interface WorkerPayrollDocument {
  _id: string;
  filename: string;
  originalName: string;
  year?: number;
  month?: number;
  matchStatus: PayrollMatchStatus;
  createdAt: string;
}
