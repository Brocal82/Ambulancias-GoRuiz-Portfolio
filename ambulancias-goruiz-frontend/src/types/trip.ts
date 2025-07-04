// frontend/src/types/trip.ts

export interface Trip {
  _id?: string;
  date: string;
  assignmentId: string;
  driver: string;
  medic: string;
  auftragNumber: string;
  patientName: string;
  fromAddress: string;
  toAddress: string;
  timeWarning: string;    // hora aviso
  timeAtHome: string;     // hora llegada domicilio
  timePickup: string;     // hora recogida paciente
  timeArrival: string;    // hora llegada destino
  timeEnd: string;        // hora libre
  kmStart: number;        // ✅ correcto para cálculos
  kmEnd: number;
  totalKm?: number;       // nuevo, total km punto A a B
  reports?: string;       // nuevo, observaciones
  countsForSummary: boolean;
  wasCancelled: boolean;
  cancelledAtPickup: boolean;
  countsTrip?: number;
  sentInSummary?: boolean;

}

// Tipo para creación: igual que Trip pero sin _id y totalKm (que se calcula backend)
export type TripData = Omit<Trip, '_id' | 'totalKm'>;



