export interface UserRef {
  _id: string;
  name: string;
}

export interface DienstAssignment {
  date: string;
  vehicleNumber: string;
  startTime: string;
  endTime: string;
  driver: UserRef;
  medic: UserRef;
}

export interface Dienst {
  dienstNumber: number;
  weekStartDate: string;
  weekEndDate: string;
  assignments: DienstAssignment[];
}
