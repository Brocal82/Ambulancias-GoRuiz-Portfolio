export interface UserRef {
  _id: string;
  name: string;
}

export interface DienstAssignment {
  _id: string;
  date: string;
  vehicleNumber: string;
  startTime: string;
  endTime: string;
  driver: UserRef;
  medic: UserRef;
}

export interface Dienst {
  _id: string;
  dienstNumber: number;
  weekStartDate: string;
  weekEndDate: string;
  assignments: DienstAssignment[];
}
