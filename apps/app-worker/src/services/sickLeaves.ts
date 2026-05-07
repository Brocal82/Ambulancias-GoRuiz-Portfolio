import { ENV } from "../config/env";
import { ApiError, apiRequest, getAuthBearerToken, notifyUnauthorizedIfStatus } from "./http";

export type SickLeaveStatus = "pending" | "accepted" | "rejected";
export type SickLeaveVerificationStatus = "not_required" | "pending" | "received" | "overdue";

export type SickLeaveItem = {
  _id: string;
  user: string | { _id: string; name?: string; lastName?: string; email?: string };
  startDate: string;
  endDate: string;
  status: SickLeaveStatus;
  note?: string;
  documentUrl?: string;
  documents?: string[];
  requiresDocument?: boolean;
  verificationStatus?: SickLeaveVerificationStatus;
  documentDueAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type SickLeaveFileInput = {
  uri: string;
  name?: string;
  mimeType?: string;
};

function guessMimeType(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".pdf")) return "application/pdf";
  return "image/jpeg";
}

export async function getMySickLeaves(): Promise<SickLeaveItem[]> {
  return apiRequest<SickLeaveItem[]>("/sick-leaves/mine", {
    method: "GET",
    requiresAuth: true,
  });
}

export async function createSickLeave(payload: {
  startDate: string;
  endDate: string;
  note?: string;
  documentUrl?: string;
}): Promise<SickLeaveItem> {
  return apiRequest<SickLeaveItem>("/sick-leaves", {
    method: "POST",
    requiresAuth: true,
    body: JSON.stringify(payload),
  });
}

export async function attachSickLeaveDocumentUrl(
  id: string,
  payload: { documentUrl: string },
): Promise<SickLeaveItem> {
  return apiRequest<SickLeaveItem>(`/sick-leaves/${id}/attach-document`, {
    method: "POST",
    requiresAuth: true,
    body: JSON.stringify(payload),
  });
}

export async function deleteMyRejectedSickLeave(id: string): Promise<void> {
  await apiRequest<void>(`/sick-leaves/${encodeURIComponent(id)}/mine`, {
    method: "DELETE",
    requiresAuth: true,
  });
}

export async function attachSickLeaveDocumentFile(
  id: string,
  file: SickLeaveFileInput,
): Promise<SickLeaveItem> {
  const token = await getAuthBearerToken();
  const form = new FormData();
  form.append("document", {
    uri: file.uri,
    name: file.name ?? `sick-document-${Date.now()}.jpg`,
    type: file.mimeType ?? guessMimeType(file.uri),
  } as unknown as Blob);

  const response = await fetch(`${ENV.apiBaseUrl}/sick-leaves/${encodeURIComponent(id)}/attach-document-file`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  });

  const data = (await response.json().catch(() => null)) as
    | SickLeaveItem
    | { message?: string; code?: string }
    | null;
  if (!response.ok) {
    await notifyUnauthorizedIfStatus(response.status);
    const err = (data ?? {}) as { message?: string; code?: string };
    throw new ApiError(
      err.message ?? "No se pudo adjuntar el documento.",
      response.status,
      err.code,
    );
  }

  return data as SickLeaveItem;
}
