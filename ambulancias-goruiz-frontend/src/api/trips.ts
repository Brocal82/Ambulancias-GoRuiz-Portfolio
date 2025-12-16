// frontend/src/api/trips.ts
import axiosInstance from "./axios";
import axios, { AxiosError } from "axios"; // ✅ Importar axios directamente
import type { Trip, TripData } from "../types/trip";

// Tipo de errores de validación del backend
interface ValidationError {
  message: string;
  path?: string[];
}

interface ErrorResponse {
  errors?: ValidationError[];
  message?: string;
}

// ✅ Crear un nuevo viaje
export const createTrip = async (tripData: TripData): Promise<Trip> => {
  try {
    const response = await axiosInstance.post<Trip>("/trips", tripData);
    return response.data;
  } catch (error: unknown) {
    // ✅ Usar axios.isAxiosError, no axiosInstance.isAxiosError
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<ErrorResponse>;

      if (axiosError.response?.data?.errors) {
        throw axiosError.response.data.errors;
      }

      if (axiosError.response?.data?.message) {
        throw new Error(axiosError.response.data.message);
      }
    }

    throw new Error("Error desconocido al crear el viaje");
  }
};

// ✅ Obtener viajes por fecha (usa axiosInstance con baseURL = VITE_API_URL)
export const getTripsByDate = async (
  date: string,
  token: string,
): Promise<Trip[]> => {
  const response = await axiosInstance.get(`/trips/date/${date}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};
