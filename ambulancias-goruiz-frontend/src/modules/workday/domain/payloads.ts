//src/modules/workday/domain/payloads.ts

import type { Trip } from "./types/trip";
import type { AssignedDayFull } from "../../../modules/diensts";
import type { FinalSummaryPayload, PartialSummaryPayload } from "./types/workdaySummary";

export const sanitizeTripsForSummary = (trips: Trip[]): Trip[] => {
  return trips.map((t) => ({
    ...t,
    wasCancelled: !!t.wasCancelled,
    cancelledAtPickup: !!t.cancelledAtPickup,
    // Mantiene tu regla actual: countsTrip solo 1 o 0, por defecto 1
    countsTrip: typeof t.countsTrip === "number" ? (t.countsTrip === 1 ? 1 : 0) : 1,
  }));
};

export const calcTotalDienstKm = (initialKm: number, finalKm: number): number => {
  return finalKm - initialKm;
};

export const buildFinalSummaryPayload = (args: {
  today: string;
  assignedDay: AssignedDayFull;
  ambulanceId: string;
  ambulanceNumber: string;
  initialKm: number;
  finalKm: number;
  trips: Trip[];
  extraNote?: string;
}): FinalSummaryPayload => {
  const totalDienstKm = calcTotalDienstKm(args.initialKm, args.finalKm);

  return {
    date: args.today,
    assignmentId: args.assignedDay.assignmentId,

    driver: args.assignedDay.driver._id,
    medic: args.assignedDay.medic._id,

    ambulanceId: args.ambulanceId,
    ambulanceNumber: args.ambulanceNumber,

    initialKm: args.initialKm,
    finalKm: args.finalKm,
    totalDienstKm,

    trips: sanitizeTripsForSummary(args.trips),

    extraNote: args.extraNote,
    isFinalClosure: true,

    dienstNumber: args.assignedDay.dienstNumber,
    startTime: args.assignedDay.startTime,
    endTime: args.assignedDay.endTime,
  };
};

export const buildPartialSummaryPayload = (args: {
  today: string;
  assignedDay: AssignedDayFull;
  ambulanceId: string;
  ambulanceNumber: string;
  initialKm: number;
  finalKm: number;
  trips: Trip[];
  partialClosureReason: string;
}): PartialSummaryPayload => {
  const totalDienstKm = calcTotalDienstKm(args.initialKm, args.finalKm);

  return {
    date: args.today,
    assignmentId: args.assignedDay.assignmentId,

    driver: args.assignedDay.driver._id,
    medic: args.assignedDay.medic._id,

    ambulanceId: args.ambulanceId,
    ambulanceNumber: args.ambulanceNumber,

    initialKm: args.initialKm,
    finalKm: args.finalKm,
    totalDienstKm,

    trips: sanitizeTripsForSummary(args.trips),

    partialClosureReason: args.partialClosureReason,
    isFinalClosure: false,

    dienstNumber: args.assignedDay.dienstNumber,
    startTime: args.assignedDay.startTime,
    endTime: args.assignedDay.endTime,
  };
};
