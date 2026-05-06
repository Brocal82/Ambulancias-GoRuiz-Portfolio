import { apiRequest } from "./http";

export type VacationRequestStatus =
  | "pending"
  | "accepted"
  | "cancelled"
  | "option_sent"
  | "cancel_requested";

export type VacationRequestItem = {
  _id: string;
  user: {
    _id: string;
    name: string;
    lastName: string;
    email?: string;
  };
  startDate: string;
  endDate: string;
  requestedAt: string;
  status: VacationRequestStatus;
  adminOptionStartDate?: string;
  adminOptionEndDate?: string;
  adminNote?: string;
  userResponse?: "accepted" | "cancelled";
};

export type VacationAvailabilityDay = {
  day: number;
  approvedCount: number;
  pendingCount: number;
  remaining: number;
  state: "green" | "yellow" | "red";
};

export type VacationAvailabilityResponse = {
  year: number;
  month: number;
  maxPerDay: number;
  days: VacationAvailabilityDay[];
};

export async function getMyVacationRequests(): Promise<VacationRequestItem[]> {
  return apiRequest<VacationRequestItem[]>("/vacations/user", {
    method: "GET",
    requiresAuth: true,
  });
}

export async function createVacationRequest(payload: {
  startDate: string;
  endDate: string;
}): Promise<VacationRequestItem> {
  return apiRequest<VacationRequestItem>("/vacations", {
    method: "POST",
    requiresAuth: true,
    body: JSON.stringify(payload),
  });
}

export async function cancelMyVacationRequest(id: string): Promise<VacationRequestItem> {
  return apiRequest<VacationRequestItem>(`/vacations/${id}/cancel`, {
    method: "PATCH",
    requiresAuth: true,
    body: JSON.stringify({}),
  });
}

export async function respondToAlternativeDate(
  id: string,
  payload: { accept: boolean },
): Promise<VacationRequestItem> {
  return apiRequest<VacationRequestItem>(`/vacations/${id}/respond`, {
    method: "POST",
    requiresAuth: true,
    body: JSON.stringify(payload),
  });
}

export async function getVacationAvailability(
  year: number,
  month: number,
): Promise<VacationAvailabilityResponse> {
  const query = `?year=${encodeURIComponent(String(year))}&month=${encodeURIComponent(String(month))}`;
  return apiRequest<VacationAvailabilityResponse>(`/vacations/availability${query}`, {
    method: "GET",
    requiresAuth: true,
  });
}

export async function removeMyDeniedVacationRequest(id: string): Promise<void> {
  await apiRequest(`/vacations/${id}/mine`, {
    method: "DELETE",
    requiresAuth: true,
  });
}
