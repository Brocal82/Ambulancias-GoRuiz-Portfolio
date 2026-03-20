// modules/diensts/types/dienst.types.ts

export interface UserRef {
  _id: string;
  name: string;
  lastName: string;
  pscheinExpiry?: string;
}

export interface AssignedDay {
  dienstId: string;
  dienstNumber: number;
  assignmentId: string;
  date: string;
  startTime: string;
  endTime: string;
  ambulanceId?: string;
  ambulanceNumber?: string;
  driver?: string | UserRef;
  medic?: string | UserRef;
}
