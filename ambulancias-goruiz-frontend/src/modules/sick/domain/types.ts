export type SickLeaveStatus = "pending" | "accepted" | "rejected";
export type SickVerificationStatus =
  | "not_required"
  | "pending"
  | "received"
  | "overdue";

export interface SickLeave {
  _id: string;
  user:
    | string
    | {
        _id: string;
        name: string;
        lastName: string;
        email?: string;
        role?: "admin" | "worker";
      };
  startDate: string;
  endDate: string;
  status: SickLeaveStatus;
  note?: string;
  documentUrl?: string;
  documents?: string[];
  requiresDocument?: boolean;
  verificationStatus?: SickVerificationStatus;
  documentDueAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SickFlag {
  hasSickInRange: boolean;
  sickStartInRange?: string;
  sickUntilInRange?: string;
  sickStartFull?: string;
  sickUntilFull?: string;
}

export type SickFlagsByUser = Record<string, SickFlag>;
