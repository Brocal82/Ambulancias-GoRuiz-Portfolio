// backend/src/types/Trip.ts

import { Types } from 'mongoose';

export interface Trip {
  _id?: string;
  date: string;
  assignmentId: Types.ObjectId | string;
  driver: Types.ObjectId | string;
  medic: Types.ObjectId | string;
  auftragNumber: string;
  patientName: string;
  fromAddress: string;
  toAddress: string;
  timeWarning: string;
  timePickup: string;
  timeArrival: string;
  timeEnd: string;
  kmStart: number;
  kmEnd: number;
  wasCancelled: boolean;
  cancelledAtPickup: boolean;
}
