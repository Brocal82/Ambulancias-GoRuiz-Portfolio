// frontend/src/modules/diensts/domain/api.ts
import axios from "../../../api/axios";
import type { Dienst, AssignedDay, UpdateAssignment } from "./types";
import {
  adaptAssignedDay,
  adaptDienstAssignment,
} from "./adapters/assignmentAdapter";

const normalizeDienst = (d: Dienst): Dienst => ({
  ...d,
  assignments: Array.isArray(d.assignments)
    ? d.assignments.map(adaptDienstAssignment)
    : [],
});


// Obtener Diensts del usuario
export const getDienstByUser = async (
  userId: string,
  token: string,
): Promise<Dienst[]> => {
  const response = await axios.get<Dienst[]>(`/diensts/user/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return response.data.map(normalizeDienst);
};

// Obtener todos los Diensts (admin)
export const getAllDiensts = async (token: string): Promise<Dienst[]> => {
  const response = await axios.get<Dienst[]>(`/diensts`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return response.data.map(normalizeDienst);
};


/** Aviso opcional PATCH /diensts/:id (descanso 10–<11 h entre turnos). */
export type MinimumRestWarning = {
  code: "minimum_rest_soft";
  message: string;
};

// Actualizar un Dienst parcialmente
export const updateDienstPartial = async (
  dienstId: string,
  updateData: { assignments: UpdateAssignment[] },
  token: string,
): Promise<Dienst & { minimumRestWarning?: MinimumRestWarning }> => {
  const response = await axios.patch<Dienst & { minimumRestWarning?: MinimumRestWarning }>(
    `/diensts/${dienstId}`,
    updateData,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const data = response.data;
  const normalized = normalizeDienst(data);
  if (data.minimumRestWarning) {
    return { ...normalized, minimumRestWarning: data.minimumRestWarning };
  }
  return normalized;
};

/** Mueve un slot entre dos Dienst de la misma semana (atómico en servidor). */
export const moveDienstSlotSameWeek = async (
  body: {
    sourceDienstId: string;
    sourceDate: string;
    targetDienstId: string;
    targetDate: string;
    role: "driver" | "medic";
    userId: string;
  },
  token: string,
): Promise<{ ok: boolean; minimumRestWarning?: MinimumRestWarning }> => {
  const response = await axios.post<{
    ok: boolean;
    minimumRestWarning?: MinimumRestWarning;
  }>(`/diensts/move-slot-same-week`, body, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

/** DnD admin cross-Dienst misma semana: hueco vacío o rebalanceo Both (validación en servidor). */
export const dndMoveCrossDienstSameWeek = async (
  body: {
    sourceDienstId: string;
    sourceDate: string;
    targetDienstId: string;
    targetDate: string;
    role: "driver" | "medic";
    targetRole?: "driver" | "medic";
    userId: string;
  },
  token: string,
): Promise<{ ok: boolean; minimumRestWarning?: MinimumRestWarning }> => {
  const response = await axios.post<{
    ok: boolean;
    minimumRestWarning?: MinimumRestWarning;
  }>(`/diensts/dnd-cross-dienst-same-week`, body, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

// Eliminar una asignación de un día
export const removeAssignment = async (
  dienstId: string,
  date: string,
  token: string,
): Promise<void> => {
  await axios.patch(
    `/diensts/${dienstId}/remove-assignment`,
    { date },
    { headers: { Authorization: `Bearer ${token}` } },
  );
};

// Obtener días asignados para un usuario
export const getAssignedDaysForUser = async (
  userId: string,
  token: string,
): Promise<AssignedDay[]> => {
  const response = await axios.get<AssignedDay[]>(
    `/diensts/assigned-days/${userId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  return response.data.map(adaptAssignedDay);
};

// Crear un Dienst
export const createDienst = async (
  dienstData: Partial<Dienst>,
  token: string,
): Promise<Dienst> => {
  const response = await axios.post<Dienst>(`/diensts`, dienstData, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

// Generar Diensts para una semana
export const generateDienstsForWeek = async (
  weekStartDate: string,
  token: string,
): Promise<void> => {
  await axios.post(
    "/diensts/generate-week",
    { weekStartDate },
    { headers: { Authorization: `Bearer ${token}` } },
  );
};

// Eliminar Diensts de una semana
export const deleteDienstsForWeek = async (
  weekStartDate: string,
  token: string,
): Promise<void> => {
  await axios.post(
    "/diensts/delete-week",
    { weekStartDate },
    { headers: { Authorization: `Bearer ${token}` } },
  );
};

// Asignar Team a la semana de un Dienst
export const assignTeamToWeek = async (
  payload: {
    dienstNumber: number;
    weekStartDate: string;
    teamId: string;
    resolvedRoles?: {
      driverId: string;
      medicId: string;
    };
  },
  token: string,
): Promise<{
  message: string;
  updatedCount: number;
  dienstId: string;
  weekStartDate: string;
  skippedByVacation?: Array<{ date: string; role: "driver" | "medic" }>;
  skippedByConflict?: Array<{ date: string; role: "driver" | "medic" }>;
  hints?: { driverExpiredButBoth?: boolean };
}> => {
  const res = await axios.post("/diensts/assign-team-to-week", payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

// Asignar UN usuario (driver/medic) a la semana de un Dienst

export const assignUserToWeek = async (
  payload: {
    dienstNumber: number;
    weekStartDate: string;
    userId: string;
    role: "driver" | "medic";
  },
  token: string,
): Promise<{
  message: string;
  updatedCount: number;
  dienstId: string;
  weekStartDate: string;
  role: "driver" | "medic";
  userId: string;
}> => {
  const res = await axios.post("/diensts/assign-user-to-week", payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

// Asignar una ambulancia a toda la semana de un Dienst
export const assignAmbulanceToWeek = async (
  payload: {
    dienstNumber: number;
    weekStartDate: string;
    ambulanceId: string;
  },
  token: string,
): Promise<{
  message: string;
  updatedCount: number;
  dienstId: string;
  weekStartDate: string;
}> => {
  const res = await axios.post("/diensts/assign-ambulance-to-week", payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

// Limpiar driver/medic de toda la semana de un Dienst
export const clearPeopleForWeek = async (
  payload: { dienstNumber: number; weekStartDate: string },
  token: string,
): Promise<{
  message: string;
  clearedCount: number;
  dienstId: string;
  weekStartDate: string;
}> => {
  const res = await axios.post("/diensts/clear-week-people", payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};


