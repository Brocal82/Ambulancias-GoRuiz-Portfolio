// frontend/src/api/teams.ts
import api from './axios';
import type { User } from '../types/user';

export interface Team {
  _id: string;
  driver: User;
  medic: User;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateTeamPayload {
  driver: string; // userId
  medic: string;  // userId
}

// GET /api/teams
export const getTeams = async (token: string): Promise<Team[]> => {
  const res = await api.get<Team[]>('/teams', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

// POST /api/teams
export const createTeam = async (
  payload: CreateTeamPayload,
  token: string
): Promise<Team> => {
  const res = await api.post<Team>('/teams', payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

// DELETE /api/teams/:id
export const deleteTeam = async (teamId: string, token: string): Promise<void> => {
  await api.delete(`/teams/${teamId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
};
