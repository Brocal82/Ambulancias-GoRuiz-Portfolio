import { apiRequest } from "./http";

export type DienstAssignment = {
  date?: string;
  startTime?: string;
  endTime?: string;
  driver?: string | { _id?: string; name?: string; lastName?: string };
  medic?: string | { _id?: string; name?: string; lastName?: string };
  ambulanceId?: string | { _id?: string; ambulanceNumber?: string; licensePlate?: string };
  notes?: string;
};

export type Dienst = {
  _id: string;
  name?: string;
  dienstNumber?: number;
  assignments?: DienstAssignment[];
};

export async function getDienstsByUser(userId: string): Promise<Dienst[]> {
  return apiRequest<Dienst[]>(`/diensts/user/${userId}`, {
    method: "GET",
    requiresAuth: true,
  });
}
