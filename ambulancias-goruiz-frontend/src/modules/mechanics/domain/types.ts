export interface MechanicsIssueAttachment {
  url: string;
  originalName?: string;
  mimetype?: string;
  size?: number;
  storedFilename?: string;
}

export type MechanicsWorkOrderStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface MechanicsWorkOrder {
  _id: string;
  companyId: string;
  ambulanceId: string;
  ambulanceNumber: string;
  title: string;
  description?: string;
  status: MechanicsWorkOrderStatus;
  plannedFor?: string | null;
  assignedTo?: string | null;
  createdBy: string;
  completedAt?: string | null;
  completedBy?: string | null;
  completionNotes?: string;
  cancelledAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface MechanicsIssue {
  _id: string;
  dienstNumber: number;
  date: string;
  startTime: string;
  endTime: string;
  team: string;
  ambulanceNumber: string;
  ambulanceId?: string;
  finalKm: number;
  timestamp: string;
  issueText: string;
  driver: string;
  medic: string;
  isSeen?: boolean;
  seenAt?: string | null;
  attachments?: MechanicsIssueAttachment[];
}
