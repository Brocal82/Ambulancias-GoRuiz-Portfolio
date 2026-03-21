// frontend/src/modules/workday/domain/tripsApi.ts
import axiosInstance from "../../../api/axios";
import axios, { AxiosError } from "axios";
import { getApiErrorMessage } from "../../../utils/toast";
import type { Trip, TripData } from "./types/trip";

interface ValidationError {
  message: string;
  path?: string[];
}

interface ErrorResponse {
  errors?: ValidationError[];
  message?: string;
}

export const createTrip = async (tripData: TripData): Promise<Trip> => {
  try {
    const response = await axiosInstance.post<Trip>("/trips", tripData);
    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<ErrorResponse>;

      if (axiosError.response?.data?.errors) {
        throw axiosError.response.data.errors;
      }
    }

    throw new Error(
      getApiErrorMessage(error, "Error desconocido al crear el viaje"),
    );
  }
};

export const getTripsByDate = async (
  date: string,
): Promise<Trip[]> => {
  const response = await axiosInstance.get<Trip[]>(`/trips/date/${date}`);
  return response.data;
};
