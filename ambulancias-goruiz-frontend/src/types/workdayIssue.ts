export interface WorkdayIssue {
  _id: string;
  dienstNumber: number;
  date: string;
  startTime: string;
  endTime: string;
  team: string;
  ambulanceNumber: string;
  ambulanceId: string;
  finalKm: number;
  timestamp: string;
  issueText: string;
  driver: string;
  medic: string;

  /** NUEVO: marcado como visto en AdminMechanicsPage al expandir por primera vez */
  isSeen?: boolean;
  /** NUEVO: fecha/hora de visto (ISO string) */
  seenAt?: string | null;
}
