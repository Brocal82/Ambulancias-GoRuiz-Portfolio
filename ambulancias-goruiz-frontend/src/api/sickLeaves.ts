// frontend/src/api/sickLeaves.ts
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

/**
 * SickFlag: unifica flags acotados al rango consultado y el rango REAL completo.
 * - hasSickInRange: indica si existe solape en el rango consultado
 * - sickStartInRange / sickUntilInRange: tramo acotado dentro del rango consultado
 * - sickStartFull / sickUntilFull: tramo real completo (si el backend lo envía)
 */
export interface SickFlag {
  hasSickInRange: boolean;
  sickStartInRange?: string;  // 'YYYY-MM-DD' (tramo solapado con el rango consultado)
  sickUntilInRange?: string;  // 'YYYY-MM-DD'
  sickStartFull?: string;     // 'YYYY-MM-DD' (tramo completo real de la baja)
  sickUntilFull?: string;     // 'YYYY-MM-DD'
}

export type SickFlagsByUser = Record<string, SickFlag>;

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

/**
 * ✅ NUEVO: Adjuntar documento desde archivo (multipart/form-data)
 * - No rompe la API existente por URL.
 * - El backend deberá exponer POST /sick-leaves/:id/attach-document-file
 * - El nombre de campo del archivo es 'document' (ajusta si tu middleware usa otro).
 */
export async function attachSickDocumentFile(
  sickLeaveId: string,
  file: File
): Promise<SickLeave> {
  const form = new FormData();
  form.append('document', file); // <-- nombre de campo esperado en backend

  const { data } = await axiosInstance.post(
    `/sick-leaves/${sickLeaveId}/attach-document-file`,
    form
    // No setear Content-Type: axios lo resuelve con boundary al enviar FormData
  );
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

/**
 * Admin: consulta flags de bajas por rango (con tramo completo opcional para tooltip).
 * Requiere auth admin (el interceptor añade el token).
 */
export async function getSickFlagsInRange(params: {
  userIds: string[];
  fromISO: string;            // 'YYYY-MM-DD'
  toISO: string;              // 'YYYY-MM-DD'
  includeFullSpan?: boolean;  // true → devuelve sickStartFull/sickUntilFull
}): Promise<SickFlagsByUser> {
  const { data } = await axiosInstance.post<SickFlagsByUser>('/sick-leaves/check-range', params);
  return data;
}
