import axios from './axios';
import type { Hospital } from '../types/hospital';

const BASE_URL = '/hospitals';

// Obtener todos los hospitales
export const getAllHospitals = async (token: string): Promise<Hospital[]> => {
  const res = await axios.get(BASE_URL, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

// Crear un hospital
export const createHospital = async (hospital: Partial<Hospital>, token: string): Promise<Hospital> => {
  const res = await axios.post(BASE_URL, hospital, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

// Actualizar un hospital
export const updateHospital = async (id: string, updatedHospital: Partial<Hospital>, token: string): Promise<Hospital> => {
  const res = await axios.patch(`${BASE_URL}/${id}`, updatedHospital, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

// Eliminar un hospital
export const deleteHospital = async (id: string, token: string): Promise<void> => {
  await axios.delete(`${BASE_URL}/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
};
