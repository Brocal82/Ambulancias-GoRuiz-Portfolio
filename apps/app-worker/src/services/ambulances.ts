import { apiRequest } from "./http";

export type AmbulanceListItem = {
  _id: string;
  ambulanceNumber?: string;
  licensePlate?: string;
  brand?: string;
  modelName?: string;
};

export async function getAmbulancesList(): Promise<AmbulanceListItem[]> {
  return apiRequest<AmbulanceListItem[]>("/ambulances", {
    method: "GET",
    requiresAuth: true,
  });
}
