// src/modules/teams/domain/api.ts
import api from "../../../api/axios";

import type {
  Team,
  CreateTeamPayload,
  UpdateTeamPayload,
  UsedTeamsForWeekResponse,
} from "./types";

export type { Team, CreateTeamPayload, UpdateTeamPayload } from "./types";

/* -----------------------------------------------------------
   🔎 Equipos ya usados en una semana/dienst
----------------------------------------------------------- */

/**
 * GET /api/teams/used-for-week?weekStartDate=YYYY-MM-DD&dienstNumber=N
 * Devuelve IDs de equipos ya asignados en esa semana/dienst.
 */
export const getUsedTeamsForWeek = async (
  token: string,
  params: { weekStartDate: string; dienstNumber: number },
): Promise<string[]> => {
  const res = await api.get<UsedTeamsForWeekResponse>("/teams/used-for-week", {
    params: {
      weekStartDate: params.weekStartDate,
      dienstNumber: params.dienstNumber,
    },
    headers: { Authorization: `Bearer ${token}` },
  });

  return res.data.usedTeamIds ?? [];
};

/* -----------------------------------------------------------
   CRUD Básico
----------------------------------------------------------- */

// GET /api/teams
export const getTeams = async (token: string): Promise<Team[]> => {
  const res = await api.get<Team[]>("/teams", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

// POST /api/teams
export const createTeam = async (
  payload: CreateTeamPayload,
  token: string,
): Promise<Team> => {
  const res = await api.post<Team>("/teams", payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

// PATCH /api/teams/:id
export const updateTeam = async (
  teamId: string,
  payload: UpdateTeamPayload,
  token: string,
): Promise<Team> => {
  const res = await api.patch<Team>(`/teams/${teamId}`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

// DELETE /api/teams/:id
export const deleteTeam = async (
  teamId: string,
  token: string,
): Promise<void> => {
  await api.delete(`/teams/${teamId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
};