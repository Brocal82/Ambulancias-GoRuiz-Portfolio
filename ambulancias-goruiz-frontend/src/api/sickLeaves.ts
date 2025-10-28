//frontend/src/api/sickLeaves.ts
import axiosInstance from "./axios";

export type SickLeaveStatus = 'pending' | 'accepted' | 'rejected';
export type SickVerificationStatus = 'not_required' | 'pending' | 'received' | 'overdue';

export interface SickLeave {
  _id: string;
  user: string | {
    _id: string;
    name: string;
    lastName: string;
    email?: string;
    role?: 'admin' | 'worker';
  };
  startDate: string;              // ISO date
  endDate: string;                // ISO date
  status: SickLeaveStatus;        // pending | accepted | rejected
  note?: string;
  documentUrl?: string;
  requiresDocument?: boolean;
  verificationStatus?: SickVerificationStatus;
  documentDueAt?: string;         // ISO date
  createdAt: string;
  updatedAt: string;
}

/* ──────────────────────────────────────────────── */
/* Trabajador                                      */
/* ──────────────────────────────────────────────── */

export async function createSickLeave(payload: {
  startDate: string;
  endDate: string;
  note?: string;
  documentUrl?: string;
}): Promise<SickLeave> {
  const { data } = await axiosInstance.post('/sick-leaves', payload);
  return data;
}

export async function listMySickLeaves(): Promise<SickLeave[]> {
  const { data } = await axiosInstance.get('/sick-leaves/mine');
  return data;
}

export async function attachSickDocument(
  sickLeaveId: string,
  documentUrl: string
): Promise<SickLeave> {
  const { data } = await axiosInstance.post(`/sick-leaves/${sickLeaveId}/attach-document`, {
    documentUrl,
  });
  return data;
}


/* ──────────────────────────────────────────────── */
/* Administrador                                   */
/* ──────────────────────────────────────────────── */

/**
 * Lista todas las bajas (opcionalmente filtra por status y/o userId)
 */
export async function adminListSickLeaves(params?: {
  status?: SickLeaveStatus;
  userId?: string;
}): Promise<SickLeave[]> {
  const search = new URLSearchParams();
  if (params?.status) search.set('status', params.status);
  if (params?.userId) search.set('user', params.userId);

  const qs = search.toString();
  const url = qs ? `/sick-leaves?${qs}` : '/sick-leaves';

  const { data } = await axiosInstance.get(url);
  return data;
}

/** Acepta una baja por su ID (dispara la desasignación parcial en backend) */
export async function adminAcceptSickLeave(sickLeaveId: string): Promise<SickLeave> {
  const { data } = await axiosInstance.post(`/sick-leaves/${sickLeaveId}/accept`);
  return data;
}

/** Rechaza una baja por su ID */
export async function adminRejectSickLeave(sickLeaveId: string): Promise<SickLeave> {
  const { data } = await axiosInstance.post(`/sick-leaves/${sickLeaveId}/reject`);
  return data;
}
