import type { User } from "../../../types/user";

export interface Team {
  _id: string;
  driver: User;
  medic: User;
  createdAt?: string;
  updatedAt?: string;

  rotationMode?: "rotating" | "fixed" | "none";
  fixedDienstNumber?: number | null;

  ambulanceId?: {
    _id: string;
    ambulanceNumber: string;
    brand?: string;
    modelName?: string;
    licensePlate?: string;
  } | null;
}

export interface CreateTeamPayload {
  driver: string;
  medic: string;

  rotationMode?: "rotating" | "fixed" | "none";

  fixedDienstNumber?: number | null;

  ambulanceId?: string | null;
}

export interface UpdateTeamPayload {
  driver: string;
  medic: string;
  rotationMode?: "rotating" | "fixed" | "none";
  fixedDienstNumber?: number | null;
  ambulanceId?: string | null;
}

export interface UsedTeamsForWeekResponse {
  usedTeamIds: string[];
}