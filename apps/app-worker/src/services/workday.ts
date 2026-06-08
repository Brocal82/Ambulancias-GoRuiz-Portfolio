import { apiRequest } from "./http";

export type AssignedDayUser = {
  _id: string;
  name?: string;
  lastName?: string;
};

export type AssignedDay = {
  dienstId: string;
  dienstNumber?: number;
  assignmentId: string;
  date: string;
  startTime?: string;
  endTime?: string;
  ambulanceId?: string | { _id?: string; ambulanceNumber?: string; licensePlate?: string };
  ambulanceNumber?: string;
  driver?: string | AssignedDayUser;
  medic?: string | AssignedDayUser;
};

export type WorkdayTrip = {
  _id: string;
  date: string;
  assignmentId?: string;
  auftragNumber?: string;
  patientName?: string;
  timeWarning?: string;
  timeAtHome?: string;
  timePickup?: string;
  timeArrival?: string;
  timeEnd?: string;
  kmStart?: number;
  kmEnd?: number;
  totalKm?: number;
  sentInSummary?: boolean;
  wasCancelled?: boolean;
  /** 1 = cuenta en totales de jornada; 0 = Storno registrado pero no suma (misma regla que la web). */
  countsTrip?: 0 | 1;
};

export type CreateTripPayload = {
  date: string;
  assignmentId: string;
  driver: string;
  medic: string;
  auftragNumber: string;
  patientName: string;
  fromAddress: string;
  toAddress: string;
  timeWarning: string;
  timeAtHome: string;
  timePickup: string;
  timeArrival: string;
  timeEnd: string;
  kmStart: number;
  kmEnd: number;
  wasCancelled: boolean;
  cancelledAtPickup: boolean;
  countsTrip: number;
  reports?: string;
  countsForSummary: boolean;
};

export type WorkdaySummary = {
  _id: string;
  date: string;
  assignmentId: string;
  isFinalClosure: boolean;
  totalDienstKm?: number;
  totalRealTrips?: number;
  totalEffectivePatients?: number;
  isReviewed?: boolean;
  reviewedAt?: string;
};

export type WorkdayTripSetup = {
  assignmentId: string;
  ambulanceId?: string;
  ambulanceNumber: string;
  initialKm: number;
};

export async function getAssignedDaysForWorker(userId: string): Promise<AssignedDay[]> {
  return apiRequest<AssignedDay[]>(`/diensts/assigned-days/${userId}`, {
    method: "GET",
    requiresAuth: true,
  });
}

export async function getWorkdayTripsByDate(dateKey: string): Promise<WorkdayTrip[]> {
  return apiRequest<WorkdayTrip[]>(`/trips/date/${encodeURIComponent(dateKey)}`, {
    method: "GET",
    requiresAuth: true,
  });
}

export async function getMyWorkdaySummaries(): Promise<WorkdaySummary[]> {
  return apiRequest<WorkdaySummary[]>("/workday-summary", {
    method: "GET",
    requiresAuth: true,
  });
}

export async function createWorkdayTrip(payload: CreateTripPayload): Promise<WorkdayTrip> {
  return apiRequest<WorkdayTrip>("/trips", {
    method: "POST",
    requiresAuth: true,
    body: JSON.stringify(payload),
  });
}

export async function getWorkdayTripSetup(
  assignmentId: string,
): Promise<WorkdayTripSetup | null> {
  return apiRequest<WorkdayTripSetup | null>(`/trips/setup/${assignmentId}`, {
    method: "GET",
    requiresAuth: true,
  });
}

export type WorkdayClosurePayload = {
  date: string;
  assignmentId: string;
  ambulanceId: string;
  ambulanceNumber: string;
  initialKm: number;
  finalKm: number;
  /** Server reloads trip data; only `_id` is used. */
  trips: Array<{ _id: string }>;
  checklistItems: Record<string, boolean>;
  extraNote?: string;
  o2Level?: number;
};

export async function submitWorkdayClosure(
  payload: WorkdayClosurePayload,
): Promise<WorkdaySummary> {
  return apiRequest<WorkdaySummary>("/workday-summary", {
    method: "POST",
    requiresAuth: true,
    body: JSON.stringify(payload),
  });
}

export type WorkdayPartialClosurePayload = {
  date: string;
  assignmentId: string;
  ambulanceId: string;
  ambulanceNumber: string;
  initialKm: number;
  finalKm: number;
  /** Server reloads trip data; only `_id` is used. */
  trips: Array<{ _id: string }>;
  partialClosureReason: string;
};

export async function submitPartialWorkdayClosure(
  payload: WorkdayPartialClosurePayload,
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("/workday-summary/partial", {
    method: "POST",
    requiresAuth: true,
    body: JSON.stringify(payload),
  });
}

export async function saveWorkdayTripSetup(
  assignmentId: string,
  payload: { ambulanceId?: string; ambulanceNumber: string; initialKm: number },
): Promise<WorkdayTripSetup> {
  return apiRequest<WorkdayTripSetup>(`/trips/setup/${assignmentId}`, {
    method: "PUT",
    requiresAuth: true,
    body: JSON.stringify(payload),
  });
}
