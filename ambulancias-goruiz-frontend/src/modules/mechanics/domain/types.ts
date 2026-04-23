export interface MechanicsIssueAttachment {
  url: string;
  originalName?: string;
  mimetype?: string;
  size?: number;
  storedFilename?: string;
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
