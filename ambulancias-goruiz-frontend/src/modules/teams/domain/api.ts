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
  params: { weekStartDate: string; dienstNumber: number },
): Promise<string[]> => {
  const res = await api.get<UsedTeamsForWeekResponse>("/teams/used-for-week", {
    params: {
      weekStartDate: params.weekStartDate,
      dienstNumber: params.dienstNumber,
    },
  });

  return res.data.usedTeamIds ?? [];
};

/* -----------------------------------------------------------
   CRUD Básico
----------------------------------------------------------- */

// GET /api/teams
export const getTeams = async (): Promise<Team[]> => {
  const res = await api.get<Team[]>("/teams");
  return res.data;
};

// POST /api/teams
export const createTeam = async (payload: CreateTeamPayload): Promise<Team> => {
  const res = await api.post<Team>("/teams", payload);
  return res.data;
};

// PATCH /api/teams/:id
export const updateTeam = async (
  teamId: string,
  payload: UpdateTeamPayload,
): Promise<Team> => {
  const res = await api.patch<Team>(`/teams/${teamId}`, payload);
  return res.data;
};

// DELETE /api/teams/:id
export const deleteTeam = async (teamId: string): Promise<void> => {
  await api.delete(`/teams/${teamId}`);
};