// backend/src/types/Dienst.ts
export interface UserRef {
  _id: string;
  name: string;
  lastName: string;
  pscheinExpiry?: string;
}

export interface AssignedDay {
  dienstId: string;
  dienstNumber: number;
  assignmentId: string; // ✅ Añadido
  date: string;
  startTime: string;
  endTime: string;
  vehicleNumber: string;
  driver: UserRef | string;
  medic: UserRef | string;
}



