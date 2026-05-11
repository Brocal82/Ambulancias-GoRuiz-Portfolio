import { ENV } from "../config/env";
import { AuthUser } from "../types/auth";
import { ApiError, apiRequest, getAuthBearerToken } from "./http";

export async function getUserById(userId: string, authToken?: string): Promise<AuthUser> {
  return apiRequest<AuthUser>(`/users/${userId}`, {
    method: "GET",
    requiresAuth: true,
    ...(authToken ? { authToken } : {}),
  });
}

export type UserFileInput = {
  uri: string;
  name: string;
  mimeType: string;
};

export type UploadMyFilesPayload = {
  profileImage?: UserFileInput;
  document?: UserFileInput;
};

export async function uploadMyFiles(files: UploadMyFilesPayload): Promise<AuthUser> {
  const token = await getAuthBearerToken();
  if (!token) throw new ApiError("Sesion no disponible.", 401);

  const form = new FormData();
  if (files.profileImage) {
    form.append("profileImage", {
      uri: files.profileImage.uri,
      name: files.profileImage.name,
      type: files.profileImage.mimeType,
    } as unknown as Blob);
  }
  if (files.document) {
    form.append("documents", {
      uri: files.document.uri,
      name: files.document.name,
      type: files.document.mimeType,
    } as unknown as Blob);
  }

  const apiRoot = ENV.apiBaseUrl.replace(/\/+$/, "");
  const response = await fetch(`${apiRoot}/users/me/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const data = await response.json().catch(() => ({})) as AuthUser & { message?: string };
  if (!response.ok) {
    throw new ApiError((data as { message?: string }).message ?? "Error al subir archivo.", response.status);
  }
  return data;
}

export type WorkerSelfUpdatePayload = {
  phone?: string;
  address?: string;
  emergencyPhone?: string;
};

export async function updateMyProfile(
  userId: string,
  data: WorkerSelfUpdatePayload,
): Promise<AuthUser> {
  return apiRequest<AuthUser>(`/users/${userId}`, {
    method: "PATCH",
    requiresAuth: true,
    body: JSON.stringify(data),
  });
}
