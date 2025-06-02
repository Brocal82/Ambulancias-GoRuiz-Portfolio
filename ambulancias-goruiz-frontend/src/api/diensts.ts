import axios from './axios';
import type { Dienst } from '../types/dienst';


export const getDienstByUser = async (userId: string, token: string): Promise<Dienst[]> => {
  try {
    const response = await axios.get<Dienst[]>(`/diensts/user/${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`}
      });
    return response.data;
  } catch (error) {
    console.error("Error al obtener los diensts del usuario:", error);
    throw error;
  }
};

export const getAllDiensts = async (token: string): Promise<Dienst[]> => {
  try {
    const response = await axios.get<Dienst[]>(`/diensts`, {
      headers: {
        Authorization: `Bearer ${token}`}
      });
    return response.data;
  } catch (error) {
    console.error("Error al obtener todos los diensts:", error);
    throw error;
  }
};

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

export const removeAssignment = async (dienstId: string, date: string, token: string): Promise<void> => {
  await axios.patch(`/diensts/${dienstId}/remove-assignment`, { date }, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

import type { AssignedDay } from '../types/assignedDay';

export const getAssignedDaysForUser = async (userId: string, token: string): Promise<AssignedDay[]> => {
  const response = await axios.get(`http://localhost:5000/api/diensts/assigned-days/${userId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};


export const createDienst = async (dienstData: Partial<Dienst>, token: string): Promise<Dienst> => {
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

export const generateDienstsForWeek = async (weekStartDate: string, token: string): Promise<void> => {
  await axios.post(
    '/diensts/generate-week',
    { weekStartDate },
    { headers: { Authorization: `Bearer ${token}` } }
  );
};

export const deleteDienstsForWeek = async (weekStartDate: string, token: string): Promise<void> => {
  await axios.post(
    '/diensts/delete-week',
    { weekStartDate },
    { headers: { Authorization: `Bearer ${token}` } }
  );
};




