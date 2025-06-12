// frontend/src/types/assignedDay.ts
import type { UserRef } from "./dienst";

export interface AssignedDay {
  dienstId: string;
  dienstNumber: number;
  assignmentId: string;
  date: string;
  startTime: string;
  endTime: string;
  vehicleNumber: string;
  driver: UserRef;
  medic: UserRef;
}
