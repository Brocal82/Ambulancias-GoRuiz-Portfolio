import axiosInstance from './axios';

interface VacationRequestPayload {
  startDate: string;
  endDate: string;
}

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
  alternativeStartDate?: string;
  alternativeEndDate?: string;
  adminNote?: string;
}

// Actualizar una solicitud (solo admin)
export const updateVacationRequest = async (token: string, id: string, data: UpdateVacationPayload) => {
  const response = await axiosInstance.patch(`/vacations/${id}`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

