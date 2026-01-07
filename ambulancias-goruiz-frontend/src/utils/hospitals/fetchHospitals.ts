import { getAllHospitals } from "../../api/hospitals";
import type { Hospital } from "../../types/hospital";

/**
 * Carga hospitales usando el token actual.
 * Devuelve [] si no hay token (para evitar errores y mantener comportamiento).
 */
export const fetchHospitals = async (token?: string): Promise<Hospital[]> => {
  if (!token) return [];
  return await getAllHospitals(token);
};
