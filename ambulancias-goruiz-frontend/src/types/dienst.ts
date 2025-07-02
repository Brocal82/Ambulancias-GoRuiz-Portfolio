export interface UserRef {
  _id: string;
  name: string;
  lastName: string;
  ambulanceRole?: 'driver' | 'medic' | 'both';
  pscheinExpiry?: string;
}

export interface DienstAssignment {
  _id: string;
  date: string;
  vehicleNumber: string;
  startTime: string;
  endTime: string;
  driver: string | UserRef;
  medic: string | UserRef;
}

export interface Dienst {
  _id: string;
  dienstNumber: number;
  weekStartDate: string;
  weekEndDate: string;
  assignments: DienstAssignment[]; // ✅ Solo tipo completo
}

export interface UpdateAssignment {
  _id?: string;
  date: string;
  startTime: string;
  endTime: string;
  vehicleNumber: string;
  driver: string; // solo ID
  medic: string;  // solo ID
}

// ✅ NUEVO: tipo para días asignados que devuelve el backend
export interface AssignedDay {
  dienstId: string;
  dienstNumber: number;
  date: string;
  startTime: string;
  endTime: string;
  vehicleNumber: string;
  driver?: string;
  medic?: string;
}
