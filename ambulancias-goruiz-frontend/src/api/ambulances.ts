import axios from './axios';
import type { Ambulance } from '../types/ambulance';

// ✅ GET todas las ambulancias (admin)
export const getAllAmbulances = async (token: string): Promise<Ambulance[]> => {
  const { data } = await axios.get('/ambulances', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

// ✅ GET por ID
export const getAmbulanceById = async (id: string, token: string): Promise<Ambulance> => {
  const { data } = await axios.get(`/ambulances/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

// ✅ POST nueva ambulancia
export const createAmbulance = async (
  ambulance: Omit<Ambulance, '_id'>,
  token: string
): Promise<Ambulance> => {
  const { data } = await axios.post('/ambulances', ambulance, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

// ✅ PUT actualizar ambulancia
export const updateAmbulance = async (
  id: string,
  ambulance: Partial<Ambulance>,
  token: string
): Promise<Ambulance> => {
  const { data } = await axios.put(`/ambulances/${id}`, ambulance, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

// ✅ DELETE ambulancia
export const deleteAmbulance = async (id: string, token: string): Promise<void> => {
  await axios.delete(`/ambulances/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
};
