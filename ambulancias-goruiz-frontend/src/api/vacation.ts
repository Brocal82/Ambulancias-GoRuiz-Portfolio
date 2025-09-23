//frontend/src/api/vacation.ts
import axiosInstance from './axios';
import type { IVacationRequest } from '../types/vacationRequest';

interface VacationRequestPayload {
  startDate: string;
  endDate: string;
}

// Crear nueva solicitud
export const createVacationRequest = async (token: string, data: VacationRequestPayload) => {
  const response = await axiosInstance.post('/vacations', data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

// Obtener todas las solicitudes (solo admin)
export const getVacationRequests = async (token: string) => {
  const response = await axiosInstance.get('/vacations', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

interface UpdateVacationPayload {
  status?: 'pending' | 'accepted' | 'cancelled' | 'option_sent';
  adminOptionStartDate?: string;
  adminOptionEndDate?: string;
  adminNote?: string;
}

// Actualizar una solicitud (solo admin)
export const updateVacationRequest = async (token: string, id: string, data: UpdateVacationPayload) => {
  const response = await axiosInstance.patch(`/vacations/${id}`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

// Obtener solicitudes del trabajador logueado
export const getUserVacationRequests = async (token: string) => {
  const response = await axiosInstance.get('/vacations/user', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

interface RespondAlternativePayload {
  accept: boolean;
}

// Responder a opción alternativa (aceptar o rechazar)
export const respondToAlternativeDate = async (token: string, id: string, data: RespondAlternativePayload) => {
  const response = await axiosInstance.post(`/vacations/${id}/respond`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

// Eliminar solicitud (solo admin)
export const deleteVacationRequest = async (token: string, id: string) => {
  const response = await axiosInstance.delete(`/vacations/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

/* =========================
   NUEVO: contador pendientes
   ========================= */

type VacationStatusCount = IVacationRequest['status']; // reutiliza los literales del tipo

interface VacationCountResponse {
  count: number;
}

/**
 * Devuelve el número de solicitudes de vacaciones con el estado indicado (por defecto: 'pending').
 * Usa GET /vacations/count?status=<status> y devuelve un number.
 */
export const getVacationPendingCount = async (
  token: string,
  status: VacationStatusCount = 'pending'
): Promise<number> => {
  try {
    const response = await axiosInstance.get<VacationCountResponse>('/vacations/count', {
      params: { status },
      headers: { Authorization: `Bearer ${token}` },
    });
    return typeof response.data?.count === 'number' ? response.data.count : 0;
  } catch (error: any) {
    const message =
      error?.response?.data?.message ||
      error?.message ||
      'Error al obtener el contador de solicitudes de vacaciones';
    throw new Error(message);
  }
};

