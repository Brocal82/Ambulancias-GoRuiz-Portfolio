import { getAllHospitals } from "./api";
import type { Hospital } from "./types";

/**
 * Carga hospitales usando el token actual.
 * Devuelve [] si no hay token (para evitar errores y mantener comportamiento).
 */
export const fetchHospitals = async (token?: string): Promise<Hospital[]> => {
  if (!token) return [];
  return await getAllHospitals(token);
};
