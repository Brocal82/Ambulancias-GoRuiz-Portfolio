import axios from './axios';
import type { Ambulance } from '../types/ambulance';

export const getAllAmbulances = async (): Promise<Ambulance[]> => {
  const { data } = await axios.get('/ambulances');
  return data;
};

export const getAmbulanceById = async (id: string): Promise<Ambulance> => {
  const { data } = await axios.get(`/ambulances/${id}`);
  return data;
};

export const createAmbulance = async (ambulance: Omit<Ambulance, '_id'>): Promise<Ambulance> => {
  const { data } = await axios.post('/ambulances', ambulance);
  return data;
};

export const updateAmbulance = async (id: string, ambulance: Partial<Ambulance>): Promise<Ambulance> => {
  const { data } = await axios.put(`/ambulances/${id}`, ambulance);
  return data;
};

export const deleteAmbulance = async (id: string): Promise<void> => {
  await axios.delete(`/ambulances/${id}`);
};
