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
  timeWarning: string;    // hora aviso
  timePickup: string;     // hora recogida paciente
  timeArrival: string;    // hora llegada destino
  timeEnd: string;        // hora libre
  kmStart: number;        // para cálculo
  kmEnd: number;
  wasCancelled: boolean;
  cancelledAtPickup: boolean;
  countsTrip?: number;       // ✅ nuevo campo: si el viaje cuenta o no
  sentInSummary?: boolean;   // ✅ nuevo campo: si ya fue enviado al resumen
  totalKm?: number;          // ✅ nuevo campo: calculado automáticamente
  reports?: string;          // ✅ nuevo campo: observaciones
}

