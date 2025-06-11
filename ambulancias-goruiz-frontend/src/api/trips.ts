//frontend/src/api/trips.ts
import axios from './axios';
import type { Trip, TripData } from '../types/trip';

// Crear un viaje
export const createTrip = async (tripData: TripData, token: string): Promise<Trip> => {
  const response = await axios.post('/trips', tripData, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

// Obtener viajes por fecha
export const getTripsByDate = async (date: string, token: string): Promise<Trip[]> => {
  const response = await axios.get(`/trips/date/${date}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};
