import { ENV } from "../config/env";
import { ApiError, getAuthBearerToken, notifyUnauthorizedIfStatus } from "./http";

export type ReportIssuePayload = {
  assignmentId: string;
  dienstNumber: number;
  date: string;
  startTime: string;
  endTime: string;
  team: string;
  ambulanceNumber: string;
  ambulanceId?: string;
  finalKm: number;
  timestamp: string;
  issueText: string;
  driver: string;
  medic: string;
};

export type MechanicsIssueReport = {
  _id: string;
  date: string;
  ambulanceNumber?: string;
  finalKm?: number;
  issueText: string;
  timestamp: string;
  attachments?: Array<{ url: string }>;
};

export type MechanicsPhotoInput = {
  uri: string;
  name?: string;
  mimeType?: string;
};

const MAX_MECHANICS_PHOTOS = 5;

function guessMimeType(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export async function reportIssue(
  payload: ReportIssuePayload,
  photos?: MechanicsPhotoInput[],
): Promise<void> {
  const token = await getAuthBearerToken();
  const files = (photos ?? []).slice(0, MAX_MECHANICS_PHOTOS);

  if (files.length === 0) {
    const response = await fetch(`${ENV.apiBaseUrl}/mechanics/report-issue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as
        | { message?: string; code?: string }
        | null;
      await notifyUnauthorizedIfStatus(response.status);
      throw new ApiError(
        data?.message ?? "No se pudo enviar la avería.",
        response.status,
        data?.code,
      );
    }
    return;
  }

  const form = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) continue;
    form.append(key, String(value));
  }
  for (const photo of files) {
    if (!photo.uri) continue;
    form.append("photos", {
      uri: photo.uri,
      name: photo.name ?? `issue-photo-${Date.now()}.jpg`,
      type: photo.mimeType ?? guessMimeType(photo.uri),
    } as unknown as Blob);
  }

  const response = await fetch(`${ENV.apiBaseUrl}/mechanics/report-issue`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as
      | { message?: string; code?: string }
      | null;
    await notifyUnauthorizedIfStatus(response.status);
    throw new ApiError(
      data?.message ?? "No se pudo enviar la avería.",
      response.status,
      data?.code,
    );
  }
}

export async function getMyIssueReports(date?: string): Promise<MechanicsIssueReport[]> {
  const token = await getAuthBearerToken();
  const qs = date ? `?date=${encodeURIComponent(date)}` : "";
  const response = await fetch(`${ENV.apiBaseUrl}/mechanics/issues/mine${qs}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = (await response.json().catch(() => null)) as
    | MechanicsIssueReport[]
    | { message?: string; code?: string }
    | null;
  if (!response.ok) {
    await notifyUnauthorizedIfStatus(response.status);
    const err = (data ?? {}) as { message?: string; code?: string };
    throw new ApiError(
      err.message ?? "No se pudieron cargar tus averías.",
      response.status,
      err.code,
    );
  }
  return Array.isArray(data) ? data : [];
}

