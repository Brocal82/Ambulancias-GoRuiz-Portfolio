export interface WorkdayIssue {
  _id: string;
  dienstNumber: number;
  date: string;
  startTime: string;
  endTime: string;
  team: string;
  vehicleNumber: string;
  ambulanceId: string;
  finalKm: number;
  timestamp: string;
  issueText: string;
  driver: string;
  medic: string;
}
