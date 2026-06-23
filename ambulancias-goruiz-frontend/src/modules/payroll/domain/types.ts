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

  // P1.3 / P1.4 — Open evidence fields (compliance hardening)
  /** ISO timestamp of the worker's first successful authenticated file access. Null if never opened. */
  firstOpenedAt: string | null;
  /** ISO timestamp of the most recent successful authenticated file access. */
  lastOpenedAt: string | null;
  /** Total count of successful authenticated file accesses by the assigned worker. */
  openCount: number;
}

export interface UploadPayrollPayload {
  file: File;
  workerId?: string;
  year: number;
  month: number;
}

// ── Duplicate detection (Phase 8) ─────────────────────────────────────────────

/**
 * Minimal metadata returned when a possible worker+period duplicate is detected.
 * The document was saved — this is a warning only, never a block.
 */
export interface DuplicateWarning {
  payrollId: string;
  originalName: string;
  createdAt: string;
}

export interface ReplacedDocumentInfo {
  payrollId: string;
  originalName: string;
}

/** Response from POST /api/payroll/upload (Phase 8b: adds optional duplicate warning). */
export interface UploadPayrollResponse {
  status?: "uploaded";
  payrollId: string;
  matchStatus: PayrollMatchStatus;
  possibleDuplicate?: DuplicateWarning;
  replacedDocument?: ReplacedDocumentInfo;
}

/** Response from PATCH /api/payroll/:id/assign (Phase 8b: adds optional duplicate warning). */
export interface AssignPayrollResponse {
  payrollId: string;
  workerId: string;
  matchStatus: PayrollMatchStatus;
  possibleDuplicate?: DuplicateWarning;
}

// ── Batch upload (Phase 5) ────────────────────────────────────────────────────

export interface BatchUploadPayload {
  files: File[];
  year: number;
  month: number;
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
  /** Present when a confirmed document for the same worker+period already exists (Phase 8). */
  possibleDuplicate?: DuplicateWarning;
  /** Present when a previous active confirmed payroll was replaced. */
  replacedDocument?: ReplacedDocumentInfo;
}

export interface BatchUploadSummary {
  total: number;
  matched: number;
  unmatched: number;
  failed: number;
  /** Count of matched items that triggered a worker+period duplicate warning (Phase 8). */
  duplicateWarnings: number;
}

export interface BatchUploadResponse {
  summary: BatchUploadSummary;
  results: BatchResultItem[];
}

// ── Coverage check (Phase 6) ──────────────────────────────────────────────────

/** A worker entry returned when they have no confirmed payroll for a period. */
export interface CoverageWorker {
  _id: string;
  name: string;
  lastName: string;
  email: string;
  /** Null if the worker has no employeeNumber set. */
  employeeNumber: string | null;
}

/**
 * Response from GET /api/payroll/missing?year=YYYY&month=M.
 * "Missing" means no confirmed (manual or matched) payroll document for the
 * given period. This includes ALL workers registered in the company system —
 * there is no active/inactive employment filtering.
 */
export interface CoverageCheckResponse {
  period: { year: number; month: number };
  totalWorkers: number;
  coveredCount: number;
  missingCount: number;
  missingWorkers: CoverageWorker[];
  /** Unmatched documents for this period not yet assigned to any worker. */
  unmatchedDocumentsForPeriod: number;
}

export interface CoverageYearMonthItem {
  month: number;
  assignedCount: number;
}

export interface CoverageYearSummaryResponse {
  year: number;
  totalWorkers: number;
  months: CoverageYearMonthItem[];
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
