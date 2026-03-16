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

export interface SickRangeFlags {
  hasSickInRange: boolean;
  sickStartInRange?: string;
  sickUntilInRange?: string;
  sickStartFull?: string;
  sickUntilFull?: string;
}
