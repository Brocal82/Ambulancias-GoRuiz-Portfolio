// frontend/src/api/sickLeaves.ts
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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

type Token = string;

export async function createSickLeave(
  payload: { startDate: string; endDate: string; note?: string; documentUrl?: string },
  token: Token
): Promise<SickLeave> {
  const { data } = await axios.post(`${API_BASE}/sick-leaves`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function listMySickLeaves(token: Token): Promise<SickLeave[]> {
  const { data } = await axios.get(`${API_BASE}/sick-leaves/mine`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function attachSickDocument(
  sickLeaveId: string,
  documentUrl: string,
  token: Token
): Promise<SickLeave> {
  const { data } = await axios.post(
    `${API_BASE}/sick-leaves/${sickLeaveId}/attach-document`,
    { documentUrl },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
}

// --- ADMIN ONLY ---

/**
 * Lista todas las bajas (opcionalmente filtra por status y/o userId)
 * status: 'pending' | 'accepted' | 'rejected'
 */
export async function adminListSickLeaves(
  token: Token,
  params?: { status?: SickLeaveStatus; userId?: string }
): Promise<SickLeave[]> {
  const search = new URLSearchParams();
  if (params?.status) search.set('status', params.status);
  if (params?.userId) search.set('user', params.userId);

  const qs = search.toString();
  const url = qs ? `${API_BASE}/sick-leaves?${qs}` : `${API_BASE}/sick-leaves`;

  const { data } = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

/** Acepta una baja por su ID (dispara la desasignación parcial en backend) */
export async function adminAcceptSickLeave(
  sickLeaveId: string,
  token: Token
): Promise<SickLeave> {
  const { data } = await axios.post(
    `${API_BASE}/sick-leaves/${sickLeaveId}/accept`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
}

/** Rechaza una baja por su ID */
export async function adminRejectSickLeave(
  sickLeaveId: string,
  token: Token
): Promise<SickLeave> {
  const { data } = await axios.post(
    `${API_BASE}/sick-leaves/${sickLeaveId}/reject`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
}

