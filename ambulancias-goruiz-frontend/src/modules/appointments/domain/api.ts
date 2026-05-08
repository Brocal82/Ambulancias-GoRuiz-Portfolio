// frontend/src/modules/appointments/domain/api.ts
import axios from "../../../api/axios";
import type {
  Appointment,
  RequestAppointmentPayload,
  ProposeSlotsPayload,
  SelectSlotPayload,
  UpdateAppointmentPayload,
} from "./types";

// Worker: crear solicitud
export const requestAppointment = async (
  payload: RequestAppointmentPayload,
  token: string,
): Promise<Appointment> => {
  const { data } = await axios.post<Appointment>(
    "/appointments/requests",
    payload,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return data;
};

// Worker: mis citas
export const getMyAppointments = async (
  token: string,
): Promise<Appointment[]> => {
  const { data } = await axios.get<Appointment[]>("/appointments/my", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

// Admin: pendientes
export const getPendingAppointments = async (
  token: string,
): Promise<Appointment[]> => {
  const { data } = await axios.get<Appointment[]>("/appointments/pending", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

// Admin: pendientes + propuestas
export const getOpenAppointments = async (
  token: string,
): Promise<Appointment[]> => {
  const { data } = await axios.get<Appointment[]>("/appointments/open", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

// ✅ Admin: contador de pendientes (derivado del módulo)
export const getAppointmentsPendingCount = async (
  token: string,
): Promise<number> => {
  const { data } = await axios.get<{ count: number }>("/appointments/count", {
    headers: { Authorization: `Bearer ${token}` },
    params: { status: "pending" },
  });
  return data?.count ?? 0;
};

// (Opcional) Admin: contador genérico por estado
export const getAppointmentsCountByStatus = async (
  token: string,
  status: string,
): Promise<number> => {
  const { data } = await axios.get<{ count: number }>("/appointments/count", {
    headers: { Authorization: `Bearer ${token}` },
    params: { status },
  });
  return data?.count ?? 0;
};

// Admin: proponer slots
export const proposeSlots = async (
  id: string,
  payload: ProposeSlotsPayload,
  token: string,
): Promise<Appointment> => {
  const { data } = await axios.post<Appointment>(
    `/appointments/${id}/propose`,
    payload,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return data;
};

// Worker: elegir slot
export const selectSlot = async (
  id: string,
  payload: SelectSlotPayload,
  token: string,
): Promise<Appointment> => {
  const { data } = await axios.post<Appointment>(
    `/appointments/${id}/select`,
    payload,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return data;
};

// Worker: rechazar propuesta y volver a pending
export const rejectProposal = async (
  id: string,
  token: string,
): Promise<Appointment> => {
  const { data } = await axios.post<Appointment>(
    `/appointments/${id}/reject-proposal`,
    {},
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return data;
};

// Worker: solicitar cancelación -> cancellation_requested
export const requestCancellation = async (
  id: string,
  message: string,
  token: string,
): Promise<Appointment> => {
  const { data } = await axios.post<Appointment>(
    `/appointments/${id}/request-cancel`,
    { message },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return data;
};

//Worker: Borrar Cita (solo si ya está cancelled)
export const deleteMyAppointment = async (
  id: string,
  token: string,
): Promise<void> => {
  await axios.delete(`/appointments/${id}/my`, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

// Admin: calendario confirmadas en rango
export const getCalendarAppointments = async (
  fromISO: string,
  toISO: string,
  token: string,
): Promise<Appointment[]> => {
  const { data } = await axios.get<Appointment[]>(
    `/appointments/calendar?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return data;
};

// Admin: editar / reprogramar
export const updateAppointment = async (
  id: string,
  payload: UpdateAppointmentPayload,
  token: string,
): Promise<Appointment> => {
  const { data } = await axios.patch<Appointment>(
    `/appointments/${id}`,
    payload,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return data;
};

// Admin: cancelar
export const cancelAppointment = async (
  id: string,
  token: string,
): Promise<Appointment> => {
  const { data } = await axios.delete<Appointment>(`/appointments/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

// Admin: aceptar cancelación solicitada por el trabajador
export const acceptCancellation = async (
  id: string,
  token: string,
): Promise<Appointment> => {
  const { data } = await axios.post<Appointment>(
    `/appointments/${id}/accept-cancel`,
    {},
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return data;
};
