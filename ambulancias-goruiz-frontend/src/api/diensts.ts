// frontend/src/api/diensts.ts
import axios from './axios';
import type { Dienst, AssignedDayFull } from '../types/dienst';

// Obtener Diensts del usuario
export const getDienstByUser = async (userId: string, token: string): Promise<Dienst[]> => {
  try {
    const response = await axios.get<Dienst[]>(`/diensts/user/${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error al obtener los diensts del usuario:", error);
    throw error;
  }
};

// Obtener todos los Diensts (admin)
export const getAllDiensts = async (token: string): Promise<Dienst[]> => {
  try {
    const response = await axios.get<Dienst[]>(`/diensts`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error al obtener todos los diensts:", error);
    throw error;
  }
};

// Actualizar un Dienst parcialmente
export const updateDienstPartial = async (
  dienstId: string,
  updateData: Partial<Dienst>,
  token: string
): Promise<Dienst> => {
  try {
    const response = await axios.patch<Dienst>(`/diensts/${dienstId}`, updateData, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error al actualizar dienst:", error);
    throw error;
  }
};

// Eliminar una asignación de un día
export const removeAssignment = async (
  dienstId: string,
  date: string,
  token: string
): Promise<void> => {
  await axios.patch(`/diensts/${dienstId}/remove-assignment`, { date }, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

// ✅ Obtener días asignados para un usuario (AssignedDay[])
export const getAssignedDaysForUser = async (
  userId: string,
  token: string
): Promise<AssignedDayFull[]> => {
  const response = await axios.get<AssignedDayFull[]>(`/diensts/assigned-days/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

// Crear un Dienst
export const createDienst = async (
  dienstData: Partial<Dienst>,
  token: string
): Promise<Dienst> => {
  try {
    const response = await axios.post<Dienst>(`/diensts`, dienstData, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error al crear un dienst:", error);
    throw error;
  }
};

// Generar Diensts para una semana
export const generateDienstsForWeek = async (
  weekStartDate: string,
  token: string
): Promise<void> => {
  await axios.post(
    '/diensts/generate-week',
    { weekStartDate },
    { headers: { Authorization: `Bearer ${token}` } }
  );
};

// Eliminar Diensts de una semana
export const deleteDienstsForWeek = async (
  weekStartDate: string,
  token: string
): Promise<void> => {
  await axios.post(
    '/diensts/delete-week',
    { weekStartDate },
    { headers: { Authorization: `Bearer ${token}` } }
  );
};

// Asignar Team a la semana de un Dienst
export const assignTeamToWeek = async (
  payload: { dienstNumber: number; weekStartDate: string; teamId: string },
  token: string
): Promise<{ message: string; updatedCount: number; dienstId: string; weekStartDate: string }> => {
  const res = await axios.post('/diensts/assign-team-to-week', payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

