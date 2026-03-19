import axios from "../../../api/axios";
import type { Ambulance } from "./types";
// ✅ GET todas las ambulancias (admin)
export const getAllAmbulances = async (): Promise<Ambulance[]> => {
  const { data } = await axios.get("/ambulances");
  return data;
};

// ✅ GET por ID
export const getAmbulanceById = async (id: string): Promise<Ambulance> => {
  const { data } = await axios.get(`/ambulances/${id}`);
  return data;
};

// ✅ POST nueva ambulancia
export const createAmbulance = async (
  ambulance: Omit<Ambulance, "_id">,
): Promise<Ambulance> => {
  const { data } = await axios.post("/ambulances", ambulance);
  return data;
};

// ✅ PUT actualizar ambulancia
export const updateAmbulance = async (
  id: string,
  ambulance: Partial<Ambulance>,
): Promise<Ambulance> => {
  const { data } = await axios.put(`/ambulances/${id}`, ambulance);
  return data;
};

// ✅ DELETE ambulancia
export const deleteAmbulance = async (id: string): Promise<void> => {
  await axios.delete(`/ambulances/${id}`);
};