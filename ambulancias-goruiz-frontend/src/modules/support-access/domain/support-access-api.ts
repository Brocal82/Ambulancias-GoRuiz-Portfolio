import axios from "../../../api/axios";

export type SupportAccessStatus =
  | "pending"
  | "approved"
  | "denied"
  | "revoked"
  | "expired";

export type SupportAccessRequest = {
  _id: string;
  companyId: string;
  requestedBy: string;
  reason: string;
  ticketId: string;
  durationMinutes: number;
  status: SupportAccessStatus;
  approvalsRequired?: number;
  approvalsCount?: number;
  reviewedAt?: string;
  expiresAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateSupportAccessInput = {
  companyId: string;
  reason: string;
  ticketId: string;
  durationMinutes: number;
};

export async function listSupportAccessRequests(
  status?: SupportAccessStatus,
): Promise<SupportAccessRequest[]> {
  const q = status ? `?status=${status}` : "";
  const res = await axios.get<SupportAccessRequest[]>(`/support-access/requests${q}`);
  return res.data;
}

export async function createSupportAccessRequest(
  data: CreateSupportAccessInput,
): Promise<SupportAccessRequest> {
  const res = await axios.post<SupportAccessRequest>("/support-access/requests", data);
  return res.data;
}

export async function reviewSupportAccessRequest(
  id: string,
  body: { approve: boolean; reviewComment?: string },
  stepUpToken?: string,
): Promise<SupportAccessRequest> {
  const res = await axios.post<SupportAccessRequest>(
    `/support-access/requests/${id}/review`,
    body,
    {
      headers: stepUpToken ? { "x-step-up-token": stepUpToken } : undefined,
    },
  );
  return res.data;
}

export async function revokeSupportAccessRequest(
  id: string,
  reason?: string,
): Promise<SupportAccessRequest> {
  const res = await axios.post<SupportAccessRequest>(
    `/support-access/requests/${id}/revoke`,
    { reason },
  );
  return res.data;
}
