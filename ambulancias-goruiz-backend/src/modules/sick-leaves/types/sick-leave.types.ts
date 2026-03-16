export type SickVerificationStatus =
  | "not_required"
  | "pending"
  | "received"
  | "overdue";

export interface SickDocumentRequirementResult {
  requiresDocument: boolean;
  verificationStatus: SickVerificationStatus;
  documentDueAt?: Date;
}
