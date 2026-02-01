// frontend/src/modules/diensts/domain/api.ts
import axios from "../../../api/axios";


import type { Dienst, AssignedDay, UpdateAssignment } from "./types";
import {
  adaptAssignedDay,
  adaptDienstAssignment,
} from "./adapters/assignmentAdapter";

// Obtener Diensts del usuario
export const getDienstByUser = async (
  userId: string,
  token: string,
): Promise<Dienst[]> => {
  const response = await axios.get<Dienst[]>(`/diensts/user/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return response.data.map((d) => ({
    ...d,
    assignments: Array.isArray(d.assignments)
      ? d.assignments.map(adaptDienstAssignment)
      : [],
  }));
};

// Obtener todos los Diensts (admin)
export const getAllDiensts = async (token: string): Promise<Dienst[]> => {
  const response = await axios.get<Dienst[]>(`/diensts`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return response.data.map((d) => ({
    ...d,
    assignments: Array.isArray(d.assignments)
      ? d.assignments.map(adaptDienstAssignment)
      : [],
  }));
};

// Actualizar un Dienst parcialmente
export const updateDienstPartial = async (
  dienstId: string,
  updateData: { assignments: UpdateAssignment[] },
  token: string,
): Promise<Dienst> => {
  const response = await axios.patch<Dienst>(`/diensts/${dienstId}`, updateData, {
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

// Intercambiar roles driver/medic en TODA la semana de un Dienst
export const swapWeekRoles = async (
  payload: { dienstNumber: number; weekStartDate: string },
  token: string,
): Promise<{
  message: string;
  swappedCount: number;
  dienstId: string;
  weekStartDate: string;
}> => {
  const res = await axios.post("/diensts/swap-week-roles", payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

