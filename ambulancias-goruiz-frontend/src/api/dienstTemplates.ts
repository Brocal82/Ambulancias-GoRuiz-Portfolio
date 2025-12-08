// frontend/src/api/dienstTemplates.ts
import api from './axios';
import type { DienstTemplate, DaySchedule } from '../types/dienst';

// Datos necesarios para crear/editar una plantilla
export interface DienstTemplateInput {
  dienstNumber: number;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  daysOff: number[]; // 0=domingo, ..., 6=sábado
  isActive?: boolean;

  /**
   * Horario específico por día de la semana.
   * Opcional: si no se envía, el backend usará startTime/endTime/daysOff.
   */
  perDaySchedule?: DaySchedule[];
}

/**
 * GET /diensts/templates
 * Lista todas las plantillas de Dienst
 */
export const getDienstTemplates = async (token: string): Promise<DienstTemplate[]> => {
  const response = await api.get<DienstTemplate[]>('/diensts/templates', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

/**
 * POST /diensts/templates
 * Crea una nueva plantilla de Dienst
 */
export const createDienstTemplate = async (
  data: DienstTemplateInput,
  token: string
): Promise<DienstTemplate> => {
  const response = await api.post<DienstTemplate>('/diensts/templates', data, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

/**
 * PUT /diensts/templates/:id
 * Actualiza una plantilla de Dienst
 */
export const updateDienstTemplate = async (
  id: string,
  data: DienstTemplateInput,
  token: string
): Promise<DienstTemplate> => {
  const response = await api.put<DienstTemplate>(`/diensts/templates/${id}`, data, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

/**
 * DELETE /diensts/templates/:id
 * Elimina una plantilla de Dienst
 */
export const deleteDienstTemplate = async (id: string, token: string): Promise<void> => {
  await api.delete(`/diensts/templates/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};
