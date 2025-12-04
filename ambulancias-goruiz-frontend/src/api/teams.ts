// frontend/src/api/teams.ts
import api from './axios';
import type { User } from '../types/user';

export interface Team {
  _id: string;
  driver: User;
  medic: User;
  createdAt?: string;
  updatedAt?: string;

  // ⚙️ Configuración de rotación del equipo
  rotationMode?: 'rotating' | 'fixed' | 'none';
  fixedDienstNumber?: number | null;

  // 🚑 Ambulancia fija populada desde backend (opcional)
  ambulanceId?: {
    _id: string;
    ambulanceNumber: string;
    brand?: string;
    modelName?: string;
    licensePlate?: string;
  } | null;
}

export interface CreateTeamPayload {
  driver: string; // userId
  medic: string;  // userId

  // ⚙️ Nueva configuración de rotación
  rotationMode?: 'rotating' | 'fixed' | 'none';

  /**
   * Número del Dienst fijo si rotationMode === 'fixed'.
   * Ejemplo: 7 → equipo siempre en el Dienst 7.
   */
  fixedDienstNumber?: number | null;

  /**
   * 🚑 Ambulancia fija opcional.
   * Si no se envía o es null, el equipo no tiene ambulancia fija.
   */
  ambulanceId?: string | null;
}

export interface UpdateTeamPayload {
  driver: string;
  medic: string;
  rotationMode?: 'rotating' | 'fixed' | 'none';
  fixedDienstNumber?: number | null;
  ambulanceId?: string | null;
}


/* -----------------------------------------------------------
   🔎 Equipos ya usados en una semana/dienst
----------------------------------------------------------- */
export interface UsedTeamsForWeekResponse {
  usedTeamIds: string[];
}

/**
 * GET /api/teams/used-for-week?weekStartDate=YYYY-MM-DD&dienstNumber=N
 * Devuelve IDs de equipos ya asignados en esa semana/dienst.
 */
export const getUsedTeamsForWeek = async (
  token: string,
  params: { weekStartDate: string; dienstNumber: number }
): Promise<string[]> => {
  const res = await api.get<UsedTeamsForWeekResponse>('/teams/used-for-week', {
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

// PATCH /api/teams/:id
export const updateTeam = async (
  teamId: string,
  payload: UpdateTeamPayload,
  token: string
): Promise<Team> => {
  const res = await api.patch<Team>(`/teams/${teamId}`, payload, {
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
